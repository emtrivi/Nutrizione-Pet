// Revisione del 28/10/2026 (foglio "TRIPPA_FONTE_PROTEICA"): 51 voci esistenti modificate, nessuna nuova.
// Confronto con il catalogo pubblicato nella versione 0.5.2.
import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawFood } from '../catalog';
import { getCatalog, rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import { sanityWarnings } from '../recipes';
import v052 from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-28_v0.5.2.json';

const catalog = getCatalog();
const food = (id: string) => catalog.get(`food:${id}`)!;
const before = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-28.json', data: v052 as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const old = (id: string) => before.get(`food:${id}`)!;
const pair = (p: string) => [`${p}_cdb`, `${p}_igea`];

describe('cosa cambia', () => {
  it('152 voci, stessi codici; 101 identiche', () => {
    expect(catalog.foods.map((f) => f.id)).toEqual(before.foods.map((f) => f.id));
    const same = before.foods.filter((f) => JSON.stringify(food(f.id)) === JSON.stringify(f));
    expect(same).toHaveLength(101);
  });
  it('milza CDB/Igea tra le frattaglie; trippe e durelli nella fonte proteica', () => {
    for (const id of pair('beef_spleen')) expect(food(id).recipeCategory).toBe('frattaglie');
    for (const id of ['beef_tripe_raw', ...pair('beef_tripe_raw'), ...pair('lamb_tripe'), ...pair('chicken_gizzards')]) {
      expect(food(id).recipeCategory).toBe('proteica');
    }
    expect(old('beef_tripe_raw').recipeCategory).toBe('frattaglie');
  });
  it('cambiare solo la sezione non rende "da rivedere" (stessa impronta dei valori)', () => {
    for (const id of ['beef_tripe_raw', ...pair('lamb_tripe'), ...pair('beef_tripe_raw')]) {
      expect(food(id).fingerprint).toBe(old(id).fingerprint);
    }
    for (const id of [...pair('chicken_wings'), ...pair('turkey_meat_pieces'), ...pair('beef_spleen')]) {
      expect(food(id).fingerprint).not.toBe(old(id).fingerprint);
    }
  });
  it('calcio e fosforo nuovi per 100 g: ali di pollo 2.167,94 / 1.078,42 mg; colli di tacchino 2.128,2 / 1.078 mg', () => {
    expect(food('chicken_wings_cdb').nutrients.calcium!.value).toBeCloseTo(0.0216794, 10);
    expect(food('chicken_wings_cdb').nutrients.phosphorus!.value).toBeCloseTo(0.0107842, 10);
    expect(food('turkey_necks_igea').nutrients.calcium!.value).toBeCloseTo(0.021282, 10);
    expect(old('chicken_wings_cdb').nutrients.calcium).toBeUndefined();
  });
  it('polpa di tacchino: micronutrienti da carne cruda (calcio 17 → 11 mg, zinco 3,51 → 1,25 mg per 100 g), kcal invariate', () => {
    expect(food('turkey_meat_pieces_cdb').nutrients.calcium!.value).toBeCloseTo(0.00011, 12);
    expect(food('turkey_meat_pieces_cdb').nutrients.zinc!.value).toBeCloseTo(0.0125, 10);
    expect(food('turkey_meat_pieces_cdb').kcalPerUnit).toBe(old('turkey_meat_pieces_cdb').kcalPerUnit);
  });
  it('kcal di tutte le voci invariate', () => {
    for (const f of before.foods) expect(food(f.id).kcalPerUnit).toBe(f.kcalPerUnit);
  });
});

describe('controllo delle frattaglie', () => {
  const settings = { mealPctOfBodyWeight: 6, vegetablesPctOfFood: 30, liverPctOfFood: 5, otherOffalPctOfFood: 5 };
  it('200 g di trippa su 1.000 g non fanno più scattare "altre frattaglie"', () => {
    const lines = [
      { key: 'food:beef_10', amount: 800 },
      { key: 'food:beef_tripe_raw_cdb', amount: 200 },
    ];
    expect(sanityWarnings(lines, catalog, 30, settings).some((w) => w.includes('altre frattaglie'))).toBe(false);
  });
  it('60 g di milza CDB su 1.000 g (6%) sì', () => {
    const lines = [
      { key: 'food:beef_10', amount: 940 },
      { key: 'food:beef_spleen_cdb', amount: 60 },
    ];
    expect(sanityWarnings(lines, catalog, 30, settings).some((w) => w.includes('altre frattaglie'))).toBe(true);
  });
});
