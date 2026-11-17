import { STEP } from './config.js';
import { autopilot } from './autopilot.js';
import { startMission, advanceDialog } from './missions.js';
function skipDialog(G) {
  let guard = 0;
  while (G.state === 'dialog' && guard < 10) { advanceDialog(G); guard += 1; }
}
// Drive the real game with the autopilot for up to `seconds`, stopping early
// if the mission advances, the state leaves 'playing', or the player dies,
// so the staged frame is always mid-action, never the next mission.
// Input is cleared on exit so the player does not keep walking after staging.
function driveFor(G, stepFn, seconds, target) {
  const startIdx = G.missions ? G.missions.index : -1;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    autopilot(G, target);
    stepFn(STEP);
    if (G.state !== 'playing') break;
    if (G.missions && G.missions.index !== startIdx) break;
    if (G.player.hp <= 0) break;
  }
  G.input.keys.clear();
  G.input.mouse.down = false;
}
export function stageShot(name, G, stepFn) {
  G.timeOfDay = 0.55;
  if (name === 'hero') {
    // Skyline hero: hypercar on avenue 1600 driving north toward the
    // financial district towers, nitro on, camera behind the car.
    startMission(G, 0);
    skipDialog(G);
    const car = G.cars.find((c) => c.kind === 'vortex');
    if (car) { G.player.x = car.x; G.player.z = car.z; G.player.inCar = car; car.driver = 'player'; car.nitro = 3; }
    G.player.x = 1600; G.player.z = 2000;
    if (G.player.inCar) { G.player.inCar.x = 1600; G.player.inCar.z = 2000; G.player.inCar.angle = -Math.PI / 2; }
    driveFor(G, stepFn, 1, { x: 1600, z: 1100 });
    return { screen: 'playing' };
  }
  if (name === 'race') {
    // Mid-race: Neon Trial, first straight east along street 1900 with
    // nitro, JINX racing behind. 3s keeps the car on the opening straight.
    startMission(G, 2);
    skipDialog(G);
    const car = G.cars.find((c) => c.kind === 'vortex');
    if (car) { G.player.x = car.x; G.player.z = car.z; G.player.inCar = car; car.driver = 'player'; car.nitro = 3; }
    G.player.x = 800; G.player.z = 1900;
    if (G.player.inCar) { G.player.inCar.x = 800; G.player.inCar.z = 1900; G.player.inCar.angle = 0; }
    driveFor(G, stepFn, 2, null);
    return { screen: 'playing' };
  }
  if (name === 'action') {
    // Mid-combat: The Informant, on foot on street 700 west of Neon Row,
    // autopilot firing at the closing Chrome Vipers. The player stands on
    // the open road (backing up stays on the street, so the chase camera
    // never gets pinned against a building), and the gang is toughened for
    // staging so the fight is still live when the frame is taken.
    startMission(G, 3);
    skipDialog(G);
    G.player.x = 2000; G.player.z = 700;
    G.player.ammo = 200;
    for (const ped of G.peds) { if (ped.kind === 'gang') { ped.hp = 300; ped.maxHp = 300; } }
    driveFor(G, stepFn, 2.5, null);
    return { screen: 'playing' };
  }
  G.cameraOverride = { eye: [1600, 500, 2300], target: [1600, 40, 1100] };
  G.timeOfDay = 0.85;
  for (let i = 0; i < 60; i += 1) stepFn(STEP);
  return { screen: 'playing' };
}
