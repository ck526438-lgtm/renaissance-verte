import * as THREE from 'three';
import { G } from '../core/state.js';
import { clamp, lerp, smooth } from '../core/rng.js';

// Ciel dégradé avec soleil, lune, étoiles, nuages ; lumières et brouillard qui suivent l'heure et la météo.
const K = (h) => new THREE.Color(h);
const PAL = [
  // heure, zénith, horizon, soleil, ambiance ciel, ambiance sol
  [0,    K('#060b1a'), K('#0f1a33'), K('#8899cc'), K('#3a4a72'), K('#161a20')],
  [4.8,  K('#0b1530'), K('#24304f'), K('#8899cc'), K('#3a4a6c'), K('#181b20')],
  [6.0,  K('#3b5d8f'), K('#f0a070'), K('#ffb070'), K('#8a8fb0'), K('#4a3a30')],
  [7.6,  K('#4f8fd6'), K('#bcd8ee'), K('#fff1d8'), K('#b8d4f0'), K('#5a5038')],
  [12,   K('#3e86dc'), K('#c4e0f4'), K('#ffffff'), K('#c8e0f8'), K('#64583c')],
  [17,   K('#4a88d0'), K('#d6e2ea'), K('#fff0d0'), K('#c0d4ea'), K('#5f5238')],
  [19.2, K('#45609a'), K('#f29a5c'), K('#ff9d55'), K('#a08a98'), K('#4a3528')],
  [20.6, K('#18244a'), K('#3a3456'), K('#9aa6d8'), K('#3a4466'), K('#16181c')],
  [24,   K('#060b1a'), K('#0f1a33'), K('#8899cc'), K('#3a4a72'), K('#161a20')],
];

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uni = {
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0.3 }, uTime: { value: 0 },
      uDark: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(900, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uni, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 uTop, uHor, uSunDir, uMoonDir, uSunCol; uniform float uNight, uCloud, uTime, uDark;
        varying vec3 vDir;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec3 d = normalize(vDir);
          float y = max(d.y, 0.0);
          vec3 c = mix(uHor, uTop, pow(y, 0.55));
          if (d.y < 0.0) c = mix(uHor, uHor*0.55, clamp(-d.y*3.0,0.,1.));
          float sd = max(dot(d, uSunDir), 0.0);
          c += uSunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 18.0) * 0.28) * (1.0 - uDark*0.8);
          float md = max(dot(d, uMoonDir), 0.0);
          c += vec3(0.85,0.9,1.0) * (smoothstep(0.9993, 0.9996, md) * 1.2 + pow(md, 60.0)*0.08) * uNight;
          // étoiles
          vec2 sp = d.xz / (d.y + 0.25) * 180.0;
          float st = step(0.9965, h(floor(sp))) * smoothstep(0.0, 0.25, d.y);
          st *= 0.6 + 0.4 * sin(uTime*3.0 + h(floor(sp))*40.0);
          c += vec3(st) * uNight * (1.0 - uCloud);
          // nuages
          if (d.y > 0.0) {
            vec2 cp = d.xz / (d.y + 0.12) * 2.2 + vec2(uTime*0.012, uTime*0.004);
            float cl = n(cp) * 0.55 + n(cp*2.3) * 0.3 + n(cp*5.1) * 0.15;
            cl = smoothstep(1.0 - uCloud*0.9 - 0.15, 1.0 - uCloud*0.5 + 0.1, cl) * smoothstep(0.0, 0.18, d.y);
            vec3 cc = mix(vec3(1.0), uHor, 0.35) * (1.0 - uDark*0.55) * (1.0 - uNight*0.82);
            cc += uSunCol * pow(sd, 6.0) * 0.25;
            c = mix(c, cc, cl * 0.9);
          }
          c = mix(c, vec3(dot(c, vec3(0.33))), uDark * 0.55);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.fog = new THREE.Fog(0xbfd6ea, 60, 260);
    scene.fog = this.fog;
    this.flash = 0;
    this.horizon = new THREE.Color();
    this.setShadowQuality(G.quality);
  }

  setShadowQuality(q) {
    const s = this.sun.shadow;
    const size = q === 'haut' ? 2048 : q === 'moyen' ? 1024 : 512;
    s.mapSize.set(size, size);
    const ext = q === 'haut' ? 60 : q === 'moyen' ? 45 : 32;
    Object.assign(s.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 260 });
    s.camera.updateProjectionMatrix();
    if (s.map) { s.map.dispose(); s.map = null; }
  }

  update(dt, focus) {
    const hr = G.time.hour;
    let a = PAL[0], b = PAL[1];
    for (let i = 0; i < PAL.length - 1; i++) if (hr >= PAL[i][0] && hr < PAL[i + 1][0]) { a = PAL[i]; b = PAL[i + 1]; }
    const t = (hr - a[0]) / (b[0] - a[0]);
    const W = G.weather || { cloud: 0.3, dark: 0, fog: 0 };
    const top = _c1.copy(a[1]).lerp(b[1], t), hor = _c2.copy(a[2]).lerp(b[2], t), sunC = _c3.copy(a[3]).lerp(b[3], t);
    const dark = clamp(W.dark, 0, 1);
    const grey = _c4.setRGB(0.55, 0.58, 0.62).multiplyScalar(0.25 + 0.75 * clamp((G.dayLight || 0) + 0.1, 0, 1));
    top.lerp(grey, dark * 0.8); hor.lerp(grey, dark * 0.75);
    if (this.flash > 0) { top.lerp(_c4.setRGB(0.9, 0.92, 1), this.flash * 0.7); hor.lerp(_c4, this.flash * 0.7); this.flash = Math.max(0, this.flash - dt * 3); }

    this.uni.uTop.value.copy(top); this.uni.uHor.value.copy(hor); this.uni.uSunCol.value.copy(sunC);
    this.uni.uCloud.value = W.cloud; this.uni.uDark.value = dark; this.uni.uTime.value += dt;

    // course du soleil : lever 6h à l'est, coucher 20h à l'ouest
    const ang = ((hr - 6) / 14) * Math.PI;
    const tilt = 0.45 - G.season * 0.0 + (G.season === 3 ? -0.15 : G.season === 1 ? 0.12 : 0);
    const sd = _v1.set(Math.cos(ang), Math.sin(ang) * (0.75 + tilt * 0.3), 0.35).normalize();
    const md = _v2.set(-sd.x, -sd.y, -0.25).normalize();
    this.uni.uSunDir.value.copy(sd); this.uni.uMoonDir.value.copy(md);
    const day = clamp(sd.y * 4 + 0.15, 0, 1);
    const night = clamp(-sd.y * 5 + 0.2, 0, 1);
    this.uni.uNight.value = night;
    G.dayLight = day;

    // lumière : soleil le jour, lune la nuit
    const L = day > 0.02 ? sd : md;
    this.sun.position.copy(focus).addScaledVector(L, 120);
    this.sun.target.position.copy(focus);
    const moon = 0.5 * (1 - dark * 0.6);
    this.sun.intensity = day > 0.02 ? lerp(0.1, 2.6, smooth(0, 0.6, sd.y)) * (1 - dark * 0.72) : moon * night;
    this.sun.color.copy(day > 0.02 ? sunC : _c4.setRGB(0.6, 0.7, 1.0));
    this.hemi.color.copy(a[4]).lerp(b[4], t).lerp(grey, dark * 0.5);
    this.hemi.groundColor.copy(a[5]).lerp(b[5], t);
    if (G.snow > 0.2) this.hemi.groundColor.lerp(_c4.setRGB(0.6, 0.62, 0.66), G.snow * 0.6);
    this.hemi.intensity = (0.55 + day * 0.65) * (1 - dark * 0.25) + this.flash * 2;
    this.sun.intensity += this.flash * 2.5;

    // brouillard
    const vd = G.settings.viewDist;
    const fogK = clamp(W.fog, 0, 1);
    this.fog.color.copy(hor).lerp(top, 0.15);
    this.fog.near = lerp(vd * 0.35, 6, fogK);
    this.fog.far = lerp(vd, 55, fogK);
    if (G.underwater) { this.fog.color.setRGB(0.1, 0.3, 0.38); this.fog.near = 1; this.fog.far = 22; }
    this.horizon.copy(this.fog.color);
    G.renderer.setClearColor(this.fog.color);
    this.dome.position.copy(G.camera.position);
  }

  lightning() { this.flash = 1; }
}
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(), _c4 = new THREE.Color();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
