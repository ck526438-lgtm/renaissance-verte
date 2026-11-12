// Catalogue des objets. perish = heures de jeu avant de pourrir. dur = durabilité (coups) ou secondes (lumières).
// tool : { kind: 'hache'|'pioche'|'melee'|'arc'|'arbalete'|'lumiere'|'peche', tier, dmg, reach, cd }
// eat  : { faim, soif, vie, intox (probabilité), poison, warm, cure:[états], then: objet rendu }
// wear : { slot: 'tete'|'corps'|'jambes', def, warm, cool, color }

export const ITEMS = {
  // --- ressources
  bois: { n: 'Bois', cat: 'ressource', stack: 60, icon: 'log' },
  pierre: { n: 'Pierre', cat: 'ressource', stack: 60, icon: 'stone' },
  silex: { n: 'Silex', cat: 'ressource', stack: 40, icon: 'flint' },
  fibre: { n: 'Fibre végétale', cat: 'ressource', stack: 60, icon: 'fibre' },
  corde: { n: 'Corde', cat: 'ressource', stack: 30, icon: 'rope' },
  peau: { n: 'Peau brute', cat: 'ressource', stack: 20, icon: 'hide' },
  cuir: { n: 'Cuir', cat: 'ressource', stack: 20, icon: 'leather' },
  fourrure: { n: 'Fourrure', cat: 'ressource', stack: 20, icon: 'fur' },
  plume: { n: 'Plume', cat: 'ressource', stack: 40, icon: 'feather' },
  os: { n: 'Os', cat: 'ressource', stack: 30, icon: 'bone' },
  minerai: { n: 'Minerai de fer', cat: 'ressource', stack: 40, icon: 'ore' },
  fer: { n: 'Lingot de fer', cat: 'ressource', stack: 30, icon: 'ingot' },
  charbon: { n: 'Charbon de bois', cat: 'ressource', stack: 40, icon: 'coal' },
  ferraille: { n: 'Ferraille', cat: 'ressource', stack: 30, icon: 'scrap' },
  pourri: { n: 'Nourriture pourrie', cat: 'ressource', stack: 30, icon: 'rot', desc: 'Immangeable. Le séchoir ou le compost en font de l’engrais.' },
  compost: { n: 'Compost', cat: 'ressource', stack: 20, icon: 'compost', desc: 'Sur une parcelle : les cultures poussent deux fois plus vite.' },

  // --- cueillette et récoltes
  baies: { n: 'Baies', cat: 'nourriture', stack: 30, icon: 'berry', perish: 48, eat: { faim: 6, soif: 3 } },
  baies_sombres: { n: 'Baies sombres', cat: 'nourriture', stack: 30, icon: 'darkberry', perish: 60, eat: { faim: 4, poison: 1 }, desc: 'Brillantes, sucrées… et toxiques.' },
  champignon: { n: 'Cèpe', cat: 'nourriture', stack: 20, icon: 'mush', perish: 36, eat: { faim: 8 } },
  amanite: { n: 'Amanite', cat: 'nourriture', stack: 20, icon: 'amanite', perish: 36, eat: { faim: 3, poison: 1 }, desc: 'Chapeau rouge à pois blancs : poison.' },
  carotte: { n: 'Carotte', cat: 'nourriture', stack: 30, icon: 'carrot', perish: 120, eat: { faim: 8, soif: 2 } },
  ble: { n: 'Blé', cat: 'nourriture', stack: 40, icon: 'wheat', eat: { faim: 2 }, desc: 'Se cuit en pain au feu de camp.' },
  courge: { n: 'Courge', cat: 'nourriture', stack: 10, icon: 'squash', perish: 160, eat: { faim: 14, soif: 4 } },
  oeuf: { n: 'Œuf cru', cat: 'nourriture', stack: 20, icon: 'egg', perish: 72, eat: { faim: 6, intox: 0.2 } },
  viande: { n: 'Viande crue', cat: 'nourriture', stack: 20, icon: 'meat', perish: 24, eat: { faim: 10, intox: 0.6 } },
  poisson: { n: 'Poisson cru', cat: 'nourriture', stack: 20, icon: 'fish', perish: 20, eat: { faim: 8, intox: 0.4 } },
  herbe: { n: 'Achillée', cat: 'soin', stack: 30, icon: 'herb', desc: 'Plante médicinale : arrête les saignements, entre dans les remèdes.' },
  ecorce: { n: 'Écorce de saule', cat: 'soin', stack: 30, icon: 'bark', desc: 'Fait tomber la fièvre en tisane.' },

  // --- cuisine
  viande_grillee: { n: 'Viande grillée', cat: 'nourriture', stack: 20, icon: 'cooked', perish: 60, eat: { faim: 32 } },
  poisson_grille: { n: 'Poisson grillé', cat: 'nourriture', stack: 20, icon: 'cookfish', perish: 48, eat: { faim: 26 } },
  oeuf_cuit: { n: 'Œuf cuit', cat: 'nourriture', stack: 20, icon: 'egg2', perish: 72, eat: { faim: 14 } },
  ragout: { n: 'Ragoût', cat: 'nourriture', stack: 10, icon: 'stew', perish: 40, eat: { faim: 45, soif: 15, vie: 10, warm: 6 } },
  soupe: { n: 'Soupe de légumes', cat: 'nourriture', stack: 10, icon: 'soup', perish: 36, eat: { faim: 28, soif: 22, warm: 6 } },
  pain: { n: 'Pain', cat: 'nourriture', stack: 20, icon: 'bread', perish: 120, eat: { faim: 30 } },
  courge_rotie: { n: 'Courge rôtie', cat: 'nourriture', stack: 10, icon: 'squash2', perish: 72, eat: { faim: 34, vie: 4 } },
  viande_sechee: { n: 'Viande séchée', cat: 'nourriture', stack: 30, icon: 'jerky', eat: { faim: 24, soif: -4 }, desc: 'Ne pourrit jamais.' },
  baies_sechees: { n: 'Baies séchées', cat: 'nourriture', stack: 40, icon: 'dryberry', eat: { faim: 9 }, desc: 'Ne pourrissent jamais.' },
  poisson_fume: { n: 'Poisson fumé', cat: 'nourriture', stack: 30, icon: 'smokefish', eat: { faim: 20, soif: -3 }, desc: 'Ne pourrit jamais.' },
  conserve: { n: 'Conserve', cat: 'nourriture', stack: 10, icon: 'can', eat: { faim: 38, soif: 6 }, desc: 'Le monde d’avant en boîte. Ne pourrit jamais.' },
  tisane: { n: 'Tisane de plantes', cat: 'soin', stack: 10, icon: 'tea', eat: { soif: 18, warm: 4, cure: ['fievre', 'intox'] } },

  // --- eau
  gourde_vide: { n: 'Gourde vide', cat: 'eau', stack: 5, icon: 'flask0', desc: 'Remplis-la au bord de l’eau (E).' },
  gourde_sale: { n: 'Gourde d’eau brute', cat: 'eau', stack: 5, icon: 'flask1', eat: { soif: 32, intox: 0.3, then: 'gourde_vide' }, desc: 'Fais-la bouillir au feu de camp.' },
  gourde_propre: { n: 'Gourde d’eau potable', cat: 'eau', stack: 5, icon: 'flask2', eat: { soif: 36, then: 'gourde_vide' } },

  // --- soins
  bandage: { n: 'Bandage', cat: 'soin', stack: 10, icon: 'bandage', eat: { vie: 6, cure: ['saignement'] }, verb: 'Appliquer' },
  cataplasme: { n: 'Cataplasme', cat: 'soin', stack: 10, icon: 'poultice', eat: { vie: 22, cure: ['saignement', 'infection'] }, verb: 'Appliquer' },
  attelle: { n: 'Attelle', cat: 'soin', stack: 5, icon: 'splint', eat: { cure: ['entorse'] }, verb: 'Poser' },
  antidote: { n: 'Antidote', cat: 'soin', stack: 5, icon: 'antidote', eat: { soif: 4, cure: ['poison'] }, verb: 'Boire' },
  trousse: { n: 'Trousse de secours', cat: 'soin', stack: 5, icon: 'medkit', eat: { vie: 50, cure: ['saignement', 'infection', 'entorse'] }, verb: 'Utiliser' },

  // --- graines
  graines_ble: { n: 'Graines de blé', cat: 'graine', stack: 40, icon: 'seed', crop: 'ble' },
  graines_carotte: { n: 'Graines de carotte', cat: 'graine', stack: 40, icon: 'seed2', crop: 'carotte' },
  graines_courge: { n: 'Graines de courge', cat: 'graine', stack: 40, icon: 'seed3', crop: 'courge' },

  // --- outils et armes
  hache_pierre: { n: 'Hache de pierre', cat: 'outil', stack: 1, icon: 'axe', dur: 90, held: 'hache_pierre', tool: { kind: 'hache', tier: 1, dmg: 12, reach: 2.4, cd: 0.62 } },
  pioche_pierre: { n: 'Pioche de pierre', cat: 'outil', stack: 1, icon: 'pick', dur: 90, held: 'pioche_pierre', tool: { kind: 'pioche', tier: 1, dmg: 10, reach: 2.4, cd: 0.68 } },
  couteau: { n: 'Couteau de silex', cat: 'outil', stack: 1, icon: 'knife', dur: 70, held: 'couteau', tool: { kind: 'melee', tier: 1, dmg: 10, reach: 2.0, cd: 0.4, skin: 1 }, desc: 'Dépeçage : plus de viande et de peau.' },
  lance: { n: 'Lance', cat: 'arme', stack: 1, icon: 'spear', dur: 80, held: 'lance', tool: { kind: 'melee', tier: 1, dmg: 21, reach: 3.1, cd: 0.7 } },
  gourdin: { n: 'Gourdin', cat: 'arme', stack: 1, icon: 'club', dur: 100, held: 'gourdin', tool: { kind: 'melee', tier: 1, dmg: 16, reach: 2.3, cd: 0.62, stun: 0.5 } },
  arc: { n: 'Arc', cat: 'arme', stack: 1, icon: 'bow', dur: 140, held: 'arc', tool: { kind: 'arc', tier: 1, dmg: 24, cd: 0.85, speed: 42 } },
  arbalete: { n: 'Arbalète', cat: 'arme', stack: 1, icon: 'crossbow', dur: 180, held: 'arbalete', tool: { kind: 'arc', tier: 2, dmg: 48, cd: 1.5, speed: 70 } },
  fleche: { n: 'Flèches', cat: 'munition', stack: 60, icon: 'arrow' },
  hache_fer: { n: 'Hache de fer', cat: 'outil', stack: 1, icon: 'axe2', dur: 240, held: 'hache_fer', tool: { kind: 'hache', tier: 2, dmg: 24, reach: 2.5, cd: 0.55 } },
  pioche_fer: { n: 'Pioche de fer', cat: 'outil', stack: 1, icon: 'pick2', dur: 240, held: 'pioche_fer', tool: { kind: 'pioche', tier: 2, dmg: 20, reach: 2.5, cd: 0.6 } },
  epee: { n: 'Épée de fer', cat: 'arme', stack: 1, icon: 'sword', dur: 260, held: 'epee', tool: { kind: 'melee', tier: 2, dmg: 38, reach: 2.7, cd: 0.5 } },
  torche: { n: 'Torche', cat: 'outil', stack: 5, icon: 'torch', dur: 300, durTime: true, held: 'torche', tool: { kind: 'lumiere', dmg: 8, reach: 2.2, cd: 0.6, light: 14, warm: 3, fire: true }, desc: 'Éclaire, réchauffe un peu, effraie les loups. Brûle en 5 minutes.' },
  lanterne: { n: 'Lanterne', cat: 'outil', stack: 1, icon: 'lantern', dur: 1500, durTime: true, held: 'torche', tool: { kind: 'lumiere', dmg: 4, reach: 2, cd: 0.6, light: 22, warm: 1 }, desc: 'Une grande lumière qui dure 25 minutes.' },
  canne: { n: 'Canne à pêche', cat: 'outil', stack: 1, icon: 'rod', dur: 60, held: 'canne', tool: { kind: 'peche', dmg: 2, reach: 2, cd: 0.5 }, desc: 'Face à l’eau, action : lancer la ligne.' },

  // --- vêtements et armures
  chapeau_paille: { n: 'Chapeau de paille', cat: 'vetement', stack: 1, icon: 'hat', dur: 200, wear: { slot: 'tete', def: 0, warm: 0, cool: 5, color: '#d6b45a' } },
  bonnet_fourrure: { n: 'Bonnet de fourrure', cat: 'vetement', stack: 1, icon: 'furhat', dur: 200, wear: { slot: 'tete', def: 1, warm: 4, color: '#8a7a6a' } },
  casque_fer: { n: 'Casque de fer', cat: 'vetement', stack: 1, icon: 'helmet', dur: 260, wear: { slot: 'tete', def: 6, warm: 0, color: '#9aa2aa' } },
  tunique_cuir: { n: 'Tunique de cuir', cat: 'vetement', stack: 1, icon: 'tunic', dur: 220, wear: { slot: 'corps', def: 4, warm: 3, color: '#8a5a32' } },
  manteau_fourrure: { n: 'Manteau de fourrure', cat: 'vetement', stack: 1, icon: 'coat', dur: 220, wear: { slot: 'corps', def: 2, warm: 11, color: '#8a7a6a' } },
  plastron_fer: { n: 'Plastron de fer', cat: 'vetement', stack: 1, icon: 'plate', dur: 320, wear: { slot: 'corps', def: 12, warm: -1, color: '#a8b0b8' } },
  armure_chasseur: { n: 'Armure du chasseur', cat: 'vetement', stack: 1, icon: 'hunter', dur: 400, wear: { slot: 'corps', def: 10, warm: 9, color: '#4a3528' }, desc: 'Taillée dans la peau du Grand Ours.' },
  pantalon_cuir: { n: 'Pantalon de cuir', cat: 'vetement', stack: 1, icon: 'pants', dur: 220, wear: { slot: 'jambes', def: 2, warm: 2, color: '#7a5030' } },
  jambieres_fourrure: { n: 'Jambières de fourrure', cat: 'vetement', stack: 1, icon: 'furpants', dur: 220, wear: { slot: 'jambes', def: 1, warm: 6, color: '#8a7a6a' } },
  jambieres_fer: { n: 'Jambières de fer', cat: 'vetement', stack: 1, icon: 'ironpants', dur: 300, wear: { slot: 'jambes', def: 6, warm: 0, color: '#9aa2aa' } },

  // --- trophées et plans
  griffe: { n: 'Griffe du Grand Ours', cat: 'tresor', stack: 5, icon: 'claw', desc: 'Trophée du maître de la montagne.' },
  croc: { n: 'Croc d’Alpha', cat: 'tresor', stack: 5, icon: 'fang', desc: 'Trophée du chef de meute.' },
  plan_arbalete: { n: 'Plan : arbalète', cat: 'plan', stack: 1, icon: 'plan', plan: 'arbalete', desc: 'Lis-le (action) pour apprendre la recette.' },
  plan_plastron: { n: 'Plan : plastron de fer', cat: 'plan', stack: 1, icon: 'plan', plan: 'plastron_fer', desc: 'Lis-le (action) pour apprendre la recette.' },
  plan_lanterne: { n: 'Plan : lanterne', cat: 'plan', stack: 1, icon: 'plan', plan: 'lanterne', desc: 'Lis-le (action) pour apprendre la recette.' },
};

for (const [id, it] of Object.entries(ITEMS)) it.id = id;

export function isFood(id) { return !!(ITEMS[id] && ITEMS[id].eat); }
export function itemName(id, n = 1) { const it = ITEMS[id]; return it ? it.n + (n > 1 ? ' ×' + n : '') : id; }
