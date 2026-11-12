// État partagé du jeu. Tous les modules lisent et écrivent dans G.

export const WORLD = 640;          // côté du monde en mètres
export const SEG = 256;            // résolution de la carte des hauteurs
export const CELL = WORLD / SEG;   // 2,5 m
export const HALF = WORLD / 2;
export const SEA = 0;              // niveau de la mer

export const SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver'];
export const SEASON_KEYS = ['printemps', 'ete', 'automne', 'hiver'];

export const DIFFICULTY = {
  paisible: { label: 'Paisible', needs: 0.6, dmg: 0.4, aggro: false, raids: false, drop: false },
  normal:   { label: 'Normal',   needs: 1.0, dmg: 1.0, aggro: true,  raids: true,  drop: true  },
  rude:     { label: 'Rude',     needs: 1.35, dmg: 1.5, aggro: true, raids: true,  drop: true  },
};

export const SETTINGS_DEFAULT = {
  quality: 'auto',        // bas | moyen | haut | auto
  viewDist: 220,
  sens: 1,
  invertY: false,
  fov: 70,
  volume: 0.7,
  music: 0.4,
  dayMinutes: 20,         // durée d'une journée en minutes réelles
  seasonDays: 5,          // jours par saison
  autoSave: true,
};

export const G = {
  // moteur
  renderer: null, scene: null, camera: null, clock: null,
  quality: 'moyen',
  settings: { ...SETTINGS_DEFAULT },
  running: false, paused: true, uiOpen: null,
  t: 0, dt: 0, frame: 0,
  isTouch: false,

  // monde
  seed: 1,
  difficulty: 'normal',
  time: { day: 1, hour: 7.5, total: 0 },   // total = heures de jeu écoulées
  season: 0, seasonT: 0,                    // seasonT = progression dans la saison 0..1
  weather: null,
  waterLevel: SEA,
  frozen: 0,                                // 0..1 : glace sur les lacs
  snow: 0,                                  // neige au sol 0..1
  autumn: 0, dry: 0,

  terrain: null, flora: null, water: null, sky: null,
  player: null, animals: null, buildings: null, pois: null,
  inv: null,

  stats: { days: 1, kills: 0, crafted: 0, built: 0, eaten: 0, bosses: 0, distance: 0 },
  flags: {},       // drapeaux de progression (plans, boss vaincus, tutoriel…)
  explored: null,  // Uint8Array brouillard de la carte
  markers: [],
};

// Petit bus d'événements
const listeners = {};
export function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
export function emit(ev, data) { const l = listeners[ev]; if (l) for (const fn of l) fn(data); }

export function seasonKey() { return SEASON_KEYS[G.season]; }
export function isNight() { const h = G.time.hour; return h < 5.6 || h > 20.4; }
export function dayLight() {
  // 0 la nuit, 1 en plein jour
  const h = G.time.hour;
  if (h < 5) return 0;
  if (h < 7.5) return (h - 5) / 2.5;
  if (h < 18.5) return 1;
  if (h < 21) return 1 - (h - 18.5) / 2.5;
  return 0;
}
