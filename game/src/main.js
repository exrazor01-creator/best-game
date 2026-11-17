// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, level-up, paused, game over and victory.
//
// ?seed=N fixes the waves. ?shot=start|play|levelup|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_LEVELUP, EVENT_OVER, EVENT_VICTORY } from './world.js';
import {
  ACTION_CHOICE_1,
  ACTION_CHOICE_2,
  ACTION_CHOICE_3,
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import {
  SCREEN_LEVELUP,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_VICTORY,
  createRenderer,
  levelUpCardRects,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { x: -1, y: -1 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Read-only handle for automated play tests (and the finalist review).
  window.__voidpulse = {
    world,
    get screen() {
      return screen;
    },
    get best() {
      return best;
    },
  };

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive the waves.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function applyChoice(index) {
    if (world.applyUpgrade(index)) {
      if (world.state.pendingLevelUps > 0) {
        announce(`Level ${world.state.player.level}. Choose another upgrade.`);
      } else {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    const click = input.takeClick();
    if (click) audio.unlock();
    if (actions & ACTION_CONFIRM) audio.unlock();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM || click) startGame();
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_RESTART || actions & ACTION_CONFIRM || click) startGame();
      return;
    }
    if (screen === SCREEN_VICTORY) {
      if (actions & ACTION_RESTART) startGame();
      else if (actions & ACTION_CONFIRM || click) {
        screen = SCREEN_PLAY;
        announce('Playing. Endless mode.');
      }
      return;
    }
    if (screen === SCREEN_LEVELUP) {
      if (actions & ACTION_CHOICE_1) applyChoice(0);
      else if (actions & ACTION_CHOICE_2) applyChoice(1);
      else if (actions & ACTION_CHOICE_3) applyChoice(2);
      else if (click) {
        const rects = levelUpCardRects();
        for (let index = 0; index < rects.length; index += 1) {
          const rect = rects[index];
          if (click.x >= rect.x && click.x <= rect.x + rect.width && click.y >= rect.y && click.y <= rect.y + rect.height) {
            applyChoice(index);
            break;
          }
        }
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM) || click) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) startGame();
      return;
    }
    // SCREEN_PLAY.
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_RESTART) startGame();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    const mouse = input.mouse();
    const move = input.direction();
    const events = world.step(
      STEP,
      { move, aimX: mouse.x, aimY: mouse.y, firing: mouse.down, dashHeld: input.dashHeld() },
      false,
    );
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_VICTORY) {
      screen = SCREEN_VICTORY;
      audio.victory();
      announce(`Arena cleared. Score ${world.state.score}.`);
    } else if (events & EVENT_LEVELUP) {
      screen = SCREEN_LEVELUP;
      announce(`Level ${world.state.player.level}. Choose an upgrade.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, input.mouse());
  }

  // Leaving the tab pauses a running game rather than letting creatures close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('VOIDPULSE. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
