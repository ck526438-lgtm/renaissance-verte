import * as THREE from 'three';
import { G, WORLD, HALF, SETTINGS_DEFAULT, isNight, on, emit } from './core/state.js';
import { input } from './core/input.js';
import { Audio } from './core/audio.js';
import { clearAll, clearFloors } from './core/collide.js';
import { Terrain } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { Water } from './world/water.js';
import { Flora } from './world/flora.js';
import { Weather } from './world/weather.js';
import { Pois } from './world/pois.js';
import { FX } from './world/fx.js';
import { Player } from './entities/player.js';
import { Animals } from './entities/animals.js';
import { Inventory } from './game/inventory.js';
import { Survival } from './game/survival.js';
import { Buildings } from './game/buildings.js';
import { Interact } from './game/interact.js';
import { saveGame, loadData, hasSave, loadSettings, unpackExplored, deleteSave } from './game/save.js';
import { UI } from './ui/ui.js';
import { initTouch } from './ui/touch.js';

const INTENT = 'rv3-intent';
const $ = (s) => document.querySelector(s);
const setLoad = (p, msg) => { $('#loading .lbar i').style.width = Math.round(p * 100) + '%'; if (msg) $('#loading p').textContent = msg; };
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

window.rvDesktop = /Electron/i.test(navigator.userAgent);
window.__G = G; window.__input = input; // utile pour déboguer depuis la console
G.isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;
G.capacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ---------- moteur ----------
function pickQuality() {
  const q = G.settings.quality;
  if (q !== 'auto') return q;
  if (G.isTouch) return (navigator.hardwareConcurrency || 4) >= 8 ? 'moyen' : 'bas';
  return (navigator.hardwareConcurrency || 4) >= 8 ? 'haut' : 'moyen';
}
G.applyQuality = (viewOnly) => {
  G.quality = pickQuality();
  const r = G.renderer, dpr = window.devicePixelRatio || 1;
  r.setPixelRatio(G.quality === 'haut' ? Math.min(dpr, 2) : G.quality === 'moyen' ? Math.min(dpr, 1.25) : Math.min(dpr, 0.85));
  r.shadowMap.enabled = G.quality !== 'bas' || !G.isTouch;
  G.camera.far = G.settings.viewDist + 120; G.camera.updateProjectionMatrix();
  if (!viewOnly && G.sky) { G.sky.setShadowQuality(G.quality); G.flora && G.flora.initGrass(); }
  resize();
};
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  G.renderer.setSize(w, h, false);
  G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
}

async function boot() {
  if (G.isTouch) G.settings.viewDist = 170;
  loadSettings();
  const canvas = $('#game');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !G.isTouch, powerPreference: 'high-performance' });
  } catch (err) {
    const l = $('#loading');
    if (l) l.querySelector('p').textContent = "La 3D (WebGL) n'est pas disponible sur cet appareil. Mets à jour le pilote graphique ou active l'accélération matérielle, puis relance le jeu.";
    const bar = l && l.querySelector('.lbar'); if (bar) bar.style.display = 'none';
    throw err;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(G.settings.fov, 1, 0.1, 600);
  G.clock = new THREE.Clock();
  G.audio = new Audio();
  window.addEventListener('resize', resize);
  G.applyQuality(true);
  input.init(canvas);
  UI.init();
  if (G.isTouch) initTouch();
  hookNative();

  // que faire après le chargement ?
  let intent = null;
  try { intent = JSON.parse(sessionStorage.getItem(INTENT)); sessionStorage.removeItem(INTENT); } catch (e) { intent = null; }
  const save = loadData();
  let seed, difficulty = 'normal', data = null;
  if (intent && intent.new) { seed = intent.seed; difficulty = intent.difficulty; }
  else if (save) { seed = save.seed; difficulty = save.difficulty; data = save; }
  else seed = Math.floor(Math.random() * 999999);

  await buildWorld(seed, difficulty);
  if (intent && intent.new) { startPlaying(null); }
  else if (intent && intent.cont && data) { startPlaying(data); }
  else { showTitle(); }
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').remove(), 700);
  G.clock.start();
  renderer.setAnimationLoop(loop);
}

async function buildWorld(seed, difficulty) {
  G.seed = seed; G.difficulty = difficulty;
  clearAll(); clearFloors();
  setLoad(0.1, 'Le relief se soulève…'); await frame();
  G.terrain = new Terrain(seed); G.scene.add(G.terrain.mesh);
  setLoad(0.35, 'Le ciel s’éclaircit…'); await frame();
  G.sky = new Sky(G.scene); G.sky.setShadowQuality(G.quality);
  G.water = new Water(G.scene);
  FX.init(G.scene);
  G.buildings = new Buildings(G.scene);
  setLoad(0.45, 'Les ruines affleurent…'); await frame();
  G.pois = new Pois(G.scene, G.terrain, seed);
  setLoad(0.6, 'La forêt repousse…'); await frame();
  const exclude = G.pois.list.map((p) => ({ x: p.x, z: p.z, r: 9 }));
  G.player = new Player(G.scene, G.camera);
  const start = G.terrain.findLand(0, 0, 2, 0.15);
  G.player.place(start.x, start.z);
  G.flora = new Flora(G.scene, G.terrain, seed, exclude);
  setLoad(0.85, 'Les bêtes s’éveillent…'); await frame();
  G.weatherSys = new Weather(G.scene);
  G.animals = new Animals(G.scene);
  G.inv = new Inventory(32, 'sac');
  G.survival = new Survival();
  G.interact = new Interact(G.scene);
  G.explored = new Uint8Array(128 * 128);
  G.time = { day: 1, hour: 7.5, total: 0 };
  G.season = 0; G.seasonT = 0; G.dry = 0; G.snow = 0; G.frozen = 0; G.flood = 0; G.waterLevel = 0;
  G.weatherSys.update(0.016, 0);
  setLoad(1, 'Prêt.'); await frame();
}

function applySave(o) {
  G.time = o.time; G.dry = o.dry; G.snow = o.snow; G.frozen = o.frozen; G.flood = o.flood || 0;
  G.flags = o.flags || {}; Object.assign(G.stats, o.stats || {}); G.markers = o.markers || [];
  G.weatherSys.load(o.weather);
  G.flora.load(o.flora);
  G.buildings.load(o.builds);
  G.pois.load(o.pois);
  G.inv.load(o.inv);
  G.player.load(o.player);
  G.animals.load(o.animals);
  G.animals.raidNight = o.raidNight || 0;
  G.interact.loadGround(o.ground);
  unpackExplored(o.explored, G.explored);
  // saison courante
  G.season = -1; G.weatherSys.update(0.016, 0);
  G.flora.refreshAll();
}

function startPlaying(data) {
  if (data) applySave(data);
  else {
    G.inv.add('baies', 3);
    G.inv.add('gourde_vide', 1);
    G.inv.add('torche', 1);
    G.player.hotbar = 3;
    G.player.yaw = Math.PI * 0.75;
    G.flags.goal = 0;
    setTimeout(() => UI.banner('Renaissance Verte', 'Printemps · Jour 1. Ramasse branches et cailloux, fabrique une hache.'), 600);
  }
  G.running = true; G.paused = false;
  G.audio.start();
  UI.hideMenu();
  $('#hud').classList.remove('hidden');
  if (!G.isTouch) input.lock();
  G.season = G.season < 0 ? 0 : G.season;
  G.flora.refreshAll();
  UI.renderHotbar();
}

function showTitle() {
  G.running = false; G.paused = true;
  $('#hud').classList.add('hidden');
  G.time.hour = 18.2;
  UI.showMenu('title');
}

G.startNew = (o) => {
  deleteSave();
  try { sessionStorage.setItem(INTENT, JSON.stringify({ new: true, seed: o.seed, difficulty: o.difficulty })); } catch (e) { /* rien */ }
  location.reload();
};
G.continueGame = () => {
  const data = loadData();
  if (!data) return;
  if (data.seed !== G.seed) { try { sessionStorage.setItem(INTENT, JSON.stringify({ cont: true })); } catch (e) { /* rien */ } location.reload(); return; }
  startPlaying(data);
};
G.quitToTitle = () => { G.save(); location.reload(); };
G.save = (loud) => { const ok = saveGame(); if (loud) G.toast(ok ? 'Partie sauvegardée.' : 'Sauvegarde impossible.', ok ? 'good' : 'bad'); return ok; };
G.resume = () => { G.paused = false; UI.hideMenu(); if (!G.isTouch) input.lock(); G.audio.start(); };
G.pause = () => { if (!G.running || G.player.dead) return; G.paused = true; input.unlock(); UI.closeSheet(); UI.showMenu('pause'); };
G.onUnlock = () => { if (!G.uiOpen && !G.paused) G.pause(); };

function hookNative() {
  // Android : bouton retour, plein écran
  if (!G.capacitor) return;
  import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', () => {
      if (G.uiOpen) UI.closeSheet();
      else if (G.placing) G.buildings.cancelPlacing();
      else if (G.running && !G.paused) G.pause();
      else if (UI.menuKind && UI.menuKind !== 'title') G.resume();
      else App.exitApp();
    });
    App.addListener('pause', () => { if (G.running) { G.save(); G.pause(); } });
  }).catch(() => {});
  import('@capacitor/status-bar').then(({ StatusBar }) => StatusBar.hide().catch(() => {})).catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (document.hidden && G.running && !G.paused) { G.save(); G.pause(); } });
on('season', () => { if (G.flora) G.flora.refreshAll(); });
window.addEventListener('beforeunload', () => { if (G.running && !G.player.dead) saveGame(); });

// ---------- boucle ----------
let saveT = 120, slowT = 0, spoilAcc = 0, exploreT = 0;
function loop() {
  const raw = Math.min(0.05, G.clock.getDelta());
  G.dt = raw; G.t += raw; G.frame++;
  input.poll();
  if (!G.running) titleLoop(raw);
  else if (G.paused) { UI.padNav(); if (input.pressed.pause || input.pressed.interact) { if (UI.menuKind === 'pause') G.resume(); else if (UI.menuKind === 'settings' || UI.menuKind === 'help') UI.showMenu('pause'); } }
  else gameLoop(raw);
  G.renderer.render(G.scene, G.camera);
  input.endFrame();
}

function titleLoop(dt) {
  // vue de l'île derrière le titre
  const t = G.t * 0.04;
  const cx = Math.cos(t) * 40, cz = Math.sin(t) * 40;
  const h = Math.max(G.terrain.heightAt(cx, cz), 0) + 16;
  G.camera.position.set(cx, h, cz);
  G.camera.lookAt(0, G.terrain.heightAt(0, 0) + 4, 0);
  G.weatherSys.update(dt, 0);
  G.sky.update(dt, G.camera.position);
  G.water.update(dt);
  G.flora.update(dt);
  FX.update(dt);
  UI.padNav();
}

function gameLoop(dt) {
  const P = G.player;
  // vitesse du temps (sommeil = accéléré)
  let k = 1;
  if (G.sleep) { k = 70; if (G.time.total >= G.sleep.until) { G.survival.wake(); if (G.settings.autoSave) G.save(); } }
  $('#fade').classList.toggle('on', !!G.sleep);
  const hours = (dt * k * 24) / (G.settings.dayMinutes * 60);
  advanceTime(hours);

  // raccourcis
  handleKeys();

  const sim = Math.min(dt * k, 0.05);
  if (!G.uiOpen || true) P.update(dt);
  G.survival.update(dt, hours);
  G.weatherSys.update(dt * (G.sleep ? 8 : 1), hours);
  G.sky.update(dt, P.pos);
  G.water.update(dt);
  G.flora.update(dt);
  G.animals.update(sim);
  G.buildings.update(dt, hours);
  G.interact.update(dt);
  G.pois.update();
  FX.update(dt);
  G.audio.update(dt);
  UI.updateHUD(dt);

  // nourriture qui pourrit
  spoilAcc += hours; slowT -= dt;
  if (slowT <= 0) {
    slowT = 1;
    const f = (G.season === 3 ? 0.35 : 1) * ((G.airTemp ?? 15) < 6 ? 0.6 : 1) * ((G.airTemp ?? 15) > 26 ? 1.3 : 1);
    G.inv.spoil(spoilAcc, f);
    for (const s of G.buildings.list.values()) if (s.k === 'coffre') s.data.inv.spoil(spoilAcc, f * 0.75);
    spoilAcc = 0;
    // torches et lanternes qui se consument
    const sel = P.selected;
    if (sel && ITEMS_DUR_TIME(sel.id)) { if (G.inv.wear(P.hotbar, 1)) G.toast('La flamme s’éteint.', 'warn'); }
    G.nearWater = Math.max(0, 1 - Math.abs(G.terrain.heightAt(P.pos.x, P.pos.z) - G.waterLevel) / 3);
  }
  // carte explorée
  exploreT -= dt;
  if (exploreT <= 0) {
    exploreT = 0.5;
    const ci = Math.floor((P.pos.x + HALF) / 5), cj = Math.floor((P.pos.z + HALF) / 5);
    for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) if (i * i + j * j <= 49) { const x = ci + i, y = cj + j; if (x >= 0 && y >= 0 && x < 128 && y < 128) G.explored[y * 128 + x] = 1; }
  }
  // sauvegarde auto
  saveT -= dt;
  if (saveT <= 0) { saveT = 120; if (G.settings.autoSave) G.save(); }
}

import { ITEMS } from './game/items.js';
function ITEMS_DUR_TIME(id) { return ITEMS[id] && ITEMS[id].durTime; }

function advanceTime(h) {
  const T = G.time;
  T.hour += h; T.total += h;
  if (T.hour >= 24) { T.hour -= 24; T.day++; G.stats.days = T.day; emit('day', T.day); if (G.settings.autoSave) setTimeout(() => G.save(), 50); }
}

function handleKeys() {
  const P = G.player;
  if (P.dead) return;
  if (input.pressed.pause) {
    if (G.uiOpen) UI.closeSheet();
    else if (G.placing) G.buildings.cancelPlacing();
    else G.pause();
    return;
  }
  if (G.uiOpen) {
    UI.padNav();
    if (input.lastDevice === 'pad' && input.pressed.interact) UI.closeSheet();
    for (const k of ['inventory', 'craft', 'build', 'map', 'help']) if (input.pressed[k] && G.uiOpen === k) { UI.closeSheet(); return; }
    for (const k of ['inventory', 'craft', 'build', 'map', 'help']) if (input.pressed[k]) { UI.toggle(k); return; }
    return;
  }
  for (const k of ['inventory', 'craft', 'build', 'map', 'help']) if (input.pressed[k]) { UI.toggle(k); return; }
  for (let i = 1; i <= 8; i++) if (input.pressed['slot' + i]) { P.hotbar = i - 1; UI.hotbarDirty = true; }
  if (input.wheel && !G.placing) { P.hotbar = (P.hotbar + (input.wheel > 0 ? 1 : 7)) % 8; UI.hotbarDirty = true; }
  if (input.wheel && G.placing) G.placing.rot += Math.PI / 2 * Math.sign(input.wheel);
  if (P.sleeping && (input.pressed.jump || input.pressed.interact)) G.survival.wake('Tu te lèves.');
}

boot().catch((e) => { console.error(e); $('#loading p').textContent = 'Erreur au démarrage : ' + e.message; });
