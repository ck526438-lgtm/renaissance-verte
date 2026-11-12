import { G, DIFFICULTY, isNight, emit } from '../core/state.js';
import { clamp } from '../core/rng.js';
import { ITEMS } from './items.js';
import { freshness } from './inventory.js';
import { RECIPES } from './recipes.js';

// Le corps : faim, soif, énergie, sommeil, température, humidité, blessures et maladies.
export const EFFECTS = {
  saignement: { n: 'Saignement', bad: true, tip: 'Bandage, cataplasme ou trousse', col: '#d83a3a' },
  infection: { n: 'Plaie infectée', bad: true, tip: 'Cataplasme ou trousse', col: '#b88a2a' },
  fievre: { n: 'Fièvre', bad: true, tip: 'Tisane de plantes, repos', col: '#e0703a' },
  intox: { n: 'Intoxication', bad: true, tip: 'Tisane de plantes', col: '#8aa83a' },
  poison: { n: 'Empoisonnement', bad: true, tip: 'Antidote', col: '#8a3ab8' },
  entorse: { n: 'Entorse', bad: true, tip: 'Attelle', col: '#c08a5a' },
  hypothermie: { n: 'Hypothermie', bad: true, tip: 'Feu, abri, vêtements chauds', col: '#5ab0e0' },
  chaleur: { n: 'Coup de chaleur', bad: true, tip: 'Ombre, eau, chapeau', col: '#f0a030' },
  epuisement: { n: 'Épuisement', bad: true, tip: 'Dors dans un lit', col: '#8a8aa8' },
  mouille: { n: 'Trempé', bad: false, tip: 'Sèche-toi près d’un feu', col: '#5a8ad0' },
  rassasie: { n: 'Bien nourri', bad: false, tip: 'Récupère plus vite', col: '#7ac04a' },
  abri: { n: 'À l’abri', bad: false, tip: 'Protégé du vent et de la pluie', col: '#c9a24a' },
  feu: { n: 'Près du feu', bad: false, tip: 'Il fait chaud ici', col: '#f0903a' },
};

export class Survival {
  constructor() { this.msgT = 0; this.felt = 20; this.cause = ''; }

  armor() {
    let def = 0, warm = 0, cool = 0;
    for (const k in G.player.equip) { const s = G.player.equip[k]; if (!s) continue; const w = ITEMS[s.id].wear; def += w.def; warm += w.warm; cool += w.cool || 0; }
    return { def, warm, cool };
  }

  update(dt, hours) {
    const P = G.player, S = P.stats, fx = P.fx;
    if (P.dead) return;
    const D = DIFFICULTY[G.difficulty];
    const sleeping = P.sleeping;
    const slowNeeds = sleeping ? 0.55 : 1;

    // besoins
    const act = P.sprinting ? 1.6 : 1;
    const heat = this.felt > 30 ? 1 + (this.felt - 30) * 0.06 : 1;
    const cold = S.temp < 36.2 ? 1.35 : 1;
    S.faim = clamp(S.faim - hours * 4.3 * D.needs * act * cold * slowNeeds - (fx.intox ? hours * 6 : 0), 0, 100);
    S.soif = clamp(S.soif - hours * 6.4 * D.needs * act * heat * slowNeeds - (fx.intox ? hours * 9 : 0) - (fx.chaleur ? hours * 6 : 0), 0, 100);
    if (!sleeping) S.sommeil = clamp(S.sommeil - hours * 4.1 * D.needs, 0, 100);
    else S.sommeil = clamp(S.sommeil + hours * 13, 0, 100);

    // énergie (endurance)
    const maxE = S.sommeil < 10 ? 35 : fx.fievre ? 60 : 100;
    const regen = (P.sprinting || (P.swimming && Math.hypot(P.vel.x, P.vel.z) > 0.5) ? 0 : 16) * (S.faim > 5 && S.soif > 5 ? 1 : 0.3) * (fx.hypothermie ? 0.5 : 1);
    S.energie = clamp(S.energie + regen * dt, 0, maxE);
    if (P.swimming && S.energie <= 0) this.damage(dt * 8, 'noyade', { raw: true });

    // température ressentie et corps
    const air = G.weather ? G.airTemp ?? 15 : 15;
    const { warm, cool } = this.armor();
    const roof = G.buildings ? G.buildings.roofAt(P.pos.x, P.pos.z, P.pos.y) : false;
    const fire = G.buildings ? G.buildings.fireHeat(P.pos.x, P.pos.y, P.pos.z) : 0;
    G.sheltered = roof; G.nearFire = fire;
    const W = G.weather;
    const tool = P.tool;
    let felt = air + warm + fire * 18 + (roof ? 4 : 0) + (tool && tool.warm ? tool.warm : 0);
    if (!roof) felt -= W.wind * 3.5 * (W.snow ? 1.5 : 1);
    if (!roof && G.dayLight > 0.6 && W.cloud < 0.4) felt += 2.5;
    felt -= S.wet * 8;
    if (P.swimming) felt -= 6 + (G.season === 3 ? 10 : 0);
    if (felt > 27 && cool) felt -= Math.min(cool, felt - 27);
    this.felt = felt;
    let target = 37;
    if (felt < 13) target = 37 - (13 - felt) * 0.17;
    else if (felt > 28) target = 37 + (felt - 28) * 0.2;
    if (fx.fievre) target += 2;
    const rate = (target > S.temp && fire > 0.2) ? 2.2 : 0.75;
    S.temp += clamp(target - S.temp, -rate * hours, rate * hours);
    S.temp = clamp(S.temp, 29, 42.5);

    // humidité
    if (P.swimming || (G.underwater)) S.wet = 1;
    else if (W.rain > 0.15 && !roof && !W.snow) S.wet = clamp(S.wet + hours * 0.9 * W.rain, 0, 1);
    else if (W.snow && W.rain > 0.3 && !roof) S.wet = clamp(S.wet + hours * 0.15, 0, 0.5);
    else S.wet = clamp(S.wet - hours * (fire > 0.1 ? 2.4 : felt > 22 ? 0.7 : 0.3), 0, 1);

    // états dynamiques
    this.setFx('hypothermie', S.temp < 35.4);
    this.setFx('chaleur', S.temp > 38.9 && !fx.fievre);
    this.setFx('epuisement', S.sommeil < 10);
    this.setFx('mouille', S.wet > 0.35);
    this.setFx('rassasie', S.faim > 80 && S.soif > 70);
    this.setFx('abri', roof);
    this.setFx('feu', fire > 0.15);

    // évolution des maux (durées en heures de jeu)
    const tick = (k, h) => { if (fx[k] !== undefined && fx[k] !== true) { fx[k] -= h; if (fx[k] <= 0) { delete fx[k]; return true; } } return false; };
    if (fx.saignement !== undefined) {
      this.damage(hours * 9, 'saignement', { raw: true });
      if (tick('saignement', hours)) { if (Math.random() < 0.4) { fx.infection = 10; G.toast('La plaie s’est infectée…', 'bad'); } }
    }
    if (fx.infection !== undefined) { this.damage(hours * 1.2, 'infection', { raw: true }); if (tick('infection', hours)) { fx.fievre = 20; G.toast('La fièvre monte. Il te faut une tisane.', 'bad'); } }
    if (fx.fievre !== undefined) tick('fievre', hours);
    if (fx.intox !== undefined) {
      if (Math.random() < hours * 0.8) { S.faim = Math.max(0, S.faim - 8); S.soif = Math.max(0, S.soif - 8); G.toast('Tu vomis…', 'bad'); G.shake = 0.3; }
      tick('intox', hours);
    }
    if (fx.poison !== undefined) { this.damage(hours * 8, 'poison', { raw: true }); tick('poison', hours); }
    if (fx.entorse !== undefined) tick('entorse', hours);

    // dégâts des besoins, régénération
    if (S.faim <= 0) this.damage(hours * 6, 'faim', { raw: true });
    if (S.soif <= 0) this.damage(hours * 10, 'soif', { raw: true });
    if (S.temp < 35.4) this.damage(hours * (35.4 - S.temp) * 5, 'froid', { raw: true });
    if (S.temp > 39.6) this.damage(hours * (S.temp - 39.6) * 6, 'chaleur', { raw: true });
    const healthy = S.faim > 45 && S.soif > 45 && S.temp > 36 && S.temp < 38.6 && !fx.saignement && !fx.poison && !fx.infection;
    if (healthy) S.vie = clamp(S.vie + hours * (sleeping ? 12 : 4) * (fx.rassasie ? 1.6 : 1), 0, 100);

    // rappels
    this.msgT -= dt;
    if (this.msgT <= 0) {
      this.msgT = 25;
      if (S.soif < 20) G.toast('Tu as très soif.', 'warn');
      else if (S.faim < 20) G.toast('Ton ventre crie famine.', 'warn');
      else if (S.temp < 35.8) G.toast('Tu grelottes : trouve un feu, un abri ou des vêtements chauds.', 'warn');
      else if (S.temp > 38.7 && !fx.fievre) G.toast('Il fait trop chaud : bois et cherche l’ombre.', 'warn');
      else if (S.sommeil < 15) G.toast('Tu tombes de fatigue : dors dans un lit.', 'warn');
    }
  }

  setFx(k, on) { const fx = G.player.fx; if (on && fx[k] === undefined) fx[k] = true; else if (!on && fx[k] === true) delete fx[k]; }

  addFx(k, hours) {
    const fx = G.player.fx;
    const had = fx[k] !== undefined;
    fx[k] = Math.max(typeof fx[k] === 'number' ? fx[k] : 0, hours);
    if (!had) { G.toast(EFFECTS[k].n + ' — ' + EFFECTS[k].tip, 'bad'); emit('fx', k); }
  }

  // dégâts : raw = sans armure (faim, poison…)
  damage(amount, cause, opt = {}) {
    const P = G.player; if (P.dead || amount <= 0) return;
    if (!opt.raw) {
      const { def } = this.armor();
      amount *= DIFFICULTY[G.difficulty].dmg * (1 - def / (def + 28));
      // l'armure s'use
      for (const k in P.equip) { const s = P.equip[k]; if (s && s.d !== undefined) { s.d -= 1; if (s.d <= 0) { G.toast(ITEMS[s.id].n + ' est en lambeaux.', 'bad'); P.equip[k] = null; P.setGear(); } } }
      G.hurt = Math.min(1, (G.hurt || 0) + amount / 25);
      G.shake = Math.max(G.shake || 0, Math.min(0.6, amount / 30));
      G.audio && G.audio.play('hurt');
      if (opt.bleed && Math.random() < opt.bleed) this.addFx('saignement', 3 + Math.random() * 2);
    }
    P.stats.vie -= amount;
    this.cause = cause;
    if (P.stats.vie <= 0) this.die(cause);
  }

  fallDamage(h) {
    const dmg = (h - 4.5) * 9;
    this.damage(dmg, 'chute', { raw: false });
    if (h > 6.5 && Math.random() < 0.55) this.addFx('entorse', 18);
  }

  // manger, boire, se soigner
  consume(slot) {
    const inv = G.inv, s = inv.slots[slot]; if (!s) return false;
    const it = ITEMS[s.id];
    if (it.plan) return this.readPlan(slot);
    const e = it.eat; if (!e) return false;
    const P = G.player, S = P.stats;
    if (e.faim > 0 && S.faim > 97 && !e.soif && !e.cure && !e.vie) { G.toast('Tu n’as plus faim.'); return false; }
    const fr = freshness(s);
    const k = fr < 0.25 ? 0.6 : 1;
    if (e.faim) S.faim = clamp(S.faim + e.faim * k, 0, 100);
    if (e.soif) S.soif = clamp(S.soif + e.soif, 0, 100);
    if (e.vie) S.vie = clamp(S.vie + e.vie, 0, 100);
    if (e.warm) S.temp = Math.min(37.6, S.temp + e.warm * 0.15);
    const intox = (e.intox || 0) + (fr < 0.25 ? 0.3 : 0);
    if (intox && Math.random() < intox) this.addFx('intox', 5 + Math.random() * 3);
    if (e.poison) this.addFx('poison', 6 + Math.random() * 4);
    if (e.cure) for (const c of e.cure) if (P.fx[c] !== undefined) { delete P.fx[c]; G.toast(EFFECTS[c].n + ' soigné(e).', 'good'); }
    inv.remove(s.id, 1) ;
    if (e.then) inv.add(e.then, 1);
    G.audio && G.audio.play(it.cat === 'eau' || e.soif > e.faim ? 'drink' : it.cat === 'soin' ? 'craft' : 'eat');
    if (it.cat === 'nourriture') G.stats.eaten++;
    return true;
  }

  readPlan(slot) {
    const s = G.inv.slots[slot]; const it = ITEMS[s.id];
    G.flags['plan_' + it.plan] = true;
    G.inv.remove(s.id, 1);
    const r = RECIPES.find((q) => q.plan === it.plan);
    G.toast('Nouvelle recette apprise : ' + ITEMS[r.out].n, 'good');
    G.audio && G.audio.play('level');
    return true;
  }

  drinkRaw() {
    const S = G.player.stats;
    if (G.frozen > 0.6) { G.toast('L’eau est gelée. Casse la glace… ou fais fondre de la neige au feu.'); return; }
    S.soif = clamp(S.soif + 14, 0, 100);
    G.audio && G.audio.play('drink');
    if (Math.random() < 0.18) this.addFx('intox', 4 + Math.random() * 3);
  }

  die(cause) {
    const P = G.player; if (P.dead) return;
    P.dead = true; P.sleeping = false; G.sleep = null;
    const why = { faim: 'de faim', soif: 'de soif', froid: 'de froid', chaleur: 'd’un coup de chaleur', saignement: 'd’une hémorragie', infection: 'd’une infection',
      poison: 'empoisonné', noyade: 'noyé', chute: 'd’une chute', loup: 'sous les crocs des loups', ours: 'sous les griffes d’un ours', sanglier: 'chargé par un sanglier', feu: 'dans les flammes' }[cause] || '';
    emit('death', { cause, why });
  }

  respawn() {
    const P = G.player;
    const D = DIFFICULTY[G.difficulty];
    if (D.drop) {
      const items = G.inv.slots.filter(Boolean);
      if (items.length) G.buildings.addDrop(P.pos.x, P.pos.z, items, 'Ton sac');
      G.inv.slots.fill(null); emit('inv', G.inv);
    }
    const sp = (P.spawn && G.buildings.bedExists(P.spawn)) ? P.spawn : null;
    if (sp) P.place(sp.x + 1.2, sp.z + 1.2); else { const l = G.terrain.findLand(0, 0); P.place(l.x, l.z); }
    Object.assign(P.stats, { vie: 60, faim: 70, soif: 70, energie: 100, sommeil: 80, temp: 37, wet: 0 });
    P.fx = {}; P.dead = false;
    G.toast(D.drop ? 'Tu te réveilles. Ton sac est resté là où tu es tombé.' : 'Tu te réveilles, sain et sauf.', 'warn');
  }

  canSleep() {
    if (G.animals && G.animals.threatNear(G.player.pos, 22)) { G.toast('Impossible de dormir : une bête rôde.', 'warn'); return false; }
    if (G.player.stats.sommeil > 85 && !isNight()) { G.toast('Tu n’as pas sommeil.'); return false; }
    return true;
  }
  sleep(bed) {
    const P = G.player;
    if (!this.canSleep()) return;
    P.spawn = { x: bed.x, z: bed.z, id: bed.id };
    const h = G.time.hour;
    const until = isNight() ? (h > 12 ? 24 - h + 6.5 : 6.5 - h) : Math.min(8, (100 - P.stats.sommeil) / 13 + 0.5);
    G.sleep = { until: G.time.total + Math.max(1, until) };
    P.sleeping = true;
    P.place(bed.x, bed.z);
    P.pos.y += 0.5;
    G.audio && G.audio.play('sleep');
    G.toast('Tu t’endors… Point de réapparition fixé ici.');
  }
  wake(reason) {
    const P = G.player; if (!P.sleeping) return;
    P.sleeping = false; G.sleep = null;
    if (reason) G.toast(reason, 'warn'); else G.toast('Tu te réveilles reposé.', 'good');
  }
}
