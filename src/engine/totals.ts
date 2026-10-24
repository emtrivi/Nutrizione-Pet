// Somma dei nutrienti di una ricetta (alimenti + integratori).
// Regola: un dato mancante non è zero. Se un ingrediente non ha il dato,
// il totale è "valore parziale" (almeno X) e si sa da quali ingredienti manca.

import { UNDECLARED_NEGLIGIBLE, type Catalog } from './catalog';
import { NUTRIENTS } from './nutrients';

export interface RecipeLine {
  /** Chiave del catalogo, es. "food:beef_mid_10" o "supplement:qdiet". */
  key: string;
  /** Grammi (alimenti e integratori in polvere) o numero di capsule. */
  amount: number;
}

export interface Contribution {
  key: string;
  value: number;
  /** Note del dato di questo ingrediente (es. "stima da C18:2"). */
  notes?: string[];
  /** Zero per scelta: non dichiarato dal produttore, considerato trascurabile. */
  assumedZero?: boolean;
}

export interface Total {
  /** Somma delle parti note; null se nessun ingrediente ha il dato. */
  value: number | null;
  /** true se almeno un ingrediente non ha il dato. */
  partial: boolean;
  /** Ingredienti (con quantità > 0) in cui il dato manca. */
  missingIn: string[];
  contributions: Contribution[];
}

export interface NutrientTotal extends Total {
  toVerify: boolean;
  notes: string[];
  parts?: Record<string, number | null>;
}

export interface RecipeTotals {
  nutrients: Record<string, NutrientTotal>;
  kcal: Total;
  /** Peso di ciò che va nella ciotola (alimenti + integratori). */
  massG: Total;
  /** Sostanza secca = peso − acqua. */
  dryMatterG: Total;
  /** Chiavi non trovate nel catalogo. */
  unknownKeys: string[];
}

function emptyTotal(): Total {
  return { value: null, partial: false, missingIn: [], contributions: [] };
}

function add(t: Total, key: string, value: number | null, extra: Omit<Contribution, 'key' | 'value'> = {}): void {
  if (value === null) {
    t.missingIn.push(key);
    t.partial = true;
    return;
  }
  t.value = (t.value ?? 0) + value;
  t.contributions.push({ key, value, ...extra });
}

export function computeTotals(lines: RecipeLine[], catalog: Catalog): RecipeTotals {
  const nutrients: Record<string, NutrientTotal> = {};
  for (const def of NUTRIENTS) {
    nutrients[def.id] = { ...emptyTotal(), toVerify: false, notes: [] };
  }
  const kcal = emptyTotal();
  const massG = emptyTotal();
  const dryMatterG = emptyTotal();
  const unknownKeys: string[] = [];

  for (const line of lines) {
    if (!(line.amount > 0)) continue;
    const item = catalog.get(line.key);
    if (!item) {
      unknownKeys.push(line.key);
      continue;
    }
    const q = line.amount;

    for (const def of NUTRIENTS) {
      const t = nutrients[def.id] as NutrientTotal;
      const n = item.nutrients[def.id];
      if (!n) {
        add(t, item.key, null);
        continue;
      }
      add(t, item.key, n.value * q, {
        ...(n.notes.length > 0 ? { notes: n.notes } : {}),
        ...(n.status === UNDECLARED_NEGLIGIBLE ? { assumedZero: true } : {}),
      });
      if (n.partial) {
        t.partial = true;
        if (!t.missingIn.includes(item.key)) t.missingIn.push(item.key);
      }
      if (n.toVerify) t.toVerify = true;
      for (const note of n.notes) if (!t.notes.includes(note)) t.notes.push(note);
      if (n.parts) {
        t.parts ??= {};
        for (const [name, v] of Object.entries(n.parts)) {
          const prev = t.parts[name];
          t.parts[name] = v === null ? (prev ?? null) : (prev ?? 0) + v * q;
        }
      }
    }

    add(kcal, item.key, item.kcalPerUnit === null ? null : item.kcalPerUnit * q);

    const mass = item.massPerUnitG === null ? null : item.massPerUnitG * q;
    add(massG, item.key, mass);
    const water = item.nutrients.moisture;
    add(dryMatterG, item.key, mass === null || !water ? null : mass - water.value * q);
  }

  // Se il totale è fatto solo di zeri per scelta, il dato vero manca: resta grigio.
  for (const t of Object.values(nutrients)) {
    if (t.contributions.length > 0 && t.contributions.every((c) => c.assumedZero)) t.value = null;
  }

  return { nutrients, kcal, massG, dryMatterG, unknownKeys };
}

/** Valore per 1.000 kcal. */
export function per1000Kcal(value: number, kcal: number): number {
  if (!(kcal > 0)) throw new Error('Le kcal devono essere maggiori di zero');
  return (value * 1000) / kcal;
}

/** Rapporto calcio/fosforo (in massa). */
export function calciumPhosphorusRatio(totals: RecipeTotals): {
  value: number | null;
  partial: boolean;
} {
  const ca = totals.nutrients.calcium;
  const p = totals.nutrients.phosphorus;
  if (!ca || !p || ca.value === null || p.value === null || p.value === 0) {
    return { value: null, partial: true };
  }
  return { value: ca.value / p.value, partial: ca.partial || p.partial };
}
