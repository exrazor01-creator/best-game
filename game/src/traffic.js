import { AVENUES, STREETS, PALETTE, VEHICLES, VEHICLE_ORDER } from './config.js';
import { dist, angleDiff, pick, clamp } from './random.js';
import { pointInBuilding } from './world.js';
import { damageCar, addParticles, addSkid } from './combat.js';
export function spawnCar(G, x, z, kind, driver) {
  const def = VEHICLES[kind] || { max: 560, accel: 520, turn: 2.6, hp: 100, r: 24, color: '#c0392b' };
  const car = {
    x, z, y: 0, angle: (G.rng() * 2 - 1) * Math.PI, speed: 0, kind,
    color: def.color, max: def.max, accel: def.accel, turn: def.turn,
    hp: def.hp, maxHp: def.hp, r: def.r, driver: driver || 'parked',
    dead: false, hidden: false, nitro: 0, drift: 0, route: null, routeI: 0, waitT: 0,
  };
  G.cars.push(car);
  return car;
}
export function spawnTraffic(G) {
  const kinds = ['sedan', 'sport', 'taxi', 'van', 'truck'];
  for (let i = 0; i < 14; i += 1) {
    const a = AVENUES[Math.floor(G.rng() * AVENUES.length)];
    const s = STREETS[Math.floor(G.rng() * STREETS.length)];
    const onAve = G.rng() < 0.5;
    const car = spawnCar(G, onAve ? a + (G.rng() < 0.5 ? -28 : 28) : 100 + G.rng() * 3000, onAve ? 100 + G.rng() * 2200 : s + (G.rng() < 0.5 ? -28 : 28), pick(G.rng, kinds), 'traffic');
    car.angle = onAve ? (G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (G.rng() < 0.5 ? 0 : Math.PI);
    car.color = pick(G.rng, ['#c0392b', '#8e44ad', '#f7c948', '#16a085', '#7f8c8d', '#2980b9']);
    car.cruise = 180 + G.rng() * 160;
  }
}
export function spawnPeds(G) {
  for (let i = 0; i < 26; i += 1) {
    G.peds.push({
      x: 100 + G.rng() * 3000, z: 100 + G.rng() * 2200, angle: 0, speed: 0,
      kind: 'walker', hp: 100, tx: 0, tz: 0, waitT: 0, fleeT: 0,
      color: pick(G.rng, ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c']), seed: G.rng(),
    });
  }
}
function carCollide(G, car, nx, nz) {
  const b = pointInBuilding(G, nx, nz);
  if (b) return true;
  if (nx < 20 || nx > 3180 || nz < 20 || nz > 2380) return true;
  return false;
}
export function driveCar(G, car, dt, throttle, steer, nitro) {
  if (car.dead) return;
  const def = VEHICLES[car.kind] || {};
  const max = (car.max + (car.engineBonus || 0)) * (nitro && car.nitro > 0 ? 1.45 : 1);
  const accel = car.accel * throttle;
  car.speed += accel * dt;
  if (throttle === 0) car.speed -= Math.sign(car.speed) * 260 * dt;
  if (throttle < 0 && car.speed > 0) car.speed -= 950 * dt;
  if (car.speed > max) car.speed = Math.max(max, car.speed - 500 * dt);
  if (car.speed < -220) car.speed = -220;
  if (Math.abs(car.speed) < 8 && throttle === 0) car.speed = 0;
  const driftFactor = car.kind === 'drift' || car.kind === 'neonbike' ? 1.35 : 1;
  const turnRate = car.turn * (0.4 + 0.6 * Math.min(1, Math.abs(car.speed) / 300)) * driftFactor;
  car.angle += steer * turnRate * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const nz = car.z + Math.sin(car.angle) * car.speed * dt;
  if (carCollide(G, car, nx, nz)) {
    if (Math.abs(car.speed) > 240) { damageCar(G, car, 8, 'wall'); addParticles(G, nx, 14, nz, '#ffd23e', 8, 200, 0.5, 5); G.audio.crash(); }
    car.speed *= -0.25;
  } else {
    car.x = nx; car.z = nz;
  }
  if (Math.abs(car.speed) > 200) {
    const d = Math.hypot(car.x - (car.px || car.x), car.z - (car.pz || car.z));
    if (d > 26 && Math.abs(steer) > 0.4) {
      addSkid(G, car.px || car.x, car.pz || car.z, car.x, car.z);
      if (Math.random() < 0.4) addParticles(G, car.x, 6, car.z, '#888', 1, 60, 0.4, 4);
    }
  }
  car.px = car.x; car.pz = car.z;
  if (nitro && car.nitro > 0 && throttle > 0) {
    car.nitro = Math.max(0, car.nitro - dt);
    const bx = car.x - Math.cos(car.angle) * 28, bz = car.z - Math.sin(car.angle) * 28;
    addParticles(G, bx, 12, bz, '#00e5ff', 3, 120, 0.35, 6);
    addParticles(G, bx, 12, bz, '#ff2e88', 2, 100, 0.3, 5);
    if (Math.random() < 0.3) G.audio.nitro();
  }
}
export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.driver !== 'traffic' || car.dead) continue;
    if (car.waitT > 0) { car.waitT -= dt; car.speed = 0; continue; }
    const ahead = car.x + Math.cos(car.angle) * 70, aheadZ = car.z + Math.sin(car.angle) * 70;
    let blocked = pointInBuilding(G, ahead, aheadZ);
    if (!blocked) for (const o of G.cars) {
      if (o !== car && !o.dead && dist(ahead, aheadZ, o.x, o.z) < 46) { blocked = true; break; }
    }
    if (blocked) { car.waitT = 0.6; continue; }
    const target = car.cruise || 240;
    car.speed += (target - car.speed) * dt * 1.2;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const nz = car.z + Math.sin(car.angle) * car.speed * dt;
    if (carCollide(G, car, nx, nz)) {
      car.angle += (G.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      car.x += Math.cos(car.angle) * 20; car.z += Math.sin(car.angle) * 20;
    } else { car.x = nx; car.z = nz; }
    if (car.x < 60 || car.x > 3140) car.angle = Math.PI - car.angle;
    if (car.z < 60 || car.z > 2340) car.angle = -car.angle;
  }
}
export function updateRivals(G, dt) {
  for (const r of G.rivals || []) {
    if (r.done || r.car.dead) continue;
    const wp = r.waypoints[r.wpi % r.waypoints.length];
    const d = dist(r.car.x, r.car.z, wp.x, wp.z);
    if (d < 90) { r.wpi += 1; if (r.wpi >= r.waypoints.length * (r.laps || 1)) { r.done = true; r.place = (G.race ? G.race.finished + 1 : 1); if (G.race) G.race.finished += 1; continue; } }
    const want = Math.atan2(wp.z - r.car.z, wp.x - r.car.x);
    const diff = angleDiff(r.car.angle, want);
    const steer = clamp(diff * 1.6, -1, 1);
    driveCar(G, r.car, dt, 1, steer, false);
    r.car.speed = Math.min(r.car.speed, r.top);
  }
}
export function spawnRival(G, waypoints, laps, top, color, name) {
  const start = waypoints[0];
  const car = spawnCar(G, start.x + (G.rng() - 0.5) * 60, start.z + 80 + G.rng() * 40, 'sport', 'rival');
  car.color = color; car.max = top; car.accel = 700; car.turn = 3.0;
  const r = { car, waypoints, wpi: 1, laps, top, done: false, name, place: 0 };
  G.rivals.push(r);
  return r;
}
export function garageCars(G) {
  return G.cars.filter((c) => c.garage);
}
