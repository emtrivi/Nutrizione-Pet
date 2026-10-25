// Bozza della ricetta mentre la si costruisce (passi 1-4). Si salva solo con "Salva".

import { parseDecimal } from '../../data/dogForm';
import {
  computeDogEnergy,
  dogSnapshot,
  metabolicWeight,
  proposedFediafTable,
  type Catalog,
  type Dog,
  type FediafTable,
  type Recipe,
  type RequirementOverride,
  type Settings,
} from '../../engine';

export interface DraftLine {
  key: string;
  /** null = grammi non ancora proposti (si calcolano entrando nel passo 4). */
  amount: number | null;
}

export interface Draft {
  id: string | null;
  name: string;
  dogId: string;
  /** Vuoto = kcal del cane. */
  kcalText: string;
  tableMode: 'auto' | FediafTable;
  overrides: Record<string, RequirementOverride>;
  foods: DraftLine[];
  supplements: DraftLine[];
  createdAt: string | null;
}

export function newDraft(dog: Dog): Draft {
  return {
    id: null,
    name: '',
    dogId: dog.id,
    kcalText: '',
    tableMode: 'auto',
    overrides: {},
    foods: [],
    supplements: [],
    createdAt: null,
  };
}

export function draftFromRecipe(r: Recipe, dog: Dog | undefined, multipliers: Settings['multipliers']): Draft {
  const dogKcal = dog ? computeDogEnergy(dog, multipliers ?? undefined).kcalPerDay : null;
  const sameKcal = dogKcal !== null && Math.abs(dogKcal - r.kcalTarget) < 0.5;
  return {
    id: r.id,
    name: r.name,
    dogId: r.dogId,
    kcalText: sameKcal ? '' : String(Math.round(r.kcalTarget)),
    tableMode: r.table,
    overrides: { ...r.requirementOverrides },
    foods: r.lines.filter((l) => l.key.startsWith('food:')).map((l) => ({ key: l.key, amount: l.amount })),
    supplements: r.lines.filter((l) => l.key.startsWith('supplement:')).map((l) => ({ key: l.key, amount: l.amount })),
    createdAt: r.createdAt,
  };
}

/** Calorie e tabella della ricetta, con la tabella proposta come per il cane. */
export function draftEnergy(draft: Draft, dog: Dog, multipliers: Settings['multipliers']) {
  const e = computeDogEnergy(dog, multipliers ?? undefined);
  const typed = parseDecimal(draft.kcalText);
  const kcalTarget = typeof typed === 'number' && typed > 0 ? typed : e.kcalPerDay;
  const factor = kcalTarget / metabolicWeight(e.weightUsedKg);
  const p = proposedFediafTable(factor);
  const table: FediafTable = draft.tableMode === 'auto' ? p.table : draft.tableMode;
  return {
    dogEnergy: e,
    kcalTarget,
    kcalFromDog: !(typeof typed === 'number' && typed > 0),
    kcalInvalid: typed === 'invalid',
    factorRounded: p.factorRounded,
    proposedTable: p.table,
    belowReference: p.belowReference,
    table,
  };
}

export function draftLines(draft: Draft): { key: string; amount: number }[] {
  return [...draft.foods, ...draft.supplements].map((l) => ({ key: l.key, amount: l.amount ?? 0 }));
}

export function draftToRecipe(
  draft: Draft,
  dog: Dog,
  catalog: Catalog,
  id: string,
  now: Date,
  multipliers: Settings['multipliers'],
): Recipe {
  const en = draftEnergy(draft, dog, multipliers);
  return {
    id,
    name: draft.name.trim(),
    dogId: dog.id,
    kcalTarget: en.kcalTarget,
    table: en.table,
    requirementOverrides: draft.overrides,
    lines: draftLines(draft)
      .filter((l) => l.amount > 0)
      .map((l) => ({ ...l, fingerprint: catalog.get(l.key)?.fingerprint ?? '' })),
    catalogVersion: catalog.version.label,
    // Salvare vuol dire averla controllata: da qui si misurano i cambiamenti futuri.
    reviewedAgainst: dogSnapshot(dog, multipliers),
    createdAt: draft.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
