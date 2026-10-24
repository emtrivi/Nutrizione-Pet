// Colori delle barre.
// Verde: tra minimo e massimo. Arancione: fuori dal limite fino al 10%.
// Rosso: fuori oltre il 10%. Grigio: nessun riferimento o dato mancante.

import { legalMaxPer1000Kcal, type Requirement } from './requirements';
import type { NutrientTotal } from './totals';

export type Color = 'verde' | 'arancione' | 'rosso' | 'grigio';

/** Zona arancione: 10% oltre il limite (confermata dall'utente). */
export const DEFAULT_TOLERANCE = 0.1;

const EPS = 1e-9;

export interface Limits {
  min: number | null;
  max: number | null;
}

export interface Classification {
  color: Color;
  direction: 'carenza' | 'eccesso' | null;
  /** Di quanto si è fuori dal limite (0,05 = 5%). 0 se dentro. */
  distance: number;
  /**
   * true se il colore può cambiare quando arriveranno i dati mancanti:
   * con un valore parziale, un verde o una carenza non sono definitivi;
   * un eccesso invece resta valido.
   */
  provisional: boolean;
  reason: 'ok' | 'dato_mancante' | 'nessun_riferimento' | 'fuori_limite';
}

export function classify(
  value: number | null,
  partial: boolean,
  limits: Limits,
  tolerance = DEFAULT_TOLERANCE,
): Classification {
  if (limits.min === null && limits.max === null) {
    return { color: 'grigio', direction: null, distance: 0, provisional: false, reason: 'nessun_riferimento' };
  }
  if (value === null) {
    return { color: 'grigio', direction: null, distance: 0, provisional: false, reason: 'dato_mancante' };
  }
  if (limits.max !== null && value > limits.max + EPS * Math.max(1, Math.abs(limits.max))) {
    const distance = limits.max === 0 ? Infinity : (value - limits.max) / limits.max;
    return {
      color: distance <= tolerance + EPS ? 'arancione' : 'rosso',
      direction: 'eccesso',
      distance,
      provisional: false,
      reason: 'fuori_limite',
    };
  }
  if (limits.min !== null && value < limits.min - EPS * Math.max(1, Math.abs(limits.min))) {
    const distance = (limits.min - value) / limits.min;
    return {
      color: distance <= tolerance + EPS ? 'arancione' : 'rosso',
      direction: 'carenza',
      distance,
      provisional: partial,
      reason: 'fuori_limite',
    };
  }
  return { color: 'verde', direction: null, distance: 0, provisional: partial, reason: 'ok' };
}

/** Come trattare il massimo di legge (L) quando il nutriente arriva solo da alimenti naturali. */
export type LegalMaxMode = 'rosso' | 'avviso';

export interface NutrientEvaluation extends Classification {
  /** Valore per 1.000 kcal della ricetta. */
  valuePer1000: number | null;
  limitsPer1000: Limits;
  /** Quale massimo è stato usato. */
  maxKind: 'N' | 'L' | 'modificato' | null;
  /** Massimo di legge superato solo da alimenti naturali: avviso, senza colore rosso. */
  legalMaxWarning: string | null;
}

export interface EvaluateContext {
  recipeKcal: number;
  dryMatterG: number | null;
  /** Chiavi degli integratori presenti nella ricetta (il limite L vale per gli additivi). */
  supplementKeys: string[];
  legalMaxMode: LegalMaxMode;
  tolerance?: number;
}

/** Valuta un nutriente della ricetta rispetto ai fabbisogni, per 1.000 kcal. */
export function evaluateNutrient(
  total: NutrientTotal,
  req: Requirement,
  ctx: EvaluateContext,
): NutrientEvaluation {
  const valuePer1000 = total.value === null ? null : (total.value * 1000) / ctx.recipeKcal;

  // Massimo: si usa il più basso tra N, L convertito e quello modificato.
  const candidates: { kind: 'N' | 'L' | 'modificato'; value: number }[] = [];
  if (req.maxCustomPer1000 !== null) candidates.push({ kind: 'modificato', value: req.maxCustomPer1000 });
  if (req.maxNPer1000 !== null) candidates.push({ kind: 'N', value: req.maxNPer1000 });

  let legalMaxWarning: string | null = null;
  if (req.maxLPer100gDM !== null && ctx.dryMatterG !== null && ctx.dryMatterG > 0) {
    const lPer1000 = legalMaxPer1000Kcal(req.maxLPer100gDM, ctx.dryMatterG, ctx.recipeKcal);
    const fromAdditive = total.contributions.some((c) => ctx.supplementKeys.includes(c.key) && c.value > 0);
    if (fromAdditive || ctx.legalMaxMode === 'rosso') {
      candidates.push({ kind: 'L', value: lPer1000 });
    } else if (valuePer1000 !== null && valuePer1000 > lPer1000) {
      legalMaxWarning =
        'Sopra il massimo di legge FEDIAF, che vale per i nutrienti aggiunti come additivi: ' +
        'qui arriva solo da alimenti naturali.';
    }
  }
  const chosen = candidates.reduce<(typeof candidates)[number] | null>(
    (best, c) => (best === null || c.value < best.value ? c : best),
    null,
  );

  const limitsPer1000: Limits = { min: req.minPer1000, max: chosen?.value ?? null };
  const c = classify(valuePer1000, total.partial, limitsPer1000, ctx.tolerance);
  return { ...c, valuePer1000, limitsPer1000, maxKind: chosen?.kind ?? null, legalMaxWarning };
}

/** Riepilogo in alto, es. "2 rossi, 4 arancioni, 3 grigi". */
export function summarize(colors: Color[]): Record<Color, number> {
  const out: Record<Color, number> = { verde: 0, arancione: 0, rosso: 0, grigio: 0 };
  for (const c of colors) out[c]++;
  return out;
}
