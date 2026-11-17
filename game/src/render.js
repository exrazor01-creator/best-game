// Drawing: the arena, the creatures, the HUD and every menu, all on one
// canvas in the fixed 1280x720 logical field, scaled to the window. Glow is
// shadowBlur kept small and shapes are plain paths, so the frame stays fast.

import { FIELD, FONT, PALETTE } from './config.js';
import { countActive } from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const CARD_WIDTH = 300;
const CARD_HEIGHT = 210;
const CARD_GAP = 28;
const CARD_Y = 300;

/** The three level-up card rectangles, in logical coordinates. */
export function levelUpCardRects() {
  const total = CARD_WIDTH * 3 + CARD_GAP * 2;
  const startX = (FIELD.width - total) / 2;
  return [0, 1, 2].map((index) => ({
    x: startX + index * (CARD_WIDTH + CARD_GAP),
    y: CARD_Y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  }));
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, offsetX: 0, offsetY: 0, width: 1280, height: 720 };

  // Fixed backdrop dressing, placed once so the arena never reshuffles.
  const stars = [];
  for (let index = 0; index < 90; index += 1) {
    stars.push({
      x: (index * 977) % FIELD.width,
      y: (index * 613) % FIELD.height,
      size: 0.6 + ((index * 37) % 10) / 10,
      phase: (index * 0.7) % (Math.PI * 2),
    });
  }
  const nebulae = [
    { x: 260, y: 180, radius: 260, color: '#1d1440' },
    { x: 1020, y: 540, radius: 300, color: '#0f2440' },
    { x: 900, y: 120, radius: 200, color: '#33122e' },
  ];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const scale = Math.min(width / FIELD.width, height / FIELD.height);
    view = {
      scale: scale * dpr,
      offsetX: (width * dpr - FIELD.width * scale * dpr) / 2,
      offsetY: (height * dpr - FIELD.height * scale * dpr) / 2,
      width,
      height,
    };
  }

  window.addEventListener('resize', resize);
  resize();

  function drawBackground(time) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const nebula of nebulae) {
      const gradient = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.radius);
      gradient.addColorStop(0, nebula.color);
      gradient.addColorStop(1, 'rgba(7,10,22,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(nebula.x - nebula.radius, nebula.y - nebula.radius, nebula.radius * 2, nebula.radius * 2);
    }
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    for (const star of stars) {
      const alpha = 0.35 + 0.35 * Math.sin(time * 1.4 + star.phase);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cfe6ff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PALETTE.arenaEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, FIELD.width - 12, FIELD.height - 12);
  }

  function drawPlayer(player, time) {
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.invulnerable > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    // Engine flame.
    const flame = 10 + Math.sin(time * 30) * 4;
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.lineTo(0, 10 + flame);
    ctx.lineTo(6, 10);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(player.angle + Math.PI / 2);
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 18;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 12);
    ctx.lineTo(0, 6);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (player.dashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = PALETTE.player;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemy(enemy, time) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const flash = enemy.flash > 0;
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = flash ? 26 : 14;
    ctx.fillStyle = flash ? '#ffffff' : enemy.color;
    ctx.strokeStyle = enemy.color;
    ctx.lineWidth = 2;
    const r = enemy.radius;
    if (enemy.kind === 'drifter') {
      ctx.rotate(time * 1.2 + enemy.wobble);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'mite') {
      ctx.rotate(enemy.wobble * 2);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, r);
      ctx.lineTo(-r, r);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'bulwark') {
      ctx.rotate(0.3);
      ctx.beginPath();
      for (let side = 0; side < 6; side += 1) {
        const angle = (side / 6) * Math.PI * 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (side === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b1020';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'splitter') {
      const pulse = 1 + Math.sin(time * 5 + enemy.wobble) * 0.08;
      ctx.scale(pulse, pulse);
      ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(-r * 0.35, -r * 0.35, r * 0.7, r * 0.7);
    } else if (enemy.kind === 'stinger') {
      ctx.beginPath();
      for (let side = 0; side < 5; side += 1) {
        const angle = (side / 5) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (side === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b1020';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Elite: a crowned star with a slow orbit ring.
      ctx.rotate(time * 0.5);
      ctx.beginPath();
      for (let side = 0; side < 10; side += 1) {
        const angle = (side / 10) * Math.PI * 2 - Math.PI / 2;
        const radius = side % 2 === 0 ? r : r * 0.55;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (side === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-time * 0.5);
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, r + 10, time * 1.5, time * 1.5 + Math.PI * 1.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (enemy.hp < enemy.maxHp) {
      const width = enemy.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width, 5);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width * (enemy.hp / enemy.maxHp), 5);
    }
  }

  function drawWorld(state, time) {
    for (let index = 0; index < state.gems.length; index += 1) {
      const gem = state.gems[index];
      if (!gem.active) continue;
      const bob = Math.sin(gem.bob) * 2;
      ctx.save();
      ctx.translate(gem.x, gem.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.shadowColor = PALETTE.gem;
      ctx.shadowBlur = 10;
      ctx.fillStyle = PALETTE.gem;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    for (let index = 0; index < state.bullets.length; index += 1) {
      const bullet = state.bullets[index];
      if (!bullet.active) continue;
      ctx.save();
      ctx.shadowColor = bullet.fromPlayer ? PALETTE.bullet : PALETTE.enemyBullet;
      ctx.shadowBlur = 10;
      ctx.fillStyle = bullet.fromPlayer ? PALETTE.bullet : PALETTE.enemyBullet;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index];
      if (enemy.active) drawEnemy(enemy, time);
    }
    if (state.player.hp > 0) drawPlayer(state.player, time);
    for (let index = 0; index < state.particles.length; index += 1) {
      const particle = state.particles[index];
      if (!particle.active) continue;
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (let index = 0; index < state.floaters.length; index += 1) {
      const floater = state.floaters[index];
      if (!floater.active) continue;
      ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      ctx.fillStyle = floater.color;
      ctx.font = `700 ${floater.size}px ${FONT}`;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.globalAlpha = 1;
  }

  function bar(x, y, width, height, fraction, fill, background) {
    ctx.fillStyle = background;
    roundedRect(ctx, x, y, width, height, height / 2);
    ctx.fill();
    if (fraction > 0) {
      ctx.fillStyle = fill;
      roundedRect(ctx, x, y, width * Math.min(1, fraction), height, height / 2);
      ctx.fill();
    }
  }

  function drawHud(state, best) {
    const player = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top strip.
    ctx.fillStyle = 'rgba(7,10,22,0.72)';
    ctx.fillRect(0, 0, FIELD.width, 64);
    ctx.strokeStyle = PALETTE.arenaEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(FIELD.width, 64);
    ctx.stroke();
    // Hull.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText('HULL', 20, 24);
    bar(20, 30, 220, 14, player.hp / player.maxHp, player.hp / player.maxHp > 0.3 ? '#4df3ff' : '#ff534b', '#1a2238');
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 250, 43);
    // Experience.
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`LV ${player.level}`, 330, 24);
    bar(330, 30, 220, 14, player.xp / player.xpNext, '#7dff8a', '#1a2238');
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${player.xp} / ${player.xpNext} shards`, 330, 58);
    // Score.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(String(state.score).padStart(6, '0'), FIELD.width / 2, 34);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, FIELD.width / 2, 54);
    if (state.combo > 1) {
      ctx.fillStyle = '#ffd23d';
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(`COMBO x${(1 + Math.min(state.combo, 40) * 0.1).toFixed(1)}  ·  ${state.combo} kills`, FIELD.width / 2, 84);
    }
    // Wave.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(`WAVE ${Math.max(1, state.wave)}`, FIELD.width - 20, 32);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 13px ${FONT}`;
    const remaining = state.spawnQueue.length + countActive(state.enemies);
    ctx.fillText(state.phase === 'breather' ? 'next wave soon' : `${remaining} hostiles left`, FIELD.width - 20, 54);
    // Dash cooldown, bottom-left.
    const dashMax = player.dashCooldownMax ?? 2.2;
    const ready = player.dashCooldown <= 0;
    ctx.textAlign = 'left';
    ctx.fillStyle = ready ? '#4df3ff' : PALETTE.muted;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(ready ? 'DASH READY — SPACE' : 'DASH…', 20, FIELD.height - 18);
    bar(20, FIELD.height - 14, 120, 6, 1 - player.dashCooldown / dashMax, '#4df3ff', '#1a2238');
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('P pause · M mute · R restart', FIELD.width - 20, FIELD.height - 18);
    // Banner.
    if (state.banner.timer > 0) {
      const alpha = Math.min(1, state.banner.timer);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#4df3ff';
      ctx.shadowBlur = 22;
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText(state.banner.text, FIELD.width / 2, 190);
      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 17px ${FONT}`;
      ctx.fillText(state.banner.sub, FIELD.width / 2, 220);
      ctx.globalAlpha = 1;
    }
  }

  function dim() {
    ctx.fillStyle = 'rgba(4,6,14,0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function panel(x, y, width, height) {
    ctx.fillStyle = 'rgba(20,26,46,0.94)';
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundedRect(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.stroke();
  }

  function drawTitle(state, best) {
    drawWorld(state, state.time);
    dim();
    ctx.textAlign = 'center';
    ctx.shadowColor = '#4df3ff';
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#aef7ff';
    ctx.font = `800 92px ${FONT}`;
    ctx.fillText('VOIDPULSE', FIELD.width / 2, 218);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('A neon arena roguelite — survive the void, level up, clear wave 10.', FIELD.width / 2, 262);
    panel(FIELD.width / 2 - 330, 300, 660, 150);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText('WASD / arrows — move        Mouse — aim        Hold click — fire', FIELD.width / 2, 340);
    ctx.fillText('SPACE — dash        P — pause        M — mute        R — restart', FIELD.width / 2, 372);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('Blast void creatures, collect their shards, pick an upgrade every level.', FIELD.width / 2, 410);
    ctx.fillText('Chain kills for a combo multiplier. An Elite guards every 5th wave.', FIELD.width / 2, 434);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd23d';
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText('CLICK OR PRESS SPACE TO START', FIELD.width / 2, 520);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(best > 0 ? `Best score: ${best}` : 'No runs yet — set the first best score.', FIELD.width / 2, 560);
  }

  function drawLevelUp(state, mouse) {
    drawWorld(state, state.time);
    drawHud(state, 0);
    dim();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23d';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(`LEVEL ${state.player.level}`, FIELD.width / 2, 190);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('Choose an upgrade — click a card or press 1, 2 or 3.', FIELD.width / 2, 226);
    const rects = levelUpCardRects();
    for (let index = 0; index < state.choices.length; index += 1) {
      const choice = state.choices[index];
      const rect = rects[index];
      const hover = mouse && mouse.x >= rect.x && mouse.x <= rect.x + rect.width && mouse.y >= rect.y && mouse.y <= rect.y + rect.height;
      ctx.fillStyle = hover ? 'rgba(77,243,255,0.14)' : 'rgba(20,26,46,0.96)';
      ctx.strokeStyle = hover ? '#4df3ff' : PALETTE.panelEdge;
      ctx.lineWidth = hover ? 3 : 2;
      roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4df3ff';
      ctx.font = `800 15px ${FONT}`;
      ctx.fillText(choice.icon, rect.x + rect.width / 2, rect.y + 44);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 21px ${FONT}`;
      ctx.fillText(choice.name, rect.x + rect.width / 2, rect.y + 84);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 15px ${FONT}`;
      const words = choice.text.split(' ');
      let line = '';
      let lineY = rect.y + 122;
      for (const word of words) {
        if ((line + word).length > 22) {
          ctx.fillText(line.trim(), rect.x + rect.width / 2, lineY);
          line = '';
          lineY += 22;
        }
        line += `${word} `;
      }
      ctx.fillText(line.trim(), rect.x + rect.width / 2, lineY);
      ctx.fillStyle = '#ffd23d';
      ctx.font = `800 15px ${FONT}`;
      ctx.fillText(`[ ${index + 1} ]`, rect.x + rect.width / 2, rect.y + CARD_HEIGHT - 22);
    }
  }

  function drawPaused() {
    dim();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 330);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText('Press P or Space to resume — R to restart the run.', FIELD.width / 2, 372);
  }

  function statsRows(state, best) {
    return [
      ['Score', String(state.score)],
      ['Best', String(Math.max(best, state.score))],
      ['Wave reached', String(Math.max(1, state.wave))],
      ['Kills', String(state.kills)],
      ['Best combo', `${state.bestCombo} kills`],
      ['Accuracy', state.shotsFired > 0 ? `${Math.round((state.shotsHit / state.shotsFired) * 100)}%` : '—'],
      ['Level', String(state.player.level)],
    ];
  }

  function drawOver(state, best) {
    drawWorld(state, state.time);
    dim();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff534b';
    ctx.shadowColor = '#ff534b';
    ctx.shadowBlur = 26;
    ctx.font = `800 64px ${FONT}`;
    ctx.fillText('THE VOID TAKES YOU', FIELD.width / 2, 180);
    ctx.shadowBlur = 0;
    panel(FIELD.width / 2 - 260, 220, 520, 260);
    const rows = statsRows(state, best);
    ctx.font = `700 19px ${FONT}`;
    rows.forEach((row, index) => {
      const y = 262 + index * 32;
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(row[0], FIELD.width / 2 - 12, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(row[1], FIELD.width / 2 + 12, y);
    });
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23d';
    ctx.font = `800 23px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO RUN IT BACK', FIELD.width / 2, 540);
    ctx.globalAlpha = 1;
  }

  function drawVictory(state, best) {
    drawWorld(state, state.time);
    dim();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23d';
    ctx.shadowColor = '#ffd23d';
    ctx.shadowBlur = 30;
    ctx.font = `800 62px ${FONT}`;
    ctx.fillText('ARENA CLEARED', FIELD.width / 2, 190);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 21px ${FONT}`;
    ctx.fillText('Wave 10 falls. The void retreats — for now.', FIELD.width / 2, 232);
    panel(FIELD.width / 2 - 260, 268, 520, 200);
    const rows = statsRows(state, best);
    ctx.font = `700 19px ${FONT}`;
    rows.slice(0, 5).forEach((row, index) => {
      const y = 310 + index * 32;
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(row[0], FIELD.width / 2 - 12, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(row[1], FIELD.width / 2 + 12, y);
    });
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#4df3ff';
    ctx.font = `800 23px ${FONT}`;
    ctx.fillText('SPACE — KEEP GOING (ENDLESS)      R — RESTART', FIELD.width / 2, 530);
    ctx.globalAlpha = 1;
  }

  return {
    draw(state, screen, best, mouse) {
      const shakeX = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * state.shake * 12 : 0;
      const shakeY = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * state.shake * 12 : 0;
      ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX + shakeX * view.scale, view.offsetY + shakeY * view.scale);
      ctx.clearRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
      if (screen === SCREEN_TITLE) {
        drawBackground(state.time);
        drawTitle(state, best);
        return;
      }
      drawBackground(state.time);
      drawWorld(state, state.time);
      if (screen === SCREEN_PLAY) {
        drawHud(state, best);
      } else if (screen === SCREEN_LEVELUP) {
        drawLevelUp(state, mouse);
      } else if (screen === SCREEN_PAUSED) {
        drawHud(state, best);
        drawPaused();
      } else if (screen === SCREEN_OVER) {
        drawOver(state, best);
      } else if (screen === SCREEN_VICTORY) {
        drawVictory(state, best);
      }
    },
  };
}
