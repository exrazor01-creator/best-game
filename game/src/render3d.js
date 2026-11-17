import { AVENUES, STREETS, ROAD_W, WORLD, PALETTE, FLOOR_H, PLACES } from './config.js';
import { skyAt, parseColor } from './gl.js';
import { clamp, lerp, dist, angleDiff } from './random.js';
import { pointInBuilding } from './world.js';
const PLACE_COLORS = {
  garage: '#ffd23e', tower: '#ff2e88', lab: '#b26bff', arena: '#00e5ff', neon: '#ff2e88',
  port: '#39ff88', tunnel: '#7de8ff', mountain: '#ffd23e', hospital: '#e74c3c', ammoShop: '#2ecc71',
  repairShop: '#3498db', hideout: '#9b59b6', raceStart: '#e84393', club: '#ff2e88',
};
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
function buildingAt(G, x, z) {
  for (const b of G.world.buildings) {
    if (x >= b.x && x <= b.x + b.w && z >= b.z && z <= b.z + b.d) return b;
  }
  return null;
}
// Smallest t in [0,1] where the segment target->eye enters a building box, or null.
function segHitT(G, tx, ty, tz, ex, ey, ez) {
  const dx = ex - tx, dy = ey - ty, dz = ez - tz;
  let best = null;
  for (const b of G.world.buildings) {
    const x0 = b.x, x1 = b.x + b.w, z0 = b.z, z1 = b.z + b.d, h = b.floors * FLOOR_H;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (tx < x0 || tx > x1) continue; }
    else {
      let a = (x0 - tx) / dx, c = (x1 - tx) / dx;
      if (a > c) { const tmp = a; a = c; c = tmp; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-9) { if (tz < z0 || tz > z1) continue; }
    else {
      let a = (z0 - tz) / dz, c = (z1 - tz) / dz;
      if (a > c) { const tmp = a; a = c; c = tmp; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) continue;
    }
    if (t0 > 1 || t1 < 0) continue;
    const te = Math.max(t0, 0);
    if (ty + te * dy >= h) continue;
    if (best === null || te < best) best = te;
  }
  return best;
}
export function updateCamera(G, dt) {
  const p = G.player, cam = G.camera;
  if (G.cameraOverride) {
    cam.eye = [G.cameraOverride.eye[0], G.cameraOverride.eye[1], G.cameraOverride.eye[2]];
    cam.target = [G.cameraOverride.target[0], G.cameraOverride.target[1], G.cameraOverride.target[2]];
    cam.heading = p.angle;
    return;
  }
  const inCar = p.inCar;
  // Close chase cam: the car and the street fill the frame, the city feels big.
  const cfg = !inCar ? { dist: 130, height: 80 } : inCar.kind === 'bike' ? { dist: 165, height: 95 } : { dist: 185, height: 105 };
  const heading = inCar ? inCar.angle : p.angle;
  cam.heading += angleDiff(cam.heading, heading) * (1 - Math.exp(-dt * 2.2));
  const px = p.x, pz = p.z;
  const wantEye = [px - Math.cos(cam.heading) * cfg.dist, cfg.height, pz - Math.sin(cam.heading) * cfg.dist];
  const b = buildingAt(G, wantEye[0], wantEye[2]);
  if (b) wantEye[1] = Math.max(wantEye[1], b.floors * FLOOR_H + 40);
  wantEye[1] = Math.max(wantEye[1], 32);
  const k = 1 - Math.exp(-dt * 4.5);
  cam.eye[0] += (wantEye[0] - cam.eye[0]) * k;
  cam.eye[1] += (wantEye[1] - cam.eye[1]) * k;
  cam.eye[2] += (wantEye[2] - cam.eye[2]) * k;
  const wantTarget = [px, 22, pz];
  const k2 = 1 - Math.exp(-dt * 7);
  cam.target[0] += (wantTarget[0] - cam.target[0]) * k2;
  cam.target[1] += (wantTarget[1] - cam.target[1]) * k2;
  cam.target[2] += (wantTarget[2] - cam.target[2]) * k2;
  // Pull the camera in when a building blocks the line of sight to the player.
  const hit = segHitT(G, cam.target[0], cam.target[1], cam.target[2], cam.eye[0], cam.eye[1], cam.eye[2]);
  if (hit !== null) {
    const tt = Math.max(0.12, hit - 0.04);
    cam.eye[0] = cam.target[0] + (cam.eye[0] - cam.target[0]) * tt;
    cam.eye[1] = cam.target[1] + (cam.eye[1] - cam.target[1]) * tt;
    cam.eye[2] = cam.target[2] + (cam.eye[2] - cam.target[2]) * tt;
  }
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 22);
    const s = cam.shake;
    cam.eye[0] += (G.rng() - 0.5) * s; cam.eye[1] += (G.rng() - 0.5) * s * 0.6; cam.eye[2] += (G.rng() - 0.5) * s;
  }
}
// Flat rotated quad on the ground (headlight pools, wet-road streaks).
function beam(R, x, z, angle, len, wid, color) {
  const fx = Math.cos(angle), fz = Math.sin(angle), rx = -fz, rz = fx;
  const x0 = x - fx * len / 2, z0 = z - fz * len / 2;
  const x1 = x + fx * len / 2, z1 = z + fz * len / 2;
  R.quad(
    [x0 - rx * wid / 2, 0.16, z0 - rz * wid / 2], [x0 + rx * wid / 2, 0.16, z0 + rz * wid / 2],
    [x1 + rx * wid / 2, 0.16, z1 + rz * wid / 2], [x1 - rx * wid / 2, 0.16, z1 - rz * wid / 2],
    color, [0, 1, 0],
  );
}
function drawCar(R, car, time) {
  const x = car.x, z = car.z, a = car.angle;
  if (!car.dead) R.flat(x - 26, z - 20, 52, 40, 0.2, [0, 0, 0, 0.3]);
  if (car.dead) { R.box(x, 7, z, 52, 12, 26, '#1a1e33', a); return; }
  const len = car.kind === 'truck' ? 74 : car.kind === 'bike' ? 42 : car.kind === 'hypercar' ? 56 : car.kind === 'armored' ? 60 : 52;
  const wid = car.kind === 'bike' ? 12 : car.kind === 'truck' ? 28 : car.kind === 'armored' ? 30 : 26;
  const h = car.kind === 'truck' ? 18 : car.kind === 'armored' ? 20 : car.kind === 'hypercar' ? 10 : car.kind === 'bike' ? 8 : 13;
  const cc = parseColor(car.color);
  R.flat(x - 30, z - 18, 60, 36, 0.15, [cc[0], cc[1], cc[2], 0.16]);
  R.box(x, h / 2 + 3, z, len, h, wid, car.color, a);
  if (car.kind === 'bike') {
    R.box(x, 18, z, 16, 12, 10, '#2f3542', a);
    return;
  }
  R.box(x - Math.cos(a) * 4, h + 7, z - Math.sin(a) * 4, len * 0.45, 10, wid * 0.78, '#10142a', a);
  const fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx;
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    R.box(x + fx * len * 0.32 * s + rx * wid * 0.5 * t, 5, z + fz * len * 0.32 * s + rz * wid * 0.5 * t, 10, 10, 6, '#0a0a0a', a);
  }
  // Headlight pool on the wet road ahead + big bright lamps and taillights.
  beam(R, x + fx * (len / 2 + 55), z + fz * (len / 2 + 55), a, 110, 34, [1, 0.92, 0.62, 0.10]);
  R.setEmissive(0.9);
  R.box(x + fx * len * 0.5, 8, z + fz * len * 0.5, 4, 6, wid * 0.7, '#fff6b0', a);
  R.box(x - fx * len * 0.5, 8, z - fz * len * 0.5, 4, 6, wid * 0.7, '#ff2e4d', a);
  R.setEmissive(0);
  if (car.kind === 'hypercar') R.box(x - Math.cos(a) * 26, h + 4, z - Math.sin(a) * 26, 10, 3, 24, '#0a0a0a', a);
  if (car.kind === 'hover') R.box(x, 2, z, len * 0.8, 3, wid * 0.8, '#00e5ff', a);
  if (car.kind === 'armored') R.box(x - Math.cos(a) * 10, h + 6, z - Math.sin(a) * 10, 20, 8, 20, '#2c3e50', a);
  if (car.driver === 'police') {
    const flash = Math.floor(time * 6) % 2 === 0 ? '#ff4757' : '#3742fa';
    R.setEmissive(0.9);
    R.box(x - Math.cos(a) * 4, h + 14, z - Math.sin(a) * 4, 16, 4, 8, flash, a);
    R.setEmissive(0);
    R.box(x, h / 2 + 3, z, len * 0.9, 3, wid + 1, '#ecf0f1', a);
  }
  if (car.hp < car.maxHp * 0.5) {
    R.setEmissive(0.5);
    R.box(x, h + 12, z, 6, 10, 6, '#ff8c00', a);
    R.setEmissive(0);
  }
}
function drawPed(R, ped, time) {
  const x = ped.x, z = ped.z;
  R.flat(x - 10, z - 8, 20, 16, 0.2, [0, 0, 0, 0.25]);
  const walk = Math.sin(time * 8 + ped.seed * 10) * 3;
  const col = ped.kind === 'boss' ? '#8e44ad' : ped.kind === 'gang' ? '#e74c3c' : ped.kind === 'cop' ? '#1c4ed8' : ped.color || '#7f8c8d';
  const scale = ped.kind === 'boss' ? 1.6 : 1;
  R.box(x, (13 + Math.abs(walk) * 0.4) * scale, z, 14 * scale, 26 * scale, 12 * scale, col, ped.angle);
  R.box(x, 32 * scale, z, 11 * scale, 11 * scale, 11 * scale, SKIN[Math.floor(ped.seed * 4) % 4], ped.angle);
  if (ped.kind === 'boss') {
    R.setEmissive(0.8);
    R.box(x, 40 * scale, z, 13 * scale, 4, 13 * scale, '#ff2e88', ped.angle);
    R.setEmissive(0);
  }
  if (ped.kind === 'gang') R.box(x + Math.cos(ped.angle) * 10, 20, z + Math.sin(ped.angle) * 10, 14, 4, 4, '#0a0a0a', ped.angle);
  if (ped.kind === 'cop') R.box(x, 39, z, 12, 4, 12, '#1c4ed8', ped.angle);
}
function drawPlayer(R, G, time) {
  const p = G.player;
  if (p.inCar) return;
  const x = p.x, z = p.z;
  R.flat(x - 11, z - 9, 22, 18, 0.2, [0, 0, 0, 0.3]);
  const bob = Math.abs(Math.sin(time * 9)) * (p.moving ? 2 : 0);
  R.box(x, 13 + bob, z, 16, 24, 14, '#2e86de', p.angle);
  R.box(x, 31 + bob, z, 12, 12, 12, '#f1c27d', p.angle);
  R.box(x, 37 + bob, z, 13, 4, 13, '#ffd23e', p.angle);
  const gx = x + Math.cos(p.angle) * 12, gz = z + Math.sin(p.angle) * 12;
  R.box(gx, 20 + bob, gz, 12, 4, 4, '#0a0a0a', p.angle);
  R.setEmissive(0.6);
  R.box(x, 13 + bob, z, 17, 3, 15, '#00e5ff', p.angle);
  R.setEmissive(0);
}
// Lit windows on one building face: most windows glow warm gold or cyan so
// the facades read as inhabited, not black boxes.
function winFace(R, b, face, h) {
  const cols = Math.max(2, Math.floor(face.len / 40));
  for (let i = 0; i < cols; i += 1) {
    const off = -face.len / 2 + 12 + (i * (face.len - 24)) / Math.max(1, cols - 1);
    const on = ((i * 7 + b.floors + face.idx * 3) % 4) !== 0;
    const col = !on ? '#141830' : ((i + face.idx) % 3 === 0 ? '#7de8ff' : '#ffd97a');
    const wx = face.along === 'x' ? face.cx + off : face.cx;
    const wz = face.along === 'z' ? face.cz + off : face.cz;
    const w = face.along === 'x' ? 10 : 2, d = face.along === 'x' ? 2 : 10;
    R.box(wx, h * 0.5, wz, w, h * 0.55, d, col);
  }
}
export function render3D(G, R) {
  const time = G.time, sky = skyAt(G.timeOfDay);
  R.setCamera(G.camera.eye, G.camera.target);
  R.begin(sky);
  R.flat(0, 0, WORLD.w, WORLD.h, 0, PALETTE.ground);
  for (const a of AVENUES) R.flat(a - ROAD_W / 2, 0, ROAD_W, WORLD.h, 0.1, PALETTE.road);
  for (const s of STREETS) R.flat(0, s - ROAD_W / 2, WORLD.w, ROAD_W, 0.1, PALETTE.road);
  for (const a of AVENUES) {
    R.flat(a - ROAD_W / 2 - 14, 0, 14, WORLD.h, 0.12, PALETTE.sidewalk);
    R.flat(a + ROAD_W / 2, 0, 14, WORLD.h, 0.12, PALETTE.sidewalk);
  }
  for (const s of STREETS) {
    R.flat(0, s - ROAD_W / 2 - 14, WORLD.w, 14, 0.12, PALETTE.sidewalk);
    R.flat(0, s + ROAD_W / 2, WORLD.w, 14, 0.12, PALETTE.sidewalk);
  }
  R.setEmissive(1);
  for (const a of AVENUES) for (let z = 100; z < WORLD.h - 60; z += 200) R.flat(a - 2, z, 4, 60, 0.14, PALETTE.roadLine);
  for (const s of STREETS) for (let x = 100; x < WORLD.w - 60; x += 200) R.flat(x, s - 2, 60, 4, 0.14, PALETTE.roadLine);
  R.setEmissive(0);
  R.flat(2400 - 320, 1900 - 320, 640, 640, 0.08, '#10142a');
  R.setEmissive(0.5);
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    R.flat(2400 + Math.cos(a) * 300 - 8, 1900 + Math.sin(a) * 300 - 8, 16, 16, 0.09, i % 2 ? '#ff2e88' : '#00e5ff');
  }
  R.setEmissive(0);
  R.flat(2640, 140, 420, 320, 0.08, '#1a1e33');
  for (const b of G.world.buildings) {
    const h = b.floors * FLOOR_H, cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    R.box(cx, h / 2, cz, b.w, h, b.d, b.color);
    R.box(cx, h + 3, cz, b.w - 10, 6, b.d - 10, '#0d1020');
    if (b.floors >= 3) {
      R.setEmissive(0.7);
      winFace(R, b, { idx: 0, along: 'x', len: b.w, cx, cz: cz + b.d / 2 + 1 }, h);
      winFace(R, b, { idx: 1, along: 'x', len: b.w, cx, cz: cz - b.d / 2 - 1 }, h);
      winFace(R, b, { idx: 2, along: 'z', len: b.d, cx: cx + b.w / 2 + 1, cz }, h);
      winFace(R, b, { idx: 3, along: 'z', len: b.d, cx: cx - b.w / 2 - 1, cz }, h);
      R.setEmissive(0);
    }
    R.setEmissive(0.9);
    R.box(cx, h * 0.92, cz + b.d / 2 + 2, b.w * 0.6, 8, 3, b.neon);
    R.box(cx, h * 0.92, cz - b.d / 2 - 2, b.w * 0.6, 8, 3, b.neon);
    R.box(cx + b.w / 2 + 2, h * 0.92, cz, 3, 8, b.d * 0.6, b.neon);
    R.box(cx - b.w / 2 - 2, h * 0.92, cz, 3, 8, b.d * 0.6, b.neon);
    R.setEmissive(0);
    if (b.floors >= 8) {
      R.setEmissive(1);
      R.box(cx + b.w * 0.3, h + 10, cz + b.d * 0.3, 8, 8, 8, b.neon);
      R.setEmissive(0);
    }
    if (b.landmark === 'spire') {
      R.cyl(cx, h + 6, cz, 30, 90, '#0d1020', 8);
      R.setEmissive(1);
      R.box(cx, h + 100, cz, 12, 12, 12, '#ff2e88');
      R.setEmissive(0);
    }
    if (b.landmark === 'lab') {
      R.setEmissive(0.9);
      R.box(cx, h * 0.6, cz + b.d / 2 + 2, b.w * 0.5, 12, 3, '#b26bff');
      R.setEmissive(0);
    }
    if (b.landmark === 'club') {
      R.setEmissive(1);
      R.box(cx, h * 0.7, cz + b.d / 2 + 2, b.w * 0.7, 10, 3, '#ff2e88');
      R.flat(cx - b.w * 0.35, cz + b.d / 2 + 6, b.w * 0.7, 18, 0.2, [1, 0.18, 0.53, 0.14]);
      R.setEmissive(0);
    }
  }
  for (const c of G.world.containers) R.box(c.x, 12, c.z, 60, 24, 26, c.color);
  R.box(2000, 30, 1900, 260, 60, 200, '#141830');
  R.setEmissive(0.7);
  R.flat(2000 - 130, 1900 - 6, 260, 12, 0.15, '#00e5ff');
  R.setEmissive(0);
  for (const s of G.world.stalls) {
    R.box(s.x, 10, s.z, 56, 20, 30, '#2a2118');
    R.box(s.x, 24, s.z, 60, 5, 34, s.color);
    R.box(s.x, 27, s.z, 30, 5, 34, '#f5f0e6');
    R.setEmissive(0.9);
    R.box(s.x, 32, s.z + 17, 44, 4, 2, s.neon);
    R.setEmissive(0);
    for (const gx of [-1, 1]) for (const gz of [-1, 1]) R.box(s.x + gx * 24, 6, s.z + gz * 12, 8, 8, 8, '#ffd23e');
    R.box(s.x, 22, s.z, 40, 4, 20, s.neon);
  }
  for (const t of G.world.trees) {
    R.cyl(t.x, 0, t.z, 3 * t.s, 26 * t.s, '#24402e', 6);
    R.box(t.x, 34 * t.s, t.z, 26 * t.s, 18 * t.s, 26 * t.s, '#1d6b3c');
    R.box(t.x, 46 * t.s, t.z, 16 * t.s, 10 * t.s, 16 * t.s, '#2a8a4d');
  }
  for (const l of G.world.lamps) {
    R.box(l.x, 12, l.z, 3, 24, 3, '#2f3542');
    R.setEmissive(0.9);
    R.box(l.x, 26, l.z, 9, 3, 9, '#ffe66d');
    R.setEmissive(0);
    R.flat(l.x - 10, l.z - 10, 20, 20, 0.2, [1, 0.9, 0.5, 0.13]);
    // Wet-road reflection: a long warm streak under each lamp.
    R.flat(l.x - 5, l.z - 34, 10, 68, 0.18, [1, 0.85, 0.45, 0.08]);
  }
  for (const f of G.world.flyers) {
    const fx = f.x + Math.sin(time * 0.1 + f.phase) * 400;
    R.box(fx, f.y, f.z, 40, 8, 14, '#3a4266', 0);
    R.setEmissive(0.9);
    R.box(fx - 18, f.y, f.z, 4, 3, 12, f.color, 0);
    R.setEmissive(0);
  }
  for (const [key, pl] of Object.entries(G.places)) {
    const c = parseColor(PLACE_COLORS[key] || '#ecf0f1');
    R.box(pl.x, 60, pl.z, 5, 120, 5, [c[0], c[1], c[2], 0.3]);
    R.flat(pl.x - 22, pl.z - 22, 44, 44, 0.16, PLACE_COLORS[key] || '#ecf0f1');
  }
  // Sky: low warm sun, horizon glow bands and stars — drawn fog-free so the
  // dusk actually shows instead of washing out to haze.
  const sunDir = sky.dir;
  const sunY = Math.min(Math.max(200, R.eye[1] + sunDir[1] * 2400), R.eye[1] + 420);
  const sunC = [R.eye[0] + sunDir[0] * 2400, sunY, R.eye[2] + sunDir[2] * 2400];
  const sr = R.right, su = R.up;
  R.flush();
  R.setFog(1e9, 2e9);
  const glow = (cx, cy, cz, w, hgt, color, emi) => {
    R.setEmissive(emi);
    R.quad(
      [cx - sr[0] * w / 2 - su[0] * hgt / 2, cy - sr[1] * w / 2 - su[1] * hgt / 2, cz - sr[2] * w / 2 - su[2] * hgt / 2],
      [cx + sr[0] * w / 2 - su[0] * hgt / 2, cy + sr[1] * w / 2 - su[1] * hgt / 2, cz + sr[2] * w / 2 - su[2] * hgt / 2],
      [cx + sr[0] * w / 2 + su[0] * hgt / 2, cy + sr[1] * w / 2 + su[1] * hgt / 2, cz + sr[2] * w / 2 + su[2] * hgt / 2],
      [cx - sr[0] * w / 2 + su[0] * hgt / 2, cy - sr[1] * w / 2 + su[1] * hgt / 2, cz - sr[2] * w / 2 + su[2] * hgt / 2],
      color, sunDir,
    );
    R.setEmissive(0);
  };
  const gy = R.eye[1] + 60;
  glow(sunC[0], gy, sunC[2], 2200, 220, [1, 0.5, 0.25, 0.14], 0.35);
  glow(sunC[0], gy + 30, sunC[2], 1400, 150, [1, 0.35, 0.5, 0.16], 0.35);
  glow(sunC[0], gy + 60, sunC[2], 700, 100, [1, 0.75, 0.45, 0.20], 0.35);
  const sc = 95;
  R.setEmissive(0.7);
  R.quad(
    [sunC[0] - sr[0] * sc - su[0] * sc, sunC[1] - sr[1] * sc - su[1] * sc, sunC[2] - sr[2] * sc - su[2] * sc],
    [sunC[0] + sr[0] * sc - su[0] * sc, sunC[1] + sr[1] * sc - su[1] * sc, sunC[2] + sr[2] * sc - su[2] * sc],
    [sunC[0] + sr[0] * sc + su[0] * sc, sunC[1] + sr[1] * sc + su[1] * sc, sunC[2] + sr[2] * sc + su[2] * sc],
    [sunC[0] - sr[0] * sc + su[0] * sc, sunC[1] - sr[1] * sc + su[1] * sc, sunC[2] - sr[2] * sc + su[2] * sc],
    '#ffcf9e', sunDir,
  );
  R.setEmissive(0);
  if (G.timeOfDay > 0.55) {
    R.setEmissive(0.9);
    for (let i = 0; i < 70; i += 1) {
      const a = i * 2.399, r = 900 + ((i * 137) % 500), y = 520 + ((i * 89) % 700);
      const sx = R.eye[0] + Math.cos(a) * r, sz = R.eye[2] + Math.sin(a) * r;
      const s2 = 5 + (i % 3) * 2;
      R.quad(
        [sx - sr[0] * s2 - su[0] * s2, y - sr[1] * s2 - su[1] * s2, sz - sr[2] * s2 - su[2] * s2],
        [sx + sr[0] * s2 - su[0] * s2, y + sr[1] * s2 - su[1] * s2, sz + sr[2] * s2 - su[2] * s2],
        [sx + sr[0] * s2 + su[0] * s2, y + sr[1] * s2 + su[1] * s2, sz + sr[2] * s2 + su[2] * s2],
        [sx - sr[0] * s2 + su[0] * s2, y - sr[1] * s2 + su[1] * s2, sz - sr[2] * s2 + su[2] * s2],
        [1, 1, 1, 0.75], sunDir,
      );
    }
    R.setEmissive(0);
  }
  R.flush();
  R.setFog(sky.fogNear, sky.fogFar);
  for (const car of G.cars) if (!car.hidden) drawCar(R, car, time);
  for (const ped of G.peds) if (!ped.hidden) drawPed(R, ped, time);
  drawPlayer(R, G, time);
  for (const b of G.bullets) {
    const len = 34, fx = Math.cos(b.angle), fz = Math.sin(b.angle);
    R.setEmissive(1);
    R.box(b.x + fx * len / 2, b.y, b.z + fz * len / 2, len, 3, 3, b.from === 'player' ? '#7de8ff' : '#ff5df2', -b.angle);
    R.setEmissive(0);
  }
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    const c = pt.color;
    R.box(pt.x, pt.y, pt.z, pt.size, pt.size, pt.size, [c[0], c[1], c[2], a * 0.9]);
  }
  for (const s of G.skids) {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1, l = Math.hypot(dx, dz) || 1;
    const px = -dz / l * 3, pz = dx / l * 3;
    R.quad([s.x1 - px, 0.13, s.z1 - pz], [s.x1 + px, 0.13, s.z1 + pz], [s.x2 + px, 0.13, s.z2 + pz], [s.x2 - px, 0.13, s.z2 - pz], [0.05, 0.05, 0.08, 0.55], [0, 1, 0]);
  }
  const marker = (x, z, color, bob) => {
    const y = 70 + Math.sin(time * 3 + bob) * 8;
    R.setEmissive(0.7);
    R.box(x, y, z, 8, 140, 8, [color[0], color[1], color[2], 0.4]);
    R.setEmissive(0);
    R.box(x, 6, z, 26, 6, 26, color, time * 1.5);
  };
  if (G.missions && G.missions.marker) marker(G.missions.marker.x, G.missions.marker.z, [1, 0.85, 0.2], 0);
  if (G.race) {
    const wp = G.race.waypoints[G.race.playerWpi % G.race.waypoints.length];
    const dx = wp.x - G.player.x, dz = wp.z - G.player.z, dl = Math.hypot(dx, dz) || 1;
    const px = -dz / dl, pz = dx / dl;
    R.setEmissive(0.95);
    for (const s of [-1, 1]) R.box(wp.x + px * 46 * s, 55, wp.z + pz * 46 * s, 14, 110, 14, '#ff2e88');
    R.box(wp.x, 112, wp.z, 106, 8, 8, '#00e5ff');
    R.setEmissive(0);
    R.flat(wp.x - 60, wp.z - 60, 120, 120, 0.16, [1, 0.18, 0.53, 0.14]);
  }
  if (G.side) {
    for (const pk of G.side.shards) {
      if (pk.got) continue;
      R.setEmissive(0.9);
      R.box(pk.x, 12 + Math.sin(time * 3 + pk.id) * 3, pk.z, 14, 14, 14, '#00e5ff', time);
      R.setEmissive(0);
      R.flat(pk.x - 12, pk.z - 12, 24, 24, 0.2, [0, 0.9, 1, 0.3]);
    }
    if (G.side.trial.active && G.side.trial.marker) marker(G.side.trial.marker.x, G.side.trial.marker.z, [0.2, 0.8, 1], 2);
  }
  if (G.missions && G.missions.def && G.missions.index === 5) {
    for (const s of (G.missions.data.shards || [])) {
      if (s.got) continue;
      R.setEmissive(0.9);
      R.box(s.x, 12 + Math.sin(time * 3) * 3, s.z, 16, 16, 16, '#ffd23e', time);
      R.setEmissive(0);
    }
  }
  if (G.weather && G.weather.raining) {
    const ex = R.eye[0], ez = R.eye[2];
    for (let i = 0; i < (G.settings && G.settings.quality === 'low' ? 30 : 90); i += 1) {
      const rx = ex + ((i * 137.5 + time * 900) % 700) - 350;
      const rz = ez + ((i * 89.3) % 500) - 250;
      const ry = 120 - ((i * 53.7 + time * 700) % 120);
      R.box(rx, ry, rz, 1.5, 22, 1.5, [0.8, 0.85, 1, 0.35]);
    }
  }
  if (G.weather && G.weather.flash > 0) {
    R.setEmissive(1);
    R.box(R.eye[0], R.eye[1] + 120, R.eye[2], 8, 8, 8, [1, 1, 1, G.weather.flash * 0.4]);
    R.setEmissive(0);
  }
  R.flush();
  return { tris: R.tris, night: true };
}
