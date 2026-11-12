import * as THREE from 'three';
import { G, WORLD, SEG, CELL, HALF } from '../core/state.js';
import { makeNoise2D, fbm, smooth, clamp, mulberry32 } from '../core/rng.js';

// Île procédurale : plaines au centre, montagne d'un côté, lacs, plages, falaises.
export class Terrain {
  constructor(seed) {
    this.seed = seed;
    const n1 = makeNoise2D(seed), n2 = makeNoise2D(seed + 11), n3 = makeNoise2D(seed + 23), n4 = makeNoise2D(seed + 37), n5 = makeNoise2D(seed + 51);
    this.nForest = makeNoise2D(seed + 71);
    this.nMoist = makeNoise2D(seed + 83);
    const rnd = mulberry32(seed + 5);
    this.mtnAngle = rnd() * Math.PI * 2;
    const ca = Math.cos(this.mtnAngle), sa = Math.sin(this.mtnAngle);
    this.mtnDir = [ca, sa];

    const N = SEG + 1;
    this.N = N;
    const H = (this.h = new Float32Array(N * N));
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -HALF + i * CELL, z = -HALF + j * CELL;
        const nx = x / HALF, nz = z / HALF, d = Math.hypot(nx, nz);
        let h = 4 + fbm(n1, x * 0.0045, z * 0.0045, 5) * 10 + fbm(n2, x * 0.02, z * 0.02, 3) * 1.4;
        // montagne
        const along = nx * ca + nz * sa;
        const mm = smooth(0.12, 0.7, along) * smooth(0.95, 0.55, d);
        const r = 1 - Math.abs(fbm(n3, x * 0.008, z * 0.008, 4));
        h += mm * (r * r * 52 + 5);
        // lacs
        const L = fbm(n4, x * 0.006 + 40, z * 0.006 - 13, 3);
        const lakeMask = smooth(0.12, 0.3, d) * (1 - mm);
        if (L > 0.3) h -= Math.min(14, (L - 0.3) * 55) * lakeMask;
        // petites collines
        h += Math.max(0, fbm(n5, x * 0.012, z * 0.012, 3) - 0.25) * 14 * (1 - mm);
        // plateau de départ au centre
        const cm = smooth(0.16, 0.0, d);
        h = h * (1 - cm) + Math.max(h, 3.2) * cm;
        // l'océan autour
        h = h * (1 - smooth(0.7, 0.96, d)) + -14 * smooth(0.7, 0.96, d);
        H[j * N + i] = h;
      }
    }
    // léger lissage pour éviter les pics de grille
    const T = new Float32Array(H);
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = j * N + i;
      H[k] = T[k] * 0.6 + (T[k - 1] + T[k + 1] + T[k - N] + T[k + N]) * 0.1;
    }
    this.build();
  }

  idx(i, j) { return clamp(j, 0, SEG) * this.N + clamp(i, 0, SEG); }

  heightAt(x, z) {
    const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const H = this.h;
    const a = H[this.idx(i, j)], b = H[this.idx(i + 1, j)], c = H[this.idx(i, j + 1)], d = H[this.idx(i + 1, j + 1)];
    // découpage en triangles identique à PlaneGeometry
    if (tx + tz < 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 1.2;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  slopeAt(x, z) { return 1 - this.normalAt(x, z, _n).y; }

  forestAt(x, z) { return fbm(this.nForest, x * 0.007, z * 0.007, 3); }      // -1..1
  moistAt(x, z) { return fbm(this.nMoist, x * 0.005, z * 0.005, 2); }

  mountainAt(x, z) {
    const nx = x / HALF, nz = z / HALF;
    return smooth(0.12, 0.7, nx * this.mtnDir[0] + nz * this.mtnDir[1]) * smooth(0.95, 0.55, Math.hypot(nx, nz));
  }

  inWorld(x, z, m = 0) { return x > -HALF + m && x < HALF - m && z > -HALF + m && z < HALF - m; }

  colorFor(x, z, h, ny, out) {
    const f = this.forestAt(x, z);
    const v = (Math.sin(x * 0.37 + z * 0.11) * 0.5 + Math.sin(x * 0.07 - z * 0.23) * 0.5) * 0.04;
    let grass = 0;
    if (h < -0.6) out.setRGB(0.48, 0.43, 0.3);                 // fond de lac
    else if (h < 0.9) out.setRGB(0.84, 0.77, 0.55);            // plage
    else if (h > 47) out.setRGB(0.93, 0.95, 0.97);             // neiges éternelles
    else if (ny < 0.78 || h > 31) {                            // roche
      const g = 0.45 + v * 2 + (h > 31 ? 0.03 : 0);
      out.setRGB(g + 0.03, g, g - 0.04);
      if (ny > 0.82 && h < 36) { out.lerp(_c.setRGB(0.38, 0.52, 0.28), 0.35); grass = 0.3; }
    } else {
      grass = 1;
      const meadow = _c.setRGB(0.42 + v, 0.63 + v, 0.29);
      const forest = _c2.setRGB(0.29 + v, 0.47 + v, 0.2);
      out.copy(meadow).lerp(forest, smooth(-0.1, 0.35, f));
      if (h < 1.8) out.lerp(_c.setRGB(0.7, 0.68, 0.45), (1.8 - h) / 0.9 * 0.6);
    }
    return grass;
  }

  build() {
    const N = this.N;
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const i = k % N, j = Math.floor(k / N);
      pos.setY(k, this.h[j * N + i]);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    const col = new Float32Array(pos.count * 3), gr = new Float32Array(pos.count);
    const c = new THREE.Color();
    // image de la carte (couleur + ombrage)
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const g = cv.getContext('2d'); const img = g.createImageData(N, N);
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), h = pos.getY(k), ny = nrm.getY(k);
      gr[k] = this.colorFor(x, z, h, ny, c);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      let r = c.r, gg = c.g, b = c.b;
      if (h < 0) { const dp = clamp(-h / 12, 0, 1); r = 0.2 - dp * 0.1; gg = 0.45 - dp * 0.15; b = 0.6 - dp * 0.12; }
      const sh = clamp(0.75 + (nrm.getX(k) * -0.6 + nrm.getZ(k) * -0.4) * 1.4, 0.45, 1.25);
      img.data[k * 4] = clamp(r * sh * 255, 0, 255); img.data[k * 4 + 1] = clamp(gg * sh * 255, 0, 255);
      img.data[k * 4 + 2] = clamp(b * sh * 255, 0, 255); img.data[k * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.mapCanvas = cv;
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aGrass', new THREE.BufferAttribute(gr, 1));

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.uniforms = { uSnow: { value: 0 }, uDry: { value: 0 }, uAutumn: { value: 0 }, uWet: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGrass;\nvarying float vGrass;\nvarying float vNY;\nvarying float vH;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrass = aGrass; vNY = normal.y; vH = position.y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSnow, uDry, uAutumn, uWet;\nvarying float vGrass;\nvarying float vNY;\nvarying float vH;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 tc = diffuseColor.rgb;
          tc = mix(tc, tc * vec3(1.32, 1.1, 0.55) + vec3(0.07, 0.05, 0.0), uDry * vGrass * 0.85);
          tc = mix(tc, tc * vec3(1.25, 0.95, 0.55), uAutumn * vGrass * 0.5);
          float sn = uSnow * smoothstep(0.5, 0.82, vNY) * smoothstep(0.2, 1.0, vH);
          tc = mix(tc, vec3(0.92, 0.94, 0.98), clamp(sn, 0.0, 1.0));
          tc *= 1.0 - uWet * 0.16 * (1.0 - sn);
          diffuseColor.rgb = tc;`);
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
  }

  // trouve un point de terre ferme proche
  findLand(x, z, minH = 1.5, maxSlope = 0.25, r = 60) {
    for (let k = 0; k < 400; k++) {
      const a = k * 2.399, d = Math.sqrt(k) * (r / 20);
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const h = this.heightAt(px, pz);
      if (h > minH && this.slopeAt(px, pz) < maxSlope) return { x: px, z: pz, y: h };
    }
    return { x, z, y: this.heightAt(x, z) };
  }
}
const _n = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color();
