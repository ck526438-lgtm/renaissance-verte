import { G } from './state.js';

// Entrées unifiées : clavier + souris, manette, écran tactile.
// déplacements par position physique (ZQSD en AZERTY = WASD en QWERTY), raccourcis par lettre
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', Tab: 'inventory', Escape: 'pause', ControlLeft: 'crouch',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Digit5: 'slot5', Digit6: 'slot6', Digit7: 'slot7', Digit8: 'slot8',
};
const LETTERS = { e: 'interact', f: 'interact', i: 'inventory', c: 'craft', b: 'build', m: 'map', r: 'rotate', g: 'drop', v: 'view', p: 'pause', h: 'help', x: 'cancel', j: 'journal' };
function keyOf(e) { return KEYMAP[e.code] || LETTERS[(e.key || '').toLowerCase()]; }

export const input = {
  held: {}, pressed: {}, released: {},
  move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, wheel: 0,
  locked: false, touchMove: { x: 0, y: 0 }, pad: null, lastDevice: 'kb',

  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      const k = keyOf(e);
      if (e.code === 'Tab' || (e.code === 'Space' && !isField(e))) e.preventDefault();
      if (isField(e)) return;
      if (k) { if (!this.held[k]) this.pressed[k] = true; this.held[k] = true; }
      this.lastDevice = 'kb';
    });
    window.addEventListener('keyup', (e) => { const k = keyOf(e); if (k) { this.held[k] = false; this.released[k] = true; } });
    window.addEventListener('blur', () => { this.held = {}; });
    canvas.addEventListener('mousedown', (e) => {
      if (G.isTouch) return;
      if (!this.locked && G.running && !G.paused && !G.uiOpen) { this.lock(); return; }
      if (e.button === 0) { this.pressed.action = true; this.held.action = true; }
      if (e.button === 2) { this.pressed.interact = true; this.held.aim = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) { this.held.action = false; this.released.action = true; } if (e.button === 2) this.held.aim = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look.x += e.movementX; this.look.y += e.movementY; this.lastDevice = 'kb';
    });
    window.addEventListener('wheel', (e) => { if (this.locked || (G.running && !G.uiOpen)) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && G.running && !G.paused && !G.uiOpen && !G.isTouch && !this.unlockQuiet) G.onUnlock && G.onUnlock();
      this.unlockQuiet = false;
    });
    window.addEventListener('gamepadconnected', () => { this.lastDevice = 'pad'; G.toast && G.toast('Manette détectée'); });
  },
  lock() { if (G.isTouch) return; try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* refusé */ } },
  unlock(quiet = true) { this.unlockQuiet = quiet; if (document.pointerLockElement) document.exitPointerLock(); },

  poll() {
    // manette (mapping standard)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p && p.connected);
    let mx = 0, my = 0;
    if (this.held.left) mx -= 1; if (this.held.right) mx += 1; if (this.held.up) my += 1; if (this.held.down) my -= 1;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      const lx = dz(gp.axes[0]), ly = dz(gp.axes[1]), rx = dz(gp.axes[2]), ry = dz(gp.axes[3]);
      if (lx || ly) { mx = lx; my = -ly; this.lastDevice = 'pad'; }
      if (rx || ry) { this.look.x += rx * 14; this.look.y += ry * 10; this.lastDevice = 'pad'; }
      const map = { 0: 'jump', 1: 'interact', 2: 'action', 3: 'inventory', 4: 'prev', 5: 'next', 6: 'aim', 7: 'action', 8: 'map', 9: 'pause', 10: 'sprint', 11: 'view', 12: 'build', 13: 'craft', 14: 'drop', 15: 'rotate' };
      const prev = this.padPrev || {};
      const now = {};
      gp.buttons.forEach((b, i) => {
        const k = map[i]; if (!k) return;
        const v = b.pressed || b.value > 0.5;
        now[k] = now[k] || v;
      });
      for (const k in now) {
        if (now[k] && !prev[k]) { this.pressed[k] = true; this.lastDevice = 'pad'; }
        if (!now[k] && prev[k]) this.released[k] = true;
        this.held[k] = now[k] || (k === 'action' ? this.held.action && !prev[k] : false);
      }
      this.padPrev = now;
      if (this.pressed.prev) this.wheel -= 1;
      if (this.pressed.next) this.wheel += 1;
    }
    if (this.touchMove.x || this.touchMove.y) { mx = this.touchMove.x; my = this.touchMove.y; }
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    this.move.x = mx; this.move.y = my;
  },
  endFrame() { this.pressed = {}; this.released = {}; this.look.x = 0; this.look.y = 0; this.wheel = 0; },
  press(k) { this.pressed[k] = true; this.held[k] = true; },
  release(k) { this.held[k] = false; this.released[k] = true; },
};
function isField(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); }
