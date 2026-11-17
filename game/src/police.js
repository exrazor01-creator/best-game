import { TUNE } from './config.js';
import { dist, angleDiff, clamp } from './random.js';
import { spawnCar, driveCar } from './traffic.js';
import { hurtPlayer, damageCar } from './combat.js';
export function addWanted(G, points, why) {
  G.wanted.points += points;
  if (why) G.banner = { text: why, t: 3 };
  updateStars(G);
}
export function updateStars(G) {
  const p = G.wanted.points;
  G.wanted.stars = p >= 14 ? 3 : p >= 8 ? 2 : p >= 3 ? 1 : 0;
}
export function updateWanted(G, dt) {
  const w = G.wanted;
  if (G.player.inCar) w.quietT = 0;
  const d = dist(G.player.x, G.player.z, G.lastSeen.x, G.lastSeen.z);
  if (w.stars > 0) {
    w.quietT += dt;
    if (w.quietT > TUNE.wantedDecaySight) {
      w.points = Math.max(0, w.points - TUNE.wantedDecayRate * dt);
      updateStars(G);
    }
  }
  G.pendingWanted = 0;
  updateStars(G);
}
export function updatePolice(G, dt) {
  const w = G.wanted;
  const wantCars = w.stars >= 1 ? Math.min(3, w.stars + 1) : 0;
  const cops = G.cars.filter((c) => c.driver === 'police' && !c.dead);
  while (cops.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    const car = spawnCar(G, G.player.x + Math.cos(a) * 700, G.player.z + Math.sin(a) * 700, 'sport', 'police');
    car.color = '#1e40af'; car.max = 640; car.accel = 600; car.turn = 2.9; car.hp = 140; car.maxHp = 140;
    cops.push(car);
  }
  for (const car of cops) {
    if (w.stars === 0) { car.driver = 'parked'; continue; }
    const d = dist(car.x, car.z, G.player.x, G.player.z);
    const want = Math.atan2(G.player.z - car.z, G.player.x - car.x);
    const diff = angleDiff(car.angle, want);
    driveCar(G, car, dt, 1, clamp(diff * 1.8, -1, 1), false);
    if (d < 46) {
      car.speed *= 0.5;
      if (G.player.inCar) damageCar(G, G.player.inCar, 6, 'police');
      else hurtPlayer(G, 6, car.x, car.z);
    }
    G.lastSeen = { x: G.player.x, z: G.player.z };
  }
  const wantFoot = w.stars >= 2 ? w.stars : 0;
  let foot = G.peds.filter((p) => p.kind === 'cop');
  while (foot.length < wantFoot) {
    const a = Math.random() * Math.PI * 2;
    G.peds.push({ x: G.player.x + Math.cos(a) * 300, z: G.player.z + Math.sin(a) * 300, angle: 0, speed: 0, kind: 'cop', hp: 60, tx: 0, tz: 0, waitT: 0, fleeT: 0, color: '#1c4ed8', seed: G.rng(), shootCd: 0, punchCd: 0 });
    foot = G.peds.filter((p) => p.kind === 'cop');
  }
  if (w.stars === 0) {
    for (let i = G.peds.length - 1; i >= 0; i -= 1) if (G.peds[i].kind === 'cop') G.peds.splice(i, 1);
    for (const car of G.cars) if (car.driver === 'police') car.driver = 'parked';
  }
}
