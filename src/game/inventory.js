import { ITEMS } from './items.js';
import { emit } from '../core/state.js';

// Un conteneur d'objets (sac du joueur, coffre, sac tombé). Chaque case : { id, n, d (durabilité), a (âge en heures) }
export class Inventory {
  constructor(size, name = 'inv') { this.size = size; this.name = name; this.slots = new Array(size).fill(null); }

  static stackOf(id) { return (ITEMS[id] && ITEMS[id].stack) || 1; }

  count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c; }
  has(cost) { for (const k in cost) if (this.count(k) < cost[k]) return false; return true; }
  free() { return this.slots.filter((s) => !s).length; }

  // ajoute ; renvoie ce qui n'a pas pu entrer
  add(id, n = 1, opt = {}) {
    const it = ITEMS[id]; if (!it || n <= 0) return n;
    const max = it.stack || 1, age = opt.a || 0;
    if (max > 1) {
      for (const s of this.slots) {
        if (!s || s.id !== id || s.n >= max) continue;
        if (it.durTime && s.d !== undefined && opt.d !== undefined && s.d !== it.dur) continue;
        const k = Math.min(n, max - s.n);
        if (it.perish) s.a = (s.a * s.n + age * k) / (s.n + k);
        s.n += k; n -= k;
        if (!n) break;
      }
    }
    for (let i = 0; i < this.size && n > 0; i++) {
      if (this.slots[i]) continue;
      const k = Math.min(n, max);
      const s = { id, n: k };
      if (it.dur) s.d = opt.d !== undefined ? opt.d : it.dur;
      if (it.perish) s.a = age;
      this.slots[i] = s; n -= k;
    }
    emit('inv', this);
    return n;
  }

  remove(id, n = 1) {
    // retire d'abord les plus abîmés / les plus vieux
    const idx = [];
    this.slots.forEach((s, i) => { if (s && s.id === id) idx.push(i); });
    idx.sort((a, b) => ((this.slots[b].a || 0) - (this.slots[a].a || 0)) || ((this.slots[a].d || 0) - (this.slots[b].d || 0)));
    for (const i of idx) {
      const s = this.slots[i]; const k = Math.min(n, s.n);
      s.n -= k; n -= k; if (s.n <= 0) this.slots[i] = null;
      if (!n) break;
    }
    emit('inv', this);
    return n === 0;
  }
  pay(cost) { if (!this.has(cost)) return false; for (const k in cost) this.remove(k, cost[k]); return true; }

  takeSlot(i, n) {
    const s = this.slots[i]; if (!s) return null;
    n = Math.min(n ?? s.n, s.n);
    const out = { ...s, n };
    s.n -= n; if (s.n <= 0) this.slots[i] = null;
    emit('inv', this);
    return out;
  }
  putStack(st) {
    const left = this.add(st.id, st.n, { d: st.d, a: st.a || 0 });
    return left;
  }

  // durabilité : renvoie true si l'objet casse
  wear(i, amount = 1) {
    const s = this.slots[i]; if (!s || s.d === undefined) return false;
    s.d -= amount;
    if (s.d <= 0) {
      if (s.n > 1) { s.n -= 1; s.d = ITEMS[s.id].dur; emit('inv', this); return true; }
      this.slots[i] = null; emit('inv', this); return true;
    }
    return false;
  }

  // vieillissement de la nourriture ; factor < 1 au froid
  spoil(hours, factor = 1) {
    let changed = false;
    for (let i = 0; i < this.size; i++) {
      const s = this.slots[i]; if (!s) continue;
      const it = ITEMS[s.id]; if (!it.perish) continue;
      s.a = (s.a || 0) + hours * factor;
      if (s.a >= it.perish) {
        const n = s.n; this.slots[i] = null; this.add('pourri', n); changed = true;
      }
    }
    if (changed) emit('inv', this);
    return changed;
  }

  sort(from = 0) {
    const order = ['outil', 'arme', 'munition', 'lumiere', 'soin', 'eau', 'nourriture', 'graine', 'ressource', 'vetement', 'plan', 'tresor'];
    const rest = this.slots.slice(from).filter(Boolean);
    // regroupe les piles incomplètes
    const merged = [];
    for (const s of rest) {
      const max = Inventory.stackOf(s.id);
      const m = merged.find((q) => q.id === s.id && q.n < max && s.d === undefined && q.d === undefined);
      if (m) { const k = Math.min(max - m.n, s.n); if (ITEMS[s.id].perish) m.a = (m.a * m.n + s.a * k) / (m.n + k); m.n += k; s.n -= k; if (s.n > 0) merged.push(s); }
      else merged.push(s);
    }
    merged.sort((a, b) => (order.indexOf(ITEMS[a.id].cat) - order.indexOf(ITEMS[b.id].cat)) || a.id.localeCompare(b.id));
    for (let i = from; i < this.size; i++) this.slots[i] = merged[i - from] || null;
    emit('inv', this);
  }

  toJSON() { return this.slots; }
  load(arr) { this.slots = new Array(this.size).fill(null); (arr || []).forEach((s, i) => { if (i < this.size && s && ITEMS[s.id]) this.slots[i] = s; }); }
}

export function freshness(s) {
  const it = ITEMS[s.id]; if (!it.perish) return 1;
  return Math.max(0, 1 - (s.a || 0) / it.perish);
}
