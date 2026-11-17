export const VIEW = { w: 1280, h: 800 };
export const WORLD = { w: 3200, h: 2400 };
export const STEP = 1 / 60;
export const FLOOR_H = 34;
export const PLAYER_H = 36;
export const GUN_H = 22;
export const AVENUES = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const STREETS = [300, 700, 1100, 1500, 1900];
export const ROAD_W = 110;
export const CAM = {
  foot: { dist: 130, height: 80 },
  car: { dist: 185, height: 105 },
  bike: { dist: 165, height: 95 },
};
export const PALETTE = {
  ground: '#262c49', road: '#343b60', roadLine: '#3ee6ff', sidewalk: '#363d63', curb: '#232744',
  wall: '#1b1f38', glass: '#7de8ff', roof: '#2a2f4d',
  neonPink: '#ff2e88', neonCyan: '#00e5ff', neonGold: '#ffd23e', neonGreen: '#39ff88', neonPurple: '#b26bff',
  player: '#ffd23e', cop: '#1c4ed8', copCar: '#1e40af', gang: '#e74c3c',
  sedan: '#c0392b', sport: '#8e44ad', truck: '#7f8c8d', van: '#16a085', taxi: '#f7c948',
};
export const VEHICLES = {
  vortex: { name: 'VORTEX GT', kind: 'hypercar', max: 880, accel: 820, turn: 3.3, hp: 90, r: 24, color: '#ff2e88', price: 0, desc: 'Hypercar — the fastest thing in Nova City.' },
  streethawk: { name: 'STREETHAWK', kind: 'street', max: 740, accel: 700, turn: 3.0, hp: 100, r: 24, color: '#00e5ff', price: 1500, desc: 'Street racer — balanced, quick off the line.' },
  neonbike: { name: 'NEON BIKE', kind: 'bike', max: 800, accel: 860, turn: 3.6, hp: 60, r: 15, color: '#39ff88', price: 1200, desc: 'Motorcycle — razor handling, thin armor.' },
  ironclad: { name: 'IRONCLAD', kind: 'armored', max: 620, accel: 520, turn: 2.4, hp: 220, r: 27, color: '#8d9db6', price: 2200, desc: 'Armored hauler — slow, nearly unkillable.' },
  voltspark: { name: 'VOLT SPARK', kind: 'electric', max: 840, accel: 940, turn: 3.1, hp: 85, r: 24, color: '#b26bff', price: 2600, desc: 'Electric sports car — instant torque, silent.' },
  driftking: { name: 'DRIFT KING', kind: 'drift', max: 720, accel: 660, turn: 3.5, hp: 95, r: 24, color: '#ffd23e', price: 1800, desc: 'Drift machine — slides through corners.' },
  hauler: { name: 'HAULER', kind: 'truck', max: 560, accel: 460, turn: 2.0, hp: 200, r: 28, color: '#e67e22', price: 1400, desc: 'Heavy truck — plows through traffic.' },
  aerocab: { name: 'AERO CAB', kind: 'hover', max: 780, accel: 720, turn: 3.2, hp: 90, r: 24, color: '#7de8ff', price: 2000, desc: 'Hover taxi — floats, corners flat.' },
};
export const VEHICLE_ORDER = ['vortex', 'streethawk', 'neonbike', 'ironclad', 'voltspark', 'driftking', 'hauler', 'aerocab'];
export const WEAPONS = {
  pistol: { name: 'BLASTER', dmg: 34, delay: 0.22, pellets: 1, spread: 0.05, mag: 0 },
  rifle: { name: 'PULSE RIFLE', dmg: 22, delay: 0.11, pellets: 1, spread: 0.09, mag: 30 },
  sniper: { name: 'RAIL SNIPER', dmg: 120, delay: 1.1, pellets: 1, spread: 0.01, mag: 5 },
};
export const WEAPON_ORDER = ['pistol', 'rifle', 'sniper'];
export const TUNE = {
  walkSpeed: 240, sprintMul: 1.5, playerRadius: 13, playerHp: 100,
  carBrake: 950, carReverseMax: 220, bulletSpeed: 950, fireDelay: 0.22, punchDelay: 0.45,
  ammoStart: 48, ammoPrice: 40, ammoPack: 24, medPrice: 60, repairPrice: 100,
  armorPrice: 120, armorPack: 50, nitroPrice: 150, riflePrice: 600, sniperPrice: 900, batPrice: 150,
  enginePrice: 800, engineBonus: 60, punchDmg: 25, batDmg: 50,
  wantedDecaySight: 8, wantedDecayRate: 4, copFootSpeed: 210, copPunchDmg: 8,
  trafficCount: 28, pedCount: 48, maxBullets: 64, maxParticles: 600,
  timeRate: 0.002, shardCount: 20, shardPay: 100, racePay: 600, trialPar: 75,
};
export const START = { x: 860, z: 1180, money: 200, ammo: 48 };
export const PLACES = {
  garage: { x: 800, z: 1180, name: 'Rook\'s Garage' },
  tower: { x: 1800, z: 1300, name: 'Omnidyne Spire' },
  lab: { x: 2800, z: 300, name: 'Omnidyne Lab' },
  arena: { x: 2400, z: 1900, name: 'Neon Arena' },
  neon: { x: 2200, z: 700, name: 'Neon Row' },
  port: { x: 400, z: 1900, name: 'The Port' },
  tunnel: { x: 2000, z: 1900, name: 'Underpass' },
  mountain: { x: 2800, z: 300, name: 'Skyline Pass' },
  hospital: { x: 2400, z: 700, name: 'Nova Med' },
  ammoShop: { x: 1200, z: 1500, name: 'Black Market Arms' },
  repairShop: { x: 2000, z: 1500, name: 'Pit Stop' },
  hideout: { x: 400, z: 300, name: 'The Relay Hideout' },
  raceStart: { x: 800, z: 1900, name: 'Race Start' },
  club: { x: 2200, z: 1100, name: 'Club Volt' },
};
export const MISSION_REWARDS = [300, 450, 600, 550, 900, 800, 700, 1200, 900, 1100, 1800, 6000];
export const MISSION_COUNT = 12;
export const RACE_COURSE = [
  { x: 800, z: 1900 }, { x: 2400, z: 1900 }, { x: 2400, z: 300 }, { x: 800, z: 300 },
];
export const ARENA_COURSE = [
  { x: 2400, z: 1740 }, { x: 2560, z: 1900 }, { x: 2400, z: 2060 }, { x: 2240, z: 1900 },
];
