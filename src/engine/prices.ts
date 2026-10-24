// Prezzi in euro. Si salvano tra i dati personali, separati dal catalogo.
// Il prezzo vale per ciò che si pesa nella ciotola: per un alimento cotto
// è il prezzo del cotto.

import type { CatalogItem } from './catalog';
import type { RecipeLine } from './totals';

export type PriceEntry =
  | { mode: 'per_kg'; eurPerKg: number }
  /** Confezione: prezzo e contenuto (grammi, o numero di capsule). */
  | { mode: 'per_package'; packagePrice: number; packageSize: number }
  | { mode: 'per_unit'; eurPerUnit: number };

/** Prezzi per chiave del catalogo, es. { "food:beef_mid_10": {...} }. */
export type PriceBook = Record<string, PriceEntry & { updatedAt?: string }>;

/**
 * Prezzo per unità di dose: euro al grammo, oppure euro a capsula.
 * Restituisce null se il prezzo non è valido per quell'unità.
 */
export function unitPrice(entry: PriceEntry, doseUnit: 'g' | 'capsule'): number | null {
  switch (entry.mode) {
    case 'per_kg':
      if (doseUnit !== 'g' || !(entry.eurPerKg >= 0)) return null;
      return entry.eurPerKg / 1000;
    case 'per_package':
      if (!(entry.packagePrice >= 0) || !(entry.packageSize > 0)) return null;
      return entry.packagePrice / entry.packageSize;
    case 'per_unit':
      if (!(entry.eurPerUnit >= 0)) return null;
      return entry.eurPerUnit;
  }
}

export interface CostLine {
  key: string;
  amount: number;
  /** Costo della riga in euro; null se il prezzo manca. */
  cost: number | null;
}

export interface CostSummary {
  lines: CostLine[];
  /** Somma delle righe con prezzo. */
  total: number;
  /** true se manca almeno un prezzo: il totale dice "incompleto". */
  incomplete: boolean;
  missingPrices: string[];
}

export function computeCost(
  lines: RecipeLine[],
  prices: PriceBook,
  getItem: (key: string) => Pick<CatalogItem, 'doseUnit'> | undefined,
): CostSummary {
  const out: CostLine[] = [];
  const missing: string[] = [];
  let total = 0;
  for (const line of lines) {
    if (!(line.amount > 0)) continue;
    const item = getItem(line.key);
    const entry = prices[line.key];
    const p = item && entry ? unitPrice(entry, item.doseUnit) : null;
    if (p === null) {
      missing.push(line.key);
      out.push({ key: line.key, amount: line.amount, cost: null });
      continue;
    }
    const cost = p * line.amount;
    total += cost;
    out.push({ key: line.key, amount: line.amount, cost });
  }
  return { lines: out, total, incomplete: missing.length > 0, missingPrices: missing };
}

/** Formato euro italiano, es. "3,45 €". */
export function formatEuro(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}
