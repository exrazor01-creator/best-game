import { VIEW, WORLD, STEP, START, TUNE, PLACES, MISSION_COUNT, VEHICLES } from './config.js';
import { mulberry32 } from './random.js';
import { buildWorld } from './world.js';
import { createRenderer } from './gl.js';
import { render3D, updateCamera } from './render3d.js';
import { createInput, take, endFrame, pressed } from './input.js';
import { createAudio } from './audio.js';
import { updatePlayer, buyShopItem } from './player.js';
import { spawnTraffic, spawnPeds, updateTraffic, updateRivals, spawnCar } from './traffic.js';
import { updatePeds, updateBullets, hurtPlayer } from './combat.js';
import { updateWanted, updatePolice } from './police.js';
import { startMission, advanceDialog, updateMissions, completeMission } from './missions.js';
import { initSide, updateSide, startTrial } from './side.js';
import { drawHUD, drawTitle, drawPaused, drawWasted, drawComplete, drawFailed, drawMap } from './hud.js';
import { stageShot } from './shots.js';
import { saveGame, loadGame, clearSave } from './save.js';
const canvas = document.getElementById('game');
canvas.width = VIEW.w; canvas.height = VIEW.h;
const hudCanvas = document.getElementById('hud');
hudCanvas.width = VIEW.w; hudCanvas.height = VIEW.h;
const hctx = hudCanvas.getContext('2d');
const R = createRenderer(canvas);
const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7);
const SHOT = params.get('shot') || '';
function freshState(seed) {
  const rng = mulberry32(seed);
  const G = {
    seed, rng, world: buildWorld(rng), input: createInput(canvas), audio: createAudio(),
    canvas, state: 'title', time: 0, timeOfDay: 0.9, frozen: false,
    player: {
      x: START.x, z: START.z, angle: -Math.PI / 2, hp: TUNE.playerHp, maxHp: TUNE.playerHp,
      money: START.money, ammo: START.ammo, weapon: 'pistol', ownsRifle: false, ownsSniper: false,
      rifleMag: 0, sniperMag: 0, ownsBat: false, armor: 0, nitroStock: 0,
      inCar: null, fireCd: 0, punchCd: 0, hurtT: 0, invuln: 0, moving: false, dodgeT: 0,
    },
    cars: [], peds: [], rivals: [], race: null, bullets: [], particles: [], skids: [],
    wanted: { stars: 0, points: 0, quietT: 0 },
    pendingWanted: 0, lastSeen: { x: START.x, z: START.z },
    missions: null, places: PLACES, aim: null, garage: ['vortex'], garageSel: 'vortex',
    weather: { raining: false, t: 0, flash: 0, nextBolt: 30 },
    settings: { volume: 0.5, quality: 'high', radio: 0 },
    saveSlot: 0, slotSaves: [0, 1, 2].map((s) => !!loadGame(s)), saveExists: false, muted: false,
    lastAuto: 0, failReason: '',
    camera: { eye: [START.x, 120, START.z + 200], target: [START.x, 20, START.z], heading: -Math.PI / 2, shake: 0 },
    cameraOverride: null,
    stats: { kills: 0, stolen: 0, earned: 0, shots: 0, missionsDone: 0 },
    banner: null, shopNear: null,
  };
  G.reset = function resetGame() {
    const keep = { input: G.input, audio: G.audio, canvas: G.canvas };
    const fresh = freshState(seed);
    Object.assign(G, fresh, keep);
    G.reset = resetGame;
  };
  spawnTraffic(G); spawnPeds(G);
  initSide(G);
  const starter = spawnCar(G, 1200, 1250, 'vortex', 'parked');
  starter.garage = true; starter.nitro = 0; starter.angle = -Math.PI / 2;
  spawnCar(G, 2000, PLACES.neon.z + 80, 'streethawk', 'parked');
  spawnCar(G, 2120, 1100, 'neonbike', 'parked');
  spawnCar(G, 400, PLACES.port.z - 80, 'ironclad', 'parked');
  spawnCar(G, 1600, PLACES.tower.z, 'voltspark', 'parked');
  spawnCar(G, 2400, PLACES.arena.z - 80, 'driftking', 'parked');
  spawnCar(G, 400, PLACES.port.z + 80, 'hauler', 'parked');
  spawnCar(G, 2400, PLACES.hospital.z - 80, 'aerocab', 'parked');
  return G;
}
const G = freshState(SEED);
G.saveExists = G.slotSaves[0];
G.renderer = R;
function updateShopNear(G) {
  const p = G.player;
  const d = (pl) => Math.hypot(p.x - pl.x, p.z - pl.z);
  if (d(PLACES.ammoShop) < 100) G.shopNear = { kind: 'ammo', name: 'Black Market Arms' };
  else if (d(PLACES.repairShop) < 100) G.shopNear = { kind: 'repair', name: 'Pit Stop' };
  else if (d(PLACES.garage) < 120) G.shopNear = { kind: 'garage', name: 'Rook\'s Garage' };
  else G.shopNear = null;
}
function stepPlaying(dt) {
  G.time += dt;
  G.timeOfDay = Math.min(0.98, G.timeOfDay + TUNE.timeRate * dt);
  G.weather.t += dt;
  G.weather.raining = (G.weather.t % 240) >= 60 && (G.weather.t % 240) < 120;
  if (G.weather.raining && G.time > G.weather.nextBolt) {
    G.weather.flash = 1;
    G.weather.nextBolt = G.time + 8 + G.rng() * 10;
    G.audio.thunder();
  }
  if (G.weather.flash > 0) G.weather.flash = Math.max(0, G.weather.flash - dt * 1.8);
  if (G.time - G.lastAuto > 60) { G.lastAuto = G.time; saveGame(G, G.saveSlot); }
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  updateCamera(G, dt);
  G.aim = R.rayGround(G.input.mouse.x, G.input.mouse.y);
  updateShopNear(G);
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updateRivals(G, dt);
  updatePeds(G, dt);
  updateWanted(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateMissions(G, dt);
  updateSide(G, dt);
}
function startStory() {
  const save = loadGame(G.saveSlot);
  G.audio.ensure(); G.audio.startMusic();
  if (save && save.mission >= 0 && save.mission < MISSION_COUNT) {
    const p = G.player;
    p.money = save.money; p.ammo = save.ammo; p.hp = save.hp;
    p.ownsRifle = !!save.ownsRifle; p.ownsSniper = !!save.ownsSniper;
    p.rifleMag = save.rifleMag || 0; p.sniperMag = save.sniperMag || 0; p.ownsBat = !!save.ownsBat;
    p.armor = save.armor || 0; p.nitroStock = save.nitroStock || 0;
    p.x = save.x; p.z = save.z; G.timeOfDay = save.timeOfDay ?? 0.9;
    G.stats.missionsDone = save.missionsDone || 0; G.stats.earned = save.earned || 0;
    G.garage = save.garage && save.garage.length ? save.garage : ['vortex'];
    if (save.radio !== undefined) { G.settings.radio = save.radio; G.audio.setRadio(save.radio); }
    if (save.volume !== undefined) { G.settings.volume = save.volume; G.audio.setVolume(save.volume); }
    if (save.quality) G.settings.quality = save.quality;
    if (save.shards && G.side) for (const id of save.shards) { const pk = G.side.shards[id]; if (pk) pk.got = true; }
    startMission(G, save.mission);
  } else {
    startMission(G, 0);
  }
}
function respawn() {
  const p = G.player;
  p.hp = p.maxHp; p.money = Math.floor(p.money * 0.8);
  p.x = PLACES.hospital.x; p.z = PLACES.hospital.z;
  p.inCar = null; p.ammo = Math.max(p.ammo, 12);
  G.wanted = { stars: 0, points: 0, quietT: 0 };
  G.banner = { text: 'Back on your feet. Nova City is still yours to take.', t: 3 };
  G.state = 'playing';
}
function retryMission() {
  const idx = G.missions ? G.missions.index : 0;
  G.state = 'playing';
  startMission(G, idx);
}
function restartStory() {
  clearSave(G.saveSlot);
  G.reset();
  G.slotSaves = [0, 1, 2].map((s) => !!loadGame(s));
  G.saveExists = G.slotSaves[G.saveSlot];
  startStory();
}
function handleKeys() {
  const input = G.input;
  if (take(input, 'n')) { G.muted = !G.muted; G.audio.setMuted(G.muted); }
  if (G.state === 'title') {
    for (const n of [1, 2, 3]) if (take(input, String(n))) { G.saveSlot = n - 1; G.saveExists = G.slotSaves[n - 1]; }
    if (take(input, 'Enter')) startStory();
    return;
  }
  if (G.state === 'dialog') {
    if (take(input, 'e', 'Enter') || input.mouseClicked) advanceDialog(G);
    return;
  }
  if (G.state === 'shop') {
    if (take(input, 'b', 'Escape')) { G.state = 'playing'; return; }
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      if (take(input, String(n))) buyShopItem(G, n);
    }
    return;
  }
  if (G.state === 'playing') {
    if (take(input, 'p', 'Escape')) { G.state = 'paused'; return; }
    if (take(input, 'm')) { G.state = 'map'; return; }
    if (take(input, 't')) startTrial(G);
    return;
  }
  if (G.state === 'map') {
    if (take(input, 'm', 'Escape')) G.state = 'playing';
    return;
  }
  if (G.state === 'paused') {
    if (take(input, 'p', 'Escape')) G.state = 'playing';
    else if (take(input, 'r')) restartStory();
    else if (take(input, '1')) { G.settings.volume = Math.max(0, G.settings.volume - 0.1); G.audio.setVolume(G.settings.volume); }
    else if (take(input, '2')) { G.settings.volume = Math.min(1, G.settings.volume + 0.1); G.audio.setVolume(G.settings.volume); }
    else if (take(input, '3')) { G.settings.quality = G.settings.quality === 'high' ? 'low' : 'high'; }
    else if (take(input, '4')) { G.settings.radio = G.audio.cycleRadio(); }
    return;
  }
  if (G.state === 'wasted') {
    if (take(input, 'r')) respawn();
    return;
  }
  if (G.state === 'failed') {
    if (take(input, 'r')) retryMission();
    return;
  }
  if (G.state === 'complete') {
    if (take(input, 'Enter')) { G.state = 'playing'; G.missions.objective = 'Free roam — Nova City is yours.'; }
  }
}
function render(G) {
  render3D(G, R);
  hctx.clearRect(0, 0, VIEW.w, VIEW.h);
  if (G.state === 'title') drawTitle(G, hctx);
  else if (G.state === 'paused') drawPaused(G, hctx);
  else if (G.state === 'map') drawMap(G, hctx);
  else if (G.state === 'wasted') drawWasted(G, hctx);
  else if (G.state === 'failed') drawFailed(G, hctx);
  else if (G.state === 'complete') drawComplete(G, hctx);
  else if (G.state === 'playing' || G.state === 'dialog' || G.state === 'shot' || G.state === 'shop') drawHUD(G, hctx);
}
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (G.state === 'playing' || G.state === 'title' || G.state === 'shop') {
    acc += dt;
    while (acc >= STEP) { acc -= STEP; stepPlaying(STEP); }
  }
  handleKeys();
  render(G);
  endFrame(G.input);
}
if (SHOT) {
  const result = stageShot(SHOT, G, (dt) => stepPlaying(dt));
  G.state = 'shot'; G.frozen = true;
  render(G);
  window.__shotReady = true;
  window.__shotScreen = result.screen;
  requestAnimationFrame(function still() { render(G); requestAnimationFrame(still); });
} else {
  requestAnimationFrame(frame);
}
window.NEONRELAY = {
  G, startStory, respawn,
  startMission(i) { startMission(G, i); },
  setTimeOfDay(t) { G.timeOfDay = t; },
  teleport(x, z) { G.player.x = x; G.player.z = z; if (G.player.inCar) { G.player.inCar.x = x; G.player.inCar.z = z; G.player.inCar.speed = 0; } },
  damagePlayer(n) { G.player.invuln = 0; hurtPlayer(G, n, G.player.x + 10, G.player.z); },
  completeMissionNow() { completeMission(G); },
  state() {
    return {
      state: G.state, x: Math.round(G.player.x), z: Math.round(G.player.z),
      hp: G.player.hp, money: G.player.money, ammo: G.player.ammo,
      weapon: G.player.weapon,
      inCar: !!G.player.inCar, vehicle: G.player.inCar ? G.player.inCar.kind : null,
      speed: G.player.inCar ? Math.round(Math.abs(G.player.inCar.speed)) : 0,
      wanted: G.wanted.stars, mission: G.missions ? G.missions.index : -1,
      stage: G.missions ? G.missions.stage : -1, objective: G.missions ? G.missions.objective : '',
      cars: G.cars.length, peds: G.peds.length, bullets: G.bullets.length,
      shards: G.side ? G.side.shards.filter((s) => s.got).length : 0,
      timeOfDay: G.timeOfDay, raining: G.weather.raining,
      garage: G.garage,
    };
  },
};
