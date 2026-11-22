// Pasti (22/11/2026): la razione del giorno divisa in 1, 2 o 3 pasti. Calcoli fatti a mano.
import { describe, expect, it } from 'vitest';
import { deleteDog } from '../../data/personalStore';
import { DEFAULT_SETTINGS, emptyPersonalData, exportBackup, parseBackup } from '../backup';
import { getCatalog } from '../bundledData';
import {
  DEFAULT_MEAL_PLAN,
  capsuleMeals,
  equalPcts,
  mealPlanFor,
  pctsValid,
  sanitizeMeals,
  setCapsuleMeal,
  setMealCount,
  setMealPcts,
  splitAmount,
  splitRecipe,
  type DogMealPlan,
  type MealsData,
} from '../meals';

const catalog = getCatalog();
const now = new Date(2026, 10, 22, 10, 0);
const OMEGOR = 'supplement:omegor_vitality';
// Ricetta di un giorno: manzo 437 g, riso cotto 300 g, avena 12 g, farina d'ossa 7,5 g, 2 capsule di Omegor
const lines = [
  { key: 'food:beef_mid_10', amount: 437 },
  { key: 'food:rice_white_cooked', amount: 300 },
  { key: 'food:oat_dry', amount: 12 },
  { key: 'supplement:bone_meal', amount: 7.5 },
  { key: OMEGOR, amount: 2 },
];
const plan = (count: 1 | 2 | 3, pcts = equalPcts(count), capsules: DogMealPlan['capsules'] = {}): DogMealPlan => ({ count, pcts, capsules });
const sumOf = (meals: { key: string; amount: number }[][], key: string) => meals.flat().reduce((s, l) => (l.key === key ? s + l.amount : s), 0);
const amountIn = (meal: { key: string; amount: number }[] | undefined, key: string) => meal?.find((l) => l.key === key)?.amount;

describe('la somma dei pasti è il totale del giorno, per ogni ingrediente', () => {
  for (const count of [1, 2, 3] as const) {
    it(`${count} ${count === 1 ? 'pasto' : 'pasti'}`, () => {
      const s = splitRecipe(lines, catalog, plan(count));
      expect(s.meals).toHaveLength(count);
      for (const l of lines) expect(sumOf(s.meals, l.key)).toBeCloseTo(l.amount, 9);
    });
  }
  it('1 pasto: i grammi sono quelli della ricetta', () => {
    const s = splitRecipe(lines, catalog, DEFAULT_MEAL_PLAN);
    expect(s.meals[0]).toEqual(lines.map((l) => expect.objectContaining({ key: l.key, amount: l.amount })));
  });
  it('tante ricette diverse: con 2 e 3 pasti e percentuali qualsiasi la somma torna sempre', () => {
    const pctsList = [[50, 50], [60, 40], [35, 65], [100, 0], [100 / 3, 100 / 3, 100 / 3], [50, 30, 20], [10, 10, 80]];
    for (let total = 0; total <= 1000; total += 7.3) {
      for (const pcts of pctsList) {
        const parts = splitAmount(total, pcts, 5);
        expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 6);
        expect(parts.every((x) => x >= 0)).toBe(true);
      }
    }
  });
});

describe('arrotondamento ai 5 g senza perdere grammi', () => {
  it('manzo 437 g in 2 pasti uguali: 220 + 217 (il resto va sul primo pasto)', () => {
    // 437 × 50% = 218,5 → secondo pasto 220 (multiplo di 5); primo = 437 − 220 = 217
    expect(splitAmount(437, [50, 50], 5)).toEqual([217, 220]);
  });
  it('manzo 437 g in 3 pasti uguali: 145,67 → 145 e 145, il primo prende 147', () => {
    expect(splitAmount(437, equalPcts(3), 5)).toEqual([147, 145, 145]);
  });
  it('60/40: 437 × 40% = 174,8 → 175 nel secondo; il primo (più grande) 262', () => {
    expect(splitAmount(437, [60, 40], 5)).toEqual([262, 175]);
  });
  it('30/70: il resto va sul secondo pasto, che è il più grande', () => {
    // 437 × 30% = 131,1 → 130; secondo 307
    expect(splitAmount(437, [30, 70], 5)).toEqual([130, 307]);
  });
  it('quantità piccole: 12 g in 2 pasti → 7 + 5; 3 g → 3 + 0 (mai persi)', () => {
    expect(splitAmount(12, [50, 50], 5)).toEqual([7, 5]);
    expect(splitAmount(3, [50, 50], 5)).toEqual([3, 0]);
  });
  it('integratori in grammi a 1 g: farina d’ossa 7,5 g in 2 pasti → 3,5 + 4', () => {
    const s = splitRecipe(lines, catalog, plan(2));
    expect(amountIn(s.meals[0], 'supplement:bone_meal')).toBe(3.5);
    expect(amountIn(s.meals[1], 'supplement:bone_meal')).toBe(4);
  });
  it('alimenti in ogni pasto (tranne quello col resto) sono multipli di 5 g', () => {
    const s = splitRecipe(lines, catalog, plan(3, [50, 30, 20]));
    for (const meal of s.meals.slice(1)) for (const l of meal) if (l.key.startsWith('food:')) expect(l.amount % 5).toBe(0);
  });
});

describe('percentuali dei pasti', () => {
  it('di partenza uguali: 50/50, un terzo ciascuno', () => {
    expect(equalPcts(2)).toEqual([50, 50]);
    expect(equalPcts(3).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
  });
  it('60/40 si salva; 60/30 (somma 90%) no: restano quelle di prima', () => {
    let m: MealsData = setMealCount({}, 'fido', 2);
    m = setMealPcts(m, 'fido', [60, 40]);
    expect(mealPlanFor(m, 'fido').pcts).toEqual([60, 40]);
    expect(setMealPcts(m, 'fido', [60, 30])).toBe(m);
    expect(setMealPcts(m, 'fido', [60, 30, 10])).toBe(m); // numero di pasti sbagliato
    expect(pctsValid([50, 30, 20], 3)).toBe(true);
    expect(pctsValid([50, 30, 25], 3)).toBe(false);
    expect(pctsValid([110, -10], 2)).toBe(false);
  });
  it('60/40 nella ricetta: manzo 262 + 175, riso 180 + 120', () => {
    const s = splitRecipe(lines, catalog, plan(2, [60, 40]));
    expect(amountIn(s.meals[0], 'food:beef_mid_10')).toBe(262);
    expect(amountIn(s.meals[1], 'food:beef_mid_10')).toBe(175);
    expect(amountIn(s.meals[0], 'food:rice_white_cooked')).toBe(180);
    expect(amountIn(s.meals[1], 'food:rice_white_cooked')).toBe(120);
  });
  it('cambiando il numero di pasti le percentuali tornano uguali', () => {
    let m = setMealPcts(setMealCount({}, 'fido', 2), 'fido', [70, 30]);
    m = setMealCount(m, 'fido', 3);
    expect(mealPlanFor(m, 'fido').pcts).toEqual(equalPcts(3));
  });
});

describe('capsule: non si dividono', () => {
  it('2 capsule di Omegor in 2 pasti: di partenza alternate, 1 per pasto', () => {
    const s = splitRecipe(lines, catalog, plan(2));
    expect(amountIn(s.meals[0], OMEGOR)).toBe(1);
    expect(amountIn(s.meals[1], OMEGOR)).toBe(1);
    expect(s.capsules).toEqual([{ key: OMEGOR, total: 2, pieces: 2, meals: [0, 1] }]);
  });
  it('1 capsula: di partenza nel primo pasto; 3 capsule in 2 pasti → 2 + 1', () => {
    expect(capsuleMeals(undefined, 1, 3)).toEqual([0]);
    expect(capsuleMeals(undefined, 3, 2)).toEqual([0, 1, 0]);
  });
  it('scelta: tutte e 2 le capsule nel pasto 2 → un solo pasto le contiene, mai frazioni', () => {
    let m = setMealCount({}, 'fido', 2);
    m = setCapsuleMeal(m, 'fido', OMEGOR, 2, 0, 1);
    const s = splitRecipe(lines, catalog, mealPlanFor(m, 'fido'));
    expect(amountIn(s.meals[0], OMEGOR)).toBeUndefined();
    expect(amountIn(s.meals[1], OMEGOR)).toBe(2);
    expect(sumOf(s.meals, OMEGOR)).toBe(2);
    for (const meal of s.meals) for (const l of meal) if (l.unit === 'capsule') expect(Number.isInteger(l.amount)).toBe(true);
  });
  it('1 capsula nel pasto 3 di 3', () => {
    let m = setMealCount({}, 'fido', 3);
    m = setCapsuleMeal(m, 'fido', OMEGOR, 1, 0, 2);
    const s = splitRecipe([{ key: OMEGOR, amount: 1 }], catalog, mealPlanFor(m, 'fido'));
    expect(s.meals.map((meal) => amountIn(meal, OMEGOR))).toEqual([undefined, undefined, 1]);
  });
  it('se la scelta non vale più (meno pasti o capsule diverse) torna la proposta', () => {
    expect(capsuleMeals([2, 2], 2, 2)).toEqual([0, 1]);
    expect(capsuleMeals([1], 2, 2)).toEqual([0, 1]);
  });
});

describe('numero di pasti ricordato per ogni cane', () => {
  it('Fido 2 pasti 60/40, Luna 3 pasti; un cane senza scelta ha 1 pasto', () => {
    let m: MealsData = {};
    m = setMealPcts(setMealCount(m, 'fido', 2), 'fido', [60, 40]);
    m = setMealCount(m, 'luna', 3);
    expect(mealPlanFor(m, 'fido')).toMatchObject({ count: 2, pcts: [60, 40] });
    expect(mealPlanFor(m, 'luna').count).toBe(3);
    expect(mealPlanFor(m, 'rex')).toEqual(DEFAULT_MEAL_PLAN);
  });
  it('si ritrova dopo il salvataggio sul telefono e con Esporta tutto / Ripristina', () => {
    let meals: MealsData = setMealPcts(setMealCount({}, 'fido', 2), 'fido', [60, 40]);
    meals = setCapsuleMeal(meals, 'fido', OMEGOR, 2, 0, 1);
    expect(sanitizeMeals(JSON.parse(JSON.stringify(meals)))).toEqual(meals);
    const data = { ...emptyPersonalData(), settings: { ...DEFAULT_SETTINGS }, meals };
    const back = parseBackup(exportBackup(data, now, 'x'), now);
    expect(back.ok && back.data.meals).toEqual(meals);
  });
  it('eliminando un cane si tolgono anche i suoi pasti', () => {
    const data = { ...emptyPersonalData(), meals: setMealCount({}, 'fido', 2) };
    expect(deleteDog(data, 'fido').meals).toEqual({});
  });
});

describe('backup vecchi e dati non validi', () => {
  it('un backup di prima dei pasti si ripristina: 1 pasto per tutti', () => {
    const old = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    delete old.data.meals;
    const back = parseBackup(JSON.stringify(old), now);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.data.meals).toEqual({});
      expect(mealPlanFor(back.data.meals, 'fido')).toEqual(DEFAULT_MEAL_PLAN);
    }
  });
  it('valori non validi: numero di pasti sbagliato scartato, percentuali sbagliate → uguali', () => {
    expect(
      sanitizeMeals({
        a: { count: 4, pcts: [25, 25, 25, 25] },
        b: { count: 2, pcts: [70, 70], capsules: { x: [0, 1], y: [5] } },
        c: 'boh',
      }),
    ).toEqual({ b: { count: 2, pcts: [50, 50], capsules: { x: [0, 1] } } });
    expect(sanitizeMeals(undefined)).toEqual({});
  });
});
