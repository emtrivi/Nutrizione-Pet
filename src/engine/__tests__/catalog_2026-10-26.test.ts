// Catalogo alimenti del 26/10/2026: le 95 voci di prima restano identiche, si aggiungono
// manzo 10% (beef_10) e olio di lino (linseed_oil). Valori del foglio Excel ÷ 100 = per 1 g.
import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawFood } from '../catalog';
import { rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import afterImport from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-26_97_voci.json';
import { computeTotals } from '../totals';
import oldFoods from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-23.json';

// Catalogo come uscito da questa importazione (archiviato): le modifiche successive non cambiano questi controlli.
const catalog = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-26.json', data: afterImport as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const food = (id: string) => catalog.get(`food:${id}`)!;
const before = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-23.json', data: oldFoods as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});

describe('le voci esistenti non cambiano', () => {
  it('stesse 95 voci, stessa impronta (nessuna ricetta diventa "da rivedere")', () => {
    expect(before.foods).toHaveLength(95);
    for (const old of before.foods) {
      expect(food(old.id).fingerprint).toBe(old.fingerprint);
      expect(food(old.id)).toEqual(old);
    }
  });
  it('le voci nuove sono dopo le 95 di prima', () => {
    expect(catalog.foods.slice(95, 97).map((f) => f.id)).toEqual(['beef_10', 'linseed_oil']);
  });
});

describe('manzo 10% (beef_10)', () => {
  const b = food('beef_10');
  it('si sceglie nelle ricette, categoria proteica, peso a crudo, non indicativo', () => {
    expect(b.availableForNewRecipes).toBe(true);
    expect(b.recipeCategory).toBe('proteica');
    expect(b.processingState).toBe('raw');
    expect(b.indicative).toBe(false);
  });
  it('170 kcal/100 g = 20 × 4 + 10 × 9', () => {
    expect(b.kcalPerUnit).toBeCloseTo(1.7, 10);
  });
  it('valori per 1 g', () => {
    expect(b.nutrients.protein!.value).toBeCloseTo(0.2, 10);
    expect(b.nutrients.fat!.value).toBeCloseTo(0.1, 10);
    expect(b.nutrients.calcium!.value).toBeCloseTo(0.00012, 12); // 12 mg/100 g → g/g
    expect(b.nutrients.phosphorus!.value).toBeCloseTo(0.00184, 12);
    expect(b.nutrients.selenium_wet!.value).toBeCloseTo(0.166, 10); // µg
    expect(b.nutrients.alpha_linolenic_acid!.value).toBeCloseTo(0.00036, 12);
    expect(b.nutrients.choline!.value).toBeCloseTo(0.661, 10);
  });
  it('vitamina A 14 UI/100 g, beta-carotene 0 dichiarato: non parziale', () => {
    expect(b.nutrients.vitamin_a!.value).toBeCloseTo(0.14, 10);
    expect(b.nutrients.vitamin_a!.partial).toBe(false);
  });
  it('vitamina E 0,17 mg × 1,49 (naturale) = 0,2533 UI/100 g', () => {
    expect(b.nutrients.vitamin_e!.value).toBeCloseTo(0.002533, 9);
  });
  it('linoleico stimato da C18:2 (0,26 g); arachidonico, EPA+DHA e cloruro sconosciuti', () => {
    expect(b.nutrients.linoleic_acid!.value).toBeCloseTo(0.0026, 10);
    expect(b.nutrients.linoleic_acid!.status).toBe('estimated');
    expect(b.nutrients.arachidonic_acid).toBeUndefined();
    expect(b.nutrients.epa_dha).toBeUndefined();
    expect(b.nutrients.chloride).toBeUndefined();
  });
});

describe('olio di lino (linseed_oil)', () => {
  const l = food('linseed_oil');
  it('si sceglie nelle ricette, categoria grassi, 900 kcal/100 g', () => {
    expect(l.availableForNewRecipes).toBe(true);
    expect(l.recipeCategory).toBe('grassi');
    expect(l.kcalPerUnit).toBeCloseTo(9, 10);
  });
  it('omega-3 e omega-6: ALA 53,368 g; linoleico dichiarato 14,246 g (non il C18:2)', () => {
    expect(l.nutrients.alpha_linolenic_acid!.value).toBeCloseTo(0.53368, 10);
    expect(l.nutrients.linoleic_acid!.value).toBeCloseTo(0.14246, 10);
  });
  it('vitamina E 0,47 mg × 1,49 = 0,7003 UI/100 g', () => {
    expect(l.nutrients.vitamin_e!.value).toBeCloseTo(0.007003, 9);
  });
  it('minerali dichiarati 0 dalla fonte: noti e uguali a zero', () => {
    for (const id of ['potassium', 'sodium', 'magnesium', 'copper', 'iron', 'selenium_wet']) {
      expect(l.nutrients[id]!.value).toBe(0);
    }
    expect(l.nutrients.vitamin_a!.value).toBe(0);
    expect(l.nutrients.vitamin_a!.partial).toBe(false);
  });
});

describe('in una ricetta', () => {
  it('100 g di manzo 10% + 10 g di olio di lino = 170 + 90 = 260 kcal', () => {
    const t = computeTotals(
      [
        { key: 'food:beef_10', amount: 100 },
        { key: 'food:linseed_oil', amount: 10 },
      ],
      catalog,
    );
    expect(t.kcal.value).toBeCloseTo(260, 10);
    // ALA: 0,036 + 5,3368 = 5,3728 g
    expect(t.nutrients.alpha_linolenic_acid!.value).toBeCloseTo(5.3728, 10);
  });
});
