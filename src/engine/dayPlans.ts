// Ricette preferite e giornate tipo (28/11/2026).
//
// - Preferiti: elenco di id di ricette, solo per ritrovarle in fretta. Non cambia le ricette.
// - Giornata tipo: un nome e, per ogni cane, UNA ricetta salvata di quel cane (o nessuna). Si guarda
//   sempre la versione attuale della ricetta; se la ricetta non esiste più la giornata lo segnala.
// - Anteprima degli ingredienti: giornate scelte × quante volte. Usa lo stesso calcolo della Spesa
//   (shoppingForecast, con resa delle verdure cotte e confronto con la dispensa), senza margine.
//   È solo da guardare: non scrive nel diario, nella Spesa o nella Dispensa e non si salva.

import type { Catalog } from './catalog';
import { EMPTY_PANTRY, type PantryData } from './pantry';
import type { PriceBook } from './prices';
import type { Recipe } from './recipes';
import { shoppingForecast, type ShoppingForecast, type ShoppingPlanLine } from './shopping';
import type { Dog } from './types';

export interface DayPlan {
  id: string;
  name: string;
  /** Per id del cane: id della ricetta scelta. Un cane senza voce = nessuna ricetta. */
  recipes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// ------------------------------------------------------------------ dati salvati e backup

/** Preferiti letti dal telefono o da un backup: solo testi, senza doppioni (dati di prima: nessuno). */
export function sanitizeFavorites(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))];
}

/** Giornate tipo lette dal telefono o da un backup: quelle non valide si scartano (dati di prima: nessuna). */
export function sanitizeDayPlans(v: unknown): DayPlan[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: DayPlan[] = [];
  for (const p of v) {
    if (!isObject(p) || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || seen.has(p.id)) continue;
    seen.add(p.id);
    const recipes: Record<string, string> = {};
    if (isObject(p.recipes)) for (const [dogId, r] of Object.entries(p.recipes)) if (typeof r === 'string' && r) recipes[dogId] = r;
    out.push({
      id: p.id,
      name: p.name,
      recipes,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '',
    });
  }
  return out;
}

// ------------------------------------------------------------------ preferiti

export function isFavorite(favorites: string[], recipeId: string): boolean {
  return favorites.includes(recipeId);
}

/** Aggiunge o toglie la stellina. */
export function toggleFavorite(favorites: string[], recipeId: string): string[] {
  return favorites.includes(recipeId) ? favorites.filter((id) => id !== recipeId) : [...favorites, recipeId];
}

/** Ricette preferite che esistono ancora, in ordine di cane (come nella scheda Cani) e poi di nome. */
export function favoriteRecipes(favorites: string[], recipes: Recipe[], dogs: Dog[]): Recipe[] {
  const dogOrder = (id: string) => {
    const i = dogs.findIndex((d) => d.id === id);
    return i < 0 ? dogs.length : i;
  };
  return recipes
    .filter((r) => favorites.includes(r.id))
    .sort((a, b) => dogOrder(a.dogId) - dogOrder(b.dogId) || a.name.localeCompare(b.name, 'it'));
}

// ------------------------------------------------------------------ giornate tipo

export function newDayPlan(id: string, name: string, now: Date): DayPlan {
  const at = now.toISOString();
  return { id, name: name.trim(), recipes: {}, createdAt: at, updatedAt: at };
}

/** Nome libero; vuoto non vale (resta quello di prima). */
export function renameDayPlan(plan: DayPlan, name: string, now: Date): DayPlan {
  const n = name.trim();
  return n ? { ...plan, name: n, updatedAt: now.toISOString() } : plan;
}

/** Sceglie la ricetta di un cane (null = nessuna). La ricetta deve essere di quel cane. */
export function setDayPlanRecipe(plan: DayPlan, dogId: string, recipe: Pick<Recipe, 'id' | 'dogId'> | null, now: Date): DayPlan {
  const recipes = { ...plan.recipes };
  if (recipe === null) delete recipes[dogId];
  else if (recipe.dogId === dogId) recipes[dogId] = recipe.id;
  else return plan;
  return { ...plan, recipes, updatedAt: now.toISOString() };
}

/** Copia con un nome nuovo («… (copia)»). */
export function duplicateDayPlan(plan: DayPlan, id: string, now: Date): DayPlan {
  const at = now.toISOString();
  return { ...plan, id, name: `${plan.name} (copia)`, recipes: { ...plan.recipes }, createdAt: at, updatedAt: at };
}

export function upsertDayPlan(plans: DayPlan[], plan: DayPlan): DayPlan[] {
  return plans.some((p) => p.id === plan.id) ? plans.map((p) => (p.id === plan.id ? plan : p)) : [...plans, plan];
}

export function removeDayPlan(plans: DayPlan[], id: string): DayPlan[] {
  return plans.filter((p) => p.id !== id);
}

export interface DayPlanDogRow {
  dog: Dog;
  /** Ricetta scelta e ancora esistente (versione attuale), altrimenti null. */
  recipe: Recipe | null;
  /** C'era una ricetta scelta ma non esiste più (o non è più di questo cane): «ricetta mancante». */
  missing: boolean;
}

/** Una riga per ogni cane di adesso: ricetta attuale, nessuna, o mancante. */
export function dayPlanRows(plan: DayPlan, dogs: Dog[], recipes: Recipe[]): DayPlanDogRow[] {
  return dogs.map((dog) => {
    const id = plan.recipes[dog.id];
    if (!id) return { dog, recipe: null, missing: false };
    const recipe = recipes.find((r) => r.id === id && r.dogId === dog.id) ?? null;
    return { dog, recipe, missing: recipe === null };
  });
}

/** Quante ricette mancanti ci sono nella giornata (per l'avviso). */
export function missingCount(plan: DayPlan, dogs: Dog[], recipes: Recipe[]): number {
  return dayPlanRows(plan, dogs, recipes).filter((r) => r.missing).length;
}

// ------------------------------------------------------------------ anteprima degli ingredienti

export interface PreviewChoice {
  planId: string;
  /** Quante volte (giorni) con questa giornata. */
  times: number;
}

export interface DayPreview {
  /** Per ogni giornata scelta (times > 0): ingredienti di UN giorno, tutti i cani insieme, senza dispensa. */
  perDay: { plan: DayPlan; times: number; forecast: ShoppingForecast; missing: DayPlanDogRow[] }[];
  /** Tutti i giorni insieme, confrontati con la dispensa (cost = prezzo di quello che manca). */
  total: ShoppingForecast;
  /** Tutti i giorni insieme senza dispensa (cost = prezzo di tutto quello che serve). */
  totalNeeded: ShoppingForecast;
  /** Giorni in tutto. */
  days: number;
}

function planLines(plan: DayPlan, times: number, dogs: Dog[], recipes: Recipe[]): ShoppingPlanLine[] {
  return dayPlanRows(plan, dogs, recipes)
    .filter((r) => r.recipe)
    .map((r) => ({ id: `${plan.id}:${r.dog.id}`, dogId: r.dog.id, recipeId: (r.recipe as Recipe).id, days: times }));
}

/** Anteprima: giornate × volte, con lo stesso calcolo della Spesa (margine 0). Non cambia niente. */
export function dayPreview(
  choices: PreviewChoice[],
  plans: DayPlan[],
  dogs: Dog[],
  recipes: Recipe[],
  catalog: Catalog,
  prices: PriceBook,
  pantry: PantryData,
): DayPreview {
  const chosen = choices
    .map((c) => ({ plan: plans.find((p) => p.id === c.planId), times: Math.max(0, Math.round(c.times)) }))
    .filter((c): c is { plan: DayPlan; times: number } => !!c.plan && c.times > 0);
  const shopping = (lines: ShoppingPlanLine[]) => ({ horizonDays: 1, marginPct: 0, plans: lines, extras: [] });
  const perDay = chosen.map(({ plan, times }) => ({
    plan,
    times,
    forecast: shoppingForecast(shopping(planLines(plan, 1, dogs, recipes)), recipes, catalog, prices, EMPTY_PANTRY),
    missing: dayPlanRows(plan, dogs, recipes).filter((r) => r.missing),
  }));
  const all = chosen.flatMap(({ plan, times }) => planLines(plan, times, dogs, recipes));
  return {
    perDay,
    total: shoppingForecast(shopping(all), recipes, catalog, prices, pantry),
    totalNeeded: shoppingForecast(shopping(all), recipes, catalog, prices, EMPTY_PANTRY),
    days: chosen.reduce((s, c) => s + c.times, 0),
  };
}

/** Nome proposto per una giornata nuova: «Giornata A», poi B, C… (la prima lettera libera). */
export function nextDayPlanName(plans: DayPlan[]): string {
  const used = new Set(plans.map((p) => p.name.trim().toLowerCase()));
  for (let i = 0; i < 26; i++) {
    const name = `Giornata ${String.fromCharCode(65 + i)}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return `Giornata ${plans.length + 1}`;
}
