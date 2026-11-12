import { G, on, emit, SEASONS, DIFFICULTY, WORLD, HALF, isNight } from '../core/state.js';
import { input } from '../core/input.js';
import { ITEMS, itemName } from '../game/items.js';
import { RECIPES, STATIONS } from '../game/recipes.js';
import { BUILDS, SECHE } from '../game/buildings.js';
import { EFFECTS } from '../game/survival.js';
import { freshness, Inventory } from '../game/inventory.js';
import { itemIcon, buildIcon } from './icons.js';
import { hasSave, saveInfo, saveSettings } from '../game/save.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n, d = 0) => n.toFixed(d).replace('.', ',');
const isTouch = () => G.isTouch;

// ---------- objectifs guidés ----------
const GOALS = [
  { t: 'Ramasse des branches et des cailloux (E).', ok: () => G.inv.count('bois') >= 3 && G.inv.count('pierre') >= 2 },
  { t: 'Coupe des hautes herbes pour la fibre, puis fabrique une hache de pierre (C).', ok: () => G.inv.count('hache_pierre') > 0 || G.stats.crafted > 1 },
  { t: 'Prends la hache en main et abats un arbre.', ok: () => G.inv.count('bois') >= 8 },
  { t: 'Construis un feu de camp (B) avant la nuit.', ok: () => [...G.buildings.list.values()].some((s) => s.k === 'feu') },
  { t: 'Fabrique une gourde (peau + corde), remplis-la, fais-la bouillir au feu.', ok: () => G.inv.count('gourde_propre') > 0 || G.flags.boiled },
  { t: 'Construis un lit : c’est là que tu reviendras si tu meurs.', ok: () => [...G.buildings.list.values()].some((s) => s.k === 'lit') },
  { t: 'Bâtis un abri : plancher, murs et toit te protègent de la pluie et du froid.', ok: () => [...G.buildings.list.values()].some((s) => s.k === 'toit') },
  { t: 'Construis un établi et fabrique un arc.', ok: () => G.inv.count('arc') > 0 || G.flags.madeBow },
  { t: 'Sème des graines dans une parcelle et récolte-les.', ok: () => (G.flags.harvests || 0) > 0 },
  { t: 'Explore des ruines ou une cabane : fouille la caisse.', ok: () => G.pois.list.some((p) => p.found && p.crates.some((c) => c.inv.free() === c.inv.size)) },
  { t: 'Trouve un bunker : il cache un plan.', ok: () => G.pois.list.some((p) => p.kind === 'bunker' && p.found) },
  { t: 'Bâtis une forge et coule un lingot de fer.', ok: () => G.inv.count('fer') > 0 || G.flags.smelted },
  { t: 'Prépare-toi à l’hiver : manteau de fourrure et réserves de viande séchée.', ok: () => (G.player.equip.corps && G.player.equip.corps.id === 'manteau_fourrure') || G.inv.count('viande_sechee') >= 4 },
  { t: 'Le Grand Ours règne sur la montagne. Abats-le.', ok: () => G.flags.grandOurs },
  { t: 'Tu es chez toi ici. Survis à toutes les saisons.', ok: () => false },
];

export const UI = {
  init() {
    G.toast = (m, t) => this.toast(m, t);
    on('banner', ({ t, s }) => this.banner(t, s));
    on('loot', (list) => this.loot(list));
    on('container', (o) => this.openContainer(o));
    on('craft', (o) => this.openCraft(o.station, o.struct));
    on('death', (o) => this.death(o));
    on('inv', () => { this.hotbarDirty = true; if (G.uiOpen) this.refreshSheet(); });
    on('season', (s) => { this.banner(SEASONS[s], ['Les bourgeons éclatent, les rivières gonflent.', 'Chaleur, orages… et le risque d’incendie.', 'Les feuilles roussissent. Fais des réserves.', 'Le froid mord. Le feu est ta meilleure amie.'][s]); });
    on('weather', (k) => { if (k === 'orage' || k === 'blizzard' || k === 'canicule') this.toast({ orage: 'Un orage se lève : abrite-toi.', blizzard: 'Blizzard ! Reste près du feu.', canicule: 'Canicule : bois souvent, cherche l’ombre.' }[k], 'warn'); });
    on('placing', (p) => { $('#tbPlace').classList.toggle('hidden', !p || !G.isTouch); });
    $('#sheetClose').onclick = () => this.closeSheet();
    $('#sheet').addEventListener('pointerdown', (e) => { if (e.target.id === 'sheet') this.closeSheet(); });
    this.buildCompass();
    this.hudT = 0; this.mmT = 0; this.hotbarDirty = true; this.goalIdx = 0;
    $('#hotbar').addEventListener('click', (e) => { const s = e.target.closest('.hs'); if (s) { G.player.hotbar = +s.dataset.i; this.hotbarDirty = true; } });
  },

  // ---------- messages ----------
  toast(msg, type = '') {
    const box = $('#toasts');
    if (this.lastToast === msg && G.t - this.lastToastT < 3) return;
    this.lastToast = msg; this.lastToastT = G.t;
    const d = document.createElement('div'); d.className = 'toast ' + type; d.innerHTML = msg;
    box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 450); }, type === 'bad' || type === 'warn' ? 4800 : 3400);
  },
  banner(t, s = '') {
    const b = $('#banner'); b.querySelector('h2').textContent = t; b.querySelector('p').textContent = s;
    b.classList.add('on'); clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.remove('on'), 4200);
  },
  loot(list) {
    const box = $('#loot');
    for (const [id, n] of list) {
      const d = document.createElement('div'); d.className = 'lt';
      d.innerHTML = `<img src="${itemIcon(id)}" alt=""><span>${esc(ITEMS[id].n)}</span><b>+${n}</b>`;
      box.appendChild(d);
      setTimeout(() => { d.style.opacity = 0; d.style.transition = '.5s'; setTimeout(() => d.remove(), 500); }, 2400);
    }
    while (box.children.length > 6) box.firstChild.remove();
  },

  // ---------- HUD ----------
  buildCompass() {
    const strip = $('#compassStrip');
    const lbl = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
    let h = '';
    for (let rep = -1; rep <= 1; rep++) for (let a = 0; a < 360; a += 15) {
      const x = (a + rep * 360) * 2;
      h += lbl[a] ? `<span class="c ${lbl[a]}" style="left:${x}px">${lbl[a]}</span>` : `<span style="left:${x}px">·</span>`;
    }
    strip.innerHTML = h + '<b id="compassMarks"></b>';
  },
  updateHUD(dt) {
    const P = G.player; if (!P) return;
    // boussole (fluide)
    const head = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360;
    $('#compassStrip').style.transform = `translateX(${-head * 2}px)`;
    const hurt = $('#hurt'); hurt.style.opacity = Math.min(1, (G.hurt || 0) + (P.stats.vie < 25 ? 0.25 + Math.sin(G.t * 4) * 0.1 : 0));
    G.hurt = Math.max(0, (G.hurt || 0) - dt * 1.4);
    const hold = $('#hold'); hold.classList.toggle('on', (G.holdProgress || 0) > 0.02);
    hold.querySelector('circle').style.strokeDashoffset = 100.5 * (1 - (G.holdProgress || 0));
    this.hudT -= dt;
    if (this.hudT > 0) return;
    this.hudT = 0.1;
    const S = P.stats, h = G.time.hour;
    $('#clSeason').textContent = SEASONS[G.season] + (G.year > 1 ? ' · an ' + G.year : '');
    $('#clDay').textContent = 'Jour ' + G.time.day;
    $('#clTime').textContent = String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0');
    $('#clWeather').textContent = (G.weather.n || '') + (G.flood > 0.4 ? ' · crue' : '') + (G.dry > 0.6 ? ' · sécheresse' : '') + (G.frozen > 0.6 ? ' · lacs gelés' : '');
    $('#clTemp').textContent = fmt(G.airTemp ?? 15) + ' °C';
    for (const k of ['vie', 'faim', 'soif', 'energie', 'sommeil']) {
      const b = $('#vitals .bar.' + k); b.querySelector('.fill').style.width = Math.max(0, S[k]) + '%';
      b.classList.toggle('low', S[k] < 20);
    }
    const bt = $('#bodyTemp'); bt.textContent = fmt(S.temp, 1) + ' °C'; bt.className = S.temp < 36 ? 'cold' : S.temp > 38.2 ? 'hot' : '';
    $('#feltTemp').textContent = 'ressenti ' + fmt(G.survival.felt) + ' °C';
    const fx = Object.keys(P.fx).filter((k) => EFFECTS[k]);
    const fxKey = fx.join(',');
    if (fxKey !== this.fxKey) {
      this.fxKey = fxKey;
      $('#effects').innerHTML = fx.map((k) => `<div class="fx" style="border-color:${EFFECTS[k].col}">${EFFECTS[k].n}${EFFECTS[k].bad ? `<small>${EFFECTS[k].tip}</small>` : ''}</div>`).join('');
    }
    $('#wetfx').style.opacity = S.wet > 0.35 ? S.wet * 0.8 : 0;
    if (this.hotbarDirty) this.renderHotbar();
    else this.hotbarTick = (this.hotbarTick || 0) + 1, this.hotbarTick % 10 === 0 && this.renderHotbar();
    // aide contextuelle
    const pr = G.interact.prompt();
    const keys = [];
    const kA = isTouch() ? 'Action' : input.lastDevice === 'pad' ? 'X' : 'Clic';
    const kE = isTouch() ? 'Utiliser' : input.lastDevice === 'pad' ? 'B' : 'E';
    if (pr.a) keys.push(`<span class="kb"><kbd>${kA}</kbd>${esc(pr.a)}</span>`);
    if (pr.e) keys.push(`<span class="kb"><kbd>${kE}</kbd>${esc(pr.e)}</span>`);
    const show = !G.uiOpen && !P.dead && (pr.name || keys.length);
    $('#prompt').style.display = show ? '' : 'none';
    if (show) { $('#prompt .pr-name').textContent = pr.name; $('#prompt .pr-info').textContent = pr.info || ''; $('#prompt .pr-keys').innerHTML = keys.join(''); }
    const ch = $('#crosshair'); ch.classList.toggle('aim', !!(P.tool && P.tool.kind === 'arc')); ch.classList.toggle('target', !!(G.interact.target && (pr.a || pr.e)));
    ch.style.display = P.view === 3 && !(P.tool && P.tool.kind === 'arc') && !G.placing ? 'none' : '';
    // objectif
    this.goalT = (this.goalT || 0) - 0.1;
    if (this.goalT <= 0) { this.goalT = 1; this.checkGoals(); }
    this.mmT -= 0.1; if (this.mmT <= 0) { this.mmT = 0.25; this.drawMinimap(); }
  },
  checkGoals() {
    let i = G.flags.goal || 0;
    while (i < GOALS.length - 1 && GOALS[i].ok()) { i++; if (i > (G.flags.goal || 0)) { this.toast('Objectif atteint !', 'good'); G.audio.play('quest'); } }
    G.flags.goal = i;
    const g = $('#goal'); g.classList.toggle('hidden', !G.settings.goals && G.settings.goals !== undefined);
    $('#goalTxt').textContent = GOALS[i].t;
  },
  renderHotbar() {
    this.hotbarDirty = false;
    const P = G.player, el = $('#hotbar');
    let h = '';
    for (let i = 0; i < 8; i++) h += this.slotHTML(G.inv.slots[i], 'hs' + (i === P.hotbar ? ' sel' : ''), `data-i="${i}"`, isTouch() ? '' : i + 1);
    el.innerHTML = h;
  },
  slotHTML(s, cls, attrs = '', key = '') {
    if (!s) return `<div class="${cls}" ${attrs}>${key !== '' ? `<span class="k">${key}</span>` : ''}</div>`;
    const it = ITEMS[s.id];
    let extra = '';
    if (s.d !== undefined && it.dur) extra += `<span class="dur"><i style="width:${Math.max(0, (s.d / it.dur) * 100)}%;background:${s.d / it.dur < 0.25 ? 'var(--red)' : 'var(--green)'}"></i></span>`;
    if (it.perish) { const f = freshness(s); extra += `<span class="fresh" style="background:${f > 0.5 ? '#7cc35a' : f > 0.25 ? '#e0b040' : '#e0574a'}"></span>`; }
    if (s.p !== undefined && SECHE[s.id]) extra += `<span class="dur"><i style="width:${Math.min(100, (s.p / SECHE[s.id][1]) * 100)}%;background:var(--orange)"></i></span>`;
    return `<div class="${cls}" ${attrs} title="${esc(it.n)}">${key !== '' ? `<span class="k">${key}</span>` : ''}<img src="${itemIcon(s.id)}" alt="">${s.n > 1 ? `<span class="n">${s.n}</span>` : ''}${extra}</div>`;
  },

  drawMinimap() {
    const c = $('#minimap'), g = c.getContext('2d'), P = G.player, T = G.terrain;
    const W = c.width, R = W / 2, scale = 1.25; // px par mètre
    g.save(); g.clearRect(0, 0, W, W);
    g.fillStyle = '#123'; g.fillRect(0, 0, W, W);
    g.translate(R, R); g.rotate(P.yaw);
    const mpp = WORLD / T.N; // mètres par pixel de carte
    const sx = (P.pos.x + HALF) / mpp, sz = (P.pos.z + HALF) / mpp;
    const span = (R / scale) / mpp * 1.5;
    g.imageSmoothingEnabled = true;
    g.drawImage(T.mapCanvas, sx - span, sz - span, span * 2, span * 2, -span * mpp * scale, -span * mpp * scale, span * 2 * mpp * scale, span * 2 * mpp * scale);
    const dot = (x, z, col, r = 3) => { g.fillStyle = col; g.beginPath(); g.arc((x - P.pos.x) * scale, (z - P.pos.z) * scale, r, 0, 7); g.fill(); };
    for (const s of G.buildings.list.values()) if (s.k === 'feu' || s.k === 'lit') dot(s.x, s.z, s.k === 'feu' ? '#f0903a' : '#f2c866', 3);
    for (const p of G.pois.list) if (p.found) dot(p.x, p.z, '#8fd6e8', 3.5);
    for (const a of G.animals.list) if (!a.dead && a.def.hostile && Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) < 45) dot(a.pos.x, a.pos.z, '#ff4a3a', 2.5);
    if (G.fireAlert && G.time.total - G.fireAlert.t < 6) dot(G.fireAlert.x, G.fireAlert.z, '#ff7a20', 4);
    g.restore();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(R, R - 7); g.lineTo(R + 5, R + 5); g.lineTo(R, R + 2); g.lineTo(R - 5, R + 5); g.closePath(); g.fill();
  },

  // ---------- feuilles (panneaux) ----------
  openSheet(kind, title, opts = {}) {
    if (G.placing && kind !== 'build') G.buildings.cancelPlacing();
    G.uiOpen = kind; this.sheet = { kind, title, ...opts };
    input.unlock();
    $('#sheet').classList.remove('hidden');
    this.refreshSheet();
    G.audio.play('ui');
  },
  closeSheet() {
    if (!G.uiOpen) return;
    G.uiOpen = null; this.sheet = null; this.sel = null;
    $('#sheet').classList.add('hidden');
    if (!G.isTouch && !G.paused) input.lock();
  },
  toggle(kind) {
    if (G.uiOpen === kind) { this.closeSheet(); return; }
    if (kind === 'inventory') this.openSheet('inventory', 'Sac');
    else if (kind === 'craft') this.openCraft(null);
    else if (kind === 'build') this.openSheet('build', 'Construire', { cat: 'Base' });
    else if (kind === 'map') this.openSheet('map', 'Carte de l’île');
    else if (kind === 'help') this.openSheet('help', 'Guide de survie');
  },
  openCraft(station, struct) { this.openSheet('craft', station ? STATIONS[station] : 'Fabriquer', { station, struct, cat: station === 'feu' ? 'Cuisine' : 'Tout' }); },
  openContainer(o) { this.openSheet('container', o.title, { cont: o }); },
  refreshSheet() {
    const s = this.sheet; if (!s) return;
    $('#sheetTitle').textContent = s.title;
    $('#sheetTabs').innerHTML = '';
    const body = $('#sheetBody');
    if (s.kind === 'inventory') this.renderInventory(body);
    else if (s.kind === 'craft') this.renderCraft(body);
    else if (s.kind === 'build') this.renderBuild(body);
    else if (s.kind === 'map') this.renderMap(body);
    else if (s.kind === 'container') this.renderContainer(body);
    else if (s.kind === 'help') this.renderHelp(body);
  },
  tabs(list, cur, fn) {
    const el = $('#sheetTabs');
    el.innerHTML = list.map((t) => `<button class="tab ${t === cur ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('');
    $$('.tab', el).forEach((b) => (b.onclick = () => { fn(b.dataset.t); G.audio.play('ui'); }));
  },

  // --- sac
  renderInventory(body) {
    const P = G.player, inv = G.inv;
    this.tabs(['Sac', 'Guide'], 'Sac', (t) => { if (t === 'Guide') this.openSheet('help', 'Guide de survie'); });
    let h = '<div class="inv-wrap"><div><div class="lbl">Barre rapide (1 – 8) puis sac</div><div class="grid" id="invGrid">';
    inv.slots.forEach((s, i) => (h += this.slotHTML(s, 'slot' + (i < 8 ? ' hb' : '') + (this.sel === i ? ' sel' : ''), `data-i="${i}"`, i < 8 ? i + 1 : '')));
    h += '</div><div class="btns"><button class="btn ghost" id="invSort">Trier le sac</button></div></div><div class="side">';
    h += '<div class="lbl" style="margin-top:0">Équipement</div><div class="equip">';
    for (const [k, lab] of [['tete', 'Tête'], ['corps', 'Corps'], ['jambes', 'Jambes']]) {
      const s = P.equip[k];
      h += s ? this.slotHTML(s, 'slot', `data-eq="${k}"`).replace('<img', `<span class="lab">${lab}</span><img`) : `<div class="slot" data-eq="${k}"><span class="lab">${lab}</span></div>`;
    }
    h += '</div>';
    const a = G.survival.armor();
    h += `<p class="stat">Protection : <b>${a.def}</b> · Chaleur : <b>+${a.warm} °C</b>${a.cool ? ` · Fraîcheur : <b>${a.cool}</b>` : ''}</p>`;
    const sel = this.sel !== null && this.sel !== undefined ? (typeof this.sel === 'string' ? P.equip[this.sel] : inv.slots[this.sel]) : null;
    if (sel) {
      const it = ITEMS[sel.id];
      h += `<div class="lbl">Objet</div><h3>${esc(it.n)}${sel.n > 1 ? ' ×' + sel.n : ''}</h3>`;
      if (it.desc) h += `<p>${esc(it.desc)}</p>`;
      if (it.eat) { const e = it.eat; const parts = []; if (e.faim) parts.push((e.faim > 0 ? '+' : '') + e.faim + ' faim'); if (e.soif) parts.push((e.soif > 0 ? '+' : '') + e.soif + ' soif'); if (e.vie) parts.push('+' + e.vie + ' vie'); if (e.cure) parts.push('soigne : ' + e.cure.map((c) => EFFECTS[c].n.toLowerCase()).join(', ')); if (e.intox) parts.push('risque d’intoxication'); if (e.poison) parts.push('toxique !'); h += `<p class="stat">${parts.join(' · ')}</p>`; }
      if (it.tool) h += `<p class="stat">Dégâts ${it.tool.dmg}${it.tool.reach ? ' · portée ' + fmt(it.tool.reach, 1) + ' m' : ''}</p>`;
      if (it.wear) h += `<p class="stat">Protection ${it.wear.def} · chaleur ${it.wear.warm >= 0 ? '+' : ''}${it.wear.warm} °C</p>`;
      if (sel.d !== undefined && it.dur) h += `<p class="stat">Usure : ${Math.round((sel.d / it.dur) * 100)} %</p>`;
      if (it.perish) h += `<p class="stat">Fraîcheur : ${Math.round(freshness(sel) * 100)} %</p>`;
      h += '<div class="btns">';
      if (typeof this.sel === 'string') h += '<button class="btn prim" data-act="unequip">Retirer</button>';
      else {
        if (it.eat || it.plan) h += `<button class="btn prim" data-act="use">${esc(it.plan ? 'Lire' : it.verb || (it.cat === 'eau' || (it.eat.soif || 0) > (it.eat.faim || 0) ? 'Boire' : 'Manger'))}</button>`;
        if (it.wear) h += '<button class="btn prim" data-act="equip">Équiper</button>';
        if (this.sel >= 8) h += '<button class="btn" data-act="hotbar">Mettre en main</button>';
        if (sel.n > 1) h += '<button class="btn ghost" data-act="split">Diviser</button>';
        h += '<button class="btn ghost" data-act="drop">Jeter</button>';
      }
      h += '</div>';
    } else h += '<p>Touche un objet pour le voir. Touche-le puis une autre case pour le déplacer.</p>';
    h += '</div></div>';
    body.innerHTML = h;
    $$('#invGrid .slot').forEach((el) => (el.onclick = () => this.clickSlot(+el.dataset.i)));
    $$('.equip .slot').forEach((el) => (el.onclick = () => this.clickEquip(el.dataset.eq)));
    $('#invSort').onclick = () => { inv.sort(8); this.sel = null; this.refreshSheet(); };
    $$('[data-act]').forEach((b) => (b.onclick = () => this.invAct(b.dataset.act)));
  },
  clickSlot(i) {
    const inv = G.inv, P = G.player;
    if (typeof this.sel === 'string') { // déséquiper vers cette case
      const st = P.equip[this.sel]; if (!inv.slots[i]) { inv.slots[i] = st; P.equip[this.sel] = null; P.setGear(); emit('inv', inv); } this.sel = null; this.refreshSheet(); return;
    }
    if (this.sel === null || this.sel === undefined) { if (inv.slots[i]) this.sel = i; this.refreshSheet(); return; }
    if (this.sel === i) { this.sel = null; this.refreshSheet(); return; }
    const a = inv.slots[this.sel], b = inv.slots[i];
    if (b && a && a.id === b.id && Inventory.stackOf(a.id) > 1 && a.d === undefined) {
      const k = Math.min(Inventory.stackOf(a.id) - b.n, a.n); b.n += k; a.n -= k; if (ITEMS[a.id].perish) b.a = Math.max(a.a || 0, b.a || 0);
      if (a.n <= 0) inv.slots[this.sel] = null;
    } else { inv.slots[this.sel] = b; inv.slots[i] = a; }
    this.sel = null; emit('inv', inv); G.audio.play('ui');
  },
  clickEquip(slot) {
    const P = G.player, inv = G.inv;
    if (typeof this.sel === 'number') {
      const s = inv.slots[this.sel]; const w = s && ITEMS[s.id].wear;
      if (w && w.slot === slot) { this.equipFrom(this.sel); return; }
    }
    this.sel = P.equip[slot] ? slot : null; this.refreshSheet();
  },
  equipFrom(i) {
    const P = G.player, inv = G.inv, s = inv.slots[i], w = ITEMS[s.id].wear;
    const old = P.equip[w.slot];
    P.equip[w.slot] = { ...s, n: 1 };
    if (s.n > 1) s.n -= 1; else inv.slots[i] = null;
    if (old) inv.putStack(old);
    P.setGear(); this.sel = null; G.audio.play('craft'); emit('inv', inv);
  },
  invAct(act) {
    const inv = G.inv, P = G.player, i = this.sel;
    if (act === 'use') { const prev = P.hotbar; G.survival.consume(i); P.hotbar = prev; if (!inv.slots[i]) this.sel = null; }
    if (act === 'equip') this.equipFrom(i);
    if (act === 'unequip') { const st = P.equip[i]; if (inv.free()) { inv.putStack(st); P.equip[i] = null; P.setGear(); } else this.toast('Sac plein.', 'bad'); this.sel = null; }
    if (act === 'hotbar') { let j = inv.slots.findIndex((s, k) => k < 8 && !s); if (j < 0) j = P.hotbar; const t = inv.slots[j]; inv.slots[j] = inv.slots[i]; inv.slots[i] = t; P.hotbar = j; this.sel = null; }
    if (act === 'split') { const s = inv.slots[i]; const j = inv.slots.findIndex((q) => !q); if (j >= 0) { const k = Math.floor(s.n / 2); s.n -= k; inv.slots[j] = { ...s, n: k }; } this.sel = null; }
    if (act === 'drop') { const st = inv.takeSlot(i); const f = G.interact.forward(); G.interact.dropGround(st.id, st.n, P.pos.x + f.x * 1.2, P.pos.z + f.z * 1.2, null, { d: st.d, a: st.a }); this.sel = null; }
    emit('inv', inv); this.refreshSheet();
  },

  // --- fabrication
  stationsNear() {
    const p = G.player.pos, B = G.buildings;
    const st = { main: true };
    if (B.nearest(p.x, p.z, 4.5, (s) => s.k === 'etabli')) st.etabli = true;
    if (B.nearest(p.x, p.z, 4.5, (s) => s.k === 'forge')) st.forge = true;
    if (B.nearest(p.x, p.z, 4.5, (s) => s.k === 'feu' && s.data.fuel > 0)) st.feu = true;
    return st;
  },
  renderCraft(body) {
    const s = this.sheet, st = this.stationsNear();
    const cats = ['Tout', 'Outils', 'Armes', 'Vêtements', 'Soins', 'Cuisine', 'Matériaux'];
    this.tabs(cats, s.cat, (c) => { s.cat = c; this.refreshSheet(); });
    let h = '';
    const fire = s.struct && s.struct.k === 'feu' ? s.struct : G.buildings.nearest(G.player.pos.x, G.player.pos.z, 4.5, (q) => q.k === 'feu');
    if (fire && (s.station === 'feu' || st.feu)) h += `<div class="station">🔥 Feu de camp — bois pour <b>${fmt(fire.data.fuel, 1)} h</b><button class="btn" id="addWood" ${G.inv.count('bois') ? '' : 'disabled'}>Ajouter du bois (+2 h)</button></div>`;
    const avail = Object.keys(st).filter((k) => st[k]).map((k) => STATIONS[k]);
    h += `<p style="margin:0 0 10px;color:var(--mute);font-size:13px">Postes à portée : ${avail.join(', ')}. Approche-toi d’un établi, d’une forge ou d’un feu pour plus de recettes.</p>`;
    const list = RECIPES.filter((r) => s.cat === 'Tout' || r.cat === s.cat);
    const order = (r) => (st[r.st] ? 0 : 1) + (r.plan && !G.flags['plan_' + r.plan] ? 2 : 0);
    list.sort((a, b) => order(a) - order(b) || (s.station && a.st === s.station ? -1 : 0));
    h += '<div class="cards">';
    for (const r of list) {
      const it = ITEMS[r.out];
      const lockPlan = r.plan && !G.flags['plan_' + r.plan];
      const can = st[r.st] && G.inv.has(r.cost) && !lockPlan;
      const cost = Object.entries(r.cost).map(([k, n]) => `<span class="${G.inv.count(k) >= n ? 'ok' : 'miss'}">${esc(ITEMS[k].n)} ${G.inv.count(k)}/${n}</span>`).join('');
      const need = lockPlan ? 'Plan requis (bunkers)' : !st[r.st] ? 'Il faut : ' + STATIONS[r.st] : '';
      h += `<div class="card ${can ? '' : 'no'}"><img src="${itemIcon(r.out)}" alt=""><div class="card-body"><h4>${esc(r.label || it.n)}${r.n > 1 ? ' ×' + r.n : ''}</h4><p>${esc(it.desc || '')}</p><div class="cost">${cost}</div>${need ? `<p style="color:#f0b07a">${need}</p>` : ''}<button class="btn" data-r="${r.i}" ${can ? '' : 'disabled'}>Fabriquer</button></div></div>`;
    }
    h += '</div>';
    body.innerHTML = h;
    if ($('#addWood')) $('#addWood').onclick = () => { if (G.inv.remove('bois', 1)) { fire.data.fuel = Math.min(12, fire.data.fuel + 2); G.audio.play('fire'); this.refreshSheet(); } };
    $$('[data-r]', body).forEach((b) => (b.onclick = () => this.craft(RECIPES[+b.dataset.r])));
  },
  craft(r) {
    const st = this.stationsNear();
    if (!st[r.st] || !G.inv.has(r.cost)) return;
    G.inv.pay(r.cost);
    G.interact.give({ [r.out]: r.n || 1, ...(r.give || {}) });
    G.stats.crafted++;
    if (r.out === 'gourde_propre') G.flags.boiled = true;
    if (r.out === 'arc') G.flags.madeBow = true;
    if (r.out === 'fer') G.flags.smelted = true;
    G.audio.play('craft');
    this.refreshSheet();
  },

  // --- construction
  renderBuild(body) {
    const s = this.sheet;
    this.tabs(['Base', 'Abri', 'Défense', 'Ferme'], s.cat, (c) => { s.cat = c; this.refreshSheet(); });
    let h = `<p style="margin:0 0 10px;color:var(--mute);font-size:13px">${isTouch() ? 'Choisis un ouvrage, vise, puis touche Action pour le poser.' : 'Choisis un ouvrage, vise, clic pour poser · R tourner · X annuler.'} Murs, planchers et toits s’alignent sur une grille de 3 m. Maintiens « Utiliser » sur un ouvrage pour le démonter.</p><div class="cards">`;
    for (const [k, b] of Object.entries(BUILDS)) {
      if (b.cat !== s.cat) continue;
      const can = G.inv.has(b.cost);
      const cost = Object.entries(b.cost).map(([q, n]) => `<span class="${G.inv.count(q) >= n ? 'ok' : 'miss'}">${esc(ITEMS[q].n)} ${G.inv.count(q)}/${n}</span>`).join('');
      h += `<div class="card ${can ? '' : 'no'}"><img src="${buildIcon(k)}" alt=""><div class="card-body"><h4>${esc(b.n)}</h4><p>${esc(b.desc)}</p><div class="cost">${cost}</div><button class="btn" data-b="${k}" ${can ? '' : 'disabled'}>Placer</button></div></div>`;
    }
    body.innerHTML = h + '</div>';
    $$('[data-b]', body).forEach((b) => (b.onclick = () => { const k = b.dataset.b; this.closeSheet(); G.buildings.startPlacing(k); }));
  },

  // --- conteneurs
  renderContainer(body) {
    const c = this.sheet.cont, inv = c.inv;
    let h = '';
    if (c.kind === 'sechoir') h += `<div class="station">Dépose de la viande, du poisson, des baies ou de la nourriture pourrie : séchés en 8 à 16 h. Rien ne pourrit ici.</div>`;
    h += `<div class="two"><div><div class="lbl">${esc(c.title)}</div><div class="grid" id="cGrid">`;
    inv.slots.forEach((s, i) => (h += this.slotHTML(s, 'slot', `data-c="${i}"`)));
    h += `</div><div class="btns"><button class="btn" id="takeAll">Tout prendre</button></div></div><div><div class="lbl">Ton sac — touche un objet pour le déposer</div><div class="grid" id="pGrid">`;
    G.inv.slots.forEach((s, i) => (h += this.slotHTML(s, 'slot' + (i < 8 ? ' hb' : ''), `data-p="${i}"`)));
    h += '</div></div></div>';
    body.innerHTML = h;
    $$('#cGrid .slot').forEach((el) => (el.onclick = () => { const st = inv.takeSlot(+el.dataset.c); if (!st) return; const left = G.inv.putStack(st); if (left) inv.add(st.id, left, { d: st.d, a: st.a }); this.afterContainer(c); }));
    $$('#pGrid .slot').forEach((el) => (el.onclick = () => {
      const i = +el.dataset.p, s = G.inv.slots[i]; if (!s) return;
      if (c.kind === 'sechoir' && !SECHE[s.id]) { this.toast('Le séchoir n’accepte que viande, poisson, baies et nourriture pourrie.'); return; }
      if (c.kind === 'caisse' || c.kind === 'drop') { this.toast('On ne range rien ici.'); return; }
      const st = G.inv.takeSlot(i); const left = inv.putStack(st); if (left) G.inv.add(st.id, left, { d: st.d, a: st.a }); this.afterContainer(c);
    }));
    $('#takeAll').onclick = () => { inv.slots.forEach((s, i) => { if (!s) return; const st = inv.takeSlot(i); const left = G.inv.putStack(st); if (left) inv.add(st.id, left, { d: st.d, a: st.a }); }); this.afterContainer(c); };
  },
  afterContainer(c) {
    G.audio.play('pick');
    if (c.kind === 'drop' && c.inv.free() === c.inv.size && c.struct) { G.buildings.removeStruct(c.struct, true); this.closeSheet(); return; }
    if (c.kind === 'caisse' && c.inv.free() === c.inv.size) { /* caisse vidée */ }
    emit('inv', G.inv); this.refreshSheet();
  },

  // --- carte
  renderMap(body) {
    body.innerHTML = `<div id="mapWrap"><canvas id="bigmap" width="640" height="640"></canvas><div class="legend"><span><i style="background:#fff"></i>Toi</span><span><i style="background:#f0903a"></i>Feu</span><span><i style="background:#f2c866"></i>Lit</span><span><i style="background:#8fd6e8"></i>Lieu découvert</span><span><i style="background:#ff7a20"></i>Incendie</span></div></div>`;
    const c = $('#bigmap'), g = c.getContext('2d'), T = G.terrain, W = c.width, k = W / WORLD;
    g.imageSmoothingEnabled = true; g.drawImage(T.mapCanvas, 0, 0, W, W);
    // brouillard
    const N = 128, cell = W / N;
    g.fillStyle = 'rgba(8,14,10,0.86)';
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (!G.explored[j * N + i]) g.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
    const pt = (x, z) => [(x + HALF) * k, (z + HALF) * k];
    g.font = '600 12px system-ui'; g.textAlign = 'center';
    for (const p of G.pois.list) if (p.found) { const [x, y] = pt(p.x, p.z); g.fillStyle = '#8fd6e8'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.fillStyle = '#eaf3e2'; g.fillText(p.n, x, y - 9); }
    for (const s of G.buildings.list.values()) if (s.k === 'feu' || s.k === 'lit') { const [x, y] = pt(s.x, s.z); g.fillStyle = s.k === 'feu' ? '#f0903a' : '#f2c866'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    if (G.fireAlert && G.time.total - G.fireAlert.t < 8) { const [x, y] = pt(G.fireAlert.x, G.fireAlert.z); g.fillStyle = '#ff7a20'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
    const [px, py] = pt(G.player.pos.x, G.player.pos.z);
    g.save(); g.translate(px, py); g.rotate(-G.player.yaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath(); g.stroke(); g.fill(); g.restore();
  },

  // --- guide
  renderHelp(body) {
    const t = isTouch();
    body.innerHTML = `<div class="help">
      <h4>Commandes</h4>
      ${t ? `<p>Joystick à gauche pour marcher, glisse à droite pour regarder. <b>Action</b> : frapper, couper, tirer, manger l’objet en main. <b>Utiliser</b> : ramasser, ouvrir, boire, dormir (maintenir : démonter un ouvrage). Touche la barre du bas pour changer d’objet.</p>`
        : `<p><kbd>ZQSD</kbd>/<kbd>WASD</kbd> marcher · <kbd>Maj</kbd> courir · <kbd>Espace</kbd> sauter · souris : regarder.<br><kbd>Clic</kbd> action (frapper, couper, tirer, manger) · <kbd>E</kbd> utiliser (maintenir : démonter).<br><kbd>1</kbd>–<kbd>8</kbd> / molette : objet en main · <kbd>Tab</kbd> sac · <kbd>C</kbd> fabriquer · <kbd>B</kbd> bâtir · <kbd>M</kbd> carte · <kbd>V</kbd> vue 1re/3e personne · <kbd>G</kbd> poser au sol · <kbd>Échap</kbd> pause.</p>
           <p>Manette : stick gauche marcher, stick droit regarder, <kbd>A</kbd> sauter, <kbd>X</kbd>/<kbd>RT</kbd> action, <kbd>B</kbd> utiliser, <kbd>Y</kbd> sac, <kbd>LB</kbd>/<kbd>RB</kbd> objet, <kbd>Start</kbd> pause, croix : fabriquer / bâtir.</p>`}
      <h4>Le corps</h4><p>Surveille la vie, la faim, la soif, l’énergie et le sommeil. La température du corps doit rester vers 37 °C : le froid, la pluie et le vent la font chuter, le feu, un toit et les vêtements chauds la remontent. Trop chaud : bois et mets un chapeau de paille.</p>
      <h4>Blessures et maladies</h4><p>Les morsures font saigner : un bandage arrête l’hémorragie. Une plaie négligée s’infecte, puis donne la fièvre : cataplasme et tisane. La viande crue, la nourriture avariée et l’eau brute rendent malade. Les baies sombres et les amanites empoisonnent : il faut un antidote. Une mauvaise chute donne une entorse : une attelle.</p>
      <h4>L’eau</h4><p>Boire au lac est risqué. Remplis une gourde et fais-la bouillir au feu de camp. Un récupérateur donne de l’eau de pluie potable.</p>
      <h4>Les saisons</h4><p>Printemps : pluies et crues. Été : chaleur, sécheresse, orages et feux de forêt — une gourde d’eau éteint un arbre en flammes. Automne : champignons et réserves. Hiver : neige, lacs gelés, rien ne pousse, les loups chassent même le jour.</p>
      <h4>Ferme et cuisine</h4><p>Les hautes herbes donnent des graines de blé, les carottes sauvages des graines de carotte, les ruines des graines de courge. Sème dans une parcelle, arrose (pluie ou gourde), récolte. Le compost double la vitesse. Un épouvantail éloigne les lapins. Le séchoir fait de la viande séchée qui ne pourrit jamais. Nourris une poule pour l’apprivoiser : au poulailler, elle pond chaque matin.</p>
      <h4>Combat</h4><p>Le feu et la torche tiennent les loups à distance. Les sangliers chargent si on les provoque, l’ours défend son territoire le jour. Toutes les trois nuits, une meute attaque ton camp : murs et palissades de pieux la retiennent. Sur la montagne vit le Grand Ours.</p>
      <h4>Explorer</h4><p>Ruines, cabanes, épaves et bunkers gardent des caisses : ferraille, conserves, trousses, et dans les bunkers, des plans (arbalète, plastron, lanterne).</p>
    </div>`;
  },

  // ---------- menus ----------
  showMenu(kind, data) {
    const m = $('#menu'); m.classList.remove('hidden'); m.className = kind === 'title' ? 'title' : '';
    this.menuKind = kind;
    const card = $('#menuCard');
    const info = saveInfo();
    if (kind === 'title') {
      card.innerHTML = `<img class="logo" src="./logo.png" alt=""><h1>Renaissance <em>Verte</em></h1><p class="sub">Une île sauvage, quatre saisons, et toi. Survis.</p>
        <div class="mbtns">${info ? `<button class="btn prim" id="mContinue">Continuer · jour ${info.day}</button>` : ''}
        <button class="btn ${info ? '' : 'prim'}" id="mNew">Nouvelle partie</button>
        <button class="btn ghost" id="mSettings">Réglages</button><button class="btn ghost" id="mHelp">Guide et commandes</button>
        ${window.rvDesktop ? '<button class="btn ghost" id="mQuit">Quitter</button>' : ''}</div><p class="foot">v3.0 · ${G.isTouch ? 'écran tactile' : 'clavier, souris, manette'}</p>`;
      if ($('#mContinue')) $('#mContinue').onclick = () => G.continueGame();
      $('#mNew').onclick = () => (info ? this.showMenu('confirmNew') : this.showMenu('new'));
      $('#mSettings').onclick = () => this.showMenu('settings', 'title');
      $('#mHelp').onclick = () => this.showMenu('help', 'title');
      if ($('#mQuit')) $('#mQuit').onclick = () => window.close();
    } else if (kind === 'confirmNew') {
      card.innerHTML = `<h2>Nouvelle partie ?</h2><p class="sub">La partie en cours sera remplacée.</p><div class="mbtns"><button class="btn prim" id="mYes">Oui, recommencer</button><button class="btn ghost" id="mNo">Retour</button></div>`;
      $('#mYes').onclick = () => this.showMenu('new'); $('#mNo').onclick = () => this.showMenu('title');
    } else if (kind === 'new') {
      this.newDiff = this.newDiff || 'normal';
      const seed = Math.floor(Math.random() * 999999);
      card.innerHTML = `<h2>Nouvelle partie</h2><div class="opts"><div class="seg" id="diffSeg">${Object.entries(DIFFICULTY).map(([k, d]) => `<button data-d="${k}" class="${k === this.newDiff ? 'on' : ''}"><b>${d.label}</b><small>${{ paisible: 'Besoins lents, bêtes calmes, pas d’attaque du camp.', normal: 'L’expérience prévue.', rude: 'Faim rapide, bêtes féroces.' }[k]}</small></button>`).join('')}</div>
        <label class="opt">Graine du monde<small>Le même nombre donne la même île.</small><input type="text" id="seedIn" value="${seed}" inputmode="numeric" size="8"></label></div>
        <div class="mbtns"><button class="btn prim" id="mGo">Commencer</button><button class="btn ghost" id="mBack">Retour</button></div>`;
      $$('#diffSeg button').forEach((b) => (b.onclick = () => { this.newDiff = b.dataset.d; $$('#diffSeg button').forEach((q) => q.classList.toggle('on', q === b)); }));
      $('#mGo').onclick = () => G.startNew({ difficulty: this.newDiff, seed: parseInt($('#seedIn').value, 10) || seed });
      $('#mBack').onclick = () => this.showMenu('title');
    } else if (kind === 'pause') {
      card.innerHTML = `<h2>Pause</h2><div class="stats"><div><b>${G.time.day}</b><span>jours</span></div><div><b>${G.stats.kills}</b><span>bêtes</span></div><div><b>${G.stats.built}</b><span>ouvrages</span></div></div>
        <div class="mbtns"><button class="btn prim" id="mResume">Reprendre</button><button class="btn" id="mSave">Sauvegarder</button><button class="btn ghost" id="mSettings">Réglages</button><button class="btn ghost" id="mHelp">Guide et commandes</button><button class="btn ghost" id="mTitle">Menu principal</button></div>`;
      $('#mResume').onclick = () => G.resume();
      $('#mSave').onclick = () => { G.save(true); };
      $('#mSettings').onclick = () => this.showMenu('settings', 'pause');
      $('#mHelp').onclick = () => this.showMenu('help', 'pause');
      $('#mTitle').onclick = () => G.quitToTitle();
    } else if (kind === 'settings') {
      const S = G.settings;
      card.innerHTML = `<h2>Réglages</h2><div class="opts">
        <label class="opt">Qualité graphique<small>« Auto » s’adapte à l’appareil.</small><select id="sQ">${['auto', 'bas', 'moyen', 'haut'].map((q) => `<option value="${q}" ${S.quality === q ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}</option>`).join('')}</select></label>
        <label class="opt">Distance de vue<small>${S.viewDist} m</small><input type="range" id="sVD" min="100" max="420" step="20" value="${S.viewDist}"></label>
        <label class="opt">Champ de vision<small>${S.fov}°</small><input type="range" id="sFov" min="55" max="95" step="5" value="${S.fov}"></label>
        <label class="opt">Sensibilité de la vue<small>${fmt(S.sens, 1)}</small><input type="range" id="sSens" min="0.3" max="2.5" step="0.1" value="${S.sens}"></label>
        <label class="opt">Inverser l’axe vertical<input type="checkbox" id="sInv" ${S.invertY ? 'checked' : ''}></label>
        <label class="opt">Volume<small>${Math.round(S.volume * 100)} %</small><input type="range" id="sVol" min="0" max="1" step="0.05" value="${S.volume}"></label>
        <label class="opt">Musique<small>${Math.round(S.music * 100)} %</small><input type="range" id="sMus" min="0" max="1" step="0.05" value="${S.music}"></label>
        <label class="opt">Durée d’une journée<small>${S.dayMinutes} minutes réelles</small><input type="range" id="sDay" min="10" max="60" step="5" value="${S.dayMinutes}"></label>
        <label class="opt">Jours par saison<small>${S.seasonDays} jours</small><input type="range" id="sSea" min="3" max="12" step="1" value="${S.seasonDays}"></label>
        <label class="opt">Afficher les objectifs<input type="checkbox" id="sGoal" ${S.goals !== false ? 'checked' : ''}></label>
        <label class="opt">Sauvegarde automatique<small>Toutes les 2 minutes et au coucher</small><input type="checkbox" id="sAuto" ${S.autoSave ? 'checked' : ''}></label>
      </div><div class="mbtns"><button class="btn prim" id="mBack">Retour</button></div>`;
      const bind = (id, key, conv, after) => { $(id).oninput = $(id).onchange = (e) => { S[key] = conv(e.target); saveSettings(); if (after) after(); const sm = e.target.parentElement.querySelector('small'); if (sm && e.target.type === 'range') sm.textContent = this.settingLabel(key); }; };
      bind('#sQ', 'quality', (t) => t.value, () => G.applyQuality());
      bind('#sVD', 'viewDist', (t) => +t.value, () => G.applyQuality(true));
      bind('#sFov', 'fov', (t) => +t.value);
      bind('#sSens', 'sens', (t) => +t.value);
      bind('#sInv', 'invertY', (t) => t.checked);
      bind('#sVol', 'volume', (t) => +t.value, () => G.audio.setVolume());
      bind('#sMus', 'music', (t) => +t.value, () => G.audio.setVolume());
      bind('#sDay', 'dayMinutes', (t) => +t.value);
      bind('#sSea', 'seasonDays', (t) => +t.value);
      bind('#sGoal', 'goals', (t) => t.checked, () => $('#goal').classList.toggle('hidden', !S.goals));
      bind('#sAuto', 'autoSave', (t) => t.checked);
      $('#mBack').onclick = () => this.showMenu(data || 'pause');
    } else if (kind === 'help') {
      card.innerHTML = '<h2>Guide de survie</h2><div id="helpBody" style="text-align:left;max-height:58vh;overflow:auto"></div><div class="mbtns" style="margin-top:12px"><button class="btn prim" id="mBack">Retour</button></div>';
      this.renderHelp($('#helpBody'));
      $('#mBack').onclick = () => this.showMenu(data || 'pause');
    } else if (kind === 'death') {
      card.innerHTML = `<h2>Tu es mort${data.why ? ' ' + esc(data.why) : ''}</h2><p class="sub">${esc(DIFFICULTY[G.difficulty].drop ? 'Ton sac reste là où tu es tombé. Retrouve-le.' : 'Tu gardes tes affaires en mode paisible.')}</p>
        <div class="stats"><div><b>${G.time.day}</b><span>jours survécus</span></div><div><b>${G.stats.kills}</b><span>bêtes chassées</span></div><div><b>${G.stats.crafted}</b><span>objets fabriqués</span></div></div>
        <div class="mbtns"><button class="btn prim" id="mRespawn">Se réveiller ${G.player.spawn && G.buildings.bedExists(G.player.spawn) ? 'dans son lit' : 'au point de départ'}</button><button class="btn ghost" id="mTitle">Menu principal</button></div>`;
      $('#mRespawn').onclick = () => { G.survival.respawn(); this.hideMenu(); G.resume(); };
      $('#mTitle').onclick = () => G.quitToTitle();
    }
    const first = card.querySelector('.btn.prim, .btn');
    if (first && input.lastDevice === 'pad') first.focus();
  },
  settingLabel(k) {
    const S = G.settings;
    return { viewDist: S.viewDist + ' m', fov: S.fov + '°', sens: fmt(S.sens, 1), volume: Math.round(S.volume * 100) + ' %', music: Math.round(S.music * 100) + ' %', dayMinutes: S.dayMinutes + ' minutes réelles', seasonDays: S.seasonDays + ' jours' }[k] || '';
  },
  hideMenu() { $('#menu').classList.add('hidden'); this.menuKind = null; },
  death(o) { setTimeout(() => { input.unlock(); this.closeSheet(); G.paused = true; this.showMenu('death', o); }, 1600); },

  // navigation à la manette dans les menus et panneaux
  padNav() {
    const open = !$('#menu').classList.contains('hidden') ? $('#menuCard') : G.uiOpen ? $('#sheet') : null;
    if (!open) return;
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    for (const k in dirs) {
      if (!input.pressed[k]) continue;
      const els = $$('button:not(:disabled), .slot, select, input', open).filter((e) => e.offsetParent);
      const cur = document.activeElement && els.includes(document.activeElement) ? document.activeElement : null;
      if (!cur) { els[0] && els[0].focus(); continue; }
      const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let best = null, bs = 1e9;
      for (const e of els) {
        if (e === cur) continue;
        const q = e.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
        const along = dx * dirs[k][0] + dy * dirs[k][1]; if (along <= 4) continue;
        const side = Math.abs(dx * dirs[k][1]) + Math.abs(dy * dirs[k][0]);
        const s = along + side * 2.5; if (s < bs) { bs = s; best = e; }
      }
      if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); }
    }
    if (input.pressed.jump && document.activeElement && open.contains(document.activeElement)) document.activeElement.click();
  },
};
