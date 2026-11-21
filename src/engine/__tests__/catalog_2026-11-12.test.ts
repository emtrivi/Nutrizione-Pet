// Catalogo alimenti del 12/11/2026: 8 tagli di pollo da USDA SR Legacy (crudi e cotti al forno).
// Le 152 voci di prima restano identiche. Kcal 4 × proteine + 9 × grassi (+ 4 × carboidrati, qui zero):
//   petto senza pelle al forno   4 × 31,02 + 9 × 3,57  = 124,08 + 32,13 = 156,21
//   fuso senza pelle crudo       4 × 19,41 + 9 × 3,71  = 77,64  + 33,39 = 111,03
//   fuso con pelle al forno      4 × 23,35 + 9 × 10,15 = 93,4   + 91,35 = 184,75
import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawFood } from '../catalog';
import { rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import afterImport from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-11-12.json';
import v054 from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-30.json';

// Catalogo come uscito da questa importazione (versione 0.5.5, archiviato).
const catalog = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-11-12.json', data: afterImport as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const food = (id: string) => catalog.get(`food:${id}`)!;
const before = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-30.json', data: v054 as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const NEW = [
  'chicken_breast_roasted_skinless',
  'chicken_thigh_roasted_skinless',
  'chicken_thigh_roasted_skin_on',
  'chicken_drumstick_raw_skinless',
  'chicken_drumstick_roasted_skinless',
  'chicken_drumstick_raw_skin_on',
  'chicken_drumstick_roasted_skin_on',
  'chicken_leg_roasted_skinless',
];

describe('le 152 voci di prima non cambiano', () => {
  it('stesse voci, stessa impronta: nessuna ricetta diventa "da rivedere"', () => {
    expect(before.foods).toHaveLength(152);
    for (const old of before.foods) expect(food(old.id)).toEqual(old);
  });
  it('8 voci nuove in fondo', () => {
    expect(catalog.foods.slice(152).map((f) => f.id)).toEqual(NEW);
  });
});

describe('tagli di pollo', () => {
  it('kcal 4/9 per 1 g', () => {
    expect(food('chicken_breast_roasted_skinless').kcalPerUnit).toBeCloseTo(1.5621, 10);
    expect(food('chicken_drumstick_raw_skinless').kcalPerUnit).toBeCloseTo(1.1103, 10);
    expect(food('chicken_drumstick_roasted_skin_on').kcalPerUnit).toBeCloseTo(1.8475, 10);
  });
  it('fonte proteica, selezionabili, non indicativi', () => {
    for (const id of NEW) {
      expect(food(id).recipeCategory).toBe('proteica');
      expect(food(id).availableForNewRecipes).toBe(true);
      expect(food(id).indicative).toBe(false);
    }
  });
  it('peso a cotto (al forno) per i cotti, a crudo per i crudi', () => {
    expect(food('chicken_breast_roasted_skinless').processingLabel).toBe('peso a cotto (al forno)');
    expect(food('chicken_drumstick_raw_skin_on').processingLabel).toBe('peso a crudo');
  });
  it('petto al forno: calcio 15 mg e fosforo 228 mg per 100 g', () => {
    expect(food('chicken_breast_roasted_skinless').nutrients.calcium!.value).toBeCloseTo(0.00015, 12);
    expect(food('chicken_breast_roasted_skinless').nutrients.phosphorus!.value).toBeCloseTo(0.00228, 12);
  });
});
