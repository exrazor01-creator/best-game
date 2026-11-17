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
// Frustum culling: skip anything clearly behind the camera or past the fog
// (fog far is 3000, so anything past ~2800 is haze anyway). The chase cam
// only ever sees half the city, so this roughly halves the triangles per
// frame — the difference between a smooth game and a slideshow on weak
// hardware. The margin is generous: only things clearly out of view go.
function vis(R, x, z, r) {
  const dx = x - R.eye[0], dz = z - R.eye[2];
  const d = Math.hypot(dx, dz);
  if (d > 2800 + r) return false;
  if (d < 1) return true;
  const f = R.fwd;
  const along = (dx * f[0] + dz * f[2]) / d;
  return along > -0.1 - r / d;
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
// ---------------------------------------------------------------------------
// HUMANOID PEOPLE — every figure is a real little person now: a tapered
// torso tube, a round head with hair / cap / helmet, arms and legs that
// swing with the walk cycle, shoes, and a gun in the hand when armed. No
// more stacked cubes. o: { scale, skin, shirt, pants, hair, hat, helmet,
// visor, gun, badge, stripe, pads, moving, seed }.
// ---------------------------------------------------------------------------
function drawHumanoid(R, x, z, angle, o, time) {
  const fx = Math.cos(angle), fz = Math.sin(angle), rx = -fz, rz = fx;
  const s = o.scale || 1;
  const phase = o.moving ? (time * 9 + (o.seed || 0) * 6.28) : 0;
  const swing = o.moving ? Math.sin(phase) * 0.45 : 0;
  const bob = o.moving ? Math.abs(Math.sin(phase)) * 1.2 * s : 0;
  // Soft blob shadow grounds the figure on the street.
  R.flat(x - 10 * s, z - 8 * s, 20 * s, 16 * s, 0.2, [0, 0, 0, 0.28]);
  const hipY = 16 * s + bob, shoulderY = 28 * s + bob, headY = 34 * s + bob;
  // Legs: tapered tubes from the hip, swinging forward and back in opposite
  // phase, with a shoe box at the ankle.
  for (const side of [-1, 1]) {
    const sw = side < 0 ? swing : -swing;
    const hipX = x + rx * 4.5 * s, hipZ = z + rz * 4.5 * s;
    const ankX = hipX + fx * Math.sin(sw) * 13 * s;
    const ankZ = hipZ + fz * Math.sin(sw) * 13 * s;
    R.limb(hipX, hipY, hipZ, ankX, 3 * s, ankZ, 3.2 * s, 2.6 * s, o.pants, 6);
    R.box(ankX + fx * 2 * s, 1.5 * s, ankZ + fz * 2 * s, 5 * s, 3 * s, 4 * s, '#14141c', angle);
  }
  // Torso: a tapered tube, slightly leaning forward when walking.
  R.limb(x, hipY, z, x + fx * 1.5 * s, shoulderY, z + fz * 1.5 * s, 7.5 * s, 6 * s, o.shirt, 8);
  // Arms: tubes from the shoulders, swinging opposite the legs. The gun arm
  // points forward and holds the weapon.
  for (const side of [-1, 1]) {
    const sw = side < 0 ? -swing * 0.8 : swing * 0.8;
    const shX = x + rx * 7.5 * s, shZ = z + rz * 7.5 * s;
    let handX, handY, handZ;
    if (o.gun && side === 1) {
      handX = x + fx * 14 * s; handY = 22 * s + bob; handZ = z + fz * 14 * s;
    } else {
      handX = shX + fx * Math.sin(sw) * 11 * s;
      handY = 17 * s + bob - Math.abs(Math.sin(sw)) * 1.5 * s;
      handZ = shZ + fz * Math.sin(sw) * 11 * s;
    }
    R.limb(shX, shoulderY, shZ, handX, handY, handZ, 2.8 * s, 2.2 * s, o.shirt, 6);
    R.sphere(handX, handY, handZ, 2.6 * s, o.skin, 6);
  }
  // Head: a real round head, not a cube.
  R.sphere(x + fx * 1.5 * s, headY, z + fz * 1.5 * s, 6.5 * s, o.skin, 8);
  if (o.helmet) {
    // Full helmet with a glowing visor slit.
    R.sphere(x + fx * 1.5 * s, headY + 1 * s, z + fz * 1.5 * s, 7.2 * s, o.helmet, 8, 0.85);
    R.setEmissive(0.7);
    R.box(x + fx * 8 * s, headY, z + fz * 8 * s, 3 * s, 2.5 * s, 9 * s, o.visor || '#ff2e88', angle);
    R.setEmissive(0);
  } else if (o.hat) {
    // Cap: a flattened dome plus a brim sticking forward.
    R.sphere(x + fx * 1.5 * s, headY + 2 * s, z + fz * 1.5 * s, 7 * s, o.hat, 8, 0.55);
    R.box(x + fx * 7 * s, headY + 4 * s, z + fz * 7 * s, 8 * s, 1.5 * s, 12 * s, o.hat, angle);
  } else {
    // Hair: a flattened cap of hair on top of the head.
    R.sphere(x + fx * 1.5 * s, headY + 2.5 * s, z + fz * 1.5 * s, 6.8 * s, o.hair || '#1a1a1a', 8, 0.6);
  }
  // Weapon in the gun hand.
  if (o.gun) {
    R.box(x + fx * 19 * s, 22 * s + bob, z + fz * 19 * s, 12 * s, 3.5 * s, 3.5 * s, '#0a0a0a', angle);
  }
  // Boss shoulder armor.
  if (o.pads) {
    R.sphere(x + rx * 8 * s, shoulderY + 1 * s, z + rz * 8 * s, 4.5 * s, o.pads, 6);
    R.sphere(x - rx * 8 * s, shoulderY + 1 * s, z - rz * 8 * s, 4.5 * s, o.pads, 6);
  }
  // Cop badge, glowing gold on the chest.
  if (o.badge) {
    R.setEmissive(0.8);
    R.box(x + fx * 6.8 * s, 24 * s + bob, z + fz * 6.8 * s, 2 * s, 3 * s, 3 * s, '#ffd23e', angle);
    R.setEmissive(0);
  }
  // Player jacket stripe — the runner is easy to spot in a crowd.
  if (o.stripe) {
    R.setEmissive(0.6);
    R.box(x, 20 * s + bob, z, 15 * s, 2.5 * s, 13 * s, '#00e5ff', angle);
    R.setEmissive(0);
  }
}
function drawPed(R, ped, time) {
  const scale = (ped.kind === 'boss' ? 1.3 : 1) * (ped.h || 1);
  const base = {
    scale, moving: !!ped.moving, seed: ped.seed || 0,
    skin: ped.skin || SKIN[Math.floor((ped.seed || 0) * 4) % 4],
    shirt: ped.color || '#7f8c8d', pants: ped.pants || '#1f2a4a', hair: ped.hair || '#1a1a1a',
  };
  if (ped.kind === 'boss') {
    drawHumanoid(R, ped.x, ped.z, ped.angle, { ...base, shirt: '#8e44ad', pants: '#2c1a4a', helmet: '#1a1a2e', visor: '#ff2e88', gun: true, pads: '#ff2e88' }, time);
  } else if (ped.kind === 'gang') {
    drawHumanoid(R, ped.x, ped.z, ped.angle, { ...base, shirt: '#c0392b', pants: '#1a1a1a', helmet: '#1a1a1a', visor: '#ff2e88', gun: true }, time);
  } else if (ped.kind === 'cop') {
    drawHumanoid(R, ped.x, ped.z, ped.angle, { ...base, shirt: '#1c4ed8', pants: '#141c33', hat: '#1c4ed8', badge: true }, time);
  } else {
    drawHumanoid(R, ped.x, ped.z, ped.angle, base, time);
  }
}
function drawPlayer(R, G, time) {
  const p = G.player;
  if (p.inCar) return;
  drawHumanoid(R, p.x, p.z, p.angle, {
    scale: 1, moving: !!p.moving, seed: 0.3,
    skin: '#f1c27d', shirt: '#2e86de', pants: '#1f2a4a', hat: '#ffd23e',
    gun: true, stripe: true,
  }, time);
}
// ---------------------------------------------------------------------------
// CARS — every vehicle is a designed machine now, not a painted box. Each
// kind gets its own silhouette: a low wide hypercar with a stepped nose and
// a wing, a tall truck with a cab and a cargo bed, a slim bike with a rider,
// a van with a window band, a hover car that floats on a glow skirt. All
// get cylinder wheels with hubs, bumpers, a chrome grille, mirrors,
// exhausts, glowing headlights and a red taillight bar.
// ---------------------------------------------------------------------------
const CAR_SHAPES = {
  hypercar: { len: 56, wid: 26, bodyH: 10, cabinH: 9, cabinLen: 0.42, spoiler: true, wedge: true },
  street: { len: 54, wid: 26, bodyH: 12, cabinH: 10, cabinLen: 0.45, spoiler: true },
  electric: { len: 52, wid: 26, bodyH: 11, cabinH: 9, cabinLen: 0.45, lightBar: true },
  drift: { len: 54, wid: 28, bodyH: 12, cabinH: 10, cabinLen: 0.45, spoiler: true, fenders: true },
  armored: { len: 60, wid: 30, bodyH: 18, cabinH: 8, cabinLen: 0.35, turret: true, bullbar: true },
  truck: { len: 74, wid: 28, bodyH: 16, cabinH: 16, cabinLen: 0.3, bed: true, stacks: true },
  van: { len: 56, wid: 28, bodyH: 20, cabinH: 0, cabinLen: 0, windows: true },
  bike: { len: 42, wid: 12, bodyH: 8, cabinH: 0, cabinLen: 0, rider: true },
  hover: { len: 52, wid: 26, bodyH: 12, cabinH: 10, cabinLen: 0.45, hover: true },
  sedan: { len: 52, wid: 26, bodyH: 13, cabinH: 10, cabinLen: 0.45 },
  sport: { len: 54, wid: 26, bodyH: 11, cabinH: 9, cabinLen: 0.42, spoiler: true },
  taxi: { len: 52, wid: 26, bodyH: 13, cabinH: 10, cabinLen: 0.45, taxiSign: true },
};
function drawWheel(R, x, z, a, fx, fz, rx, rz, len, wid, s, t, r) {
  const wx = x + fx * len * 0.32 * s + rx * wid * 0.5 * t;
  const wz = z + fz * len * 0.32 * s + rz * wid * 0.5 * t;
  // Tire: a fat cylinder across the wheel, hub: a lighter cap poking out.
  R.limb(wx - rx * 4, 5.5, wz - rz * 4, wx + rx * 4, 5.5, wz + rz * 4, r, r, '#0a0a0a', 8);
  R.limb(wx - rx * 4.6, 5.5, wz - rz * 4.6, wx + rx * 4.6, 5.5, wz + rz * 4.6, 2.4, 2.4, '#9aa5b1', 6);
}
function drawCar(R, car, time) {
  const x = car.x, z = car.z, a = car.angle;
  if (!car.dead) R.flat(x - 26, z - 20, 52, 40, 0.2, [0, 0, 0, 0.3]);
  if (car.dead) { R.box(x, 7, z, 52, 12, 26, '#1a1e33', a); return; }
  const sh = CAR_SHAPES[car.kind] || CAR_SHAPES.sedan;
  const len = sh.len, wid = sh.wid, bodyH = sh.bodyH;
  const cc = parseColor(car.color);
  R.flat(x - 30, z - 18, 60, 36, 0.15, [cc[0], cc[1], cc[2], 0.16]);
  const fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx;
  if (sh.hover) {
    // Hover car: floats above a glowing skirt, no wheels.
    R.setEmissive(0.8);
    R.box(x, 2, z, len * 0.85, 3, wid * 0.85, '#00e5ff', a);
    R.setEmissive(0);
    R.flat(x - 26, z - 20, 52, 40, 0.18, [0, 0.9, 1, 0.18]);
  }
  if (sh.rider) {
    // Slim bike: a low tank, a seat, two round wheels and a leaning rider.
    R.box(x, 7, z, len, 8, wid, car.color, a);
    R.box(x - fx * 6, 12, z - fz * 6, 14, 6, 10, '#2f3542', a);
    R.box(x + fx * 14, 10, z + fz * 14, 10, 5, 8, '#1a1a1a', a);
    for (const s of [-1, 1]) {
      const wx = x + fx * len * 0.34 * s, wz = z + fz * len * 0.34 * s;
      R.limb(wx - rx * 3, 6, wz - rz * 3, wx + rx * 3, 6, wz + rz * 3, 6, 6, '#0a0a0a', 8);
      R.limb(wx - rx * 3.4, 6, wz - rz * 3.4, wx + rx * 3.4, 6, wz + rz * 3.4, 2, 2, '#c0c8d8', 6);
    }
    R.box(x + fx * 20, 12, z + fz * 20, 2, 3, 10, '#0a0a0a', a);
    if (car.driver !== 'parked') {
      // Rider leaning over the tank, helmet on, arms to the bars.
      const px = x - fx * 4, pz = z - fz * 4;
      R.limb(px, 16, pz, px + fx * 10, 20, pz + fz * 10, 6, 5, '#2e86de', 8);
      R.sphere(px + fx * 13, 24, pz + fz * 13, 6, '#1a1a1a', 8, 0.85);
      R.limb(px + fx * 8, 20, pz + fz * 8, px + fx * 18, 14, pz + fz * 18, 2.2, 1.8, '#2e86de', 6);
      R.limb(px, 16, pz, px - fx * 6, 8, pz - fz * 6, 2.6, 2.2, '#1f2a4a', 6);
    }
    R.setEmissive(0.9);
    R.box(x + fx * len * 0.5, 8, z + fz * len * 0.5, 3, 4, 8, '#fff6b0', a);
    R.box(x - fx * len * 0.5, 8, z - fz * len * 0.5, 3, 4, 8, '#ff2e4d', a);
    R.setEmissive(0);
    return;
  }
  // Main body + stepped nose (hood) + rear deck: the profile reads as a
  // real car from the side instead of one flat slab.
  R.box(x, bodyH / 2 + 3, z, len, bodyH, wid, car.color, a);
  R.box(x + fx * len * 0.3, bodyH * 0.32 + 3, z + fz * len * 0.3, len * 0.32, bodyH * 0.6, wid * 0.9, car.color, a);
  R.box(x - fx * len * 0.32, bodyH * 0.42 + 3, z - fz * len * 0.32, len * 0.26, bodyH * 0.7, wid * 0.92, car.color, a);
  // Lower skirt, darker, grounds the body.
  R.box(x, 3.5, z, len * 0.96, 4, wid * 1.02, '#1a1e33', a);
  // Cabin: dark glass with a lighter windshield and side glass that catch
  // the neon. Vans get a tall window band instead of a separate cabin.
  if (sh.windows) {
    R.setEmissive(0.2);
    R.box(x, bodyH * 0.62 + 3, z, len * 0.7, 8, wid * 0.96, '#2a5a7a', a);
    R.setEmissive(0);
    R.box(x, bodyH + 3, z, len * 0.8, 3, wid * 0.9, '#10142a', a);
  } else if (sh.cabinH > 0) {
    const cy = bodyH + 3 + sh.cabinH / 2;
    R.box(x - fx * len * 0.04, cy, z - fz * len * 0.04, len * sh.cabinLen, sh.cabinH, wid * 0.78, '#10142a', a);
    // Windshield: a lighter glass slab at the front of the cabin.
    R.setEmissive(0.25);
    R.box(x + fx * (len * sh.cabinLen * 0.5 - len * 0.04), cy + 1, z + fz * (len * sh.cabinLen * 0.5 - len * 0.04), 2, sh.cabinH * 0.7, wid * 0.7, '#3a6a9a', a);
    // Side glass on both flanks.
    for (const t of [-1, 1]) {
      R.box(x - fx * len * 0.04 + rx * wid * 0.4 * t, cy, z - fz * len * 0.04 + rz * wid * 0.4 * t, len * sh.cabinLen * 0.8, sh.cabinH * 0.65, 1.5, '#2a4a6a', a);
    }
    R.setEmissive(0);
    // Roof panel over the glass.
    R.box(x - fx * len * 0.04, cy + sh.cabinH / 2 + 1, z - fz * len * 0.04, len * sh.cabinLen * 0.9, 2.5, wid * 0.72, car.color, a);
  }
  // Wheels with hubs — round, not square.
  if (!sh.hover) for (const s of [-1, 1]) for (const t of [-1, 1]) drawWheel(R, x, z, a, fx, fz, rx, rz, len, wid, s, t, 5.5);
  // Bumpers front and rear, chrome grille, side mirrors, exhausts.
  R.box(x + fx * (len / 2 + 1), 5, z + fz * (len / 2 + 1), 3, 5, wid * 0.95, '#2f3542', a);
  R.box(x - fx * (len / 2 + 1), 5, z - fz * (len / 2 + 1), 3, 5, wid * 0.95, '#2f3542', a);
  R.box(x + fx * (len / 2 + 0.5), 8.5, z + fz * (len / 2 + 0.5), 1.5, 4, wid * 0.55, '#c0c8d8', a);
  for (const t of [-1, 1]) {
    R.box(x + fx * len * 0.18 + rx * wid * 0.48 * t, bodyH + 2, z + fz * len * 0.18 + rz * wid * 0.48 * t, 4, 3, 3, '#1a1e33', a);
    R.box(x - fx * (len / 2 + 1) + rx * wid * 0.25 * t, 4, z - fz * (len / 2 + 1) + rz * wid * 0.25 * t, 3, 3, 3, '#3a3f4d', a);
  }
  // Headlight pool on the wet road ahead + big bright lamps and taillights.
  beam(R, x + fx * (len / 2 + 55), z + fz * (len / 2 + 55), a, 110, 34, [1, 0.92, 0.62, 0.10]);
  R.setEmissive(0.9);
  if (sh.lightBar) {
    // Electric car: one LED bar across the whole front.
    R.box(x + fx * len * 0.5, 9, z + fz * len * 0.5, 3, 4, wid * 0.85, '#bfe9ff', a);
  } else {
    for (const t of [-1, 1]) R.box(x + fx * len * 0.5 + rx * wid * 0.3 * t, 8, z + fz * len * 0.5 + rz * wid * 0.3 * t, 3, 5, 6, '#fff6b0', a);
  }
  R.box(x - fx * len * 0.5, 8, z - fz * len * 0.5, 3, 5, wid * 0.72, '#ff2e4d', a);
  R.setEmissive(0);
  // Wide fenders over the wheels (drift car).
  if (sh.fenders) {
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      R.box(x + fx * len * 0.32 * s + rx * wid * 0.5 * t, bodyH + 1, z + fz * len * 0.32 * s + rz * wid * 0.5 * t, 14, 3, 8, car.color, a);
    }
  }
  // Rear wing on the fast cars.
  if (sh.spoiler) {
    R.box(x - fx * (len / 2 - 2), bodyH + 11, z - fz * (len / 2 - 2), 4, 2, wid * 0.95, '#0a0a0a', a);
    for (const t of [-1, 1]) R.box(x - fx * (len / 2 - 2) + rx * wid * 0.35 * t, bodyH + 7, z - fz * (len / 2 - 2) + rz * wid * 0.35 * t, 3, 6, 3, '#0a0a0a', a);
  }
  // Armored: a roof turret with a barrel and a bull bar up front.
  if (sh.turret) {
    R.box(x - fx * 8, bodyH + 8, z - fz * 8, 20, 8, 20, '#2c3e50', a);
    R.limb(x + fx * 2, bodyH + 9, z + fz * 2, x + fx * 26, bodyH + 9, z + fz * 26, 2.5, 2, '#1a1a1a', 6);
    for (const t of [-1, 1]) R.box(x + fx * (len / 2 + 2) + rx * wid * 0.3 * t, 8, z + fz * (len / 2 + 2) + rz * wid * 0.3 * t, 3, 12, 3, '#3a3f4d', a);
  }
  // Truck: cargo bed behind the tall cab, twin exhaust stacks.
  if (sh.bed) {
    R.box(x - fx * len * 0.2, bodyH * 0.55 + 3, z - fz * len * 0.2, len * 0.52, bodyH * 0.85, wid * 0.94, '#5a6470', a);
    R.box(x - fx * len * 0.2, bodyH + 3, z - fz * len * 0.2, len * 0.52, 3, wid * 0.94, '#3a3f4d', a);
    for (const t of [-1, 1]) R.cyl(x + fx * len * 0.12 + rx * wid * 0.42 * t, bodyH + 3, z + fz * len * 0.12 + rz * wid * 0.42 * t, 2, 16, '#2f3542', 6);
  }
  // Taxi roof sign, glowing.
  if (sh.taxiSign) {
    R.setEmissive(0.9);
    R.box(x - fx * len * 0.04, bodyH + 3 + sh.cabinH + 4, z - fz * len * 0.04, 14, 5, 8, '#ffd23e', a);
    R.setEmissive(0);
  }
  if (car.kind === 'hover') R.box(x, 2, z, len * 0.8, 3, wid * 0.8, '#00e5ff', a);
  if (car.driver === 'police') {
    const flash = Math.floor(time * 6) % 2 === 0 ? '#ff4757' : '#3742fa';
    R.setEmissive(0.9);
    R.box(x - fx * 4, bodyH + 14, z - fz * 4, 16, 4, 8, flash, a);
    R.setEmissive(0);
    R.box(x, bodyH / 2 + 3, z, len * 0.9, 3, wid + 1, '#ecf0f1', a);
  }
  if (car.hp < car.maxHp * 0.5) {
    R.setEmissive(0.5);
    R.box(x, bodyH + 12, z, 6, 10, 6, '#ff8c00', a);
    R.setEmissive(0);
  }
}
// Lit windows on one building face: a real grid of panes, rows per floor
// and columns by width, each pane lit or dark by a deterministic hash of
// the building seed — facades read as inhabited, with real variation.
function winGrid(R, b, face, h) {
  const rows = Math.min(Math.max(2, b.floors), 10);
  const cols = Math.max(2, Math.min(8, Math.floor(face.len / 34)));
  const seed = Math.floor((b.seed || 0.5) * 1000);
  for (let r = 0; r < rows; r += 1) {
    const y = 10 + (r + 0.5) * (h - 18) / rows;
    for (let c = 0; c < cols; c += 1) {
      const off = -face.len / 2 + 14 + (c * (face.len - 28)) / Math.max(1, cols - 1);
      const hash = (r * 7 + c * 13 + seed + face.idx * 5) % 10;
      if (hash >= 7) continue;
      const col = (r + c + face.idx) % 4 === 0 ? '#7de8ff' : '#ffd97a';
      if (face.along === 'x') {
        const wx = face.cx + off, wz = face.cz;
        const n = face.idx === 0 ? [0, 0, 1] : [0, 0, -1];
        R.quad([wx - 5, y - 6, wz], [wx + 5, y - 6, wz], [wx + 5, y + 6, wz], [wx - 5, y + 6, wz], col, n);
      } else {
        const wx = face.cx, wz = face.cz + off;
        const n = face.idx === 2 ? [1, 0, 0] : [-1, 0, 0];
        R.quad([wx, y - 6, wz - 5], [wx, y - 6, wz + 5], [wx, y + 6, wz + 5], [wx, y + 6, wz - 5], col, n);
      }
    }
  }
}
// Roof furniture: AC boxes, antennas with a red tip, water tanks, helipads.
function drawRoof(R, b, h, cx, cz) {
  if (b.roof === 'ac') {
    R.box(cx - b.w * 0.2, h + 7, cz, 16, 8, 14, '#3a4266');
    R.box(cx + b.w * 0.25, h + 6, cz + b.d * 0.15, 12, 6, 10, '#2c3550');
  } else if (b.roof === 'antenna') {
    R.cyl(cx + b.w * 0.25, h + 6, cz, 1.5, 46, '#5a6a8a', 6);
    R.setEmissive(1);
    R.sphere(cx + b.w * 0.25, h + 54, cz, 3, '#ff4757', 6);
    R.setEmissive(0);
  } else if (b.roof === 'tank') {
    R.cyl(cx, h + 6, cz, 9, 16, '#4a3b2a', 8);
    R.sphere(cx, h + 22, cz, 9, '#4a3b2a', 8, 0.7);
    R.cyl(cx - b.w * 0.3, h + 6, cz, 1, 20, '#5a6a8a', 5);
  } else if (b.roof === 'helipad') {
    R.flat(cx - 22, cz - 22, 44, 44, h + 6.5, '#1a1e33');
    R.setEmissive(0.6);
    R.flat(cx - 16, cz - 16, 32, 32, h + 7, [0, 0.9, 1, 0.5]);
    R.setEmissive(0);
  }
}
// Ground-floor shopfront on the road-facing side: glass storefront, a
// striped awning and a neon sign band, so low blocks read as shops.
function drawShop(R, b, cx, cz) {
  const face = b.shopFace || 'z+';
  const w = b.w, d = b.d;
  let ax, az, nx, nz;
  if (face === 'z+') { ax = cx; az = cz + d / 2 + 3; nx = 0; nz = 1; }
  else if (face === 'z-') { ax = cx; az = cz - d / 2 - 3; nx = 0; nz = -1; }
  else if (face === 'x+') { ax = cx + w / 2 + 3; az = cz; nx = 1; nz = 0; }
  else { ax = cx - w / 2 - 3; az = cz; nx = -1; nz = 0; }
  const along = face[0] === 'z' ? 'x' : 'z';
  const len = (along === 'x' ? w : d) * 0.7;
  R.setEmissive(0.25);
  if (along === 'x') R.box(ax, 9, az, len, 14, 2, '#2a5a7a');
  else R.box(ax, 9, az, 2, 14, len, '#2a5a7a');
  R.setEmissive(0);
  const segs = 5;
  for (let i = 0; i < segs; i += 1) {
    const off = -len / 2 + (i + 0.5) * (len / segs);
    const col = i % 2 === 0 ? b.neon : '#f5f0e6';
    if (along === 'x') R.box(ax + off, 17, az + nz * 6, len / segs, 2, 12, col);
    else R.box(ax + nx * 6, 17, az + off, 12, 2, len / segs, col);
  }
  R.setEmissive(0.9);
  if (along === 'x') R.box(ax, 24, az + nz * 2, len * 0.8, 4, 2, b.neon);
  else R.box(ax + nx * 2, 24, az, 2, 4, len * 0.8, b.neon);
  R.setEmissive(0);
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
  // Raised curbs along every road edge, so the sidewalk reads as a curb,
  // not a flat painted strip.
  for (const a of AVENUES) {
    R.box(a - ROAD_W / 2 - 15, 1.5, WORLD.h / 2, 3, 3, WORLD.h, PALETTE.curb);
    R.box(a + ROAD_W / 2 + 15, 1.5, WORLD.h / 2, 3, 3, WORLD.h, PALETTE.curb);
  }
  for (const s of STREETS) {
    R.box(WORLD.w / 2, 1.5, s - ROAD_W / 2 - 15, WORLD.w, 3, 3, PALETTE.curb);
    R.box(WORLD.w / 2, 1.5, s + ROAD_W / 2 + 15, WORLD.w, 3, 3, PALETTE.curb);
  }
  // Zebra crossings + stop lines at every intersection, so the street
  // grid reads as a real city grid.
  for (const a of AVENUES) for (const s of STREETS) {
    for (let i = 0; i < 5; i += 1) {
      R.flat(a - 24 + i * 12, s - ROAD_W / 2 - 18, 6, ROAD_W, 0.13, '#e8ecf1');
      R.flat(a - ROAD_W / 2 - 18, s - 24 + i * 12, ROAD_W, 6, 0.13, '#e8ecf1');
    }
    R.flat(a - ROAD_W / 2, s - ROAD_W / 2 - 30, ROAD_W, 4, 0.13, '#e8ecf1');
    R.flat(a - ROAD_W / 2 - 30, s - ROAD_W / 2, 4, ROAD_W, 0.13, '#e8ecf1');
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
    if (!vis(R, cx, cz, Math.max(b.w, b.d))) continue;
    // Main slab, then setbacks: tall towers step in as they rise, so the
    // skyline is a set of varied silhouettes, not identical slabs.
    R.box(cx, h / 2, cz, b.w, h, b.d, b.color);
    if (b.floors >= 6) {
      const h2 = h * 0.62;
      R.box(cx, h2 + (h - h2) / 2, cz, b.w * 0.72, h - h2, b.d * 0.72, b.color);
      if (b.floors >= 14) {
        const h3 = h * 0.85;
        R.box(cx, h3 + (h - h3) / 2, cz, b.w * 0.45, h - h3, b.d * 0.45, b.color);
      }
    }
    R.box(cx, h + 3, cz, b.w - 10, 6, b.d - 10, '#0d1020');
    if (b.floors >= 2) {
      R.setEmissive(0.7);
      winGrid(R, b, { idx: 0, along: 'x', len: b.w, cx, cz: cz + b.d / 2 + 1 }, h);
      winGrid(R, b, { idx: 1, along: 'x', len: b.w, cx, cz: cz - b.d / 2 - 1 }, h);
      winGrid(R, b, { idx: 2, along: 'z', len: b.d, cx: cx + b.w / 2 + 1, cz }, h);
      winGrid(R, b, { idx: 3, along: 'z', len: b.d, cx: cx - b.w / 2 - 1, cz }, h);
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
    drawRoof(R, b, h, cx, cz);
    if (b.shop) drawShop(R, b, cx, cz);
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
  for (const c of G.world.containers) {
    if (!vis(R, c.x, c.z, 60)) continue;
    R.box(c.x, 12, c.z, 60, 24, 26, c.color);
  }
  R.box(2000, 30, 1900, 260, 60, 200, '#141830');
  R.setEmissive(0.7);
  R.flat(2000 - 130, 1900 - 6, 260, 12, 0.15, '#00e5ff');
  R.setEmissive(0);
  for (const s of G.world.stalls) {
    if (!vis(R, s.x, s.z, 60)) continue;
    R.box(s.x, 10, s.z, 56, 20, 30, '#2a2118');
    R.box(s.x, 24, s.z, 60, 5, 34, s.color);
    R.box(s.x, 27, s.z, 30, 5, 34, '#f5f0e6');
    R.setEmissive(0.9);
    R.box(s.x, 32, s.z + 17, 44, 4, 2, s.neon);
    R.setEmissive(0);
    for (const gx of [-1, 1]) for (const gz of [-1, 1]) R.box(s.x + gx * 24, 6, s.z + gz * 12, 8, 8, 8, '#ffd23e');
    R.box(s.x, 22, s.z, 40, 4, 20, s.neon);
  }
  // Trees with round canopies, not square bushes.
  for (const t of G.world.trees) {
    if (!vis(R, t.x, t.z, 40)) continue;
    R.cyl(t.x, 0, t.z, 3 * t.s, 26 * t.s, '#24402e', 6);
    R.sphere(t.x, 36 * t.s, t.z, 15 * t.s, '#1d6b3c', 8);
    R.sphere(t.x + 8 * t.s, 46 * t.s, t.z, 10 * t.s, '#2a8a4d', 8);
  }
  for (const l of G.world.lamps) {
    if (!vis(R, l.x, l.z, 30)) continue;
    R.box(l.x, 12, l.z, 3, 24, 3, '#2f3542');
    R.setEmissive(0.9);
    R.box(l.x, 26, l.z, 9, 3, 9, '#ffe66d');
    R.setEmissive(0);
    R.flat(l.x - 10, l.z - 10, 20, 20, 0.2, [1, 0.9, 0.5, 0.13]);
    // Wet-road reflection: a long warm streak under each lamp.
    R.flat(l.x - 5, l.z - 34, 10, 68, 0.18, [1, 0.85, 0.45, 0.08]);
  }
  // Street furniture: hydrants, benches, bus stops, billboards, and
  // traffic lights that actually change with the time of day.
  for (const p of G.world.props) {
    if (!vis(R, p.x, p.z, 70)) continue;
    if (p.kind === 'hydrant') {
      R.cyl(p.x, 0, p.z, 3, 10, '#c0392b', 6);
      R.sphere(p.x, 11, p.z, 3.5, '#c0392b', 6);
      R.box(p.x + 4, 6, p.z, 3, 3, 3, '#8e2f23');
    } else if (p.kind === 'bench') {
      R.box(p.x, 6, p.z, 40, 4, 14, '#6b4a2a', p.rot);
      R.box(p.x, 12, p.z - 6, 40, 10, 3, '#6b4a2a', p.rot);
      R.box(p.x - 16, 2, p.z, 3, 4, 12, '#2f3542', p.rot);
      R.box(p.x + 16, 2, p.z, 3, 4, 12, '#2f3542', p.rot);
    } else if (p.kind === 'busstop') {
      R.cyl(p.x, 0, p.z, 2, 44, '#5a6a8a', 6);
      R.setEmissive(0.8);
      R.box(p.x, 46, p.z, 14, 10, 2, '#00e5ff', p.rot);
      R.setEmissive(0);
      R.box(p.x + 10, 6, p.z, 40, 4, 14, '#6b4a2a', p.rot);
    } else if (p.kind === 'billboard') {
      R.box(p.x - 14, 20, p.z, 4, 40, 4, '#2f3542');
      R.box(p.x + 14, 20, p.z, 4, 40, 4, '#2f3542');
      R.setEmissive(0.85);
      R.box(p.x, 48, p.z, 64, 34, 3, p.color);
      R.setEmissive(0);
      R.box(p.x, 48, p.z, 68, 38, 1, '#1a1e33');
    } else if (p.kind === 'light') {
      const phase = Math.floor(time / 7) % 2;
      const green = phase === 0;
      R.cyl(p.x, 0, p.z, 2, 42, '#2f3542', 6);
      R.box(p.x, 48, p.z, 7, 16, 7, '#1a1e33');
      const lampCols = ['#ff4757', '#ffd23e', '#39ff88'];
      const lit = green ? 2 : 0;
      for (let i = 0; i < 3; i += 1) {
        if (i === lit) R.setEmissive(1);
        else R.setEmissive(0.15);
        R.box(p.x - 5, 53 - i * 5, p.z - 5, 3, 3, 3, lampCols[i]);
      }
      R.setEmissive(0);
    }
  }
  for (const f of G.world.flyers) {
    const fx = f.x + Math.sin(time * 0.1 + f.phase) * 400;
    if (!vis(R, fx, f.z, 60)) continue;
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
  // Dusk clouds: long soft bands drifting across the sky.
  for (let i = 0; i < 5; i += 1) {
    const cx = R.eye[0] + ((i * 700 + time * 12) % 2400) - 1200;
    const cz = R.eye[2] - 900 + i * 320;
    const cy = R.eye[1] + 320 + (i % 3) * 60;
    R.quad(
      [cx - sr[0] * 420, cy, cz - sr[2] * 420], [cx + sr[0] * 420, cy, cz + sr[2] * 420],
      [cx + sr[0] * 420, cy + 46, cz + sr[2] * 420], [cx - sr[0] * 420, cy + 46, cz - sr[2] * 420],
      [0.32, 0.18, 0.42, 0.35], sunDir,
    );
  }
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
  for (const car of G.cars) if (!car.hidden && vis(R, car.x, car.z, 60)) drawCar(R, car, time);
  for (const ped of G.peds) if (!ped.hidden && vis(R, ped.x, ped.z, 40)) drawPed(R, ped, time);
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
