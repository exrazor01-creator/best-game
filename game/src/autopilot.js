// A pilot that plays VOIDPULSE for the screenshots: it keeps its distance,
// shoots the nearest threat, dashes out of crowds and chases shards when the
// field is calm. The play pilot is careful; the end pilot is reckless, so it
// is caught out once the waves speed up, as a hurried player is.

import { FIELD } from './config.js';

function nearestEnemy(state) {
  const player = state.player;
  let best = null;
  let bestDistance = Infinity;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (!enemy.active) continue;
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = enemy;
    }
  }
  return { enemy: best, distance: bestDistance };
}

function nearestGem(state) {
  const player = state.player;
  let best = null;
  let bestDistance = Infinity;
  for (let index = 0; index < state.gems.length; index += 1) {
    const gem = state.gems[index];
    if (!gem.active) continue;
    const distance = Math.hypot(gem.x - player.x, gem.y - player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = gem;
    }
  }
  return { gem: best, distance: bestDistance };
}

function countNear(state, radius) {
  const player = state.player;
  let count = 0;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (!enemy.active) continue;
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < radius) count += 1;
  }
  return count;
}

/**
 * Drive one step. `careful` pilots keep their distance and dash away from
 * crowds; reckless ones stand their ground and never dash.
 */
export function autopilot(state, careful) {
  const player = state.player;
  const { enemy, distance } = nearestEnemy(state);
  const { gem, distance: gemDistance } = nearestGem(state);

  let targetX = FIELD.width / 2;
  let targetY = FIELD.height / 2;
  let aimX = player.x;
  let aimY = player.y - 100;
  let firing = false;
  let dashHeld = false;

  if (enemy) {
    aimX = enemy.x;
    aimY = enemy.y;
    firing = true;
    const awayX = player.x - enemy.x;
    const awayY = player.y - enemy.y;
    const length = Math.hypot(awayX, awayY) || 1;
    if (careful) {
      if (distance < 170) {
        // Too close: back away from the threat.
        targetX = player.x + (awayX / length) * 220;
        targetY = player.y + (awayY / length) * 220;
      } else if (distance > 330) {
        // Far: close in to shooting range.
        targetX = player.x - (awayX / length) * 160;
        targetY = player.y - (awayY / length) * 160;
      } else {
        // In range: strafe sideways.
        targetX = player.x + (-awayY / length) * 140;
        targetY = player.y + (awayX / length) * 140;
      }
      if (gem && gemDistance < 200 && distance > 200) {
        targetX = gem.x;
        targetY = gem.y;
      }
      if (countNear(state, 120) >= 3 && player.dashCooldown <= 0) dashHeld = true;
    } else {
      // Reckless: stand and shoot, drift slowly toward the middle.
      targetX = player.x + (FIELD.width / 2 - player.x) * 0.02;
      targetY = player.y + (FIELD.height / 2 - player.y) * 0.02;
    }
  } else if (gem) {
    targetX = gem.x;
    targetY = gem.y;
  }

  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const length = Math.hypot(dx, dy);
  const move = length > 8 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
  return { move, aimX, aimY, firing, dashHeld };
}
