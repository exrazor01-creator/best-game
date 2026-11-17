// The things in the arena: the player ship, the void creatures, bullets,
// shards, particles and floating combat text. Plain objects in pools the world
// allocates once; a dead entry is flagged inactive and reused.

import { ENEMIES, FIELD, PLAYER } from './config.js';

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    level: 1,
    xp: 0,
    xpNext: 10,
    kills: 0,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: -1,
    invulnerable: 0,
    speed: PLAYER.speed,
    damage: PLAYER.damage,
    fireInterval: PLAYER.fireInterval,
    bulletSpeed: PLAYER.bulletSpeed,
    multishot: 1,
    pierce: 0,
    critChance: PLAYER.critChance,
    magnet: PLAYER.magnet,
    novaTimer: 0,
    novaCount: 0,
    novaInterval: 6,
    trailTimer: 0,
  };
}

export function createEnemy(kind, x, y, hpScale, speedScale) {
  const spec = ENEMIES[kind];
  const hp = Math.round(spec.hp * hpScale);
  return {
    active: true,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: spec.radius,
    hp,
    maxHp: hp,
    speed: spec.speed * speedScale,
    damage: spec.damage,
    xp: spec.xp,
    score: spec.score,
    color: spec.color,
    shootTimer: 2,
    flash: 0,
    wobble: Math.random() * Math.PI * 2,
    elite: kind === 'elite',
  };
}

export function createBullet(x, y, vx, vy, damage, pierce, fromPlayer, crit) {
  return {
    active: true,
    x,
    y,
    vx,
    vy,
    radius: PLAYER.bulletRadius,
    damage,
    pierce,
    fromPlayer,
    crit,
    life: 1.6,
    hitIds: new Set(),
  };
}

export function createGem(x, y, value) {
  return {
    active: true,
    x,
    y,
    vx: 0,
    vy: 0,
    value,
    radius: 7,
    bob: Math.random() * Math.PI * 2,
  };
}

export function createParticle(x, y, vx, vy, life, size, color) {
  return { active: true, x, y, vx, vy, life, maxLife: life, size, color };
}

export function createFloater(x, y, text, color, size) {
  return { active: true, x, y, text, color, size, life: 0.9, maxLife: 0.9 };
}

/** Spray `count` particles from a point into the pool. */
export function burst(pool, x, y, color, count, speed, life, size) {
  let made = 0;
  for (let index = 0; index < pool.length && made < count; index += 1) {
    const particle = pool[index];
    if (particle.active) continue;
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.3 + Math.random() * 0.7);
    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.vx = Math.cos(angle) * power;
    particle.vy = Math.sin(angle) * power;
    particle.life = life * (0.6 + Math.random() * 0.6);
    particle.maxLife = particle.life;
    particle.size = size * (0.6 + Math.random() * 0.8);
    particle.color = color;
    made += 1;
  }
}

export function updateParticles(pool, step) {
  for (let index = 0; index < pool.length; index += 1) {
    const particle = pool[index];
    if (!particle.active) continue;
    particle.life -= step;
    if (particle.life <= 0) {
      particle.active = false;
      continue;
    }
    particle.x += particle.vx * step;
    particle.y += particle.vy * step;
    particle.vx *= 1 - 2.2 * step;
    particle.vy *= 1 - 2.2 * step;
  }
}

export function updateFloaters(pool, step) {
  for (let index = 0; index < pool.length; index += 1) {
    const floater = pool[index];
    if (!floater.active) continue;
    floater.life -= step;
    if (floater.life <= 0) {
      floater.active = false;
      continue;
    }
    floater.y -= 42 * step;
  }
}

/** First inactive entry of a pool, or null when it is full. */
export function takeFrom(pool) {
  for (let index = 0; index < pool.length; index += 1) {
    if (!pool[index].active) return pool[index];
  }
  return null;
}

/** How many entries of a pool are live. */
export function countActive(pool) {
  let count = 0;
  for (let index = 0; index < pool.length; index += 1) {
    if (pool[index].active) count += 1;
  }
  return count;
}
