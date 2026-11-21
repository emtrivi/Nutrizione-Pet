// Catalogo alimenti del 21/11/2026: 3 prodotti CDB, ciascuno come voce CDB e Igea (6 voci).
// Le 160 voci di prima restano identiche. Kcal 4 × proteine + 9 × grassi:
//   Armonia manzo e coniglio  4 × 52,9 + 9 × 12,7 = 211,6 + 114,3 = 325,9  (venditore 332)
//     ATTENZIONE: proteine 52,9% e acqua 33,2% come nell'etichetta; importate così su richiesta dell'utente
//   Armonia manzo e agnello   4 × 17,8 + 9 × 14,3 = 71,2  + 128,7 = 199,9  (venditore 190)
//   Polpa di tacchino macinata 4 × 22 + 9 × 7     = 88    + 63    = 151    (venditore 107)
import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawFood } from '../catalog';
import { getCatalog, rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import v055 from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-11-12.json';

const catalog = getCatalog();
const food = (id: string) => catalog.get(`food:${id}`)!;
const before = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-11-12.json', data: v055 as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const NEW = ['armonia_beef_rabbit_cdb', 'armonia_beef_lamb_cdb', 'turkey_ground_cdb', 'armonia_beef_rabbit_igea', 'armonia_beef_lamb_igea', 'turkey_ground_igea'];

describe('le 160 voci di prima non cambiano', () => {
  it('stesse voci, stessa impronta: nessuna ricetta diventa "da rivedere"', () => {
    expect(before.foods).toHaveLength(160);
    for (const old of before.foods) expect(food(old.id)).toEqual(old);
  });
  it('6 voci nuove in fondo', () => {
    expect(catalog.foods.slice(160).map((f) => f.id)).toEqual(NEW);
  });
});

describe('voci nuove', () => {
  it('kcal 4/9 per 1 g', () => {
    expect(food('armonia_beef_rabbit_cdb').kcalPerUnit).toBeCloseTo(3.259, 10);
    expect(food('armonia_beef_lamb_cdb').kcalPerUnit).toBeCloseTo(1.999, 10);
    expect(food('turkey_ground_cdb').kcalPerUnit).toBeCloseTo(1.51, 10);
  });
  it('fonte proteica, selezionabili, "dato indicativo"', () => {
    for (const id of NEW) {
      expect(food(id).recipeCategory).toBe('proteica');
      expect(food(id).availableForNewRecipes).toBe(true);
      expect(food(id).indicative).toBe(true);
    }
  });
  it('CDB e Igea: stessi valori', () => {
    for (const p of ['armonia_beef_rabbit', 'armonia_beef_lamb', 'turkey_ground']) {
      expect(food(`${p}_cdb`).fingerprint).toBe(food(`${p}_igea`).fingerprint);
    }
  });
  it('Armonia manzo e agnello: calcio 357,92 mg e fosforo 328,32 mg per 100 g (stima)', () => {
    expect(food('armonia_beef_lamb_cdb').nutrients.calcium!.value).toBeCloseTo(0.0035792, 10);
    expect(food('armonia_beef_lamb_cdb').nutrients.phosphorus!.value).toBeCloseTo(0.0032832, 10);
  });
});
