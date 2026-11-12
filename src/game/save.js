import { G, SETTINGS_DEFAULT } from '../core/state.js';

const KEY = 'renaissance-verte-3d-save';
const SKEY = 'renaissance-verte-3d-settings';

function store() { try { return window.localStorage; } catch (e) { return null; } }

export function hasSave() { const s = store(); try { return !!(s && s.getItem(KEY)); } catch (e) { return false; } }
export function saveInfo() {
  try { const o = JSON.parse(store().getItem(KEY)); return o ? { day: o.time.day, diff: o.difficulty, at: o.at } : null; } catch (e) { return null; }
}

export function packExplored(u8) {
  let s = ''; for (let i = 0; i < u8.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (u8[i + k]) b |= 1 << k; s += String.fromCharCode(b); }
  return btoa(s);
}
export function unpackExplored(b64, u8) {
  try { const s = atob(b64); for (let j = 0; j < s.length; j++) { const b = s.charCodeAt(j); for (let k = 0; k < 8; k++) if (j * 8 + k < u8.length) u8[j * 8 + k] = (b >> k) & 1; } } catch (e) { /* ignore */ }
}

export function saveGame() {
  if (!G.running || G.player.dead) return false;
  const o = {
    v: 3, at: Date.now(), seed: G.seed, difficulty: G.difficulty,
    time: G.time, dry: G.dry, snow: G.snow, frozen: G.frozen, flood: G.flood || 0,
    weather: G.weatherSys.save(), flags: G.flags, stats: G.stats, markers: G.markers,
    player: G.player.save(), inv: G.inv.toJSON(),
    flora: G.flora.save(), builds: G.buildings.save(), pois: G.pois.save(), animals: G.animals.save(), ground: G.interact.saveGround(),
    explored: packExplored(G.explored), raidNight: G.animals.raidNight,
  };
  try { store().setItem(KEY, JSON.stringify(o)); return true; } catch (e) { console.warn('sauvegarde impossible', e); return false; }
}
export function loadData() { try { return JSON.parse(store().getItem(KEY)); } catch (e) { return null; } }
export function deleteSave() { try { store().removeItem(KEY); } catch (e) { /* rien */ } }

export function loadSettings() {
  try { const o = JSON.parse(store().getItem(SKEY)); if (o) Object.assign(G.settings, SETTINGS_DEFAULT, o); } catch (e) { /* défauts */ }
}
export function saveSettings() { try { store().setItem(SKEY, JSON.stringify(G.settings)); } catch (e) { /* rien */ } }
