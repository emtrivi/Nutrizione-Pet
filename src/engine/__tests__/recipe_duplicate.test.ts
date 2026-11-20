// Duplicare una ricetta (20/11/2026). Ingredienti e quantità identici, nessuna scalatura.
// Altro cane: calorie obiettivo e tabella FEDIAF del nuovo cane. Stesso cane: niente cambia.
//
// Ricetta di Fido con 3.200 kcal scritte a mano e tabella 95 scelta a mano.
// Luna, 12 kg, sterilizzata, attività normale, senza kcal scritte a mano:
//   12^0,75 = 6,4474 · RER = 70 × 6,4474 = 451,32 · × 1,6 = 722,11 kcal
//   fattore 722,11 ÷ 6,4474 = 112 → tabella 110
// Luna con 1.200 kcal scritte a mano nel profilo: 1.200 kcal, fattore 186 → tabella 110.
import { describe, expect, it } from 'vitest';
import { duplicateRecipe, reviewReasons, type Recipe } from '../recipes';
import { getCatalog } from '../bundledData';
import type { Dog } from '../types';
import { draftEnergy, draftFromRecipe } from '../../ui/recipe/draft';

const now = new Date('2026-11-20T10:00:00Z');
const base = { useIdealWeight: false, neutered: true, activity: 'normale' as const, createdAt: '', updatedAt: '' };
const fido: Dog = { ...base, id: 'fido', name: 'Fido', weightKg: 30 };
const luna: Dog = { ...base, id: 'luna', name: 'Luna', weightKg: 12 };
const recipe: Recipe = {
  id: 'r1',
  name: 'Grande',
  dogId: 'fido',
  kcalTarget: 3200,
  table: 95,
  requirementOverrides: { calcium: { min: 1.5 } },
  lines: [
    { key: 'food:beef_mid_10', amount: 1200, fingerprint: 'f1' },
    { key: 'food:rice_white_cooked', amount: 600, fingerprint: 'f2' },
    { key: 'supplement:qdiet', amount: 9, fingerprint: 'f3' },
  ],
  catalogVersion: 'x',
  reviewedAgainst: { dogId: 'fido', weightKg: 30, kcalPerDay: 1435.68 },
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

describe('per un altro cane', () => {
  const copy = duplicateRecipe(recipe, 'r2', now, luna, null);
  it('calorie e tabella di Luna: 722,1 kcal, tabella 110', () => {
    expect(copy.kcalTarget).toBeCloseTo(722.11, 1);
    expect(copy.table).toBe(110);
    expect(copy.dogId).toBe('luna');
  });
  it('ingredienti e quantità identici, integratori compresi (nessuna scalatura)', () => {
    expect(copy.lines).toEqual(recipe.lines);
    expect(copy.requirementOverrides).toEqual(recipe.requirementOverrides);
  });
  it('aprendola, le calorie sono quelle del cane (come una ricetta nuova senza calorie scritte)', () => {
    const draft = draftFromRecipe(copy, luna, null);
    expect(draft.kcalText).toBe('');
    expect(draftEnergy(draft, luna, null).kcalTarget).toBeCloseTo(722.11, 1);
  });
  it('resta "da rivedere" come prima (copiata da un altro cane)', () => {
    expect(reviewReasons(copy, [fido, luna], getCatalog())).toContain('Ricetta copiata da un altro cane: controlla calorie e grammi.');
  });
  it('se il nuovo cane ha kcal scritte a mano nel profilo, si usano quelle: 1.200 kcal, tabella 110', () => {
    const c = duplicateRecipe(recipe, 'r3', now, { ...luna, manualKcal: 1200 }, null);
    expect(c.kcalTarget).toBe(1200);
    expect(c.table).toBe(110);
  });
  it('se il nuovo cane ha una tabella scelta a mano, si usa quella', () => {
    expect(duplicateRecipe(recipe, 'r4', now, { ...luna, fediafTableOverride: 95 }, null).table).toBe(95);
  });
});

describe('per lo stesso cane', () => {
  it('niente cambia: restano 3.200 kcal e la tabella 95 scritte a mano', () => {
    const same = duplicateRecipe(recipe, 'r5', now, fido, null);
    expect(same).toMatchObject({ kcalTarget: 3200, table: 95, dogId: 'fido', lines: recipe.lines, name: 'Grande (copia)' });
    const plain = duplicateRecipe(recipe, 'r6', now);
    expect(plain).toMatchObject({ kcalTarget: 3200, table: 95, dogId: 'fido' });
  });
});
