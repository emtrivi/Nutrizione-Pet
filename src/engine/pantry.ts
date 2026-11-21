// Dispensa (20/11/2026, righe per confezione dal 21/11/2026): quanto c'è in casa di ogni ingrediente,
// in grammi (o capsule per gli integratori a capsule), nello stesso peso delle ricette.
// Si aggiorna solo a mano: acquisti, +1/−1, correzioni, "finito". Nessuno scalo automatico dal diario.
//
// Ogni ingrediente può avere più righe ("lotti"):
//   - confezioni: N confezioni intere dello stesso formato (es. 2 × 1.000 g). Un acquisto dello stesso
//     prodotto e dello stesso formato si somma alla riga; un formato diverso fa una riga a parte.
//   - resto: grammi sfusi rimasti da una correzione a mano. Non si somma mai alle confezioni intere.
//   - partita: acquisto sfuso (es. 10.000 g). Non si unisce mai a niente: ogni partita resta la sua riga.
// Il totale per ingrediente (pantryAmount) è la somma delle righe: Spesa e ricette lo usano come prima.

import type { Catalog } from './catalog';

export type PantryLotKind = 'confezioni' | 'resto' | 'partita';

export interface PantryLot {
  id: string;
  /** Chiave del catalogo, es. "food:beef_mid_10". */
  key: string;
  kind: PantryLotKind;
  /** Solo confezioni: numero di confezioni intere. */
  packages: number;
  /** Solo confezioni: grammi (o capsule) di una confezione. */
  packageSize: number;
  /** Resto e partita: grammi (o capsule) che restano. */
  amount: number;
  /** Solo partita: grammi acquistati all'inizio. */
  bought: number;
  /** Giorno dell'acquisto (o della correzione per un resto), AAAA-MM-GG. */
  day: string;
  updatedAt: string;
}

/** Riepilogo per ingrediente (calcolato dalle righe): resta nei dati per le versioni precedenti dell'app. */
export interface PantryItem {
  amount: number;
  packageSize: number | null;
  updatedAt: string;
}

export interface PantryPurchase {
  id: string;
  key: string;
  /** Giorno dell'acquisto, AAAA-MM-GG. */
  day: string;
  packages: number;
  /** Per una partita sfusa: i grammi della partita (con packages = 1). */
  packageSize: number;
  /** "partita" per un acquisto sfuso; assente per le confezioni. */
  kind?: 'partita';
}

export interface PantryData {
  lots: PantryLot[];
  /** Riepilogo calcolato dalle righe (non modificarlo a mano). */
  items: Record<string, PantryItem>;
  /** Registro degli acquisti (solo da consultare). */
  purchases: PantryPurchase[];
}

export const EMPTY_PANTRY: PantryData = { lots: [], items: {}, purchases: [] };

const EPS = 1e-9;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonNeg = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const pos = (v: unknown): v is number => nonNeg(v) && v > 0;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const sameSize = (a: number, b: number) => Math.abs(a - b) < EPS;

/** Quantità di una riga: confezioni × formato, oppure i grammi che restano. */
export function lotAmount(lot: PantryLot): number {
  return lot.kind === 'confezioni' ? lot.packages * lot.packageSize : lot.amount;
}

function summarize(lots: PantryLot[]): Record<string, PantryItem> {
  const items: Record<string, PantryItem> = {};
  for (const lot of lots) {
    const prev = items[lot.key];
    items[lot.key] = {
      amount: (prev?.amount ?? 0) + lotAmount(lot),
      packageSize: lot.kind === 'confezioni' ? lot.packageSize : (prev?.packageSize ?? null),
      updatedAt: prev && prev.updatedAt > lot.updatedAt ? prev.updatedAt : lot.updatedAt,
    };
  }
  return items;
}

const make = (lots: PantryLot[], purchases: PantryPurchase[]): PantryData => ({ lots, items: summarize(lots), purchases });

function sanitizeLot(l: unknown): PantryLot | null {
  if (!isObject(l) || typeof l.id !== 'string' || typeof l.key !== 'string') return null;
  const base = { id: l.id, key: l.key, day: str(l.day), updatedAt: str(l.updatedAt) };
  if (l.kind === 'confezioni') {
    if (!pos(l.packages) || !pos(l.packageSize)) return null;
    return { ...base, kind: 'confezioni', packages: Math.round(l.packages), packageSize: l.packageSize, amount: 0, bought: 0 };
  }
  if (l.kind === 'resto' || l.kind === 'partita') {
    if (!pos(l.amount)) return null;
    return { ...base, kind: l.kind, packages: 0, packageSize: 0, amount: l.amount, bought: l.kind === 'partita' && pos(l.bought) ? l.bought : 0 };
  }
  return null;
}

/** Dispensa di prima (un totale per ingrediente): confezioni intere + resto, così il totale non cambia. */
function convertOldItems(items: Record<string, unknown>): PantryLot[] {
  const lots: PantryLot[] = [];
  for (const [key, it] of Object.entries(items)) {
    if (!isObject(it) || !pos(it.amount)) continue;
    const updatedAt = str(it.updatedAt);
    const day = updatedAt.slice(0, 10);
    const size = pos(it.packageSize) ? it.packageSize : null;
    const whole = size ? Math.floor(it.amount / size + EPS) : 0;
    const rest = size ? it.amount - whole * size : it.amount;
    if (size && whole > 0) lots.push({ id: `old:${key}`, key, kind: 'confezioni', packages: whole, packageSize: size, amount: 0, bought: 0, day, updatedAt });
    if (rest > EPS) lots.push({ id: `old:${key}:resto`, key, kind: 'resto', packages: 0, packageSize: 0, amount: rest, bought: 0, day, updatedAt });
  }
  return lots;
}

/** Dispensa letta dal telefono o da un backup: quello che non è valido si scarta (dati di prima: convertiti). */
export function sanitizePantry(v: unknown): PantryData {
  if (!isObject(v)) return make([], []);
  const lots = Array.isArray(v.lots)
    ? v.lots.map(sanitizeLot).filter((l): l is PantryLot => l !== null)
    : isObject(v.items)
      ? convertOldItems(v.items)
      : [];
  const purchases = Array.isArray(v.purchases)
    ? v.purchases
        .filter(
          (p): p is Record<string, unknown> =>
            isObject(p) && typeof p.id === 'string' && typeof p.key === 'string' && typeof p.day === 'string' && nonNeg(p.packages) && nonNeg(p.packageSize),
        )
        .map((p) => {
          const out: PantryPurchase = { id: p.id as string, key: p.key as string, day: p.day as string, packages: p.packages as number, packageSize: p.packageSize as number };
          if (p.kind === 'partita') out.kind = 'partita';
          return out;
        })
    : [];
  return make(lots, purchases);
}

/** Quanto c'è in casa in tutto (somma delle righe; 0 se l'ingrediente non è in dispensa). */
export function pantryAmount(pantry: PantryData, key: string): number {
  let sum = 0;
  for (const lot of pantry.lots) if (lot.key === key) sum += lotAmount(lot);
  return sum;
}

/**
 * Acquisto a confezioni: "2 vaschette da 1.000 g". Se c'è già una riga dello stesso prodotto con lo
 * stesso formato, le confezioni si sommano a quella; altrimenti nasce una riga nuova.
 */
export function addPackages(pantry: PantryData, purchase: Omit<PantryPurchase, 'kind'>, now: Date): PantryData {
  const at = now.toISOString();
  const packages = Math.round(purchase.packages);
  if (!(packages > 0) || !(purchase.packageSize > 0)) return pantry;
  const i = pantry.lots.findIndex((l) => l.kind === 'confezioni' && l.key === purchase.key && sameSize(l.packageSize, purchase.packageSize));
  const lots =
    i >= 0
      ? pantry.lots.map((l, j) => (j === i ? { ...l, packages: l.packages + packages, day: purchase.day, updatedAt: at } : l))
      : [
          ...pantry.lots,
          { id: purchase.id, key: purchase.key, kind: 'confezioni' as const, packages, packageSize: purchase.packageSize, amount: 0, bought: 0, day: purchase.day, updatedAt: at },
        ];
  return make(lots, [...pantry.purchases, { ...purchase, packages }]);
}

/** Acquisto sfuso: "10.000 g". È sempre una riga nuova, anche se c'è già una partita uguale. */
export function addBulk(pantry: PantryData, purchase: { id: string; key: string; day: string; grams: number }, now: Date): PantryData {
  if (!(purchase.grams > 0)) return pantry;
  const lot: PantryLot = {
    id: purchase.id,
    key: purchase.key,
    kind: 'partita',
    packages: 0,
    packageSize: 0,
    amount: purchase.grams,
    bought: purchase.grams,
    day: purchase.day,
    updatedAt: now.toISOString(),
  };
  return make([...pantry.lots, lot], [...pantry.purchases, { id: purchase.id, key: purchase.key, day: purchase.day, packages: 1, packageSize: purchase.grams, kind: 'partita' }]);
}

/** +1 / −1 confezione su una riga a confezioni. A zero confezioni la riga sparisce. */
export function changePackages(pantry: PantryData, lotId: string, delta: number, now: Date): PantryData {
  const lot = pantry.lots.find((l) => l.id === lotId);
  if (!lot || lot.kind !== 'confezioni') return pantry;
  return editLot(pantry, lotId, lot.packages + delta, lot.packageSize, now);
}

/**
 * Modifica completa di una riga a confezioni: numero di confezioni e formato. A zero confezioni la riga
 * sparisce; se il nuovo formato è uguale a quello di un'altra riga dello stesso prodotto, le due si uniscono.
 */
export function editLot(pantry: PantryData, lotId: string, packages: number, packageSize: number, now: Date): PantryData {
  const lot = pantry.lots.find((l) => l.id === lotId);
  if (!lot || lot.kind !== 'confezioni' || !(packageSize > 0)) return pantry;
  const n = Math.round(packages);
  if (!(n > 0)) return removeLot(pantry, lotId);
  const at = now.toISOString();
  const other = pantry.lots.find((l) => l.id !== lotId && l.kind === 'confezioni' && l.key === lot.key && sameSize(l.packageSize, packageSize));
  const lots = other
    ? pantry.lots.filter((l) => l.id !== lotId).map((l) => (l.id === other.id ? { ...l, packages: l.packages + n, updatedAt: at } : l))
    : pantry.lots.map((l) => (l.id === lotId ? { ...l, packages: n, packageSize, updatedAt: at } : l));
  return make(lots, pantry.purchases);
}

/**
 * Correzione dei grammi di una riga a confezioni (es. 2 × 1.000 g → 1.600 g): restano le confezioni intere
 * (1 × 1.000 g) e la parte che non fa una confezione intera (600 g) diventa una riga «resto» a parte.
 */
export function correctPackageGrams(pantry: PantryData, lotId: string, grams: number, restoId: string, now: Date, day: string): PantryData {
  const lot = pantry.lots.find((l) => l.id === lotId);
  if (!lot || lot.kind !== 'confezioni' || !nonNeg(grams)) return pantry;
  const at = now.toISOString();
  const whole = Math.floor(grams / lot.packageSize + EPS);
  const rest = grams - whole * lot.packageSize;
  const lots: PantryLot[] = [];
  for (const l of pantry.lots) {
    if (l.id !== lotId) lots.push(l);
    else if (whole > 0) lots.push({ ...l, packages: whole, updatedAt: at });
  }
  if (rest > EPS) lots.push({ id: restoId, key: lot.key, kind: 'resto', packages: 0, packageSize: 0, amount: rest, bought: 0, day, updatedAt: at });
  return make(lots, pantry.purchases);
}

/** «Aggiorna quanto resta» per una partita sfusa o un resto. A zero la riga sparisce. */
export function updateRemaining(pantry: PantryData, lotId: string, grams: number, now: Date): PantryData {
  const lot = pantry.lots.find((l) => l.id === lotId);
  if (!lot || lot.kind === 'confezioni' || !nonNeg(grams)) return pantry;
  if (!(grams > EPS)) return removeLot(pantry, lotId);
  return make(
    pantry.lots.map((l) => (l.id === lotId ? { ...l, amount: grams, updatedAt: now.toISOString() } : l)),
    pantry.purchases,
  );
}

/** Toglie la riga dalla dispensa («Finito» per partite e resti, «Togli» per le confezioni). Il registro resta. */
export function removeLot(pantry: PantryData, lotId: string): PantryData {
  return make(
    pantry.lots.filter((l) => l.id !== lotId),
    pantry.purchases,
  );
}

/** Formato dell'ultimo acquisto a confezioni di un ingrediente (per proporlo nel modulo), o null. */
export function lastPackageSize(pantry: PantryData, key: string): number | null {
  for (let i = pantry.purchases.length - 1; i >= 0; i--) {
    const p = pantry.purchases[i];
    if (p && p.key === key && p.kind !== 'partita' && p.packageSize > 0) return p.packageSize;
  }
  return null;
}

/** Per quanti giorni basta quello che c'è in casa con la dose giornaliera della ricetta (giorni interi). */
export function daysCovered(amountInPantry: number, perDay: number): number | null {
  if (!(perDay > 0)) return null;
  return Math.floor(amountInPantry / perDay + 1e-9);
}

const KIND_ORDER: Record<PantryLotKind, number> = { confezioni: 0, resto: 1, partita: 2 };

/**
 * Righe della dispensa raggruppate per ingrediente (in ordine di nome), con il totale. Dentro l'ingrediente:
 * confezioni (formato più grande prima), resti, partite (dalla più vecchia). Quelli non più nel catalogo restano.
 */
export function pantryGroups(
  pantry: PantryData,
  catalog: Catalog,
): { key: string; name: string; unit: 'g' | 'capsule'; total: number; lots: PantryLot[] }[] {
  const byKey = new Map<string, PantryLot[]>();
  for (const lot of pantry.lots) byKey.set(lot.key, [...(byKey.get(lot.key) ?? []), lot]);
  return [...byKey]
    .map(([key, lots]) => {
      const c = catalog.get(key);
      const sorted = [...lots].sort(
        (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.packageSize - a.packageSize || a.day.localeCompare(b.day) || a.id.localeCompare(b.id),
      );
      return { key, name: c?.nameIt ?? key, unit: c?.doseUnit ?? ('g' as const), total: lots.reduce((s, l) => s + lotAmount(l), 0), lots: sorted };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}
