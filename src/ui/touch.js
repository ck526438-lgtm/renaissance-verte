import { G } from '../core/state.js';
import { input } from '../core/input.js';

// Commandes tactiles : joystick, zone de regard, boutons.
export function initTouch() {
  const root = document.getElementById('touch');
  root.classList.remove('hidden');
  document.body.classList.add('touch');
  const stick = document.getElementById('stick'), knob = stick.querySelector('.knob');
  let sid = null, sx = 0, sy = 0;
  const R = 52;
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; moveStick(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) moveStick(e); });
  const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; input.touchMove.x = 0; input.touchMove.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
  function moveStick(e) {
    let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.touchMove.x = dx / R; input.touchMove.y = -dy / R;
    G.autoSprint = Math.hypot(dx, dy) / R > 0.95 && G.sprintToggle;
  }
  // regard
  const look = document.getElementById('lookZone');
  let lid = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', (e) => { lid = e.pointerId; look.setPointerCapture(lid); lx = e.clientX; ly = e.clientY; });
  look.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; input.look.x += (e.clientX - lx) * 1.6; input.look.y += (e.clientY - ly) * 1.6; lx = e.clientX; ly = e.clientY; });
  const endLook = (e) => { if (e.pointerId === lid) lid = null; };
  look.addEventListener('pointerup', endLook); look.addEventListener('pointercancel', endLook);
  // boutons
  root.querySelectorAll('.tb').forEach((b) => {
    const k = b.dataset.k;
    if (b.classList.contains('toggle')) {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); G.sprintToggle = !G.sprintToggle; b.classList.toggle('on', G.sprintToggle); if (G.sprintToggle) input.held.sprint = true; else input.held.sprint = false; });
      return;
    }
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); input.press(k); b.classList.add('on'); });
    const up = () => { input.release(k); b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  });
}
