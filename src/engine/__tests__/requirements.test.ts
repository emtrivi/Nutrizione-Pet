// Fabbisogni del cane d'esempio. Valori per 1.000 kcal letti dal file FEDIAF,
// moltiplicati a mano per kcal ÷ 1.000.
import { describe, expect, it } from 'vitest';
import { fediaf } from '../bundledData';
import { NUTRIENTS } from '../nutrients';
import { computeRequirements, legalMaxPer1000Kcal } from '../requirements';

const t95 = computeRequirements(fediaf, { table: 95, kcalPerDay: 1218 });
const t110 = computeRequirements(fediaf, { table: 110, kcalPerDay: 1410 });

describe('fabbisogni al giorno, tabella 95 a 1.218 kcal', () => {
  it.each([
    ['protein', 52.1, 63.4578], // 52,1 × 1,218
    ['fat', 13.75, 16.7475], // 13,75 × 1,218
    ['calcium', 1.45, 1.7661], // 1,45 × 1,218
    ['phosphorus', 1.16, 1.41288],
    ['zinc', 20.8, 25.3344],
    ['vitamin_a', 1754, 2136.372],
    ['selenium_wet', 67.5, 82.215], // riga "diete umide"
    ['lysine', 1.22, 1.48596],
    ['choline', 474, 577.332],
  ])('%s: %d per 1.000 kcal → %d al giorno', (id, per1000, perDay) => {
    const r = t95.byId[id]!;
    expect(r.minPer1000).toBe(per1000);
    expect(r.perDay.min).toBeCloseTo(perDay, 6);
  });

  it('massimi nutrizionali (N) al giorno', () => {
    expect(t95.byId.calcium!.perDay.maxN).toBeCloseTo(7.6125, 6); // 6,25 × 1,218
    expect(t95.byId.phosphorus!.perDay.maxN).toBeCloseTo(4.872, 6); // 4 × 1,218
    expect(t95.byId.vitamin_a!.perDay.maxN).toBeCloseTo(121800, 6); // 100.000 × 1,218
    expect(t95.byId.vitamin_d!.perDay.maxN).toBeCloseTo(974.4, 6); // 800 × 1,218
  });
});

describe('fabbisogni al giorno, tabella 110 a 1.410 kcal', () => {
  it.each([
    ['protein', 45, 63.45],
    ['fat', 13.75, 19.3875],
    ['calcium', 1.25, 1.7625],
    ['zinc', 18, 25.38],
    ['vitamin_a', 1515, 2136.15],
    ['selenium_wet', 57.5, 81.075],
  ])('%s: %d per 1.000 kcal → %d al giorno', (id, per1000, perDay) => {
    const r = t110.byId[id]!;
    expect(r.minPer1000).toBe(per1000);
    expect(r.perDay.min).toBeCloseTo(perDay, 6);
  });

  it('le due tabelle danno quasi gli stessi grammi al giorno (grassi esclusi)', () => {
    expect(t95.byId.protein!.perDay.min! - t110.byId.protein!.perDay.min!).toBeCloseTo(0.0078, 4);
  });
});

describe('struttura dei fabbisogni', () => {
  it('ogni nutriente FEDIAF del dizionario esiste nel file', () => {
    const ids = new Set(fediaf.riferimenti.map((r) => r.id));
    for (const n of NUTRIENTS.filter((x) => x.inFediaf)) expect(ids.has(n.id)).toBe(true);
  });

  it('cinque gruppi nell’ordine delle specifiche', () => {
    expect(t95.groups.map((g) => g.label)).toEqual([
      'Proteine e aminoacidi',
      'Grassi e acidi grassi',
      'Minerali',
      'Vitamine',
      'Fibra, carboidrati e acqua',
    ]);
    expect(t95.groups[4]!.items.every((i) => i.informative)).toBe(true);
  });

  it('il selenio “diete secche” non si usa', () => {
    expect(t95.byId.selenium_dry).toBeUndefined();
  });

  it('trattino FEDIAF: nessun minimo, mai zero', () => {
    for (const id of ['biotin', 'vitamin_k', 'arachidonic_acid', 'alpha_linolenic_acid', 'epa_dha']) {
      expect(t95.byId[id]!.minPer1000).toBeNull();
      expect(t95.byId[id]!.informative).toBe(true);
    }
  });

  it('cloruro: c’è il minimo anche se nessun alimento ha il dato', () => {
    expect(t95.byId.chloride!.minPer1000).toBe(0.43);
  });

  it('massimi di legge e tipo di massimo', () => {
    expect(t95.byId.zinc!.maxLPer100gDM).toBe(22.7);
    expect(t95.byId.zinc!.maxType).toBe('L');
    expect(t95.byId.vitamin_d!.maxType).toBe('N_e_L');
  });

  it('rapporto calcio/fosforo da 1 a 2', () => {
    expect(t95.caPRatio).toMatchObject({ min: 1, max: 2 });
  });

  it('livelli sicuri di sodio e cloruro, non massimi', () => {
    expect(t95.safeLevels.map((s) => s.value)).toEqual([3.75, 5.87]);
  });
});

describe('modifiche e opzioni', () => {
  it('aumento del 10% degli aminoacidi (spento di serie)', () => {
    const r = computeRequirements(fediaf, { table: 95, kcalPerDay: 1218, aminoAcidDigestibilityIncrease: true });
    expect(r.byId.lysine!.minPer1000).toBeCloseTo(1.342, 10); // 1,22 × 1,1
    expect(r.byId.lysine!.digestibilityIncreaseApplied).toBe(true);
    expect(r.byId.protein!.minPer1000).toBe(52.1); // le proteine non cambiano
    expect(t95.byId.lysine!.minPer1000).toBe(1.22);
  });

  it('valore modificato a mano è segnato; senza modifica torna FEDIAF', () => {
    const r = computeRequirements(fediaf, {
      table: 95,
      kcalPerDay: 1218,
      overrides: { protein: { min: 60 }, calcium: { max: 3 } },
    });
    expect(r.byId.protein!.minPer1000).toBe(60);
    expect(r.byId.protein!.fediafMinPer1000).toBe(52.1);
    expect(r.byId.protein!.modified).toBe(true);
    expect(r.byId.protein!.perDay.min).toBeCloseTo(73.08, 6);
    expect(r.byId.calcium!.maxCustomPer1000).toBe(3);
    expect(t95.byId.protein!.modified).toBe(false);
  });
});

describe('massimo di legge convertito per 1.000 kcal', () => {
  it('zinco: 22,7 mg/100 g SS, 400 g SS, 1.218 kcal', () => {
    // 22,7 × 400 × 10 ÷ 1.218 = 90.800 ÷ 1.218 = 74,548
    expect(legalMaxPer1000Kcal(22.7, 400, 1218)).toBeCloseTo(74.548, 3);
  });
  it('controllo: 4.000 kcal per kg di SS → L × 0,25', () => {
    // 1 kg SS a 4.000 kcal: zinco 22,7 × 10 ÷ 4 = 56,75 mg/1.000 kcal
    expect(legalMaxPer1000Kcal(22.7, 1000, 4000)).toBeCloseTo(56.75, 10);
  });
});
