// Dose di partenza degli integratori, dalla tabella del produttore.
// Le dosi sono indicazioni d'uso, mai limiti tossicologici: niente blocca.

import type { CatalogItem, RawDosePoint } from './catalog';

export type DoseSuggestion =
  | {
      kind: 'range';
      min: number;
      max: number;
      unit: 'g' | 'capsule';
      /** Fuori dall'intervallo coperto dal produttore. */
      extrapolated: boolean;
      /** Misura di casa, es. misurino raso da 3 g. */
      householdMeasure: { label: string; grams: number; min: number; max: number } | null;
    }
  | {
      kind: 'band';
      max: number;
      unit: 'g' | 'capsule';
      bandLabel: string;
      /** Valore scritto solo nella nota del produttore. */
      fromNoteOnly: boolean;
    }
  | { kind: 'none'; reason: string };

/** Interpolazione lineare; fuori dai punti prolunga il segmento più vicino. */
export function interpolate(points: { x: number; y: number }[], x: number): number {
  if (points.length === 0) throw new Error('Nessun punto per interpolare');
  const pts = [...points].sort((a, b) => a.x - b.x);
  const first = pts[0] as { x: number; y: number };
  if (pts.length === 1) return first.y;
  let a = first;
  let b = pts[1] as { x: number; y: number };
  for (let i = 1; i < pts.length; i++) {
    a = pts[i - 1] as { x: number; y: number };
    b = pts[i] as { x: number; y: number };
    if (x <= b.x) break;
  }
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

function series(points: RawDosePoint[], field: 'min' | 'max'): { x: number; y: number }[] {
  return points
    .filter((p) => typeof p[field] === 'number')
    .map((p) => ({ x: p.weight_kg, y: p[field] as number }));
}

/** Arrotonda all'intero per le capsule. */
export function roundDose(item: Pick<CatalogItem, 'integerDose'>, dose: number): number {
  return item.integerDose ? Math.round(dose) : dose;
}

export function suggestDose(item: CatalogItem, weightKg: number): DoseSuggestion {
  const rule = item.doseRule;
  if (rule.kind === 'none') return { kind: 'none', reason: rule.reason };

  if (rule.kind === 'bands') {
    const band = rule.bands.find((b) => b.upToKg === null || weightKg <= b.upToKg);
    if (!band) return { kind: 'none', reason: 'Nessuna fascia per questo peso.' };
    const prev = rule.bands[rule.bands.indexOf(band) - 1];
    const bandLabel =
      band.upToKg === null ? `oltre ${prev?.upToKg ?? 0} kg` : `fino a ${band.upToKg} kg`;
    return { kind: 'band', max: band.max, unit: item.doseUnit, bandLabel, fromNoteOnly: band.fromNoteOnly };
  }

  const mins = series(item.dosePoints, 'min');
  const maxs = series(item.dosePoints, 'max');
  if (mins.length === 0 || maxs.length === 0) {
    return { kind: 'none', reason: 'Tabella del produttore incompleta.' };
  }
  const min = roundDose(item, Math.max(0, interpolate(mins, weightKg)));
  const max = roundDose(item, Math.max(0, interpolate(maxs, weightKg)));
  const extrapolated = weightKg < rule.officialFromKg || weightKg > rule.officialToKg;
  const hm = rule.householdMeasure;
  return {
    kind: 'range',
    min,
    max,
    unit: item.doseUnit,
    extrapolated,
    householdMeasure: hm ? { ...hm, min: min / hm.grams, max: max / hm.grams } : null,
  };
}

/** Posizione della dose rispetto al massimo consigliato: la parte oltre è rossa, ma non blocca. */
export function doseStatus(dose: number, suggestion: DoseSuggestion): 'entro' | 'oltre_massimo_produttore' | 'nessuna_indicazione' {
  if (suggestion.kind === 'none') return 'nessuna_indicazione';
  return dose > suggestion.max + 1e-9 ? 'oltre_massimo_produttore' : 'entro';
}
