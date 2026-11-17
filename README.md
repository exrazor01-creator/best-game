[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/exrazor01-creator/neon-relay/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/exrazor01-creator/neon-relay/reward.svg)](https://make.fun/bounty/best-game-01)

# NEON RELAY: LAST LIGHT

A 3D cyberpunk open-world racing / action game for the [make.fun best game bounty](https://make.fun/bounty/best-game-01). Nova City is going dark — Omnidyne Corp is killing the grid district by district. You are Kai, the last underground courier who can bring the light back: race, fight, and outrun the whole city across 12 story missions, 8 vehicles, and a final boss.

Play it here: https://make.fun/bounty/best-game-01 — built by @exrazoor. My referral: https://make.fun/r/9taf1vak

## How to play

Run it locally (Node 22, no build step, no network):

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

- **Move** — WASD · **Sprint** — Shift · **Dodge** — Space
- **Aim** — mouse · **Fire** — click (blaster) · **Punch** — F (close range)
- **Enter / exit vehicle** — E · **Nitro** — Shift (in a car)
- **Weapon** — Q cycle · **Reload** — R · **Shop** — B (near a shop)
- **Map** — M · **Time trial** — T · **Pause** — P or Esc · **Mute** — N

## The loop

- **12 story missions** with dialogue, objectives, timers, and rewards: jack your first car, run data packets, win checkpoint races against rival racers, fight the Chrome Vipers, steal shards from the Port, survive police heat, beat the boss racer VEX, and crack the Omnidyne Lab core before facing OMEGA-9 in the finale.
- **8 vehicles** — VORTEX GT hypercar, STREETHWAWK, NEON BIKE, IRONCLAD, VOLT SPARK, DRIFT KING, HAULER, AERO CAB — each with its own speed, acceleration, handling, and armor. Buy them at Rook's Garage, tune engines, fit nitro tanks.
- **Open city** — financial district, Neon Row, the Port, residential streets, a highway ring, Skyline Pass, the Underpass tunnel, and the Neon Arena. Traffic, pedestrians, police patrols, and a 3-star wanted system that hunts you down.
- **Combat** — blaster, pulse rifle, rail sniper, shock bat; gang AI that chases and shoots; two boss fights (BRUTUS, OMEGA-9).
- **Economy** — earn credits from missions, races, time trials, and 20 hidden data shards; spend them on weapons, armor, repairs, and vehicles.
- **Save** — 3 localStorage slots, autosave every minute and after every mission.

## Tech

- Hand-written raw WebGL 3D engine (no library): one vertex-color shader with directional light, fog, and emissive neon; immediate-mode boxes, cylinders, and quads; chase camera with building avoidance and screen shake.
- Everything is drawn and synthesized in code: neon city, wet reflective streets, rain, lightning, flying traffic, particles, skid marks, and procedural WebAudio (engine, nitro, shots, thunder, synthwave radio).
- Fully offline: zero network requests, zero external assets. Desktop Chrome.

## Layout

- `game/index.html` — page, WebGL canvas, HUD canvas
- `game/src/config.js` — tuning, palette, vehicles, places, missions list
- `game/src/random.js` — seeded random numbers
- `game/src/gl.js` — the raw WebGL renderer (matrices, shader, primitives)
- `game/src/world.js` — Nova City generation (districts, buildings, tunnel, arena)
- `game/src/render3d.js` — the 3D scene: city, vehicles, neon, weather, effects
- `game/src/player.js` — on-foot movement, driving input, weapons, shops
- `game/src/traffic.js` — traffic AI, pedestrians, rival racers
- `game/src/police.js` — wanted stars and police pursuit
- `game/src/combat.js` — bullets, particles, damage, explosions
- `game/src/missions.js` — the 12-mission story (dialogue, steps, races, bosses)
- `game/src/side.js` — data shards and time trials
- `game/src/audio.js` — procedural WebAudio sound and music
- `game/src/input.js` — keyboard and mouse
- `game/src/hud.js` — HUD, minimap, menus, title, pause, results
- `game/src/autopilot.js` — a pilot that plays for the screenshots
- `game/src/shots.js` — the staged scenes behind `?shot=hero|race|action|world`
- `game/src/save.js` — localStorage saves (3 slots)
- `game/src/main.js` — boot, the fixed-step loop, and state machine
- `main.ts` — builds `/output/dossier.json` from `game/` and `screenshots/`
- `screenshots/` — 4 screenshots of the real game (hero, race, action, world)
