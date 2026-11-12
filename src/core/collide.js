// Collisions simples au sol : cercles (troncs, rochers, bêtes) et boîtes (murs), dans une grille spatiale.
const CS = 8;
const grid = new Map();
let nextId = 1;
const all = new Map();

function key(i, j) { return i * 73856093 ^ j * 19349663; }
function cellsFor(c, fn) {
  const r = c.kind === 'circle' ? c.r : Math.max(c.hw, c.hd);
  const i0 = Math.floor((c.x - r) / CS), i1 = Math.floor((c.x + r) / CS);
  const j0 = Math.floor((c.z - r) / CS), j1 = Math.floor((c.z + r) / CS);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) fn(key(i, j));
}

export function addCircle(x, z, r, data = null, h = 99) {
  const c = { id: nextId++, kind: 'circle', x, z, r, data, y0: -99, y1: h };
  all.set(c.id, c);
  cellsFor(c, (k) => { let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(c); });
  return c.id;
}
// boîte orientée sur les axes (rotations par quarts de tour)
export function addBox(x, z, hw, hd, data = null, y0 = -99, y1 = 99) {
  const c = { id: nextId++, kind: 'box', x, z, hw, hd, data, y0, y1 };
  all.set(c.id, c);
  cellsFor(c, (k) => { let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(c); });
  return c.id;
}
export function remove(id) {
  const c = all.get(id); if (!c) return;
  all.delete(id);
  cellsFor(c, (k) => { const a = grid.get(k); if (!a) return; const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); });
}
export function clearAll() { grid.clear(); all.clear(); }

export function query(x, z, r, fn) {
  const i0 = Math.floor((x - r) / CS), i1 = Math.floor((x + r) / CS);
  const j0 = Math.floor((z - r) / CS), j1 = Math.floor((z + r) / CS);
  const seen = new Set();
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const a = grid.get(key(i, j)); if (!a) continue;
    for (const c of a) { if (seen.has(c.id)) continue; seen.add(c.id); fn(c); }
  }
}

// pousse un cercle mobile (x,z,r) hors des obstacles ; y = pieds du mobile
export function resolve(pos, r, y = 0, height = 1.7, ignore = null) {
  let hit = false;
  query(pos.x, pos.z, r + 3, (c) => {
    if (c.data && c.data === ignore) return;
    if (y + height < c.y0 || y > c.y1) return;
    if (c.kind === 'circle') {
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
      if (d < m && d > 1e-5) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; hit = true; }
    } else {
      const cx = Math.max(c.x - c.hw, Math.min(pos.x, c.x + c.hw));
      const cz = Math.max(c.z - c.hd, Math.min(pos.z, c.z + c.hd));
      const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-5) { pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
        else { // centre dans la boîte : sortir par le côté le plus proche
          const ox = c.hw - Math.abs(pos.x - c.x), oz = c.hd - Math.abs(pos.z - c.z);
          if (ox < oz) pos.x = c.x + Math.sign(pos.x - c.x || 1) * (c.hw + r); else pos.z = c.z + Math.sign(pos.z - c.z || 1) * (c.hd + r);
        }
        hit = true;
      }
    }
  });
  return hit;
}

// surfaces sur lesquelles on peut marcher (planchers)
const floors = new Map();
export function addFloor(x, z, hw, hd, y, data = null) { const id = nextId++; floors.set(id, { x, z, hw, hd, y, data }); return id; }
export function removeFloor(id) { floors.delete(id); }
export function floorAt(x, z, maxY) {
  let best = -Infinity;
  for (const f of floors.values()) {
    if (Math.abs(x - f.x) <= f.hw && Math.abs(z - f.z) <= f.hd && f.y <= maxY && f.y > best) best = f.y;
  }
  return best;
}
export function clearFloors() { floors.clear(); }

// segment bloqué ? (ligne de tir des flèches, ligne de vue)
export function segmentBlocked(ax, az, bx, bz, y) {
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5);
  const p = { x: 0, z: 0 };
  for (let s = 1; s < steps; s++) {
    const t = s / steps; p.x = ax + (bx - ax) * t; p.z = az + (bz - az) * t;
    let blocked = false;
    query(p.x, p.z, 1, (c) => {
      if (blocked || y < c.y0 || y > c.y1) return;
      if (c.kind === 'circle') { if (Math.hypot(p.x - c.x, p.z - c.z) < c.r) blocked = c; }
      else if (Math.abs(p.x - c.x) < c.hw && Math.abs(p.z - c.z) < c.hd) blocked = c;
    });
    if (blocked) return blocked;
  }
  return null;
}
