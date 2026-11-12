// Recettes de fabrication. station : 'main' (n'importe où), 'etabli', 'feu' (feu allumé), 'forge'.
// give : objets rendus en plus (ex. la gourde vide). plan : recette à débloquer.
export const STATIONS = { main: 'À la main', etabli: 'Établi', feu: 'Feu de camp', forge: 'Forge' };

export const RECIPES = [
  // à la main
  { out: 'corde', n: 1, cost: { fibre: 3 }, st: 'main', cat: 'Matériaux' },
  { out: 'hache_pierre', cost: { bois: 2, silex: 2, fibre: 2 }, st: 'main', cat: 'Outils' },
  { out: 'pioche_pierre', cost: { bois: 2, pierre: 3, fibre: 2 }, st: 'main', cat: 'Outils' },
  { out: 'couteau', cost: { silex: 1, bois: 1, fibre: 1 }, st: 'main', cat: 'Outils' },
  { out: 'torche', cost: { bois: 1, fibre: 1 }, st: 'main', cat: 'Outils' },
  { out: 'canne', cost: { bois: 2, corde: 1 }, st: 'main', cat: 'Outils' },
  { out: 'gourde_vide', cost: { peau: 1, corde: 1 }, st: 'main', cat: 'Outils' },
  { out: 'lance', cost: { bois: 3, silex: 1, fibre: 2 }, st: 'main', cat: 'Armes' },
  { out: 'gourdin', cost: { bois: 4, fibre: 1 }, st: 'main', cat: 'Armes' },
  { out: 'chapeau_paille', cost: { fibre: 8 }, st: 'main', cat: 'Vêtements' },
  { out: 'bandage', cost: { fibre: 3 }, st: 'main', cat: 'Soins' },
  { out: 'cataplasme', cost: { herbe: 2, bandage: 1 }, st: 'main', cat: 'Soins' },
  { out: 'attelle', cost: { bois: 2, corde: 1 }, st: 'main', cat: 'Soins' },
  { out: 'antidote', cost: { charbon: 1, herbe: 2 }, st: 'main', cat: 'Soins' },

  // établi
  { out: 'arc', cost: { bois: 3, corde: 2 }, st: 'etabli', cat: 'Armes' },
  { out: 'fleche', n: 5, cost: { bois: 1, silex: 1, plume: 1 }, st: 'etabli', cat: 'Armes' },
  { out: 'arbalete', cost: { fer: 2, bois: 4, corde: 2 }, st: 'etabli', cat: 'Armes', plan: 'arbalete' },
  { out: 'epee', cost: { fer: 4, cuir: 1 }, st: 'etabli', cat: 'Armes' },
  { out: 'hache_fer', cost: { fer: 2, bois: 2 }, st: 'etabli', cat: 'Outils' },
  { out: 'pioche_fer', cost: { fer: 3, bois: 2 }, st: 'etabli', cat: 'Outils' },
  { out: 'lanterne', cost: { fer: 2, charbon: 2 }, st: 'etabli', cat: 'Outils', plan: 'lanterne' },
  { out: 'cuir', n: 1, cost: { peau: 2 }, st: 'etabli', cat: 'Matériaux' },
  { out: 'tunique_cuir', cost: { cuir: 3, corde: 1 }, st: 'etabli', cat: 'Vêtements' },
  { out: 'pantalon_cuir', cost: { cuir: 2, corde: 1 }, st: 'etabli', cat: 'Vêtements' },
  { out: 'bonnet_fourrure', cost: { fourrure: 1, corde: 1 }, st: 'etabli', cat: 'Vêtements' },
  { out: 'manteau_fourrure', cost: { fourrure: 3, cuir: 1, corde: 2 }, st: 'etabli', cat: 'Vêtements' },
  { out: 'jambieres_fourrure', cost: { fourrure: 2, corde: 1 }, st: 'etabli', cat: 'Vêtements' },
  { out: 'casque_fer', cost: { fer: 3, cuir: 1 }, st: 'etabli', cat: 'Vêtements' },
  { out: 'jambieres_fer', cost: { fer: 4, cuir: 1 }, st: 'etabli', cat: 'Vêtements' },
  { out: 'plastron_fer', cost: { fer: 6, cuir: 2 }, st: 'etabli', cat: 'Vêtements', plan: 'plastron_fer' },
  { out: 'armure_chasseur', cost: { griffe: 1, fourrure: 4, cuir: 2 }, st: 'etabli', cat: 'Vêtements' },

  // feu de camp
  { out: 'gourde_propre', cost: { gourde_sale: 1 }, st: 'feu', cat: 'Cuisine', label: 'Faire bouillir l’eau' },
  { out: 'viande_grillee', cost: { viande: 1 }, st: 'feu', cat: 'Cuisine' },
  { out: 'poisson_grille', cost: { poisson: 1 }, st: 'feu', cat: 'Cuisine' },
  { out: 'oeuf_cuit', cost: { oeuf: 1 }, st: 'feu', cat: 'Cuisine' },
  { out: 'courge_rotie', cost: { courge: 1 }, st: 'feu', cat: 'Cuisine' },
  { out: 'pain', cost: { ble: 3, gourde_propre: 1 }, give: { gourde_vide: 1 }, st: 'feu', cat: 'Cuisine' },
  { out: 'ragout', cost: { viande: 1, carotte: 1, gourde_propre: 1 }, give: { gourde_vide: 1 }, st: 'feu', cat: 'Cuisine' },
  { out: 'soupe', cost: { carotte: 2, champignon: 1, gourde_propre: 1 }, give: { gourde_vide: 1 }, st: 'feu', cat: 'Cuisine' },
  { out: 'tisane', cost: { herbe: 1, ecorce: 1, gourde_propre: 1 }, give: { gourde_vide: 1 }, st: 'feu', cat: 'Soins' },
  { out: 'charbon', n: 2, cost: { bois: 3 }, st: 'feu', cat: 'Matériaux' },

  // forge
  { out: 'fer', cost: { minerai: 2, charbon: 1 }, st: 'forge', cat: 'Matériaux' },
  { out: 'fer', cost: { ferraille: 2 }, st: 'forge', cat: 'Matériaux', label: 'Refondre la ferraille' },
];
RECIPES.forEach((r, i) => (r.i = i));
