// Catalogo alimenti del 27/10/2026: tre ricotte (vaccina, pecora, capra). Le 115 voci di prima restano identiche.
// Kcal come il resto del catalogo, 4 × proteine + 9 × grassi + 4 × carboidrati disponibili:
//   vaccina  4 × 8,8 + 9 × 10,9 + 4 × 3,5 = 35,2 + 98,1  + 14   = 147,3  (CREA 146)
//   pecora   4 × 9,5 + 9 × 11,5 + 4 × 4,2 = 38   + 103,5 + 16,8 = 158,3  (CREA 157)
//   capra    4 × 9   + 9 × 11   + 4 × 5   = 36   + 99    + 20   = 155    (produttore 155)
import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawFood } from '../catalog';
import { rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import afterImport from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-27.json';
import before115 from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-26.json';

// Catalogo come uscito da questa importazione (archiviato): le modifiche successive non cambiano questi controlli.
const catalog = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-27.json', data: afterImport as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const food = (id: string) => catalog.get(`food:${id}`)!;
const before = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-26.json', data: before115 as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});

describe('le 115 voci di prima non cambiano', () => {
  it('stesse voci, stessa impronta: nessuna ricetta diventa "da rivedere"', () => {
    expect(before.foods).toHaveLength(115);
    for (const old of before.foods) expect(food(old.id)).toEqual(old);
  });
  it('3 ricotte dopo le 115', () => {
    expect(catalog.foods.slice(115, 118).map((f) => f.id)).toEqual(['ricotta_vaccina', 'ricotta_pecora', 'ricotta_capra']);
  });
});

describe('ricotte', () => {
  it('kcal per 1 g', () => {
    expect(food('ricotta_vaccina').kcalPerUnit).toBeCloseTo(1.473, 10);
    expect(food('ricotta_pecora').kcalPerUnit).toBeCloseTo(1.583, 10);
    expect(food('ricotta_capra').kcalPerUnit).toBeCloseTo(1.55, 10);
  });
  it('fonte proteica, selezionabili; vaccina e capra indicative, pecora no', () => {
    for (const id of ['ricotta_vaccina', 'ricotta_pecora', 'ricotta_capra']) {
      expect(food(id).recipeCategory).toBe('proteica');
      expect(food(id).availableForNewRecipes).toBe(true);
    }
    expect(food('ricotta_vaccina').indicative).toBe(true);
    expect(food('ricotta_pecora').indicative).toBe(false);
    expect(food('ricotta_capra').indicative).toBe(true);
  });
  it('vaccina: calcio 295 mg e fosforo 237 mg per 100 g; vitamina E 0,21 mg × 1,49 = 0,3129 UI', () => {
    expect(food('ricotta_vaccina').nutrients.calcium!.value).toBeCloseTo(0.00295, 10);
    expect(food('ricotta_vaccina').nutrients.phosphorus!.value).toBeCloseTo(0.00237, 10);
    expect(food('ricotta_vaccina').nutrients.vitamin_e!.value).toBeCloseTo(0.003129, 9);
  });
  it('vitamina A dal retinolo: pecora 260 µg ÷ 0,3 = 866,7 UI/100 g', () => {
    expect(food('ricotta_pecora').nutrients.vitamin_a!.value).toBeCloseTo(8.6667, 4);
  });
  it('capra: solo proteine, grassi e carboidrati; calcio e fosforo sconosciuti (non zero)', () => {
    expect(food('ricotta_capra').nutrients.protein!.value).toBeCloseTo(0.09, 10);
    expect(food('ricotta_capra').nutrients.calcium).toBeUndefined();
    expect(food('ricotta_capra').nutrients.phosphorus).toBeUndefined();
  });
});
