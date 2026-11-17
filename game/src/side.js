import { TUNE, RACE_COURSE } from './config.js';
import { dist } from './random.js';
export function initSide(G) {
  const shards = [];
  for (let i = 0; i < TUNE.shardCount; i += 1) {
    shards.push({ id: i, x: 150 + (i * 173) % 2900, z: 150 + ((i * 311) % 2100), got: false });
  }
  G.side = {
    shards,
    trial: { active: false, marker: null, timer: 0, best: null },
  };
}
export function updateSide(G, dt) {
  const p = G.player;
  for (const s of G.side.shards) {
    if (!s.got && dist(p.x, p.z, s.x, s.z) < 55) {
      s.got = true;
      p.money += TUNE.shardPay;
      G.audio.pickup();
      G.banner = { text: `Data shard found! +$${TUNE.shardPay}`, t: 2 };
    }
  }
  const t = G.side.trial;
  if (t.active) {
    t.timer += dt;
    const wp = RACE_COURSE[t.wpi % RACE_COURSE.length];
    if (dist(p.x, p.z, wp.x, wp.z) < 110) {
      t.wpi += 1;
      if (t.wpi >= RACE_COURSE.length) {
        t.active = false;
        const secs = t.timer;
        const par = TUNE.trialPar;
        const win = secs <= par;
        const pay = win ? 400 : 100;
        p.money += pay;
        G.banner = { text: win ? `Time trial beaten! ${secs.toFixed(1)}s (par ${par}s) — +$${pay}` : `Time trial done in ${secs.toFixed(1)}s — +$${pay}`, t: 3 };
        t.best = t.best === null ? secs : Math.min(t.best, secs);
        t.marker = null;
      } else {
        const next = RACE_COURSE[t.wpi % RACE_COURSE.length];
        t.marker = { x: next.x, z: next.z };
      }
    }
    if (t.timer > 300) { t.active = false; t.marker = null; G.banner = { text: 'Time trial abandoned.', t: 2 }; }
  }
}
export function startTrial(G) {
  const t = G.side.trial;
  if (t.active) return;
  t.active = true; t.timer = 0; t.wpi = 1;
  t.marker = { x: RACE_COURSE[1].x, z: RACE_COURSE[1].z };
  G.banner = { text: 'Time trial started — follow the gates, beat 75s!', t: 3 };
}
