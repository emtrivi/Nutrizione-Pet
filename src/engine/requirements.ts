// Fabbisogni: minimi e massimi FEDIAF per 1.000 kcal e per giorno.

import { GROUP_LABELS, GROUP_ORDER, NUTRIENTS, type NutrientGroup } from './nutrients';
import type { FediafTable, Unit } from './types';

// ---------------------------------------------------------------------------
// Forma del file FEDIAF (solo i campi usati)

export interface RawFediafReference {
  id: string;
  nome_it: string;
  unita: string;
  minimo_raccomandato_per_1000_kcal_ME: { adulto_MER_95: number | null; adulto_MER_110: number | null };
  minimo_raccomandato_per_100g_sostanza_secca: { adulto_MER_95: number | null; adulto_MER_110: number | null };
  massimo_nutrizionale_adulto_per_1000_kcal_ME: number | null;
  massimo_legale_per_100g_sostanza_secca: number | null;
  tipo_massimo: string | null;
  fonte_minimi?: string;
  fonte_massimi?: string;
  nota?: string;
}

export interface RawFediafFile {
  edizione: string;
  riferimenti: RawFediafReference[];
  vincoli_rapporto: { id: string; minimo: number; massimo_nutrizionale_adulto: number; fonte?: string }[];
  note_normative: { id: string; valore?: number; unita?: string; natura: string; fonte?: string }[];
}

/** Aminoacidi essenziali a cui si applica l'eventuale aumento del 10% (FEDIAF §3.2.1). */
export const ESSENTIAL_AMINO_ACIDS = [
  'arginine',
  'histidine',
  'isoleucine',
  'leucine',
  'lysine',
  'methionine',
  'methionine_cystine',
  'phenylalanine',
  'phenylalanine_tyrosine',
  'threonine',
  'tryptophan',
  'valine',
];

export interface RequirementOverride {
  /** Minimo per 1.000 kcal scelto a mano; null = nessun minimo. */
  min?: number | null;
  /** Massimo per 1.000 kcal scelto a mano; null = nessun massimo. */
  max?: number | null;
}

export interface Requirement {
  id: string;
  nameIt: string;
  unit: Unit;
  group: NutrientGroup;
  /** Nessun riferimento da confrontare: barra grigia con il solo valore. */
  informative: boolean;
  /** Minimo FEDIAF originale per 1.000 kcal (tabella scelta). */
  fediafMinPer1000: number | null;
  /** Minimo in uso per 1.000 kcal (FEDIAF, eventualmente +10% o modificato). */
  minPer1000: number | null;
  /** Massimo nutrizionale (N) per 1.000 kcal. */
  maxNPer1000: number | null;
  /** Massimo di legge (L) per 100 g di sostanza secca: si converte con la ricetta. */
  maxLPer100gDM: number | null;
  /** Massimo scelto a mano per 1.000 kcal. */
  maxCustomPer1000: number | null;
  maxType: string | null;
  modified: boolean;
  digestibilityIncreaseApplied: boolean;
  perDay: { min: number | null; maxN: number | null; maxCustom: number | null };
  source: string | null;
  note: string | null;
}

export interface RequirementsResult {
  table: FediafTable;
  kcalPerDay: number;
  edition: string;
  groups: { group: NutrientGroup; label: string; items: Requirement[] }[];
  byId: Record<string, Requirement>;
  caPRatio: { min: number; max: number; source: string | null };
  /** Livelli indicati sicuri (non massimi), da mostrare come informazione. */
  safeLevels: { id: string; value: number; unit: string; note: string }[];
}

export interface RequirementsInput {
  table: FediafTable;
  kcalPerDay: number;
  overrides?: Record<string, RequirementOverride>;
  /** Aumento del 10% degli aminoacidi (punto aperto: spento finché la nutrizionista non decide). */
  aminoAcidDigestibilityIncrease?: boolean;
}

const perDay = (per1000: number | null, kcal: number): number | null =>
  per1000 === null ? null : (per1000 * kcal) / 1000;

export function computeRequirements(fediaf: RawFediafFile, input: RequirementsInput): RequirementsResult {
  const col = input.table === 95 ? 'adulto_MER_95' : 'adulto_MER_110';
  const refs = new Map(fediaf.riferimenti.map((r) => [r.id, r]));
  const byId: Record<string, Requirement> = {};

  for (const def of NUTRIENTS) {
    const ref = def.inFediaf ? refs.get(def.id) : undefined;
    if (def.inFediaf && !ref) throw new Error(`Riga FEDIAF mancante per ${def.id}`);
    const fediafMin = ref ? ref.minimo_raccomandato_per_1000_kcal_ME[col] : null;
    const increase = !!input.aminoAcidDigestibilityIncrease && ESSENTIAL_AMINO_ACIDS.includes(def.id);
    let min = fediafMin !== null && increase ? fediafMin * 1.1 : fediafMin;
    const maxN = ref ? ref.massimo_nutrizionale_adulto_per_1000_kcal_ME : null;
    const maxL = ref ? ref.massimo_legale_per_100g_sostanza_secca : null;
    let maxCustom: number | null = null;

    const o = input.overrides?.[def.id];
    const modified = o !== undefined && (o.min !== undefined || o.max !== undefined);
    if (o?.min !== undefined) min = o.min;
    if (o?.max !== undefined) maxCustom = o.max;

    const informative = min === null && maxN === null && maxL === null && maxCustom === null;
    byId[def.id] = {
      id: def.id,
      nameIt: def.nameIt,
      unit: def.unit,
      group: def.group,
      informative,
      fediafMinPer1000: fediafMin,
      minPer1000: min,
      maxNPer1000: maxN,
      maxLPer100gDM: maxL,
      maxCustomPer1000: maxCustom,
      maxType: ref?.tipo_massimo ?? null,
      modified,
      digestibilityIncreaseApplied: increase && fediafMin !== null,
      perDay: {
        min: perDay(min, input.kcalPerDay),
        maxN: perDay(maxN, input.kcalPerDay),
        maxCustom: perDay(maxCustom, input.kcalPerDay),
      },
      source: ref ? `${ref.fonte_minimi ?? ''}`.trim() || null : null,
      note: [def.note, ref?.nota].filter(Boolean).join(' ') || null,
    };
  }

  const ratio = fediaf.vincoli_rapporto.find((v) => v.id === 'calcium_phosphorus_ratio');
  if (!ratio) throw new Error('Rapporto calcio/fosforo mancante nel file FEDIAF');

  return {
    table: input.table,
    kcalPerDay: input.kcalPerDay,
    edition: fediaf.edizione,
    groups: GROUP_ORDER.map((g) => ({
      group: g,
      label: GROUP_LABELS[g],
      items: NUTRIENTS.filter((n) => n.group === g).map((n) => byId[n.id] as Requirement),
    })),
    byId,
    caPRatio: { min: ratio.minimo, max: ratio.massimo_nutrizionale_adulto, source: ratio.fonte ?? null },
    safeLevels: fediaf.note_normative
      .filter((n) => n.id.endsWith('_not_a_maximum') && typeof n.valore === 'number')
      .map((n) => ({ id: n.id, value: n.valore as number, unit: n.unita ?? '', note: n.natura })),
  };
}

/**
 * Massimo di legge convertito per 1.000 kcal della ricetta:
 * max = L (per 100 g SS) × SS (g) ÷ kcal ricetta × 10.
 */
export function legalMaxPer1000Kcal(lPer100gDM: number, dryMatterG: number, recipeKcal: number): number {
  if (!(recipeKcal > 0)) throw new Error('Le kcal della ricetta devono essere maggiori di zero');
  return (lPer100gDM * dryMatterG * 10) / recipeKcal;
}
