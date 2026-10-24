// Ricetta di prova per il cane d'esempio, sommata a mano dai valori dei file.
//
//   macinato bovino 12,8%   400 g     riso bianco cotto   300 g
//   carota cruda            100 g     olio di girasole     10 g
//   fegato di pollo crudo    50 g     QDiet                 6 g
//   Omegor                    1 capsula
import { describe, expect, it } from 'vitest';
import { getCatalog, fediaf } from '../bundledData';
import { computeRequirements } from '../requirements';
import { evaluateNutrient } from '../status';
import { calciumPhosphorusRatio, computeTotals, per1000Kcal, type RecipeLine } from '../totals';

const catalog = getCatalog();
const lines: RecipeLine[] = [
  { key: 'food:beef_mid_10', amount: 400 },
  { key: 'food:rice_white_cooked', amount: 300 },
  { key: 'food:carrot_raw', amount: 100 },
  { key: 'food:sunflower_oil', amount: 10 },
  { key: 'food:chicken_liver_raw', amount: 50 },
  { key: 'supplement:qdiet', amount: 6 },
  { key: 'supplement:omegor_vitality', amount: 1 },
];
const t = computeTotals(lines, catalog);
const OMEGOR = 'supplement:omegor_vitality';

describe('ricetta di prova: totali calcolati a mano', () => {
  it('kcal', () => {
    // 188×4 + 130×3 + 33×1 + 900×0,1 + 113,99×0,5 + 0,96×6 + 9×1
    // = 752 + 390 + 33 + 90 + 56,995 + 5,76 + 9 = 1.336,755
    expect(t.kcal.value).toBeCloseTo(1336.755, 9);
    expect(t.kcal.partial).toBe(false);
  });

  it('peso nella ciotola', () => {
    // 400 + 300 + 100 + 10 + 50 + 6 + 1 (capsula da 1 g)
    expect(t.massG.value).toBe(867);
  });

  it('calcio: mg degli alimenti + g del QDiet; Omegor senza dato → parziale', () => {
    // 7,14×4 + 3×3 + 33×1 + 0 + 8×0,5 = 28,56 + 9 + 33 + 0 + 4 = 74,56 mg = 0,07456 g
    // QDiet 0,18 g × 6 = 1,08 g → totale 1,15456 g
    const ca = t.nutrients.calcium!;
    expect(ca.value).toBeCloseTo(1.15456, 12);
    expect(ca.partial).toBe(true);
    expect(ca.missingIn).toEqual([OMEGOR]);
    // per 1.000 kcal: 1,15456 ÷ 1,336755 = 0,86370
    expect(per1000Kcal(ca.value!, t.kcal.value!)).toBeCloseTo(0.8637, 4);
  });

  it('fosforo e rapporto Ca/P', () => {
    // 148×4 + 37×3 + 35 + 0 + 297×0,5 = 592 + 111 + 35 + 148,5 = 886,5 mg
    // QDiet 0,065 × 6 = 0,39 g → totale 1,2765 g
    expect(t.nutrients.phosphorus!.value).toBeCloseTo(1.2765, 12);
    // 1,15456 ÷ 1,2765 = 0,90447
    const r = calciumPhosphorusRatio(t);
    expect(r.value).toBeCloseTo(0.90447, 5);
    expect(r.partial).toBe(true);
  });

  it('zinco (mg)', () => {
    // 4,19×4 + 0,42×3 + 0,24 + 0 + 2,67×0,5 + 2×6 = 16,76 + 1,26 + 0,24 + 1,335 + 12 = 31,595
    expect(t.nutrients.zinc!.value).toBeCloseTo(31.595, 12);
    // 31,595 ÷ 1,336755 = 23,6356 mg per 1.000 kcal
    expect(per1000Kcal(t.nutrients.zinc!.value!, t.kcal.value!)).toBeCloseTo(23.6356, 4);
  });

  it('vitamina A con le parti separate', () => {
    // carota 6.897,24 + fegato (11.100 + 46,648) × 0,5 = 5.573,324 + QDiet 250 × 6 = 1.500
    // riso 0 (retinolo 0) e olio 0 → totale 13.970,564; manzo e Omegor senza dato → parziale
    const va = t.nutrients.vitamin_a!;
    expect(va.value).toBeCloseTo(13970.564, 8);
    expect(va.partial).toBe(true);
    expect(va.missingIn).toContain('food:beef_mid_10');
    expect(va.missingIn).toContain(OMEGOR);
    expect(va.missingIn).toContain('food:rice_white_cooked'); // beta-carotene del riso non noto
    // preformata: 5.550 (fegato) + 1.500 (QDiet); da beta-carotene: 6.897,24 + 23,324
    expect(va.parts!.preformata).toBeCloseTo(7050, 8);
    expect(va.parts!.da_beta_carotene).toBeCloseTo(6920.564, 8);
  });

  it('vitamina E in UI', () => {
    // carota 0,66×1,49 = 0,9834; olio 41,1×1,49×0,1 = 6,1239; fegato 0,7×1,49×0,5 = 0,5215
    // QDiet 2×6 = 12; Omegor 14,9 → 34,5288
    expect(t.nutrients.vitamin_e!.value).toBeCloseTo(34.5288, 10);
    expect(t.nutrients.vitamin_e!.partial).toBe(true); // manzo e riso senza dato
  });

  it('acido linoleico con la stima da C18:2', () => {
    // riso 0,046×3 = 0,138; carota 0,1; olio 65,7×0,1 = 6,57; fegato 0,475×0,5 = 0,2375 → 7,0455
    expect(t.nutrients.linoleic_acid!.value).toBeCloseTo(7.0455, 12);
    expect(t.nutrients.linoleic_acid!.notes.join(' ')).toContain('C18:2');
  });

  it('iodio solo dal QDiet (parziale); cloruro senza fonti (grigio)', () => {
    expect(t.nutrients.iodine!.value).toBeCloseTo(0.27, 12); // 0,045 × 6
    expect(t.nutrients.iodine!.partial).toBe(true);
    expect(t.nutrients.chloride!.value).toBeNull();
    expect(t.nutrients.chloride!.missingIn).toHaveLength(7);
  });

  it('potassio: il dato del QDiet resta "da verificare" nel totale', () => {
    expect(t.nutrients.potassium!.toVerify).toBe(true);
  });

  it('sostanza secca = peso − acqua (Omegor senza acqua → parziale)', () => {
    // (400−276) + (300−205,8) + (100−88,3) + (10−0) + (50−38,25) + (6−0,18)
    // = 124 + 94,2 + 11,7 + 10 + 11,75 + 5,82 = 257,47
    expect(t.dryMatterG.value).toBeCloseTo(257.47, 10);
    expect(t.dryMatterG.missingIn).toEqual([OMEGOR]);
  });

  it('ingredienti con 0 g non contano; chiavi sconosciute segnalate', () => {
    const t2 = computeTotals(
      [
        { key: 'food:beef_mid_10', amount: 0 },
        { key: 'food:non_esiste', amount: 10 },
      ],
      catalog,
    );
    expect(t2.kcal.value).toBeNull();
    expect(t2.unknownKeys).toEqual(['food:non_esiste']);
  });
});

describe('ricetta di prova: colori (tabella 95)', () => {
  const req = computeRequirements(fediaf, { table: 95, kcalPerDay: 1218 });
  const ctx = {
    recipeKcal: t.kcal.value!,
    dryMatterG: t.dryMatterG.value,
    supplementKeys: ['supplement:qdiet', OMEGOR],
    legalMaxMode: 'avviso' as const,
  };

  it('calcio 0,864 contro minimo 1,45: rosso per carenza, provvisorio (parziale)', () => {
    // (1,45 − 0,8637) ÷ 1,45 = 40,4% sotto
    const e = evaluateNutrient(t.nutrients.calcium!, req.byId.calcium!, ctx);
    expect(e.color).toBe('rosso');
    expect(e.direction).toBe('carenza');
    expect(e.distance).toBeCloseTo(0.4043, 4);
    expect(e.provisional).toBe(true);
    expect(e.maxKind).toBe('N');
    expect(e.limitsPer1000.max).toBe(6.25);
  });

  it('zinco: verde; massimo di legge convertito perché c’è il QDiet', () => {
    // L = 22,7 × 257,47 × 10 ÷ 1.336,755 = 43,722 mg/1.000 kcal
    const e = evaluateNutrient(t.nutrients.zinc!, req.byId.zinc!, ctx);
    expect(e.color).toBe('verde');
    expect(e.maxKind).toBe('L');
    expect(e.limitsPer1000.max).toBeCloseTo(43.722, 3);
  });

  it('cloruro grigio per dato mancante, biotina grigia per nessun riferimento', () => {
    expect(evaluateNutrient(t.nutrients.chloride!, req.byId.chloride!, ctx).reason).toBe('dato_mancante');
    expect(evaluateNutrient(t.nutrients.biotin!, req.byId.biotin!, ctx).reason).toBe('nessun_riferimento');
  });
});
