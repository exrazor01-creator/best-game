import { VIEW, PLACES, VEHICLES, MISSION_COUNT } from './config.js';
import { clamp } from './random.js';
function panel(c, x, y, w, h, a) {
  c.fillStyle = `rgba(8,10,24,${a ?? 0.72})`;
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(0,229,255,0.5)';
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y + 0.5, w, h);
}
function text(c, s, x, y, size, color, align, bold) {
  c.font = `${bold ? '700 ' : ''}${size}px system-ui, sans-serif`;
  c.fillStyle = color;
  c.textAlign = align || 'left';
  c.textBaseline = 'top';
  c.fillText(s, x, y);
}
export function drawHUD(G, c) {
  const p = G.player;
  panel(c, 14, 14, 300, 86, 0.72);
  text(c, 'KAI — RELAY RUNNER', 26, 24, 15, '#00e5ff', 'left', true);
  text(c, G.missions ? `MISSION ${G.missions.index + 1}/${MISSION_COUNT}: ${G.missions.def.title}` : 'FREE ROAM', 26, 46, 13, '#ffd23e', 'left', true);
  text(c, G.missions ? G.missions.objective : 'Nova City is yours.', 26, 66, 12, '#eef1f5');
  if (G.missions && G.missions.timer > 0) text(c, `⏱ ${Math.ceil(G.missions.timer)}s`, 26, 84, 13, '#ff5df2', 'left', true);
  if (G.missions && G.missions.progress > 0) {
    c.fillStyle = '#232744'; c.fillRect(26, 84, 200, 8);
    c.fillStyle = '#00e5ff'; c.fillRect(26, 84, 200 * G.missions.progress, 8);
  }
  panel(c, VIEW.w - 234, 14, 220, 64, 0.72);
  text(c, `$${p.money}`, VIEW.w - 26, 22, 22, '#39ff88', 'right', true);
  text(c, `SHARDS ${G.side ? G.side.shards.filter((s) => s.got).length : 0}/20`, VIEW.w - 26, 50, 12, '#7de8ff', 'right');
  let stars = '';
  for (let i = 0; i < 3; i += 1) stars += i < G.wanted.stars ? '★' : '☆';
  text(c, stars, VIEW.w - 26, 66, 15, '#ff534b', 'right', true);
  const car = p.inCar;
  panel(c, VIEW.w - 264, VIEW.h - 118, 250, 104, 0.72);
  if (car) {
    const kmh = Math.round(Math.abs(car.speed) * 0.32);
    text(c, `${kmh}`, VIEW.w - 36, VIEW.h - 108, 40, '#ffffff', 'right', true);
    text(c, 'km/h', VIEW.w - 36, VIEW.h - 64, 12, '#8b93a3', 'right');
    text(c, VEHICLES[car.kind] ? VEHICLES[car.kind].name : car.kind.toUpperCase(), VIEW.w - 250, VIEW.h - 104, 13, '#00e5ff', 'left', true);
    text(c, `HP ${Math.max(0, Math.round(car.hp))}/${car.maxHp}`, VIEW.w - 250, VIEW.h - 84, 12, car.hp < car.maxHp * 0.4 ? '#ff534b' : '#eef1f5');
    c.fillStyle = '#232744'; c.fillRect(VIEW.w - 250, VIEW.h - 66, 120, 8);
    c.fillStyle = car.nitro > 0 ? '#ff2e88' : '#3a3f47'; c.fillRect(VIEW.w - 250, VIEW.h - 66, 120 * clamp(car.nitro, 0, 1), 8);
    text(c, 'NITRO', VIEW.w - 250, VIEW.h - 52, 11, '#ff2e88', 'left', true);
    text(c, 'SHIFT boost', VIEW.w - 124, VIEW.h - 52, 11, '#8b93a3');
  } else {
    text(c, 'ON FOOT', VIEW.w - 250, VIEW.h - 104, 14, '#00e5ff', 'left', true);
    text(c, 'WASD move · Space dodge', VIEW.w - 250, VIEW.h - 82, 12, '#eef1f5');
    text(c, 'E enter vehicle · Click fire', VIEW.w - 250, VIEW.h - 62, 12, '#eef1f5');
  }
  panel(c, 14, VIEW.h - 118, 250, 104, 0.72);
  text(c, 'HP', 26, VIEW.h - 106, 12, '#eef1f5', 'left', true);
  c.fillStyle = '#232744'; c.fillRect(26, VIEW.h - 88, 226, 12);
  c.fillStyle = p.hp > 50 ? '#39ff88' : p.hp > 25 ? '#ffd23e' : '#ff534b';
  c.fillRect(26, VIEW.h - 88, 226 * clamp(p.hp / p.maxHp, 0, 1), 12);
  text(c, `${Math.round(p.hp)}/${p.maxHp}`, 26, VIEW.h - 70, 12, '#eef1f5');
  if (p.armor > 0) text(c, `ARMOR ${Math.round(p.armor)}`, 26, VIEW.h - 50, 12, '#7de8ff');
  text(c, `${p.weapon.toUpperCase()} · AMMO ${p.ammo}`, 26, VIEW.h - 32, 12, '#ffd23e');
  drawMinimap(G, c);
  if (G.shopNear && G.state === 'playing') {
    text(c, `B — open ${G.shopNear.name}`, VIEW.w / 2, VIEW.h - 140, 14, '#ffd23e', 'center', true);
  }
  if (G.banner) {
    const w = 560;
    panel(c, (VIEW.w - w) / 2, 120, w, 44, 0.85);
    text(c, G.banner.text, VIEW.w / 2, 132, 15, '#ffffff', 'center', true);
  }
  if (G.state === 'dialog' && G.missions) {
    const m = G.missions, line = m.dialog[m.dialogI];
    panel(c, 190, VIEW.h - 210, 900, 96, 0.88);
    text(c, `${line.who}`, 210, VIEW.h - 200, 14, line.who === 'Kai' ? '#00e5ff' : '#ff2e88', 'left', true);
    text(c, line.text, 210, VIEW.h - 176, 15, '#eef1f5');
    text(c, 'E / Enter / Click — continue', 1070, VIEW.h - 140, 12, '#8b93a3', 'right');
  }
  if (G.state === 'shop' && G.shopNear) drawShop(G, c);
  if (p.hurtT > 0) {
    c.fillStyle = `rgba(255,40,60,${p.hurtT * 0.5})`;
    c.fillRect(0, 0, VIEW.w, VIEW.h);
  }
}
function drawMinimap(G, c) {
  const s = 150, x0 = 14, y0 = VIEW.h - 290;
  panel(c, x0 - 4, y0 - 4, s + 8, s + 8, 0.72);
  c.save();
  c.beginPath(); c.rect(x0, y0, s, s); c.clip();
  c.fillStyle = '#0b0d1a'; c.fillRect(x0, y0, s, s);
  const k = s / 3200;
  c.fillStyle = '#232744';
  for (const a of [400, 800, 1200, 1600, 2000, 2400, 2800]) c.fillRect(x0 + a * k - 2, y0, 4, s);
  for (const st of [300, 700, 1100, 1500, 1900]) c.fillRect(x0, y0 + st * k - 2, s, 4);
  for (const [key, pl] of Object.entries(G.places)) {
    c.fillStyle = key === 'garage' ? '#ffd23e' : '#00e5ff';
    c.fillRect(x0 + pl.x * k - 3, y0 + pl.z * k - 3, 6, 6);
  }
  if (G.missions && G.missions.marker) {
    c.fillStyle = '#ff2e88';
    const mx = x0 + G.missions.marker.x * k, mz = y0 + G.missions.marker.z * k;
    c.beginPath(); c.arc(mx, mz, 5, 0, 6.29); c.fill();
  }
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(x0 + G.player.x * k, y0 + G.player.z * k, 4, 0, 6.29); c.fill();
  c.restore();
  text(c, 'NOVA CITY', x0, y0 + s + 8, 11, '#8b93a3');
}
function drawShop(G, c) {
  const shop = G.shopNear;
  panel(c, 340, 150, 600, 420, 0.94);
  text(c, shop.name, 640, 170, 22, '#00e5ff', 'center', true);
  const lines = shop.kind === 'ammo'
    ? ['1 — Ammo +24 — $40', '2 — Full repair (HP) — $60', '3 — Armor +50 — $120', '4 — Pulse Rifle — $600', '5 — Rail Sniper — $900', '6 — Shock Bat — $150']
    : shop.kind === 'repair'
      ? ['1 — Repair vehicle — $100', '2 — Nitro tank — $150', '3 — Engine tune +60 — $800']
      : ['1 — STREETHWAWK — $1500', '2 — NEON BIKE — $1200', '3 — IRONCLAD — $2200', '4 — VOLT SPARK — $2600', '5 — DRIFT KING — $1800', '6 — HAULER — $1400', '7 — AERO CAB — $2000', '8 — VORTEX GT — owned'];
  lines.forEach((l, i) => text(c, l, 380, 220 + i * 34, 16, '#eef1f5'));
  text(c, `Credits: $${G.player.money} — press the number key to buy, B to leave`, 640, 540, 13, '#ffd23e', 'center');
}
export function drawTitle(G, c) {
  c.fillStyle = 'rgba(5,6,16,0.55)'; c.fillRect(0, 0, VIEW.w, VIEW.h);
  text(c, 'NEON RELAY', VIEW.w / 2, 150, 72, '#ff2e88', 'center', true);
  text(c, 'LAST LIGHT', VIEW.w / 2, 232, 44, '#00e5ff', 'center', true);
  text(c, 'Nova City is going dark. You are the last courier who can bring the light back.', VIEW.w / 2, 300, 16, '#eef1f5', 'center');
  text(c, '3D cyberpunk open-world racing · 12 story missions · 8 vehicles · boss races', VIEW.w / 2, 326, 13, '#8b93a3', 'center');
  const y = 400;
  text(c, 'ENTER — New Game / Continue', VIEW.w / 2, y, 18, '#ffffff', 'center', true);
  text(c, '1 / 2 / 3 — Save slot', VIEW.w / 2, y + 36, 14, '#8b93a3', 'center');
  const saves = G.slotSaves.map((s, i) => `Slot ${i + 1}: ${s ? '✓ saved' : '— empty'}`).join('    ');
  text(c, saves, VIEW.w / 2, y + 62, 13, '#ffd23e', 'center');
  text(c, 'WASD move · Mouse aim · Click fire · E enter car · Shift nitro · P pause · M map', VIEW.w / 2, VIEW.h - 60, 13, '#8b93a3', 'center');
  text(c, 'Q weapon · R reload · F punch · B shop · G garage', VIEW.w / 2, VIEW.h - 36, 13, '#8b93a3', 'center');
}
export function drawPaused(G, c) {
  c.fillStyle = 'rgba(5,6,16,0.7)'; c.fillRect(0, 0, VIEW.w, VIEW.h);
  text(c, 'PAUSED', VIEW.w / 2, 220, 44, '#00e5ff', 'center', true);
  text(c, 'P / Esc — resume', VIEW.w / 2, 300, 16, '#ffffff', 'center');
  text(c, 'R — restart story (clears this save slot)', VIEW.w / 2, 330, 16, '#ffffff', 'center');
  text(c, '1 / 2 — volume down / up', VIEW.w / 2, 360, 14, '#8b93a3', 'center');
  text(c, '3 — quality high / low', VIEW.w / 2, 384, 14, '#8b93a3', 'center');
  text(c, '4 — radio station', VIEW.w / 2, 408, 14, '#8b93a3', 'center');
  text(c, `Volume ${Math.round(G.settings.volume * 100)}% · Quality ${G.settings.quality} · Radio ${['Pulse FM', 'Bay Rock', 'Coast Jazz'][G.settings.radio]}`, VIEW.w / 2, 440, 14, '#ffd23e', 'center');
}
export function drawWasted(G, c) {
  c.fillStyle = 'rgba(20,4,10,0.78)'; c.fillRect(0, 0, VIEW.w, VIEW.h);
  text(c, 'FLATLINED', VIEW.w / 2, 260, 52, '#ff534b', 'center', true);
  text(c, 'Nova City does not wait for the dead. But the Relay always comes back.', VIEW.w / 2, 330, 16, '#eef1f5', 'center');
  text(c, 'R — respawn (keep 80% of your credits)', VIEW.w / 2, 380, 16, '#ffffff', 'center', true);
}
export function drawComplete(G, c) {
  c.fillStyle = 'rgba(5,16,10,0.72)'; c.fillRect(0, 0, VIEW.w, VIEW.h);
  text(c, 'LAST LIGHT', VIEW.w / 2, 200, 56, '#39ff88', 'center', true);
  text(c, 'The kill-switch is dead. The grid breathes again. Nova City is yours, Kai.', VIEW.w / 2, 280, 17, '#eef1f5', 'center');
  text(c, `Missions: ${G.stats.missionsDone}/12 · Earned: $${G.stats.earned} · Kills: ${G.stats.kills}`, VIEW.w / 2, 330, 15, '#ffd23e', 'center');
  text(c, 'ENTER — free roam the city', VIEW.w / 2, 390, 16, '#ffffff', 'center', true);
}
export function drawFailed(G, c) {
  c.fillStyle = 'rgba(20,4,10,0.78)'; c.fillRect(0, 0, VIEW.w, VIEW.h);
  text(c, 'MISSION FAILED', VIEW.w / 2, 250, 46, '#ff534b', 'center', true);
  text(c, G.failReason || 'Try again.', VIEW.w / 2, 320, 16, '#eef1f5', 'center');
  text(c, 'R — retry this mission', VIEW.w / 2, 370, 16, '#ffffff', 'center', true);
}
export function drawMap(G, c) {
  c.fillStyle = 'rgba(5,6,16,0.85)'; c.fillRect(0, 0, VIEW.w, VIEW.h);
  text(c, 'NOVA CITY', VIEW.w / 2, 60, 30, '#00e5ff', 'center', true);
  const s = 560, x0 = (VIEW.w - s) / 2, y0 = 110;
  const k = s / 3200;
  c.fillStyle = '#0b0d1a'; c.fillRect(x0, y0, s, s * 0.75);
  c.fillStyle = '#232744';
  for (const a of [400, 800, 1200, 1600, 2000, 2400, 2800]) c.fillRect(x0 + a * k - 2, y0, 4, s * 0.75);
  for (const st of [300, 700, 1100, 1500, 1900]) c.fillRect(x0, y0 + st * k - 2, s, 4);
  for (const [key, pl] of Object.entries(G.places)) {
    c.fillStyle = '#00e5ff';
    c.beginPath(); c.arc(x0 + pl.x * k, y0 + pl.z * k, 5, 0, 6.29); c.fill();
    text(c, pl.name, x0 + pl.x * k + 8, y0 + pl.z * k - 6, 12, '#eef1f5');
  }
  if (G.missions && G.missions.marker) {
    c.fillStyle = '#ff2e88';
    c.beginPath(); c.arc(x0 + G.missions.marker.x * k, y0 + G.missions.marker.z * k, 7, 0, 6.29); c.fill();
  }
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(x0 + G.player.x * k, y0 + G.player.z * k, 6, 0, 6.29); c.fill();
  text(c, 'M — close map', VIEW.w / 2, VIEW.h - 60, 14, '#8b93a3', 'center');
}
