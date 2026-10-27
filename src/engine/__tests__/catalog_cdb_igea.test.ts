// Catalogo alimenti del 26/10/2026, seconda importazione: 18 voci CDB / Igea (9 prodotti × 2 rivenditori).
// Le 97 voci di prima restano identiche. Kcal ricalcolate come nel resto del catalogo (decisione dell'utente):
//   anatra con ossa      4 × 17   + 9 × 18   = 68   + 162   = 230    (venditore 159)
//   cuore di manzo       4 × 15,9 + 9 × 8,9  = 63,6 + 80,1  = 143,7  (venditore 123)
//   manzo senza osso     4 × 18,8 + 9 × 13,6 = 75,2 + 122,4 = 197,6  (venditore 108)
//   schiena di pollo     4 × 15,2 + 9 × 19,4 = 60,8 + 174,6 = 235,4  (venditore 125)
//   manzo fine           4 × 21,1 + 9 × 8,8  = 84,4 + 79,2  = 163,6  (venditore 147)
//   fegato di manzo      4 × 18,7 + 9 × 3,7  = 74,8 + 33,3  = 108,1  (venditore 142)
//   rene di manzo        4 × 15,6 + 9 × 8,9  = 62,4 + 80,1  = 142,5  (venditore 118)
//   tacchino con ossa    4 × 17,5 + 9 × 16,7 = 70   + 150,3 = 220,3  (venditore 125)
import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawFood } from '../catalog';
import { getCatalog, rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import before97 from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-26_97_voci.json';

const catalog = getCatalog();
const food = (id: string) => catalog.get(`food:${id}`)!;
const before = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-26.json', data: before97 as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});

const KCAL: Record<string, number> = {
  duck_bone_ground: 230,
  beef_heart_pieces: 143.7,
  beef_heart_ground: 143.7,
  beef_ground_boneless: 197.6,
  chicken_back_ground_bone: 235.4,
  beef_ground_fine: 163.6,
  beef_liver: 108.1,
  beef_kidney: 142.5,
  turkey_bone_ground: 220.3,
};
const NEW = Object.keys(KCAL).flatMap((p) => [`${p}_cdb`, `${p}_igea`]);

describe('le 97 voci di prima non cambiano', () => {
  it('stesse voci, stessa impronta: nessuna ricetta diventa "da rivedere"', () => {
    expect(before.foods).toHaveLength(97);
    for (const old of before.foods) expect(food(old.id)).toEqual(old);
  });
  it('18 voci nuove dopo le 97', () => {
    expect(catalog.foods.slice(97, 115).map((f) => f.id)).toEqual(NEW);
  });
});

describe('18 voci CDB / Igea', () => {
  it('kcal 4/9 per 1 g (valori ÷ 100)', () => {
    for (const id of NEW) expect(food(id).kcalPerUnit).toBeCloseTo(KCAL[id.replace(/_(cdb|igea)$/, '')]! / 100, 10);
  });
  it('tutte selezionabili nelle ricette, con "dato indicativo"', () => {
    for (const id of NEW) {
      expect(food(id).availableForNewRecipes).toBe(true);
      expect(food(id).indicative).toBe(true);
    }
  });
  it('CDB e Igea: stesso prodotto, stessi valori (voci separate per i prezzi)', () => {
    for (const p of Object.keys(KCAL)) {
      expect(food(`${p}_cdb`).fingerprint).toBe(food(`${p}_igea`).fingerprint);
    }
  });
  it('sezioni della ricetta: macinati e prodotti con osso proteici, cuore proteico, fegato e rene frattaglie', () => {
    expect(food('chicken_back_ground_bone_cdb').recipeCategory).toBe('proteica');
    expect(food('beef_heart_ground_cdb').recipeCategory).toBe('proteica'); // come il cuore di tacchino già presente
    expect(food('beef_liver_cdb').recipeCategory).toBe('frattaglie');
    expect(food('beef_kidney_cdb').recipeCategory).toBe('frattaglie');
  });
  it('schiena di pollo con osso: calcio 1.406 mg e fosforo 796 mg per 100 g (stima dalle ceneri)', () => {
    expect(food('chicken_back_ground_bone_cdb').nutrients.calcium!.value).toBeCloseTo(0.01406, 10);
    expect(food('chicken_back_ground_bone_cdb').nutrients.phosphorus!.value).toBeCloseTo(0.00796, 10);
  });
  it('fegato di manzo: vitamina A 16.900 UI/100 g, non parziale (prodotto animale)', () => {
    expect(food('beef_liver_cdb').nutrients.vitamin_a!.value).toBeCloseTo(169, 8);
    expect(food('beef_liver_cdb').nutrients.vitamin_a!.partial).toBe(false);
  });
});
