const KEY = 'neon-relay-save-v1';
const keyFor = (slot) => (slot > 0 ? `${KEY}-s${slot}` : KEY);
export function saveGame(G, slot) {
  try {
    const s = {
      slot: slot ?? G.saveSlot ?? 0,
      money: G.player.money, ammo: G.player.ammo,
      ownsRifle: !!G.player.ownsRifle, ownsSniper: !!G.player.ownsSniper,
      rifleMag: G.player.rifleMag || 0, sniperMag: G.player.sniperMag || 0, ownsBat: !!G.player.ownsBat,
      armor: G.player.armor || 0, nitroStock: G.player.nitroStock || 0,
      hp: G.player.hp, x: G.player.x, z: G.player.z, mission: G.missions ? G.missions.index : 0,
      missionsDone: G.stats.missionsDone, earned: G.stats.earned, timeOfDay: G.timeOfDay,
      garage: G.garage || [],
      radio: G.settings ? G.settings.radio : 0, volume: G.settings ? G.settings.volume : 0.5,
      quality: G.settings ? G.settings.quality : 'high',
      shards: G.side ? G.side.shards.filter((p) => p.got).map((p) => p.id) : [],
    };
    localStorage.setItem(keyFor(s.slot), JSON.stringify(s));
    return true;
  } catch { return false; }
}
export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(keyFor(slot || 0));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearSave(slot) {
  try { localStorage.removeItem(keyFor(slot || 0)); } catch { /* no storage */ }
}
