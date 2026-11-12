import * as THREE from 'three';
import { G, HALF } from '../core/state.js';
import { mulberry32, clamp } from '../core/rng.js';
import * as M from './models.js';
import { natureShader, NATURE_U } from './matfx.js';
import { addCircle, remove as removeCol } from '../core/collide.js';
import { FX } from './fx.js';

// Matériaux du décor (neige, vent)
export const WMAT = {
  world: natureShader(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { snow: true }),
  foliage: natureShader(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { wind: 0.22, snow: true, windHeight: 5 }),
  pine: natureShader(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { wind: 0.12, snow: true, windHeight: 6 }),
  plant: natureShader(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), { wind: 0.12, snow: false, windHeight: 0.8 }),
  grass: natureShader(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false, color: 0x7fb24e }), { wind: 0.18, snow: false, windHeight: 0.5 }),
};

// type : modèle(s), outil requis, résistance, butin, repousse (heures), collision
export const FLORA = {
  chene: { n: 'Chêne', parts: [[M.oakTrunk, 'world'], [M.oakCanopy, 'foliage', 'canopy']], tool: 'hache', hp: 60, r: 0.45, regrow: 96, tree: true,
    drops: () => ({ bois: 4 + rnd(3), ecorce: Math.random() < 0.4 ? 1 : 0 }), chip: '#8a5d38', leaf: '#6aad42' },
  sapin: { n: 'Sapin', parts: [[M.pineTrunk, 'world'], [M.pineCanopy, 'pine']], tool: 'hache', hp: 50, r: 0.4, regrow: 96, tree: true,
    drops: () => ({ bois: 4 + rnd(2) }), chip: '#7a5532', leaf: '#2f6b45' },
  rocher: { n: 'Rocher', parts: [[M.rock, 'world']], tool: 'pioche', hp: 60, r: 1.25, regrow: 144,
    drops: () => ({ pierre: 3 + rnd(3), silex: Math.random() < 0.5 ? 1 + rnd(2) : 0 }), chip: '#8a857a' },
  filon: { n: 'Filon de fer', parts: [[M.oreRock, 'world']], tool: 'pioche', hp: 90, r: 1.15, regrow: 200,
    drops: () => ({ minerai: 2 + rnd(2), pierre: 1 }), chip: '#c06a32' },
  caillou: { n: 'Cailloux', parts: [[M.pebble, 'world']], pick: true, regrow: 30, drops: () => ({ pierre: 1, silex: Math.random() < 0.35 ? 1 : 0 }) },
  branche: { n: 'Branches', parts: [[M.stick, 'world']], pick: true, regrow: 30, drops: () => ({ bois: 1 + rnd(2) }) },
  herbes: { n: 'Hautes herbes', parts: [[M.grassClump, 'plant']], pick: true, regrow: 36,
    drops: () => (G.season === 3 ? { fibre: 1 } : { fibre: 2 + rnd(2), graines_ble: Math.random() < 0.25 ? 1 : 0 }) },
  baies: { n: 'Buisson de baies', parts: [[M.bush, 'foliage']], fruit: '#d8344a', pick: true, regrow: 40, r: 0.6, solidSmall: true,
    drops: () => ({ baies: 2 + rnd(3) }) },
  sombres: { n: 'Buisson de baies sombres', parts: [[M.bush, 'foliage']], fruit: '#3a1f5a', pick: true, regrow: 48, r: 0.6, solidSmall: true,
    drops: () => ({ baies_sombres: 2 + rnd(2) }) },
  achillee: { n: 'Achillée', parts: [[M.herbPlant, 'plant']], pick: true, regrow: 72, season: [1, 1, 1, 0], drops: () => ({ herbe: 1 + rnd(2) }) },
  carotte: { n: 'Carotte sauvage', parts: [[M.carrotPlant, 'plant']], pick: true, regrow: 110, season: [1, 1, 1, 0],
    drops: () => ({ carotte: 1, graines_carotte: Math.random() < 0.6 ? 1 + rnd(2) : 0 }) },
  cepe: { n: 'Cèpes', parts: [[() => M.mushroom(false), 'world']], pick: true, regrow: 60, season: [0.4, 0.2, 1, 0], drops: () => ({ champignon: 1 + rnd(2) }) },
  amanite: { n: 'Amanites', parts: [[() => M.mushroom(true), 'world']], pick: true, regrow: 60, season: [0.4, 0.2, 1, 0], drops: () => ({ amanite: 1 + rnd(2) }) },
};
function rnd(n) { return Math.floor(Math.random() * (n + 1)); }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const CS = 8;

export class Flora {
  constructor(scene, terrain, seed, exclude = []) {
    this.scene = scene; this.t = terrain;
    this.nodes = []; this.grid = new Map(); this.burning = new Set(); this.falling = [];
    const R = mulberry32(seed + 404);
    const near = (x, z, r) => exclude.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + r);
    const place = (k, count, test) => {
      let placed = 0;
      for (let tries = 0; tries < count * 12 && placed < count; tries++) {
        const x = (R() * 2 - 1) * (HALF - 12), z = (R() * 2 - 1) * (HALF - 12);
        const h = terrain.heightAt(x, z);
        if (!test(x, z, h, R)) continue;
        if (near(x, z, 2)) continue;
        if (Math.hypot(x, z) < 7 && FLORA[k].r) continue;
        this.add(k, x, h, z, R() * Math.PI * 2, 0.8 + R() * 0.45);
        placed++;
      }
    };
    const slope = (x, z) => terrain.slopeAt(x, z);
    place('chene', 1100, (x, z, h, r) => h > 1.6 && h < 26 && slope(x, z) < 0.3 && r() < 0.15 + Math.max(0, terrain.forestAt(x, z)) * 1.3 && terrain.mountainAt(x, z) < 0.5);
    place('sapin', 1000, (x, z, h, r) => h > 3 && h < 40 && slope(x, z) < 0.38 && (terrain.mountainAt(x, z) > 0.2 || h > 14 || r() < 0.06) && r() < 0.3 + Math.max(0, terrain.forestAt(x, z)));
    place('rocher', 380, (x, z, h) => h > 0.8 && h < 44);
    place('filon', 110, (x, z, h) => h > 8 && terrain.mountainAt(x, z) > 0.35);
    place('caillou', 520, (x, z, h) => h > 0.6 && h < 35 && slope(x, z) < 0.4);
    place('branche', 650, (x, z, h) => h > 1.2 && h < 30 && slope(x, z) < 0.35 && terrain.forestAt(x, z) > -0.25);
    place('herbes', 900, (x, z, h) => h > 1.2 && h < 22 && slope(x, z) < 0.25 && terrain.forestAt(x, z) < 0.2);
    place('baies', 260, (x, z, h) => h > 1.5 && h < 20 && slope(x, z) < 0.3);
    place('sombres', 110, (x, z, h) => h > 1.5 && h < 20 && slope(x, z) < 0.3 && terrain.forestAt(x, z) > 0);
    place('achillee', 200, (x, z, h) => h > 1.4 && h < 18 && slope(x, z) < 0.25);
    place('carotte', 120, (x, z, h) => h > 1.4 && h < 14 && slope(x, z) < 0.2 && terrain.forestAt(x, z) < 0.1);
    place('cepe', 170, (x, z, h) => h > 2 && h < 24 && terrain.forestAt(x, z) > 0.1);
    place('amanite', 110, (x, z, h) => h > 2 && h < 24 && terrain.forestAt(x, z) > 0.15);
    // de quoi démarrer près du camp
    for (let i = 0; i < 8; i++) { const a = i * 0.8 + 0.3, d = 4 + (i % 3) * 2.5; const x = Math.cos(a) * d, z = Math.sin(a) * d; this.add(i % 2 ? 'branche' : 'caillou', x, terrain.heightAt(x, z), z, a, 1); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 1, d = 9; const x = Math.cos(a) * d, z = Math.sin(a) * d; this.add('herbes', x, terrain.heightAt(x, z), z, a, 1); }
    { const x = 11, z = -6; this.add('baies', x, terrain.heightAt(x, z), z, 0, 1); }
    this.build();
    this.initGrass();
  }

  add(k, x, y, z, ry, s) {
    const n = { i: this.nodes.length, k, x, y, z, ry, s, hp: FLORA[k].hp || 1, st: 0, t: 0, fruit: FLORA[k].fruit ? 1 : 0, col: 0, idx: 0 };
    this.nodes.push(n);
    const key = Math.floor(x / CS) * 73856093 ^ Math.floor(z / CS) * 19349663;
    let a = this.grid.get(key); if (!a) this.grid.set(key, (a = [])); a.push(n);
    return n;
  }

  // Les instances sont regroupées par zones de 80 m : on ne dessine (et n'ombre) que les zones proches et visibles.
  build() {
    const CH = 112;
    const byType = {};
    for (const n of this.nodes) (byType[n.k] = byType[n.k] || []).push(n);
    this.byType = byType;
    this.geos = {}; this.chunks = [];
    const geoFor = (key, fn) => this.geos[key] || (this.geos[key] = fn());
    const fruitMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const k in byType) {
      const def = FLORA[k];
      const groups = new Map();
      for (const n of byType[k]) {
        const ck = Math.floor(n.x / CH) + ',' + Math.floor(n.z / CH);
        let g = groups.get(ck); if (!g) groups.set(ck, (g = []));
        n.idx = g.length; g.push(n);
      }
      for (const [ck, list] of groups) {
        const [ci, cj] = ck.split(',').map(Number);
        const ch = { k, nodes: list, x: (ci + 0.5) * CH, z: (cj + 0.5) * CH, parts: [], dirty: true, small: !def.tree && !def.r };
        const mk = (geoKey, fn, mat, tag, cast) => {
          const im = new THREE.InstancedMesh(geoFor(geoKey, fn), mat, list.length);
          im.castShadow = !!cast; im.receiveShadow = true; im.userData.tag = tag; im.userData.cast = !!cast;
          this.scene.add(im); ch.parts.push(im); return im;
        };
        ch.main = def.parts.map(([fn, mat, tag], i) => mk(k + i, fn, WMAT[mat], tag, def.tree || k === 'rocher' || k === 'filon' || k === 'baies' || k === 'sombres'));
        if (def.fruit) ch.fruit = mk(k + '_fruit', () => M.berries(def.fruit), fruitMat, 'fruit', false);
        if (def.tree) { ch.stump = mk('stump', M.stump, WMAT.world, 'stump', false); ch.burnt = mk('burnt', M.burntTrunk, WMAT.world, 'burnt', true); }
        list.forEach((n) => (n.ch = ch));
        this.chunks.push(ch);
      }
    }
    for (const n of this.nodes) { this.addCollider(n); this.refresh(n, false); }
    this.flushAll();
    for (const ch of this.chunks) for (const im of ch.parts) { im.computeBoundingSphere(); im.boundingSphere.radius += 8; }
  }

  // visibilité par distance et ombres seulement près du joueur
  cull() {
    const c = G.camera.position, vd = G.settings.viewDist + 40, sh = G.quality === 'haut' ? 90 : 65;
    this.chunksReady = true;
    for (const ch of this.chunks) this.cullChunk(ch, c, vd, sh);
  }
  cullChunk(ch, c = G.camera.position, vd = G.settings.viewDist + 40, sh = G.quality === 'haut' ? 90 : 65) {
    const d = Math.hypot(ch.x - c.x, ch.z - c.z) - 79;
    const max = ch.small ? 85 : ch.k === 'baies' || ch.k === 'sombres' || ch.k === 'herbes' ? 150 : vd;
    const vis = d < max;
    for (const im of ch.parts) { const v = vis && im.userData.has !== false; im.visible = v; im.castShadow = v && im.userData.cast && d < sh; }
  }

  addCollider(n) {
    const def = FLORA[n.k];
    if (n.col) { removeCol(n.col); n.col = 0; }
    if (!def.r) return;
    if (n.st === 1 && def.tree) { n.col = addCircle(n.x, n.z, 0.35, n, 0.55); return; }
    n.col = addCircle(n.x, n.z, def.r * n.s * (def.tree ? 1 : 0.85), n, def.solidSmall ? 1.1 : 99);
  }

  avail(n) {
    const s = FLORA[n.k].season; if (!s) return true;
    const v = s[G.season];
    if (v >= 1) return true; if (v <= 0) return false;
    return ((n.i * 7919) % 100) / 100 < v;
  }

  refresh(n, flush = true) {
    const def = FLORA[n.k], ch = n.ch;
    const show = n.st === 0 && this.avail(n);
    _q.setFromAxisAngle(_up, n.ry);
    const mat = _m.compose(_p.set(n.x, n.y - 0.05, n.z), _q, _s.setScalar(n.s));
    ch.main.forEach((im) => {
      let vis = show;
      if (im.userData.tag === 'canopy' && G.season === 3) vis = false;
      im.setMatrixAt(n.idx, vis ? mat : ZERO);
    });
    if (ch.fruit) ch.fruit.setMatrixAt(n.idx, show && n.fruit && this.fruitSeason() ? mat : ZERO);
    if (ch.stump) { ch.stump.setMatrixAt(n.idx, n.st === 1 ? mat : ZERO); ch.burnt.setMatrixAt(n.idx, n.st === 2 ? mat : ZERO); }
    ch.dirty = true;
    if (flush) this.flushChunk(ch);
  }
  fruitSeason() { return G.season === 1 || G.season === 2 || (G.season === 0 && G.seasonT > 0.5); }
  flushChunk(ch) {
    if (!ch.dirty) return;
    for (const im of ch.parts) im.instanceMatrix.needsUpdate = true;
    ch.dirty = false;
    // ne pas dessiner les couches vides (souches, troncs brûlés, fruits)
    let st = 0, bt = 0, fr = 0, ok = 0;
    const fs = this.fruitSeason();
    for (const n of ch.nodes) { if (n.st === 1) st++; else if (n.st === 2) bt++; else if (this.avail(n)) { ok++; if (n.fruit && fs) fr++; } }
    if (ch.stump) { ch.stump.userData.has = st > 0; ch.burnt.userData.has = bt > 0; }
    if (ch.fruit) ch.fruit.userData.has = fr > 0;
    ch.main.forEach((im) => (im.userData.has = ok > 0 && !(im.userData.tag === 'canopy' && G.season === 3)));
    if (this.chunksReady) this.cullChunk(ch);
  }
  flush() { for (const ch of this.chunks) this.flushChunk(ch); }
  flushAll() { this.flush(); }
  refreshAll() { for (const n of this.nodes) this.refresh(n, false); this.flushAll(); }

  query(x, z, r, fn) {
    const i0 = Math.floor((x - r) / CS), i1 = Math.floor((x + r) / CS), j0 = Math.floor((z - r) / CS), j1 = Math.floor((z + r) / CS);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.grid.get(i * 73856093 ^ j * 19349663); if (!a) continue;
      for (const n of a) if (Math.abs(n.x - x) < r && Math.abs(n.z - z) < r) fn(n);
    }
  }

  // un nœud est-il récoltable maintenant ?
  usable(n) {
    const def = FLORA[n.k];
    if (n.st === 2) return def.tree; // arbre brûlé : charbon
    if (n.st !== 0 || !this.avail(n)) return false;
    if (def.fruit) return n.fruit && this.fruitSeason();
    return true;
  }

  // coup d'outil ; renvoie le butin si l'objet tombe
  hit(n, tool, dmg, from) {
    const def = FLORA[n.k];
    const top = n.y + (def.tree ? 1.2 : 0.6);
    FX.chips(n.x, top, n.z, def.chip || '#888', 6);
    if (def.leaf && n.st === 0 && G.season !== 3) FX.leaves(n.x, n.y + 4, n.z, G.season === 2 ? '#d8862a' : def.leaf, 5);
    n.hp -= dmg;
    if (n.hp > 0) return null;
    let drops;
    if (n.st === 2) { drops = { charbon: 2 + rnd(2), bois: 1 }; n.st = 1; }
    else {
      drops = def.drops();
      if (def.tree) { n.st = 1; this.fall(n, from); }
      else n.st = 1;
    }
    n.hp = def.hp; n.t = G.time.total + def.regrow * (0.8 + Math.random() * 0.4);
    this.addCollider(n);
    this.refresh(n);
    return drops;
  }

  pick(n) {
    const def = FLORA[n.k];
    const drops = def.drops();
    if (def.fruit) { n.fruit = 0; n.t = G.time.total + def.regrow; }
    else { n.st = 1; n.t = G.time.total + def.regrow * (0.8 + Math.random() * 0.4); this.addCollider(n); }
    this.refresh(n);
    return drops;
  }

  fall(n, from) {
    const def = FLORA[n.k];
    const g = new THREE.Group();
    n.ch.main.forEach((im) => { if (im.userData.tag === 'canopy' && G.season === 3) return; g.add(new THREE.Mesh(im.geometry, im.material)); });
    g.children.forEach((m) => (m.castShadow = true));
    g.position.set(n.x, n.y, n.z); g.rotation.y = n.ry; g.scale.setScalar(n.s);
    const dir = new THREE.Vector3(n.x - from.x, 0, n.z - from.z).normalize();
    const axis = new THREE.Vector3(dir.z, 0, -dir.x);
    const holder = new THREE.Group(); holder.position.set(n.x, n.y + 0.5, n.z);
    g.position.set(0, -0.5, 0); holder.add(g);
    this.scene.add(holder);
    this.falling.push({ g: holder, axis, t: 0, n, dir, col: def.leaf });
  }

  ignite(n) {
    if (n.st !== 0 || !FLORA[n.k].tree || this.burning.has(n)) return false;
    n.burn = 0; this.burning.add(n); return true;
  }

  update(dt) {
    NATURE_U.uTime.value += dt;
    // arbres qui tombent
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i]; f.t += dt;
      const a = Math.min(Math.PI / 2 - 0.08, f.t * f.t * 1.6);
      f.g.quaternion.setFromAxisAngle(f.axis, a);
      if (f.t > 1.25 && !f.hitGround) {
        f.hitGround = true;
        const tip = 5 * f.n.s;
        FX.leaves(f.n.x + f.dir.x * tip, f.n.y + 1, f.n.z + f.dir.z * tip, G.season === 2 ? '#d8862a' : f.col, 26);
        FX.burst(f.n.x + f.dir.x * tip * 0.6, f.n.y + 0.3, f.n.z + f.dir.z * tip * 0.6, 14, '#b8a27a', { speed: 2.5, up: 1, life: 1.2, size: 0.4, grav: 0.5, alpha: 0.4, grow: 0.6 });
        G.audio && G.audio.play('thud', { x: f.n.x, z: f.n.z });
        G.shake = Math.max(G.shake || 0, 0.25);
      }
      if (f.t > 1.25) f.g.position.y -= dt * 0.8 * (f.t - 1.25);
      if (f.t > 2.4) { this.scene.remove(f.g); this.falling.splice(i, 1); }
    }
    // incendies
    if (this.burning.size) {
      for (const n of this.burning) {
        n.burn += dt;
        if (Math.random() < dt * 14) FX.flame(n.x + (Math.random() - 0.5) * 2, n.y + 1 + Math.random() * 4.5, n.z + (Math.random() - 0.5) * 2, 1.6);
        if (Math.random() < dt * 3) FX.smoke(n.x, n.y + 6, n.z, 1, '#4a4a48', 1.6);
        const rain = G.weather ? G.weather.rain : 0;
        if (rain > 0.4 && Math.random() < dt * 0.25 * rain) { this.burning.delete(n); FX.smoke(n.x, n.y + 3, n.z, 6, '#9a9a98', 1.2); continue; }
        // propagation
        if (Math.random() < dt * 0.22 * (1 + (G.weather ? G.weather.wind : 0)) * (1 - rain)) {
          let best = null;
          this.query(n.x, n.z, 9, (m) => { if (m !== n && m.st === 0 && FLORA[m.k].tree && !this.burning.has(m) && Math.random() < 0.5) best = m; });
          if (best) this.ignite(best);
        }
        if (n.burn > 26) {
          this.burning.delete(n); n.st = 2; n.hp = 30; n.t = G.time.total + 200; this.addCollider(n); this.refresh(n);
        }
      }
    }
    // repousse (par paquets)
    this.regrowCursor = ((this.regrowCursor || 0) + 60) % this.nodes.length;
    const tot = G.time.total;
    const changed = new Set();
    for (let k = 0; k < 60; k++) {
      const n = this.nodes[(this.regrowCursor + k) % this.nodes.length];
      const def = FLORA[n.k];
      if (def.fruit && !n.fruit && n.st === 0 && tot > n.t && this.fruitSeason()) { n.fruit = 1; this.refresh(n, false); changed.add(n.k); }
      if (n.st !== 0 && tot > n.t && G.season !== 3) {
        if (G.player && Math.hypot(G.player.pos.x - n.x, G.player.pos.z - n.z) < 4) continue;
        n.st = 0; n.hp = def.hp; this.addCollider(n); this.refresh(n, false); changed.add(n.k);
      }
    }
    if (changed.size) this.flush();
    this.cullT = (this.cullT || 0) - dt;
    if (this.cullT <= 0) { this.cullT = 0.4; this.cull(); }
    this.updateGrass();
  }

  // --- herbe décorative autour du joueur
  initGrass() {
    const q = G.quality;
    this.grassN = q === 'haut' ? 9000 : q === 'moyen' ? 4500 : 0;
    if (this.grassMesh) { this.scene.remove(this.grassMesh); this.grassMesh.geometry.dispose(); this.grassMesh = null; }
    if (!this.grassN) return;
    this.grassMesh = new THREE.InstancedMesh(M.grassTuft(), WMAT.grass, this.grassN);
    this.grassMesh.receiveShadow = true;
    this.grassMesh.frustumCulled = false;
    this.scene.add(this.grassMesh);
    this.grassAt = null;
  }
  updateGrass() {
    if (!this.grassMesh || !G.player) return;
    const p = G.player.pos;
    const sc = [new THREE.Color(0x8fc85a), new THREE.Color(0x86b347), new THREE.Color(0xb8a24e), new THREE.Color(0x9aa88a)][G.season];
    WMAT.grass.color.copy(sc).lerp(_c.set(0xc8b860), G.dry * 0.7);
    this.grassMesh.visible = G.snow < 0.6;
    if (this.grassAt && Math.hypot(p.x - this.grassAt.x, p.z - this.grassAt.z) < 10) return;
    this.grassAt = { x: p.x, z: p.z };
    const R = mulberry32((Math.floor(p.x / 10) * 31 + Math.floor(p.z / 10)) | 0);
    const rad = G.quality === 'haut' ? 46 : 36;
    let c = 0;
    for (let k = 0; k < this.grassN * 3 && c < this.grassN; k++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * rad;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const h = this.t.heightAt(x, z);
      if (h < 1.3 || h > 28) continue;
      if (this.t.slopeAt(x, z) > 0.22) continue;
      const f = this.t.forestAt(x, z);
      if (R() < f * 0.8) continue;
      _q.setFromAxisAngle(_up, R() * 6.28);
      const sc = 0.55 + R() * 0.35; this.grassMesh.setMatrixAt(c++, _m.compose(_p.set(x, h - 0.05, z), _q, _s.set(sc, sc * (0.6 + R() * 0.7), sc)));
    }
    for (; c < this.grassN; c++) this.grassMesh.setMatrixAt(c, ZERO);
    this.grassMesh.instanceMatrix.needsUpdate = true;
  }

  // --- sauvegarde : seulement ce qui a changé
  save() {
    const out = [];
    for (const n of this.nodes) if (n.st !== 0 || (FLORA[n.k].fruit && !n.fruit) || n.hp !== (FLORA[n.k].hp || 1)) out.push([n.i, n.st, Math.round(n.t * 10) / 10, n.fruit, n.hp]);
    return out;
  }
  load(arr) {
    for (const [i, st, t, fruit, hp] of arr || []) {
      const n = this.nodes[i]; if (!n) continue;
      n.st = st; n.t = t; n.fruit = fruit; n.hp = hp; this.addCollider(n); this.refresh(n, false);
    }
    this.flushAll();
  }
}
const _c = new THREE.Color();
