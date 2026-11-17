[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/exrazor01-creator/best-game/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/exrazor01-creator/best-game/reward.svg)](https://make.fun/bounty/best-game-01)

# VOIDPULSE — Neon Arena Roguelite

A fast arena survival roguelite for the [make.fun best game bounty](https://make.fun/bounty/best-game-01). You are the last pulse of light in a collapsing void arena: dodge, aim, and blast waves of void creatures, collect their shards, and pick upgrades every level until you clear wave 10 — or the void takes you.

## How to play

Run it locally (Node 22, no build step, no network):

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

- **Move** — WASD or arrow keys
- **Aim** — mouse; **shoot** — hold the left mouse button
- **Dash** — Space (brief invulnerability, short cooldown)
- **Pause** — P or Esc; **restart** — R; **mute** — M
- **Level up** — pick 1 of 3 upgrades with a click or keys 1 / 2 / 3

## The loop

- Waves of void creatures spawn from the arena edges and grow faster, tougher and stranger every wave: Drifters chase you, Bulwarks soak damage, Splitters burst into Mites, Stingers shoot back, and every 5th wave an Elite guards the field.
- Kills drop shards. Collect enough to level up and choose an upgrade: damage, fire rate, multishot, pierce, speed, magnet, dash, crit, max hull, or a Nova pulse.
- Kills in quick succession build a combo multiplier for score. Clear wave 10 to win the arena — then keep going in endless mode, or restart and beat your best score.

Everything is drawn in code (no image or sound assets): neon vector art, particles, screen shake, floating damage numbers, and synthesized WebAudio sound effects.

## Layout

- `game/index.html` — page and canvas
- `game/src/config.js` — tuning numbers and palette
- `game/src/random.js` — seeded random numbers
- `game/src/audio.js` — synthesized sound effects
- `game/src/input.js` — keyboard and mouse
- `game/src/entities.js` — player, enemies, bullets, shards, particles
- `game/src/upgrades.js` — the level-up upgrade pool
- `game/src/world.js` — waves, spawning, collisions, score, combo
- `game/src/render.js` — drawing the arena, HUD and menus
- `game/src/autopilot.js` — a pilot that plays for the screenshots
- `game/src/shots.js` — the staged scenes behind `?shot=start|play|levelup|end`
- `game/src/main.js` — boot and the game loop
- `main.ts` — builds `/output/dossier.json` from `game/` and `screenshots/`
- `screenshots/` — 4 screenshots of the real game (title, play, level-up, game over)
