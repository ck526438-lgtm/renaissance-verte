import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/rng.js';

// Modèles low-poly fabriqués en code (aucun fichier externe) : arbres, rochers, bâtiments, objets en main, bêtes.

export const MAT = {
  vc: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  foliage: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  pine: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffb347 }),
  ghostOk: new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.45, depthWrite: false }),
  ghostBad: new THREE.MeshBasicMaterial({ color: 0xff5544, transparent: true, opacity: 0.45, depthWrite: false }),
};
const matCache = {};
export function colMat(hex) {
  return matCache[hex] || (matCache[hex] = new THREE.MeshLambertMaterial({ color: hex, flatShading: true }));
}

const _c = new THREE.Color();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

// part(géométrie, couleur, position, rotation, échelle)
export function part(geo, color, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], jitter = 0, seed = 1) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  if (jitter) {
    const rnd = mulberry32(seed);
    const pos = g.attributes.position;
    const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    const off = {};
    for (let i = 0; i < pos.count; i++) {
      const k = key(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (!off[k]) off[k] = [(rnd() - 0.5) * jitter, (rnd() - 0.5) * jitter, (rnd() - 0.5) * jitter];
      pos.setXYZ(i, pos.getX(i) + off[k][0], pos.getY(i) + off[k][1], pos.getZ(i) + off[k][2]);
    }
  }
  _m.compose(_p.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...s));
  g.applyMatrix4(_m);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const cols = Array.isArray(color) ? color : [color];
  for (let i = 0; i < n; i++) {
    _c.set(cols[Math.floor(i / 3) % cols.length]);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
export function merge(parts) {
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const dode = (r) => new THREE.DodecahedronGeometry(r, 0);

// ---------- végétation ----------
export function oakTrunk(v = 0) {
  return merge([
    part(cyl(0.22, 0.34, 3.4, 6), '#6b4a2f', [0, 1.7, 0]),
    part(cyl(0.09, 0.14, 1.4, 5), '#6b4a2f', [0.45, 2.9, 0], [0, 0, -0.8]),
    part(cyl(0.08, 0.12, 1.2, 5), '#5e4128', [-0.35, 3.1, 0.2], [0.3, 0, 0.7]),
  ]);
}
export function oakCanopy(v = 0) {
  const s = 11 + v * 7;
  const g = ['#7fbf4f', '#6aad42', '#8acb5a', '#5f9e3b'];
  return merge([
    part(ico(1.7, 0), g, [0, 4.4, 0], [0, 0, 0], [1, 0.85, 1], 0.5, s),
    part(ico(1.25, 0), g, [1.1, 3.9, 0.4], [0, 1, 0], [1, 0.8, 1], 0.4, s + 1),
    part(ico(1.2, 0), g, [-0.9, 4.0, -0.6], [0, 2, 0], [1, 0.8, 1], 0.4, s + 2),
    part(ico(1.1, 0), g, [0.1, 5.3, 0.3], [0, 0.5, 0], [1, 0.8, 1], 0.4, s + 3),
  ]);
}
export function pineTrunk() { return merge([part(cyl(0.16, 0.3, 3.0, 6), '#5a3d26', [0, 1.5, 0])]); }
export function pineCanopy(v = 0) {
  const g = ['#2f6b45', '#3a7a50', '#28603e'];
  return merge([
    part(cone(2.1, 2.6, 7), g, [0, 2.6, 0], [0, 0, 0], [1, 1, 1], 0.25, 31 + v),
    part(cone(1.65, 2.3, 7), g, [0, 3.9, 0], [0, 0.4, 0], [1, 1, 1], 0.2, 32 + v),
    part(cone(1.15, 2.0, 7), g, [0, 5.1, 0], [0, 0.8, 0], [1, 1, 1], 0.15, 33 + v),
    part(cone(0.6, 1.4, 6), g, [0, 6.1, 0]),
  ]);
}
export function stump() {
  return merge([part(cyl(0.3, 0.36, 0.55, 7), '#6b4a2f', [0, 0.27, 0]), part(cyl(0.3, 0.3, 0.02, 7), '#c8a273', [0, 0.56, 0])]);
}
export function burntTrunk() {
  return merge([part(cyl(0.18, 0.3, 3.0, 6), '#2a2420', [0, 1.5, 0]), part(cyl(0.06, 0.1, 1.2, 5), '#1f1a17', [0.35, 2.6, 0], [0, 0, -0.8])]);
}
export function rock(v = 0) {
  const g = ['#8a857a', '#7b766b', '#969186'];
  return merge([
    part(dode(1.0), g, [0, 0.45, 0], [0, v, 0], [1.3, 0.8, 1.1], 0.35, 50 + v * 3),
    part(dode(0.6), g, [0.8, 0.25, 0.3], [0, v * 2, 0], [1, 0.8, 1], 0.25, 51 + v * 3),
  ]);
}
export function oreRock(v = 0) {
  return merge([
    part(dode(1.0), ['#6e675f', '#5f5952', '#7a7268'], [0, 0.5, 0], [0, v, 0], [1.2, 0.85, 1.1], 0.35, 60 + v),
    part(ico(0.22, 0), '#c06a32', [0.55, 0.85, 0.3]), part(ico(0.18, 0), '#d47a3a', [-0.4, 0.7, 0.55]),
    part(ico(0.2, 0), '#b8622c', [0.1, 1.05, -0.45]),
  ]);
}
export function pebble() { return merge([part(dode(0.22), ['#9a958a', '#8a857a'], [0, 0.1, 0], [0, 0, 0], [1.2, 0.7, 1], 0.08, 7)]); }
export function stick() {
  return merge([part(cyl(0.04, 0.05, 1.1, 5), '#7a5532', [0, 0.05, 0], [0, 0, Math.PI / 2]), part(cyl(0.025, 0.03, 0.4, 4), '#7a5532', [0.2, 0.08, 0.12], [0.6, 0, Math.PI / 2])]);
}
export function bush(v = 0) {
  const g = ['#4f8f3a', '#5a9c42', '#447f33'];
  return merge([
    part(ico(0.75, 0), g, [0, 0.55, 0], [0, 0, 0], [1.2, 0.85, 1.2], 0.3, 70 + v),
    part(ico(0.55, 0), g, [0.55, 0.45, 0.2], [0, 1, 0], [1, 0.9, 1], 0.2, 71 + v),
    part(ico(0.5, 0), g, [-0.45, 0.42, -0.3], [0, 2, 0], [1, 0.9, 1], 0.2, 72 + v),
  ]);
}
export function berries(color = '#d8344a') {
  const parts = [];
  const r = mulberry32(9);
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, h = 0.3 + r() * 0.6, d = 0.55 + r() * 0.45;
    parts.push(part(ico(0.075, 0), color, [Math.cos(a) * d, h, Math.sin(a) * d]));
  }
  return merge(parts);
}
export function grassClump() {
  const parts = [];
  const r = mulberry32(13);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = r() * 0.35;
    parts.push(part(cone(0.06, 0.8 + r() * 0.5, 3), ['#9ac25a', '#86b04c'], [Math.cos(a) * d, 0.4, Math.sin(a) * d], [r() * 0.4 - 0.2, 0, r() * 0.4 - 0.2]));
  }
  parts.push(part(cyl(0.012, 0.012, 1.0, 3), '#d9c06a', [0.1, 0.55, 0.05], [0.1, 0, 0.1]));
  parts.push(part(cone(0.04, 0.22, 4), '#e2c770', [0.15, 1.1, 0.1]));
  return merge(parts);
}
export function herbPlant() {
  const parts = [part(cyl(0.02, 0.025, 0.5, 4), '#5a8a3a', [0, 0.25, 0])];
  const r = mulberry32(17);
  for (let i = 0; i < 6; i++) { const a = i; parts.push(part(box(0.06, 0.02, 0.22), '#6fa04a', [Math.cos(a) * 0.12, 0.12 + i * 0.05, Math.sin(a) * 0.12], [0, a, 0.4])); }
  for (let i = 0; i < 5; i++) parts.push(part(ico(0.06, 0), '#f4f1e0', [(r() - 0.5) * 0.2, 0.52 + r() * 0.08, (r() - 0.5) * 0.2]));
  return merge(parts);
}
export function carrotPlant() {
  const parts = [part(cone(0.07, 0.18, 5), '#e07a2a', [0, 0.05, 0], [Math.PI, 0, 0])];
  for (let i = 0; i < 6; i++) parts.push(part(cone(0.04, 0.45, 3), '#5f9e3b', [Math.cos(i) * 0.06, 0.3, Math.sin(i) * 0.06], [Math.cos(i) * 0.3, 0, Math.sin(i) * 0.3]));
  return merge(parts);
}
export function mushroom(red = false) {
  return merge([
    part(cyl(0.05, 0.07, 0.25, 6), '#efe6d2', [0, 0.12, 0]),
    part(new THREE.SphereGeometry(0.17, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), red ? '#c8322a' : '#8a5a32', [0, 0.23, 0]),
    ...(red ? [part(ico(0.025, 0), '#fff', [0.08, 0.36, 0]), part(ico(0.025, 0), '#fff', [-0.05, 0.37, 0.07])] : []),
    part(cyl(0.035, 0.05, 0.16, 5), '#efe6d2', [0.18, 0.08, 0.05]),
    part(new THREE.SphereGeometry(0.1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), red ? '#c8322a' : '#8a5a32', [0.18, 0.15, 0.05]),
  ]);
}
export function grassTuft() {
  return merge([
    part(cone(0.05, 0.5, 3), '#ffffff', [0, 0.25, 0], [0.1, 0, 0.05]),
    part(cone(0.05, 0.42, 3), '#ffffff', [0.08, 0.21, 0.04], [0, 0, 0.25]),
    part(cone(0.05, 0.38, 3), '#ffffff', [-0.07, 0.19, -0.03], [-0.2, 0, -0.2]),
  ]);
}

// ---------- bâtiments ----------
const WOOD = ['#9a6b42', '#8a5d38', '#a87648'], WOOD_D = '#6b4a2f', STONE = ['#8f8a80', '#7e796f', '#9b968c'];
export const BUILD_MODELS = {
  feu: () => {
    const p = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; p.push(part(dode(0.17), STONE, [Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6], [0, a, 0], [1, 0.7, 1], 0.05, i)); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; p.push(part(cyl(0.06, 0.07, 0.9, 5), WOOD_D, [Math.cos(a) * 0.15, 0.25, Math.sin(a) * 0.15], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9])); }
    p.push(part(cyl(0.35, 0.4, 0.05, 8), '#2a2420', [0, 0.03, 0]));
    return merge(p);
  },
  etabli: () => merge([
    part(box(1.8, 0.12, 0.9), WOOD, [0, 0.9, 0]),
    part(box(0.12, 0.9, 0.12), WOOD_D, [-0.8, 0.45, -0.35]), part(box(0.12, 0.9, 0.12), WOOD_D, [0.8, 0.45, -0.35]),
    part(box(0.12, 0.9, 0.12), WOOD_D, [-0.8, 0.45, 0.35]), part(box(0.12, 0.9, 0.12), WOOD_D, [0.8, 0.45, 0.35]),
    part(box(1.6, 0.08, 0.7), WOOD_D, [0, 0.3, 0]),
    part(box(0.5, 0.06, 0.08), '#8a8f96', [0.3, 0.99, 0.1], [0, 0.4, 0]), part(cyl(0.03, 0.03, 0.4, 5), WOOD_D, [-0.4, 1.0, 0.15], [0, 0, Math.PI / 2]),
    part(box(0.16, 0.12, 0.08), '#6e7378', [-0.6, 1.02, 0.15]),
  ]),
  forge: () => merge([
    part(box(1.6, 1.1, 1.3), STONE, [0, 0.55, 0], [0, 0, 0], [1, 1, 1], 0.08, 3),
    part(box(0.7, 0.45, 0.2), '#1d1a18', [0, 0.55, 0.62]),
    part(box(0.6, 1.6, 0.6), STONE, [0.35, 1.9, -0.25], [0, 0, 0], [1, 1, 1], 0.06, 4),
    part(box(0.9, 0.35, 0.5), '#4a4d52', [-0.9, 0.85, 0.3]), part(box(0.25, 0.5, 0.25), '#3a3d42', [-0.9, 0.45, 0.3]),
  ]),
  sechoir: () => merge([
    part(box(0.1, 1.8, 0.1), WOOD_D, [-1, 0.9, 0]), part(box(0.1, 1.8, 0.1), WOOD_D, [1, 0.9, 0]),
    part(box(2.2, 0.08, 0.08), WOOD, [0, 1.7, 0]), part(box(2.2, 0.06, 0.06), WOOD, [0, 1.2, 0]),
    part(box(0.25, 0.5, 0.06), '#a8463c', [-0.5, 1.35, 0]), part(box(0.22, 0.45, 0.06), '#9c4036', [0.1, 1.38, 0]),
    part(box(0.25, 0.4, 0.06), '#b05a44', [0.6, 1.4, 0]),
    part(cone(0.5, 0.4, 7), STONE, [0, 0.2, 0.6]),
  ]),
  parcelle: () => merge([
    part(box(2.6, 0.25, 2.6), '#5a3f2a', [0, 0.12, 0]),
    part(box(2.8, 0.3, 0.12), WOOD_D, [0, 0.15, 1.35]), part(box(2.8, 0.3, 0.12), WOOD_D, [0, 0.15, -1.35]),
    part(box(0.12, 0.3, 2.6), WOOD_D, [1.35, 0.15, 0]), part(box(0.12, 0.3, 2.6), WOOD_D, [-1.35, 0.15, 0]),
    ...[-0.8, 0, 0.8].map((x) => part(box(0.3, 0.06, 2.4), '#4a3322', [x, 0.26, 0])),
  ]),
  coffre: () => merge([
    part(box(1.2, 0.6, 0.75), WOOD, [0, 0.3, 0]), part(box(1.24, 0.25, 0.79), WOOD_D, [0, 0.72, 0]),
    part(box(1.26, 0.08, 0.1), '#5b5f66', [0, 0.45, 0.36]), part(box(0.14, 0.18, 0.06), '#c9a24a', [0, 0.6, 0.41]),
  ]),
  lit: () => merge([
    part(box(1.2, 0.35, 2.2), WOOD_D, [0, 0.18, 0]), part(box(1.1, 0.14, 2.0), '#c9b79a', [0, 0.42, 0.05]),
    part(box(1.12, 0.1, 1.3), '#7a4a3a', [0, 0.52, 0.35]), part(box(0.7, 0.14, 0.4), '#eee4cf', [0, 0.54, -0.72]),
    part(box(1.2, 0.8, 0.12), WOOD_D, [0, 0.4, -1.1]),
  ]),
  mur: () => {
    const p = [];
    for (let i = 0; i < 6; i++) p.push(part(cyl(0.22, 0.22, 3.0, 7), WOOD[i % 3], [0, 0.22 + i * 0.43, 0], [0, 0, Math.PI / 2]));
    p.push(part(box(0.2, 2.7, 0.5), WOOD_D, [-1.45, 1.3, 0]), part(box(0.2, 2.7, 0.5), WOOD_D, [1.45, 1.3, 0]));
    return merge(p);
  },
  porte: () => merge([
    part(box(0.25, 2.7, 0.5), WOOD_D, [-1.38, 1.35, 0]), part(box(0.25, 2.7, 0.5), WOOD_D, [1.38, 1.35, 0]),
    part(box(3.0, 0.4, 0.45), WOOD, [0, 2.5, 0]),
  ]),
  sol: () => {
    const p = [];
    for (let i = 0; i < 6; i++) p.push(part(box(0.48, 0.12, 3.0), WOOD[i % 3], [-1.25 + i * 0.5, 0, 0]));
    p.push(part(box(3, 0.1, 0.15), WOOD_D, [0, -0.1, 1.3]), part(box(3, 0.1, 0.15), WOOD_D, [0, -0.1, -1.3]));
    return merge(p);
  },
  toit: () => {
    const p = [];
    const th = ['#c9a44a', '#b8933e', '#d6b45a'];
    p.push(part(box(3.4, 0.18, 1.8), th, [0, 0.45, -0.8], [0.5, 0, 0]));
    p.push(part(box(3.4, 0.18, 1.8), th, [0, 0.45, 0.8], [-0.5, 0, 0]));
    p.push(part(box(0.12, 0.9, 0.12), WOOD_D, [-1.4, -0.2, 0]), part(box(0.12, 0.9, 0.12), WOOD_D, [1.4, -0.2, 0]));
    p.push(part(cyl(0.08, 0.08, 3.4, 6), WOOD_D, [0, 0.85, 0], [0, 0, Math.PI / 2]));
    return merge(p);
  },
  pieux: () => {
    const p = [];
    for (let i = 0; i < 5; i++) p.push(part(cone(0.16, 1.8, 6), WOOD[i % 3], [-1.2 + i * 0.6, 0.75, 0.1 * (i % 2)], [0.5 * (i % 2 ? 1 : -1) * 0.3 + 0.4, 0, 0]));
    p.push(part(box(3, 0.15, 0.15), WOOD_D, [0, 0.4, -0.2]));
    return merge(p);
  },
  torche: () => merge([part(cyl(0.05, 0.07, 1.6, 6), WOOD_D, [0, 0.8, 0]), part(cyl(0.11, 0.08, 0.25, 6), '#3a2a1c', [0, 1.65, 0])]),
  collecteur: () => merge([
    part(cyl(0.45, 0.42, 0.9, 10), WOOD, [0, 0.45, 0]), part(cyl(0.47, 0.47, 0.06, 10), '#5b5f66', [0, 0.2, 0]),
    part(cyl(0.47, 0.47, 0.06, 10), '#5b5f66', [0, 0.75, 0]), part(cyl(0.9, 0.12, 0.45, 10), '#c8c2a8', [0, 1.15, 0]),
    part(box(0.08, 1.4, 0.08), WOOD_D, [0.75, 0.7, 0]), part(box(0.08, 1.4, 0.08), WOOD_D, [-0.75, 0.7, 0]),
  ]),
  poulailler: () => merge([
    part(box(1.8, 1.0, 1.4), WOOD, [0, 0.8, 0]), part(box(0.1, 0.3, 0.1), WOOD_D, [-0.8, 0.15, 0.6]), part(box(0.1, 0.3, 0.1), WOOD_D, [0.8, 0.15, 0.6]),
    part(box(0.1, 0.3, 0.1), WOOD_D, [-0.8, 0.15, -0.6]), part(box(0.1, 0.3, 0.1), WOOD_D, [0.8, 0.15, -0.6]),
    part(box(2.0, 0.12, 0.9), '#b8933e', [0, 1.45, -0.35], [0.45, 0, 0]), part(box(2.0, 0.12, 0.9), '#b8933e', [0, 1.45, 0.35], [-0.45, 0, 0]),
    part(box(0.4, 0.45, 0.05), '#2a2018', [0.3, 0.75, 0.71]), part(box(0.1, 0.08, 0.6), WOOD_D, [0.3, 0.4, 1.0], [0.6, 0, 0]),
  ]),
  cloture: () => merge([
    part(box(0.12, 1.1, 0.12), WOOD_D, [-1.45, 0.55, 0]), part(box(0.12, 1.1, 0.12), WOOD_D, [1.45, 0.55, 0]), part(box(0.12, 1.1, 0.12), WOOD_D, [0, 0.55, 0]),
    part(box(3.0, 0.1, 0.06), WOOD, [0, 0.85, 0]), part(box(3.0, 0.1, 0.06), WOOD, [0, 0.45, 0]),
  ]),
  epouvantail: () => merge([
    part(box(0.08, 2.0, 0.08), WOOD_D, [0, 1.0, 0]), part(box(1.3, 0.07, 0.07), WOOD_D, [0, 1.5, 0]),
    part(box(0.6, 0.7, 0.3), '#7a5a8a', [0, 1.35, 0]), part(ico(0.22, 0), '#d6c48a', [0, 1.95, 0]), part(cone(0.35, 0.3, 7), '#b8933e', [0, 2.15, 0]),
  ]),
};

// cultures : 3 stades de croissance (+ fané)
export function cropModel(kind, stage) {
  const parts = [];
  const r = mulberry32(kind.length * 7 + stage);
  for (let i = 0; i < 9; i++) {
    const x = -0.85 + (i % 3) * 0.85 + (r() - 0.5) * 0.2, z = -0.85 + Math.floor(i / 3) * 0.85 + (r() - 0.5) * 0.2;
    if (stage === 0) { parts.push(part(cone(0.05, 0.18, 3), '#7cbf4a', [x, 0.34, z])); continue; }
    if (stage === 3) { parts.push(part(cone(0.06, 0.3, 3), '#8a7a4a', [x, 0.36, z], [0.5, 0, 0.3])); continue; }
    if (kind === 'ble') {
      const h = stage === 1 ? 0.45 : 0.85;
      for (let k = 0; k < 4; k++) parts.push(part(cyl(0.015, 0.02, h, 3), stage === 2 ? '#d8b850' : '#7cbf4a', [x + (k - 1.5) * 0.06, 0.25 + h / 2, z + (k % 2) * 0.05]));
      if (stage === 2) for (let k = 0; k < 4; k++) parts.push(part(cone(0.035, 0.18, 4), '#e6c662', [x + (k - 1.5) * 0.06, 0.25 + h + 0.06, z + (k % 2) * 0.05]));
    } else if (kind === 'carotte') {
      for (let k = 0; k < 5; k++) parts.push(part(cone(0.04, stage === 1 ? 0.25 : 0.45, 3), '#5f9e3b', [x + Math.cos(k) * 0.05, 0.4, z + Math.sin(k) * 0.05], [Math.cos(k) * 0.3, 0, Math.sin(k) * 0.3]));
      if (stage === 2) parts.push(part(cone(0.07, 0.12, 5), '#e07a2a', [x, 0.3, z], [Math.PI, 0, 0]));
    } else { // courge
      parts.push(part(cone(0.18, 0.12, 5), '#4f8f3a', [x, 0.32, z]));
      if (stage === 2) parts.push(part(new THREE.SphereGeometry(0.2, 7, 5), '#e08a2a', [x, 0.4, z], [0, 0, 0], [1.2, 0.85, 1]));
    }
  }
  return merge(parts);
}

// ---------- lieux du monde d'avant ----------
export const POI_MODELS = {
  ruine: (v = 0) => {
    const p = [];
    const r = mulberry32(100 + v);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, d = 4.5;
      const h = 0.6 + r() * 2.6;
      p.push(part(box(2.4, h, 0.6), STONE, [Math.cos(a) * d, h / 2, Math.sin(a) * d], [0, -a + Math.PI / 2, 0], [1, 1, 1], 0.12, i + v));
    }
    p.push(part(cyl(0.45, 0.5, 3.2, 7), STONE, [0, 1.6, 0]), part(box(1.4, 0.5, 1.4), STONE, [1.8, 0.25, 1.2], [0, 0.4, 0.2]));
    p.push(part(box(1.6, 0.5, 0.5), '#6aa04a', [-1.6, 0.25, -1.4], [0, 0.6, 0]));
    return merge(p);
  },
  cabane: () => merge([
    ...[0, 1, 2, 3, 4].map((i) => part(cyl(0.2, 0.2, 4.4, 6), WOOD[i % 3], [0, 0.2 + i * 0.4, -1.8], [0, 0, Math.PI / 2])),
    ...[0, 1, 2, 3, 4].map((i) => part(cyl(0.2, 0.2, 3.6, 6), WOOD[(i + 1) % 3], [-2.1, 0.2 + i * 0.4, 0], [Math.PI / 2, 0, 0])),
    ...[0, 1, 2, 3, 4].map((i) => part(cyl(0.2, 0.2, 3.6, 6), WOOD[(i + 2) % 3], [2.1, 0.2 + i * 0.4, 0], [Math.PI / 2, 0, 0])),
    ...[3, 4].map((i) => part(cyl(0.2, 0.2, 4.4, 6), WOOD[i % 3], [0, 0.2 + i * 0.4, 1.8], [0, 0, Math.PI / 2])),
    part(box(1.4, 1.1, 0.4), WOOD, [-1.4, 0.55, 1.8]), part(box(1.4, 1.1, 0.4), WOOD, [1.4, 0.55, 1.8]),
    part(box(5, 0.2, 2.6), '#5a4a3a', [0, 2.65, -1.0], [0.55, 0, 0]), part(box(5, 0.2, 2.6), '#5a4a3a', [0, 2.65, 1.0], [-0.55, 0, 0]),
    part(box(0.6, 1.4, 0.6), STONE, [1.5, 2.9, -0.8]),
  ]),
  bunker: () => merge([
    part(box(7, 2.6, 6), ['#8d8d86', '#83837c', '#959590'], [0, 1.0, 0], [0, 0, 0], [1, 1, 1], 0.05, 9),
    part(box(7.4, 0.5, 6.4), '#6a7a4a', [0, 2.45, 0], [0, 0, 0], [1, 1, 1], 0.3, 10),
    part(box(1.6, 2.1, 0.3), '#4e5a4a', [0, 1.05, 3.05]), part(box(0.15, 0.15, 0.1), '#c9a24a', [0.6, 1.0, 3.22]),
    part(box(2.4, 0.2, 0.2), '#d6b440', [0, 2.25, 3.08]), part(box(0.8, 0.8, 0.8), '#6e6e68', [2.4, 2.9, -1.6]),
    part(box(0.9, 0.12, 0.9), '#3d3d3a', [2.4, 3.35, -1.6]),
    part(ico(1.2, 0), '#5a8a3a', [-3.3, 0.4, 2.5], [0, 0, 0], [1, 0.5, 1]),
  ]),
  caisse: () => merge([
    part(box(0.9, 0.6, 0.6), '#7a6a44', [0, 0.3, 0]), part(box(0.94, 0.08, 0.64), '#5b5f66', [0, 0.45, 0]),
    part(box(0.94, 0.08, 0.64), '#5b5f66', [0, 0.12, 0]), part(box(0.3, 0.2, 0.02), '#e6dcc0', [0, 0.32, 0.31]),
  ]),
  tanniere: () => merge([
    part(dode(4), ['#6e6a62', '#625e57', '#7a756c'], [0, 1.5, -1], [0, 0, 0], [1.6, 0.9, 1.2], 1.2, 21),
    part(dode(2.4), ['#6e6a62', '#625e57'], [3.6, 1.0, 0.5], [0, 1, 0], [1, 0.8, 1], 0.8, 22),
    part(dode(2.2), ['#6e6a62', '#625e57'], [-3.6, 1.0, 0.8], [0, 2, 0], [1, 0.8, 1], 0.8, 23),
    part(box(2.6, 2.0, 2.0), '#0e0c0b', [0, 1.0, 2.2]),
    part(ico(0.3, 0), '#e8e2d2', [1.6, 0.15, 3.6], [0, 0, 0], [2, 0.4, 0.6]), part(ico(0.25, 0), '#e8e2d2', [-1.2, 0.1, 3.9], [0, 1, 0], [2, 0.4, 0.6]),
  ]),
  epave: () => merge([
    part(box(4.6, 1.1, 2.0), ['#7a4a3a', '#6e4234'], [0, 0.55, 0], [0, 0, 0.12], [1, 1, 1], 0.1, 31),
    part(box(1.8, 0.9, 1.8), '#5d6a72', [-0.7, 1.4, 0], [0, 0, 0.12]),
    part(box(0.6, 0.6, 1.9), '#2a2a2a', [1.7, 0.35, 0]),
    part(cyl(0.38, 0.38, 0.25, 10), '#1d1d1d', [1.2, 0.3, 1.05], [Math.PI / 2, 0, 0]),
    part(cyl(0.38, 0.38, 0.25, 10), '#1d1d1d', [-1.4, 0.3, 1.05], [Math.PI / 2, 0, 0]),
    part(ico(0.6, 0), '#5a8a3a', [0.3, 1.1, 0.4], [0, 0, 0], [1.6, 0.6, 1]),
  ]),
};

// ---------- objets tenus en main ----------
export const HELD = {
  hache_pierre: () => merge([part(cyl(0.03, 0.035, 0.7, 5), WOOD_D, [0, 0.35, 0]), part(box(0.22, 0.12, 0.06), '#7e796f', [0.08, 0.62, 0], [0, 0, 0], [1, 1, 1], 0.04, 1), part(box(0.06, 0.08, 0.07), '#c9b07a', [0, 0.6, 0])]),
  hache_fer: () => merge([part(cyl(0.03, 0.035, 0.72, 5), WOOD_D, [0, 0.36, 0]), part(box(0.24, 0.16, 0.04), '#b8bec6', [0.1, 0.63, 0]), part(box(0.05, 0.18, 0.045), '#d8dee6', [0.22, 0.63, 0])]),
  pioche_pierre: () => merge([part(cyl(0.03, 0.035, 0.75, 5), WOOD_D, [0, 0.37, 0]), part(box(0.5, 0.07, 0.07), '#7e796f', [0, 0.7, 0], [0, 0, 0.1], [1, 1, 1], 0.03, 2)]),
  pioche_fer: () => merge([part(cyl(0.03, 0.035, 0.78, 5), WOOD_D, [0, 0.39, 0]), part(box(0.56, 0.06, 0.06), '#b8bec6', [0, 0.73, 0]), part(cone(0.035, 0.12, 4), '#d8dee6', [0.31, 0.73, 0], [0, 0, -Math.PI / 2]), part(cone(0.035, 0.12, 4), '#d8dee6', [-0.31, 0.73, 0], [0, 0, Math.PI / 2])]),
  lance: () => merge([part(cyl(0.025, 0.03, 1.7, 5), WOOD, [0, 0.6, 0]), part(cone(0.05, 0.22, 4), '#7e796f', [0, 1.55, 0]), part(cyl(0.035, 0.035, 0.08, 5), '#c9b07a', [0, 1.42, 0])]),
  gourdin: () => merge([part(cyl(0.05, 0.03, 0.75, 6), WOOD, [0, 0.38, 0]), part(dode(0.09), WOOD_D, [0, 0.72, 0])]),
  couteau: () => merge([part(box(0.035, 0.12, 0.035), WOOD_D, [0, 0.06, 0]), part(box(0.03, 0.22, 0.012), '#7e796f', [0, 0.23, 0])]),
  epee: () => merge([part(box(0.04, 0.16, 0.04), '#5a3d26', [0, 0.08, 0]), part(box(0.2, 0.03, 0.05), '#8a8f96', [0, 0.17, 0]), part(box(0.06, 0.7, 0.015), '#d8dee6', [0, 0.53, 0]), part(cone(0.03, 0.08, 4), '#d8dee6', [0, 0.92, 0])]),
  arc: () => {
    const p = [];
    for (let i = 0; i < 7; i++) { const a = -0.7 + i * (1.4 / 6); p.push(part(box(0.03, 0.17, 0.03), WOOD, [Math.cos(a) * 0.12 - 0.12, Math.sin(a) * 0.55 + 0.5, 0], [0, 0, a])); }
    p.push(part(cyl(0.004, 0.004, 0.72, 3), '#efe6d2', [-0.07, 0.5, 0]));
    return merge(p);
  },
  arbalete: () => merge([part(box(0.06, 0.6, 0.06), WOOD_D, [0, 0.3, 0]), part(box(0.6, 0.04, 0.05), '#6e7378', [0, 0.55, 0]), part(box(0.04, 0.1, 0.04), '#3a3d42', [0, 0.15, 0.04])]),
  torche: () => merge([part(cyl(0.035, 0.04, 0.55, 5), WOOD_D, [0, 0.27, 0]), part(cyl(0.06, 0.045, 0.12, 6), '#3a2a1c', [0, 0.58, 0])]),
  canne: () => merge([part(cyl(0.012, 0.025, 1.6, 4), WOOD, [0, 0.8, 0]), part(cyl(0.04, 0.04, 0.05, 8), '#5b5f66', [0.04, 0.25, 0], [0, 0, Math.PI / 2])]),
  houe: () => merge([part(cyl(0.03, 0.035, 0.9, 5), WOOD_D, [0, 0.45, 0]), part(box(0.2, 0.06, 0.05), '#7e796f', [0.07, 0.86, 0], [0, 0, -0.3])]),
  item: () => merge([part(box(0.16, 0.16, 0.16), '#c9b07a', [0, 0.08, 0])]),
};

// ---------- personnages et bêtes (groupes animés) ----------
function limb(w, h, d, color, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = new THREE.Mesh(box(w, h, d), colMat(color));
  m.position.y = -h / 2; m.castShadow = true;
  pivot.add(m);
  return pivot;
}
function mesh(geo, color, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, colMat(color));
  m.position.set(x, y, z); m.castShadow = cast; return m;
}

export function humanoid(opt = {}) {
  const skin = opt.skin || '#c98d62', shirt = opt.shirt || '#4f7a4a', pants = opt.pants || '#5a4a3a', hair = opt.hair || '#2e1f17';
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const torso = mesh(box(0.5, 0.62, 0.28), shirt, 0, 1.22, 0); body.add(torso);
  const pack = mesh(box(0.38, 0.45, 0.18), '#6b4a2f', 0, 1.25, -0.22); body.add(pack);
  const head = new THREE.Group(); head.position.set(0, 1.56, 0); body.add(head);
  head.add(mesh(box(0.3, 0.32, 0.3), skin, 0, 0.16, 0));
  head.add(mesh(box(0.32, 0.12, 0.32), hair, 0, 0.31, -0.01));
  head.add(mesh(box(0.32, 0.18, 0.06), hair, 0, 0.2, -0.15));
  head.add(mesh(box(0.05, 0.05, 0.02), '#1a1a1a', -0.07, 0.18, 0.15, false), mesh(box(0.05, 0.05, 0.02), '#1a1a1a', 0.07, 0.18, 0.15, false));
  const armL = limb(0.15, 0.6, 0.16, shirt, -0.33, 1.5, 0), armR = limb(0.15, 0.6, 0.16, shirt, 0.33, 1.5, 0);
  armL.add(mesh(box(0.13, 0.14, 0.14), skin, 0, -0.66, 0)); armR.add(mesh(box(0.13, 0.14, 0.14), skin, 0, -0.66, 0));
  const legL = limb(0.2, 0.9, 0.22, pants, -0.13, 0.92, 0), legR = limb(0.2, 0.9, 0.22, pants, 0.13, 0.92, 0);
  legL.add(mesh(box(0.21, 0.1, 0.3), '#3a2a1c', 0, -0.88, 0.04)); legR.add(mesh(box(0.21, 0.1, 0.3), '#3a2a1c', 0, -0.88, 0.04));
  body.add(armL, armR, legL, legR);
  const hand = new THREE.Group(); hand.position.set(0, -0.68, 0.04); armR.add(hand);
  // pièces d'armure (cachées par défaut)
  const gear = {
    tete: mesh(box(0.36, 0.2, 0.36), '#7a5a3a', 0, 0.36, 0), corps: mesh(box(0.56, 0.66, 0.34), '#7a5a3a', 0, 1.22, 0),
    jambes: new THREE.Group(),
  };
  head.add(gear.tete); body.add(gear.corps);
  gear.jl = mesh(box(0.23, 0.6, 0.25), '#7a5a3a', 0, -0.35, 0); gear.jr = mesh(box(0.23, 0.6, 0.25), '#7a5a3a', 0, -0.35, 0);
  legL.add(gear.jl); legR.add(gear.jr);
  for (const k of ['tete', 'corps', 'jl', 'jr']) gear[k].visible = false;
  return { group: g, body, torso, head, armL, armR, legL, legR, hand, gear };
}

export const ANIMAL_MODELS = {
  lapin: () => {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(mesh(box(0.28, 0.24, 0.42), '#a08060', 0, 0.22, 0));
    const head = new THREE.Group(); head.position.set(0, 0.36, 0.2); body.add(head);
    head.add(mesh(box(0.2, 0.18, 0.2), '#a08060', 0, 0, 0.04));
    head.add(mesh(box(0.05, 0.22, 0.04), '#a08060', -0.05, 0.18, -0.02), mesh(box(0.05, 0.22, 0.04), '#a08060', 0.05, 0.18, -0.02));
    body.add(mesh(box(0.1, 0.1, 0.08), '#f2ece0', 0, 0.26, -0.24));
    const legs = [limb(0.07, 0.14, 0.12, '#8a6a4c', -0.09, 0.14, 0.14), limb(0.07, 0.14, 0.12, '#8a6a4c', 0.09, 0.14, 0.14), limb(0.08, 0.14, 0.18, '#8a6a4c', -0.1, 0.14, -0.12), limb(0.08, 0.14, 0.18, '#8a6a4c', 0.1, 0.14, -0.12)];
    body.add(...legs);
    return { group: g, body, head, legs };
  },
  cerf: () => {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(mesh(box(0.5, 0.55, 1.2), '#9a6a42', 0, 1.05, 0));
    body.add(mesh(box(0.4, 0.3, 0.2), '#efe2c8', 0, 1.0, -0.62));
    const head = new THREE.Group(); head.position.set(0, 1.35, 0.6); body.add(head);
    head.add(mesh(box(0.22, 0.6, 0.22), '#9a6a42', 0, 0.2, 0, true));
    head.add(mesh(box(0.24, 0.24, 0.42), '#9a6a42', 0, 0.55, 0.12));
    head.add(mesh(box(0.08, 0.06, 0.06), '#222', 0, 0.55, 0.34));
    for (const sx of [-1, 1]) {
      head.add(mesh(cyl(0.025, 0.03, 0.45, 4), '#d8c8a0', sx * 0.1, 0.85, 0.04));
      head.add(mesh(cyl(0.02, 0.025, 0.25, 4), '#d8c8a0', sx * 0.2, 0.95, 0.08));
    }
    head.userData.antlers = true;
    const legs = [[-0.17, 0.42], [0.17, 0.42], [-0.17, -0.45], [0.17, -0.45]].map(([x, z]) => limb(0.12, 0.8, 0.12, '#7a5434', x, 0.82, z));
    body.add(...legs);
    return { group: g, body, head, legs };
  },
  sanglier: () => {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(mesh(box(0.6, 0.6, 1.1), '#4a3a30', 0, 0.62, 0));
    body.add(mesh(box(0.22, 0.25, 0.7), '#3a2c24', 0, 0.98, -0.05));
    const head = new THREE.Group(); head.position.set(0, 0.62, 0.55); body.add(head);
    head.add(mesh(box(0.4, 0.4, 0.4), '#4a3a30', 0, 0, 0.12));
    head.add(mesh(box(0.22, 0.18, 0.15), '#6a5040', 0, -0.06, 0.38));
    head.add(mesh(cone(0.03, 0.18, 4), '#efe6d2', -0.13, 0.0, 0.38, false), mesh(cone(0.03, 0.18, 4), '#efe6d2', 0.13, 0.0, 0.38, false));
    head.children[2].rotation.x = -0.6; head.children[3].rotation.x = -0.6;
    const legs = [[-0.18, 0.35], [0.18, 0.35], [-0.18, -0.35], [0.18, -0.35]].map(([x, z]) => limb(0.13, 0.4, 0.13, '#3a2c24', x, 0.4, z));
    body.add(...legs);
    return { group: g, body, head, legs };
  },
  loup: (alpha = false) => {
    const c = alpha ? '#3a3d44' : '#7a7d84', c2 = alpha ? '#2a2c32' : '#5f6268';
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(mesh(box(0.42, 0.45, 1.05), c, 0, 0.75, 0));
    body.add(mesh(box(0.48, 0.52, 0.4), c, 0, 0.82, 0.32));
    const head = new THREE.Group(); head.position.set(0, 0.95, 0.6); body.add(head);
    head.add(mesh(box(0.32, 0.3, 0.32), c, 0, 0, 0.08));
    head.add(mesh(box(0.17, 0.15, 0.25), c2, 0, -0.05, 0.32));
    head.add(mesh(cone(0.07, 0.17, 4), c2, -0.1, 0.22, 0.02), mesh(cone(0.07, 0.17, 4), c2, 0.1, 0.22, 0.02));
    const eyes = [mesh(box(0.05, 0.04, 0.02), '#ffd24a', -0.08, 0.05, 0.25, false), mesh(box(0.05, 0.04, 0.02), '#ffd24a', 0.08, 0.05, 0.25, false)];
    eyes.forEach((e) => { e.material = new THREE.MeshBasicMaterial({ color: alpha ? 0xff4422 : 0xffd24a }); head.add(e); });
    const tail = new THREE.Group(); tail.position.set(0, 0.88, -0.52); tail.rotation.x = -0.9; body.add(tail);
    tail.add(mesh(box(0.12, 0.12, 0.5), c, 0, 0, -0.25));
    const legs = [[-0.13, 0.35], [0.13, 0.35], [-0.13, -0.38], [0.13, -0.38]].map(([x, z]) => limb(0.11, 0.55, 0.11, c2, x, 0.56, z));
    body.add(...legs);
    if (alpha) g.scale.setScalar(1.35);
    return { group: g, body, head, legs, tail };
  },
  ours: (boss = false) => {
    const c = boss ? '#3b2a20' : '#5a3d2a', c2 = boss ? '#2a1d16' : '#4a3122';
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(mesh(box(1.0, 1.0, 1.7), c, 0, 1.15, 0));
    body.add(mesh(box(0.9, 0.5, 0.6), c, 0, 1.6, 0.35));
    const head = new THREE.Group(); head.position.set(0, 1.35, 0.95); body.add(head);
    head.add(mesh(box(0.6, 0.55, 0.55), c, 0, 0, 0.1));
    head.add(mesh(box(0.3, 0.25, 0.3), '#8a6a4a', 0, -0.1, 0.45));
    head.add(mesh(box(0.12, 0.1, 0.06), '#111', 0, -0.03, 0.6, false));
    head.add(mesh(box(0.15, 0.15, 0.1), c2, -0.22, 0.32, 0), mesh(box(0.15, 0.15, 0.1), c2, 0.22, 0.32, 0));
    if (boss) { head.add(mesh(box(0.04, 0.4, 0.04), '#d8d0c0', 0.18, 0.05, 0.38, false)); body.add(mesh(box(0.2, 0.1, 1.0), '#c8b8a0', -0.45, 1.55, 0)); }
    const legs = [[-0.32, 0.55], [0.32, 0.55], [-0.32, -0.55], [0.32, -0.55]].map(([x, z]) => limb(0.3, 0.72, 0.32, c2, x, 0.72, z));
    body.add(...legs);
    if (boss) g.scale.setScalar(1.6);
    return { group: g, body, head, legs };
  },
  poule: () => {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(mesh(box(0.28, 0.28, 0.36), '#f2ece0', 0, 0.32, 0));
    body.add(mesh(box(0.2, 0.2, 0.08), '#e8e0d0', 0, 0.42, -0.2));
    const head = new THREE.Group(); head.position.set(0, 0.5, 0.17); body.add(head);
    head.add(mesh(box(0.14, 0.16, 0.14), '#f2ece0', 0, 0.04, 0));
    head.add(mesh(box(0.05, 0.08, 0.1), '#d83a2a', 0, 0.15, 0), mesh(cone(0.04, 0.08, 4), '#e8a630', 0, 0.02, 0.1));
    head.children[2].rotation.x = Math.PI / 2;
    const legs = [limb(0.04, 0.18, 0.04, '#e8a630', -0.07, 0.19, 0), limb(0.04, 0.18, 0.04, '#e8a630', 0.07, 0.19, 0)];
    body.add(...legs);
    return { group: g, body, head, legs };
  },
};

// petit objet posé au sol (sac, butin)
export function dropModel() {
  return merge([part(box(0.5, 0.4, 0.35), '#7a5a3a', [0, 0.2, 0]), part(box(0.52, 0.12, 0.37), '#5a3f2a', [0, 0.36, 0]), part(box(0.1, 0.1, 0.02), '#c9a24a', [0, 0.28, 0.18])]);
}
