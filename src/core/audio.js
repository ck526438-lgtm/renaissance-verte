import { G } from './state.js';

// Sons synthétisés (aucun fichier audio) : bruitages, ambiance de nature, pluie, vent, feu, musique douce.
export class Audio {
  constructor() { this.ctx = null; this.amb = {}; this.musicT = 0; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
    this.ambBus = this.ctx.createGain(); this.ambBus.connect(this.master);
    this.musBus = this.ctx.createGain(); this.musBus.connect(this.master);
    const n = this.ctx.sampleRate * 2; const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    // pistes d'ambiance en boucle
    this.amb.rain = this.loopNoise('bandpass', 1600, 0.6);
    this.amb.wind = this.loopNoise('lowpass', 420, 1);
    this.amb.fire = this.loopNoise('bandpass', 900, 3);
    this.amb.water = this.loopNoise('lowpass', 700, 0.8);
    this.setVolume();
  }
  setVolume() {
    if (!this.ctx) return;
    this.master.gain.value = G.settings.volume;
    this.musBus.gain.value = G.settings.music * 0.5;
  }
  loopNoise(type, freq, q) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(this.ambBus); s.start();
    return { g, f };
  }
  tone(freq, dur, { type = 'sine', gain = 0.2, to = null, at = 0, bus = null, attack = 0.005 } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  burst(dur, { freq = 1200, type = 'bandpass', gain = 0.3, q = 1, at = 0, to = null } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  play(name, opt = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    let v = opt.v ?? 1;
    if (opt.x !== undefined && G.player) {
      const d = Math.hypot(opt.x - G.player.pos.x, opt.z - G.player.pos.z);
      v *= Math.max(0, 1 - d / (opt.range || 40));
      if (v < 0.02) return;
    }
    const r = 0.9 + Math.random() * 0.2;
    switch (name) {
      case 'chop': this.burst(0.12, { freq: 900 * r, gain: 0.35 * v, q: 2 }); this.tone(140 * r, 0.12, { type: 'triangle', gain: 0.25 * v, to: 90 }); break;
      case 'mine': this.burst(0.08, { freq: 3200 * r, gain: 0.3 * v, q: 4 }); this.tone(620 * r, 0.1, { type: 'square', gain: 0.06 * v, to: 400 }); break;
      case 'thud': this.tone(80, 0.5, { type: 'sine', gain: 0.5 * v, to: 40 }); this.burst(0.5, { freq: 300, gain: 0.3 * v, type: 'lowpass' }); break;
      case 'pick': this.tone(520 * r, 0.06, { type: 'triangle', gain: 0.15 * v }); this.tone(780 * r, 0.08, { type: 'triangle', gain: 0.12 * v, at: 0.05 }); break;
      case 'swing': this.burst(0.14, { freq: 1800, gain: 0.12 * v, q: 0.7, to: 600 }); break;
      case 'hit': this.burst(0.08, { freq: 700, gain: 0.35 * v, q: 1.5 }); this.tone(180 * r, 0.1, { type: 'square', gain: 0.1 * v, to: 90 }); break;
      case 'hurt': this.tone(260, 0.18, { type: 'sawtooth', gain: 0.12 * v, to: 150 }); this.burst(0.12, { freq: 1500, gain: 0.15 * v }); break;
      case 'eat': for (let i = 0; i < 3; i++) this.burst(0.06, { freq: 2200, gain: 0.12 * v, q: 3, at: i * 0.11 }); break;
      case 'drink': for (let i = 0; i < 3; i++) this.tone(300 + i * 40, 0.09, { type: 'sine', gain: 0.15 * v, to: 520, at: i * 0.13 }); break;
      case 'craft': this.tone(440, 0.08, { type: 'triangle', gain: 0.12 * v }); this.tone(660, 0.12, { type: 'triangle', gain: 0.12 * v, at: 0.08 }); this.burst(0.1, { freq: 2600, gain: 0.08 * v, at: 0.02 }); break;
      case 'build': this.tone(110, 0.25, { type: 'triangle', gain: 0.3 * v, to: 70 }); this.burst(0.2, { freq: 600, gain: 0.25 * v, at: 0.05 }); break;
      case 'ui': this.tone(880, 0.05, { type: 'triangle', gain: 0.06 }); break;
      case 'bad': this.tone(220, 0.15, { type: 'square', gain: 0.06, to: 160 }); break;
      case 'quest': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', gain: 0.1, at: i * 0.1 })); break;
      case 'splash': this.burst(0.35, { freq: 900, gain: 0.3 * v, type: 'lowpass', to: 300 }); break;
      case 'step': this.burst(0.05, { freq: opt.snow ? 2600 : opt.water ? 700 : 1300, gain: (opt.snow ? 0.06 : 0.05) * v, q: 0.8 }); break;
      case 'bow': this.tone(180, 0.12, { type: 'triangle', gain: 0.18 * v, to: 90 }); this.burst(0.1, { freq: 2500, gain: 0.1 * v }); break;
      case 'arrowhit': this.burst(0.06, { freq: 1100, gain: 0.25 * v, q: 3 }); break;
      case 'howl': this.tone(320, 1.6, { type: 'sine', gain: 0.12 * v, to: 520, attack: 0.3 }); this.tone(520, 1.2, { type: 'sine', gain: 0.08 * v, to: 300, at: 1.4, attack: 0.2 }); break;
      case 'growl': this.tone(85 * r, 0.6, { type: 'sawtooth', gain: 0.12 * v, to: 60 }); this.burst(0.5, { freq: 300, gain: 0.12 * v, type: 'lowpass' }); break;
      case 'roar': this.tone(70, 1.4, { type: 'sawtooth', gain: 0.3 * v, to: 45, attack: 0.1 }); this.burst(1.2, { freq: 400, gain: 0.3 * v, type: 'lowpass', to: 150 }); break;
      case 'squeal': this.tone(900 * r, 0.25, { type: 'square', gain: 0.06 * v, to: 600 }); break;
      case 'cluck': this.tone(700 * r, 0.05, { type: 'square', gain: 0.04 * v }); this.tone(600 * r, 0.06, { type: 'square', gain: 0.04 * v, at: 0.08 }); break;
      case 'thunder': this.burst(2.8, { freq: 160, gain: 0.6 * v, type: 'lowpass', to: 60 }); this.burst(0.4, { freq: 1200, gain: 0.25 * v, type: 'lowpass' }); break;
      case 'fire': this.burst(0.5, { freq: 500, gain: 0.25 * v, type: 'lowpass' }); break;
      case 'break': this.burst(0.2, { freq: 2600, gain: 0.25 * v, q: 2 }); this.tone(400, 0.2, { type: 'square', gain: 0.05 * v, to: 150 }); break;
      case 'sleep': [392, 330, 262].forEach((f, i) => this.tone(f, 0.6, { type: 'sine', gain: 0.1, at: i * 0.25 })); break;
      case 'level': [392, 523, 659].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', gain: 0.12, at: i * 0.12 })); break;
      case 'bird': { const f0 = 2400 + Math.random() * 1600; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(f0 + Math.random() * 400, 0.07, { type: 'sine', gain: 0.03 * v, to: f0 * 1.3, at: i * 0.11 }); break; }
      case 'cricket': for (let i = 0; i < 3; i++) this.tone(4200, 0.03, { type: 'square', gain: 0.012 * v, at: i * 0.06 }); break;
      case 'reel': for (let i = 0; i < 4; i++) this.burst(0.03, { freq: 3000, gain: 0.08, at: i * 0.05 }); break;
    }
  }

  // ambiance continue
  update(dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const W = G.weather || { rain: 0, wind: 0 };
    const k = Math.min(1, dt * 2);
    const set = (a, v) => { a.g.gain.value += (v - a.g.gain.value) * k; };
    set(this.amb.rain, W.rain * (W.snow ? 0.15 : 0.5) * (G.sheltered ? 0.45 : 1));
    set(this.amb.wind, 0.04 + W.wind * 0.3);
    set(this.amb.fire, Math.min(0.5, (G.nearFire || 0) * 0.35));
    set(this.amb.water, Math.min(0.3, (G.nearWater || 0) * 0.25));
    this.amb.wind.f.frequency.value = 300 + Math.sin(G.t * 0.3) * 120 + W.wind * 200;
    // oiseaux le jour, grillons la nuit
    this.birdT = (this.birdT || 0) - dt;
    if (this.birdT <= 0) {
      this.birdT = 1.5 + Math.random() * 4;
      if (G.dayLight > 0.6 && W.rain < 0.3 && G.season !== 3) this.play('bird', { v: 0.6 + Math.random() * 0.4 });
      else if (G.dayLight < 0.2 && G.season !== 3 && W.rain < 0.3) this.play('cricket', { v: 0.8 });
    }
    this.music(dt);
  }

  // musique générative très douce (pentatonique), surtout au lever et au coucher du soleil
  music(dt) {
    if (G.settings.music <= 0) return;
    this.musicT -= dt;
    if (this.musicT > 0) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const base = [220, 196, 174.6, 164.8][G.season];
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const f = base * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12);
      this.tone(f, 2.4, { type: 'sine', gain: 0.05, at: i * 0.7, attack: 0.4, bus: this.musBus });
      if (Math.random() < 0.3) this.tone(f / 2, 3.5, { type: 'triangle', gain: 0.03, at: i * 0.7, attack: 0.8, bus: this.musBus });
    }
    this.musicT = 14 + Math.random() * 22;
  }
}
