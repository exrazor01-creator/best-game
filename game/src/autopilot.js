import { dist, angleDiff, clamp } from './random.js';
function nearestGang(G) {
  let best = null, bd = 1e9;
  for (const ped of G.peds) {
    if (ped.kind !== 'gang' && ped.kind !== 'boss') continue;
    const d = dist(G.player.x, G.player.z, ped.x, ped.z);
    if (d < bd) { bd = d; best = ped; }
  }
  return best;
}
export function autopilot(G, target) {
  const p = G.player, input = G.input;
  const keys = input.keys;
  keys.delete('w'); keys.delete('a'); keys.delete('s'); keys.delete('d'); keys.delete('Shift');
  const tx = target ? target.x : (G.missions && G.missions.marker ? G.missions.marker.x : p.x + 400);
  const tz = target ? target.z : (G.missions && G.missions.marker ? G.missions.marker.z : p.z);
  const d = dist(p.x, p.z, tx, tz);
  if (p.inCar) {
    const car = p.inCar;
    const want = Math.atan2(tz - p.z, tx - p.x);
    const diff = angleDiff(car.angle, want);
    if (Math.abs(diff) > 0.25) { if (diff > 0) keys.add('d'); else keys.add('a'); }
    keys.add('w');
    if (Math.abs(diff) < 0.2 && car.nitro > 0 && d > 300) keys.add('Shift');
    return;
  }
  const gang = nearestGang(G);
  if (gang) {
    const gd = dist(p.x, p.z, gang.x, gang.z);
    input.mouse.x = 640; input.mouse.y = 400;
    const want = Math.atan2(gang.z - p.z, gang.x - p.x);
    const diff = angleDiff(p.angle, want);
    if (gd > 200) {
      if (Math.abs(diff) > 0.3) { if (diff > 0) keys.add('d'); else keys.add('a'); }
      keys.add('w');
    } else if (gd < 60) {
      keys.add('s');
    }
    input.mouse.down = gd < 480;
    G.aim = { x: gang.x, z: gang.z };
    return;
  }
  input.mouse.down = false;
  if (d < 60) return;
  const want = Math.atan2(tz - p.z, tx - p.x);
  const diff = angleDiff(p.angle, want);
  if (Math.abs(diff) > 0.3) { if (diff > 0) keys.add('d'); else keys.add('a'); }
  keys.add('w');
  if (d > 500) keys.add('Shift');
}
