import { TUNE, WEAPONS, WEAPON_ORDER, VEHICLES, VEHICLE_ORDER, PLACES } from './config.js';
import { clamp, dist } from './random.js';
import { collideCircle } from './world.js';
import { spawnBullet, addParticles, killPed } from './combat.js';
import { driveCar, spawnCar } from './traffic.js';
import { pressed, take } from './input.js';
export function nearestCar(G, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    if (c.dead || c.driver === 'player') continue;
    const d = dist(G.player.x, G.player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function tryEnterCar(G) {
  const car = nearestCar(G, 70);
  if (!car) return;
  car.speed = 0;
  if (car.driver === 'traffic') {
    car.driver = 'player';
    G.peds.push({ x: car.x + 30, z: car.z + 10, angle: 0, speed: 0, kind: 'walker', hp: 100, tx: car.x + 200, tz: car.z + 200, waitT: 5, fleeT: 5, color: '#e74c3c', seed: G.rng() });
    G.banner = { text: 'Car jacked! The driver ran off screaming.', t: 3 };
    G.wanted.points += 2;
  } else {
    car.driver = 'player';
    G.banner = { text: `${VEHICLES[car.kind] ? VEHICLES[car.kind].name : 'Vehicle'} — yours now. Shift for nitro.`, t: 2 };
  }
  G.stats.stolen += 1;
  G.player.inCar = car;
  if (G.player.nitroStock > 0) { car.nitro = (car.nitro || 0) + G.player.nitroStock * 3; G.player.nitroStock = 0; }
  G.player.x = car.x; G.player.z = car.z;
  G.audio.pickup();
}
function exitCar(G) {
  const car = G.player.inCar;
  if (!car) return;
  car.driver = 'parked';
  const a = car.angle + Math.PI / 2;
  G.player.x = car.x + Math.cos(a) * 40; G.player.z = car.z + Math.sin(a) * 40;
  G.player.inCar = null;
  const fixed = collideCircle(G, G.player.x, G.player.z, TUNE.playerRadius);
  G.player.x = fixed.x; G.player.z = fixed.z;
}
function ownedWeapons(p) {
  return WEAPON_ORDER.filter((w) => w === 'pistol' || (w === 'rifle' && p.ownsRifle) || (w === 'sniper' && p.ownsSniper));
}
function cycleWeapon(G) {
  const p = G.player, list = ownedWeapons(p);
  if (list.length < 2) { G.banner = { text: 'Only the blaster so far — buy more at Black Market Arms.', t: 2 }; return; }
  p.weapon = list[(list.indexOf(p.weapon) + 1) % list.length];
  G.banner = { text: `${WEAPONS[p.weapon].name} out.`, t: 1.5 };
}
function reloadWeapon(G) {
  const p = G.player, w = WEAPONS[p.weapon];
  if (!w.mag) return;
  const key = p.weapon === 'rifle' ? 'rifleMag' : 'sniperMag';
  const need = w.mag - (p[key] || 0);
  if (need <= 0) { G.banner = { text: 'Magazine already full.', t: 1.5 }; return; }
  if (p.ammo <= 0) { G.banner = { text: 'No ammo — buy more at Black Market Arms.', t: 2 }; return; }
  const n = Math.min(need, p.ammo);
  p[key] = (p[key] || 0) + n; p.ammo -= n;
  G.audio.pickup();
  G.banner = { text: `Reloaded ${n} rounds into the ${w.name}.`, t: 2 };
}
function fireWeapon(G) {
  const p = G.player, w = WEAPONS[p.weapon];
  const ox = p.x + Math.cos(p.angle) * 20, oz = p.z + Math.sin(p.angle) * 20;
  if (w.mag) {
    const key = p.weapon === 'rifle' ? 'rifleMag' : 'sniperMag';
    if ((p[key] || 0) <= 0) { p.fireCd = 0.3; G.banner = { text: 'Magazine empty — press R to reload.', t: 2 }; return; }
    p[key] -= 1; p.fireCd = w.delay; G.stats.shots += 1;
    spawnBullet(G, ox, 22, oz, p.angle + (Math.random() - 0.5) * w.spread, 'player', w.dmg);
    if (p.weapon === 'rifle') G.audio.rifle(); else G.audio.sniper();
    return;
  }
  if (p.ammo <= 0) { p.fireCd = 0.3; G.banner = { text: 'Out of ammo — buy more at Black Market Arms.', t: 2 }; return; }
  p.ammo -= 1; p.fireCd = w.delay; G.stats.shots += 1;
  spawnBullet(G, ox, 22, oz, p.angle + (Math.random() - 0.5) * w.spread, 'player', w.dmg);
  G.audio.shoot();
}
function punch(G) {
  const p = G.player;
  p.punchCd = TUNE.punchDelay;
  const dmg = p.ownsBat ? TUNE.batDmg : TUNE.punchDmg;
  let hit = false;
  for (const ped of [...G.peds]) {
    if ((ped.kind === 'gang' || ped.kind === 'boss' || ped.kind === 'cop') && dist(p.x, p.z, ped.x, ped.z) < 52) {
      ped.hp -= dmg; ped.flash = 0.2;
      addParticles(G, ped.x, 22, ped.z, '#ffd23e', 6, 160, 0.4, 5);
      G.audio.hit();
      if (ped.hp <= 0) killPed(G, ped);
      hit = true;
    }
  }
  if (!hit) G.audio.hit();
}
export function buyShopItem(G, n) {
  const p = G.player, shop = G.shopNear;
  if (!shop) return;
  const pay = (price, what) => {
    if (p.money < price) { G.banner = { text: 'Not enough credits — go earn some first.', t: 2 }; return false; }
    p.money -= price; G.audio.cash(); G.banner = { text: `${what} — $${price}.`, t: 2.5 }; return true;
  };
  if (shop.kind === 'ammo') {
    if (n === 1) { if (pay(TUNE.ammoPrice, `+${TUNE.ammoPack} ammo`)) p.ammo += TUNE.ammoPack; }
    else if (n === 2) { if (pay(TUNE.medPrice, 'Patched up to full HP')) p.hp = p.maxHp; }
    else if (n === 3) { if (pay(TUNE.armorPrice, `+${TUNE.armorPack} armor`)) p.armor = Math.min(100, p.armor + TUNE.armorPack); }
    else if (n === 4) { if (!p.ownsRifle) { if (pay(TUNE.riflePrice, 'Pulse Rifle bought (30-round mag)')) { p.ownsRifle = true; p.rifleMag = 30; } } else G.banner = { text: 'You already own the rifle — press R to reload.', t: 2 }; }
    else if (n === 5) { if (!p.ownsSniper) { if (pay(TUNE.sniperPrice, 'Rail Sniper bought (5-round mag)')) { p.ownsSniper = true; p.sniperMag = 5; } } else G.banner = { text: 'You already own the sniper — press R to reload.', t: 2 }; }
    else if (n === 6) { if (!p.ownsBat) { if (pay(TUNE.batPrice, 'Shock Bat bought — punches hit twice as hard')) p.ownsBat = true; } else G.banner = { text: 'You already own the bat.', t: 2 }; }
  } else if (shop.kind === 'repair') {
    if (n === 1) { if (p.inCar && pay(TUNE.repairPrice, 'Vehicle repaired')) p.inCar.hp = p.inCar.maxHp; else if (!p.inCar) G.banner = { text: 'No vehicle to fix.', t: 2 }; }
    else if (n === 2) { if (pay(TUNE.nitroPrice, 'Nitro tank fitted — hold Shift in a car to boost')) { if (p.inCar) p.inCar.nitro = (p.inCar.nitro || 0) + 3; else p.nitroStock = (p.nitroStock || 0) + 1; } }
    else if (n === 3) { if (pay(TUNE.enginePrice, 'Engine tuned — +60 top speed on your current ride')) { if (p.inCar) p.inCar.engineBonus = (p.inCar.engineBonus || 0) + TUNE.engineBonus; } }
  } else if (shop.kind === 'garage') {
    const order = VEHICLE_ORDER;
    const idx = n - 1;
    if (idx >= 0 && idx < order.length) {
      const key = order[idx];
      const def = VEHICLES[key];
      if (G.garage.includes(key)) { G.banner = { text: `${def.name} is already in your garage.`, t: 2 }; return; }
      if (pay(def.price, `${def.name} bought — it is parked at the garage`)) {
        G.garage.push(key);
        const car = spawnCar(G, PLACES.garage.x + 60 + G.garage.length * 50, PLACES.garage.z, key, 'parked');
        car.garage = true;
      }
    }
  }
}
export function updatePlayer(G, dt) {
  const p = G.player, input = G.input;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  if (take(input, 'e')) { if (p.inCar) exitCar(G); else tryEnterCar(G); }
  if (take(input, 'q')) cycleWeapon(G);
  if (take(input, 'r')) reloadWeapon(G);
  if (take(input, 'f')) { if (!p.inCar && p.punchCd <= 0) punch(G); }
  if (G.state === 'playing' && G.shopNear && take(input, 'b')) { G.state = 'shop'; return; }
  if (take(input, 'g')) {
    if (G.garage.length > 0) {
      const idx = G.garage.indexOf(G.garageSel || G.garage[0]);
      const next = G.garage[(idx + 1) % G.garage.length];
      G.garageSel = next;
      G.banner = { text: `Garage: ${VEHICLES[next].name} selected — buy it at the garage shop to park it here.`, t: 2 };
    }
  }
  if (p.inCar) {
    const car = p.inCar;
    const fwd = pressed(input, 'w', 'ArrowUp') ? 1 : pressed(input, 's', 'ArrowDown') ? -1 : 0;
    const steer = pressed(input, 'a', 'ArrowLeft') ? -1 : pressed(input, 'd', 'ArrowRight') ? 1 : 0;
    const nitro = pressed(input, 'Shift') && car.nitro > 0;
    driveCar(G, car, dt, fwd, steer, nitro);
    p.x = car.x; p.z = car.z; p.angle = car.angle;
    p.moving = Math.abs(car.speed) > 20;
    G.audio.engine(Math.min(1, Math.abs(car.speed) / 800), nitro);
    return;
  }
  G.audio.engine(0, false);
  const fwd = pressed(input, 'w', 'ArrowUp') ? 1 : pressed(input, 's', 'ArrowDown') ? -1 : 0;
  const strafe = pressed(input, 'd', 'ArrowRight') ? 1 : pressed(input, 'a', 'ArrowLeft') ? -1 : 0;
  const sprint = pressed(input, 'Shift');
  const speed = TUNE.walkSpeed * (sprint ? TUNE.sprintMul : 1);
  let mx = 0, mz = 0;
  if (fwd || strafe) {
    const a = p.angle;
    mx = Math.cos(a) * fwd - Math.sin(a) * strafe;
    mz = Math.sin(a) * fwd + Math.cos(a) * strafe;
    const l = Math.hypot(mx, mz) || 1;
    mx /= l; mz /= l;
    p.moving = true;
  } else p.moving = false;
  const nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
  const fixed = collideCircle(G, nx, nz, TUNE.playerRadius);
  p.x = fixed.x; p.z = fixed.z;
  if (G.aim) p.angle = Math.atan2(G.aim.z - p.z, G.aim.x - p.x);
  if (input.mouse.down && p.fireCd <= 0 && p.punchCd <= 0) {
    const d = G.aim ? dist(p.x, p.z, G.aim.x, G.aim.z) : 999;
    if (d < 60 && p.punchCd <= 0) punch(G);
    else fireWeapon(G);
  }
  if (take(input, ' ')) {
    p.dodgeT = 0.25;
    p.x += Math.cos(p.angle) * 60; p.z += Math.sin(p.angle) * 60;
    addParticles(G, p.x, 10, p.z, '#00e5ff', 6, 120, 0.4, 4);
  }
}
