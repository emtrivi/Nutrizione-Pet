// Dizionario dei nutrienti (appendice delle specifiche).
// Collega i nomi dei cataloghi a quelli del file FEDIAF senza rinominare i file.
// L'identificativo del motore è il nome FEDIAF quando esiste.

import type { Unit } from './types';

export type NutrientGroup =
  | 'proteine'
  | 'grassi'
  | 'minerali'
  | 'vitamine'
  | 'fibra_carboidrati_acqua';

export const GROUP_LABELS: Record<NutrientGroup, string> = {
  proteine: 'Proteine e aminoacidi',
  grassi: 'Grassi e acidi grassi',
  minerali: 'Minerali',
  vitamine: 'Vitamine',
  fibra_carboidrati_acqua: 'Fibra, carboidrati e acqua',
};

export const GROUP_ORDER: NutrientGroup[] = [
  'proteine',
  'grassi',
  'minerali',
  'vitamine',
  'fibra_carboidrati_acqua',
];

export interface NutrientDef {
  /** Identificativo nel motore (= nome nel file FEDIAF quando esiste). */
  id: string;
  nameIt: string;
  /** Unità del motore (= unità FEDIAF quando esiste). */
  unit: Unit;
  group: NutrientGroup;
  /** Nome della voce nei cataloghi alimenti/integratori. */
  catalogKey: string | null;
  /** true se esiste una riga nel file FEDIAF. */
  inFediaf: boolean;
  /** Solo informativo: nessun riferimento FEDIAF da confrontare. */
  informative?: boolean;
  note?: string;
}

const d = (
  id: string,
  nameIt: string,
  unit: Unit,
  group: NutrientGroup,
  catalogKey: string | null,
  inFediaf: boolean,
  extra: Partial<NutrientDef> = {},
): NutrientDef => ({ id, nameIt, unit, group, catalogKey, inFediaf, ...extra });

export const NUTRIENTS: NutrientDef[] = [
  // 1. Proteine e aminoacidi
  d('protein', 'Proteine', 'g', 'proteine', 'protein', true),
  d('arginine', 'Arginina', 'g', 'proteine', 'arginine', true),
  d('histidine', 'Istidina', 'g', 'proteine', 'histidine', true),
  d('isoleucine', 'Isoleucina', 'g', 'proteine', 'isoleucine', true),
  d('leucine', 'Leucina', 'g', 'proteine', 'leucine', true),
  d('lysine', 'Lisina', 'g', 'proteine', 'lysine', true),
  d('methionine', 'Metionina', 'g', 'proteine', 'methionine', true),
  d('methionine_cystine', 'Metionina + cistina', 'g', 'proteine', 'methionine_cystine', true),
  d('phenylalanine', 'Fenilalanina', 'g', 'proteine', 'phenylalanine', true),
  d('phenylalanine_tyrosine', 'Fenilalanina + tirosina', 'g', 'proteine', 'phenylalanine_tyrosine', true),
  d('threonine', 'Treonina', 'g', 'proteine', 'threonine', true),
  d('tryptophan', 'Triptofano', 'g', 'proteine', 'tryptophan', true),
  d('valine', 'Valina', 'g', 'proteine', 'valine', true),
  d('cystine', 'Cistina', 'g', 'proteine', 'cystine', false, { informative: true }),
  d('tyrosine', 'Tirosina', 'g', 'proteine', 'tyrosine', false, { informative: true }),
  d('taurine', 'Taurina', 'mg', 'proteine', 'taurine', false, { informative: true }),

  // 2. Grassi e acidi grassi
  d('fat', 'Grassi', 'g', 'grassi', 'fat', true),
  d('linoleic_acid', 'Acido linoleico (omega-6)', 'g', 'grassi', 'linoleic_acid', true, {
    note: 'Se manca, si usa C18:2 non differenziato come stima.',
  }),
  d('arachidonic_acid', 'Acido arachidonico (omega-6)', 'mg', 'grassi', 'c20_4_undifferentiated', true),
  d('alpha_linolenic_acid', 'Acido alfa-linolenico (omega-3)', 'g', 'grassi', 'ala', true),
  d('epa_dha', 'EPA + DHA (omega-3)', 'g', 'grassi', 'epa_dha', true),
  d('epa', 'EPA', 'g', 'grassi', 'epa', false, { informative: true }),
  d('dha', 'DHA', 'g', 'grassi', 'dha', false, { informative: true }),
  d('omega3_total', 'Omega-3 totali', 'g', 'grassi', 'omega3_total', false, { informative: true }),

  // 3. Minerali
  d('calcium', 'Calcio', 'g', 'minerali', 'calcium', true),
  d('phosphorus', 'Fosforo', 'g', 'minerali', 'phosphorus', true),
  d('potassium', 'Potassio', 'g', 'minerali', 'potassium', true),
  d('sodium', 'Sodio', 'g', 'minerali', 'sodium', true),
  d('chloride', 'Cloruro', 'g', 'minerali', null, true, {
    note: 'Nessun dato negli alimenti né negli integratori: resta grigio.',
  }),
  d('magnesium', 'Magnesio', 'g', 'minerali', 'magnesium', true),
  d('copper', 'Rame', 'mg', 'minerali', 'copper', true),
  d('iodine', 'Iodio', 'mg', 'minerali', 'iodine', true, {
    note: 'Negli alimenti non c’è: arriva solo dal QDiet, quindi è sempre valore parziale.',
  }),
  d('iron', 'Ferro', 'mg', 'minerali', 'iron', true),
  d('manganese', 'Manganese', 'mg', 'minerali', 'manganese', true),
  d('selenium_wet', 'Selenio', 'µg', 'minerali', 'selenium_wet', true, {
    note: 'Dieta casalinga: si usa la riga FEDIAF “diete umide”.',
  }),
  d('zinc', 'Zinco', 'mg', 'minerali', 'zinc', true),

  // 4. Vitamine
  d('vitamin_a', 'Vitamina A', 'IU', 'vitamine', 'vitamin_a', true, {
    note: 'UI dal catalogo, oppure retinolo ÷ 0,3; più il beta-carotene (1 mg = 833 UI).',
  }),
  d('vitamin_d', 'Vitamina D', 'IU', 'vitamine', 'vitamin_d', true),
  d('vitamin_e', 'Vitamina E', 'IU', 'vitamine', 'vitamin_e', true, {
    note: 'Da mg a UI con il fattore della forma chimica (FEDIAF VII-14).',
  }),
  d('thiamine', 'Vitamina B1 (tiamina)', 'mg', 'vitamine', 'vitamin_b1', true),
  d('riboflavin', 'Vitamina B2 (riboflavina)', 'mg', 'vitamine', 'vitamin_b2', true),
  d('niacin', 'Vitamina B3 (niacina)', 'mg', 'vitamine', 'vitamin_b3', true),
  d('pantothenic_acid', 'Vitamina B5 (acido pantotenico)', 'mg', 'vitamine', 'vitamin_b5', true),
  d('pyridoxine', 'Vitamina B6 (piridossina)', 'mg', 'vitamine', 'vitamin_b6', true),
  d('biotin', 'Vitamina B7 (biotina)', 'µg', 'vitamine', 'vitamin_b7', true),
  d('folic_acid', 'Vitamina B9 (folati)', 'µg', 'vitamine', 'vitamin_b9', true),
  d('vitamin_b12', 'Vitamina B12', 'µg', 'vitamine', 'vitamin_b12', true),
  d('choline', 'Colina', 'mg', 'vitamine', 'choline', true),
  d('vitamin_k', 'Vitamina K', 'µg', 'vitamine', 'vitamin_k', true),
  d('vitamin_c', 'Vitamina C', 'mg', 'vitamine', 'vitamin_c', false, { informative: true }),
  d('beta_carotene', 'Beta-carotene', 'µg', 'vitamine', 'beta_carotene_ug', false, {
    informative: true,
    note: 'Già conteggiato dentro la vitamina A (1 mg = 833 UI).',
  }),

  // 5. Fibra, carboidrati e acqua (nessun riferimento FEDIAF)
  d('fiber', 'Fibra', 'g', 'fibra_carboidrati_acqua', 'fiber', false, { informative: true }),
  d('carbohydrate', 'Carboidrati disponibili', 'g', 'fibra_carboidrati_acqua', 'carbohydrate_available', false, {
    informative: true,
  }),
  d('moisture', 'Acqua', 'g', 'fibra_carboidrati_acqua', 'moisture', false, {
    informative: true,
    note: 'Serve per calcolare la sostanza secca.',
  }),
];

export const NUTRIENTS_BY_ID: Record<string, NutrientDef> = Object.fromEntries(
  NUTRIENTS.map((n) => [n.id, n]),
);

/** Voci dei cataloghi che il motore usa in modo speciale (non con la mappa 1:1). */
export const SPECIAL_CATALOG_KEYS = new Set([
  'vitamin_a',
  'vitamin_a_retinol_ug',
  'beta_carotene_ug',
  'vitamin_e',
  'linoleic_acid',
  'c18_2_undifferentiated',
]);

// ---------------------------------------------------------------------------
// Conversioni di unità

const MASS_IN_GRAMS: Record<string, number> = { g: 1, mg: 1e-3, µg: 1e-6 };

/** Normalizza le grafie dell'unità (micro: µ U+00B5 o μ U+03BC, "ug", "UI"). */
export function normalizeUnit(unit: string): string {
  const u = unit.trim();
  if (u === 'μg' || u === 'ug' || u === 'mcg') return 'µg';
  if (u === 'UI') return 'IU';
  return u;
}

/** Converte tra g, mg e µg. Le UI si convertono solo in UI. Lancia un errore se impossibile. */
export function convertUnit(value: number, from: string, to: string): number {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  if (f === t) return value;
  const fg = MASS_IN_GRAMS[f];
  const tg = MASS_IN_GRAMS[t];
  if (fg === undefined || tg === undefined) {
    throw new Error(`Conversione non possibile da ${from} a ${to}`);
  }
  return (value * fg) / tg;
}

// Fattori della tabella FEDIAF 2025 VII-14.

/** Vitamina E: UI per 1 mg, secondo la forma chimica. */
export const VITAMIN_E_IU_PER_MG: Record<string, number> = {
  d_alpha_tocopherol: 1.49,
  d_alpha_tocopheryl_acetate: 1.36,
  dl_alpha_tocopherol: 1.1,
  all_rac_alpha_tocopherol: 1.1,
  dl_alpha_tocopheryl_acetate: 1.0,
  all_rac_alpha_tocopheryl_acetate: 1.0,
};

/** Vitamina A: 1 UI = 0,3 µg di retinolo. */
export const RETINOL_UG_PER_IU = 0.3;

/** Beta-carotene nel cane: 1 mg = 833 UI, cioè 1 µg = 0,833 UI. */
export const BETA_CAROTENE_IU_PER_UG = 0.833;
