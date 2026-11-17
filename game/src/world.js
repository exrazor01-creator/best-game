import { WORLD, AVENUES, STREETS, ROAD_W, PLACES, FLOOR_H } from './config.js';
import { range, int, pick, clamp } from './random.js';
const NEON = ['#ff2e88', '#00e5ff', '#ffd23e', '#39ff88', '#b26bff'];
const WALLS = ['#1b1f38', '#232744', '#1e2340', '#2a1e3f', '#14263a'];
export function districtAt(x, z) {
  if (x < 1000 && z < 1000) return 'residential';
  if (x >= 1000 && x < 2000 && z < 1000) return 'financial';
  if (x >= 2000 && z < 1000) return 'neon';
  if (x < 1000 && z >= 1000) return 'port';
  if (x >= 1000 && x < 2000 && z >= 1000) return 'arena';
  return 'neon';
}
export function buildWorld(rng) {
  const buildings = [], trees = [], lamps = [], containers = [], flyers = [];
  const blocked = new Set();
  const nearRoad = (x, z) => AVENUES.some((a) => Math.abs(x - a) < ROAD_W / 2 + 60) || STREETS.some((s) => Math.abs(z - s) < ROAD_W / 2 + 60);
  for (let gx = 0; gx < 7; gx += 1) for (let gz = 0; gz < 5; gz += 1) {
    const bx = 160 + gx * 400, bz = 120 + gz * 400;
    const cx = bx + 200, cz = bz + 200;
    const d = districtAt(cx, cz);
    const count = d === 'financial' ? 3 : d === 'neon' ? 4 : d === 'port' ? 1 : 2;
    for (let i = 0; i < count; i += 1) {
      const w = range(rng, 90, 170), dep = range(rng, 90, 170);
      const x = bx + 40 + rng() * (320 - w), z = bz + 40 + rng() * (320 - dep);
      if (nearRoad(x + w / 2, z + dep / 2)) continue;
      let floors;
      if (d === 'financial') floors = int(rng, 8, 22);
      else if (d === 'neon') floors = int(rng, 4, 10);
      else if (d === 'residential') floors = int(rng, 1, 3);
      else if (d === 'port') floors = int(rng, 1, 2);
      else floors = int(rng, 2, 5);
      const b = { x, z, w, d: dep, floors, color: pick(rng, WALLS), district: d, neon: pick(rng, NEON), lit: rng() };
      buildings.push(b);
      blocked.add(`${Math.round(x / 40)}:${Math.round(z / 40)}`);
    }
    if (d === 'residential') for (let i = 0; i < 2; i += 1) trees.push({ x: bx + 60 + rng() * 280, z: bz + 60 + rng() * 280, s: 0.8 + rng() * 0.5 });
    if (d === 'port') for (let i = 0; i < 5; i += 1) containers.push({ x: bx + 30 + rng() * 300, z: bz + 30 + rng() * 300, color: pick(rng, ['#e74c3c', '#f39c12', '#16a085', '#2980b9']) });
  }
  buildings.push({ x: PLACES.tower.x - 90, z: PLACES.tower.z - 90, w: 180, d: 180, floors: 30, color: '#10142a', district: 'financial', neon: '#ff2e88', lit: 1, landmark: 'spire' });
  buildings.push({ x: PLACES.lab.x - 80, z: PLACES.lab.z - 80, w: 160, d: 160, floors: 6, color: '#1a1030', district: 'neon', neon: '#b26bff', lit: 1, landmark: 'lab' });
  buildings.push({ x: PLACES.club.x - 70, z: PLACES.club.z - 70, w: 140, d: 140, floors: 3, color: '#241031', district: 'neon', neon: '#ff2e88', lit: 1, landmark: 'club' });
  for (const a of AVENUES) for (const s of STREETS) lamps.push({ x: a + 62, z: s + 62 });
  for (let i = 0; i < 7; i += 1) flyers.push({ x: 300 + rng() * 2600, z: 200 + rng() * 1800, y: 260 + rng() * 160, speed: 60 + rng() * 80, phase: rng() * 6.28, color: pick(rng, NEON) });
  return { buildings, trees, lamps, containers, flyers, blocked };
}
export function pointInBuilding(G, x, z) {
  for (const b of G.world.buildings) {
    if (x >= b.x && x <= b.x + b.w && z >= b.z && z <= b.z + b.d) return b;
  }
  return null;
}
export function collideCircle(G, x, z, r) {
  const b = pointInBuilding(G, x, z);
  if (!b) return { x: clamp(x, 20, WORLD.w - 20), z: clamp(z, 20, WORLD.h - 20) };
  const left = x - b.x, right = b.x + b.w - x, top = z - b.z, bot = b.z + b.d - z;
  const m = Math.min(left, right, top, bot);
  if (m === left) x = b.x - r;
  else if (m === right) x = b.x + b.w + r;
  else if (m === top) z = b.z - r;
  else z = b.z + b.d + r;
  return { x: clamp(x, 20, WORLD.w - 20), z: clamp(z, 20, WORLD.h - 20) };
}
export function onRoad(x, z) {
  return AVENUES.some((a) => Math.abs(x - a) < ROAD_W / 2) || STREETS.some((s) => Math.abs(z - s) < ROAD_W / 2);
}
export function nearestRoadPoint(x, z) {
  let best = null, bd = 1e9;
  for (const a of AVENUES) for (const s of STREETS) {
    const d = Math.hypot(x - a, z - s);
    if (d < bd) { bd = d; best = { x: a, z: s }; }
  }
  return best;
}
