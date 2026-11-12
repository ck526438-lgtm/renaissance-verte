import * as THREE from 'three';
import { G, HALF } from '../core/state.js';
import { mulberry32 } from '../core/rng.js';
import { POI_MODELS } from './models.js';
import { WMAT } from './flora.js';
import { addBox, addCircle } from '../core/collide.js';
import { Inventory } from '../game/inventory.js';

// Les traces du monde d'avant : ruines, cabanes, épaves, bunkers, et la tanière du Grand Ours.
export const POI_TYPES = {
  ruine: { n: 'Ruines', count: 6, r: 7 },
  cabane: { n: 'Cabane abandonnée', count: 4, r: 5 },
  epave: { n: 'Épave', count: 5, r: 4 },
  bunker: { n: 'Bunker', count: 3, r: 6 },
  tanniere: { n: 'Tanière du Grand Ours', count: 1, r: 8 },
};
const PLANS = ['plan_arbalete', 'plan_plastron', 'plan_lanterne'];

function loot(kind, R, i) {
  const L = [];
  const add = (id, a, b = a, p = 1) => { if (R() < p) L.push([id, a + Math.floor(R() * (b - a + 1))]); };
  if (kind === 'ruine') { add('ferraille', 1, 3); add('silex', 1, 3); add('corde', 1, 2, 0.6); add('os', 1, 2, 0.5); add('graines_courge', 2, 3, 0.35); add('fleche', 3, 6, 0.3); }
  if (kind === 'cabane') { add('corde', 1, 3); add('gourde_vide', 1, 1, 0.8); add('bandage', 1, 3, 0.7); add('conserve', 1, 2, 0.5); add('graines_carotte', 2, 4, 0.6); add('graines_courge', 2, 3, 0.4); add('couteau', 1, 1, 0.3); add('canne', 1, 1, 0.35); add('torche', 1, 2, 0.5); add('chapeau_paille', 1, 1, 0.25); }
  if (kind === 'epave') { add('ferraille', 2, 4); add('fer', 1, 1, 0.3); add('corde', 1, 2, 0.4); add('conserve', 1, 1, 0.3); }
  if (kind === 'bunker') { add('ferraille', 3, 5); add('conserve', 2, 3); add('trousse', 1, 2); add('fleche', 8, 12); add('fer', 2, 3); add('antidote', 1, 1, 0.6); L.push([PLANS[i % PLANS.length], 1]); }
  if (kind === 'tanniere') { add('os', 3, 6); add('fourrure', 1, 2); add('viande', 1, 2, 0.5); }
  return L;
}

export class Pois {
  constructor(scene, terrain, seed) {
    this.list = []; this.lair = null;
    const R = mulberry32(seed + 909);
    const T = terrain;
    const flat = (x, z, r) => {
      let lo = 1e9, hi = -1e9;
      for (let a = 0; a < 8; a++) { const h = T.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      return { lo, hi };
    };
    for (const kind in POI_TYPES) {
      const def = POI_TYPES[kind];
      for (let i = 0, tries = 0; i < def.count && tries < 4000; tries++) {
        const x = (R() * 2 - 1) * (HALF - 40), z = (R() * 2 - 1) * (HALF - 40);
        const d0 = Math.hypot(x, z);
        if (d0 < (kind === 'ruine' ? 45 : 70)) continue;
        const { lo, hi } = flat(x, z, def.r);
        if (lo < 2.2 || hi - lo > (kind === 'tanniere' ? 7 : 2.6)) continue;
        if (kind === 'tanniere' && (T.mountainAt(x, z) < 0.45 || lo < 16)) continue;
        if (kind !== 'tanniere' && lo > 30) continue;
        if (this.list.some((p) => Math.hypot(p.x - x, p.z - z) < 70)) continue;
        this.place(scene, kind, x, lo, z, R() * Math.PI * 2, R, i);
        i++;
      }
    }
  }

  place(scene, kind, x, y, z, rot, R, i) {
    const m = new THREE.Mesh(POI_MODELS[kind](i), WMAT.world);
    m.position.set(x, y - 0.2, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const p = { kind, n: POI_TYPES[kind].n, x, y, z, rot, found: false, crates: [] };
    const c = Math.cos(rot), s = Math.sin(rot);
    const local = (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
    // collisions et caisses
    if (kind === 'ruine') { for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; addCircle(x + Math.cos(a) * 4.5, z + Math.sin(a) * 4.5, 1.1, p); } addCircle(x, z, 0.6, p); p.crates.push(local(1.8, -2.2)); }
    if (kind === 'cabane') {
      const q = Math.abs(Math.sin(rot)) > 0.7;
      addBox(x, z, 2.4, 2.1, p, -99, -98); // marqueur
      [[0, -1.8, 2.3, 0.3], [-2.1, 0, 0.3, 2], [2.1, 0, 0.3, 2], [-1.4, 1.8, 0.75, 0.3], [1.4, 1.8, 0.75, 0.3]].forEach(([lx, lz, hw, hd]) => {
        const w = local(lx, lz); addBox(w.x, w.z, q ? hd : hw, q ? hw : hd, p, y - 1, y + 2.4);
      });
      G.buildings.addRoofZone(x, z, 2.2, 1.9, y + 2.3);
      p.crates.push(local(-1.2, -0.9));
    }
    if (kind === 'epave') { addCircle(x, z, 1.6, p, y + 1.6); p.crates.push(local(0.5, 1.6)); }
    if (kind === 'bunker') { const q = Math.abs(Math.sin(rot)) > 0.7; addBox(x, z, q ? 3 : 3.5, q ? 3.5 : 3, p, y - 2, y + 3.5); p.crates.push(local(1.4, 3.8)); }
    if (kind === 'tanniere') { addCircle(x, z - 1, 4.6, p, y + 3); addCircle(x + 3.6, z + 0.5, 2.2, p); addCircle(x - 3.6, z + 0.8, 2.1, p); this.lair = p; p.crates.push(local(1.8, 4.4)); }
    // caisses de butin
    p.crates = p.crates.map((w, k) => {
      const cm = new THREE.Mesh(this.crateGeo || (this.crateGeo = POI_MODELS.caisse()), WMAT.world);
      const cy = G.terrain.heightAt(w.x, w.z);
      cm.position.set(w.x, cy, w.z); cm.rotation.y = rot; cm.castShadow = true; scene.add(cm);
      const inv = new Inventory(8, 'caisse');
      loot(kind, R, i).forEach(([id, n]) => inv.add(id, n));
      return { x: w.x, y: cy, z: w.z, mesh: cm, inv, open: false, poi: p, title: kind === 'bunker' ? 'Casier du bunker' : kind === 'tanniere' ? 'Ossements' : 'Caisse' };
    });
    this.list.push(p);
  }

  update() {
    const pp = G.player.pos;
    for (const p of this.list) {
      if (p.found) continue;
      if (Math.hypot(p.x - pp.x, p.z - pp.z) < 30) {
        p.found = true;
        G.toast('Découverte : ' + p.n, 'good');
        G.audio && G.audio.play('quest');
      }
    }
  }

  crateNear(x, z, r) {
    let best = null, bd = r;
    for (const p of this.list) for (const c of p.crates) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  save() { return this.list.map((p) => ({ f: p.found, c: p.crates.map((c) => c.inv.toJSON()) })); }
  load(arr) {
    (arr || []).forEach((o, i) => { const p = this.list[i]; if (!p) return; p.found = o.f; (o.c || []).forEach((inv, k) => p.crates[k] && p.crates[k].inv.load(inv)); });
  }
}
