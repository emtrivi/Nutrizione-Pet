// Pasti (22/11/2026): la ricetta è la razione di tutta la giornata; qui si divide in 1, 2 o 3 pasti.
// Solo una vista per pesare: non cambia la ricetta, i calcoli, il diario, la Spesa o la Dispensa.
//
// - Numero di pasti e percentuali si ricordano per ogni cane (di partenza 1 pasto).
// - Alimenti arrotondati ai 5 g, integratori in grammi a 1 g. Il resto dell'arrotondamento va sul pasto
//   con la percentuale più alta (il primo, a parità): la somma dei pasti è SEMPRE il totale della ricetta.
// - Integratori a capsule (o a pezzi): non si dividono; ogni capsula va in un pasto (di partenza alternate:
//   1ª al primo pasto, 2ª al secondo, ...). La scelta si ricorda per cane e integratore.

import type { Catalog } from './catalog';

export type MealCount = 1 | 2 | 3;

export interface DogMealPlan {
  count: MealCount;
  /** Percentuale della razione per ogni pasto (somma 100). */
  pcts: number[];
  /** Per integratore a capsule: pasto (0, 1, 2) di ogni capsula. */
  capsules: Record<string, number[]>;
}

/** Per id del cane. */
export type MealsData = Record<string, DogMealPlan>;

export const MEAL_COUNTS: MealCount[] = [1, 2, 3];
export const FOOD_STEP_G = 5;
export const SUPPLEMENT_STEP_G = 1;
const EPS = 1e-6;

export function equalPcts(count: MealCount): number[] {
  return Array.from({ length: count }, () => 100 / count);
}

export const DEFAULT_MEAL_PLAN: DogMealPlan = { count: 1, pcts: [100], capsules: {} };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is MealCount => v === 1 || v === 2 || v === 3;

/** La somma fa 100% (con un margine minimo per i decimali)? Ogni pasto tra 0 e 100. */
export function pctsValid(pcts: number[], count: MealCount): boolean {
  if (pcts.length !== count || pcts.some((p) => !Number.isFinite(p) || p < 0 || p > 100)) return false;
  return Math.abs(pcts.reduce((s, p) => s + p, 0) - 100) < 0.01;
}

/** Pasti letti dal telefono o da un backup: quello che non è valido torna a 1 pasto (dati di prima: niente). */
export function sanitizeMeals(v: unknown): MealsData {
  if (!isObject(v)) return {};
  const out: MealsData = {};
  for (const [dogId, p] of Object.entries(v)) {
    if (!isObject(p) || !isCount(p.count)) continue;
    const pcts = Array.isArray(p.pcts) && p.pcts.every((x) => typeof x === 'number') ? (p.pcts as number[]) : [];
    const capsules: Record<string, number[]> = {};
    if (isObject(p.capsules)) {
      for (const [key, arr] of Object.entries(p.capsules)) {
        if (Array.isArray(arr) && arr.every((x) => x === 0 || x === 1 || x === 2)) capsules[key] = arr as number[];
      }
    }
    out[dogId] = { count: p.count, pcts: pctsValid(pcts, p.count) ? pcts : equalPcts(p.count), capsules };
  }
  return out;
}

export function mealPlanFor(meals: MealsData, dogId: string): DogMealPlan {
  return meals[dogId] ?? DEFAULT_MEAL_PLAN;
}

/** Cambia il numero di pasti: le percentuali tornano uguali; le scelte delle capsule restano (se valgono ancora). */
export function setMealCount(meals: MealsData, dogId: string, count: MealCount): MealsData {
  const plan = mealPlanFor(meals, dogId);
  return { ...meals, [dogId]: { ...plan, count, pcts: equalPcts(count) } };
}

/** Percentuali dei pasti: si salvano solo se la somma fa 100%. */
export function setMealPcts(meals: MealsData, dogId: string, pcts: number[]): MealsData {
  const plan = mealPlanFor(meals, dogId);
  if (!pctsValid(pcts, plan.count)) return meals;
  return { ...meals, [dogId]: { ...plan, pcts } };
}

/** Sposta la capsula n. `piece` dell'integratore `key` nel pasto `meal`. */
export function setCapsuleMeal(meals: MealsData, dogId: string, key: string, pieces: number, piece: number, meal: number): MealsData {
  const plan = mealPlanFor(meals, dogId);
  if (meal < 0 || meal >= plan.count || piece < 0 || piece >= pieces) return meals;
  const current = capsuleMeals(plan.capsules[key], pieces, plan.count);
  const next = current.map((m, i) => (i === piece ? meal : m));
  return { ...meals, [dogId]: { ...plan, capsules: { ...plan.capsules, [key]: next } } };
}

/** Toglie i pasti di un cane eliminato. */
export function removeDogMeals(meals: MealsData, dogId: string): MealsData {
  if (!(dogId in meals)) return meals;
  const { [dogId]: _gone, ...rest } = meals;
  return rest;
}

/** Proposta di partenza: capsule alternate tra i pasti (1ª al primo, 2ª al secondo, ...). */
export function defaultCapsuleMeals(pieces: number, count: MealCount): number[] {
  return Array.from({ length: pieces }, (_, i) => i % count);
}

/** Scelta salvata, se vale ancora per questo numero di capsule e di pasti; altrimenti la proposta. */
export function capsuleMeals(saved: number[] | undefined, pieces: number, count: MealCount): number[] {
  return saved && saved.length === pieces && saved.every((m) => m >= 0 && m < count) ? saved : defaultCapsuleMeals(pieces, count);
}

/**
 * Divide un totale tra i pasti: ogni pasto arrotondato al passo (5 g), tranne quello con la percentuale
 * più alta, che prende il resto. La somma è sempre il totale.
 */
export function splitAmount(total: number, pcts: number[], step: number): number[] {
  if (pcts.length <= 1) return [total];
  let target = 0;
  pcts.forEach((p, i) => {
    if (p > (pcts[target] ?? 0) + EPS) target = i;
  });
  const out = pcts.map((p, i) => (i === target ? 0 : Math.round((total * p) / 100 / step) * step));
  const others = out.reduce((s, x) => s + x, 0);
  if (others > total + EPS) return pcts.map((_, i) => (i === target ? total : 0));
  out[target] = Math.round((total - others) * 1e6) / 1e6;
  return out;
}

export interface MealLine {
  key: string;
  amount: number;
  unit: 'g' | 'capsule';
}

export interface MealSplit {
  count: MealCount;
  pcts: number[];
  /** Per pasto: ingredienti con la quantità (le capsule solo nei pasti dove vanno). */
  meals: MealLine[][];
  /** Integratori a capsule: totale e pasto di ogni capsula. */
  capsules: { key: string; total: number; pieces: number; meals: number[] }[];
}

/** Divisione della ricetta (grammi del giorno) nei pasti del cane. */
export function splitRecipe(lines: { key: string; amount: number }[], catalog: Catalog, plan: DogMealPlan): MealSplit {
  const { count, pcts } = plan;
  const meals: MealLine[][] = Array.from({ length: count }, () => []);
  const capsules: MealSplit['capsules'] = [];
  for (const l of lines) {
    if (!(l.amount > 0)) continue;
    const item = catalog.get(l.key);
    const unit = item?.doseUnit ?? 'g';
    if (unit === 'capsule') {
      // a pezzi: ogni capsula in un pasto; una dose non intera (es. 1,5) resta tutta in un pasto
      const whole = Number.isInteger(l.amount);
      const pieces = whole ? l.amount : 1;
      const where = capsuleMeals(plan.capsules[l.key], pieces, count);
      const perMeal = new Array<number>(count).fill(0);
      where.forEach((m) => (perMeal[m] = (perMeal[m] ?? 0) + (whole ? 1 : l.amount)));
      perMeal.forEach((n, m) => {
        if (n > 0) meals[m]?.push({ key: l.key, amount: n, unit });
      });
      capsules.push({ key: l.key, total: l.amount, pieces, meals: where });
      continue;
    }
    const step = item?.kind === 'supplement' ? SUPPLEMENT_STEP_G : FOOD_STEP_G;
    splitAmount(l.amount, pcts, step).forEach((a, m) => meals[m]?.push({ key: l.key, amount: a, unit }));
  }
  return { count, pcts, meals, capsules };
}
