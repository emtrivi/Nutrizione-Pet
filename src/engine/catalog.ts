// Lettura dei cataloghi (alimenti e integratori).
// I file restano intatti: qui si convertono i valori in una base comune
// (per 1 g di alimento o per 1 unità di integratore, nelle unità FEDIAF).
// Un nutriente assente resta assente: mai zero.

import {
  BETA_CAROTENE_IU_PER_UG,
  NUTRIENTS,
  RETINOL_UG_PER_IU,
  SPECIAL_CATALOG_KEYS,
  VITAMIN_E_IU_PER_MG,
  convertUnit,
  normalizeUnit,
} from './nutrients';
import { SUPPLEMENT_RULES, type DoseRule, type NutrientOverride, type SupplementRule } from './supplementRules';
import type { ItemNutrient } from './types';

// ---------------------------------------------------------------------------
// Forma dei file (solo i campi usati)

export interface RawNutrient {
  value: number | null;
  unit: string;
  status?: string;
  form?: string;
  method?: string;
  source?: string;
  declared_total_or_added?: string;
}

export interface RawFood {
  id: string;
  name_it: string;
  category: string;
  subcategory: string;
  processing_state: string;
  preparation?: string;
  source?: string;
  source_url?: string;
  data_status: string;
  available_to_formulate: boolean;
  notes?: string;
  nutrients: Record<string, RawNutrient>;
  kcal_me_per_100g: number | null;
  me_method?: string;
}

export interface RawDosePoint {
  weight_kg: number;
  min?: number;
  max?: number;
}

export interface RawSupplement {
  id: string;
  name_it: string;
  brand?: string;
  class?: string;
  dose_unit: string;
  integer_dose: boolean;
  source_url?: string;
  label_source?: string;
  data_status: string;
  notes?: string;
  nutrients: Record<string, RawNutrient>;
  kcal_per_unit?: number;
  content_mass_per_unit_g?: number;
  dose_guide?: { points: RawDosePoint[]; source?: string; note?: string };
}

// ---------------------------------------------------------------------------
// Forma normalizzata

export type ItemKind = 'food' | 'supplement';

/** Categoria della ricetta guidata (passo 3). */
export type RecipeCategory = 'proteica' | 'energetica' | 'verdure' | 'grassi' | 'frattaglie' | 'altro';

export const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  proteica: 'Fonte proteica principale',
  energetica: 'Fonte energetica',
  verdure: 'Verdure e fibra',
  grassi: 'Fonte di grassi',
  frattaglie: 'Frattaglie',
  altro: 'Altro',
};

export const PROCESSING_LABELS: Record<string, string> = {
  raw: 'peso a crudo',
  cooked_boiled: 'peso a cotto (bollito)',
  cooked_steamed: 'peso a cotto (al vapore)',
  dried: 'peso a secco (non cotto)',
  canned: 'peso sgocciolato (in scatola)',
};

export interface CatalogItem {
  kind: ItemKind;
  id: string;
  /** Chiave unica tra alimenti e integratori, es. "food:beef_mid_10". */
  key: string;
  nameIt: string;
  /** Unità della quantità: grammi o capsule. */
  doseUnit: 'g' | 'capsule';
  integerDose: boolean;
  /** Nutrienti per 1 g (o per 1 capsula), nelle unità del motore. */
  nutrients: Record<string, ItemNutrient>;
  /** Kcal per 1 g (o per 1 capsula); null se sconosciute. */
  kcalPerUnit: number | null;
  kcalMethod: string | null;
  /** Massa in grammi di 1 unità (1 per i grammi); null se sconosciuta. */
  massPerUnitG: number | null;
  recipeCategory: RecipeCategory;
  processingState: string | null;
  processingLabel: string | null;
  /** Alimento "da rivedere": mostra "dato indicativo". */
  indicative: boolean;
  /** Integratore: mostra "dato provvisorio". */
  provisional: boolean;
  /** Si può scegliere per nuove ricette. */
  availableForNewRecipes: boolean;
  source: string | null;
  sourceUrl: string | null;
  notes: string | null;
  doseRule: DoseRule;
  dosePoints: RawDosePoint[];
  doseNote: string | null;
  /** Impronta dei valori: se cambia con un nuovo catalogo, le ricette vanno riviste. */
  fingerprint: string;
}

export interface CatalogVersion {
  fileName: string;
  /** Data ricavata dal nome del file, formato AAAA-MM-GG. */
  date: string | null;
  /** Etichetta da mostrare, es. "23/10/2026". */
  label: string;
}

export interface Catalog {
  foods: CatalogItem[];
  supplements: CatalogItem[];
  version: { foods: CatalogVersion; supplements: CatalogVersion; label: string };
  get(key: string): CatalogItem | undefined;
}

// ---------------------------------------------------------------------------
// Versione e impronta

/** Ricava la versione dalla data nel nome del file (decisione A7). */
export function versionFromFileName(fileName: string): CatalogVersion {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(fileName);
  if (!m) return { fileName, date: null, label: fileName };
  const [, y, mo, da] = m;
  return { fileName, date: `${y}-${mo}-${da}`, label: `${da}/${mo}/${y}` };
}

/** JSON con le chiavi ordinate: stesso contenuto, stesso testo. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/** Hash FNV-1a a 32 bit, in esadecimale. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Conversione dei nutrienti

function isKnown(raw: RawNutrient | undefined): raw is RawNutrient & { value: number } {
  return raw !== undefined && typeof raw.value === 'number' && Number.isFinite(raw.value);
}

function nutrientFrom(
  value: number,
  raw: RawNutrient,
  notes: string[] = [],
  extra: Partial<ItemNutrient> = {},
): ItemNutrient {
  return {
    value,
    status: raw.status ?? 'unknown',
    partial: false,
    toVerify: false,
    notes,
    ...extra,
  };
}

/**
 * Converte le voci di un catalogo nella base del motore.
 * @param scale divisore della base (100 per "per 100 g", 1 per "per unità")
 */
export function normalizeNutrients(
  raw: Record<string, RawNutrient>,
  scale: number,
  options: { isSupplement: boolean; overrides?: Record<string, NutrientOverride> } = {
    isSupplement: false,
  },
): Record<string, ItemNutrient> {
  const out: Record<string, ItemNutrient> = {};
  const overrides = options.overrides ?? {};
  const withOverride = (key: string): RawNutrient | undefined => {
    const r = raw[key];
    const o = overrides[key];
    if (!r || !o) return r;
    return { ...r, form: o.form ?? r.form };
  };

  // Voci 1:1 del dizionario.
  for (const def of NUTRIENTS) {
    const key = def.catalogKey;
    if (!key || SPECIAL_CATALOG_KEYS.has(key)) continue;
    const r = withOverride(key);
    if (!isKnown(r)) continue;
    out[def.id] = nutrientFrom(convertUnit(r.value, r.unit, def.unit) / scale, r);
  }

  // Beta-carotene come voce informativa (µg).
  const bc = raw.beta_carotene_ug;
  if (isKnown(bc)) out.beta_carotene = nutrientFrom(convertUnit(bc.value, bc.unit, 'µg') / scale, bc);

  // Vitamina A: UI se presenti, altrimenti retinolo ÷ 0,3; più beta-carotene × 0,833.
  const va = raw.vitamin_a;
  const ret = raw.vitamin_a_retinol_ug;
  let preformed: number | null = null;
  let preformedSource: RawNutrient | null = null;
  const vaNotes: string[] = [];
  if (isKnown(va) && normalizeUnit(va.unit) === 'IU') {
    preformed = va.value / scale;
    preformedSource = va;
  } else if (isKnown(ret)) {
    preformed = convertUnit(ret.value, ret.unit, 'µg') / RETINOL_UG_PER_IU / scale;
    preformedSource = ret;
    vaNotes.push('Vitamina A preformata calcolata dal retinolo (µg ÷ 0,3).');
  }
  const fromBc = isKnown(bc) ? (convertUnit(bc.value, bc.unit, 'µg') * BETA_CAROTENE_IU_PER_UG) / scale : null;
  if (preformed !== null || fromBc !== null) {
    // Negli integratori il beta-carotene non è una voce d'etichetta: non rende parziale il valore.
    const bcMissing = fromBc === null && !options.isSupplement;
    if (bcMissing) vaNotes.push('Beta-carotene non noto: la vitamina A è un valore parziale.');
    if (preformed === null) vaNotes.push('Vitamina A preformata non nota: valore parziale.');
    const source = (preformedSource ?? bc) as RawNutrient;
    out.vitamin_a = nutrientFrom((preformed ?? 0) + (fromBc ?? 0), source, vaNotes, {
      partial: preformed === null || bcMissing,
      parts: { preformata: preformed, da_beta_carotene: fromBc },
    });
  }

  // Vitamina E: da mg a UI con il fattore della forma chimica.
  const ve = withOverride('vitamin_e');
  if (isKnown(ve)) {
    const unit = normalizeUnit(ve.unit);
    if (unit === 'IU') {
      out.vitamin_e = nutrientFrom(ve.value / scale, ve);
    } else {
      const factor = ve.form ? VITAMIN_E_IU_PER_MG[ve.form] : undefined;
      if (factor !== undefined) {
        const mg = convertUnit(ve.value, unit, 'mg');
        out.vitamin_e = nutrientFrom((mg * factor) / scale, ve, [
          `Convertita da mg a UI: forma ${ve.form}, fattore ${factor}.`,
        ]);
      }
      // Forma sconosciuta: non si converte, quindi la vitamina E resta sconosciuta.
    }
  }

  // Acido linoleico: se manca, C18:2 non differenziato come stima.
  const la = raw.linoleic_acid;
  const c182 = raw.c18_2_undifferentiated;
  if (isKnown(la)) {
    out.linoleic_acid = nutrientFrom(convertUnit(la.value, la.unit, 'g') / scale, la);
  } else if (isKnown(c182)) {
    out.linoleic_acid = nutrientFrom(convertUnit(c182.value, c182.unit, 'g') / scale, c182, [
      'Stima da C18:2 non differenziato (acido linoleico non dichiarato).',
    ], { status: 'estimated' });
  }

  // Regole dell'utente: note e "da verificare".
  for (const [key, o] of Object.entries(overrides)) {
    const def = NUTRIENTS.find((n) => n.catalogKey === key);
    const target = def ? out[def.id] : undefined;
    if (!target) continue;
    target.notes = [...target.notes, o.note];
    if (o.toVerify) target.toVerify = true;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Alimenti

export function recipeCategoryOf(category: string, subcategory: string): RecipeCategory {
  if (category === 'animal') {
    if (subcategory.startsWith('secreting_offal')) return 'frattaglie';
    return 'proteica'; // muscolo, pesce, uova, cuore
  }
  if (category === 'starch') return 'energetica';
  if (category === 'vegetable') return 'verdure';
  if (category === 'other' && subcategory === 'fat_oil') return 'grassi';
  return 'altro';
}

export function normalizeFood(raw: RawFood): CatalogItem {
  const kcal = typeof raw.kcal_me_per_100g === 'number' ? raw.kcal_me_per_100g / 100 : null;
  return {
    kind: 'food',
    id: raw.id,
    key: `food:${raw.id}`,
    nameIt: raw.name_it,
    doseUnit: 'g',
    integerDose: false,
    nutrients: normalizeNutrients(raw.nutrients, 100, { isSupplement: false }),
    kcalPerUnit: kcal,
    kcalMethod: raw.me_method ?? null,
    massPerUnitG: 1,
    recipeCategory: recipeCategoryOf(raw.category, raw.subcategory),
    processingState: raw.processing_state,
    processingLabel: PROCESSING_LABELS[raw.processing_state] ?? raw.processing_state,
    indicative: raw.data_status === 'review_required',
    provisional: false,
    availableForNewRecipes: raw.available_to_formulate === true,
    source: raw.source ?? null,
    sourceUrl: raw.source_url ?? null,
    notes: raw.notes ?? null,
    doseRule: { kind: 'none', reason: 'Alimento' },
    dosePoints: [],
    doseNote: null,
    fingerprint: fnv1a(canonicalJson({ n: raw.nutrients, k: raw.kcal_me_per_100g })),
  };
}

// ---------------------------------------------------------------------------
// Integratori

function defaultRule(raw: RawSupplement): SupplementRule {
  const pts = raw.dose_guide?.points ?? [];
  const first = pts[0];
  const last = pts[pts.length - 1];
  return {
    provisional: raw.data_status !== 'verified',
    dose:
      first && last && first.min !== undefined
        ? { kind: 'interpolated', officialFromKg: first.weight_kg, officialToKg: last.weight_kg }
        : { kind: 'none', reason: 'Nessuna tabella di dosi del produttore nel catalogo.' },
  };
}

export function normalizeSupplement(raw: RawSupplement): CatalogItem {
  const rule = SUPPLEMENT_RULES[raw.id] ?? defaultRule(raw);
  const isCapsule = raw.dose_unit === 'capsule';
  return {
    kind: 'supplement',
    id: raw.id,
    key: `supplement:${raw.id}`,
    nameIt: raw.name_it,
    doseUnit: isCapsule ? 'capsule' : 'g',
    integerDose: raw.integer_dose === true,
    nutrients: normalizeNutrients(raw.nutrients, 1, {
      isSupplement: true,
      overrides: rule.nutrientOverrides,
    }),
    kcalPerUnit: typeof raw.kcal_per_unit === 'number' ? raw.kcal_per_unit : null,
    kcalMethod: typeof raw.kcal_per_unit === 'number' ? 'Valore dichiarato nel catalogo integratori' : null,
    massPerUnitG: isCapsule ? (raw.content_mass_per_unit_g ?? null) : 1,
    recipeCategory: 'altro',
    processingState: null,
    processingLabel: null,
    indicative: false,
    provisional: rule.provisional,
    availableForNewRecipes: true,
    source: raw.label_source ?? null,
    sourceUrl: raw.source_url ?? null,
    notes: raw.notes ?? null,
    doseRule: rule.dose,
    dosePoints: raw.dose_guide?.points ?? [],
    doseNote: raw.dose_guide?.note ?? null,
    fingerprint: fnv1a(
      canonicalJson({ n: raw.nutrients, k: raw.kcal_per_unit, m: raw.content_mass_per_unit_g, r: rule }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Catalogo completo

export interface CatalogFiles {
  foods: { fileName: string; data: { foods: RawFood[] } };
  supplements: { fileName: string; data: { supplements: RawSupplement[] } };
}

export function buildCatalog(files: CatalogFiles): Catalog {
  const foods = files.foods.data.foods.map(normalizeFood);
  const supplements = files.supplements.data.supplements.map(normalizeSupplement);
  const map = new Map<string, CatalogItem>();
  for (const item of [...foods, ...supplements]) {
    if (map.has(item.key)) throw new Error(`Identificativo duplicato nel catalogo: ${item.key}`);
    map.set(item.key, item);
  }
  const fv = versionFromFileName(files.foods.fileName);
  const sv = versionFromFileName(files.supplements.fileName);
  return {
    foods,
    supplements,
    version: {
      foods: fv,
      supplements: sv,
      label: `Alimenti v. ${fv.label} · Integratori v. ${sv.label}`,
    },
    get: (key) => map.get(key),
  };
}
