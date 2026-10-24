// Cane d'esempio delle specifiche: 30 kg.
// Calcoli a mano:
//   30^0,75 = e^(0,75 × ln 30) = e^(0,75 × 3,401197) = e^2,550898 = 12,818610
//   RER = 70 × 12,818610 = 897,30 kcal
//   1.218 ÷ 12,818610 = 95,018  → arrotondato 95  → tabella 95
//   1.410 ÷ 12,818610 = 109,996 → arrotondato 110 → tabella 110 (decisione A2)
import { describe, expect, it } from 'vitest';
import {
  BELOW_REFERENCE_WARNING,
  computeDogEnergy,
  energyFactor,
  metabolicWeight,
  proposedFediafTable,
  proposedMultiplier,
  rer,
} from '../energy';
import type { Dog } from '../types';

const dog30 = (over: Partial<Dog> = {}) => ({
  weightKg: 30,
  useIdealWeight: false,
  activity: 'normale' as const,
  neutered: true,
  ...over,
});

describe('calorie del cane d’esempio (30 kg)', () => {
  it('peso metabolico e RER', () => {
    expect(metabolicWeight(30)).toBeCloseTo(12.81861, 5);
    expect(rer(30)).toBeCloseTo(897.30, 2);
  });

  it('1.218 kcal → fattore 95 → tabella 95', () => {
    const e = computeDogEnergy(dog30({ manualKcal: 1218 }));
    expect(e.factor).toBeCloseTo(95.018, 3);
    expect(e.factorRounded).toBe(95);
    expect(e.table).toBe(95);
    expect(e.belowReference).toBe(false);
    expect(e.warnings).toEqual([]);
    expect(e.kcalSource).toBe('scritte_a_mano');
    expect(e.multiplier).toBeNull();
  });

  it('1.410 kcal → fattore 109,996, arrotondato 110 → tabella 110', () => {
    const e = computeDogEnergy(dog30({ manualKcal: 1410 }));
    expect(e.factor).toBeCloseTo(109.996, 3);
    expect(e.factor).toBeLessThan(110); // senza arrotondamento sarebbe la 95
    expect(e.factorRounded).toBe(110);
    expect(e.table).toBe(110);
  });

  it('moltiplicatore 1,6 = 112 per kg^0,75 e 1,4 = 98', () => {
    expect(70 * 1.6).toBeCloseTo(112, 10);
    expect(70 * 1.4).toBeCloseTo(98, 10);
    // 1,6 × 897,30 = 1.435,68 kcal → fattore 112 → tabella 110
    const e16 = computeDogEnergy(dog30({ activity: 'normale', neutered: true }));
    expect(e16.multiplier).toBe(1.6);
    expect(e16.multiplierSource).toBe('proposto');
    expect(e16.kcalPerDay).toBeCloseTo(1435.68, 2);
    expect(e16.factorRounded).toBe(112);
    expect(e16.table).toBe(110);
    // 1,4 × 897,30 = 1.256,22 kcal → fattore 98 → tabella 95
    const e14 = computeDogEnergy(dog30({ activity: 'bassa', neutered: true }));
    expect(e14.multiplier).toBe(1.4);
    expect(e14.kcalPerDay).toBeCloseTo(1256.22, 2);
    expect(e14.factorRounded).toBe(98);
    expect(e14.table).toBe(95);
  });

  it('tabella dei moltiplicatori proposti (decisione A4)', () => {
    expect(proposedMultiplier('bassa', true)).toBe(1.4);
    expect(proposedMultiplier('bassa', false)).toBe(1.6);
    expect(proposedMultiplier('normale', true)).toBe(1.6);
    expect(proposedMultiplier('normale', false)).toBe(1.8);
    expect(proposedMultiplier('alta', true)).toBe(2.0);
    expect(proposedMultiplier('alta', false)).toBe(2.0);
  });

  it('moltiplicatore modificato dall’utente', () => {
    // 1,5 × 897,30 = 1.345,95 kcal → fattore 105 → tabella 95
    const e = computeDogEnergy(dog30({ multiplierOverride: 1.5 }));
    expect(e.multiplier).toBe(1.5);
    expect(e.multiplierSource).toBe('modificato');
    expect(e.kcalPerDay).toBeCloseTo(1345.95, 2);
    expect(e.factorRounded).toBe(105);
    expect(e.table).toBe(95);
  });

  it('sotto 95: tabella 95 con avviso', () => {
    // 1.100 ÷ 12,81861 = 85,81 → 86
    const e = computeDogEnergy(dog30({ manualKcal: 1100 }));
    expect(e.factorRounded).toBe(86);
    expect(e.table).toBe(95);
    expect(e.belowReference).toBe(true);
    expect(e.warnings).toContain(BELOW_REFERENCE_WARNING);
  });

  it('la tabella si può cambiare a mano', () => {
    const e = computeDogEnergy(dog30({ manualKcal: 1410, fediafTableOverride: 95 }));
    expect(e.proposedTable).toBe(110);
    expect(e.table).toBe(95);
    expect(e.tableSource).toBe('scelta_a_mano');
  });
});

describe('arrotondamento del fattore (decisione A2)', () => {
  it('confronto sull’intero', () => {
    expect(proposedFediafTable(109.49).table).toBe(95);
    expect(proposedFediafTable(109.5).table).toBe(110);
    expect(proposedFediafTable(94.5).belowReference).toBe(false);
    expect(proposedFediafTable(94.49).belowReference).toBe(true);
  });
});

describe('peso usato per le calorie (decisione A3)', () => {
  it('peso attuale, salvo interruttore sul peso ideale', () => {
    const attuale = computeDogEnergy(dog30({ weightKg: 33, idealWeightKg: 30, manualKcal: 1218 }));
    expect(attuale.weightUsedKg).toBe(33);
    expect(attuale.weightSource).toBe('attuale');
    // 33^0,75 = 13,7685 → 1.218 ÷ 13,7685 = 88,46
    expect(attuale.factor).toBeCloseTo(88.46, 2);

    const ideale = computeDogEnergy(
      dog30({ weightKg: 33, idealWeightKg: 30, useIdealWeight: true, manualKcal: 1218 }),
    );
    expect(ideale.weightUsedKg).toBe(30);
    expect(ideale.weightSource).toBe('ideale');
    expect(ideale.factor).toBeCloseTo(95.018, 3);
  });

  it('interruttore acceso senza peso ideale: usa l’attuale e avvisa', () => {
    const e = computeDogEnergy(dog30({ useIdealWeight: true }));
    expect(e.weightUsedKg).toBe(30);
    expect(e.warnings).toContain('Peso ideale non indicato: si usa il peso attuale.');
  });

  it('peso non valido', () => {
    expect(() => metabolicWeight(0)).toThrow();
    expect(() => energyFactor(1000, -1)).toThrow();
  });
});
