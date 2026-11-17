// Every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** Playfield vertical bounds: the HUD strip (top) and dash/hint line (bottom). */
export const PLAY_TOP = 80;
export const PLAY_BOTTOM = 688;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The wave whose clear wins the arena (endless mode continues past it). */
export const VICTORY_WAVE = 10;

export const PLAYER = {
  radius: 14,
  speed: 320,
  maxHp: 100,
  fireInterval: 0.22,
  damage: 12,
  bulletSpeed: 640,
  bulletRadius: 4,
  magnet: 90,
  dashSpeed: 920,
  dashTime: 0.16,
  dashCooldown: 2.2,
  invulnerable: 1.2,
  critChance: 0.05,
  critMultiplier: 2,
};

/** Enemy kinds: how they look, move and fight. */
export const ENEMIES = {
  drifter: { radius: 14, hp: 18, speed: 88, damage: 8, xp: 1, score: 50, color: '#ff4fd8' },
  mite: { radius: 8, hp: 6, speed: 175, damage: 5, xp: 1, score: 25, color: '#ff8ad8' },
  bulwark: { radius: 26, hp: 95, speed: 46, damage: 16, xp: 3, score: 150, color: '#ff534b' },
  splitter: { radius: 18, hp: 32, speed: 82, damage: 10, xp: 2, score: 100, color: '#ff9a3d' },
  stinger: { radius: 13, hp: 24, speed: 72, damage: 8, xp: 2, score: 120, color: '#b46bff' },
  elite: { radius: 40, hp: 460, speed: 56, damage: 22, xp: 10, score: 1000, color: '#ffd23d' },
};

/** Which kinds may spawn from which wave on. */
export const UNLOCK_WAVE = { drifter: 1, splitter: 2, bulwark: 3, stinger: 4, elite: 5 };

export const WAVE = {
  /** Enemies in wave n (before the elite, which is extra). */
  budget: (n) => 5 + n * 3,
  /** Seconds between spawns in wave n. */
  spawnInterval: (n) => Math.max(0.28, 1.15 - n * 0.07),
  /** Enemy health multiplier in wave n. */
  hpScale: (n) => 1 + (n - 1) * 0.18,
  /** Enemy speed multiplier in wave n (capped). */
  speedScale: (n) => 1 + Math.min(0.35, (n - 1) * 0.025),
  /** Breather, in seconds, between waves. */
  breather: 3,
  /** Score bonus for clearing wave n. */
  clearBonus: (n) => 100 * n,
};

/** Shards needed to reach level L (L starts at 1). */
export const xpForLevel = (level) => 10 + (level - 1) * 8;

export const COMBO = {
  /** Seconds a kill stays on the combo clock. */
  window: 3,
  /** Multiplier added per kill in the chain. */
  perKill: 0.1,
  /** Multiplier cap. */
  cap: 5,
};

/** How many of each thing can exist at once; pools are allocated once, at boot. */
export const POOL = { bullets: 256, enemies: 160, gems: 200, particles: 420, floaters: 48 };

export const PALETTE = {
  backdrop: '#070a16',
  nebulaA: '#141b33',
  nebulaB: '#1d1440',
  grid: '#131a2e',
  arenaEdge: '#2a3a66',
  player: '#4df3ff',
  bullet: '#8ef7ff',
  enemyBullet: '#ff5df2',
  gem: '#7dff8a',
  text: '#eef1f5',
  muted: '#8b93a3',
  panel: '#141a2e',
  panelEdge: '#2a3a66',
  danger: '#ff534b',
  gold: '#ffd23d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'voidpulse.best';
