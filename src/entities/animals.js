import * as THREE from 'three';
import { G, isNight, DIFFICULTY, emit, HALF } from '../core/state.js';
import { clamp, angleDiff, lerp } from '../core/rng.js';
import { ANIMAL_MODELS } from '../world/models.js';
import { resolve } from '../core/collide.js';
import { FX } from '../world/fx.js';

// La faune : proies, prédateurs de jour et de nuit, poules à apprivoiser, meutes qui attaquent le camp, boss.
export const FAUNA = {
  lapin: { n: 'Lapin', hp: 15, walk: 1.6, run: 7.5, size: 0.3, flee: 9, drops: { viande: 1, peau: 1 }, model: 'lapin', sound: 'squeal' },
  cerf: { n: 'Cerf', hp: 60, walk: 1.8, run: 9.5, size: 0.55, flee: 18, drops: { viande: 3, peau: 2, os: 1 }, model: 'cerf' },
  sanglier: { n: 'Sanglier', hp: 85, walk: 1.6, run: 7.8, size: 0.6, temper: true, dmg: 17, bleed: 0.3, reach: 1.7, drops: { viande: 3, peau: 1, os: 1 }, model: 'sanglier', sound: 'squeal', cause: 'sanglier' },
  loup: { n: 'Loup', hp: 55, walk: 2.4, run: 8.6, size: 0.5, hostile: true, night: true, dmg: 12, bleed: 0.25, reach: 1.7, drops: { viande: 2, fourrure: 1, os: 1 }, model: 'loup', sound: 'growl', cause: 'loup', fearFire: true },
  alpha: { n: 'Loup alpha', hp: 170, walk: 2.6, run: 9.2, size: 0.7, hostile: true, dmg: 22, bleed: 0.4, reach: 2.1, drops: { croc: 1, fourrure: 3, viande: 3 }, model: 'loup', alpha: true, sound: 'growl', cause: 'loup', boss: true },
  ours: { n: 'Ours', hp: 230, walk: 1.7, run: 8.2, size: 0.95, hostile: true, day: true, territory: 15, dmg: 30, bleed: 0.5, reach: 2.4, drops: { viande: 6, fourrure: 3, os: 2 }, model: 'ours', sound: 'roar', cause: 'ours' },
  grand_ours: { n: 'Le Grand Ours', hp: 720, walk: 1.8, run: 8.6, size: 1.5, hostile: true, territory: 40, dmg: 45, bleed: 0.6, reach: 3.4, drops: { griffe: 1, fourrure: 6, viande: 8, os: 4 }, model: 'ours', boss: true, big: true, sound: 'roar', cause: 'ours' },
  poule: { n: 'Poule', hp: 8, walk: 1.0, run: 4.2, size: 0.25, flee: 3.5, drops: { viande: 1, plume: 2 }, model: 'poule', tame: true, sound: 'cluck' },
};
const _v = new THREE.Vector3();

export class Animals {
  constructor(scene) { this.scene = scene; this.list = []; this.spawnT = 0; this.raidNight = 0; this.raid = null; this.nextId = 1; }

  spawn(k, x, z, opt = {}) {
    const def = FAUNA[k];
    const m = def.model === 'loup' ? ANIMAL_MODELS.loup(!!def.alpha) : def.model === 'ours' ? ANIMAL_MODELS.ours(!!def.big) : ANIMAL_MODELS[def.model]();
    m.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.baseMat = o.material; } });
    this.scene.add(m.group);
    const a = { id: opt.id || this.nextId++, k, def, m, pos: new THREE.Vector3(x, G.terrain.heightAt(x, z), z), yaw: Math.random() * 6.28, hp: opt.hp ?? def.hp,
      state: 'wander', target: null, t: 0, anim: Math.random() * 10, speed: 0, atkT: 0, flash: 0, dead: false, corpseT: 0, raid: !!opt.raid,
      tame: opt.tame || false, home: opt.home || null, angry: false, think: 0 };
    this.nextId = Math.max(this.nextId, a.id + 1);
    this.list.push(a);
    return a;
  }

  despawn(a) { this.scene.remove(a.m.group); const i = this.list.indexOf(a); if (i >= 0) this.list.splice(i, 1); }

  count(k) { return this.list.filter((a) => a.k === k && !a.dead).length; }

  landOk(x, z) {
    if (Math.abs(x) > HALF - 10 || Math.abs(z) > HALF - 10) return false;
    const h = G.terrain.heightAt(x, z);
    return h > G.waterLevel + 0.8 && G.terrain.slopeAt(x, z) < 0.45;
  }

  // population autour du joueur
  populate() {
    const p = G.player.pos, night = isNight(), win = G.season === 3;
    const camp = G.buildings.campCenter();
    const want = { lapin: 7, cerf: win ? 2 : 4, sanglier: 2, poule: 3, loup: night ? (win ? 6 : 4) : win ? 2 : 0, ours: !night && !win ? 1 : 0 };
    for (const k in want) {
      const have = this.list.filter((a) => a.k === k && !a.dead && !a.tame && !a.raid).length;
      if (have >= want[k]) continue;
      for (let tries = 0; tries < 12; tries++) {
        const ang = Math.random() * 6.28, d = 60 + Math.random() * 55;
        const x = p.x + Math.cos(ang) * d, z = p.z + Math.sin(ang) * d;
        if (!this.landOk(x, z)) continue;
        const f = G.terrain.forestAt(x, z), h = G.terrain.heightAt(x, z);
        if ((k === 'cerf' || k === 'ours') && f < -0.1) continue;
        if ((k === 'poule' || k === 'lapin') && f > 0.35) continue;
        if (FAUNA[k].hostile && camp && Math.hypot(x - camp.x, z - camp.z) < 40) continue;
        if (k === 'ours' && h < 4) continue;
        const pack = k === 'loup' ? 2 + Math.floor(Math.random() * 2) : k === 'poule' ? 2 : 1;
        for (let j = 0; j < pack; j++) this.spawn(k, x + (Math.random() - 0.5) * 4, z + (Math.random() - 0.5) * 4);
        break;
      }
    }
    // départ des bêtes trop loin
    for (const a of [...this.list]) {
      if (a.tame || a.def.boss && a.k === 'grand_ours') continue;
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
      if (d > 160 || (a.dead && a.corpseT > 180)) this.despawn(a);
      else if (a.k === 'ours' && night && d > 70 && !a.angry) this.despawn(a);
      else if (a.k === 'loup' && !night && !win && !a.raid && d > 60) this.despawn(a);
    }
  }

  threatNear(pos, r) { return this.list.some((a) => !a.dead && a.def.hostile && (a.state === 'chase' || a.raid || a.angry) && Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z) < r); }
  hensOf(coop) { return this.list.filter((a) => a.k === 'poule' && a.tame && a.home === coop.id && !a.dead).length; }

  // le joueur est-il effrayant (torche, feu) ?
  scaryPlayer() {
    const t = G.player.tool;
    return (t && t.kind === 'lumiere') || G.buildings.scary(G.player.pos.x, G.player.pos.z, 8);
  }

  hurt(a, dmg, from) {
    if (a.dead) return;
    a.hp -= dmg; a.flash = 0.15; a.angry = true;
    FX.blood(a.pos.x, a.pos.y + a.def.size + 0.3, a.pos.z, 8);
    if (a.def.sound) G.audio.play(a.def.sound, { x: a.pos.x, z: a.pos.z, v: 0.8 });
    const fx = from ? a.pos.x - from.x : 0, fz = from ? a.pos.z - from.z : 0, fl = Math.hypot(fx, fz) || 1;
    if (!a.def.boss) { a.pos.x += (fx / fl) * 0.5; a.pos.z += (fz / fl) * 0.5; }
    if (a.hp <= 0) { this.kill(a); return; }
    if (!a.def.hostile && !a.def.temper) { a.state = 'flee'; a.t = 6; }
    else if (a.def.temper && Math.random() < 0.85) { a.state = 'chase'; a.t = 12; }
    else if (a.def.hostile && !a.def.boss && a.hp < a.def.hp * 0.25 && Math.random() < 0.5) { a.state = 'flee'; a.t = 8; }
    else if (a.def.hostile) { a.state = 'chase'; a.t = 14; }
  }

  kill(a) {
    a.dead = true; a.state = 'dead'; a.corpseT = 0;
    G.stats.kills++;
    if (a.def.boss) {
      G.stats.bosses++;
      if (a.k === 'grand_ours') { G.flags.grandOurs = true; emit('banner', { t: 'Le Grand Ours est tombé', s: 'Dépèce-le : sa griffe fait l’Armure du chasseur.' }); }
      if (a.k === 'alpha') { G.flags.alpha = (G.flags.alpha || 0) + 1; emit('banner', { t: 'L’Alpha est vaincu', s: 'La meute se disperse.' }); this.list.forEach((w) => { if (w.raid && !w.dead) { w.state = 'flee'; w.t = 20; } }); }
    }
    G.audio.play('thud', { x: a.pos.x, z: a.pos.z, v: 0.5 });
  }

  skin(a) {
    const out = {};
    const knife = G.player.tool && G.player.tool.skin;
    for (const k in a.def.drops) {
      let n = a.def.drops[k];
      if (k === 'peau' && a.k === 'lapin' && Math.random() < 0.5) n = 0;
      if (knife && (k === 'viande' || k === 'peau' || k === 'fourrure')) n += 1;
      if (n) out[k] = n;
    }
    this.despawn(a);
    return out;
  }

  // apprivoiser une poule
  feed(a) {
    const food = ['graines_ble', 'ble', 'baies'].find((k) => G.inv.count(k) > 0);
    if (!food) { G.toast('Il te faut des graines de blé, du blé ou des baies.'); return; }
    G.inv.remove(food, 1);
    a.trust = (a.trust || 0) + 1;
    G.audio.play('cluck', { x: a.pos.x, z: a.pos.z });
    FX.sparkle(a.pos.x, a.pos.y + 0.7, a.pos.z, '#ffe08a', 6);
    if (a.trust >= 2) {
      a.tame = true; a.state = 'follow';
      const coop = G.buildings.nearest(a.pos.x, a.pos.z, 60, (s) => s.k === 'poulailler');
      a.home = coop ? coop.id : null;
      G.toast(coop ? 'Poule apprivoisée ! Elle rejoint le poulailler.' : 'Poule apprivoisée ! Construis un poulailler : elle y pondra.', 'good');
    } else G.toast('La poule picore… encore un peu.');
  }

  // ---------- nuits de la meute ----------
  checkRaid() {
    if (!DIFFICULTY[G.difficulty].raids) return;
    const d = G.time.day, h = G.time.hour;
    const camp = G.buildings.campCenter();
    if (!camp || camp.n < 2) return;
    if (d >= 3 && d % 3 === 0 && h > 21.5 && h < 23 && this.raidNight !== d) {
      this.raidNight = d;
      const n = Math.min(7, 2 + Math.floor(d / 4));
      const ang = Math.random() * 6.28;
      for (let i = 0; i < n; i++) {
        let x = camp.x + Math.cos(ang) * 65 + (Math.random() - 0.5) * 12, z = camp.z + Math.sin(ang) * 65 + (Math.random() - 0.5) * 12;
        const w = this.spawn('loup', x, z, { raid: true }); w.state = 'raid';
      }
      const alpha = d >= 9 && (G.flags.alpha || 0) < Math.floor(d / 9);
      if (alpha) { const w = this.spawn('alpha', camp.x + Math.cos(ang) * 72, camp.z + Math.sin(ang) * 72, { raid: true }); w.state = 'raid'; }
      this.raid = { camp, n: n + (alpha ? 1 : 0) };
      G.audio.play('howl', { v: 1 }); setTimeout(() => G.audio.play('howl', { v: 0.7 }), 1800);
      emit('banner', { t: 'La nuit de la meute', s: alpha ? 'L’Alpha mène les loups vers ton camp !' : 'Des loups approchent de ton camp. Tiens bon jusqu’à l’aube.' });
      if (G.player.sleeping) G.survival.wake('Des hurlements te réveillent !');
    }
    if (this.raid && !isNight()) {
      this.list.forEach((w) => { if (w.raid && !w.dead) { w.raid = false; w.state = 'flee'; w.t = 25; } });
      this.raid = null; G.toast('L’aube se lève : la meute se retire.', 'good');
    }
  }

  // ---------- IA ----------
  update(dt) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 3; this.populate(); this.checkRaid(); this.checkBoss(); }
    const P = G.player, pp = P.pos;
    const scared = this.scaryPlayer();
    const night = isNight();
    for (const a of this.list) {
      const def = a.def;
      a.anim += dt;
      if (a.dead) { a.corpseT += dt; this.pose(a, dt, 0); continue; }
      const dx = pp.x - a.pos.x, dz = pp.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 140 && !a.raid) { a.m.group.visible = false; continue; }
      a.m.group.visible = true;
      a.t -= dt; a.atkT -= dt;
      let tx = null, tz = null, sp = 0;
      const noise = P.sprinting ? 1.5 : 1;
      const hostileNow = def.hostile && DIFFICULTY[G.difficulty].aggro && !P.dead && (!def.night || night || G.season === 3 || a.angry || a.raid) && (!def.day || !night || a.angry);
      // décisions
      if (a.tame) {
        const coop = a.home ? G.buildings.list.get(a.home) : null;
        if (!coop) { a.home = null; const c = G.buildings.nearest(a.pos.x, a.pos.z, 60, (s) => s.k === 'poulailler'); if (c) a.home = c.id; }
        const hx = coop ? coop.x : pp.x, hz = coop ? coop.z : pp.z;
        const hd = Math.hypot(hx - a.pos.x, hz - a.pos.z);
        if (hd > (coop ? 5 : 3)) { tx = hx; tz = hz; sp = hd > 12 ? def.run * 0.7 : def.walk * 1.5; }
        else this.wander(a, dt, hx, hz, 4);
      } else if (a.state === 'raid') {
        // la meute fonce vers le camp, attaque ce qui se trouve en travers
        const c = this.raid ? this.raid.camp : { x: pp.x, z: pp.z };
        const near = Math.hypot(pp.x - c.x, pp.z - c.z) < 35 || d < 14;
        tx = near ? pp.x : c.x; tz = near ? pp.z : c.z; sp = def.run * 0.85;
        if (d < def.reach + 0.4) this.attack(a, d);
        else this.bite(a, dt);
      } else if (a.state === 'flee') {
        tx = a.pos.x - dx; tz = a.pos.z - dz; sp = def.run;
        if (a.t <= 0 && d > (def.flee || 20)) a.state = 'wander';
      } else if (a.state === 'chase') {
        if (def.fearFire && scared && !a.raid && d < 9) { a.state = 'circle'; a.t = 3; }
        else { tx = pp.x; tz = pp.z; sp = def.run * (def.boss ? 0.9 : 1); }
        if (d < def.reach + 0.3) this.attack(a, d);
        if ((a.t <= 0 && d > 30) || P.dead || (def.day && night && !a.angry)) { a.state = 'wander'; a.angry = false; }
        if (P.swimming && d > 3 && !def.big) { a.state = 'circle'; a.t = 2; }
      } else if (a.state === 'circle') {
        // tourne autour, à distance du feu
        const ang = Math.atan2(a.pos.z - pp.z, a.pos.x - pp.x) + dt * 0.6;
        tx = pp.x + Math.cos(ang) * 9; tz = pp.z + Math.sin(ang) * 9; sp = def.walk * 1.6;
        if (Math.random() < dt * 0.15) G.audio.play('growl', { x: a.pos.x, z: a.pos.z, v: 0.7 });
        if (a.t <= 0) a.state = scared && d < 12 ? 'circle' : hostileNow ? 'chase' : 'wander', a.t = 3;
        if (scared && d < 5) { a.state = 'flee'; a.t = 4; }
      } else {
        // calme : erre, broute ; repère le joueur
        this.wander(a, dt, a.pos.x, a.pos.z, 10);
        if (!def.hostile && !def.temper && d < (def.flee || 8) * noise) { a.state = 'flee'; a.t = 4 + Math.random() * 3; G.audio.play(def.sound || 'step', { x: a.pos.x, z: a.pos.z, v: 0.4 }); }
        if (def.temper && d < 4.5 * noise && Math.random() < dt * 0.6) { a.state = 'chase'; a.t = 8; a.angry = true; G.audio.play('squeal', { x: a.pos.x, z: a.pos.z }); }
        if (hostileNow) {
          const range = def.territory || (P.view === 1 ? 26 : 26) * noise;
          if (d < range) {
            if (def.fearFire && scared) { a.state = 'circle'; a.t = 4; }
            else { a.state = 'chase'; a.t = 14; if (def.sound) G.audio.play(def.sound, { x: a.pos.x, z: a.pos.z }); if (def.big) emit('banner', { t: 'Le Grand Ours', s: 'Le maître de la montagne t’a senti.' }); }
          }
        }
        if (def.temper && a.angry && d < 12) { a.state = 'chase'; a.t = 8; }
      }
      if (tx !== null) {
        const want = Math.atan2(tx - a.pos.x, tz - a.pos.z);
        a.yaw += angleDiff(a.yaw, want) * Math.min(1, dt * 6);
        a.speed = lerp(a.speed, sp, Math.min(1, dt * 4));
      } else if (a.wanderTo) {
        const want = Math.atan2(a.wanderTo.x - a.pos.x, a.wanderTo.z - a.pos.z);
        a.yaw += angleDiff(a.yaw, want) * Math.min(1, dt * 3);
        a.speed = lerp(a.speed, def.walk, Math.min(1, dt * 2));
        if (Math.hypot(a.wanderTo.x - a.pos.x, a.wanderTo.z - a.pos.z) < 1) a.wanderTo = null;
      } else a.speed = lerp(a.speed, 0, Math.min(1, dt * 5));
      // déplacement
      const nx = a.pos.x + Math.sin(a.yaw) * a.speed * dt, nz = a.pos.z + Math.cos(a.yaw) * a.speed * dt;
      const nh = G.terrain.heightAt(nx, nz);
      if (nh < G.waterLevel + 0.2 && G.frozen < 0.6) { a.yaw += 1.4; a.wanderTo = null; a.speed *= 0.5; }
      else { a.pos.x = nx; a.pos.z = nz; }
      resolve(a.pos, def.size * 0.8, a.pos.y, 1.2, a);
      a.pos.y = Math.max(G.terrain.heightAt(a.pos.x, a.pos.z), G.frozen > 0.6 ? G.waterLevel : -99);
      // ne pas traverser le joueur
      if (d < def.size + 0.4 && d > 0.01) { a.pos.x -= (dx / d) * (def.size + 0.4 - d); a.pos.z -= (dz / d) * (def.size + 0.4 - d); }
      this.pose(a, dt, a.speed);
    }
  }

  wander(a, dt, cx, cz, r) {
    if (!a.wanderTo || a.t < -6) {
      if (Math.random() < dt * 0.4) {
        const ang = Math.random() * 6.28, d = 2 + Math.random() * r;
        const x = cx + Math.cos(ang) * d, z = cz + Math.sin(ang) * d;
        if (this.landOk(x, z)) { a.wanderTo = { x, z }; a.t = 0; }
      }
    }
  }

  attack(a, d) {
    if (a.atkT > 0) return;
    a.atkT = a.def.big ? 1.6 : 1.15; a.lunge = 0.3;
    const P = G.player;
    if (P.dead) return;
    G.survival.damage(a.def.dmg, a.def.cause || 'bête', { bleed: a.def.bleed });
    G.audio.play(a.def.sound || 'hit', { x: a.pos.x, z: a.pos.z });
    FX.blood(P.pos.x, P.pos.y + 1.1, P.pos.z, 6);
    if (P.sleeping) G.survival.wake('Une bête t’attaque !');
    if (a.def.big) { G.shake = 0.8; const k = 1.6; P.vel.x += Math.sin(a.yaw) * 8 * k; P.vel.z += Math.cos(a.yaw) * 8 * k; P.vel.y = 4; }
  }
  // en raid : mord les murs qui barrent la route
  bite(a, dt) {
    if (a.atkT > 0) return;
    const s = G.buildings.nearest(a.pos.x + Math.sin(a.yaw) * 1.2, a.pos.z + Math.cos(a.yaw) * 1.2, 2.2, (q) => ['mur', 'porte', 'pieux', 'cloture', 'coffre', 'lit', 'poulailler'].includes(q.k));
    if (!s || a.speed > 2.5) return;
    a.atkT = 1.4; a.lunge = 0.3;
    G.buildings.damageStruct(s, a.def.alpha ? 30 : 14);
    G.audio.play('growl', { x: a.pos.x, z: a.pos.z, v: 0.6 });
  }

  checkBoss() {
    const lair = G.pois && G.pois.lair; if (!lair || G.flags.grandOurs) return;
    const has = this.list.find((a) => a.k === 'grand_ours');
    const d = Math.hypot(G.player.pos.x - lair.x, G.player.pos.z - lair.z);
    if (!has && d < 90) { const b = this.spawn('grand_ours', lair.x, lair.z + 4); b.home = lair; }
    if (has && d > 150) this.despawn(has);
    if (has && !has.dead && has.state === 'wander' && Math.hypot(has.pos.x - lair.x, has.pos.z - lair.z) > 25) has.wanderTo = { x: lair.x, z: lair.z + 4 };
  }

  pose(a, dt, speed) {
    const m = a.m, g = m.group;
    g.position.copy(a.pos); g.rotation.y = a.yaw;
    if (a.dead) {
      m.body.rotation.z = lerp(m.body.rotation.z, Math.PI / 2, Math.min(1, dt * 6));
      m.body.position.y = lerp(m.body.position.y, -a.def.size * 0.4, Math.min(1, dt * 6));
      return;
    }
    const k = Math.min(1, speed / Math.max(1, a.def.walk));
    const ph = a.anim * (4 + speed * 2.2);
    m.legs.forEach((l, i) => (l.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 * k));
    m.body.position.y = Math.abs(Math.sin(ph)) * 0.05 * k;
    if (a.k === 'lapin' && speed > 2) m.body.position.y = Math.abs(Math.sin(ph * 0.5)) * 0.25;
    if (m.tail) m.tail.rotation.y = Math.sin(a.anim * 3) * 0.3;
    a.lunge = Math.max(0, (a.lunge || 0) - dt);
    m.head.rotation.x = a.lunge > 0 ? -0.6 : (speed < 0.3 && !a.def.hostile ? 0.5 + Math.sin(a.anim * 0.7) * 0.2 : 0);
    // éclair rouge quand touché
    if (a.flash > 0) { a.flash -= dt; g.traverse((o) => { if (o.isMesh) o.material = FLASH; }); }
    else if (a.flashOn !== false) { g.traverse((o) => { if (o.isMesh && o.userData.baseMat) o.material = o.userData.baseMat; }); }
    a.flashOn = a.flash > 0;
  }

  // touche-t-on une bête ? (coups, flèches)
  hitTest(x, y, z, r) {
    let best = null, bd = 1e9;
    for (const a of this.list) {
      if (a.dead) continue;
      const s = a.def.size * (a.def.big ? 1.6 : a.def.alpha ? 1.35 : 1);
      const d = Math.hypot(a.pos.x - x, a.pos.z - z), dy = y - (a.pos.y + s);
      if (d < s + r && Math.abs(dy) < s + 1) { if (d < bd) { bd = d; best = a; } }
    }
    return best;
  }

  save() { return this.list.filter((a) => a.tame && !a.dead).map((a) => ({ id: a.id, k: a.k, x: a.pos.x, z: a.pos.z, home: a.home })); }
  load(arr) { for (const o of arr || []) { const a = this.spawn(o.k, o.x, o.z, { id: o.id, tame: true, home: o.home }); a.state = 'follow'; } }
}
const FLASH = new THREE.MeshBasicMaterial({ color: 0xff5040 });
