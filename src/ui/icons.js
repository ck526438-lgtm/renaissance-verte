import { ITEMS } from '../game/items.js';
import { BUILDS } from '../game/buildings.js';

// Icônes dessinées en code (pas d'émojis : elles s'affichent pareil partout).
const cache = {};
const S = 64;

function P(g) {
  const o = {
    g,
    fill(c) { g.fillStyle = c; return o; },
    stroke(c, w = 3) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; return o; },
    circ(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); return o; },
    ell(x, y, rx, ry, a = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill(); return o; },
    rect(x, y, w, h, r = 3) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); return o; },
    poly(pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); return o; },
    line(pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); return o; },
  };
  return o;
}

const D = {
  log: (p) => { p.fill('#8a5d38').rect(8, 22, 46, 20, 9).fill('#c9a273').ell(50, 32, 7, 10).fill('#a87648').ell(50, 32, 3, 5); },
  stone: (p) => { p.fill('#8a857a').poly([[12, 44], [18, 22], [36, 16], [52, 28], [50, 46], [28, 52]]).fill('#a8a296').poly([[18, 22], [36, 16], [40, 26], [24, 30]]); },
  flint: (p) => { p.fill('#4a5058').poly([[14, 46], [30, 12], [50, 40], [34, 52]]).fill('#6a7480').poly([[30, 12], [36, 34], [22, 40]]); },
  fibre: (p) => { p.stroke('#8ab04c', 3); for (let i = 0; i < 6; i++) p.line([[16 + i * 6, 52], [24 + i * 4, 12]]); p.stroke('#c9a24a', 4).line([[14, 36], [50, 36]]); },
  rope: (p) => { p.stroke('#c9a273', 6); p.g.beginPath(); p.g.arc(32, 32, 16, 0.3, Math.PI * 1.9); p.g.stroke(); p.stroke('#8a6a3a', 2); p.g.beginPath(); p.g.arc(32, 32, 16, 0.3, Math.PI * 1.9); p.g.stroke(); },
  hide: (p) => { p.fill('#b08a5a').poly([[10, 20], [22, 12], [42, 12], [54, 20], [50, 46], [40, 54], [24, 54], [14, 46]]).fill('#c8a070').ell(32, 32, 12, 14); },
  leather: (p) => { p.fill('#7a4a2a').rect(12, 16, 40, 32, 6).stroke('#c9a273', 2).line([[16, 20], [48, 20], [48, 44], [16, 44], [16, 20]]); },
  fur: (p) => { p.fill('#8a7a6a').poly([[8, 22], [20, 12], [44, 12], [56, 22], [52, 48], [32, 56], [12, 48]]); p.stroke('#b0a090', 2); for (let i = 0; i < 6; i++) p.line([[16 + i * 6, 20], [14 + i * 6, 44]]); },
  feather: (p) => { p.fill('#efe6d2').ell(32, 30, 8, 20, 0.5).stroke('#8a8070', 2).line([[22, 52], [42, 10]]); },
  bone: (p) => { p.fill('#e8e2d2').rect(18, 28, 28, 8, 4).circ(18, 28, 6).circ(18, 37, 6).circ(46, 28, 6).circ(46, 37, 6); },
  ore: (p) => { D.stone(p); p.fill('#d47a3a').circ(26, 34, 5).circ(40, 26, 4).circ(38, 42, 3.5); },
  ingot: (p) => { p.fill('#9aa2aa').poly([[10, 42], [18, 24], [52, 24], [56, 42]]).fill('#c8d0d8').poly([[18, 24], [52, 24], [48, 30], [22, 30]]); },
  coal: (p) => { p.fill('#2a2622').poly([[12, 44], [20, 22], [38, 18], [52, 32], [46, 48], [26, 52]]).fill('#4a4440').poly([[20, 22], [38, 18], [34, 30]]); },
  scrap: (p) => { p.fill('#7a776e').rect(12, 28, 24, 18, 2).fill('#a8562c').rect(30, 16, 22, 16, 2).fill('#5d6066').rect(22, 38, 26, 10, 2); },
  rot: (p) => { p.fill('#5a5a2a').ell(32, 38, 20, 14).fill('#7a7a3a').circ(24, 34, 5).fill('#3a3a1a').circ(40, 40, 4); p.stroke('#8a9a4a', 2).line([[26, 18], [28, 10]]).line([[36, 20], [40, 12]]); },
  compost: (p) => { p.fill('#4a3322').ell(32, 40, 22, 12).fill('#6a4a2a').ell(32, 34, 16, 10).fill('#7cbf4a').circ(26, 28, 3).circ(38, 30, 3); },
  berry: (p) => { p.fill('#d8344a').circ(24, 36, 9).circ(40, 36, 9).circ(32, 24, 9).fill('#ff8a9a').circ(21, 33, 2.5).circ(37, 33, 2.5).circ(29, 21, 2.5).fill('#4f8f3a').ell(32, 12, 8, 3); },
  darkberry: (p) => { p.fill('#3a1f5a').circ(24, 36, 9).circ(40, 36, 9).circ(32, 24, 9).fill('#7a5a9a').circ(21, 33, 2.5).circ(37, 33, 2.5).circ(29, 21, 2.5).fill('#4f8f3a').ell(32, 12, 8, 3); },
  mush: (p) => { p.fill('#efe6d2').rect(26, 32, 12, 20, 4).fill('#8a5a32').ell(32, 30, 20, 12); },
  amanite: (p) => { p.fill('#efe6d2').rect(26, 32, 12, 20, 4).fill('#c8322a').ell(32, 30, 20, 12).fill('#fff').circ(24, 26, 3).circ(36, 24, 3).circ(42, 31, 2.5); },
  carrot: (p) => { p.fill('#e07a2a').poly([[22, 22], [42, 22], [32, 58]]).fill('#5f9e3b').poly([[28, 22], [24, 6], [32, 18], [38, 6], [36, 22]]); },
  wheat: (p) => { p.stroke('#c9a24a', 3).line([[32, 56], [32, 14]]); p.fill('#e6c662'); for (let i = 0; i < 4; i++) { p.ell(26, 18 + i * 8, 5, 3, -0.5); p.ell(38, 18 + i * 8, 5, 3, 0.5); } p.ell(32, 12, 3, 5); },
  squash: (p) => { p.fill('#e08a2a').ell(32, 38, 22, 16).fill('#f0a040').ell(26, 36, 6, 14).ell(38, 36, 6, 14).fill('#5a7a2a').rect(29, 14, 6, 10, 2); },
  squash2: (p) => { D.squash(p); p.fill('rgba(120,60,20,0.45)').ell(32, 40, 20, 12); },
  egg: (p) => { p.fill('#f2ece0').ell(32, 34, 14, 18).fill('#fffaf0').ell(27, 28, 4, 6); },
  egg2: (p) => { p.fill('#fff').ell(32, 34, 22, 16).fill('#f2b830').circ(32, 34, 8); },
  meat: (p) => { p.fill('#c8504a').ell(30, 34, 20, 15, -0.4).fill('#e8908a').ell(26, 30, 7, 5).fill('#efe6d2').rect(44, 20, 10, 6, 3); },
  cooked: (p) => { p.fill('#8a4a2a').ell(30, 34, 20, 15, -0.4).fill('#b8703a').ell(26, 30, 8, 5).fill('#efe6d2').rect(44, 20, 10, 6, 3); },
  fish: (p) => { p.fill('#7a9aaa').ell(30, 32, 20, 10).poly([[48, 32], [58, 22], [58, 42]]).fill('#222').circ(18, 30, 2); },
  cookfish: (p) => { p.fill('#b8803a').ell(30, 32, 20, 10).poly([[48, 32], [58, 22], [58, 42]]).fill('#6a3a1a').rect(22, 26, 3, 12).rect(30, 26, 3, 12).rect(38, 26, 3, 12); },
  smokefish: (p) => { D.cookfish(p); p.fill('rgba(60,40,30,0.4)').ell(30, 32, 20, 10); },
  stew: (p) => { p.fill('#5a3a2a').ell(32, 38, 22, 14).fill('#a8582a').ell(32, 34, 18, 8).fill('#e07a2a').circ(26, 33, 3).fill('#c8504a').circ(36, 34, 3); p.stroke('#ddd', 2).line([[26, 22], [24, 14]]).line([[36, 22], [38, 12]]); },
  soup: (p) => { p.fill('#5a3a2a').ell(32, 38, 22, 14).fill('#c8a040').ell(32, 34, 18, 8).fill('#7cbf4a').circ(28, 33, 3).fill('#e07a2a').circ(38, 34, 3); },
  bread: (p) => { p.fill('#c8883a').ell(32, 36, 24, 14).fill('#e0a85a').ell(32, 32, 20, 10); p.stroke('#9a5a2a', 2).line([[22, 28], [26, 36]]).line([[32, 26], [34, 36]]).line([[42, 28], [42, 36]]); },
  jerky: (p) => { p.fill('#6a2a1a').poly([[14, 20], [30, 14], [50, 30], [48, 44], [26, 48], [12, 34]]).fill('#8a3a24').poly([[18, 22], [30, 18], [40, 28], [24, 32]]); },
  dryberry: (p) => { p.fill('#7a2a3a').circ(22, 38, 7).circ(36, 40, 7).circ(30, 26, 7).circ(44, 28, 6); },
  can: (p) => { p.fill('#8b8577').rect(18, 14, 28, 40, 4).fill('#d8644a').rect(18, 24, 28, 18, 0).fill('#f2c866').rect(26, 28, 12, 8, 2); },
  tea: (p) => { p.fill('#e8e2d2').rect(16, 24, 28, 26, 6).fill('#a87a3a').rect(19, 27, 22, 8, 3); p.stroke('#e8e2d2', 4).line([[44, 30], [52, 34], [44, 42]]); p.stroke('#ddd', 2).line([[26, 18], [24, 10]]).line([[34, 18], [36, 8]]); },
  flask0: (p) => { p.fill('#8a5a32').ell(32, 38, 16, 18).fill('#5a3a1a').rect(27, 10, 10, 10, 2).fill('#a87648').ell(28, 34, 5, 8); },
  flask1: (p) => { D.flask0(p); p.fill('#7a8a5a').ell(32, 42, 12, 10); },
  flask2: (p) => { D.flask0(p); p.fill('#5ab0e0').ell(32, 42, 12, 10).fill('#bfe8ff').ell(28, 40, 3, 4); },
  herb: (p) => { p.stroke('#5a8a3a', 3).line([[32, 56], [32, 18]]); p.fill('#6fa04a').ell(24, 40, 8, 3, -0.5).ell(40, 34, 8, 3, 0.5).ell(24, 28, 7, 3, -0.5); p.fill('#f4f1e0').circ(28, 14, 4).circ(36, 14, 4).circ(32, 9, 4); },
  bark: (p) => { p.fill('#6a4a2f').poly([[18, 10], [44, 14], [48, 54], [16, 50]]).stroke('#4a3020', 2).line([[24, 16], [26, 46]]).line([[34, 16], [36, 48]]).line([[42, 20], [42, 48]]); },
  bandage: (p) => { p.fill('#efe6d2').rect(10, 24, 44, 16, 4).fill('#d8d0bc').rect(26, 24, 12, 16, 0).fill('#d83a3a').rect(29, 28, 6, 8, 1); },
  poultice: (p) => { D.bandage(p); p.fill('#6fa04a').ell(32, 32, 8, 5); },
  splint: (p) => { p.fill('#9a6b42').rect(12, 14, 8, 38, 2).rect(44, 14, 8, 38, 2).fill('#c9a273').rect(10, 22, 44, 5, 2).rect(10, 40, 44, 5, 2); },
  antidote: (p) => { p.fill('#5a8a6a').rect(22, 20, 20, 32, 6).fill('#8ad0a0').rect(25, 30, 14, 18, 4).fill('#8a6a4a').rect(26, 12, 12, 10, 2); },
  medkit: (p) => { p.fill('#e8e2d2').rect(10, 18, 44, 34, 6).fill('#d83a3a').rect(28, 24, 8, 22, 1).rect(21, 31, 22, 8, 1).fill('#8a8070').rect(24, 12, 16, 8, 3); },
  seed: (p) => { p.fill('#c8b060'); [[22, 30], [34, 24], [42, 36], [28, 42], [36, 46], [20, 44]].forEach(([x, y]) => p.ell(x, y, 4, 6, 0.6)); },
  seed2: (p) => { p.fill('#8a6a3a'); [[22, 30], [34, 24], [42, 36], [28, 42], [36, 46], [20, 44]].forEach(([x, y]) => p.ell(x, y, 3, 4, 0.6)); p.fill('#e07a2a').circ(48, 16, 6); },
  seed3: (p) => { p.fill('#efe0a0'); [[22, 30], [34, 24], [42, 36], [28, 42], [36, 46]].forEach(([x, y]) => p.ell(x, y, 4, 7, 0.4)); p.fill('#e08a2a').circ(48, 16, 6); },
  axe: (p) => { p.stroke('#6b4a2f', 5).line([[18, 56], [40, 12]]); p.fill('#7e796f').poly([[34, 10], [54, 14], [52, 30], [38, 24]]); },
  axe2: (p) => { p.stroke('#6b4a2f', 5).line([[18, 56], [40, 12]]); p.fill('#b8bec6').poly([[34, 8], [56, 10], [54, 32], [38, 24]]).fill('#e0e6ee').poly([[52, 10], [56, 10], [54, 32], [50, 30]]); },
  pick: (p) => { p.stroke('#6b4a2f', 5).line([[20, 56], [36, 16]]); p.stroke('#7e796f', 7).line([[12, 18], [36, 12], [56, 24]]); },
  pick2: (p) => { p.stroke('#6b4a2f', 5).line([[20, 56], [36, 16]]); p.stroke('#b8bec6', 7).line([[10, 20], [36, 12], [58, 26]]); },
  knife: (p) => { p.fill('#5a3d26').rect(14, 40, 10, 16, 3).fill('#4a5058').poly([[18, 40], [26, 40], [46, 8], [42, 6]]); },
  spear: (p) => { p.stroke('#9a6b42', 4).line([[10, 58], [48, 14]]); p.fill('#7e796f').poly([[44, 18], [58, 4], [52, 22]]); },
  club: (p) => { p.stroke('#9a6b42', 6).line([[16, 56], [34, 26]]); p.fill('#6b4a2f').ell(40, 18, 12, 10, -0.6); },
  bow: (p) => { p.stroke('#9a6b42', 4); p.g.beginPath(); p.g.arc(14, 32, 26, -1.2, 1.2); p.g.stroke(); p.stroke('#eee', 1.5).line([[23, 8], [23, 56]]); },
  arrow: (p) => { p.stroke('#c9a273', 3).line([[12, 52], [50, 14]]); p.fill('#7e796f').poly([[46, 10], [56, 8], [54, 18]]); p.fill('#e0674c').poly([[10, 46], [18, 54], [12, 56], [8, 50]]); },
  sword: (p) => { p.fill('#d8dee6').poly([[30, 40], [34, 40], [36, 6], [32, 2], [28, 6]]).fill('#8a8f96').rect(20, 40, 24, 5, 2).fill('#5a3d26').rect(29, 45, 6, 14, 2); },
  crossbow: (p) => { p.fill('#6b4a2f').rect(28, 14, 8, 44, 2); p.stroke('#6e7378', 5); p.g.beginPath(); p.g.arc(32, 32, 22, Math.PI * 1.15, Math.PI * 1.85); p.g.stroke(); p.stroke('#eee', 1.5).line([[13, 22], [32, 30], [51, 22]]); },
  torch: (p) => { p.stroke('#6b4a2f', 5).line([[26, 58], [36, 26]]); p.fill('#f0903a').ell(37, 18, 9, 13).fill('#ffe08a').ell(37, 21, 4, 7); },
  lantern: (p) => { p.fill('#3d3f4a').rect(20, 12, 24, 6, 2).rect(18, 46, 28, 8, 2).fill('#f2c866').rect(22, 18, 20, 28, 4).fill('#fff6d8').rect(28, 24, 8, 16, 3).stroke('#3d3f4a', 3).line([[26, 12], [32, 4], [38, 12]]); },
  rod: (p) => { p.stroke('#9a6b42', 3).line([[10, 58], [52, 8]]); p.stroke('#ddd', 1).line([[52, 8], [56, 40]]); p.fill('#e04a3a').circ(56, 42, 3); p.fill('#5b5f66').circ(18, 50, 4); },
  hat: (p) => { p.fill('#d6b45a').ell(32, 40, 26, 8).fill('#e0c06a').ell(32, 30, 14, 12).fill('#8a5a32').rect(18, 34, 28, 4, 1); },
  furhat: (p) => { p.fill('#8a7a6a').ell(32, 34, 18, 16).fill('#b0a090').rect(12, 38, 40, 10, 5); },
  helmet: (p) => { p.fill('#9aa2aa').ell(32, 34, 20, 18).fill('#7a8288').rect(10, 38, 44, 8, 3).fill('#c8d0d8').ell(26, 26, 5, 6); },
  tunic: (p) => { p.fill('#8a5a32').poly([[18, 12], [26, 16], [38, 16], [46, 12], [56, 24], [48, 30], [46, 54], [18, 54], [16, 30], [8, 24]]); },
  coat: (p) => { p.fill('#8a7a6a').poly([[18, 10], [26, 14], [38, 14], [46, 10], [58, 26], [48, 32], [48, 56], [16, 56], [16, 32], [6, 26]]).fill('#b0a090').rect(29, 14, 6, 42, 2); },
  plate: (p) => { p.fill('#a8b0b8').poly([[16, 12], [26, 16], [38, 16], [48, 12], [52, 30], [46, 52], [18, 52], [12, 30]]).fill('#c8d0d8').rect(24, 22, 16, 22, 4); },
  hunter: (p) => { p.fill('#4a3528').poly([[18, 10], [26, 14], [38, 14], [46, 10], [58, 26], [48, 32], [48, 56], [16, 56], [16, 32], [6, 26]]).fill('#e8e2d2').poly([[24, 20], [28, 30], [24, 34]]).poly([[40, 20], [36, 30], [40, 34]]); },
  pants: (p) => { p.fill('#7a5030').poly([[18, 10], [46, 10], [48, 56], [36, 56], [32, 26], [28, 56], [16, 56]]); },
  furpants: (p) => { p.fill('#8a7a6a').poly([[18, 10], [46, 10], [48, 56], [36, 56], [32, 26], [28, 56], [16, 56]]); },
  ironpants: (p) => { p.fill('#9aa2aa').poly([[18, 10], [46, 10], [48, 56], [36, 56], [32, 26], [28, 56], [16, 56]]); },
  claw: (p) => { p.fill('#e8e2d2').poly([[16, 50], [24, 20], [40, 8], [32, 30], [30, 52]]).poly([[34, 52], [42, 26], [54, 18], [46, 38], [44, 54]]); },
  fang: (p) => { p.fill('#f2ece0').poly([[22, 12], [42, 12], [34, 56]]).fill('#c8c0b0').poly([[30, 12], [42, 12], [34, 56]]); },
  plan: (p) => { p.fill('#2f5f8a').rect(10, 12, 44, 40, 3).stroke('#8fd6e8', 2).line([[16, 22], [46, 22]]).line([[16, 30], [36, 30]]).line([[16, 38], [42, 38]]).line([[16, 46], [30, 46]]); },
  bag: (p) => { p.fill('#7a5a3a').rect(14, 20, 36, 34, 8).fill('#5a3f2a').rect(14, 20, 36, 12, 6).fill('#c9a24a').rect(28, 28, 8, 6, 1); },
};

// icônes des bâtiments
const BUILD_ICON = {
  feu: (p) => { p.fill('#8a857a').ell(32, 48, 22, 8).fill('#f0903a').poly([[20, 46], [26, 20], [32, 32], [38, 14], [44, 46]]).fill('#ffe08a').poly([[26, 46], [32, 30], [38, 46]]); },
  etabli: (p) => { p.fill('#9a6b42').rect(8, 26, 48, 8, 2).fill('#6b4a2f').rect(12, 34, 6, 20, 1).rect(46, 34, 6, 20, 1).fill('#8a8f96').rect(30, 18, 16, 8, 2); },
  forge: (p) => { p.fill('#8f8a80').rect(10, 24, 40, 30, 3).rect(34, 6, 12, 20, 2).fill('#f0903a').rect(20, 36, 16, 10, 2); },
  sechoir: (p) => { p.fill('#6b4a2f').rect(10, 12, 4, 44, 1).rect(50, 12, 4, 44, 1).rect(10, 14, 44, 4, 1).fill('#a8463c').rect(18, 18, 8, 14, 2).rect(30, 18, 8, 16, 2).rect(42, 18, 6, 12, 2); },
  coffre: (p) => { p.fill('#9a6b42').rect(10, 24, 44, 28, 3).fill('#6b4a2f').rect(10, 16, 44, 12, 4).fill('#c9a24a').rect(28, 28, 8, 8, 1); },
  lit: (p) => { p.fill('#6b4a2f').rect(6, 36, 52, 12, 2).fill('#c9b79a').rect(8, 30, 48, 8, 2).fill('#7a4a3a').rect(24, 28, 32, 10, 2).fill('#eee4cf').rect(10, 26, 12, 8, 3); },
  torche: (p) => { p.stroke('#6b4a2f', 5).line([[32, 60], [32, 24]]); p.fill('#f0903a').ell(32, 16, 8, 12).fill('#ffe08a').ell(32, 19, 3, 6); },
  collecteur: (p) => { p.fill('#9a6b42').rect(18, 30, 28, 26, 4).fill('#c8c2a8').poly([[8, 22], [56, 22], [40, 32], [24, 32]]).fill('#5ab0e0').rect(22, 34, 20, 4, 1); },
  sol: (p) => { p.fill('#9a6b42'); for (let i = 0; i < 5; i++) p.rect(8 + i * 10, 14, 8, 36, 1); },
  mur: (p) => { for (let i = 0; i < 5; i++) p.fill(i % 2 ? '#8a5d38' : '#a87648').rect(6, 12 + i * 8, 52, 8, 4); },
  porte: (p) => { p.fill('#6b4a2f').rect(8, 10, 8, 46, 2).rect(48, 10, 8, 46, 2).rect(8, 8, 48, 8, 2); },
  toit: (p) => { p.fill('#c9a44a').poly([[4, 44], [32, 14], [60, 44]]).fill('#b8933e').poly([[32, 14], [60, 44], [46, 44]]); },
  cloture: (p) => { p.fill('#6b4a2f').rect(10, 18, 5, 36).rect(30, 18, 5, 36).rect(50, 18, 5, 36).fill('#9a6b42').rect(6, 26, 52, 5, 2).rect(6, 40, 52, 5, 2); },
  pieux: (p) => { p.fill('#9a6b42'); for (let i = 0; i < 5; i++) p.poly([[8 + i * 11, 56], [13 + i * 11, 12], [18 + i * 11, 56]]); },
  parcelle: (p) => { p.fill('#5a3f2a').rect(6, 24, 52, 28, 3).fill('#7cbf4a'); for (let i = 0; i < 3; i++) p.poly([[14 + i * 16, 36], [18 + i * 16, 16], [22 + i * 16, 36]]); },
  epouvantail: (p) => { p.stroke('#6b4a2f', 4).line([[32, 60], [32, 14]]).line([[12, 26], [52, 26]]); p.fill('#7a5a8a').rect(22, 24, 20, 20, 3).fill('#d6c48a').circ(32, 14, 7).fill('#b8933e').poly([[22, 10], [32, 2], [42, 10]]); },
  poulailler: (p) => { p.fill('#9a6b42').rect(10, 26, 44, 26, 3).fill('#b8933e').poly([[6, 28], [32, 10], [58, 28]]).fill('#2a2018').rect(36, 34, 10, 12, 2).fill('#f2ece0').circ(20, 44, 5); },
};

function draw(fn) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowOffsetY = 2; g.shadowBlur = 2;
  fn(P(g));
  return c.toDataURL();
}

export function itemIcon(id) {
  if (cache[id]) return cache[id];
  const it = ITEMS[id];
  const fn = (it && D[it.icon]) || D.bag;
  return (cache[id] = draw(fn));
}
export function buildIcon(k) {
  const key = 'b:' + k;
  if (cache[key]) return cache[key];
  return (cache[key] = draw(BUILD_ICON[k] || D.bag));
}
export { BUILDS };
