import * as THREE from 'three';
import { G, WORLD } from '../core/state.js';
import { clamp } from '../core/rng.js';

// Mer et lacs : surface animée, couleur selon la saison, glace en hiver, niveau qui monte lors des crues.
export class Water {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(WORLD * 2.2, WORLD * 2.2, 160, 160);
    geo.rotateX(-Math.PI / 2);
    this.uni = { uT: { value: 0 }, uIce: { value: 0 }, uRain: { value: 0 } };
    const mat = new THREE.MeshPhongMaterial({ color: 0x2f7fa0, specular: 0xbfdfff, shininess: 90, transparent: true, opacity: 0.8, depthWrite: false });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uni);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT, uIce, uRain;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float amp = (0.16 + uRain*0.12) * (1.0 - uIce);
          vec4 wp = modelMatrix * vec4(position,1.0);
          transformed.y += (sin(wp.x*0.21 + uT*1.3) + sin(wp.z*0.17 + uT*1.05) * 0.8 + sin((wp.x+wp.z)*0.6 + uT*2.6)*0.25) * amp;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          { vec4 wq = modelMatrix * vec4(position,1.0); float a2 = (0.16 + uRain*0.12) * (1.0 - uIce);
            objectNormal = normalize(vec3(-cos(wq.x*0.21 + uT*1.3)*0.21*a2*2.0, 1.0, -cos(wq.z*0.17 + uT*1.05)*0.17*a2*2.0)); }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uIce;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82,0.9,0.96), uIce);
          diffuseColor.a = mix(diffuseColor.a, 0.96, uIce);`);
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 2;
    this.mesh.name = 'water';
    scene.add(this.mesh);
    this.mat = mat;
    this.base = new THREE.Color(0x2f7fa0);
  }

  update(dt) {
    this.uni.uT.value += dt;
    this.uni.uIce.value = clamp(G.frozen, 0, 1);
    this.uni.uRain.value = G.weather ? G.weather.rain : 0;
    this.mesh.position.y = G.waterLevel;
    const seasonCol = [0x2f86a2, 0x2a8fa8, 0x3a7a86, 0x52707e][G.season];
    this.mat.color.setHex(seasonCol);
    if (G.weather && G.weather.dark > 0.3) this.mat.color.lerp(_g.setRGB(0.25, 0.32, 0.36), G.weather.dark * 0.5);
    this.mat.depthWrite = G.frozen > 0.5;
    const cam = G.camera.position;
    this.mesh.position.x = Math.round(cam.x / 20) * 20;
    this.mesh.position.z = Math.round(cam.z / 20) * 20;
  }

  levelAt() { return G.waterLevel; }
}
const _g = new THREE.Color();
