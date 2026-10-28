// Catalogo alimenti del 28/10/2026: 17 prodotti CDB, ciascuno come voce CDB e Igea (34 voci).
// Le 118 voci di prima restano identiche. Kcal del foglio già calcolate 4 × proteine + 9 × grassi:
//   ali di pollo       4 × 17,7 + 9 × 14,7 = 70,8 + 132,3 = 203,1
//   merluzzo macinato  4 × 13,6 + 9 × 0,6  = 54,4 + 5,4   = 59,8
//   trippa di bovino   4 × 15,3 + 9 × 5,1  = 61,2 + 45,9  = 107,1  (venditore 225)
//   fegati di coniglio 4 × 19,5 + 9 × 4,7  = 78   + 42,3  = 120,3
import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawFood } from '../catalog';
import { getCatalog, rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import before118 from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-27.json';

const catalog = getCatalog();
const food = (id: string) => catalog.get(`food:${id}`)!;
const before = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-27.json', data: before118 as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const NEW = catalog.foods.slice(118);

describe('le 118 voci di prima non cambiano', () => {
  it('stesse voci, stessa impronta: nessuna ricetta diventa "da rivedere"', () => {
    expect(before.foods).toHaveLength(118);
    for (const old of before.foods) expect(food(old.id)).toEqual(old);
  });
});

describe('34 voci nuove', () => {
  it('17 prodotti × CDB e Igea, stessi valori', () => {
    expect(NEW).toHaveLength(34);
    for (const cdb of NEW.filter((f) => f.id.endsWith('_cdb'))) {
      const igea = food(cdb.id.replace(/_cdb$/, '_igea'));
      expect(igea.fingerprint).toBe(cdb.fingerprint);
    }
  });
  it('tutte selezionabili nelle ricette, con "dato indicativo"', () => {
    for (const f of NEW) {
      expect(f.availableForNewRecipes).toBe(true);
      expect(f.indicative).toBe(true);
    }
  });
  it('kcal 4/9 per 1 g', () => {
    expect(food('chicken_wings_cdb').kcalPerUnit).toBeCloseTo(2.031, 10);
    expect(food('cod_ground_cdb').kcalPerUnit).toBeCloseTo(0.598, 10);
    expect(food('beef_tripe_raw_cdb').kcalPerUnit).toBeCloseTo(1.071, 10);
    expect(food('rabbit_liver_cdb').kcalPerUnit).toBeCloseTo(1.203, 10);
  });
  it('sezioni: fegati di coniglio frattaglie; cuori, merluzzo, salmone e carni fonte proteica', () => {
    expect(food('rabbit_liver_cdb').recipeCategory).toBe('frattaglie');
    for (const id of ['turkey_hearts_cdb', 'cod_ground_cdb', 'salmon_norwegian_ground_cdb', 'chicken_wings_cdb', 'beef_tripe_raw_cdb']) {
      expect(food(id).recipeCategory).toBe('proteica');
    }
  });
  it('quaglie con osso: calcio 1.443 mg e fosforo 813 mg per 100 g; ali di pollo: calcio sconosciuto (non zero)', () => {
    expect(food('quail_ground_bone_cdb').nutrients.calcium!.value).toBeCloseTo(0.01443, 10);
    expect(food('quail_ground_bone_cdb').nutrients.phosphorus!.value).toBeCloseTo(0.00813, 10);
    expect(food('chicken_wings_cdb').nutrients.calcium).toBeUndefined();
  });
});
