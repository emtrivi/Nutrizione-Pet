// Spesa (19/11/2026): previsione dei grammi da comprare per i prossimi giorni.
// Per ogni cane si indicano le ricette e per quanti giorni; l'app somma i grammi per ingrediente
// di tutti i cani, con il prezzo del catalogo. È separata dal diario e non lo tocca.

import type { Catalog, CatalogItem, RecipeCategory } from './catalog';
import { unitPrice, type PriceBook } from './prices';
import type { Recipe } from './recipes';

export interface ShoppingPlanLine {
  id: string;
  dogId: string;
  recipeId: string;
  /** Giorni con questa ricetta nel periodo della previsione. */
  days: number;
}

/** Riga libera: cose da comprare che non stanno in una ricetta. */
export interface ShoppingExtra {
  id: string;
  name: string;
  /** Quantità scritta a mano, es. "2 confezioni" (facoltativa). */
  quantity: string;
  /** Prezzo previsto in euro (facoltativo). */
  price: number | null;
}

export interface ShoppingData {
  /** Giorni della previsione (all'inizio 30). */
  horizonDays: number;
  /** Margine in più sulle quantità delle ricette, in % (0 = nessuno). */
  marginPct: number;
  plans: ShoppingPlanLine[];
  extras: ShoppingExtra[];
}

export const DEFAULT_SHOPPING: ShoppingData = { horizonDays: 30, marginPct: 0, plans: [], extras: [] };

/**
 * Resa delle verdure cotte, peso cotto ÷ peso crudo: STIMA approssimata (le verdure bollite o al vapore
 * perdono o prendono un po' d'acqua). Serve solo a stimare il peso da comprare crudo.
 */
export const VEGETABLE_COOKING_YIELD: Record<string, number> = { cooked_boiled: 0.9, cooked_steamed: 0.9 };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;

/** Dati della spesa letti dal telefono o da un backup: quello che non è valido torna al valore iniziale. */
export function sanitizeShopping(v: unknown): ShoppingData {
  if (!isObject(v)) return { ...DEFAULT_SHOPPING, plans: [], extras: [] };
  const plans = Array.isArray(v.plans)
    ? v.plans
        .filter((p): p is Record<string, unknown> => isObject(p) && typeof p.id === 'string' && typeof p.dogId === 'string' && typeof p.recipeId === 'string')
        .map((p) => ({ id: p.id as string, dogId: p.dogId as string, recipeId: p.recipeId as string, days: Math.round(num(p.days, 0, 366, 0)) }))
    : [];
  const extras = Array.isArray(v.extras)
    ? v.extras
        .filter((e): e is Record<string, unknown> => isObject(e) && typeof e.id === 'string' && typeof e.name === 'string')
        .map((e) => ({
          id: e.id as string,
          name: e.name as string,
          quantity: typeof e.quantity === 'string' ? e.quantity : '',
          price: typeof e.price === 'number' && Number.isFinite(e.price) && e.price >= 0 ? e.price : null,
        }))
    : [];
  return {
    horizonDays: Math.round(num(v.horizonDays, 1, 366, DEFAULT_SHOPPING.horizonDays)),
    marginPct: num(v.marginPct, 0, 100, DEFAULT_SHOPPING.marginPct),
    plans,
    extras,
  };
}

export interface ShoppingItem {
  key: string;
  item: CatalogItem;
  /** Sezione della ricetta, o "integratori". */
  section: RecipeCategory | 'integratori';
  unit: 'g' | 'capsule';
  /** Quantità nella ciotola nel periodo (somma di cani e giorni), senza margine. */
  bowlAmount: number;
  /** Con il margine; grammi arrotondati per eccesso al grammo, capsule al numero intero. */
  amount: number;
  /** Verdure pesate cotte: grammi da comprare crudi stimati con la resa di cottura; altrimenti null. */
  rawEstimate: number | null;
  /** Peso a cotto senza conversione (cereali, legumi, carni cotte): si compra in base alla resa. */
  cookedNotConverted: boolean;
  /** Prezzo previsto (prezzo del catalogo × quantità con margine); null se il prezzo manca. */
  cost: number | null;
  /** Quantità per cane (senza margine). */
  byDog: { dogId: string; amount: number }[];
}

export interface ShoppingForecast {
  items: ShoppingItem[];
  /** Giorni indicati per ogni cane. */
  daysByDog: Record<string, number>;
  /** Righe con una ricetta che non esiste più (non contate). */
  missingRecipes: ShoppingPlanLine[];
  /** Ingredienti delle ricette non trovati nel catalogo (non contati). */
  unknownKeys: string[];
  /** Totale previsto: ingredienti con prezzo + righe libere con prezzo. */
  total: number;
  /** true se manca almeno un prezzo (ingredienti o righe libere). */
  incomplete: boolean;
}

const SECTION_ORDER: ShoppingItem['section'][] = ['proteica', 'energetica', 'verdure', 'grassi', 'frattaglie', 'altro', 'integratori'];

export function shoppingForecast(shopping: ShoppingData, recipes: Recipe[], catalog: Catalog, prices: PriceBook): ShoppingForecast {
  const byKey = new Map<string, { item: CatalogItem; bowl: number; byDog: Map<string, number> }>();
  const daysByDog: Record<string, number> = {};
  const missingRecipes: ShoppingPlanLine[] = [];
  const unknownKeys: string[] = [];

  for (const plan of shopping.plans) {
    if (!(plan.days > 0)) continue;
    daysByDog[plan.dogId] = (daysByDog[plan.dogId] ?? 0) + plan.days;
    const recipe = recipes.find((r) => r.id === plan.recipeId);
    if (!recipe) {
      missingRecipes.push(plan);
      continue;
    }
    for (const line of recipe.lines) {
      if (!(line.amount > 0)) continue;
      const item = catalog.get(line.key);
      if (!item) {
        if (!unknownKeys.includes(line.key)) unknownKeys.push(line.key);
        continue;
      }
      const entry = byKey.get(line.key) ?? { item, bowl: 0, byDog: new Map<string, number>() };
      const q = line.amount * plan.days;
      entry.bowl += q;
      entry.byDog.set(plan.dogId, (entry.byDog.get(plan.dogId) ?? 0) + q);
      byKey.set(line.key, entry);
    }
  }

  const factor = 1 + shopping.marginPct / 100;
  let total = 0;
  let incomplete = false;
  const items: ShoppingItem[] = [];
  for (const [key, e] of byKey) {
    const unit = e.item.doseUnit;
    const withMargin = e.bowl * factor;
    const amount = Math.ceil(withMargin - 1e-9);
    const section: ShoppingItem['section'] = e.item.kind === 'supplement' ? 'integratori' : e.item.recipeCategory;
    const state = e.item.processingState ?? '';
    const cooked = state.startsWith('cooked');
    const yieldFactor = section === 'verdure' ? VEGETABLE_COOKING_YIELD[state] : undefined;
    const entry = prices[key];
    const p = entry ? unitPrice(entry, unit) : null;
    const cost = p === null ? null : p * withMargin;
    if (cost === null) incomplete = true;
    else total += cost;
    items.push({
      key,
      item: e.item,
      section,
      unit,
      bowlAmount: e.bowl,
      amount,
      rawEstimate: yieldFactor ? Math.ceil(withMargin / yieldFactor - 1e-9) : null,
      cookedNotConverted: cooked && !yieldFactor,
      cost,
      byDog: [...e.byDog].map(([dogId, amount]) => ({ dogId, amount })),
    });
  }
  items.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.item.nameIt.localeCompare(b.item.nameIt, 'it'));

  for (const x of shopping.extras) {
    if (x.price === null) incomplete = true;
    else total += x.price;
  }
  return { items, daysByDog, missingRecipes, unknownKeys, total, incomplete };
}
