// Suggerimenti dalla fonte di grassi (oli) per gli acidi grassi in carenza. Calcoli fatti a mano.
//
// Ricetta "manzo e avena" (cane d'esempio, tabella 95): manzo 12,8% 400 g + avena secca 100 g
//   kcal K = 752 + 341,88 = 1.093,88
//   acido linoleico T = 2,2 g (dall'avena, C18:2; il manzo non lo dichiara) → 2,2 ÷ 1,09388 = 2,0112 g/1.000 kcal
//   minimo FEDIAF tabella 95: m = 3,82 g/1.000 kcal
//   mancano m·K/1.000 − T = 4,17862 − 2,2 = 1,97862 g
//   grammi = 1,97862 ÷ (n − 3,82 × k/1.000), con n e k per 1 g di olio:
//     girasole  n 0,657   k 9     → 1,97862 ÷ 0,62262 = 3,18 → 4 g
//     lino      n 0,14246 k 9     → 1,97862 ÷ 0,10808 = 18,31 → 19 g
//     oliva     n 0,0976  k 9     → 1,97862 ÷ 0,06322 = 31,30 → 32 g
//     cocco     n 0,0168  k 8,919 → denominatore negativo: troppo povero, non si propone
//     olio di salmone n 0,0154 → idem
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../backup';
import { fediaf, getCatalog } from '../bundledData';
import { evaluateRecipe } from '../recipes';
import { fatSourceSuggestions } from '../suggestions';

const catalog = getCatalog();
const ctx = { catalog, fediaf, settings: DEFAULT_SETTINGS, prices: {} };
const lines = [
  { key: 'food:beef_mid_10', amount: 400 },
  { key: 'food:oat_dry', amount: 100 },
];
const input = { lines, kcalTarget: 1218, table: 95 as const, overrides: {}, dogWeightKg: 30 };
const linoleic = (extra: { key: string; amount: number }[]) =>
  evaluateRecipe({ ...input, lines: [...lines, ...extra] }, ctx).nutrients.linoleic_acid!.evaluation.valuePer1000!;

describe('acido linoleico basso: oli proposti, dal più ricco', () => {
  const s = fatSourceSuggestions(input, 'linoleic_acid', ctx);

  it('girasole 4 g, lino 19 g, oliva 32 g; cocco e olio di salmone no; colza esclusa dal catalogo', () => {
    expect(s.map((x) => [x.key, x.grams])).toEqual([
      ['food:sunflower_oil', 4],
      ['food:linseed_oil', 19],
      ['food:olive_oil', 32],
    ]);
  });

  it('prima 2,0112 g/1.000 kcal; con 4 g di girasole (4,828 ÷ 1,12988) = 4,2730', () => {
    expect(s[0]!.target.beforeValue).toBeCloseTo(2.0112, 4);
    expect(s[0]!.target.afterValue).toBeCloseTo(4.273, 3);
  });

  it('i grammi sono i minimi che bastano: un grammo in meno resta sotto 3,82', () => {
    for (const x of s) {
      expect(linoleic([{ key: x.key, amount: x.grams }])).toBeGreaterThanOrEqual(3.82);
      expect(linoleic([{ key: x.key, amount: x.grams - 1 }])).toBeLessThan(3.82);
    }
  });

  it('anteprima delle calorie: lino 19 g = 1.093,88 + 171 = 1.264,88 kcal', () => {
    const lino = s.find((x) => x.key === 'food:linseed_oil')!;
    expect(lino.kcal.before).toBeCloseTo(1093.88, 6);
    expect(lino.kcal.after).toBeCloseTo(1264.88, 6);
  });

  it('un olio già nella ricetta non si propone di nuovo', () => {
    const withSun = fatSourceSuggestions({ ...input, lines: [...lines, { key: 'food:sunflower_oil', amount: 1 }] }, 'linoleic_acid', ctx);
    expect(withSun.map((x) => x.key)).not.toContain('food:sunflower_oil');
  });
});

describe('solo per gli acidi grassi', () => {
  it('per il calcio nessun alimento proposto', () => {
    expect(fatSourceSuggestions(input, 'calcium', ctx)).toEqual([]);
  });
  it('EPA + DHA: FEDIAF non dà un minimo per l’adulto, quindi nessuna proposta', () => {
    expect(fatSourceSuggestions(input, 'epa_dha', ctx)).toEqual([]);
  });
  it('EPA + DHA con un minimo scelto a mano (0,5 g/1.000 kcal): solo l’olio di salmone li contiene', () => {
    const withMin = { ...input, overrides: { epa_dha: { min: 0.5 } } };
    const s = fatSourceSuggestions(withMin, 'epa_dha', ctx);
    expect(s.map((x) => x.key)).toEqual(['food:salmon_oil']);
    const v = evaluateRecipe({ ...withMin, lines: [...lines, { key: 'food:salmon_oil', amount: s[0]!.grams }] }, ctx);
    expect(v.nutrients.epa_dha!.evaluation.valuePer1000!).toBeGreaterThanOrEqual(0.5);
  });
});
