// Modulo del cane: dal testo scritto dall'utente ai dati del cane, con controlli in italiano.
// Nessuna dipendenza dall'interfaccia: si prova con i test.

import type { ActivityLevel, Dog, FediafTable, MuscleScore } from '../engine';

/** Numero scritto all'italiana ("12,5") o all'inglese ("12.5"). Vuoto → undefined. */
export function parseDecimal(text: string): number | undefined | 'invalid' {
  const t = text.trim().replace(/\s/g, '');
  if (t === '') return undefined;
  if (!/^\d+([.,]\d+)?$/.test(t)) return 'invalid';
  return Number(t.replace(',', '.'));
}

/** Numero nel formato da mostrare nei campi ("12,5"). */
export function decimalToText(value: number | undefined): string {
  return value === undefined ? '' : String(value).replace('.', ',');
}

export interface DogFormValues {
  name: string;
  age: string;
  weight: string;
  idealWeight: string;
  useIdealWeight: boolean;
  neutered: boolean;
  breed: string;
  size: string;
  bcs: number | null;
  mcs: MuscleScore | null;
  activity: ActivityLevel;
  multiplier: string;
  manualKcal: string;
  table: 'auto' | FediafTable;
  notes: string;
}

export const EMPTY_DOG_FORM: DogFormValues = {
  name: '',
  age: '',
  weight: '',
  idealWeight: '',
  useIdealWeight: false,
  neutered: true,
  breed: '',
  size: '',
  bcs: null,
  mcs: null,
  activity: 'normale',
  multiplier: '',
  manualKcal: '',
  table: 'auto',
  notes: '',
};

export function dogToForm(dog: Dog): DogFormValues {
  return {
    name: dog.name,
    age: decimalToText(dog.ageYears),
    weight: decimalToText(dog.weightKg),
    idealWeight: decimalToText(dog.idealWeightKg),
    useIdealWeight: dog.useIdealWeight,
    neutered: dog.neutered,
    breed: dog.breed ?? '',
    size: dog.size ?? '',
    bcs: dog.bcs ?? null,
    mcs: dog.mcs ?? null,
    activity: dog.activity,
    multiplier: decimalToText(dog.multiplierOverride),
    manualKcal: decimalToText(dog.manualKcal),
    table: dog.fediafTableOverride ?? 'auto',
    notes: dog.notes ?? '',
  };
}

/** Campi del cane ricavati dal modulo (senza id e date). */
export type DogFields = Omit<Dog, 'id' | 'createdAt' | 'updatedAt'>;

export type DogFormResult = { ok: true; fields: DogFields } | { ok: false; errors: Partial<Record<keyof DogFormValues, string>> };

function numberField(
  text: string,
  label: string,
  opts: { required?: boolean; min: number; max: number },
): { value?: number; error?: string } {
  const v = parseDecimal(text);
  if (v === undefined) return opts.required ? { error: `Scrivi ${label}.` } : {};
  if (v === 'invalid') return { error: `${label[0]!.toUpperCase()}${label.slice(1)}: scrivi solo un numero, es. 12,5.` };
  if (v < opts.min || v > opts.max) {
    return { error: `${label[0]!.toUpperCase()}${label.slice(1)}: deve essere tra ${decimalToText(opts.min)} e ${decimalToText(opts.max)}.` };
  }
  return { value: v };
}

export function validateDogForm(f: DogFormValues): DogFormResult {
  const errors: Partial<Record<keyof DogFormValues, string>> = {};
  const name = f.name.trim();
  if (!name) errors.name = 'Scrivi il nome del cane.';

  const weight = numberField(f.weight, 'il peso attuale', { required: true, min: 0.5, max: 120 });
  const ideal = numberField(f.idealWeight, 'il peso ideale', { min: 0.5, max: 120 });
  const age = numberField(f.age, 'l’età', { min: 0, max: 30 });
  const mult = numberField(f.multiplier, 'il moltiplicatore', { min: 0.8, max: 3 });
  const kcal = numberField(f.manualKcal, 'le kcal al giorno', { min: 100, max: 10000 });
  if (weight.error) errors.weight = weight.error;
  if (ideal.error) errors.idealWeight = ideal.error;
  if (age.error) errors.age = age.error;
  if (mult.error) errors.multiplier = mult.error;
  if (kcal.error) errors.manualKcal = kcal.error;
  if (f.useIdealWeight && ideal.value === undefined && !ideal.error) {
    errors.idealWeight = 'Per usare il peso ideale, scrivilo qui.';
  }
  if (f.bcs !== null && (!Number.isInteger(f.bcs) || f.bcs < 1 || f.bcs > 9)) errors.bcs = 'BCS da 1 a 9.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const fields: DogFields = {
    name,
    weightKg: weight.value as number,
    useIdealWeight: f.useIdealWeight,
    neutered: f.neutered,
    activity: f.activity,
  };
  if (age.value !== undefined) fields.ageYears = age.value;
  if (ideal.value !== undefined) fields.idealWeightKg = ideal.value;
  if (f.breed.trim()) fields.breed = f.breed.trim();
  if (f.size.trim()) fields.size = f.size.trim();
  if (f.bcs !== null) fields.bcs = f.bcs;
  if (f.mcs !== null) fields.mcs = f.mcs;
  if (mult.value !== undefined) fields.multiplierOverride = mult.value;
  if (kcal.value !== undefined) fields.manualKcal = kcal.value;
  if (f.table !== 'auto') fields.fediafTableOverride = f.table;
  if (f.notes.trim()) fields.notes = f.notes.trim();
  return { ok: true, fields };
}
