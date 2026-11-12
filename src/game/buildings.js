import * as THREE from 'three';
import { G, isNight, emit } from '../core/state.js';
import { clamp } from '../core/rng.js';
import { BUILD_MODELS, cropModel, dropModel, MAT } from '../world/models.js';
import { WMAT } from '../world/flora.js';
import { addCircle, addBox, remove as removeCol, addFloor, removeFloor, query } from '../core/collide.js';
import { Inventory } from './inventory.js';
import { ITEMS } from './items.js';
import { FX } from '../world/fx.js';

// grid : 'cell' (case de 3 m), 'edge' (bord de case), libre sinon
export const BUILDS = {
  feu: { n: 'Feu de camp', cost: { bois: 4, pierre: 4 }, cat: 'Base', r: 0.7, low: true, desc: 'Cuisine, chaleur, lumière. Éloigne les loups. Se nourrit de bois.' },
  etabli: { n: 'Établi', cost: { bois: 8, pierre: 2 }, cat: 'Base', r: 0.9, desc: 'Armes, outils de fer, vêtements.' },
  forge: { n: 'Forge', cost: { pierre: 18, bois: 6, silex: 2 }, cat: 'Base', r: 1.0, desc: 'Fond le minerai et la ferraille en lingots.' },
  sechoir: { n: 'Séchoir', cost: { bois: 6, corde: 2 }, cat: 'Base', r: 0.6, desc: 'Sèche viande, poisson et baies : ils ne pourriront plus.' },
  coffre: { n: 'Coffre', cost: { bois: 10 }, cat: 'Base', r: 0.6, desc: '16 places de rangement.' },
  lit: { n: 'Lit', cost: { bois: 6, fibre: 10, peau: 2 }, cat: 'Base', r: 0.8, desc: 'Dormir, passer la nuit, réapparaître ici.' },
  torche: { n: 'Torche sur pied', cost: { bois: 2, fibre: 1, charbon: 1 }, cat: 'Base', r: 0.15, desc: 'Éclaire la nuit et tient les loups à distance.' },
  collecteur: { n: 'Récupérateur d’eau', cost: { bois: 6, peau: 1 }, cat: 'Base', r: 0.6, desc: 'Recueille l’eau de pluie, potable.' },
  sol: { n: 'Plancher', cost: { bois: 5 }, cat: 'Abri', grid: 'cell', desc: 'Une surface plane de 3 × 3 m.' },
  mur: { n: 'Mur de rondins', cost: { bois: 6 }, cat: 'Abri', grid: 'edge', hp: 260, desc: 'Arrête le vent… et les loups.' },
  porte: { n: 'Encadrement de porte', cost: { bois: 4 }, cat: 'Abri', grid: 'edge', hp: 200, desc: 'Un passage dans le mur.' },
  toit: { n: 'Toit de chaume', cost: { bois: 4, fibre: 6 }, cat: 'Abri', grid: 'cell', roof: true, desc: 'Au sec : la pluie ne te mouille plus, +4 °C.' },
  cloture: { n: 'Clôture', cost: { bois: 3 }, cat: 'Défense', grid: 'edge', hp: 120, desc: 'Basse : on l’enjambe, pas les bêtes.' },
  pieux: { n: 'Palissade de pieux', cost: { bois: 6 }, cat: 'Défense', grid: 'edge', hp: 200, desc: 'Blesse les bêtes qui s’y frottent.' },
  parcelle: { n: 'Parcelle cultivée', cost: { bois: 4, fibre: 2 }, cat: 'Ferme', r: 1.4, flat: true, low: true, desc: 'Sème, arrose, récolte. Rien ne pousse en hiver.' },
  epouvantail: { n: 'Épouvantail', cost: { bois: 3, fibre: 4 }, cat: 'Ferme', r: 0.3, desc: 'Protège les cultures des lapins (12 m).' },
  poulailler: { n: 'Poulailler', cost: { bois: 10, fibre: 6 }, cat: 'Ferme', r: 1.1, desc: 'Les poules apprivoisées y pondent chaque matin.' },
};
const GRID = 3;
const SECHE = { viande: ['viande_sechee', 12], poisson: ['poisson_fume', 12], baies: ['baies_sechees', 8], pourri: ['compost', 16] };
const CROPS = { ble: { n: 'Blé', h: [14, 30], out: 'ble', seed: 'graines_ble' }, carotte: { n: 'Carottes', h: [12, 26], out: 'carotte', seed: 'graines_carotte' }, courge: { n: 'Courges', h: [20, 44], out: 'courge', seed: 'graines_courge' } };
export { CROPS };

export class Buildings {
  constructor(scene) {
    this.scene = scene; this.list = new Map(); this.next = 1;
    this.geos = {}; this.roofs = new Map(); this.roofZones = [];
    this.lights = []; for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(0xff9a40, 0, 16, 1.5); scene.add(l); this.lights.push(l); }
    this.ghost = null; this.fireT = 0;
  }
  geo(k) { return this.geos[k] || (this.geos[k] = BUILD_MODELS[k]()); }

  // ---------- placement ----------
  snap(k, x, z, rot) {
    const g = BUILDS[k].grid;
    if (g === 'cell') return { x: (Math.floor(x / GRID) + 0.5) * GRID, z: (Math.floor(z / GRID) + 0.5) * GRID, rot: 0 };
    if (g === 'edge') {
      const r = ((Math.round(rot / (Math.PI / 2)) % 2) + 2) % 2;
      if (r === 0) return { x: (Math.floor(x / GRID) + 0.5) * GRID, z: Math.round(z / GRID) * GRID, rot: 0 };
      return { x: Math.round(x / GRID) * GRID, z: (Math.floor(z / GRID) + 0.5) * GRID, rot: Math.PI / 2 };
    }
    return { x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2, rot };
  }
  baseY(k, x, z, rot) {
    const T = G.terrain, def = BUILDS[k];
    if (def.grid === 'cell') {
      const pts = [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4], [0, 0]].map(([a, b]) => T.heightAt(x + a, z + b));
      const fl = this.floorY(x, z);
      if (def.roof) return Math.max(Math.max(...pts), fl ?? -99) + 2.75;
      return Math.max(...pts) + 0.12;
    }
    if (def.grid === 'edge') {
      const dx = rot ? 0 : 1.4, dz = rot ? 1.4 : 0;
      const pts = [T.heightAt(x - dx, z - dz), T.heightAt(x + dx, z + dz), T.heightAt(x, z)];
      const fl = Math.max(this.floorY(x + (rot ? 0.8 : 0), z + (rot ? 0 : 0.8)) ?? -99, this.floorY(x - (rot ? 0.8 : 0), z - (rot ? 0 : 0.8)) ?? -99);
      return Math.max(Math.min(...pts) - 0.15, fl);
    }
    const fl = this.floorY(x, z);
    return Math.max(T.heightAt(x, z), fl ?? -99);
  }
  floorY(x, z) {
    let y = null;
    for (const s of this.list.values()) if (s.k === 'sol' && Math.abs(s.x - x) < 1.5 && Math.abs(s.z - z) < 1.5) y = Math.max(y ?? -99, s.y + 0.06);
    return y;
  }
  valid(k, x, y, z, rot) {
    const def = BUILDS[k], T = G.terrain;
    if (y < G.waterLevel + 0.05 && !def.roof) return 'Pas dans l’eau';
    if (Math.hypot(x - G.player.pos.x, z - G.player.pos.z) > 9) return 'Trop loin';
    if (def.grid === 'cell' && !def.roof) {
      const pts = [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].map(([a, b]) => T.heightAt(x + a, z + b));
      if (Math.max(...pts) - Math.min(...pts) > 1.6) return 'Terrain trop pentu';
    }
    if (def.flat || (!def.grid && !this.floorY(x, z))) {
      if (T.slopeAt(x, z) > (def.flat ? 0.16 : 0.32)) return 'Terrain trop pentu';
    }
    for (const s of this.list.values()) {
      if (!BUILDS[s.k]) continue;
      if (def.grid && s.k !== 'sol' && BUILDS[s.k].grid === def.grid && Math.abs(s.x - x) < 0.3 && Math.abs(s.z - z) < 0.3 && (def.roof === BUILDS[s.k].roof)) return 'Déjà construit ici';
      if (def.grid === 'cell' && s.k === k && Math.abs(s.x - x) < 0.3 && Math.abs(s.z - z) < 0.3) return 'Déjà construit ici';
      if (!def.grid && !BUILDS[s.k].grid && Math.hypot(s.x - x, s.z - z) < (def.r || 0.5) + (BUILDS[s.k].r || 0.5) - 0.1) return 'Trop près d’un autre ouvrage';
    }
    if (!def.roof) {
      let blocked = false;
      const r = def.grid === 'cell' ? 1.6 : def.grid === 'edge' ? 1.5 : (def.r || 0.5);
      query(x, z, r + 1.5, (c) => {
        if (blocked || !c.data || c.data.kind === 'build' || c.data === G.player) return;
        if (c.kind === 'circle' && c.y1 > 2) {
          const dx = Math.abs(c.x - x), dz = Math.abs(c.z - z);
          if (def.grid === 'edge') { if ((rot ? dz : dx) < 1.5 + c.r && (rot ? dx : dz) < 0.3 + c.r) blocked = true; }
          else if (def.grid === 'cell') { if (dx < 1.5 + c.r * 0.5 && dz < 1.5 + c.r * 0.5) blocked = true; }
          else if (Math.hypot(dx, dz) < r + c.r) blocked = true;
        }
      });
      if (blocked) return 'Un arbre ou un rocher gêne';
    }
    return null;
  }

  startPlacing(k) {
    this.cancelPlacing();
    const mat = MAT.ghostOk;
    this.ghost = new THREE.Mesh(this.geo(k), mat);
    this.ghost.renderOrder = 10;
    this.scene.add(this.ghost);
    G.placing = { k, rot: 0, ok: false, why: '' };
    emit('placing', G.placing);
  }
  cancelPlacing() {
    if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; }
    if (G.placing) { G.placing = null; emit('placing', null); }
  }
  updateGhost() {
    const P = G.placing; if (!P || !this.ghost) return;
    const pl = G.player;
    const dir = pl.lookDir(_v);
    const dist = BUILDS[P.k].grid ? 4.2 : 3;
    let tx = pl.pos.x + dir.x / Math.max(0.3, Math.hypot(dir.x, dir.z)) * dist, tz = pl.pos.z + dir.z / Math.max(0.3, Math.hypot(dir.x, dir.z)) * dist;
    const sn = this.snap(P.k, tx, tz, P.rot + (BUILDS[P.k].grid === 'edge' ? 0 : 0));
    const y = this.baseY(P.k, sn.x, sn.z, sn.rot);
    P.x = sn.x; P.z = sn.z; P.y = y; P.r = sn.rot;
    this.ghost.position.set(sn.x, y, sn.z); this.ghost.rotation.y = sn.rot;
    const why = this.valid(P.k, sn.x, y, sn.z, sn.rot);
    const afford = G.inv.has(BUILDS[P.k].cost);
    P.ok = !why && afford; P.why = why || (afford ? '' : 'Il manque des matériaux');
    this.ghost.material = P.ok ? MAT.ghostOk : MAT.ghostBad;
  }
  confirmPlacing() {
    const P = G.placing; if (!P) return false;
    if (!P.ok) { G.toast(P.why || 'Impossible ici', 'bad'); G.audio && G.audio.play('bad'); return false; }
    G.inv.pay(BUILDS[P.k].cost);
    const s = this.add(P.k, P.x, P.y, P.z, P.r);
    G.stats.built++;
    G.audio && G.audio.play('build', { x: P.x, z: P.z });
    FX.burst(P.x, P.y + 0.3, P.z, 16, '#b8a27a', { speed: 2.5, up: 1.2, life: 1, size: 0.35, grav: 0.4, alpha: 0.45, grow: 0.5 });
    emit('built', s);
    if (!G.inv.has(BUILDS[P.k].cost)) { this.cancelPlacing(); G.toast(BUILDS[P.k].n + ' construit. Plus assez de matériaux pour un autre.'); }
    return true;
  }

  // ---------- structures ----------
  add(k, x, y, z, rot = 0, data = null, id = null) {
    const def = BUILDS[k];
    const s = { id: id || this.next++, k, x, y, z, rot, hp: def.hp || 150, data: data || {}, col: [], kind: 'build' };
    this.next = Math.max(this.next, s.id + 1);
    const m = new THREE.Mesh(this.geo(k), WMAT.world);
    m.position.set(x, y, z); m.rotation.y = rot; m.castShadow = !def.low; m.receiveShadow = true;
    m.userData.build = s;
    this.scene.add(m); s.mesh = m;
    s.grow = 0;
    // collisions
    const along = Math.abs(Math.sin(rot)) > 0.5;
    if (k === 'mur') s.col.push(addBox(x, z, along ? 0.28 : 1.5, along ? 1.5 : 0.28, s, y - 0.5, y + 2.7));
    else if (k === 'pieux') s.col.push(addBox(x, z, along ? 0.35 : 1.5, along ? 1.5 : 0.35, s, y - 0.5, y + 1.6));
    else if (k === 'cloture') s.col.push(addBox(x, z, along ? 0.12 : 1.5, along ? 1.5 : 0.12, s, y - 0.5, y + 1.0));
    else if (k === 'porte') { s.col.push(addCircle(x + (along ? 0 : 1.38), z + (along ? 1.38 : 0), 0.22, s, y + 2.7)); s.col.push(addCircle(x - (along ? 0 : 1.38), z - (along ? 1.38 : 0), 0.22, s, y + 2.7)); }
    else if (k === 'sol') s.floor = addFloor(x, z, 1.5, 1.5, y + 0.06, s);
    else if (k === 'toit') this.roofs.set(s.id, s);
    else if (k === 'parcelle') { /* on marche dessus */ }
    else if (def.r) s.col.push(addCircle(x, z, def.r, s, y + (def.low ? 0.4 : 2.2)));
    // données propres
    if (k === 'coffre' && !(s.data.inv instanceof Inventory)) { const inv = new Inventory(16, 'coffre'); inv.load(s.data.inv); s.data.inv = inv; }
    if (k === 'sechoir' && !(s.data.inv instanceof Inventory)) { const inv = new Inventory(6, 'sechoir'); inv.load(s.data.inv); s.data.inv = inv; }
    if (k === 'feu') { if (s.data.fuel === undefined) s.data.fuel = 3; this.addFlame(s); }
    if (k === 'torche') this.addFlame(s, 1.72, 0.35);
    if (k === 'collecteur' && s.data.w === undefined) s.data.w = 0;
    if (k === 'poulailler') { s.data.eggs = s.data.eggs || 0; }
    if (k === 'parcelle') this.updateCropMesh(s);
    this.list.set(s.id, s);
    return s;
  }

  addFlame(s, h = 0.35, k = 1) {
    const g = new THREE.Mesh(new THREE.ConeGeometry(0.3 * k, 0.8 * k, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85 }));
    g.position.set(s.x, s.y + h + 0.35 * k, s.z); this.scene.add(g); s.flame = g; s.flameH = h; s.flameK = k;
  }

  removeStruct(s, quiet = false) {
    this.scene.remove(s.mesh);
    if (s.flame) this.scene.remove(s.flame);
    if (s.crop) this.scene.remove(s.crop);
    for (const c of s.col) removeCol(c);
    if (s.floor) removeFloor(s.floor);
    this.roofs.delete(s.id);
    this.list.delete(s.id);
    if (!quiet) FX.burst(s.x, s.y + 0.5, s.z, 20, '#8a5d38', { speed: 3, up: 3, life: 0.9, size: 0.12, grav: 12 });
  }
  dismantle(s) {
    const cost = BUILDS[s.k].cost;
    for (const k in cost) G.inv.add(k, Math.max(1, Math.floor(cost[k] / 2)));
    if (s.data.inv) for (const st of s.data.inv.slots) if (st) G.inv.putStack(st);
    if (s.k === 'parcelle' && s.data.crop) G.inv.add(CROPS[s.data.crop].seed, 1);
    this.removeStruct(s);
    G.audio && G.audio.play('break');
    G.toast(BUILDS[s.k].n + ' démonté : la moitié des matériaux récupérée.');
  }
  damageStruct(s, dmg) {
    s.hp -= dmg;
    FX.chips(s.x, s.y + 1, s.z, '#8a5d38', 5);
    if (s.hp <= 0) { this.removeStruct(s); G.toast(BUILDS[s.k].n + ' a été détruit !', 'bad'); }
  }

  nearest(x, z, r, filter) {
    let best = null, bd = r;
    for (const s of this.list.values()) { if (filter && !filter(s)) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  bedExists(sp) { return sp && sp.id && this.list.has(sp.id); }
  litFire(s) { return s.k === 'feu' && s.data.fuel > 0; }

  // chaleur reçue 0..1
  fireHeat(x, y, z) {
    let h = 0;
    for (const s of this.list.values()) {
      if (!this.litFire(s)) continue;
      const d = Math.hypot(s.x - x, s.z - z, (s.y - y) * 0.5);
      if (d < 6) h = Math.max(h, 1 - d / 6);
    }
    if (G.flora.burning.size) for (const n of G.flora.burning) { const d = Math.hypot(n.x - x, n.z - z); if (d < 10) h = Math.max(h, 1.4 - d / 10); }
    return h;
  }
  // une source qui effraie les loups ?
  scary(x, z, r = 9) {
    for (const s of this.list.values()) if ((this.litFire(s) || (s.k === 'torche' && isNight())) && Math.hypot(s.x - x, s.z - z) < (s.k === 'torche' ? r * 0.8 : r)) return true;
    return false;
  }
  roofAt(x, z, y) {
    for (const s of this.roofs.values()) if (Math.abs(s.x - x) < 1.6 && Math.abs(s.z - z) < 1.6 && s.y > y + 0.8 && s.y < y + 6) return true;
    for (const r of this.roofZones) if (Math.abs(r.x - x) < r.hw && Math.abs(r.z - z) < r.hd && r.y > y) return true;
    return false;
  }
  addRoofZone(x, z, hw, hd, y) { this.roofZones.push({ x, z, hw, hd, y }); }
  campCenter() {
    const f = [...this.list.values()].filter((s) => s.k === 'lit' || s.k === 'feu' || s.k === 'mur');
    if (!f.length) return null;
    let x = 0, z = 0; f.forEach((s) => { x += s.x; z += s.z; });
    return { x: x / f.length, z: z / f.length, n: f.length };
  }

  // butin posé au sol (sac après la mort, caisse de ruine…)
  addDrop(x, z, stacks, title = 'Sac') {
    const inv = new Inventory(Math.max(8, stacks.length), 'drop');
    stacks.forEach((st, i) => (inv.slots[i] = st));
    const y = Math.max(G.terrain.heightAt(x, z), G.waterLevel);
    const m = new THREE.Mesh(this._dropGeo || (this._dropGeo = dropModel()), MAT.vc);
    m.position.set(x, y, z); m.castShadow = true; this.scene.add(m);
    const s = { id: this.next++, k: 'drop', x, y, z, rot: 0, data: { inv, title }, col: [], mesh: m, kind: 'drop' };
    this.list.set(s.id, s);
    return s;
  }

  // ---------- cultures ----------
  updateCropMesh(s) {
    if (s.crop) { this.scene.remove(s.crop); s.crop = null; }
    const d = s.data; if (!d.crop) return;
    const stage = d.dead ? 3 : d.stage;
    const key = d.crop + stage;
    this.cropGeos = this.cropGeos || {};
    const g = this.cropGeos[key] || (this.cropGeos[key] = cropModel(d.crop, stage));
    const m = new THREE.Mesh(g, WMAT.plant);
    m.position.set(s.x, s.y, s.z); m.rotation.y = s.rot; m.castShadow = true;
    this.scene.add(m); s.crop = m;
  }
  cropInfo(s) {
    const d = s.data; if (!d.crop) return 'Parcelle vide';
    const c = CROPS[d.crop];
    if (d.dead) return c.n + ' : fanés';
    if (d.stage >= 2) return c.n + ' : prêts à récolter';
    const need = c.h[d.stage] - (d.stage ? c.h[d.stage - 1] : 0);
    const done = d.g - (d.stage ? c.h[d.stage - 1] : 0);
    const pct = Math.round(clamp(done / need, 0, 1) * 100);
    const w = d.water > 0 ? 'arrosé' : 'sec';
    return `${c.n} : ${pct} % (${d.stage === 0 ? 'pousses' : 'en croissance'}, ${w}${d.fert ? ', engraissé' : ''}${G.season === 3 ? ', en dormance' : ''})`;
  }

  // ---------- mise à jour ----------
  update(dt, hours) {
    const night = isNight();
    const W = G.weather;
    // lumières : les feux les plus proches
    const cand = [];
    for (const s of this.list.values()) {
      if (s.k === 'feu') {
        const lit = s.data.fuel > 0;
        if (lit) {
          const under = this.roofAt(s.x, s.z, s.y);
          s.data.fuel = Math.max(0, s.data.fuel - hours * (W.rain > 0.3 && !under && !W.snow ? 2.5 : 1));
          if (G.waterLevel > s.y + 0.1) s.data.fuel = 0;
          if (s.data.fuel <= 0) G.toast('Un feu de camp s’est éteint.', 'warn');
          if (Math.random() < dt * 22) FX.flame(s.x, s.y + 0.25, s.z, 1);
          if (Math.random() < dt * 2.5) FX.smoke(s.x, s.y + 1.4, s.z);
        }
        s.flame.visible = lit; if (lit) { s.flame.scale.set(1, 0.8 + Math.sin(G.t * 12 + s.id) * 0.15 + Math.random() * 0.1, 1); s.flame.rotation.y += dt * 2; }
        if (lit) cand.push(s);
      } else if (s.k === 'torche') {
        s.flame.visible = true; if (Math.random() < dt * 8) FX.flame(s.x, s.y + 1.78, s.z, 0.35);
        cand.push(s);
      }
      if (s.k === 'sechoir') this.dry(s, hours);
      else if (s.k === 'parcelle') this.grow(s, hours);
      else if (s.k === 'collecteur' && W.rain > 0.3 && !W.snow) s.data.w = Math.min(4, s.data.w + hours * 0.4 * W.rain);
      else if (s.k === 'pieux') this.spikes(s, dt);
      if (s.grow < 1 && s.mesh) { s.grow = Math.min(1, s.grow + dt * 3); const e = 1 - Math.pow(1 - s.grow, 3); s.mesh.scale.set(1, 0.2 + 0.8 * e, 1); }
      // feu de forêt tout proche : les ouvrages en bois brûlent
      if (G.flora.burning.size && s.kind === 'build' && s.k !== 'forge' && s.k !== 'feu' && s.mesh) {
        for (const n of G.flora.burning) if (Math.abs(n.x - s.x) < 4 && Math.abs(n.z - s.z) < 4) { s.hp -= dt * 12; if (Math.random() < dt * 6) FX.flame(s.x, s.y + 1, s.z, 1.2); if (s.hp <= 0) { this.removeStruct(s); G.toast(BUILDS[s.k].n + ' a brûlé.', 'bad'); } break; }
      }
    }
    const p = G.player.pos;
    cand.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    this.lights.forEach((l, i) => {
      const s = cand[i];
      if (!s) { l.intensity = 0; return; }
      const fl = 0.85 + Math.sin(G.t * 9 + i) * 0.08 + Math.random() * 0.1;
      l.position.set(s.x, s.y + (s.k === 'torche' ? 1.9 : 0.9), s.z);
      l.intensity = (s.k === 'torche' ? 10 : 22) * fl * (night ? 1.2 : 0.5);
      l.distance = s.k === 'torche' ? 12 : 16;
    });
    // poulailler : ponte chaque matin
    const day = G.time.day;
    if (this.lastDay !== day && G.time.hour > 6) {
      this.lastDay = day;
      for (const s of this.list.values()) if (s.k === 'poulailler') { const hens = G.animals ? G.animals.hensOf(s) : 0; s.data.eggs = Math.min(10, s.data.eggs + hens); s.data.feathers = Math.min(10, (s.data.feathers || 0) + Math.ceil(hens / 2)); }
      this.pests();
    }
  }

  dry(s, hours) {
    const inv = s.data.inv;
    inv.slots.forEach((st, i) => {
      if (!st || !SECHE[st.id]) return;
      st.p = (st.p || 0) + hours * (G.weather.rain > 0.3 && !this.roofAt(s.x, s.z, s.y) ? 0.3 : 1) * (G.nearFireOf ? 1 : 1);
      if (st.p >= SECHE[st.id][1]) { inv.slots[i] = { id: SECHE[st.id][0], n: st.n }; emit('inv', inv); }
    });
  }

  grow(s, hours) {
    const d = s.data; if (!d.crop || d.dead) return;
    const W = G.weather;
    if (W.rain > 0.3 && !W.snow) d.water = 18;
    if (G.waterLevel > s.y + 0.05) { d.dead = true; this.updateCropMesh(s); G.toast('La crue a noyé une parcelle.', 'bad'); return; }
    if (G.airTemp < -3 && d.stage < 2) { d.dead = true; this.updateCropMesh(s); G.toast('Le gel a tué une parcelle.', 'bad'); return; }
    if (G.season === 3) return;
    if (d.water > 0) {
      d.water -= hours * (1 + G.dry);
      const sea = [1.2, 1, 0.75, 0][G.season];
      d.g += hours * sea * (d.fert ? 2 : 1);
      d.thirst = 0;
    } else {
      d.thirst = (d.thirst || 0) + hours;
      if (d.thirst > 30) { d.dead = true; this.updateCropMesh(s); G.toast('Une parcelle a séché sur pied.', 'bad'); return; }
    }
    const c = CROPS[d.crop];
    const stage = d.g >= c.h[1] ? 2 : d.g >= c.h[0] ? 1 : 0;
    if (stage !== d.stage) { d.stage = stage; this.updateCropMesh(s); if (stage === 2) G.toast(c.n + ' : prêts à récolter.', 'good'); }
  }

  pests() {
    for (const s of this.list.values()) {
      if (s.k !== 'parcelle' || !s.data.crop || s.data.dead || s.data.stage === 0) continue;
      const guard = this.nearest(s.x, s.z, 12, (q) => q.k === 'epouvantail');
      if (!guard && Math.random() < 0.22) { s.data.g = 0; s.data.stage = 0; this.updateCropMesh(s); G.toast('Des lapins ont grignoté une parcelle cette nuit. Un épouvantail les éloignerait.', 'warn'); }
    }
  }

  spikes(s, dt) {
    if (!G.animals) return;
    for (const a of G.animals.list) {
      if (!a.def.hostile || a.dead) continue;
      if (Math.abs(a.pos.x - s.x) < 1.9 && Math.abs(a.pos.z - s.z) < 1.9) {
        a.spikeT = (a.spikeT || 0) - dt;
        if (a.spikeT <= 0) { a.spikeT = 0.8; G.animals.hurt(a, 12, s); s.hp -= 2; }
      }
    }
  }

  save() {
    const out = [];
    for (const s of this.list.values()) {
      const data = { ...s.data };
      if (data.inv instanceof Inventory) data.inv = data.inv.toJSON();
      out.push({ id: s.id, k: s.k, x: s.x, y: s.y, z: s.z, r: s.rot, hp: s.hp, d: data });
    }
    return out;
  }
  load(arr) {
    for (const o of arr || []) {
      if (o.k === 'drop') { const inv = o.d.inv; const s = this.addDrop(o.x, o.z, (inv || []).filter(Boolean), o.d.title); s.id = o.id; continue; }
      if (!BUILDS[o.k]) continue;
      const s = this.add(o.k, o.x, o.y, o.z, o.r, o.d, o.id); s.hp = o.hp; s.grow = 1; s.mesh.scale.set(1, 1, 1);
    }
  }
}
const _v = new THREE.Vector3();
export { GRID, SECHE };
export function buildName(k) { return BUILDS[k] ? BUILDS[k].n : k; }
export function itemHas(id) { return ITEMS[id]; }
