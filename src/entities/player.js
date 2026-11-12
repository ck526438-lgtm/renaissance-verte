import * as THREE from 'three';
import { G, HALF } from '../core/state.js';
import { input } from '../core/input.js';
import { clamp, lerp, angleDiff } from '../core/rng.js';
import { humanoid, HELD, MAT } from '../world/models.js';
import { resolve, floorAt } from '../core/collide.js';
import { ITEMS } from '../game/items.js';
import { FX } from '../world/fx.js';

const GRAV = 24;
const _v = new THREE.Vector3(), _t = new THREE.Vector3();

export class Player {
  constructor(scene, camera) {
    this.scene = scene; this.cam = camera;
    this.pos = new THREE.Vector3(0, 5, 0); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = -0.15; this.facing = Math.PI;
    this.onGround = false; this.swimming = false; this.sprinting = false;
    this.view = 3; this.camDist = 5.2; // 3e personne
    this.hotbar = 0; this.swing = 0; this.swingDur = 0.35; this.stepT = 0; this.fallStart = null; this.anim = 0;
    this.sleeping = false; this.dead = false; this.aiming = 0;
    this.model = humanoid();
    this.model.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.model.group);
    this.heldId = null; this.heldMesh = null; this.viewMesh = null;
    this.viewRoot = new THREE.Group(); camera.add(this.viewRoot); scene.add(camera);
    this.light = new THREE.PointLight(0xffb060, 0, 14, 1.6);
    this.light.castShadow = false; scene.add(this.light);
    this.camPos = new THREE.Vector3();
    this.stats = { vie: 100, faim: 100, soif: 100, energie: 100, sommeil: 100, temp: 37, wet: 0 };
    this.fx = {}; // états : saignement, infection, fievre, intox, poison, entorse, hypothermie, chaleur
    this.equip = { tete: null, corps: null, jambes: null };
    this.spawn = null;
  }

  get selected() { return G.inv.slots[this.hotbar]; }
  get tool() { const s = this.selected; return s && ITEMS[s.id].tool ? ITEMS[s.id].tool : null; }

  place(x, z) {
    this.pos.set(x, G.terrain.heightAt(x, z) + 0.1, z); this.vel.set(0, 0, 0);
    this.fallStart = null;
  }

  speedMul() {
    let m = 1;
    if (this.fx.entorse) m *= 0.6;
    if (this.stats.energie < 5) m *= 0.75;
    if (G.snow > 0.5 && this.onGround) m *= 0.85;
    if (this.fx.hypothermie) m *= 0.85;
    const w = this.equip.corps && ITEMS[this.equip.corps.id].id === 'plastron_fer' ? 0.92 : 1;
    return m * w;
  }

  groundAt(x, z, feet) {
    let g = G.terrain.heightAt(x, z);
    const f = floorAt(x, z, feet + 0.65);
    if (f > g) g = f;
    if (G.frozen > 0.6 && G.waterLevel > g) g = G.waterLevel;
    return g;
  }

  update(dt) {
    const sens = 0.0024 * G.settings.sens;
    if (!G.uiOpen && !this.dead && !this.sleeping) {
      this.yaw -= input.look.x * sens;
      this.pitch -= input.look.y * sens * (G.settings.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.35, 1.25);
    }
    if (input.pressed.view) { this.view = this.view === 1 ? 3 : 1; G.toast && G.toast(this.view === 1 ? 'Vue à la 1re personne' : 'Vue à la 3e personne'); }

    const S = this.stats;
    const ctrl = !G.uiOpen && !this.dead && !this.sleeping && !G.placing?.blockMove;
    let mx = ctrl ? input.move.x : 0, my = ctrl ? input.move.y : 0;
    const moving = Math.hypot(mx, my) > 0.05;
    const wl = G.waterLevel;
    const ground = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    const depth = wl - ground;
    this.swimming = G.frozen < 0.6 && depth > 1.25 && this.pos.y < wl - 0.6;
    this.sprinting = ctrl && moving && (input.held.sprint || G.autoSprint) && S.energie > 3 && !this.swimming && my > -0.2;
    let speed = this.swimming ? 2.6 : this.sprinting ? 7.2 : 4.3;
    if (G.placing) speed *= 0.8;
    speed *= this.speedMul();
    if (this.fx.entorse && this.sprinting) speed = 4.3 * 0.7;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const fx = -sin * my + cos * mx, fz = -cos * my - sin * mx;
    const ax = fx * speed, az = fz * speed;
    const acc = this.onGround || this.swimming ? 14 : 3;
    this.vel.x = lerp(this.vel.x, ax, Math.min(1, acc * dt));
    this.vel.z = lerp(this.vel.z, az, Math.min(1, acc * dt));

    if (this.swimming) {
      const target = wl - 1.25;
      this.vel.y = lerp(this.vel.y, (target - this.pos.y) * 3, Math.min(1, dt * 4));
      if (ctrl && input.held.jump) this.vel.y = 2;
      this.fallStart = null;
    } else {
      this.vel.y -= GRAV * dt;
      if (ctrl && input.pressed.jump && this.onGround && S.energie > 4) { this.vel.y = 7.4; this.onGround = false; S.energie -= 3; G.audio && G.audio.play('step', {}); }
    }

    const prev = _t.copy(this.pos);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    // bords du monde
    const lim = HALF - 4; this.pos.x = clamp(this.pos.x, -lim, lim); this.pos.z = clamp(this.pos.z, -lim, lim);
    resolve(this.pos, 0.38, this.pos.y, 1.75, this);
    // pente trop raide : on glisse
    const g2 = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (g2 - prev.y > 0.9 && this.onGround) { this.pos.x = prev.x; this.pos.z = prev.z; }
    const gh = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= gh) {
      if (!this.onGround && this.fallStart !== null) {
        const fall = this.fallStart - gh;
        if (fall > 4.5 && !this.swimming) G.survival.fallDamage(fall);
      }
      this.pos.y = gh; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true; this.fallStart = null;
    } else {
      if (this.onGround && this.pos.y - gh > 0.35) this.onGround = false;
      if (this.onGround) this.pos.y = gh;
      if (!this.onGround && this.fallStart === null && this.vel.y <= 0) this.fallStart = this.pos.y;
    }
    if (this.swimming) { this.onGround = false; this.fallStart = null; }

    // effort
    if (this.sprinting) S.energie = Math.max(0, S.energie - dt * 7);
    if (this.swimming && moving) S.energie = Math.max(0, S.energie - dt * 3.5);
    const dist = Math.hypot(this.pos.x - prev.x, this.pos.z - prev.z);
    G.stats.distance += dist;

    // orientation du corps
    if (this.view === 1 || this.aiming > 0 || this.swing > 0 || (this.tool && this.tool.kind === 'arc' && input.held.aim)) this.facing = this.yaw + Math.PI;
    else if (moving) this.facing += angleDiff(this.facing, Math.atan2(fx, fz)) * Math.min(1, dt * 10);

    // pas
    if (moving && (this.onGround || this.swimming)) {
      this.stepT -= dt * (this.sprinting ? 1.6 : 1) * (this.swimming ? 0.6 : 1);
      if (this.stepT <= 0) {
        this.stepT = 0.42;
        const snow = G.snow > 0.4, water = this.swimming || depth > 0.1;
        G.audio && G.audio.play('step', { snow, water, v: this.sprinting ? 1.2 : 0.8 });
        if (water) FX.splash(this.pos.x, wl, this.pos.z, 4);
        else if (snow) FX.burst(this.pos.x, this.pos.y + 0.05, this.pos.z, 3, '#ffffff', { speed: 0.8, up: 1.2, life: 0.5, size: 0.08, grav: 6 });
        else if (this.sprinting) FX.burst(this.pos.x, this.pos.y + 0.05, this.pos.z, 2, '#b8a27a', { speed: 0.6, up: 0.6, life: 0.6, size: 0.18, grav: 0.5, alpha: 0.35, grow: 0.4 });
      }
    }

    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt);
    this.animate(dt, moving);
    this.updateHeld();
    this.updateCamera(dt);
    G.underwater = this.cam.position.y < wl - 0.05 && G.frozen < 0.6;
  }

  doSwing(dur = 0.35) { this.swing = dur; this.swingDur = dur; G.audio && G.audio.play('swing', { v: 0.6 }); }

  animate(dt, moving) {
    const m = this.model, sp = Math.hypot(this.vel.x, this.vel.z);
    this.anim += dt * (2 + sp * 1.6);
    const a = Math.sin(this.anim) * Math.min(1, sp / 4) * (this.sprinting ? 0.95 : 0.6);
    m.group.position.copy(this.pos);
    m.group.rotation.y = this.facing;
    m.legL.rotation.x = a; m.legR.rotation.x = -a;
    m.armL.rotation.x = -a * 0.8; m.armR.rotation.x = a * 0.8;
    m.body.position.y = Math.abs(Math.sin(this.anim)) * 0.05 * Math.min(1, sp / 3);
    m.body.rotation.x = this.sprinting ? 0.12 : 0;
    if (this.swimming) {
      m.body.rotation.x = 1.1; m.body.position.y = 0.5;
      m.armL.rotation.x = Math.sin(this.anim * 0.8) * 1.6 - 1.2; m.armR.rotation.x = -Math.sin(this.anim * 0.8) * 1.6 - 1.2;
    }
    if (this.swing > 0) {
      const t = 1 - this.swing / this.swingDur;
      m.armR.rotation.x = -2.6 + Math.sin(t * Math.PI) * 0.4 + t * 2.4;
      m.armR.rotation.z = 0.2;
      m.body.rotation.y = Math.sin(t * Math.PI) * -0.35;
    } else { m.armR.rotation.z = 0; m.body.rotation.y = 0; }
    if (this.aiming > 0 || (this.tool && this.tool.kind === 'arc' && input.held.aim)) { m.armR.rotation.x = -1.5; m.armL.rotation.x = -1.5; m.armL.rotation.z = -0.3; }
    else m.armL.rotation.z = 0;
    if (this.tool && this.tool.kind === 'lumiere' && this.swing <= 0) m.armR.rotation.x = -0.9;
    if (this.sleeping) { m.body.rotation.x = -Math.PI / 2; m.body.position.y = 0.6; }
    if (this.dead) { m.body.rotation.z = Math.PI / 2; m.body.position.y = 0.3; }
    m.head.rotation.x = this.view === 3 ? clamp(-this.pitch * 0.4, -0.4, 0.4) : 0;
    const vis = this.view === 3 || this.dead || this.sleeping;
    m.group.visible = vis;
  }

  updateHeld() {
    const s = this.selected;
    const id = s ? (ITEMS[s.id].held || (ITEMS[s.id].tool ? 'item' : null)) : null;
    if (id !== this.heldId) {
      this.heldId = id;
      if (this.heldMesh) { this.heldMesh.parent.remove(this.heldMesh); this.heldMesh = null; }
      if (this.viewMesh) { this.viewRoot.remove(this.viewMesh); this.viewMesh = null; }
      if (id && HELD[id]) {
        const geo = HELD[id]();
        this.heldMesh = new THREE.Mesh(geo, MAT.vc); this.heldMesh.castShadow = true;
        this.heldMesh.rotation.x = Math.PI / 2; this.heldMesh.position.set(0, 0, -0.05);
        this.model.hand.add(this.heldMesh);
        this.viewMesh = new THREE.Mesh(geo, MAT.vc);
        this.viewRoot.add(this.viewMesh);
      }
    }
    // vue 1re personne : l'objet en bas à droite, qui se balance
    this.viewRoot.visible = this.view === 1 && !this.dead && !this.sleeping;
    if (this.viewMesh) {
      const bob = Math.sin(this.anim * 0.9) * 0.02 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 3);
      const sw = this.swing > 0 ? Math.sin((1 - this.swing / this.swingDur) * Math.PI) : 0;
      this.viewMesh.position.set(0.32, -0.42 + bob - sw * 0.1, -0.55 - sw * 0.2);
      this.viewMesh.rotation.set(-0.35 - sw * 1.4, -0.25, 0.15);
      if (this.tool && this.tool.kind === 'arc') this.viewMesh.rotation.set(0, -0.2, -0.3);
    }
    // lumière portée
    const t = this.tool;
    const lit = t && t.kind === 'lumiere';
    this.light.intensity = lerp(this.light.intensity, lit ? (t.light > 15 ? 26 : 16) : 0, 0.2);
    this.light.distance = lit ? t.light : 1;
    if (lit) {
      this.light.position.set(this.pos.x + Math.sin(this.facing) * 0.5, this.pos.y + 1.9, this.pos.z + Math.cos(this.facing) * 0.5);
      if (t.fire && Math.random() < 0.6) {
        const h = new THREE.Vector3(); (this.view === 1 ? this.viewMesh : this.heldMesh)?.getWorldPosition(h);
        if (this.view === 1) { this.cam.getWorldDirection(_v); h.copy(this.cam.position).addScaledVector(_v, 0.6).add(_t.set(0, -0.15, 0)); }
        FX.flame(h.x, h.y + 0.3, h.z, 0.35);
      }
      this.light.intensity *= 0.9 + Math.random() * 0.15;
    }
  }

  updateCamera(dt) {
    const cam = this.cam;
    const head = _v.set(this.pos.x, this.pos.y + (this.swimming ? 1.25 : this.sleeping ? 0.8 : 1.62), this.pos.z);
    cam.rotation.order = 'YXZ';
    if (this.view === 1 && !this.dead) {
      cam.position.lerp(head, Math.min(1, dt * 30));
      cam.position.copy(head);
      cam.rotation.set(this.pitch, this.yaw, 0);
    } else {
      const d = this.dead ? 6 : this.camDist;
      const dir = _t.set(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(this.dead ? 0 : 0.55);
      let dd = d;
      // éviter que la caméra passe sous le relief
      for (let k = 0; k < 6; k++) {
        const px = head.x + dir.x * dd + side.x, pz = head.z + dir.z * dd + side.z, py = head.y + dir.y * dd + 0.75;
        let inTree = false;
        if (G.flora) G.flora.query(px, pz, 3, (n) => { if (!inTree && n.st === 0 && (n.k === 'chene' || n.k === 'sapin') && Math.hypot(n.x - px, n.z - pz) < 2.3 * n.s && py > n.y + 2.2 && py < n.y + 7.5 * n.s) inTree = true; });
        if (py > G.terrain.heightAt(px, pz) + 0.35 && !inTree) break;
        dd *= 0.72;
      }
      const target = this.camPos.set(head.x + dir.x * dd + side.x, head.y + dir.y * dd + 0.75, head.z + dir.z * dd + side.z);
      cam.position.lerp(target, Math.min(1, dt * 18));
      const gh = G.terrain.heightAt(cam.position.x, cam.position.z) + 0.3;
      if (cam.position.y < gh) cam.position.y = gh;
      cam.rotation.set(this.pitch, this.yaw, 0);
    }
    if (G.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * G.shake * 0.3; cam.position.y += (Math.random() - 0.5) * G.shake * 0.3;
      G.shake = Math.max(0, G.shake - dt * 2.5);
    }
    // FOV un peu plus large en sprint
    const fov = G.settings.fov + (this.sprinting ? 6 : 0) - (this.aiming > 0 ? 18 : 0);
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = lerp(cam.fov, fov, Math.min(1, dt * 8)); cam.updateProjectionMatrix(); }
  }

  // direction du regard (pour viser)
  lookDir(out = new THREE.Vector3()) { return this.cam.getWorldDirection(out); }
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  setGear() {
    const g = this.model.gear;
    for (const slot of ['tete', 'corps', 'jambes']) {
      const s = this.equip[slot], w = s ? ITEMS[s.id].wear : null;
      const meshes = slot === 'jambes' ? [g.jl, g.jr] : [g[slot]];
      meshes.forEach((m) => { m.visible = !!w; if (w) m.material = new THREE.MeshLambertMaterial({ color: w.color, flatShading: true }); });
    }
  }

  save() { return { p: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, s: this.stats, fx: this.fx, eq: this.equip, hb: this.hotbar, sp: this.spawn, view: this.view }; }
  load(o) {
    this.pos.set(...o.p); this.yaw = o.yaw || 0; Object.assign(this.stats, o.s); this.fx = o.fx || {};
    this.equip = Object.assign({ tete: null, corps: null, jambes: null }, o.eq); this.hotbar = o.hb || 0; this.spawn = o.sp || null; this.view = o.view || 3;
    this.setGear();
  }
}
