// Suggerimenti di alimenti del catalogo per un nutriente in carenza (i 5 più ricchi). Calcoli fatti a mano.
//
// Catalogo fisso: quello del 27/10/2026 (118 voci), così i conti non cambiano quando si aggiungono alimenti.
//
// Ricetta "manzo e avena" (cane d'esempio, tabella 95): manzo 12,8% 400 g + avena secca 100 g
//   kcal K = 752 + 341,88 = 1.093,88
//   acido linoleico T = 2,2 g (dall'avena) · minimo m = 3,82 g/1.000 kcal
//   mancano m·K/1.000 − T = 4,17862 − 2,2 = 1,97862 g
//   grammi = 1,97862 ÷ (n − 3,82 × k/1.000), con n e k per 1 g di alimento:
//     girasole            n 0,657   k 9     → 1,97862 ÷ 0,62262  = 3,18  → 4 g
//     lino                n 0,14246 k 9     → 1,97862 ÷ 0,10808  = 18,31 → 19 g
//     oliva               n 0,0976  k 9     → 1,97862 ÷ 0,06322  = 31,30 → 32 g
//     pollo con osso CDB  n 0,0558  k 2,354 → 1,97862 ÷ 0,046808 = 42,27 → 43 g (Igea: stessi valori)
//     anatra con ossa CDB n 0,0469  k 2,3   → 1,97862 ÷ 0,038114 = 51,91 → 52 g (Igea: stessi valori)
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../backup';
import { buildCatalog, type RawFood } from '../catalog';
import { fediaf, rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import foods118 from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-27.json';
import { evaluateRecipe } from '../recipes';
import { FOOD_SUGGESTION_COUNT, foodSuggestions } from '../suggestions';

const catalog = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-27.json', data: foods118 as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const ctx = { catalog, fediaf, settings: DEFAULT_SETTINGS, prices: {} };
const lines = [
  { key: 'food:beef_mid_10', amount: 400 },
  { key: 'food:oat_dry', amount: 100 },
];
const input = { lines, kcalTarget: 1218, table: 95 as const, overrides: {}, dogWeightKg: 30 };
const per1000 = (id: string, extra: { key: string; amount: number }[]) =>
  evaluateRecipe({ ...input, lines: [...lines, ...extra] }, ctx).nutrients[id]!.evaluation.valuePer1000!;

describe('acido linoleico basso: i 5 alimenti più ricchi, di tutte le sezioni', () => {
  const s = foodSuggestions(input, 'linoleic_acid', ctx);

  it('girasole 4 g, lino 19 g, oliva 32 g, pollo con osso 43 g, anatra con ossa 52 g', () => {
    expect(s.map((x) => [x.key, x.grams])).toEqual([
      ['food:sunflower_oil', 4],
      ['food:linseed_oil', 19],
      ['food:olive_oil', 32],
      ['food:chicken_back_ground_bone_cdb', 43],
      ['food:duck_bone_ground_cdb', 52],
    ]);
    expect(s).toHaveLength(FOOD_SUGGESTION_COUNT);
    expect(s.every((x) => x.reachesMin)).toBe(true);
  });

  it('CDB e Igea (stessi valori) contano una volta', () => {
    expect(s[3]!.sameAs.map((x) => x.id)).toEqual(['chicken_back_ground_bone_igea']);
    expect(s.map((x) => x.key)).not.toContain('food:chicken_back_ground_bone_igea');
  });

  it('i grammi sono i minimi che bastano: un grammo in meno resta sotto 3,82', () => {
    for (const x of s) {
      expect(per1000('linoleic_acid', [{ key: x.key, amount: x.grams }])).toBeGreaterThanOrEqual(3.82);
      expect(per1000('linoleic_acid', [{ key: x.key, amount: x.grams - 1 }])).toBeLessThan(3.82);
    }
  });

  it('anteprima delle calorie: lino 19 g = 1.093,88 + 171 = 1.264,88 kcal', () => {
    const lino = s.find((x) => x.key === 'food:linseed_oil')!;
    expect(lino.kcal.before).toBeCloseTo(1093.88, 6);
    expect(lino.kcal.after).toBeCloseTo(1264.88, 6);
  });

  it('un alimento già nella ricetta non si propone', () => {
    const withSun = foodSuggestions({ ...input, lines: [...lines, { key: 'food:sunflower_oil', amount: 1 }] }, 'linoleic_acid', ctx);
    expect(withSun.map((x) => x.key)).not.toContain('food:sunflower_oil');
  });
});

describe('calcio basso', () => {
  const s = foodSuggestions(input, 'calcium', ctx);

  it('prima i macinati con osso; sardine e ricotta da sole non bastano: anteprima con 100 g', () => {
    expect(s.map((x) => [x.key, x.reachesMin])).toEqual([
      ['food:turkey_bone_ground_cdb', true],
      ['food:chicken_back_ground_bone_cdb', true],
      ['food:duck_bone_ground_cdb', true],
      ['food:sardine_canned_oil_drained', false],
      ['food:ricotta_vaccina', false],
    ]);
    expect(s[3]!.grams).toBe(100);
    expect(s[4]!.grams).toBe(100);
  });

  it('con i grammi proposti il calcio arriva al minimo', () => {
    const min = evaluateRecipe(input, ctx).nutrients.calcium!.evaluation.limitsPer1000.min!;
    for (const x of s.filter((y) => y.reachesMin)) {
      expect(per1000('calcium', [{ key: x.key, amount: x.grams }])).toBeGreaterThanOrEqual(min);
    }
  });
});

describe('nessuna proposta', () => {
  it('nutriente già sopra il minimo (proteine)', () => {
    expect(foodSuggestions(input, 'protein', ctx)).toEqual([]);
  });
  it('EPA + DHA: FEDIAF non dà un minimo per l’adulto', () => {
    expect(foodSuggestions(input, 'epa_dha', ctx)).toEqual([]);
  });
});
