// The simulation: waves of void creatures, the player's ship, bullets, shards,
// combos and level-ups. The world advances in fixed steps and reports events;
// the renderer paints the state and main.js owns the screens.

import {
  COMBO,
  ENEMIES,
  FIELD,
  PLAYER,
  PLAY_BOTTOM,
  PLAY_TOP,
  POOL,
  STEP,
  UNLOCK_WAVE,
  VICTORY_WAVE,
  WAVE,
  xpForLevel,
} from './config.js';
import {
  burst,
  countActive,
  createBullet,
  createEnemy,
  createFloater,
  createGem,
  createParticle,
  createPlayer,
  takeFrom,
  updateFloaters,
  updateParticles,
} from './entities.js';
import { rollUpgrades } from './upgrades.js';

export const EVENT_OVER = 1;
export const EVENT_LEVELUP = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_VICTORY = 8;

const KIND_DRIFTER = 'drifter';
const KIND_MITE = 'mite';
const KIND_SPLITTER = 'splitter';
const KIND_STINGER = 'stinger';
const KIND_ELITE = 'elite';

function poolOf(make, size) {
  const pool = [];
  for (let index = 0; index < size; index += 1) {
    const entry = make();
    entry.active = false;
    pool.push(entry);
  }
  return pool;
}

function blankBullet() {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: PLAYER.bulletRadius,
    damage: 0,
    pierce: 0,
    fromPlayer: true,
    crit: false,
    life: 0,
    hitIds: new Set(),
  };
}

function blankEnemy() {
  return {
    active: false,
    kind: KIND_DRIFTER,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 14,
    hp: 1,
    maxHp: 1,
    speed: 0,
    damage: 0,
    xp: 0,
    score: 0,
    color: '#ffffff',
    shootTimer: 0,
    flash: 0,
    wobble: 0,
    elite: false,
  };
}

function blankGem() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, value: 0, radius: 7, bob: 0 };
}

function blankParticle() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' };
}

function blankFloater() {
  return { active: false, x: 0, y: 0, text: '', color: '#ffffff', size: 14, life: 0, maxLife: 1 };
}

export function createWorld(random, audio) {
  const state = {
    time: 0,
    wave: 0,
    phase: 'breather',
    phaseTimer: 1.2,
    spawnQueue: [],
    spawnTimer: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    player: createPlayer(),
    bullets: poolOf(blankBullet, POOL.bullets),
    enemies: poolOf(blankEnemy, POOL.enemies),
    gems: poolOf(blankGem, POOL.gems),
    particles: poolOf(blankParticle, POOL.particles),
    floaters: poolOf(blankFloater, POOL.floaters),
    pendingLevelUps: 0,
    choices: [],
    taken: {},
    banner: { text: '', sub: '', timer: 0 },
    shake: 0,
    victoryShown: false,
    victoryEventSent: false,
    over: false,
    ambientCount: 0,
  };

  function showBanner(text, sub, seconds) {
    state.banner = { text, sub, timer: seconds };
  }

  function edgePoint() {
    const side = Math.floor(random.next() * 4);
    const margin = 24;
    if (side === 0) return { x: random.range(0, FIELD.width), y: PLAY_TOP - margin };
    if (side === 1) return { x: FIELD.width + margin, y: random.range(PLAY_TOP, PLAY_BOTTOM) };
    if (side === 2) return { x: random.range(0, FIELD.width), y: PLAY_BOTTOM + margin };
    return { x: -margin, y: random.range(PLAY_TOP, PLAY_BOTTOM) };
  }

  function spawnEnemy(kind) {
    const slot = takeFrom(state.enemies);
    if (!slot) return;
    const point = edgePoint();
    const made = createEnemy(kind, point.x, point.y, WAVE.hpScale(state.wave), WAVE.speedScale(state.wave));
    Object.assign(slot, made);
  }

  function buildWave(wave) {
    const queue = [];
    const budget = WAVE.budget(wave);
    const unlocked = Object.keys(UNLOCK_WAVE).filter((kind) => UNLOCK_WAVE[kind] <= wave && kind !== KIND_ELITE);
    const weights = { drifter: 5, splitter: 3, bulwark: 2, stinger: 2 };
    for (let index = 0; index < budget; index += 1) {
      let total = 0;
      for (const kind of unlocked) total += weights[kind] ?? 1;
      let roll = random.next() * total;
      let picked = unlocked[0];
      for (const kind of unlocked) {
        roll -= weights[kind] ?? 1;
        if (roll <= 0) {
          picked = kind;
          break;
        }
      }
      queue.push(picked);
    }
    if (wave % 5 === 0) queue.unshift(KIND_ELITE);
    // Shuffle the regulars so the elite is not always first out of the gate.
    for (let index = queue.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random.next() * (index + 1));
      [queue[index], queue[other]] = [queue[other], queue[index]];
    }
    return queue;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildWave(wave);
    state.spawnTimer = 0.4;
    state.phase = 'fight';
    showBanner(`WAVE ${wave}`, wave % 5 === 0 ? 'An Elite guards the field' : `${state.spawnQueue.length} hostiles inbound`, 2.2);
  }

  function dropGems(enemy) {
    for (let index = 0; index < enemy.xp; index += 1) {
      const slot = takeFrom(state.gems);
      if (!slot) return;
      const made = createGem(enemy.x + random.range(-14, 14), enemy.y + random.range(-14, 14), 1);
      Object.assign(slot, made);
      slot.vx = random.range(-40, 40);
      slot.vy = random.range(-40, 40);
    }
  }

  function addFloater(x, y, text, color, size) {
    const slot = takeFrom(state.floaters);
    if (!slot) return;
    const made = createFloater(x, y, text, color, size);
    Object.assign(slot, made);
  }

  function killEnemy(enemy, awardScore) {
    enemy.active = false;
    state.kills += 1;
    burst(state.particles, enemy.x, enemy.y, enemy.color, enemy.elite ? 26 : 12, enemy.elite ? 260 : 170, 0.55, enemy.elite ? 4 : 3);
    if (enemy.kind === KIND_SPLITTER) {
      for (let index = 0; index < 2; index += 1) {
        const slot = takeFrom(state.enemies);
        if (!slot) break;
        const made = createEnemy(KIND_MITE, enemy.x + random.range(-10, 10), enemy.y + random.range(-10, 10), WAVE.hpScale(state.wave), WAVE.speedScale(state.wave));
        Object.assign(slot, made);
      }
    }
    dropGems(enemy);
    if (awardScore) {
      state.combo += 1;
      state.comboTimer = COMBO.window;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      const multiplier = 1 + Math.min(state.combo, 40) * COMBO.perKill;
      const gained = Math.round(enemy.score * Math.min(multiplier, COMBO.cap));
      state.score += gained;
      addFloater(enemy.x, enemy.y - enemy.radius, `+${gained}`, multiplier > 1.5 ? '#ffd23d' : '#eef1f5', multiplier > 1.5 ? 17 : 14);
    }
    audio.enemyDie();
  }

  function hurtPlayer(damage, fromX, fromY) {
    const player = state.player;
    if (player.invulnerable > 0 || player.dashTimer > 0) return;
    player.hp -= damage;
    player.invulnerable = PLAYER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.min(1, state.shake + 0.55);
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const length = Math.hypot(dx, dy) || 1;
    player.vx += (dx / length) * 260;
    player.vy += (dy / length) * 260;
    burst(state.particles, player.x, player.y, '#ff534b', 14, 220, 0.5, 3);
    audio.hurt();
    if (player.hp <= 0) {
      player.hp = 0;
      state.over = true;
      burst(state.particles, player.x, player.y, '#4df3ff', 60, 340, 1.1, 4);
      burst(state.particles, player.x, player.y, '#ffffff', 30, 200, 0.9, 3);
      state.shake = 1;
      audio.gameOver();
    }
  }

  function firePlayerBullets(angle) {
    const player = state.player;
    const count = player.multishot;
    const spread = 0.09;
    for (let index = 0; index < count; index += 1) {
      const slot = takeFrom(state.bullets);
      if (!slot) return;
      const offset = count === 1 ? 0 : (index - (count - 1) / 2) * spread * 2;
      const bulletAngle = angle + offset;
      const crit = random.next() < player.critChance;
      const made = createBullet(
        player.x + Math.cos(bulletAngle) * (player.radius + 6),
        player.y + Math.sin(bulletAngle) * (player.radius + 6),
        Math.cos(bulletAngle) * player.bulletSpeed,
        Math.sin(bulletAngle) * player.bulletSpeed,
        Math.round(player.damage * (crit ? PLAYER.critMultiplier : 1)),
        player.pierce,
        true,
        crit,
      );
      Object.assign(slot, made);
      slot.hitIds = new Set();
    }
    state.shotsFired += 1;
    audio.shoot();
  }

  function fireNova() {
    const player = state.player;
    const count = 8 + player.novaCount * 4;
    for (let index = 0; index < count; index += 1) {
      const slot = takeFrom(state.bullets);
      if (!slot) return;
      const angle = (index / count) * Math.PI * 2;
      const made = createBullet(
        player.x,
        player.y,
        Math.cos(angle) * 420,
        Math.sin(angle) * 420,
        Math.round(player.damage * 0.8),
        0,
        true,
        false,
      );
      Object.assign(slot, made);
      slot.hitIds = new Set();
    }
    burst(state.particles, player.x, player.y, '#4df3ff', 20, 260, 0.5, 3);
  }

  function fireEnemyBullet(enemy) {
    const player = state.player;
    const slot = takeFrom(state.bullets);
    if (!slot) return;
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const made = createBullet(
      enemy.x,
      enemy.y,
      Math.cos(angle) * 190,
      Math.sin(angle) * 190,
      enemy.damage,
      0,
      false,
      false,
    );
    Object.assign(slot, made);
    slot.hitIds = new Set();
    slot.radius = 6;
  }

  function stepPlayer(step, input, prevDash) {
    const player = state.player;
    player.invulnerable = Math.max(0, player.invulnerable - step);
    player.dashCooldown = Math.max(0, player.dashCooldown - step);
    player.fireTimer -= step;
    player.trailTimer -= step;

    const move = input.move;
    const aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
    player.angle = aimAngle;

    const dashPressed = input.dashHeld && !prevDash;
    if (dashPressed && player.dashCooldown <= 0) {
      const moving = move.x !== 0 || move.y !== 0;
      const dirX = moving ? move.x : Math.cos(aimAngle);
      const dirY = moving ? move.y : Math.sin(aimAngle);
      player.dashTimer = PLAYER.dashTime;
      player.dashDirX = dirX;
      player.dashDirY = dirY;
      player.dashCooldown = player.dashCooldownMax ?? PLAYER.dashCooldown;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.12);
      audio.dash();
    }

    if (player.dashTimer > 0) {
      player.dashTimer -= step;
      player.vx = player.dashDirX * PLAYER.dashSpeed;
      player.vy = player.dashDirY * PLAYER.dashSpeed;
      if (player.trailTimer <= 0) {
        player.trailTimer = 0.03;
        const slot = takeFrom(state.particles);
        if (slot) {
          const made = createParticle(player.x, player.y, -player.vx * 0.08, -player.vy * 0.08, 0.35, 5, '#4df3ff');
          Object.assign(slot, made);
        }
      }
    } else {
      const accel = 2400;
      player.vx += move.x * accel * step;
      player.vy += move.y * accel * step;
      const damp = Math.max(0, 1 - 6 * step);
      player.vx *= damp;
      player.vy *= damp;
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > player.speed) {
        player.vx = (player.vx / speed) * player.speed;
        player.vy = (player.vy / speed) * player.speed;
      }
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * step));
    player.y = Math.min(PLAY_BOTTOM - player.radius, Math.max(PLAY_TOP + player.radius, player.y + player.vy * step));

    if (input.firing && player.fireTimer <= 0) {
      player.fireTimer = player.fireInterval;
      firePlayerBullets(aimAngle);
    }

    if (player.novaCount > 0) {
      player.novaTimer -= step;
      if (player.novaTimer <= 0) {
        player.novaTimer = player.novaInterval;
        fireNova();
      }
    }
    return input.dashHeld;
  }

  function stepEnemies(step) {
    const player = state.player;
    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index];
      if (!enemy.active) continue;
      enemy.flash = Math.max(0, enemy.flash - step * 4);
      enemy.wobble += step * 2;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      const towardX = dx / distance;
      const towardY = dy / distance;
      const wobbleX = Math.cos(enemy.wobble) * 0.25;
      const wobbleY = Math.sin(enemy.wobble) * 0.25;

      if (enemy.kind === KIND_STINGER) {
        let moveX = towardX;
        let moveY = towardY;
        if (distance < 220) {
          moveX = -towardX;
          moveY = -towardY;
        } else if (distance < 300) {
          moveX = -towardY * 0.6;
          moveY = towardX * 0.6;
        }
        enemy.vx = moveX * enemy.speed;
        enemy.vy = moveY * enemy.speed;
        enemy.shootTimer -= step;
        if (enemy.shootTimer <= 0 && distance < 520) {
          enemy.shootTimer = 2.2;
          fireEnemyBullet(enemy);
        }
      } else if (enemy.elite) {
        enemy.vx = (towardX + wobbleX * 0.4) * enemy.speed;
        enemy.vy = (towardY + wobbleY * 0.4) * enemy.speed;
        enemy.shootTimer -= step;
        if (enemy.shootTimer <= 0) {
          enemy.shootTimer = 4;
          for (let burstIndex = 0; burstIndex < 8; burstIndex += 1) {
            const slot = takeFrom(state.bullets);
            if (!slot) break;
            const angle = (burstIndex / 8) * Math.PI * 2 + enemy.wobble;
            const made = createBullet(enemy.x, enemy.y, Math.cos(angle) * 150, Math.sin(angle) * 150, 10, 0, false, false);
            Object.assign(slot, made);
            slot.hitIds = new Set();
            slot.radius = 6;
          }
        }
      } else {
        enemy.vx = (towardX + wobbleX) * enemy.speed;
        enemy.vy = (towardY + wobbleY) * enemy.speed;
      }
      enemy.x += enemy.vx * step;
      enemy.y += enemy.vy * step;
    }

    // Light separation so creatures do not stack into one blob.
    const list = state.enemies;
    for (let a = 0; a < list.length; a += 1) {
      const first = list[a];
      if (!first.active) continue;
      for (let b = a + 1; b < list.length; b += 1) {
        const second = list[b];
        if (!second.active) continue;
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const min = first.radius + second.radius;
        const squared = dx * dx + dy * dy;
        if (squared <= 0.01 || squared >= min * min) continue;
        const distance = Math.sqrt(squared);
        const push = ((min - distance) / distance) * 0.5 * 60 * step;
        first.x -= dx * push;
        first.y -= dy * push;
        second.x += dx * push;
        second.y += dy * push;
      }
    }
  }

  function stepBullets(step) {
    const player = state.player;
    for (let index = 0; index < state.bullets.length; index += 1) {
      const bullet = state.bullets[index];
      if (!bullet.active) continue;
      bullet.life -= step;
      bullet.x += bullet.vx * step;
      bullet.y += bullet.vy * step;
      if (bullet.life <= 0 || bullet.x < -30 || bullet.x > FIELD.width + 30 || bullet.y < -30 || bullet.y > FIELD.height + 30) {
        bullet.active = false;
        continue;
      }
      if (bullet.fromPlayer) {
        for (let other = 0; other < state.enemies.length; other += 1) {
          const enemy = state.enemies[other];
          if (!enemy.active || bullet.hitIds.has(enemy)) continue;
          const dx = enemy.x - bullet.x;
          const dy = enemy.y - bullet.y;
          const reach = enemy.radius + bullet.radius;
          if (dx * dx + dy * dy > reach * reach) continue;
          bullet.hitIds.add(enemy);
          enemy.hp -= bullet.damage;
          enemy.flash = 1;
          state.shotsHit += 1;
          burst(state.particles, bullet.x, bullet.y, enemy.color, 4, 130, 0.3, 2);
          addFloater(enemy.x, enemy.y - enemy.radius - 6, String(bullet.damage), bullet.crit ? '#ffd23d' : '#ffffff', bullet.crit ? 17 : 13);
          audio.hit();
          if (enemy.hp <= 0) killEnemy(enemy, true);
          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else {
            bullet.active = false;
          }
          break;
        }
      } else if (player.hp > 0) {
        const dx = player.x - bullet.x;
        const dy = player.y - bullet.y;
        const reach = player.radius + bullet.radius;
        if (dx * dx + dy * dy <= reach * reach) {
          bullet.active = false;
          hurtPlayer(bullet.damage, bullet.x, bullet.y);
        }
      }
    }
  }

  function stepCollisions() {
    const player = state.player;
    if (player.hp <= 0) return;
    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index];
      if (!enemy.active) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const reach = player.radius + enemy.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        hurtPlayer(enemy.damage, enemy.x, enemy.y);
        if (state.over) return;
      }
    }
  }

  function stepGems(step) {
    const player = state.player;
    for (let index = 0; index < state.gems.length; index += 1) {
      const gem = state.gems[index];
      if (!gem.active) continue;
      gem.bob += step * 4;
      gem.x += gem.vx * step;
      gem.y += gem.vy * step;
      gem.vx *= 1 - 3 * step;
      gem.vy *= 1 - 3 * step;
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      const distance = Math.hypot(dx, dy);
      if (distance < player.magnet && distance > 1) {
        const pull = 620 * (1 - distance / (player.magnet + 60));
        gem.vx += (dx / distance) * pull * step * 8;
        gem.vy += (dy / distance) * pull * step * 8;
      }
      if (distance < player.radius + gem.radius + 4) {
        gem.active = false;
        state.player.xp += gem.value;
        audio.pickup(state.combo);
        burst(state.particles, gem.x, gem.y, '#7dff8a', 4, 110, 0.3, 2);
      }
    }
    while (state.player.xp >= state.player.xpNext) {
      state.player.xp -= state.player.xpNext;
      state.player.level += 1;
      state.player.xpNext = xpForLevel(state.player.level);
      state.pendingLevelUps += 1;
      burst(state.particles, state.player.x, state.player.y, '#ffd23d', 30, 260, 0.8, 3);
      addFloater(state.player.x, state.player.y - 30, 'LEVEL UP', '#ffd23d', 22);
      audio.levelUp();
    }
    if (state.pendingLevelUps > 0 && state.choices.length === 0) {
      state.choices = rollUpgrades(state.player, state.taken, random);
    }
  }

  function stepSpawning(step) {
    if (state.phase !== 'fight') return;
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= step;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = WAVE.spawnInterval(state.wave);
        spawnEnemy(state.spawnQueue.shift());
      }
      return;
    }
    if (countActive(state.enemies) === 0) {
      const cleared = state.wave;
      const bonus = WAVE.clearBonus(cleared);
      state.score += bonus;
      audio.waveClear();
      showBanner(`WAVE ${cleared} CLEARED`, `Bonus +${bonus}`, 2.4);
      if (cleared === VICTORY_WAVE && !state.victoryShown) {
        state.victoryShown = true;
        state.phase = 'breather';
        state.phaseTimer = WAVE.breather;
        return;
      }
      state.phase = 'breather';
      state.phaseTimer = WAVE.breather;
    }
  }

  function stepBreather(step) {
    if (state.phase !== 'breather') return;
    state.phaseTimer -= step;
    if (state.phaseTimer <= 0) startWave(state.wave + 1);
  }

  function stepAmbient(step) {
    if (state.ambientCount < 6 && random.next() < 0.02) {
      const kinds = [KIND_DRIFTER, KIND_SPLITTER, KIND_STINGER];
      spawnEnemy(kinds[Math.floor(random.next() * kinds.length)]);
      state.ambientCount += 1;
    }
    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index];
      if (!enemy.active) continue;
      enemy.wobble += step * 2;
      enemy.x += (Math.cos(enemy.wobble) * 0.5 + 0.2) * enemy.speed * 0.4 * step;
      enemy.y += Math.sin(enemy.wobble * 0.7) * enemy.speed * 0.4 * step;
      if (enemy.x < -40 || enemy.x > FIELD.width + 40 || enemy.y < -40 || enemy.y > FIELD.height + 40) {
        enemy.active = false;
        state.ambientCount -= 1;
      }
    }
    updateParticles(state.particles, step);
  }

  let prevDash = false;

  return {
    state,
    reset() {
      state.time = 0;
      state.wave = 0;
      state.phase = 'breather';
      state.phaseTimer = 1.2;
      state.spawnQueue = [];
      state.spawnTimer = 0;
      state.score = 0;
      state.combo = 0;
      state.comboTimer = 0;
      state.bestCombo = 0;
      state.kills = 0;
      state.shotsFired = 0;
      state.shotsHit = 0;
      state.player = createPlayer();
      for (const pool of [state.bullets, state.enemies, state.gems, state.particles, state.floaters]) {
        for (const entry of pool) entry.active = false;
      }
      state.pendingLevelUps = 0;
      state.choices = [];
      state.taken = {};
      state.banner = { text: '', sub: '', timer: 0 };
      state.shake = 0;
      state.victoryShown = false;
      state.victoryEventSent = false;
      state.over = false;
      state.ambientCount = 0;
      prevDash = false;
    },
    /** Apply a level-up choice by index (0-2); returns true when applied. */
    applyUpgrade(index) {
      const choice = state.choices[index];
      if (!choice) return false;
      choice.apply(state.player);
      if (choice.id !== 'repair') state.taken[choice.id] = (state.taken[choice.id] ?? 0) + 1;
      state.pendingLevelUps -= 1;
      state.choices = state.pendingLevelUps > 0 ? rollUpgrades(state.player, state.taken, random) : [];
      return true;
    },
    /**
     * Advance the world one fixed step. `input` is { move, aimX, aimY, firing,
     * dashHeld } (null in ambient mode, where creatures drift behind the title).
     * Returns an event bitmask.
     */
    step(step, input, ambient) {
      state.time += step;
      if (state.banner.timer > 0) state.banner.timer -= step;
      state.shake = Math.max(0, state.shake - step * 1.6);
      if (state.comboTimer > 0) {
        state.comboTimer -= step;
        if (state.comboTimer <= 0) state.combo = 0;
      }
      if (ambient) {
        stepAmbient(step);
        return 0;
      }
      prevDash = stepPlayer(step, input, prevDash);
      stepEnemies(step);
      stepBullets(step);
      stepCollisions();
      stepGems(step);
      stepSpawning(step);
      stepBreather(step);
      updateParticles(state.particles, step);
      updateFloaters(state.floaters, step);

      let events = 0;
      if (state.over) events |= EVENT_OVER;
      if (state.pendingLevelUps > 0) events |= EVENT_LEVELUP;
      if (state.victoryShown && !state.victoryEventSent && state.phase === 'breather' && state.wave === VICTORY_WAVE) {
        events |= EVENT_VICTORY;
        state.victoryEventSent = true;
      }
      return events;
    },
  };
}

export { ENEMIES };
