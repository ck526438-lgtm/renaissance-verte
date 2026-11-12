import * as THREE from 'three';
import { G, SEA, SEASONS, emit } from '../core/state.js';
import { clamp, lerp, smooth } from '../core/rng.js';
import { WMAT } from './flora.js';
import { NATURE_U } from './matfx.js';

// Saisons, météo, température de l'air, sécheresse, crues, neige au sol, glace, foudre et incendies.
export const WEATHERS = {
  clair:      { n: 'Ciel clair',  cloud: 0.15, rain: 0, wind: 0.2, fog: 0,    dark: 0,    temp: 1 },
  nuageux:    { n: 'Nuageux',     cloud: 0.6,  rain: 0, wind: 0.35, fog: 0.05, dark: 0.15, temp: -1 },
  pluie:      { n: 'Pluie',       cloud: 0.85, rain: 0.7, wind: 0.45, fog: 0.15, dark: 0.45, temp: -3 },
  orage:      { n: 'Orage',       cloud: 1,    rain: 1, wind: 0.9, fog: 0.2,  dark: 0.7,  temp: -4, storm: true },
  brouillard: { n: 'Brouillard',  cloud: 0.5,  rain: 0, wind: 0.05, fog: 0.85, dark: 0.2, temp: -1 },
  canicule:   { n: 'Canicule',    cloud: 0,    rain: 0, wind: 0.1, fog: 0.08, dark: 0,    temp: 9, heat: true },
  neige:      { n: 'Neige',       cloud: 0.85, rain: 0.6, wind: 0.3, fog: 0.25, dark: 0.3, temp: -3, snow: true },
  blizzard:   { n: 'Blizzard',    cloud: 1,    rain: 1, wind: 1, fog: 0.65, dark: 0.55, temp: -9, snow: true, storm: true },
};
const ODDS = [
  { clair: 30, nuageux: 25, pluie: 28, orage: 9, brouillard: 8 },
  { clair: 42, nuageux: 15, pluie: 10, orage: 15, canicule: 18 },
  { clair: 20, nuageux: 30, pluie: 28, orage: 6, brouillard: 16 },
  { clair: 26, nuageux: 28, neige: 30, blizzard: 9, brouillard: 7 },
];
const SEASON_TEMP = [13, 25, 10, -5];

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.kind = 'clair'; this.left = 6; this.lightT = 8;
    G.weather = { ...WEATHERS.clair, kind: 'clair' };
    // pluie : segments autour de la caméra
    this.rainN = 1600;
    const rp = new Float32Array(this.rainN * 6);
    this.rainGeo = new THREE.BufferGeometry(); this.rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: 0xd6e6f2, transparent: true, opacity: 0.6, depthWrite: false }));
    this.rain.frustumCulled = false; scene.add(this.rain);
    this.drops = new Float32Array(this.rainN * 4);
    for (let i = 0; i < this.rainN; i++) this.resetDrop(i, true);
    // neige : points
    this.snowN = 2200;
    const sp = new Float32Array(this.snowN * 3);
    this.snowGeo = new THREE.BufferGeometry(); this.snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3).setUsage(THREE.DynamicDrawUsage));
    this.snowPts = new THREE.Points(this.snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false }));
    this.snowPts.frustumCulled = false; scene.add(this.snowPts);
    this.flakes = new Float32Array(this.snowN * 4);
    for (let i = 0; i < this.snowN; i++) this.resetFlake(i, true);
  }

  resetDrop(i, any) {
    const c = G.camera ? G.camera.position : { x: 0, y: 0, z: 0 };
    const d = this.drops;
    d[i * 4] = c.x + (Math.random() - 0.5) * 50; d[i * 4 + 2] = c.z + (Math.random() - 0.5) * 50;
    d[i * 4 + 1] = c.y + (any ? Math.random() * 30 - 8 : 18 + Math.random() * 6);
    d[i * 4 + 3] = 22 + Math.random() * 8;
  }
  resetFlake(i, any) {
    const c = G.camera ? G.camera.position : { x: 0, y: 0, z: 0 };
    const d = this.flakes;
    d[i * 4] = c.x + (Math.random() - 0.5) * 44; d[i * 4 + 2] = c.z + (Math.random() - 0.5) * 44;
    d[i * 4 + 1] = c.y + (any ? Math.random() * 20 - 6 : 12 + Math.random() * 4);
    d[i * 4 + 3] = Math.random() * 6.28;
  }

  roll() {
    const odds = ODDS[G.season];
    let tot = 0; for (const k in odds) tot += odds[k];
    let r = Math.random() * tot, pick = 'clair';
    for (const k in odds) { r -= odds[k]; if (r <= 0) { pick = k; break; } }
    // la crue arrive au printemps après de longues pluies ; la canicule en été suit la sécheresse
    this.set(pick, 3 + Math.random() * 6);
  }
  set(kind, hours) {
    const prev = this.kind;
    this.kind = kind; this.left = hours;
    G.weather.kind = kind; G.weather.n = WEATHERS[kind].n;
    if (prev !== kind) emit('weather', kind);
  }

  // température de l'air (°C) à une altitude donnée
  airTemp(y = 3) {
    const s = G.season, t = G.seasonT;
    const next = SEASON_TEMP[(s + 1) % 4];
    const base = t > 0.75 ? lerp(SEASON_TEMP[s], next, (t - 0.75) / 0.25 * 0.5) : SEASON_TEMP[s];
    const day = -Math.cos(((G.time.hour - 3) / 24) * Math.PI * 2) * 5.5;
    return base + day + G.weather.temp - Math.max(0, y - 6) * 0.11 + (G.heatwave || 0);
  }

  update(dt, hours) {
    // saison
    const sd = G.settings.seasonDays;
    const dayIdx = G.time.day - 1;
    const season = Math.floor(dayIdx / sd) % 4;
    G.seasonT = ((dayIdx % sd) + G.time.hour / 24) / sd;
    G.year = Math.floor(dayIdx / (sd * 4)) + 1;
    if (season !== G.season) { G.season = season; emit('season', season); this.roll(); }

    this.left -= hours;
    if (this.left <= 0) this.roll();
    const W = WEATHERS[this.kind], cur = G.weather;
    const k = Math.min(1, dt * 0.12);
    for (const p of ['cloud', 'rain', 'wind', 'fog', 'dark', 'temp']) cur[p] = lerp(cur[p] ?? 0, W[p], k);
    cur.snow = !!W.snow; cur.storm = !!W.storm; cur.heat = !!W.heat;
    NATURE_U.uWind.value = cur.wind;

    // sécheresse, crue, neige, glace
    const air = this.airTemp(3);
    G.airTemp = air;
    if (G.season === 1 && cur.rain < 0.1) G.dry = clamp(G.dry + hours * (cur.heat ? 0.035 : 0.012), 0, 1);
    else G.dry = clamp(G.dry - hours * (cur.rain > 0.3 ? 0.08 : 0.01) - (G.season === 3 ? hours * 0.05 : 0), 0, 1);
    const floodMax = G.season === 0 ? 1.6 : G.season === 2 ? 0.9 : 0.4;
    if (cur.rain > 0.55 && !cur.snow) G.flood = Math.min(floodMax, (G.flood || 0) + hours * 0.07 * cur.rain);
    else G.flood = Math.max(0, (G.flood || 0) - hours * 0.04);
    G.waterLevel = SEA + (G.flood || 0) * 1;
    if (cur.snow && cur.rain > 0.2) G.snow = clamp(G.snow + hours * 0.12 * cur.rain, 0, 1);
    else if (air > 1.5) G.snow = clamp(G.snow - hours * 0.03 * (air - 1.5), 0, 1);
    if (air < -2) G.frozen = clamp(G.frozen + hours * 0.05 * (-air / 5), 0, 1);
    else if (air > 1) G.frozen = clamp(G.frozen - hours * 0.06 * air / 3, 0, 1);
    G.autumn = G.season === 2 ? smooth(0, 0.35, G.seasonT) : G.season === 1 ? smooth(0.85, 1, G.seasonT) * 0.3 : 0;

    // couleurs de saison
    const tr = G.terrain.uniforms;
    tr.uSnow.value = G.snow; tr.uDry.value = G.dry; tr.uAutumn.value = G.autumn; tr.uWet.value = cur.rain * (cur.snow ? 0 : 1);
    NATURE_U.uSnow.value = G.snow * 0.95;
    const spring = new THREE.Color(1.05, 1.12, 0.82), summer = new THREE.Color(1, 1, 1), autumn = new THREE.Color(2.7, 0.88, 0.3);
    const fc = G.season === 0 ? spring.lerp(summer, smooth(0.3, 1, G.seasonT)) : summer.lerp(autumn, G.autumn);
    fc.lerp(new THREE.Color(1.25, 1.1, 0.6), G.dry * 0.4);
    WMAT.foliage.color.copy(fc);

    // orage : éclairs et foudre
    if (cur.storm && cur.rain > 0.6) {
      this.lightT -= dt;
      if (this.lightT <= 0) {
        this.lightT = 5 + Math.random() * 14;
        G.sky.lightning();
        const delay = 0.3 + Math.random() * 2.2;
        setTimeout(() => G.audio && G.audio.play('thunder', { v: 1 - delay / 3 }), delay * 1000);
        // la foudre peut enflammer un arbre (bien plus probable en été sec)
        if (!cur.snow && Math.random() < 0.18 + G.dry * 0.6) this.strikeTree(110);
      }
    }
    // départs de feu spontanés en pleine canicule
    if (cur.heat && G.dry > 0.6 && Math.random() < hours * 0.08 * G.dry) this.strikeTree(160, true);

    this.updatePrecip(dt);
  }

  strikeTree(radius, quiet = false) {
    const p = G.player.pos; let target = null;
    for (let k = 0; k < 30 && !target; k++) {
      const a = Math.random() * 6.28, d = 25 + Math.random() * radius;
      G.flora.query(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 8, (n) => { if (!target && n.st === 0 && (n.k === 'chene' || n.k === 'sapin')) target = n; });
    }
    if (target && G.flora.ignite(target)) {
      G.fireAlert = { x: target.x, z: target.z, t: G.time.total };
      G.toast && G.toast(quiet ? 'Une colonne de fumée s’élève : un feu de forêt a pris !' : 'La foudre a frappé un arbre : la forêt brûle !', 'warn');
    }
  }

  updatePrecip(dt) {
    const W = G.weather, cam = G.camera.position;
    const raining = W.rain > 0.05 && !W.snow && !G.underwater;
    this.rain.visible = raining;
    if (raining) {
      const n = Math.floor(this.rainN * W.rain), pos = this.rainGeo.attributes.position.array, d = this.drops;
      const wx = W.wind * 4;
      for (let i = 0; i < this.rainN; i++) {
        if (i >= n) { pos[i * 6 + 1] = pos[i * 6 + 4] = -999; continue; }
        d[i * 4 + 1] -= d[i * 4 + 3] * dt; d[i * 4] += wx * dt;
        const x = d[i * 4], y = d[i * 4 + 1], z = d[i * 4 + 2];
        if (y < cam.y - 10 || Math.abs(x - cam.x) > 26 || Math.abs(z - cam.z) > 26) { this.resetDrop(i, false); continue; }
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x - wx * 0.04; pos[i * 6 + 4] = y + 0.55; pos[i * 6 + 5] = z;
      }
      this.rainGeo.attributes.position.needsUpdate = true;
      this.rain.material.opacity = 0.35 + W.rain * 0.35;
    }
    const snowing = W.rain > 0.05 && W.snow;
    this.snowPts.visible = snowing;
    if (snowing) {
      const n = Math.floor(this.snowN * W.rain), pos = this.snowGeo.attributes.position.array, d = this.flakes;
      for (let i = 0; i < this.snowN; i++) {
        if (i >= n) { pos[i * 3 + 1] = -999; continue; }
        d[i * 4 + 3] += dt;
        d[i * 4 + 1] -= (1.1 + W.wind * 0.8) * dt;
        d[i * 4] += (Math.sin(d[i * 4 + 3] * 1.3) * 0.6 + W.wind * 6) * dt;
        d[i * 4 + 2] += Math.cos(d[i * 4 + 3]) * 0.4 * dt;
        if (d[i * 4 + 1] < cam.y - 8 || Math.abs(d[i * 4] - cam.x) > 22 || Math.abs(d[i * 4 + 2] - cam.z) > 22) { this.resetFlake(i, false); continue; }
        pos[i * 3] = d[i * 4]; pos[i * 3 + 1] = d[i * 4 + 1]; pos[i * 3 + 2] = d[i * 4 + 2];
      }
      this.snowGeo.attributes.position.needsUpdate = true;
      this.snowPts.material.size = W.kind === 'blizzard' ? 0.16 : 0.12;
    }
  }

  save() { return { k: this.kind, l: this.left }; }
  load(o) { if (o && WEATHERS[o.k]) { this.set(o.k, o.l); Object.assign(G.weather, WEATHERS[o.k]); } }
}
export function seasonName() { return SEASONS[G.season]; }
