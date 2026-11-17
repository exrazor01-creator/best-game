import { PLACES, MISSION_REWARDS, RACE_COURSE, ARENA_COURSE } from './config.js';
import { dist } from './random.js';
import { spawnCar, spawnRival } from './traffic.js';
import { addWanted } from './police.js';
import { saveGame } from './save.js';
const D = (who, text) => ({ who, text });
function goto(G, x, z, r) { return dist(G.player.x, G.player.z, x, z) < r; }
function setMarker(G, x, z, label) { G.missions.marker = { x, z, label }; }
function startRace(G, course, laps, rivals) {
  G.race = { waypoints: course, laps, playerWpi: 1, playerLap: 0, finished: 0, playerDone: false, timer: 0 };
  G.rivals = [];
  for (const r of rivals) spawnRival(G, course, laps, r.top, r.color, r.name);
  setMarker(G, course[1].x, course[1].z, 'Next gate');
}
function updateRace(G, dt) {
  const race = G.race;
  if (!race || race.playerDone) return;
  race.timer += dt;
  const wp = race.waypoints[race.playerWpi % race.waypoints.length];
  if (goto(G, wp.x, wp.z, 110)) {
    race.playerWpi += 1;
    if (race.playerWpi >= race.waypoints.length) { race.playerWpi = 0; race.playerLap += 1; }
    const next = race.waypoints[race.playerWpi % race.waypoints.length];
    setMarker(G, next.x, next.z, `Gate ${race.playerWpi + 1} — Lap ${race.playerLap + 1}/${race.laps}`);
    G.audio.pickup();
  }
  if (race.playerLap >= race.laps) {
    race.playerDone = true;
    const place = race.finished + 1;
    if (place === 1) { G.banner = { text: 'You won the race!', t: 3 }; completeMission(G); }
    else { G.banner = { text: `You finished ${place}${place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'} — the rivals took it.`, t: 3 }; failMission(G, 'The rivals beat you to the line. Retry the race.'); }
  } else if (race.finished >= (G.rivals || []).length && (G.rivals || []).length > 0 && race.playerLap < race.laps - 0) {
    if (race.finished >= (G.rivals || []).length) failMission(G, 'Every rival finished ahead of you. Retry the race.');
  }
}
export const MISSIONS = [
  {
    title: 'First Light', giver: 'Rook',
    intro: [D('Rook', 'Nova City eats couriers alive, kid. But you? You drive like the night itself.'), D('Rook', 'First job: jack any car — E to get in — and bring it to my garage. No questions.'), D('Kai', 'Jack a car. Got it. What could go wrong?')],
    setup(G) { setMarker(G, PLACES.garage.x, PLACES.garage.z, 'Rook\'s Garage'); G.missions.objective = 'Jack a car (E) and bring it to the garage'; },
    update(G) {
      const m = G.missions;
      if (m.stage === 0 && G.player.inCar) { m.stage = 1; m.objective = 'Drive the car to the garage'; }
      else if (m.stage === 1 && goto(G, PLACES.garage.x, PLACES.garage.z, 120)) completeMission(G);
    },
  },
  {
    title: 'Relay Run', giver: 'Rook',
    intro: [D('Rook', 'Three data packets. Three drop points. One hundred seconds. The corps scan every street.'), D('Rook', 'Neon Row, the Port, then the Arena. Do not stop for anyone.'), D('Kai', 'One hundred seconds across Nova City? I drive fast.')],
    setup(G) {
      G.missions.data.legs = [{ x: PLACES.neon.x, z: PLACES.neon.z, name: 'Neon Row' }, { x: PLACES.port.x, z: PLACES.port.z, name: 'The Port' }, { x: PLACES.arena.x, z: PLACES.arena.z, name: 'Neon Arena' }];
      G.missions.data.leg = 0;
      const leg = G.missions.data.legs[0];
      setMarker(G, leg.x, leg.z, leg.name);
      G.missions.objective = 'Get a car, then deliver packet 1 to Neon Row';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      const legs = m.data.legs, leg = legs[m.data.leg];
      if (m.stage === 0 && p.inCar && goto(G, leg.x, leg.z, 90)) {
        m.stage = 1; m.timer = 100; m.objective = `Packet 1 aboard! Deliver to ${leg.name} (100s)`;
        setMarker(G, leg.x, leg.z, leg.name); G.audio.pickup();
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (goto(G, leg.x, leg.z, 110)) {
          m.data.leg += 1;
          if (m.data.leg >= legs.length) { completeMission(G); return; }
          m.stage = 0;
          const next = legs[m.data.leg];
          setMarker(G, next.x, next.z, next.name);
          m.objective = `Packet ${m.data.leg + 1} waiting — pick it up at ${next.name}`;
          G.audio.cash();
        } else if (m.timer <= 0) failMission(G, 'Too slow — the buyer walked. The packets are back at the start.');
      }
    },
  },
  {
    title: 'Neon Trial', giver: 'Rook',
    intro: [D('Rook', 'One rival. One lap around the city. Beat him and the underground starts to know your name.'), D('Rook', 'Follow the gates. Nitro on the straights. Do not bin it.'), D('Kai', 'One lap. One rival. Easy.')],
    setup(G) {
      startRace(G, RACE_COURSE, 1, [{ name: 'JINX', color: '#ff2e88', top: 700 }]);
      G.missions.objective = 'Win the 1-lap race against JINX — follow the gates';
    },
    update(G, dt) { updateRace(G, dt); },
  },
  {
    title: 'The Informant', giver: 'Mira',
    intro: [D('Mira', 'My informant is pinned down in Neon Row by the Chrome Vipers. Three of them.'), D('Mira', 'Go on foot. Blaster or fists — your call. Get him out.'), D('Kai', 'Three Vipers. I will send them a message.')],
    setup(G) {
      const gang = [];
      for (const [gx, gz] of [[PLACES.neon.x - 60, PLACES.neon.z + 40], [PLACES.neon.x + 60, PLACES.neon.z - 40], [PLACES.neon.x, PLACES.neon.z + 80]]) {
        const ped = { x: gx, z: gz, angle: 0, speed: 0, kind: 'gang', hp: 100, tx: gx, tz: gz, waitT: 99, fleeT: 0, color: '#e74c3c', seed: G.rng(), shootCd: 1, punchCd: 0 };
        G.peds.push(ped); gang.push(ped);
      }
      G.missions.data.gang = gang;
      setMarker(G, PLACES.neon.x, PLACES.neon.z, 'Neon Row — Informant');
      G.missions.objective = 'Defeat the 3 Chrome Vipers in Neon Row';
    },
    update(G) {
      const m = G.missions;
      const alive = m.data.gang.filter((g) => G.peds.includes(g));
      if (alive.length === 0) completeMission(G);
      else m.objective = `Defeat the Chrome Vipers — ${alive.length} left`;
    },
  },
  {
    title: 'Midnight Circuit', giver: 'Rook',
    intro: [D('Rook', 'The Midnight Circuit. Two laps, three rivals, the whole city watching.'), D('Rook', 'Win this and you are not a courier anymore. You are a legend.'), D('Kai', 'Two laps. Let us make them remember.')],
    setup(G) {
      startRace(G, RACE_COURSE, 2, [
        { name: 'JINX', color: '#ff2e88', top: 720 },
        { name: 'GHOST', color: '#00e5ff', top: 740 },
        { name: 'NITRO', color: '#ffd23e', top: 700 },
      ]);
      G.missions.objective = 'Win the 2-lap Midnight Circuit — follow the gates';
    },
    update(G, dt) { updateRace(G, dt); },
  },
  {
    title: 'Data Heist', giver: 'Mira',
    intro: [D('Mira', 'Omnidyne stashed five data shards in the Port. They prove the blackout was deliberate.'), D('Mira', 'Grab all five. The docks are crawling with their security.'), D('Kai', 'Five shards. One truth. Let us go.')],
    setup(G) {
      const pts = [];
      for (let i = 0; i < 5; i += 1) pts.push({ x: 200 + i * 140, z: 1750 + (i % 2) * 220, got: false });
      G.missions.data.shards = pts;
      G.missions.objective = 'Collect the 5 data shards in the Port (0/5)';
      setMarker(G, pts[0].x, pts[0].z, 'Data Shard 1');
    },
    update(G) {
      const m = G.missions;
      let got = 0;
      for (const s of m.data.shards) {
        if (!s.got && goto(G, s.x, s.z, 55)) { s.got = true; G.audio.pickup(); G.player.money += 50; }
        if (s.got) got += 1;
      }
      const next = m.data.shards.find((s) => !s.got);
      if (next) setMarker(G, next.x, next.z, 'Data Shard');
      m.objective = `Collect the 5 data shards in the Port (${got}/5)`;
      if (got >= 5) completeMission(G);
    },
  },
  {
    title: 'Tunnel Run', giver: 'Rook',
    intro: [D('Rook', 'The Underpass is the only road the corp cameras do not watch. Seventy-five seconds, end to end.'), D('Rook', 'Through the tunnel, out the far side, to the Arena. Floor it.'), D('Kai', 'Seventy-five seconds in the dark. Fine.')],
    setup(G) {
      setMarker(G, PLACES.tunnel.x, PLACES.tunnel.z, 'The Underpass');
      G.missions.objective = 'Get a car and reach the Underpass';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && p.inCar && goto(G, PLACES.tunnel.x, PLACES.tunnel.z, 110)) {
        m.stage = 1; m.timer = 75; m.objective = 'Through the tunnel! Reach the Neon Arena (75s)';
        setMarker(G, PLACES.arena.x, PLACES.arena.z, 'Neon Arena'); G.audio.pickup();
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (goto(G, PLACES.arena.x, PLACES.arena.z, 130)) completeMission(G);
        else if (m.timer <= 0) failMission(G, 'Too slow in the tunnel — the window closed. Run it again.');
      }
    },
  },
  {
    title: 'Gang War', giver: 'Mira',
    intro: [D('Mira', 'BRUTUS runs the Vipers from the Port. Six of his crew, plus the big man himself.'), D('Mira', 'Take them all down. The Port belongs to the Relay after tonight.'), D('Kai', 'Six crew and a boss. Bring it on.')],
    setup(G) {
      const gang = [];
      for (let i = 0; i < 6; i += 1) {
        const ped = { x: 300 + i * 90, z: 1800 + (i % 2) * 120, angle: 0, speed: 0, kind: 'gang', hp: 120, tx: 0, tz: 0, waitT: 99, fleeT: 0, color: '#e74c3c', seed: G.rng(), shootCd: 1, punchCd: 0 };
        G.peds.push(ped); gang.push(ped);
      }
      const boss = { x: 650, z: 1950, angle: 0, speed: 0, kind: 'boss', hp: 420, tx: 0, tz: 0, waitT: 99, fleeT: 0, color: '#8e44ad', seed: G.rng(), shootCd: 1, punchCd: 0, name: 'BRUTUS' };
      G.peds.push(boss); gang.push(boss);
      G.missions.data.gang = gang;
      setMarker(G, 650, 1950, 'BRUTUS — The Port');
      G.missions.objective = 'Defeat BRUTUS and his 6 crew in the Port';
    },
    update(G) {
      const m = G.missions;
      const alive = m.data.gang.filter((g) => G.peds.includes(g));
      if (alive.length === 0) completeMission(G);
      else m.objective = `Defeat BRUTUS and his crew — ${alive.length} left`;
    },
  },
  {
    title: 'Mountain Pass', giver: 'Rook',
    intro: [D('Rook', 'Skyline Pass. The mountain road above the city. Seventy-five seconds, top to bottom.'), D('Rook', 'One run. No mistakes. The mountain does not forgive.'), D('Kai', 'Seventy-five seconds down a mountain. Let us fly.')],
    setup(G) {
      setMarker(G, PLACES.mountain.x, PLACES.mountain.z, 'Skyline Pass');
      G.missions.objective = 'Get a car and reach Skyline Pass';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && p.inCar && goto(G, PLACES.mountain.x, PLACES.mountain.z, 130)) {
        m.stage = 1; m.timer = 75; m.objective = 'Down the mountain! Reach the Hideout (75s)';
        setMarker(G, PLACES.hideout.x, PLACES.hideout.z, 'The Relay Hideout'); G.audio.pickup();
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (goto(G, PLACES.hideout.x, PLACES.hideout.z, 130)) completeMission(G);
        else if (m.timer <= 0) failMission(G, 'The mountain beat you. Run the pass again.');
      }
    },
  },
  {
    title: 'Heat Wave', giver: 'Mira',
    intro: [D('Mira', 'Nova PD is all over you. Three stars, Kai. That is not a compliment.'), D('Mira', 'Lay low. Break line of sight. When the heat drops to nothing, come see me.'), D('Kai', 'Lose three stars. In this town? Challenge accepted.')],
    setup(G) {
      addWanted(G, 9, 'The whole force is looking for you');
      G.missions.objective = 'Lose the wanted level — stay out of sight until the stars are gone';
      G.missions.marker = null;
    },
    update(G) { if (G.wanted.stars === 0) completeMission(G); },
  },
  {
    title: 'Boss Race', giver: 'VEX',
    intro: [D('VEX', 'So the little courier made it this far. Cute.'), D('VEX', 'Three laps around my city. Beat me, and the Spire opens its doors. Lose, and you are done.'), D('Kai', 'Three laps. Your city ends tonight, VEX.')],
    setup(G) {
      startRace(G, RACE_COURSE, 3, [{ name: 'VEX', color: '#b26bff', top: 860 }]);
      G.missions.objective = 'Beat VEX in the 3-lap Boss Race — follow the gates';
    },
    update(G, dt) { updateRace(G, dt); },
  },
  {
    title: 'Last Light', giver: 'Mira',
    intro: [D('Mira', 'This is it. The Omnidyne Lab holds the kill-switch for the whole blackout.'), D('Mira', 'Get inside, hold the core until the light is yours, then deal with OMEGA-9 — and drive to the Arena. The city is watching.'), D('Kai', 'One last run. For the city. For the light.')],
    setup(G) {
      setMarker(G, PLACES.lab.x, PLACES.lab.z, 'Omnidyne Lab');
      G.missions.objective = 'Get to the Omnidyne Lab';
    },
    update(G, dt) {
      const m = G.missions, p = G.player;
      if (m.stage === 0 && goto(G, PLACES.lab.x, PLACES.lab.z, 130)) {
        m.stage = 1; m.progress = 0; m.objective = 'Hold E at the core to crack it';
      } else if (m.stage === 1) {
        const near = goto(G, PLACES.lab.x, PLACES.lab.z, 130);
        if (near && G.input.keys.has('e')) {
          m.progress += dt / 6;
          if (m.progress >= 1) {
            m.stage = 2;
            const boss = { x: PLACES.lab.x + 60, z: PLACES.lab.z, angle: 0, speed: 0, kind: 'boss', hp: 500, tx: 0, tz: 0, waitT: 99, fleeT: 0, color: '#ff2e88', seed: G.rng(), shootCd: 0.5, punchCd: 0, name: 'OMEGA-9' };
            G.peds.push(boss); m.data.boss = boss;
            addWanted(G, 8, 'LAB BREACH — every unit in Nova City is coming');
            m.objective = 'OMEGA-9 is live! Take it down';
            setMarker(G, boss.x, boss.z, 'OMEGA-9');
            G.audio.cash();
          }
        } else m.progress = Math.max(0, m.progress - dt / 2);
      } else if (m.stage === 2) {
        if (!G.peds.includes(m.data.boss)) {
          m.stage = 3; m.objective = 'Core cracked, OMEGA-9 down! Drive to the Neon Arena';
          setMarker(G, PLACES.arena.x, PLACES.arena.z, 'Neon Arena');
        }
      } else if (m.stage === 3 && goto(G, PLACES.arena.x, PLACES.arena.z, 140)) {
        completeMission(G);
      }
    },
  },
];
export function startMission(G, index) {
  const def = MISSIONS[index];
  G.missions = { index, def, stage: 0, timer: 0, progress: 0, objective: '', marker: null, data: {}, dialog: def.intro, dialogI: 0 };
  def.setup(G);
  G.state = 'dialog';
}
export function advanceDialog(G) {
  const m = G.missions;
  m.dialogI += 1;
  if (m.dialogI >= m.dialog.length) G.state = 'playing';
}
export function completeMission(G) {
  const m = G.missions;
  const reward = MISSION_REWARDS[m.index] || 500;
  G.player.money += reward;
  G.stats.missionsDone += 1;
  G.stats.earned += reward;
  G.audio.cash();
  G.banner = { text: `Mission complete: ${m.def.title} — +$${reward}`, t: 4 };
  G.rivals = [];
  G.race = null;
  saveGame(G, G.saveSlot);
  if (m.index + 1 >= MISSIONS.length) {
    G.state = 'complete';
    G.audio.victory();
  } else {
    startMission(G, m.index + 1);
  }
}
export function failMission(G, why) {
  G.rivals = [];
  G.race = null;
  G.state = 'failed';
  G.failReason = why;
  G.audio.gameOver();
}
export function updateMissions(G, dt) {
  const m = G.missions;
  if (!m || G.state !== 'playing') return;
  if (m.timer > 0 && m.def.update.length < 2) { /* timers handled inside update */ }
  m.def.update(G, dt);
}
