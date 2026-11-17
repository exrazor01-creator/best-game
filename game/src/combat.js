import { TUNE } from './config.js';
import { clamp, dist } from './random.js';
export function addParticles(G, x, y, z, color, n, speed, life, size) {
  for (let i = 0; i < n; i += 1) {
    if (G.particles.length >= TUNE.maxParticles) return;
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    G.particles.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.random() * speed * 0.6, vz: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), maxLife: life, color, size: size || 4 });
  }
}
export function addSkid(G, x1, z1, x2, z2) {
  G.skids.push({ x1, z1, x2, z2 });
  if (G.skids.length > 240) G.skids.shift();
}
export function spawnBullet(G, x, y, z, angle, from, dmg) {
  if (G.bullets.length >= TUNE.maxBullets) return;
  G.bullets.push({ x, y, z, angle, vx: Math.cos(angle) * TUNE.bulletSpeed, vz: Math.sin(angle) * TUNE.bulletSpeed, from, dmg, life: 1.6 });
}
export function damageCar(G, car, dmg, from) {
  car.hp -= dmg;
  addParticles(G, car.x, 14, car.z, '#ffae00', 6, 160, 0.5, 5);
  if (car.hp <= 0 && !car.dead) {
    car.dead = true; car.speed = 0;
    addParticles(G, car.x, 20, car.z, '#ff534b', 30, 320, 1.0, 7);
    addParticles(G, car.x, 30, car.z, '#ffd23e', 16, 240, 0.8, 6);
    G.camera.shake = Math.max(G.camera.shake, 8);
    G.audio.crash();
    if (car.driver === 'player') { G.player.inCar = null; G.player.hp -= 20; }
    if (from === 'player') G.stats.kills += 1;
  }
}
export function explode(G, x, z, big) {
  addParticles(G, x, 24, z, '#ff534b', big ? 40 : 20, 380, 1.1, 8);
  addParticles(G, x, 30, z, '#ffd23e', big ? 24 : 12, 280, 0.9, 6);
  addParticles(G, x, 10, z, '#555', big ? 20 : 10, 140, 1.6, 9);
  G.camera.shake = Math.max(G.camera.shake, big ? 12 : 6);
  G.audio.crash();
}
export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > 3200 || b.z < 0 || b.z > 2400) { G.bullets.splice(i, 1); continue; }
    let hit = false;
    if (b.from === 'player') {
      for (const ped of G.peds) {
        if ((ped.kind === 'gang' || ped.kind === 'boss' || ped.kind === 'cop') && dist(b.x, b.z, ped.x, ped.z) < 22) {
          ped.hp -= b.dmg; ped.flash = 0.2; G.audio.hit();
          addParticles(G, b.x, 22, b.z, '#ff2e88', 5, 140, 0.4, 4);
          if (ped.hp <= 0) killPed(G, ped);
          hit = true; break;
        }
      }
      if (!hit) for (const car of G.cars) {
        if (car.driver === 'police' && dist(b.x, b.z, car.x, car.z) < 30) { damageCar(G, car, b.dmg, 'player'); hit = true; break; }
      }
    } else {
      const p = G.player;
      if (!p.inCar && dist(b.x, b.z, p.x, p.z) < 20) {
        hurtPlayer(G, b.dmg, b.x, b.z);
        hit = true;
      } else if (p.inCar && dist(b.x, b.z, p.x, p.z) < 30) {
        damageCar(G, p.inCar, b.dmg, 'enemy');
        hit = true;
      }
    }
    if (hit) G.bullets.splice(i, 1);
  }
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const pt = G.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt; pt.vy -= 60 * dt; pt.life -= dt;
    if (pt.life <= 0 || pt.y < 0) G.particles.splice(i, 1);
  }
}
export function killPed(G, ped) {
  ped.dead = true;
  G.stats.kills += 1;
  addParticles(G, ped.x, 20, ped.z, '#ff534b', 18, 220, 0.8, 5);
  G.audio.die();
  if (ped.kind === 'boss') { G.player.money += 800; explode(G, ped.x, ped.z, true); G.banner = { text: 'Boss down! +$800 bounty.', t: 3 }; }
  const i = G.peds.indexOf(ped);
  if (i >= 0) G.peds.splice(i, 1);
}
export function hurtPlayer(G, dmg, sx, sz) {
  const p = G.player;
  if (p.invuln > 0 || G.state === 'wasted') return;
  if (p.armor > 0) { const ab = Math.min(p.armor, dmg); p.armor -= ab; dmg -= ab; }
  p.hp -= dmg; p.hurtT = 0.4; p.invuln = 0.5;
  G.camera.shake = Math.max(G.camera.shake, 5);
  G.audio.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    explode(G, p.x, p.z, false);
    G.state = 'wasted';
    G.audio.gameOver();
  }
}
export function updatePeds(G, dt) {
  const p = G.player;
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    const ped = G.peds[i];
    ped.flash = Math.max(0, (ped.flash || 0) - dt);
    ped.shootCd = Math.max(0, (ped.shootCd || 0) - dt);
    ped.punchCd = Math.max(0, (ped.punchCd || 0) - dt);
    if (ped.kind === 'walker') {
      ped.waitT -= dt;
      if (ped.waitT <= 0) { ped.tx = 100 + G.rng() * 3000; ped.tz = 100 + G.rng() * 2200; ped.waitT = 4 + G.rng() * 6; }
      const d = dist(ped.x, ped.z, ped.tx, ped.tz);
      if (d > 10) { const a = Math.atan2(ped.tz - ped.z, ped.tx - ped.x); ped.angle = a; ped.x += Math.cos(a) * 60 * dt; ped.z += Math.sin(a) * 60 * dt; ped.moving = true; }
      else ped.moving = false;
      const dpl = dist(ped.x, ped.z, p.x, p.z);
      if (!p.inCar && dpl < 60 && ped.fleeT > 0) { const a = Math.atan2(ped.z - p.z, ped.x - p.x); ped.x += Math.cos(a) * 160 * dt; ped.z += Math.sin(a) * 160 * dt; ped.fleeT -= dt; }
      continue;
    }
    if (ped.kind === 'gang' || ped.kind === 'boss' || ped.kind === 'cop') {
      const d = dist(ped.x, ped.z, p.x, p.z);
      const speed = ped.kind === 'boss' ? 150 : ped.kind === 'cop' ? 210 : 170;
      if (d > 26) {
        const a = Math.atan2(p.z - ped.z, p.x - ped.x);
        ped.angle = a;
        const nx = ped.x + Math.cos(a) * speed * dt, nz = ped.z + Math.sin(a) * speed * dt;
        if (!pointInBuildingLocal(G, nx, nz)) { ped.x = nx; ped.z = nz; }
        ped.moving = true;
      } else {
        ped.moving = false;
        if (ped.punchCd <= 0 && !p.inCar && p.hp > 0) {
          ped.punchCd = 0.9;
          hurtPlayer(G, ped.kind === 'boss' ? 18 : ped.kind === 'cop' ? 8 : 10, ped.x, ped.z);
        }
      }
      if ((ped.kind === 'gang' || ped.kind === 'boss') && ped.shootCd <= 0 && d < 520 && d > 60) {
        ped.shootCd = ped.kind === 'boss' ? 0.7 : 1.6;
        const a = Math.atan2(p.z - ped.z, p.x - ped.x);
        spawnBullet(G, ped.x, 22, ped.z, a + (G.rng() - 0.5) * 0.12, 'enemy', ped.kind === 'boss' ? 12 : 8);
        G.audio.shoot();
      }
    }
  }
}
function pointInBuildingLocal(G, x, z) {
  for (const b of G.world.buildings) {
    if (x >= b.x - 4 && x <= b.x + b.w + 4 && z >= b.z - 4 && z <= b.z + b.d + 4) return true;
  }
  return false;
}
