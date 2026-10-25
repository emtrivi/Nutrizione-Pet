// Ricette: grammi di partenza, valutazione (barre, rapporti, prezzo), controlli di buon senso
// e segno "da rivedere". Regola: l'app non cambia mai i grammi da sola.

import { barGeometry, type BarGeometry } from './bars';
import type { SanityThresholds, Settings, SplitCategory } from './backup';
import type { Catalog, CatalogItem } from './catalog';
import { suggestDose, doseStatus, roundDose, type DoseSuggestion } from './dose';
import { computeDogEnergy } from './energy';
import { GROUP_LABELS, GROUP_ORDER, NUTRIENTS, type NutrientDef, type NutrientGroup } from './nutrients';
import { computeCost, type CostSummary, type PriceBook } from './prices';
import {
  computeRequirements,
  type RawFediafFile,
  type Requirement,
  type RequirementOverride,
  type RequirementsResult,
} from './requirements';
import { classify, evaluateNutrient, type Classification, type Color, type NutrientEvaluation } from './status';
import { calciumPhosphorusRatio, computeTotals, type NutrientTotal, type RecipeTotals, type Total } from './totals';
import type { Dog, FediafTable } from './types';

// ---------------------------------------------------------------------------
// Modello

export interface SavedLine {
  /** Chiave del catalogo, es. "food:beef_mid_10". */
  key: string;
  /** Grammi, o capsule per gli integratori a capsule. */
  amount: number;
  /** Impronta dei valori del catalogo quando la riga è stata salvata o rivista. */
  fingerprint: string;
}

export interface Recipe {
  id: string;
  name: string;
  /** Una ricetta appartiene a un solo cane. */
  dogId: string;
  /** Calorie e tabella di questa ricetta (passo 1). */
  kcalTarget: number;
  table: FediafTable;
  /** Fabbisogni modificati per questa ricetta (passo 2). */
  requirementOverrides: Record<string, RequirementOverride>;
  /** Alimenti e integratori con le quantità decise dall'utente. */
  lines: SavedLine[];
  /** Versione del catalogo usata. */
  catalogVersion: string;
  /** Situazione del cane quando la ricetta è stata salvata o rivista l'ultima volta. */
  reviewedAgainst: { dogId: string; weightKg: number; kcalPerDay: number };
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Grammi di partenza

export const SPLIT_CATEGORIES: SplitCategory[] = ['proteica', 'energetica', 'verdure', 'grassi', 'frattaglie'];

export interface StartingLine {
  key: string;
  amount: number;
  /** Avviso se non si è potuto calcolare (es. kcal sconosciute). */
  warning?: string;
}

/**
 * Calcolo semplice, senza ottimizzazione: le calorie si dividono tra le categorie scelte
 * secondo la ripartizione (riportata a 100 sulle sole categorie presenti), poi in parti
 * uguali tra gli alimenti della stessa categoria, e si trasformano in grammi con le kcal
 * di ciascun alimento. Arrotondamento al grammo.
 */
export function startingGrams(
  foods: CatalogItem[],
  kcalTarget: number,
  split: Record<SplitCategory, number>,
): StartingLine[] {
  const byCat = new Map<string, CatalogItem[]>();
  for (const f of foods) {
    const cat = SPLIT_CATEGORIES.includes(f.recipeCategory as SplitCategory) ? f.recipeCategory : 'energetica';
    byCat.set(cat, [...(byCat.get(cat) ?? []), f]);
  }
  const present = [...byCat.keys()] as SplitCategory[];
  const totalShare = present.reduce((s, c) => s + Math.max(0, split[c] ?? 0), 0);
  return foods.map((f) => {
    const cat = (SPLIT_CATEGORIES.includes(f.recipeCategory as SplitCategory) ? f.recipeCategory : 'energetica') as SplitCategory;
    const group = byCat.get(cat) as CatalogItem[];
    const share = totalShare > 0 ? Math.max(0, split[cat] ?? 0) / totalShare : 1 / present.length;
    const kcal = (kcalTarget * share) / group.length;
    if (f.kcalPerUnit === null || f.kcalPerUnit <= 0) {
      return { key: f.key, amount: 0, warning: 'Calorie dell’alimento sconosciute: scegli tu i grammi.' };
    }
    return { key: f.key, amount: Math.round(kcal / f.kcalPerUnit) };
  });
}

/** Dose di partenza di un integratore: la più bassa del produttore (mai un limite). */
export function startingDose(item: CatalogItem, weightKg: number): { amount: number; suggestion: DoseSuggestion } {
  const s = suggestDose(item, weightKg);
  if (s.kind === 'range') return { amount: roundDose(item, Math.round(s.min * 10) / 10), suggestion: s };
  if (s.kind === 'band') return { amount: s.max, suggestion: s };
  return { amount: 0, suggestion: s };
}

// ---------------------------------------------------------------------------
// Controlli di buon senso (avvisano, non bloccano)

export function sanityWarnings(
  lines: { key: string; amount: number }[],
  catalog: Catalog,
  dogWeightKg: number,
  t: SanityThresholds,
): string[] {
  let food = 0;
  let total = 0;
  let veg = 0;
  let liver = 0;
  let offal = 0;
  for (const l of lines) {
    if (!(l.amount > 0)) continue;
    const item = catalog.get(l.key);
    if (!item) continue;
    const mass = (item.massPerUnitG ?? 0) * l.amount;
    total += mass;
    if (item.kind !== 'food') continue;
    food += mass;
    if (item.recipeCategory === 'verdure') veg += mass;
    if (item.recipeCategory === 'frattaglie') {
      // il catalogo distingue il fegato dalle altre frattaglie nella sottocategoria
      if (item.id.includes('liver')) liver += mass;
      else offal += mass;
    }
  }
  const out: string[] = [];
  const pct = (x: number, of: number) => (of > 0 ? (x / of) * 100 : 0);
  const n = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  if (pct(total, dogWeightKg * 1000) > t.mealPctOfBodyWeight) {
    out.push(`Il pasto pesa ${Math.round(total)} g: oltre il ${n(t.mealPctOfBodyWeight)}% del peso del cane. Controlla le quantità.`);
  }
  if (pct(veg, food) > t.vegetablesPctOfFood) {
    out.push(`Le verdure sono il ${n(pct(veg, food))}% del peso degli alimenti: oltre il ${n(t.vegetablesPctOfFood)}%.`);
  }
  if (pct(liver, food) > t.liverPctOfFood) {
    out.push(`Il fegato è il ${n(pct(liver, food))}% del peso degli alimenti: oltre il ${n(t.liverPctOfFood)}%.`);
  }
  if (pct(offal, food) > t.otherOffalPctOfFood) {
    out.push(`Le altre frattaglie sono il ${n(pct(offal, food))}% del peso degli alimenti: oltre il ${n(t.otherOffalPctOfFood)}%.`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// "Da rivedere"

export function reviewReasons(
  recipe: Recipe,
  dogs: Dog[],
  catalog: Catalog,
  multipliers?: Settings['multipliers'],
): string[] {
  const out: string[] = [];
  const dog = dogs.find((d) => d.id === recipe.dogId);
  if (!dog) return ['Il cane di questa ricetta non esiste più.'];
  const snap = recipe.reviewedAgainst;
  if (snap.dogId !== dog.id) {
    out.push('Ricetta copiata da un altro cane: controlla calorie e grammi.');
  } else {
    if (Math.abs(snap.weightKg - dog.weightKg) > 1e-9) {
      out.push(`Il peso del cane è cambiato (da ${fmt(snap.weightKg)} a ${fmt(dog.weightKg)} kg).`);
    }
    const kcal = computeDogEnergy(dog, multipliers ?? undefined).kcalPerDay;
    if (Math.abs(snap.kcalPerDay - kcal) > 0.5) {
      out.push(`Le calorie del cane sono cambiate (da ${Math.round(snap.kcalPerDay)} a ${Math.round(kcal)} kcal).`);
    }
  }
  for (const l of recipe.lines) {
    const item = catalog.get(l.key);
    if (!item) out.push(`Un ingrediente non è più nel catalogo (${l.key}).`);
    else if (item.fingerprint !== l.fingerprint) out.push(`I dati del catalogo sono cambiati per “${shortName(item)}”.`);
  }
  return out;
}

const fmt = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',');

/** Situazione del cane da registrare quando la ricetta viene salvata o rivista. */
export function dogSnapshot(dog: Dog, multipliers?: Settings['multipliers']): Recipe['reviewedAgainst'] {
  return { dogId: dog.id, weightKg: dog.weightKg, kcalPerDay: computeDogEnergy(dog, multipliers ?? undefined).kcalPerDay };
}

/** Ricetta segnata come rivista: aggiorna situazione del cane e impronte; i grammi non cambiano. */
export function markReviewed(recipe: Recipe, dog: Dog, catalog: Catalog, now: Date, multipliers?: Settings['multipliers']): Recipe {
  return {
    ...recipe,
    reviewedAgainst: dogSnapshot(dog, multipliers),
    lines: recipe.lines.map((l) => ({ ...l, fingerprint: catalog.get(l.key)?.fingerprint ?? l.fingerprint })),
    catalogVersion: catalog.version.label,
    updatedAt: now.toISOString(),
  };
}

/** Copia della ricetta, anche per un altro cane (che dovrà rivederla). */
export function duplicateRecipe(recipe: Recipe, id: string, now: Date, dogId = recipe.dogId): Recipe {
  return {
    ...recipe,
    id,
    dogId,
    name: `${recipe.name} (copia)`,
    lines: recipe.lines.map((l) => ({ ...l })),
    requirementOverrides: { ...recipe.requirementOverrides },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Nomi brevi e riepilogo per la lista

/** Nome breve: la parte prima della prima virgola o parentesi. */
export function shortName(item: Pick<CatalogItem, 'nameIt'>): string {
  const cut = item.nameIt.split(/[,(—–]/)[0]?.trim();
  return cut || item.nameIt;
}

export function recipeSummary(lines: { key: string; amount: number }[], catalog: Catalog): string {
  return lines
    .filter((l) => l.amount > 0)
    .map((l) => {
      const item = catalog.get(l.key);
      const unit = item?.doseUnit === 'capsule' ? (l.amount === 1 ? ' capsula' : ' capsule') : ' g';
      return `${item ? shortName(item) : l.key} ${fmtAmount(l.amount)}${unit}`;
    })
    .join(' · ');
}

const fmtAmount = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace('.', ','));

// ---------------------------------------------------------------------------
// Valutazione completa della ricetta

export interface NutrientView {
  def: NutrientDef;
  req: Requirement;
  total: NutrientTotal;
  evaluation: NutrientEvaluation;
  bar: BarGeometry;
}

export interface RecipeEvaluation {
  totals: RecipeTotals;
  requirements: RequirementsResult;
  kcal: { value: number | null; partial: boolean; target: number; diffPct: number | null; color: Color };
  nutrients: Record<string, NutrientView>;
  groups: { group: NutrientGroup; label: string; items: NutrientView[] }[];
  /** Conteggio dei colori sui nutrienti con una riga FEDIAF (gli extra informativi non contano). */
  summary: Record<Color, number>;
  caP: { value: number | null; partial: boolean; classification: Classification; bar: BarGeometry };
  omega: {
    linoleic: Total;
    alphaLinolenic: Total;
    epaDha: Total;
    /** Omega-6 / omega-3 = acido linoleico ÷ (ALA + EPA + DHA), solo informativo. */
    ratio: number | null;
    partial: boolean;
  };
  /** Ripartizione delle calorie (4/9/4), solo informativa. */
  energySplit: { protein: number; fat: number; carbohydrate: number; partial: boolean } | null;
  cost: CostSummary;
  sanity: string[];
  supplements: { key: string; amount: number; suggestion: DoseSuggestion; status: ReturnType<typeof doseStatus> }[];
}

const COLOR_RANK: Record<Color, number> = { rosso: 0, arancione: 1, verde: 2, grigio: 3 };

export interface EvaluateInput {
  lines: { key: string; amount: number }[];
  kcalTarget: number;
  table: FediafTable;
  overrides: Record<string, RequirementOverride>;
  dogWeightKg: number;
}

export function evaluateRecipe(
  input: EvaluateInput,
  ctx: { catalog: Catalog; fediaf: RawFediafFile; settings: Settings; prices: PriceBook },
): RecipeEvaluation {
  const { catalog, fediaf, settings, prices } = ctx;
  const tolerance = settings.tolerance;
  const totals = computeTotals(input.lines, catalog);
  const requirements = computeRequirements(fediaf, {
    table: input.table,
    kcalPerDay: input.kcalTarget,
    overrides: input.overrides,
    aminoAcidDigestibilityIncrease: settings.aminoAcidDigestibilityIncrease,
  });

  const kcalValue = totals.kcal.value;
  const diffPct = kcalValue !== null && input.kcalTarget > 0 ? ((kcalValue - input.kcalTarget) / input.kcalTarget) * 100 : null;
  const kcalColor: Color =
    diffPct === null ? 'grigio' : Math.abs(diffPct) <= 5 ? 'verde' : Math.abs(diffPct) <= 10 ? 'arancione' : 'rosso';

  const supplementKeys = input.lines.filter((l) => l.key.startsWith('supplement:') && l.amount > 0).map((l) => l.key);
  const nutrients: Record<string, NutrientView> = {};
  for (const def of NUTRIENTS) {
    const total = totals.nutrients[def.id] as NutrientTotal;
    const req = requirements.byId[def.id] as Requirement;
    const evaluation =
      kcalValue !== null && kcalValue > 0
        ? evaluateNutrient(total, req, {
            recipeKcal: kcalValue,
            dryMatterG: totals.dryMatterG.value,
            supplementKeys,
            legalMaxMode: settings.legalMaxNaturalMode,
            tolerance,
          })
        : {
            ...classify(null, true, { min: req.minPer1000, max: req.maxNPer1000 }, tolerance),
            valuePer1000: null,
            limitsPer1000: { min: req.minPer1000, max: req.maxNPer1000 },
            maxKind: null,
            legalMaxWarning: null,
          };
    nutrients[def.id] = { def, req, total, evaluation, bar: barGeometry(evaluation.valuePer1000, evaluation.limitsPer1000, tolerance) };
  }

  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    items: NUTRIENTS.filter((n) => n.group === g)
      .map((n) => nutrients[n.id] as NutrientView)
      .map((v, i) => ({ v, i }))
      .sort((a, b) => COLOR_RANK[a.v.evaluation.color] - COLOR_RANK[b.v.evaluation.color] || a.i - b.i)
      .map(({ v }) => v),
  }));

  const summary: Record<Color, number> = { verde: 0, arancione: 0, rosso: 0, grigio: 0 };
  for (const def of NUTRIENTS) if (def.inFediaf) summary[(nutrients[def.id] as NutrientView).evaluation.color]++;

  const ratio = calciumPhosphorusRatio(totals);
  const caPLimits = { min: requirements.caPRatio.min, max: requirements.caPRatio.max };
  const caP = {
    value: ratio.value,
    partial: ratio.partial,
    classification: classify(ratio.value, ratio.partial, caPLimits, tolerance),
    bar: barGeometry(ratio.value, caPLimits, tolerance),
  };

  const la = totals.nutrients.linoleic_acid as NutrientTotal;
  const ala = totals.nutrients.alpha_linolenic_acid as NutrientTotal;
  const epaDha = totals.nutrients.epa_dha as NutrientTotal;
  const n3 = ala.value === null && epaDha.value === null ? null : (ala.value ?? 0) + (epaDha.value ?? 0);
  const omega = {
    linoleic: la,
    alphaLinolenic: ala,
    epaDha,
    ratio: la.value !== null && n3 !== null && n3 > 0 ? la.value / n3 : null,
    partial: la.partial || ala.partial || epaDha.partial,
  };

  const p = totals.nutrients.protein as NutrientTotal;
  const f = totals.nutrients.fat as NutrientTotal;
  const c = totals.nutrients.carbohydrate as NutrientTotal;
  const kp = (p.value ?? 0) * 4;
  const kf = (f.value ?? 0) * 9;
  const kc = (c.value ?? 0) * 4;
  const ksum = kp + kf + kc;
  const energySplit =
    ksum > 0
      ? { protein: (kp / ksum) * 100, fat: (kf / ksum) * 100, carbohydrate: (kc / ksum) * 100, partial: p.partial || f.partial || c.partial }
      : null;

  const supplements = input.lines
    .filter((l) => l.key.startsWith('supplement:'))
    .map((l) => {
      const item = catalog.get(l.key) as CatalogItem;
      const suggestion = suggestDose(item, input.dogWeightKg);
      return { key: l.key, amount: l.amount, suggestion, status: doseStatus(l.amount, suggestion) };
    });

  return {
    totals,
    requirements,
    kcal: { value: kcalValue, partial: totals.kcal.partial, target: input.kcalTarget, diffPct, color: kcalColor },
    nutrients,
    groups,
    summary,
    caP,
    omega,
    energySplit,
    cost: computeCost(input.lines, prices, catalog.get),
    sanity: sanityWarnings(input.lines, catalog, input.dogWeightKg, settings.sanity),
    supplements,
  };
}

/** Riepilogo in parole, es. "2 rossi, 4 arancioni, 3 grigi". */
export function summaryText(s: Record<Color, number>): string {
  const parts: string[] = [];
  if (s.rosso) parts.push(`${s.rosso} ${s.rosso === 1 ? 'rosso' : 'rossi'}`);
  if (s.arancione) parts.push(`${s.arancione} ${s.arancione === 1 ? 'arancione' : 'arancioni'}`);
  if (s.verde) parts.push(`${s.verde} ${s.verde === 1 ? 'verde' : 'verdi'}`);
  if (s.grigio) parts.push(`${s.grigio} ${s.grigio === 1 ? 'grigio' : 'grigi'}`);
  return parts.join(', ');
}
