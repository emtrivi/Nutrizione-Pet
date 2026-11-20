// Dispensa (20/11/2026): quanto c'è in casa di ogni ingrediente, in grammi (o capsule per gli integratori
// a capsule), nello stesso peso delle ricette. Si aggiorna solo a mano: acquisti, "finito", correzioni.
// Nessuno scalo automatico dal diario.

import type { Catalog } from './catalog';

export interface PantryItem {
  /** Quantità in casa: grammi, o capsule per gli integratori a capsule. */
  amount: number;
  /** Peso (o numero di capsule) di una confezione, dall'ultimo acquisto: serve a "finito". */
  packageSize: number | null;
  updatedAt: string;
}

export interface PantryPurchase {
  id: string;
  key: string;
  /** Giorno dell'acquisto, AAAA-MM-GG. */
  day: string;
  packages: number;
  packageSize: number;
}

export interface PantryData {
  /** Per chiave del catalogo, es. "food:beef_mid_10". */
  items: Record<string, PantryItem>;
  /** Registro degli acquisti (solo da consultare). */
  purchases: PantryPurchase[];
}

export const EMPTY_PANTRY: PantryData = { items: {}, purchases: [] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonNeg = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Dispensa letta dal telefono o da un backup: quello che non è valido si scarta (dati di prima: vuota). */
export function sanitizePantry(v: unknown): PantryData {
  if (!isObject(v)) return { items: {}, purchases: [] };
  const items: Record<string, PantryItem> = {};
  if (isObject(v.items)) {
    for (const [key, it] of Object.entries(v.items)) {
      if (!isObject(it) || !nonNeg(it.amount)) continue;
      items[key] = {
        amount: it.amount,
        packageSize: nonNeg(it.packageSize) && it.packageSize > 0 ? it.packageSize : null,
        updatedAt: typeof it.updatedAt === 'string' ? it.updatedAt : '',
      };
    }
  }
  const purchases = Array.isArray(v.purchases)
    ? v.purchases
        .filter(
          (p): p is Record<string, unknown> =>
            isObject(p) && typeof p.id === 'string' && typeof p.key === 'string' && typeof p.day === 'string' && nonNeg(p.packages) && nonNeg(p.packageSize),
        )
        .map((p) => ({ id: p.id as string, key: p.key as string, day: p.day as string, packages: p.packages as number, packageSize: p.packageSize as number }))
    : [];
  return { items, purchases };
}

/** Quanto c'è in casa (0 se l'ingrediente non è in dispensa). */
export function pantryAmount(pantry: PantryData, key: string): number {
  return pantry.items[key]?.amount ?? 0;
}

/** Acquisto: "3 vaschette da 1.000 g" aggiunge 3.000 g e ricorda la confezione da 1.000 g. */
export function addPurchase(pantry: PantryData, purchase: PantryPurchase, now: Date): PantryData {
  const prev = pantry.items[purchase.key];
  return {
    items: {
      ...pantry.items,
      [purchase.key]: {
        amount: (prev?.amount ?? 0) + purchase.packages * purchase.packageSize,
        packageSize: purchase.packageSize,
        updatedAt: now.toISOString(),
      },
    },
    purchases: [...pantry.purchases, purchase],
  };
}

/** "Finito": una confezione in meno (mai sotto zero). Senza confezione nota non cambia nulla. */
export function finishPackage(pantry: PantryData, key: string, now: Date): PantryData {
  const it = pantry.items[key];
  if (!it || !it.packageSize) return pantry;
  return { ...pantry, items: { ...pantry.items, [key]: { ...it, amount: Math.max(0, it.amount - it.packageSize), updatedAt: now.toISOString() } } };
}

/** Correzione a mano della quantità. */
export function setPantryAmount(pantry: PantryData, key: string, amount: number, now: Date): PantryData {
  const it = pantry.items[key];
  return {
    ...pantry,
    items: { ...pantry.items, [key]: { amount: Math.max(0, amount), packageSize: it?.packageSize ?? null, updatedAt: now.toISOString() } },
  };
}

/** Toglie l'ingrediente dalla dispensa (il registro degli acquisti resta). */
export function removePantryItem(pantry: PantryData, key: string): PantryData {
  const items = { ...pantry.items };
  delete items[key];
  return { ...pantry, items };
}

/** Per quanti giorni basta quello che c'è in casa con la dose giornaliera della ricetta (giorni interi). */
export function daysCovered(amountInPantry: number, perDay: number): number | null {
  if (!(perDay > 0)) return null;
  return Math.floor(amountInPantry / perDay + 1e-9);
}

/** Ingredienti in dispensa ordinati per nome (quelli non più nel catalogo restano, con la chiave). */
export function pantryList(pantry: PantryData, catalog: Catalog): { key: string; name: string; unit: 'g' | 'capsule'; item: PantryItem }[] {
  return Object.entries(pantry.items)
    .map(([key, item]) => {
      const c = catalog.get(key);
      return { key, name: c?.nameIt ?? key, unit: c?.doseUnit ?? 'g', item };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}
