// The level-up upgrade pool: ten upgrades, each with a name, a one-line pitch
// and an apply step. `roll` deals three distinct upgrades the player can still
// take, so a card is never a dead choice.

export const UPGRADES = [
  {
    id: 'overcharge',
    name: 'Overcharge',
    icon: 'DMG',
    text: '+25% bullet damage',
    max: 5,
    apply(player) {
      player.damage *= 1.25;
    },
  },
  {
    id: 'rapid',
    name: 'Rapid Cycler',
    icon: 'RPM',
    text: '+18% fire rate',
    max: 5,
    apply(player) {
      player.fireInterval *= 0.85;
    },
  },
  {
    id: 'splitshot',
    name: 'Split Shot',
    icon: 'x2',
    text: '+1 projectile per shot',
    max: 3,
    apply(player) {
      player.multishot += 1;
    },
  },
  {
    id: 'pierce',
    name: 'Piercing Rounds',
    icon: '>>',
    text: 'Bullets pierce +1 enemy',
    max: 3,
    apply(player) {
      player.pierce += 1;
    },
  },
  {
    id: 'thrusters',
    name: 'Ion Thrusters',
    icon: 'SPD',
    text: '+12% move speed',
    max: 4,
    apply(player) {
      player.speed *= 1.12;
    },
  },
  {
    id: 'plating',
    name: 'Hull Plating',
    icon: 'HP',
    text: '+25 max hull, repair 25',
    max: 5,
    apply(player) {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  },
  {
    id: 'magnet',
    name: 'Shard Magnet',
    icon: 'MAG',
    text: '+60% shard pickup range',
    max: 3,
    apply(player) {
      player.magnet *= 1.6;
    },
  },
  {
    id: 'slipstream',
    name: 'Slipstream',
    icon: 'DSH',
    text: 'Dash recharges 25% faster',
    max: 3,
    apply(player) {
      player.dashCooldownMax = (player.dashCooldownMax ?? 2.2) * 0.75;
    },
  },
  {
    id: 'deadeye',
    name: 'Deadeye',
    icon: 'CRT',
    text: '+10% critical chance (x2 damage)',
    max: 4,
    apply(player) {
      player.critChance += 0.1;
    },
  },
  {
    id: 'nova',
    name: 'Nova Pulse',
    icon: 'NOVA',
    text: 'A radial burst fires every 6s',
    max: 3,
    apply(player) {
      player.novaCount += 1;
    },
  },
];

/**
 * Deal three distinct upgrades the player can still stack. When every upgrade
 * is maxed, deal a repair card instead.
 */
export function rollUpgrades(player, taken, random) {
  const available = UPGRADES.filter((upgrade) => (taken[upgrade.id] ?? 0) < upgrade.max);
  const picks = [];
  const bag = [...available];
  while (picks.length < 3 && bag.length > 0) {
    const index = Math.floor(random.next() * bag.length);
    picks.push(bag.splice(index, 1)[0]);
  }
  while (picks.length < 3) {
    picks.push({
      id: 'repair',
      name: 'Field Repair',
      icon: 'HP',
      text: 'Repair 40 hull',
      max: 99,
      apply(target) {
        target.hp = Math.min(target.maxHp, target.hp + 40);
      },
    });
  }
  return picks;
}
