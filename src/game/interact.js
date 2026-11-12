import * as THREE from 'three';
import { G, emit } from '../core/state.js';
import { input } from '../core/input.js';
import { ITEMS, itemName } from './items.js';
import { FLORA } from '../world/flora.js';
import { BUILDS, CROPS } from './buildings.js';
import { FAUNA } from '../entities/animals.js';
import { FX } from '../world/fx.js';
import { segmentBlocked } from '../core/collide.js';

// Ce que le joueur vise, et ce que font les boutons Action / Utiliser.
const _f = new THREE.Vector3(), _d = new THREE.Vector3();
const ARROW_GEO = new THREE.BoxGeometry(0.03, 0.03, 0.7);
const ARROW_MAT = new THREE.MeshLambertMaterial({ color: 0xc79a6a });

export class Interact {
  constructor(scene) {
    this.scene = scene; this.cd = 0; this.holdT = 0; this.arrows = []; this.ground = []; this.fishing = null; this.target = null;
    this.bobber = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe04a3a }));
    this.bobber.visible = false; scene.add(this.bobber);
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.6 }));
    this.line.visible = false; this.line.frustumCulled = false; scene.add(this.line);
  }

  forward() { const P = G.player; return P.view === 1 ? P.lookDir(_f).setY(0).normalize() : P.forward(_f); }

  // ---------- ciblage ----------
  findTarget() {
    const P = G.player, p = P.pos, f = this.forward();
    let best = null, bs = 1e9;
    const consider = (kind, obj, x, z, r, y = p.y) => {
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz) - r;
      if (d > 2.6) return;
      const dot = d < 0.3 ? 1 : (dx * f.x + dz * f.z) / Math.max(0.01, Math.hypot(dx, dz));
      if (dot < 0.35) return;
      if (Math.abs(y - p.y) > 3.5) return;
      const s = Math.max(0, d) + (1 - dot) * 2.2;
      if (s < bs) { bs = s; best = { kind, obj, x, z }; }
    };
    G.flora.query(p.x, p.z, 4.5, (n) => { if (G.flora.usable(n) || G.flora.burning.has(n)) consider('flora', n, n.x, n.z, FLORA[n.k].tree ? 0.4 : FLORA[n.k].r ? FLORA[n.k].r * 0.8 : 0.2, n.y); });
    for (const a of G.animals.list) if (a.m.group.visible) consider('animal', a, a.pos.x, a.pos.z, a.def.size * (a.def.big ? 1.6 : 1), a.pos.y);
    for (const s of G.buildings.list.values()) { const r = s.k === 'parcelle' ? 1.5 : BUILDS[s.k] ? (BUILDS[s.k].grid ? 1.2 : BUILDS[s.k].r || 0.6) : 0.4; consider('build', s, s.x, s.z, r, s.y); }
    const c = G.pois.crateNear(p.x, p.z, 4); if (c) consider('crate', c, c.x, c.z, 0.4, c.y);
    for (const g of this.ground) consider('ground', g, g.x, g.z, 0.2, g.y);
    if (!best) {
      // de l'eau devant ?
      for (const k of [1.2, 2, 2.8]) {
        const x = p.x + f.x * k, z = p.z + f.z * k;
        if (G.terrain.heightAt(x, z) < G.waterLevel - 0.15 && G.frozen < 0.6) { best = { kind: 'water', x, z }; break; }
      }
      if (!best && P.swimming) best = { kind: 'water', x: p.x, z: p.z };
    }
    this.target = best;
    return best;
  }

  // textes d'aide : [action, utiliser]
  prompt() {
    const t = this.target, P = G.player, tool = P.tool, sel = P.selected, it = sel ? ITEMS[sel.id] : null;
    let a = '', e = '', name = '', info = '';
    if (G.placing) return { a: 'Construire', e: '', name: BUILDS[G.placing.k].n, info: G.placing.why || 'R : tourner · X : annuler' };
    if (this.fishing) return { a: this.fishing.bite ? 'Ferrer !' : 'Remonter', e: '', name: 'Pêche', info: this.fishing.bite ? 'Ça mord !' : 'Attends que ça morde…' };
    if (t) {
      if (t.kind === 'flora') {
        const n = t.obj, def = FLORA[n.k]; name = def.n;
        if (G.flora.burning.has(n)) { name += ' (en feu)'; e = this.hasWater() ? 'Éteindre' : ''; info = e ? '' : 'Une gourde d’eau l’éteindrait'; }
        else if (n.st === 2) { name = 'Arbre calciné'; a = tool && tool.kind === 'hache' ? 'Récolter le charbon' : ''; info = a ? '' : 'Il faut une hache'; }
        else if (def.pick) e = def.fruit ? 'Cueillir' : 'Ramasser';
        else if (def.tool) { if (tool && tool.kind === def.tool) a = def.tool === 'hache' ? 'Abattre' : 'Miner'; else info = def.tool === 'hache' ? 'Il faut une hache' : 'Il faut une pioche'; }
        if (n.k === 'filon' && tool && tool.kind === 'pioche') a = 'Miner';
      } else if (t.kind === 'animal') {
        const an = t.obj; name = an.def.n + (an.tame ? ' (apprivoisée)' : '');
        if (an.dead) e = 'Dépecer';
        else { a = 'Frapper'; if (an.def.tame && !an.tame) e = 'Nourrir'; }
      } else if (t.kind === 'build') {
        const s = t.obj;
        if (s.k === 'drop') { name = s.data.title; e = 'Fouiller'; }
        else {
          name = BUILDS[s.k].n;
          e = { feu: s.data.fuel > 0 ? 'Cuisiner' : 'Rallumer (1 bois)', etabli: 'Fabriquer', forge: 'Fondre', sechoir: 'Ouvrir', coffre: 'Ouvrir', lit: 'Dormir', collecteur: 'Puiser',
            poulailler: 'Ramasser les œufs', parcelle: this.plotAction(s) }[s.k] || '';
          if (s.k === 'feu') info = s.data.fuel > 0 ? 'Bois pour ' + Math.round(s.data.fuel) + ' h' : 'Éteint';
          if (s.k === 'parcelle') info = G.buildings.cropInfo(s);
          if (s.k === 'collecteur') info = 'Eau : ' + Math.floor(s.data.w) + ' gourde(s)';
          if (s.k === 'poulailler') info = (s.data.eggs || 0) + ' œuf(s) · ' + G.animals.hensOf(s) + ' poule(s)';
          if (s.hp < (BUILDS[s.k].hp || 150) * 0.7) info = (info ? info + ' · ' : '') + 'abîmé';
          info = (info ? info + ' · ' : '') + 'maintenir : démonter';
        }
      } else if (t.kind === 'crate') { name = t.obj.title; e = 'Fouiller'; info = t.obj.poi.n; }
      else if (t.kind === 'ground') { name = itemName(t.obj.id, t.obj.n); e = 'Ramasser'; }
      else if (t.kind === 'water') { name = G.frozen > 0.6 ? 'Glace' : 'Eau'; e = G.inv.count('gourde_vide') ? 'Remplir la gourde' : 'Boire'; if (tool && tool.kind === 'peche') a = 'Lancer la ligne'; }
    }
    if (!a && it) {
      if (it.eat) a = it.verb || (it.cat === 'eau' || (it.eat.soif || 0) > (it.eat.faim || 0) ? 'Boire' : 'Manger');
      else if (it.plan) a = 'Lire le plan';
      else if (tool && (tool.kind === 'arc')) a = G.inv.count('fleche') ? 'Tirer' : 'Plus de flèches';
      else if (tool && tool.kind === 'peche' && (!t || t.kind !== 'water')) a = '';
    }
    return { a, e, name, info };
  }
  plotAction(s) {
    const d = s.data;
    if (!d.crop) return this.seedFor() ? 'Semer ' + itemName(this.seedFor()) : 'Il faut des graines';
    if (d.dead) return 'Nettoyer';
    if (d.stage >= 2) return 'Récolter';
    if (G.inv.count('compost') && !d.fert) return 'Mettre du compost';
    if (d.water <= 0 && this.hasWater()) return 'Arroser';
    return '';
  }
  seedFor() {
    const sel = G.player.selected;
    if (sel && ITEMS[sel.id].crop) return sel.id;
    return ['graines_ble', 'graines_carotte', 'graines_courge'].find((k) => G.inv.count(k));
  }
  hasWater() { return G.inv.count('gourde_propre') || G.inv.count('gourde_sale'); }
  useWater() { if (G.inv.count('gourde_sale')) { G.inv.remove('gourde_sale', 1); } else G.inv.remove('gourde_propre', 1); G.inv.add('gourde_vide', 1); }

  // ---------- boucle ----------
  update(dt) {
    this.cd -= dt;
    const P = G.player;
    if (P.dead || P.sleeping) { this.cancelFish(); return; }
    this.findTarget();
    if (G.placing) G.buildings.updateGhost();
    if (G.uiOpen) return;
    // utiliser / maintenir pour démonter
    if (input.pressed.interact) {
      const t = this.target;
      if (t && t.kind === 'build' && t.obj.k !== 'drop') { this.held = t.obj; this.holdT = 0; }
      else { this.held = null; this.use(); }
    }
    if (this.held && input.held.interact) {
      this.holdT += dt; G.holdProgress = Math.min(1, this.holdT / 0.9);
      if (this.holdT > 0.9) { G.buildings.dismantle(this.held); this.held = null; G.holdProgress = 0; }
    }
    if (this.held && (input.released.interact || !input.held.interact)) {
      const s = this.held; this.held = null; G.holdProgress = 0;
      if (G.buildings.list.has(s.id)) this.useBuild(s);
    }
    if (input.pressed.action || (input.held.action && this.autoRepeat())) this.action();
    if (input.pressed.rotate && G.placing) G.placing.rot += Math.PI / 2;
    if (input.pressed.cancel && G.placing) G.buildings.cancelPlacing();
    if (input.pressed.drop) this.dropSelected();
    this.updateArrows(dt);
    this.updateFishing(dt);
    this.updateGround(dt);
  }
  autoRepeat() { const t = G.player.tool; return t && (t.kind === 'hache' || t.kind === 'pioche' || t.kind === 'melee') && this.cd <= 0; }

  // ---------- Action ----------
  action() {
    const P = G.player;
    if (G.placing) { G.buildings.confirmPlacing(); return; }
    if (this.fishing) { this.reel(); return; }
    if (this.cd > 0) return;
    const sel = P.selected, it = sel ? ITEMS[sel.id] : null, tool = P.tool, t = this.target;
    if (it && !tool) {
      if (it.eat || it.plan) { if (G.survival.consume(P.hotbar)) this.cd = 0.5; return; }
      if (it.crop && t && t.kind === 'build' && t.obj.k === 'parcelle') { this.use(); return; }
    }
    if (tool && tool.kind === 'arc') { this.shoot(tool); return; }
    if (tool && tool.kind === 'peche') { if (t && t.kind === 'water') this.cast(); else G.toast('Tourne-toi vers l’eau pour pêcher.'); this.cd = 0.4; return; }
    this.swing(tool);
  }

  swing(tool) {
    const P = G.player;
    const cd = tool ? tool.cd : 0.5, dmg = tool ? tool.dmg : 4, reach = tool ? tool.reach : 1.9;
    if (P.stats.energie < 3) { G.toast('Trop épuisé pour frapper.'); this.cd = 0.4; return; }
    this.cd = cd; P.doSwing(Math.min(0.45, cd * 0.7)); P.stats.energie -= tool ? 2.2 : 1.5;
    const t = this.target;
    setTimeout(() => this.resolveSwing(tool, dmg, reach, t), cd * 300);
  }
  resolveSwing(tool, dmg, reach, t) {
    const P = G.player, p = P.pos, f = this.forward();
    // une bête devant ?
    const hx = p.x + f.x * reach * 0.6, hz = p.z + f.z * reach * 0.6;
    const a = G.animals.hitTest(hx, p.y + 1, hz, reach * 0.6);
    if (a) {
      const stun = tool && tool.stun;
      G.animals.hurt(a, dmg * (P.stats.energie < 10 ? 0.6 : 1), p);
      if (stun) a.atkT = Math.max(a.atkT, stun);
      G.audio.play('hit', { v: 1 });
      this.wearTool(1);
      return;
    }
    if (!t) return;
    if (t.kind === 'flora') {
      const n = t.obj, def = FLORA[n.k];
      if (!def.tool) { if (def.pick) this.use(); return; }
      const right = tool && (tool.kind === def.tool || (n.st === 2 && tool.kind === 'hache'));
      if (!right) { G.audio.play(def.tool === 'hache' ? 'chop' : 'mine', { v: 0.4 }); FX.chips(n.x, n.y + 1, n.z, def.chip || '#888', 3); if (!this.warned || G.t - this.warned > 4) { this.warned = G.t; G.toast(def.tool === 'hache' ? 'Il te faut une hache.' : 'Il te faut une pioche.'); } return; }
      const tierMul = tool.tier >= 2 ? 1 : n.k === 'filon' ? 0.6 : 1;
      G.audio.play(def.tool === 'hache' ? 'chop' : 'mine', { x: n.x, z: n.z });
      const drops = G.flora.hit(n, tool.kind, dmg * tierMul, p);
      this.wearTool(1);
      if (drops) this.give(drops, n.x, n.y + 1, n.z);
    } else if (t.kind === 'build' && t.obj.k !== 'drop' && tool) {
      FX.chips(t.obj.x, t.obj.y + 0.8, t.obj.z, '#8a5d38', 3); G.audio.play('chop', { v: 0.4 });
    }
  }
  wearTool(n) {
    const P = G.player, s = P.selected; if (!s || s.d === undefined || ITEMS[s.id].durTime) return;
    const name = ITEMS[s.id].n;
    if (G.inv.wear(P.hotbar, n)) { G.toast(name + ' s’est cassé(e) !', 'bad'); G.audio.play('break'); }
    else if (s.d === Math.floor(ITEMS[s.id].dur * 0.1)) G.toast(name + ' est presque usé(e).', 'warn');
  }

  give(drops, x, y, z) {
    const got = [];
    for (const k in drops) {
      const n = drops[k]; if (!n) continue;
      const left = G.inv.add(k, n);
      if (left > 0) { this.dropGround(k, left, G.player.pos.x, G.player.pos.z); G.toast('Sac plein : ' + itemName(k, left) + ' posé au sol.', 'warn'); }
      if (n - left > 0) got.push([k, n - left]);
    }
    if (got.length) { emit('loot', got); G.audio.play('pick', { v: 0.7 }); }
  }

  // ---------- Utiliser (E) ----------
  use() {
    const t = this.target, P = G.player;
    if (G.placing) return;
    if (!t) { const sel = P.selected; if (sel && (ITEMS[sel.id].eat || ITEMS[sel.id].plan)) { G.survival.consume(P.hotbar); } return; }
    if (t.kind === 'flora') {
      const n = t.obj, def = FLORA[n.k];
      if (G.flora.burning.has(n)) { if (this.hasWater()) { this.useWater(); G.flora.burning.delete(n); FX.smoke(n.x, n.y + 2, n.z, 10, '#aaaaaa', 1.2); G.audio.play('splash'); G.toast('Feu éteint.', 'good'); n.st = 2; n.hp = 30; G.flora.refresh(n); } return; }
      if (!def.pick) return;
      P.doSwing(0.3);
      const drops = G.flora.pick(n);
      this.give(drops, n.x, n.y + 0.5, n.z);
      if (n.k === 'herbes' || n.k === 'baies' || n.k === 'sombres') FX.leaves(n.x, n.y + 0.5, n.z, '#7cbf4a', 6);
      return;
    }
    if (t.kind === 'animal') {
      const a = t.obj;
      if (a.dead) { P.doSwing(0.4); const drops = G.animals.skin(a); FX.blood(a.pos.x, a.pos.y + 0.3, a.pos.z, 10); this.give(drops, a.pos.x, a.pos.y, a.pos.z); this.wearTool(1); }
      else if (a.def.tame && !a.tame) G.animals.feed(a);
      return;
    }
    if (t.kind === 'crate') { emit('container', { title: t.obj.title, inv: t.obj.inv, kind: 'caisse' }); return; }
    if (t.kind === 'ground') { const g = t.obj; const left = G.inv.add(g.id, g.n, { d: g.d, a: g.a }); if (left < g.n) { emit('loot', [[g.id, g.n - left]]); G.audio.play('pick'); } g.n = left; if (!left) this.removeGround(g); return; }
    if (t.kind === 'water') {
      if (G.frozen > 0.6) { G.toast('L’eau est gelée.'); return; }
      if (G.inv.count('gourde_vide')) { G.inv.remove('gourde_vide', 1); G.inv.add('gourde_sale', 1); G.audio.play('splash', { v: 0.5 }); G.toast('Gourde remplie d’eau brute. Fais-la bouillir au feu.'); }
      else G.survival.drinkRaw();
      FX.splash(t.x, G.waterLevel, t.z, 6);
      return;
    }
    if (t.kind === 'build') this.useBuild(t.obj);
  }

  useBuild(s) {
    const B = G.buildings;
    switch (s.k) {
      case 'drop': emit('container', { title: s.data.title, inv: s.data.inv, kind: 'drop', struct: s }); break;
      case 'feu':
        if (s.data.fuel <= 0) { if (G.inv.remove('bois', 1)) { s.data.fuel = 2; G.audio.play('fire'); G.toast('Le feu crépite.'); } else G.toast('Il faut du bois.'); break; }
        emit('craft', { station: 'feu', struct: s }); break;
      case 'etabli': emit('craft', { station: 'etabli', struct: s }); break;
      case 'forge': emit('craft', { station: 'forge', struct: s }); break;
      case 'coffre': emit('container', { title: 'Coffre', inv: s.data.inv, kind: 'coffre', struct: s }); break;
      case 'sechoir': emit('container', { title: 'Séchoir', inv: s.data.inv, kind: 'sechoir', struct: s }); break;
      case 'lit': G.survival.sleep(s); break;
      case 'collecteur': {
        const w = Math.floor(s.data.w);
        if (w < 1) { G.toast('Le récupérateur est vide. Attends la pluie.'); break; }
        const n = Math.min(w, G.inv.count('gourde_vide'));
        if (n) { G.inv.remove('gourde_vide', n); G.inv.add('gourde_propre', n); s.data.w -= n; G.toast(n + ' gourde(s) d’eau potable remplie(s).', 'good'); }
        else { G.player.stats.soif = Math.min(100, G.player.stats.soif + 25); s.data.w -= 1; G.audio.play('drink'); }
        break;
      }
      case 'poulailler': {
        const e = s.data.eggs || 0, f = s.data.feathers || 0;
        if (!e && !f) { G.toast(G.animals.hensOf(s) ? 'Pas encore d’œufs. Les poules pondent au matin.' : 'Aucune poule. Apprivoise-en avec des graines.'); break; }
        this.give({ oeuf: e, plume: f }); s.data.eggs = 0; s.data.feathers = 0; break;
      }
      case 'parcelle': this.usePlot(s); break;
    }
  }

  usePlot(s) {
    const d = s.data, B = G.buildings;
    if (!d.crop) {
      const seed = this.seedFor(); if (!seed) { G.toast('Il te faut des graines (hautes herbes, carottes sauvages, ruines…).'); return; }
      G.inv.remove(seed, 1);
      Object.assign(d, { crop: ITEMS[seed].crop, stage: 0, g: 0, water: G.weather.rain > 0.3 ? 18 : 6, fert: false, dead: false, thirst: 0 });
      B.updateCropMesh(s); G.audio.play('pick'); G.toast(CROPS[d.crop].n + ' semé(e)s. Arrose et attends.');
      return;
    }
    if (d.dead) { d.crop = null; d.dead = false; B.updateCropMesh(s); G.inv.add('compost', 0); G.toast('Parcelle nettoyée.'); return; }
    if (d.stage >= 2) {
      const c = CROPS[d.crop];
      const out = { [c.out]: d.crop === 'courge' ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 3), [c.seed]: 2 + Math.floor(Math.random() * 2) };
      this.give(out, s.x, s.y, s.z);
      d.crop = null; B.updateCropMesh(s); FX.leaves(s.x, s.y + 0.5, s.z, '#d8b850', 12);
      G.flags.harvests = (G.flags.harvests || 0) + 1;
      return;
    }
    if (G.inv.count('compost') && !d.fert) { G.inv.remove('compost', 1); d.fert = true; G.toast('Compost épandu : la parcelle poussera deux fois plus vite.', 'good'); return; }
    if (d.water <= 0 && this.hasWater()) { this.useWater(); d.water = 20; FX.splash(s.x, s.y + 0.4, s.z, 14); G.audio.play('splash', { v: 0.5 }); G.toast('Parcelle arrosée.'); return; }
    G.toast(G.buildings.cropInfo(s));
  }

  // ---------- arc et flèches ----------
  shoot(tool) {
    const P = G.player;
    if (this.cd > 0) return;
    if (!G.inv.count('fleche')) { G.toast('Plus de flèches (établi : bois, silex, plume).'); this.cd = 0.5; return; }
    G.inv.remove('fleche', 1);
    this.cd = tool.cd;
    const dir = P.lookDir(_d).clone();
    if (P.view === 3) dir.y += 0.04;
    const start = P.view === 1 ? P.cam.position.clone() : new THREE.Vector3(P.pos.x, P.pos.y + 1.5, P.pos.z);
    start.addScaledVector(dir, 0.6);
    const m = new THREE.Mesh(ARROW_GEO, ARROW_MAT); m.position.copy(start); this.scene.add(m);
    this.arrows.push({ m, v: dir.multiplyScalar(tool.speed), dmg: tool.dmg, t: 0, stuck: 0 });
    P.doSwing(0.25); G.audio.play('bow');
    this.wearTool(1);
  }
  updateArrows(dt) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const r = this.arrows[i];
      if (r.stuck) { r.stuck -= dt; if (r.stuck <= 0) { this.scene.remove(r.m); this.arrows.splice(i, 1); } continue; }
      r.t += dt; r.v.y -= 9 * dt;
      const p0 = r.m.position.clone();
      r.m.position.addScaledVector(r.v, dt);
      r.m.lookAt(_d.copy(r.m.position).add(r.v));
      const p = r.m.position;
      const a = G.animals.hitTest(p.x, p.y, p.z, 0.35);
      if (a) { G.animals.hurt(a, r.dmg, p0); G.audio.play('arrowhit', { x: p.x, z: p.z }); this.scene.remove(r.m); this.arrows.splice(i, 1); continue; }
      const gy = G.terrain.heightAt(p.x, p.z);
      const blocked = segmentBlocked(p0.x, p0.z, p.x, p.z, p.y);
      if (p.y < gy || blocked || r.t > 6) {
        G.audio.play('arrowhit', { x: p.x, z: p.z, v: 0.5 });
        if (p.y < G.waterLevel) { FX.splash(p.x, G.waterLevel, p.z, 5); this.scene.remove(r.m); this.arrows.splice(i, 1); continue; }
        r.stuck = 0.01;
        if (Math.random() < 0.65) this.dropGround('fleche', 1, p.x, p.z, Math.max(gy, p.y));
        continue;
      }
    }
  }

  // ---------- pêche ----------
  cast() {
    const P = G.player, f = this.forward();
    let x = P.pos.x + f.x * 6, z = P.pos.z + f.z * 6;
    if (G.terrain.heightAt(x, z) > G.waterLevel - 0.2) { x = this.target.x; z = this.target.z; }
    this.fishing = { x, z, t: 3 + Math.random() * 7, bite: false, win: 0, from: P.pos.clone() };
    this.bobber.visible = true; this.line.visible = true;
    P.doSwing(0.4); G.audio.play('swing');
    FX.splash(x, G.waterLevel, z, 5);
  }
  cancelFish() { this.fishing = null; this.bobber.visible = false; this.line.visible = false; }
  reel() {
    const f = this.fishing;
    if (f.bite) {
      const rare = Math.random() < (G.weather.rain > 0.3 ? 0.5 : 0.3);
      const out = { poisson: rare ? 2 : 1 };
      this.give(out); G.audio.play('reel'); FX.splash(f.x, G.waterLevel, f.z, 14);
      this.wearTool(1); G.flags.fish = (G.flags.fish || 0) + 1;
    } else G.audio.play('reel');
    this.cancelFish(); this.cd = 0.6;
  }
  updateFishing(dt) {
    const f = this.fishing; if (!f) return;
    const P = G.player;
    if (Math.hypot(P.pos.x - f.from.x, P.pos.z - f.from.z) > 1.5 || !P.tool || P.tool.kind !== 'peche') { this.cancelFish(); return; }
    f.t -= dt;
    const bob = f.bite ? -0.12 + Math.sin(G.t * 30) * 0.04 : Math.sin(G.t * 2) * 0.03;
    this.bobber.position.set(f.x, G.waterLevel + 0.05 + bob, f.z);
    const hand = new THREE.Vector3(P.pos.x, P.pos.y + 1.6, P.pos.z);
    const pa = this.line.geometry.attributes.position; pa.setXYZ(0, hand.x, hand.y, hand.z); pa.setXYZ(1, f.x, G.waterLevel + 0.05 + bob, f.z); pa.needsUpdate = true;
    if (!f.bite && f.t <= 0) { f.bite = true; f.win = 1.4; FX.splash(f.x, G.waterLevel, f.z, 8); G.audio.play('splash', { v: 0.6 }); }
    if (f.bite) { f.win -= dt; if (f.win <= 0) { G.toast('Le poisson s’est échappé.'); this.cancelFish(); } }
  }

  // ---------- objets au sol ----------
  dropGround(id, n, x, z, y = null, extra = {}) {
    const m = new THREE.Mesh(_box, new THREE.MeshLambertMaterial({ color: dropColor(id) }));
    const yy = y ?? Math.max(G.terrain.heightAt(x, z), G.waterLevel);
    m.position.set(x, yy + 0.12, z); m.castShadow = true; this.scene.add(m);
    const g = { id, n, x, y: yy, z, m, t: 0, ...extra };
    this.ground.push(g);
    return g;
  }
  removeGround(g) { this.scene.remove(g.m); const i = this.ground.indexOf(g); if (i >= 0) this.ground.splice(i, 1); }
  updateGround(dt) {
    for (const g of this.ground) { g.t += dt; g.m.rotation.y += dt; g.m.position.y = g.y + 0.15 + Math.sin(g.t * 2) * 0.05; }
    if (this.ground.length > 80) this.removeGround(this.ground[0]);
  }
  dropSelected() {
    const P = G.player, s = P.selected; if (!s) return;
    const st = G.inv.takeSlot(P.hotbar, input.held.sprint ? s.n : 1);
    const f = this.forward();
    this.dropGround(st.id, st.n, P.pos.x + f.x * 1.2, P.pos.z + f.z * 1.2, null, { d: st.d, a: st.a });
    G.toast('Posé au sol : ' + itemName(st.id, st.n));
  }
  saveGround() { return this.ground.filter((g) => g.id).map((g) => [g.id, g.n, Math.round(g.x * 10) / 10, Math.round(g.z * 10) / 10, g.d, g.a]); }
  loadGround(arr) { for (const [id, n, x, z, d, a] of arr || []) if (ITEMS[id]) this.dropGround(id, n, x, z, null, { d, a }); }
}
const _box = new THREE.BoxGeometry(0.22, 0.22, 0.22);
function dropColor(id) {
  const c = ITEMS[id].cat;
  return { ressource: 0xb08a5a, nourriture: 0xd8644a, outil: 0x9aa2aa, arme: 0x9aa2aa, munition: 0xc79a6a, soin: 0xf0f0e0, eau: 0x5a9ad0, graine: 0xc8b860, vetement: 0x8a6a4a, plan: 0x5a8ad0, tresor: 0xe8c860 }[c] || 0xcccccc;
}
export { FAUNA };
