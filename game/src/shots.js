// The screenshot scenes behind ?shot=start|play|levelup|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by the autopilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame.

import { PLAY_BOTTOM, PLAY_TOP, STEP } from './config.js';
import { EVENT_LEVELUP, EVENT_OVER, EVENT_VICTORY } from './world.js';
import { autopilot } from './autopilot.js';
import {
  SCREEN_LEVELUP,
  SCREEN_OVER,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_VICTORY,
} from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 32;
const LEVELUP_LIMIT_SECONDS = 90;
const END_LIMIT_SECONDS = 600;
const SAMPLE = STEP;

/**
 * Set `world` to the named scene (start, play, levelup or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'levelup' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / SAMPLE; index += 1) {
      world.step(SAMPLE, null, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  const careful = name !== 'end';
  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'levelup' ? LEVELUP_LIMIT_SECONDS : PLAY_SECONDS;
  let screen = SCREEN_PLAY;
  for (let index = 0; index < limit / SAMPLE; index += 1) {
    const input = autopilot(world.state, careful);
    const events = world.step(SAMPLE, input, false);
    if (events & EVENT_OVER) {
      screen = SCREEN_OVER;
      break;
    }
    if (name === 'levelup' && events & EVENT_LEVELUP) {
      screen = SCREEN_LEVELUP;
      break;
    }
    if (events & EVENT_VICTORY) {
      screen = SCREEN_VICTORY;
      break;
    }
    if (name === 'play' && world.state.pendingLevelUps > 0) {
      // A level-up would pause real play; for the play scene, take the first
      // card and keep going so the frame stays mid-action.
      world.applyUpgrade(0);
    }
  }
  if (name === 'play' && screen === SCREEN_PLAY) {
    // Hunt for a busy mid-wave frame: skip wave banners and breathers.
    for (let index = 0; index < 10 / SAMPLE; index += 1) {
      const s = world.state;
      const activeEnemies = s.enemies.filter((e) => e.active).length;
      const p = s.player;
      const framed = p.x > 180 && p.x < 1100 && p.y > PLAY_TOP + 60 && p.y < PLAY_BOTTOM - 60;
      if (s.waveBanner <= 0 && !s.betweenWaves && activeEnemies >= 5 && framed) break;
      const input = autopilot(s, careful);
      const events = world.step(SAMPLE, input, false);
      if (events & EVENT_OVER) {
        screen = SCREEN_OVER;
        break;
      }
      if (s.pendingLevelUps > 0) world.applyUpgrade(0);
    }
  }
  const best = world.state.score;
  return { screen, best };
}
