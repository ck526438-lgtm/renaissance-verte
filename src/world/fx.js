import * as THREE from 'three';
import { G } from '../core/state.js';

// Particules : fumée, poussière, éclats, braises, sang, gerbes d'eau…
class Particles {
  constructor(scene, cap, additive) {
    this.cap = cap; this.n = 0;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.grav = new Float32Array(cap); this.drag = new Float32Array(cap); this.grow = new Float32Array(cap); this.a0 = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; attribute vec4 pcol; varying vec4 vC; uniform float uScale;
        void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - r*3.2)); }`,
    });
    this.mat = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.geo = geo;
  }
  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, a = 1, grav = 0, drag = 0, grow = 0) {
    let i;
    if (this.n < this.cap) i = this.n++;
    else i = Math.floor(Math.random() * this.cap);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a; this.a0[i] = a;
    this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
  }
  update(dt) {
    const wind = G.weather ? G.weather.wind : 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[j * 3 + k]; this.vel[i * 3 + k] = this.vel[j * 3 + k]; }
          for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.col[j * 4 + k];
          this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j]; this.grav[i] = this.grav[j];
          this.drag[i] = this.drag[j]; this.grow[i] = this.grow[j]; this.a0[i] = this.a0[j];
          i--;
        }
        continue;
      }
      const d = 1 - this.drag[i] * dt;
      this.vel[i * 3] = this.vel[i * 3] * d + wind * 1.5 * dt * (this.grav[i] < 0 ? 1 : 0.2);
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.max[i];
      this.col[i * 4 + 3] = this.a0[i] * Math.min(1, t * 2.5);
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'pcol', 'size']) this.geo.attributes[k].needsUpdate = true;
    this.mat.uniforms.uScale.value = G.renderer.domElement.height * 0.5;
  }
}

export const FX = {
  init(scene) {
    this.p = new Particles(scene, 2400, false);
    this.g = new Particles(scene, 1400, true);
  },
  update(dt) { this.p.update(dt); this.g.update(dt); },
  burst(x, y, z, n, col, opt = {}) {
    const c = _c.set(col);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (opt.speed ?? 3) * (0.4 + Math.random());
      (opt.glow ? this.g : this.p).spawn(x, y, z, Math.cos(a) * sp, (opt.up ?? 3) * (0.5 + Math.random()), Math.sin(a) * sp,
        (opt.life ?? 0.7) * (0.6 + Math.random() * 0.8), (opt.size ?? 0.12) * (0.6 + Math.random() * 0.8), c.r, c.g, c.b, opt.alpha ?? 1, opt.grav ?? 12, opt.drag ?? 1.5, opt.grow ?? 0);
    }
  },
  smoke(x, y, z, n = 1, col = '#8a8a88', size = 0.6) {
    const c = _c.set(col);
    for (let i = 0; i < n; i++) this.p.spawn(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 1 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3, 2.5 + Math.random() * 1.5, size, c.r, c.g, c.b, 0.35, -0.2, 0.3, 0.7);
  },
  flame(x, y, z, k = 1) {
    const r = Math.random();
    this.g.spawn(x + (Math.random() - 0.5) * 0.35 * k, y, z + (Math.random() - 0.5) * 0.35 * k, (Math.random() - 0.5) * 0.3, 1.4 + Math.random() * 1.2, (Math.random() - 0.5) * 0.3,
      0.45 + Math.random() * 0.35, (0.35 + Math.random() * 0.3) * k, 1, 0.45 + r * 0.35, 0.12, 0.9, -1.5, 1.2, -0.4);
    if (Math.random() < 0.18) this.g.spawn(x, y + 0.3, z, (Math.random() - 0.5) * 1.2, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.2, 1.2 + Math.random(), 0.06, 1, 0.75, 0.3, 1, 0.6, 0.5, 0);
  },
  splash(x, y, z, n = 10) { this.burst(x, y, z, n, '#d8eef6', { speed: 1.5, up: 4, life: 0.6, size: 0.1, grav: 14 }); },
  blood(x, y, z, n = 8) { this.burst(x, y, z, n, '#9a1f1f', { speed: 2, up: 2.5, life: 0.6, size: 0.09, grav: 12 }); },
  chips(x, y, z, col, n = 8) { this.burst(x, y, z, n, col, { speed: 2.5, up: 3.5, life: 0.7, size: 0.1, grav: 14 }); },
  leaves(x, y, z, col, n = 12) { this.burst(x, y, z, n, col, { speed: 1.5, up: 1, life: 2.2, size: 0.13, grav: 1.2, drag: 1.2 }); },
  sparkle(x, y, z, col = '#ffe9a8', n = 10) { this.burst(x, y, z, n, col, { speed: 1, up: 1.5, life: 1, size: 0.08, grav: -0.5, glow: true }); },
};
const _c = new THREE.Color();
