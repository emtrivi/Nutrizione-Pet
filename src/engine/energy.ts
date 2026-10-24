// Calorie del cane e scelta della tabella FEDIAF (95 o 110).

import type { ActivityLevel, Dog, FediafTable } from './types';

/** Moltiplicatori proposti (decisione A4), da confrontare con la nutrizionista. */
export const DEFAULT_MULTIPLIERS: Record<ActivityLevel, { sterilizzato: number; intero: number }> = {
  bassa: { sterilizzato: 1.4, intero: 1.6 },
  normale: { sterilizzato: 1.6, intero: 1.8 },
  alta: { sterilizzato: 2.0, intero: 2.0 },
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  bassa: 'Bassa (meno di 1 ora di attività leggera al giorno)',
  normale: 'Normale (1-3 ore di attività leggera al giorno)',
  alta: 'Alta (più di 3 ore o attività intensa)',
};

export const BELOW_REFERENCE_WARNING =
  'Calorie sotto il riferimento FEDIAF: i nutrienti totali potrebbero risultare insufficienti.';

/** Peso metabolico: kg^0,75. */
export function metabolicWeight(kg: number): number {
  if (!(kg > 0)) throw new Error('Il peso deve essere maggiore di zero');
  return Math.pow(kg, 0.75);
}

/** Fabbisogno a riposo: RER = 70 × kg^0,75. */
export function rer(kg: number): number {
  return 70 * metabolicWeight(kg);
}

/** Moltiplicatore proposto in base ad attività e sterilizzazione. */
export function proposedMultiplier(
  activity: ActivityLevel,
  neutered: boolean,
  table = DEFAULT_MULTIPLIERS,
): number {
  const row = table[activity];
  return neutered ? row.sterilizzato : row.intero;
}

/** Fattore = kcal al giorno ÷ kg^0,75. */
export function energyFactor(kcalPerDay: number, kg: number): number {
  return kcalPerDay / metabolicWeight(kg);
}

/**
 * Tabella FEDIAF proposta (decisione A2): si confronta il fattore arrotondato
 * all'intero, cioè il numero che si vede sullo schermo.
 * 110 o più → tabella 110; sotto → tabella 95 (la più severa).
 */
export function proposedFediafTable(factor: number): {
  table: FediafTable;
  factorRounded: number;
  belowReference: boolean;
} {
  const factorRounded = Math.round(factor);
  return {
    table: factorRounded >= 110 ? 110 : 95,
    factorRounded,
    belowReference: factorRounded < 95,
  };
}

export interface DogEnergy {
  /** Peso usato per i calcoli (attuale o ideale, decisione A3). */
  weightUsedKg: number;
  weightSource: 'attuale' | 'ideale';
  metabolicWeight: number;
  rer: number;
  /** Moltiplicatore usato (null se le kcal sono scritte a mano). */
  multiplier: number | null;
  multiplierSource: 'proposto' | 'modificato' | null;
  proposedMultiplier: number;
  kcalPerDay: number;
  kcalSource: 'calcolate' | 'scritte_a_mano';
  factor: number;
  factorRounded: number;
  proposedTable: FediafTable;
  table: FediafTable;
  tableSource: 'proposta' | 'scelta_a_mano';
  belowReference: boolean;
  warnings: string[];
}

export function computeDogEnergy(
  dog: Pick<
    Dog,
    | 'weightKg'
    | 'idealWeightKg'
    | 'useIdealWeight'
    | 'activity'
    | 'neutered'
    | 'multiplierOverride'
    | 'manualKcal'
    | 'fediafTableOverride'
  >,
  multipliers = DEFAULT_MULTIPLIERS,
): DogEnergy {
  const useIdeal = dog.useIdealWeight && dog.idealWeightKg !== undefined && dog.idealWeightKg > 0;
  const weightUsedKg = useIdeal ? (dog.idealWeightKg as number) : dog.weightKg;
  const mw = metabolicWeight(weightUsedKg);
  const r = 70 * mw;
  const proposed = proposedMultiplier(dog.activity, dog.neutered, multipliers);

  let kcalPerDay: number;
  let multiplier: number | null;
  let multiplierSource: DogEnergy['multiplierSource'];
  let kcalSource: DogEnergy['kcalSource'];
  if (dog.manualKcal !== undefined && dog.manualKcal > 0) {
    kcalPerDay = dog.manualKcal;
    multiplier = null;
    multiplierSource = null;
    kcalSource = 'scritte_a_mano';
  } else {
    multiplier = dog.multiplierOverride ?? proposed;
    multiplierSource = dog.multiplierOverride !== undefined ? 'modificato' : 'proposto';
    kcalPerDay = r * multiplier;
    kcalSource = 'calcolate';
  }

  const factor = kcalPerDay / mw;
  const p = proposedFediafTable(factor);
  const table = dog.fediafTableOverride ?? p.table;
  const warnings: string[] = [];
  if (p.belowReference) warnings.push(BELOW_REFERENCE_WARNING);
  if (dog.useIdealWeight && !useIdeal) {
    warnings.push('Peso ideale non indicato: si usa il peso attuale.');
  }

  return {
    weightUsedKg,
    weightSource: useIdeal ? 'ideale' : 'attuale',
    metabolicWeight: mw,
    rer: r,
    multiplier,
    multiplierSource,
    proposedMultiplier: proposed,
    kcalPerDay,
    kcalSource,
    factor,
    factorRounded: p.factorRounded,
    proposedTable: p.table,
    table,
    tableSource: dog.fediafTableOverride !== undefined ? 'scelta_a_mano' : 'proposta',
    belowReference: p.belowReference,
    warnings,
  };
}
