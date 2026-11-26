// Dispensa (20/11/2026; righe per confezione dal 21/11/2026; acquisto e consumo separati dal 21/11/2026):
// quanto c'è in casa di ogni ingrediente, in grammi (o capsule per gli integratori a capsule), nello stesso
// peso delle ricette. Si aggiorna solo a mano. Nessuno scalo automatico dal diario.
//
// Ogni ingrediente può avere più righe ("lotti"):
//   - confezioni: N confezioni intere dello stesso formato (es. 2 × 1.000 g). Un acquisto dello stesso
//     prodotto e dello stesso formato si somma alla riga; un formato diverso fa una riga a parte.
//   - resto: grammi rimasti di una confezione aperta. Non si somma mai alle confezioni intere.
//   - partita: acquisto sfuso (es. 10.000 g). Non si unisce mai a niente: ogni partita resta la sua riga.
// Il totale per ingrediente (pantryAmount) è la somma delle righe: Spesa e ricette lo usano come prima.
//
// Due momenti separati:
//   - ACQUISTO: una bozza (con la data) in cui si aggiungono i prodotti e si corregge liberamente; le
//     correzioni non vanno nello storico. «Ho finito» la conferma: entra in dispensa e nello storico.
//     Un acquisto confermato si può modificare dopo: la dispensa si aggiorna e lo storico lo registra.
//   - CONSUMO: sulle righe della dispensa, «Confezione finita» e «Consumata in parte», con voce nello storico.
// Lo storico e gli acquisti confermati si tengono 3 mesi; le voci più vecchie si cancellano da sole.

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
  /** Giorno dell'acquisto (o del consumo per un resto), AAAA-MM-GG. */
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

/** Un prodotto dentro un acquisto (bozza o confermato). */
export interface PurchaseLine {
  id: string;
  key: string;
  kind: 'confezioni' | 'partita';
  /** Confezioni: numero e formato. */
  packages: number;
  packageSize: number;
  /** Partita sfusa: grammi in tutto. */
  grams: number;
}

/** Acquisto confermato: si tiene per poterlo modificare (3 mesi). */
export interface PurchaseSession {
  id: string;
  /** Giorno dell'acquisto, AAAA-MM-GG. */
  day: string;
  lines: PurchaseLine[];
  confirmedAt: string;
}

/** Bozza: un acquisto nuovo, o la modifica di uno confermato (editingOf). */
export interface PurchaseDraft {
  id: string;
  day: string;
  lines: PurchaseLine[];
  /** Id dell'acquisto confermato che si sta modificando, o null per un acquisto nuovo. */
  editingOf: string | null;
  updatedAt: string;
}

export type PantryHistoryEntry =
  | { id: string; at: string; day: string; type: 'acquisto'; purchaseDay: string; lines: PurchaseLine[] }
  | { id: string; at: string; day: string; type: 'modifica'; purchaseDay: string; before: PurchaseLine[]; after: PurchaseLine[] }
  | { id: string; at: string; day: string; type: 'finita'; key: string; lotKind: PantryLotKind; amount: number; packageSize: number }
  | { id: string; at: string; day: string; type: 'consumo'; key: string; lotKind: PantryLotKind; consumed: number; remaining: number };

export interface PantryData {
  lots: PantryLot[];
  /** Riepilogo calcolato dalle righe (non modificarlo a mano). */
  items: Record<string, PantryItem>;
  /** Registro degli acquisti delle versioni precedenti (e degli acquisti confermati), solo da consultare. */
  purchases: PantryPurchase[];
  /** Acquisto non ancora confermato (salvato sul telefono), o null. */
  draft: PurchaseDraft | null;
  /** Acquisti confermati degli ultimi 3 mesi (per poterli modificare). */
  sessions: PurchaseSession[];
  /** Storico: acquisti confermati, modifiche e consumi degli ultimi 3 mesi. */
  history: PantryHistoryEntry[];
}

export const EMPTY_PANTRY: PantryData = { lots: [], items: {}, purchases: [], draft: null, sessions: [], history: [] };

/** Mesi di storico (e di acquisti modificabili). */
export const HISTORY_MONTHS = 3;

const EPS = 1e-9;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonNeg = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const pos = (v: unknown): v is number => nonNeg(v) && v > 0;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const sameSize = (a: number, b: number) => Math.abs(a - b) < EPS;
const localDayOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Quantità di una riga: confezioni × formato, oppure i grammi che restano. */
export function lotAmount(lot: PantryLot): number {
  return lot.kind === 'confezioni' ? lot.packages * lot.packageSize : lot.amount;
}

/** Quantità di un prodotto in un acquisto. */
export function lineAmount(line: PurchaseLine): number {
  return line.kind === 'confezioni' ? line.packages * line.packageSize : line.grams;
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

/** Nuove righe: il riepilogo si ricalcola, il resto resta com'è. */
const withLots = (pantry: PantryData, lots: PantryLot[]): PantryData => ({ ...pantry, lots, items: summarize(lots) });

// ---------------------------------------------------------------- lettura dal telefono / backup

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

function sanitizeLine(l: unknown): PurchaseLine | null {
  if (!isObject(l) || typeof l.id !== 'string' || typeof l.key !== 'string') return null;
  if (l.kind === 'confezioni' && pos(l.packages) && pos(l.packageSize))
    return { id: l.id, key: l.key, kind: 'confezioni', packages: Math.round(l.packages), packageSize: l.packageSize, grams: 0 };
  if (l.kind === 'partita' && pos(l.grams)) return { id: l.id, key: l.key, kind: 'partita', packages: 0, packageSize: 0, grams: l.grams };
  return null;
}

const sanitizeLines = (v: unknown): PurchaseLine[] => (Array.isArray(v) ? v.map(sanitizeLine).filter((l): l is PurchaseLine => l !== null) : []);
const LOT_KINDS: PantryLotKind[] = ['confezioni', 'resto', 'partita'];

function sanitizeHistoryEntry(e: unknown): PantryHistoryEntry | null {
  if (!isObject(e) || typeof e.id !== 'string' || typeof e.day !== 'string') return null;
  const base = { id: e.id, at: str(e.at), day: e.day };
  switch (e.type) {
    case 'acquisto':
      return { ...base, type: 'acquisto', purchaseDay: str(e.purchaseDay), lines: sanitizeLines(e.lines) };
    case 'modifica':
      return { ...base, type: 'modifica', purchaseDay: str(e.purchaseDay), before: sanitizeLines(e.before), after: sanitizeLines(e.after) };
    case 'finita':
    case 'consumo': {
      if (typeof e.key !== 'string') return null;
      const lotKind = LOT_KINDS.includes(e.lotKind as PantryLotKind) ? (e.lotKind as PantryLotKind) : 'resto';
      if (e.type === 'finita') return { ...base, type: 'finita', key: e.key, lotKind, amount: nonNeg(e.amount) ? e.amount : 0, packageSize: nonNeg(e.packageSize) ? e.packageSize : 0 };
      return { ...base, type: 'consumo', key: e.key, lotKind, consumed: nonNeg(e.consumed) ? e.consumed : 0, remaining: nonNeg(e.remaining) ? e.remaining : 0 };
    }
    default:
      return null;
  }
}

/** Dispensa letta dal telefono o da un backup: quello che non è valido si scarta (dati di prima: convertiti). */
export function sanitizePantry(v: unknown): PantryData {
  if (!isObject(v)) return { ...EMPTY_PANTRY };
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
  const d = v.draft;
  const draft: PurchaseDraft | null =
    isObject(d) && typeof d.id === 'string' && typeof d.day === 'string'
      ? { id: d.id, day: d.day, lines: sanitizeLines(d.lines), editingOf: typeof d.editingOf === 'string' ? d.editingOf : null, updatedAt: str(d.updatedAt) }
      : null;
  const sessions = Array.isArray(v.sessions)
    ? v.sessions
        .filter((s): s is Record<string, unknown> => isObject(s) && typeof s.id === 'string' && typeof s.day === 'string')
        .map((s) => ({ id: s.id as string, day: s.day as string, lines: sanitizeLines(s.lines), confirmedAt: str(s.confirmedAt) }))
    : [];
  const history = Array.isArray(v.history) ? v.history.map(sanitizeHistoryEntry).filter((e): e is PantryHistoryEntry => e !== null) : [];
  return { lots, items: summarize(lots), purchases, draft, sessions, history };
}

/** Quanto c'è in casa in tutto (somma delle righe; 0 se l'ingrediente non è in dispensa). */
export function pantryAmount(pantry: PantryData, key: string): number {
  let sum = 0;
  for (const lot of pantry.lots) if (lot.key === key) sum += lotAmount(lot);
  return sum;
}

// ---------------------------------------------------------------- righe della dispensa

/**
 * Confezioni in dispensa: se c'è già una riga dello stesso prodotto con lo stesso formato, le confezioni
 * si sommano a quella; altrimenti nasce una riga nuova.
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
  return { ...withLots(pantry, lots), purchases: [...pantry.purchases, { ...purchase, packages }] };
}

/** Partita sfusa in dispensa: sempre una riga nuova, anche se c'è già una partita uguale. */
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
  return {
    ...withLots(pantry, [...pantry.lots, lot]),
    purchases: [...pantry.purchases, { id: purchase.id, key: purchase.key, day: purchase.day, packages: 1, packageSize: purchase.grams, kind: 'partita' }],
  };
}

/** Toglie la riga dalla dispensa (senza voce nello storico). */
export function removeLot(pantry: PantryData, lotId: string): PantryData {
  return withLots(
    pantry,
    pantry.lots.filter((l) => l.id !== lotId),
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

// ---------------------------------------------------------------- storico

/** Primo giorno che resta nello storico: oggi meno 3 mesi. */
export function historyCutoff(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth() - HISTORY_MONTHS, now.getDate());
  return localDayOf(d);
}

/** Cancella le voci dello storico (e gli acquisti confermati) più vecchi di 3 mesi. */
export function pruneHistory(pantry: PantryData, now: Date): PantryData {
  const cutoff = historyCutoff(now);
  const history = pantry.history.filter((e) => e.day >= cutoff);
  const sessions = pantry.sessions.filter((s) => s.day >= cutoff || s.confirmedAt.slice(0, 10) >= cutoff);
  if (history.length === pantry.history.length && sessions.length === pantry.sessions.length) return pantry;
  return { ...pantry, history, sessions };
}

/** Storico da mostrare: ultimi 3 mesi, dal più recente. */
export function visibleHistory(pantry: PantryData, now: Date): PantryHistoryEntry[] {
  const cutoff = historyCutoff(now);
  return pantry.history.filter((e) => e.day >= cutoff).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

const record = (pantry: PantryData, entry: PantryHistoryEntry, now: Date): PantryData => pruneHistory({ ...pantry, history: [...pantry.history, entry] }, now);

// ---------------------------------------------------------------- acquisto: bozza

type NewLine = { key: string; kind: 'confezioni'; packages: number; packageSize: number } | { key: string; kind: 'partita'; grams: number };

/** Aggiunge un prodotto alla bozza (la crea se non c'è). Stesso prodotto e formato: si somma; partite mai unite. */
export function draftAddLine(pantry: PantryData, line: NewLine, lineId: string, now: Date, day: string): PantryData {
  const draft = pantry.draft ?? { id: lineId, day, lines: [], editingOf: null, updatedAt: '' };
  let lines: PurchaseLine[];
  if (line.kind === 'confezioni') {
    const n = Math.round(line.packages);
    if (!(n > 0) || !(line.packageSize > 0)) return pantry;
    const same = draft.lines.find((l) => l.kind === 'confezioni' && l.key === line.key && sameSize(l.packageSize, line.packageSize));
    lines = same
      ? draft.lines.map((l) => (l === same ? { ...l, packages: l.packages + n } : l))
      : [...draft.lines, { id: lineId, key: line.key, kind: 'confezioni', packages: n, packageSize: line.packageSize, grams: 0 }];
  } else {
    if (!(line.grams > 0)) return pantry;
    lines = [...draft.lines, { id: lineId, key: line.key, kind: 'partita', packages: 0, packageSize: 0, grams: line.grams }];
  }
  return { ...pantry, draft: { ...draft, lines, updatedAt: now.toISOString() } };
}

/** +1 / −1 su un prodotto a confezioni della bozza (a zero sparisce). Non va nello storico. */
export function draftChangePackages(pantry: PantryData, lineId: string, delta: number, now: Date): PantryData {
  const line = pantry.draft?.lines.find((l) => l.id === lineId);
  if (!line || line.kind !== 'confezioni') return pantry;
  return draftEditLine(pantry, lineId, { packages: line.packages + delta, packageSize: line.packageSize }, now);
}

/**
 * Modifica di un prodotto della bozza: confezioni e formato, oppure i grammi di una partita. A zero sparisce;
 * se il nuovo formato è uguale a quello di un'altra riga dello stesso prodotto, le due si uniscono.
 */
export function draftEditLine(pantry: PantryData, lineId: string, change: { packages: number; packageSize: number } | { grams: number }, now: Date): PantryData {
  const draft = pantry.draft;
  const line = draft?.lines.find((l) => l.id === lineId);
  if (!draft || !line) return pantry;
  const at = now.toISOString();
  if ('grams' in change) {
    if (line.kind !== 'partita' || !nonNeg(change.grams)) return pantry;
    if (!(change.grams > 0)) return draftRemoveLine(pantry, lineId, now);
    return { ...pantry, draft: { ...draft, lines: draft.lines.map((l) => (l.id === lineId ? { ...l, grams: change.grams } : l)), updatedAt: at } };
  }
  if (line.kind !== 'confezioni' || !(change.packageSize > 0)) return pantry;
  const n = Math.round(change.packages);
  if (!(n > 0)) return draftRemoveLine(pantry, lineId, now);
  const other = draft.lines.find((l) => l.id !== lineId && l.kind === 'confezioni' && l.key === line.key && sameSize(l.packageSize, change.packageSize));
  const lines = other
    ? draft.lines.filter((l) => l.id !== lineId).map((l) => (l.id === other.id ? { ...l, packages: l.packages + n } : l))
    : draft.lines.map((l) => (l.id === lineId ? { ...l, packages: n, packageSize: change.packageSize } : l));
  return { ...pantry, draft: { ...draft, lines, updatedAt: at } };
}

export function draftRemoveLine(pantry: PantryData, lineId: string, now: Date): PantryData {
  const draft = pantry.draft;
  if (!draft) return pantry;
  return { ...pantry, draft: { ...draft, lines: draft.lines.filter((l) => l.id !== lineId), updatedAt: now.toISOString() } };
}

export function draftSetDay(pantry: PantryData, day: string, now: Date): PantryData {
  return pantry.draft ? { ...pantry, draft: { ...pantry.draft, day, updatedAt: now.toISOString() } } : pantry;
}

/** Scarta la bozza: la dispensa e lo storico non cambiano. */
export function discardDraft(pantry: PantryData): PantryData {
  return { ...pantry, draft: null };
}

/** Apre un acquisto confermato in una bozza per modificarlo (solo se non c'è già una bozza). */
export function startEditPurchase(pantry: PantryData, sessionId: string, now: Date): PantryData {
  const s = pantry.sessions.find((x) => x.id === sessionId);
  if (!s || pantry.draft) return pantry;
  return { ...pantry, draft: { id: s.id, day: s.day, lines: s.lines.map((l) => ({ ...l })), editingOf: s.id, updatedAt: now.toISOString() } };
}

/** Applica alla dispensa la differenza tra le righe di prima e quelle di dopo di un acquisto. */
function applyPurchaseChange(pantry: PantryData, before: PurchaseLine[], after: PurchaseLine[], sessionId: string, day: string, now: Date): PantryData {
  const at = now.toISOString();
  let lots = [...pantry.lots];
  // confezioni: differenza di confezioni per prodotto e formato
  const groups = new Map<string, { key: string; size: number; delta: number }>();
  const add = (l: PurchaseLine, sign: number) => {
    if (l.kind !== 'confezioni') return;
    const g = [...groups.values()].find((x) => x.key === l.key && sameSize(x.size, l.packageSize));
    if (g) g.delta += sign * l.packages;
    else groups.set(`${l.key}|${l.packageSize}`, { key: l.key, size: l.packageSize, delta: sign * l.packages });
  };
  before.forEach((l) => add(l, -1));
  after.forEach((l) => add(l, 1));
  for (const g of groups.values()) {
    if (g.delta === 0) continue;
    const i = lots.findIndex((l) => l.kind === 'confezioni' && l.key === g.key && sameSize(l.packageSize, g.size));
    const lot = i >= 0 ? lots[i] : undefined;
    if (lot) {
      const n = lot.packages + g.delta;
      lots = n > 0 ? lots.map((l, j) => (j === i ? { ...l, packages: n, updatedAt: at } : l)) : lots.filter((_, j) => j !== i);
    } else if (g.delta > 0) {
      lots.push({ id: `${sessionId}:${g.key}:${g.size}`, key: g.key, kind: 'confezioni', packages: g.delta, packageSize: g.size, amount: 0, bought: 0, day, updatedAt: at });
    }
  }
  // partite: ogni partita è la riga con lo stesso id
  const oldBulk = new Map(before.filter((l) => l.kind === 'partita').map((l) => [l.id, l]));
  const newBulk = new Map(after.filter((l) => l.kind === 'partita').map((l) => [l.id, l]));
  for (const id of new Set([...oldBulk.keys(), ...newBulk.keys()])) {
    const o = oldBulk.get(id);
    const n = newBulk.get(id);
    const delta = (n?.grams ?? 0) - (o?.grams ?? 0);
    const i = lots.findIndex((l) => l.id === id && l.kind === 'partita');
    const lot = i >= 0 ? lots[i] : undefined;
    if (lot) {
      if (!n) lots = lots.filter((_, j) => j !== i);
      else if (delta !== 0) {
        const amount = lot.amount + delta;
        lots = amount > EPS ? lots.map((l, j) => (j === i ? { ...l, amount, bought: lot.bought + delta, day, updatedAt: at } : l)) : lots.filter((_, j) => j !== i);
      } else if (lot.day !== day) lots = lots.map((l, j) => (j === i ? { ...l, day } : l));
    } else if (n && !o) {
      lots.push({ id, key: n.key, kind: 'partita', packages: 0, packageSize: 0, amount: n.grams, bought: n.grams, day, updatedAt: at });
    }
  }
  return withLots(pantry, lots);
}

const sameLines = (a: PurchaseLine[], b: PurchaseLine[]) => {
  const norm = (ls: PurchaseLine[]) =>
    ls
      .map((l) => `${l.key}|${l.kind}|${l.kind === 'confezioni' ? `${l.packages}x${l.packageSize}` : `${l.id}:${l.grams}`}`)
      .sort()
      .join(';');
  return norm(a) === norm(b);
};

/**
 * «Ho finito di registrare gli acquisti»: la bozza entra in dispensa e nello storico («acquisto»).
 * Se la bozza è la modifica di un acquisto confermato, la dispensa si aggiorna con la differenza e lo
 * storico registra la «modifica» con la data di oggi (se non è cambiato niente, nessuna voce).
 */
export function confirmDraft(pantry: PantryData, historyId: string, now: Date): PantryData {
  const draft = pantry.draft;
  if (!draft) return pantry;
  const at = now.toISOString();
  const today = localDayOf(now);
  if (draft.editingOf) {
    const old = pantry.sessions.find((s) => s.id === draft.editingOf);
    if (!old) return { ...pantry, draft: null };
    const changed = !sameLines(old.lines, draft.lines) || old.day !== draft.day;
    if (!changed) return { ...pantry, draft: null };
    let next = applyPurchaseChange(pantry, old.lines, draft.lines, old.id, draft.day, now);
    const sessions =
      draft.lines.length > 0
        ? next.sessions.map((s) => (s.id === old.id ? { ...s, day: draft.day, lines: draft.lines } : s))
        : next.sessions.filter((s) => s.id !== old.id);
    next = { ...next, draft: null, sessions };
    return record(next, { id: historyId, at, day: today, type: 'modifica', purchaseDay: old.day, before: old.lines, after: draft.lines }, now);
  }
  if (draft.lines.length === 0) return pantry;
  let next: PantryData = pantry;
  for (const l of draft.lines) {
    next =
      l.kind === 'confezioni'
        ? addPackages(next, { id: `${draft.id}:${l.id}`, key: l.key, day: draft.day, packages: l.packages, packageSize: l.packageSize }, now)
        : addBulk(next, { id: l.id, key: l.key, day: draft.day, grams: l.grams }, now);
  }
  next = { ...next, draft: null, sessions: [...next.sessions, { id: draft.id, day: draft.day, lines: draft.lines, confirmedAt: at }] };
  return record(next, { id: historyId, at, day: today, type: 'acquisto', purchaseDay: draft.day, lines: draft.lines }, now);
}

// ---------------------------------------------------------------- consumo

/**
 * «Confezione finita»: una confezione intera in meno (da 3 a 2; a zero la riga sparisce). Per una partita o
 * un resto la riga sparisce tutta. Voce «finita» nello storico.
 */
export function packageFinished(pantry: PantryData, lotId: string, historyId: string, now: Date): PantryData {
  const lot = pantry.lots.find((l) => l.id === lotId);
  if (!lot) return pantry;
  const at = now.toISOString();
  const lots =
    lot.kind === 'confezioni' && lot.packages > 1
      ? pantry.lots.map((l) => (l.id === lotId ? { ...l, packages: l.packages - 1, updatedAt: at } : l))
      : pantry.lots.filter((l) => l.id !== lotId);
  const amount = lot.kind === 'confezioni' ? lot.packageSize : lot.amount;
  return record(
    withLots(pantry, lots),
    { id: historyId, at, day: localDayOf(now), type: 'finita', key: lot.key, lotKind: lot.kind, amount, packageSize: lot.kind === 'confezioni' ? lot.packageSize : 0 },
    now,
  );
}

/**
 * «Consumata in parte»: dato UNO tra grammi rimasti e grammi consumati, l'altro si calcola dal totale
 * della riga. null se il valore non è valido (negativo o più del totale).
 */
export function partialValues(total: number, input: { remaining: number } | { consumed: number }): { remaining: number; consumed: number } | null {
  const v = 'remaining' in input ? input.remaining : input.consumed;
  if (!nonNeg(v) || v > total + EPS) return null;
  const other = Math.max(0, total - v);
  return 'remaining' in input ? { remaining: v, consumed: other } : { remaining: other, consumed: v };
}

/**
 * «Consumata in parte» su una riga: per le confezioni restano quelle intere e la parte aperta diventa una
 * riga «Resto»; per una partita o un resto si aggiorna quanto resta (a zero la riga sparisce).
 * Voce «consumo» nello storico.
 */
export function consumePartial(
  pantry: PantryData,
  lotId: string,
  input: { remaining: number } | { consumed: number },
  ids: { resto: string; history: string },
  now: Date,
): PantryData {
  const lot = pantry.lots.find((l) => l.id === lotId);
  if (!lot) return pantry;
  const v = partialValues(lotAmount(lot), input);
  if (!v || !(v.consumed > EPS)) return pantry;
  const at = now.toISOString();
  const day = localDayOf(now);
  const lots: PantryLot[] = [];
  if (lot.kind === 'confezioni') {
    const whole = Math.floor(v.remaining / lot.packageSize + EPS);
    const rest = v.remaining - whole * lot.packageSize;
    for (const l of pantry.lots) {
      if (l.id !== lotId) lots.push(l);
      else if (whole > 0) lots.push({ ...l, packages: whole, updatedAt: at });
    }
    if (rest > EPS) lots.push({ id: ids.resto, key: lot.key, kind: 'resto', packages: 0, packageSize: 0, amount: rest, bought: 0, day, updatedAt: at });
  } else {
    for (const l of pantry.lots) {
      if (l.id !== lotId) lots.push(l);
      else if (v.remaining > EPS) lots.push({ ...l, amount: v.remaining, updatedAt: at });
    }
  }
  return record(withLots(pantry, lots), { id: ids.history, at, day, type: 'consumo', key: lot.key, lotKind: lot.kind, consumed: v.consumed, remaining: v.remaining }, now);
}

// ---------------------------------------------------------------- calcoli e liste

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

/**
 * Differenza tra due versioni di un acquisto, per prodotto: solo i prodotti cambiati, con le righe di prima
 * e quelle di dopo.
 */
export function purchaseChanges(before: PurchaseLine[], after: PurchaseLine[]): { key: string; before: PurchaseLine[]; after: PurchaseLine[] }[] {
  const keys = [...new Set([...before, ...after].map((l) => l.key))];
  return keys
    .map((key) => ({ key, before: before.filter((l) => l.key === key), after: after.filter((l) => l.key === key) }))
    .filter((c) => !sameLines(c.before, c.after));
}

// ------------------------------------------------------------------ ricerca e ordine (solo schermata)

export type PantryGroup = ReturnType<typeof pantryGroups>[number];

/** Testo per la ricerca: minuscole, senza accenti, spazi semplici. */
export function searchText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Parole con cui si trovano anche le righe speciali («resto», «partita sfusa»). */
const LOT_SEARCH_WORDS: Record<PantryLotKind, string> = { confezioni: 'confezioni', resto: 'resto', partita: 'partita sfusa' };

/**
 * Filtra le righe della dispensa mentre si scrive. Ogni parola scritta deve comparire nel nome del prodotto
 * (o nel tipo di riga: «resto», «partita sfusa»), senza distinguere maiuscole e accenti. Campo vuoto → tutto.
 * Il totale del prodotto resta quello di tutte le sue righe. Non cambia i dati.
 */
export function searchPantryGroups(groups: PantryGroup[], query: string): PantryGroup[] {
  const words = searchText(query).split(' ').filter(Boolean);
  if (words.length === 0) return groups;
  return groups.flatMap((g) => {
    const name = searchText(g.name);
    const lots = g.lots.filter((l) => {
      const text = `${name} ${LOT_SEARCH_WORDS[l.kind]}`;
      return words.every((w) => text.includes(w));
    });
    return lots.length > 0 ? [{ ...g, lots }] : [];
  });
}

/** Ingredienti della dispensa dal toccato più di recente (acquisto, consumo, correzione) al meno recente. */
export function pantryRecentOrder(pantry: PantryData): string[] {
  const last = new Map<string, string>();
  for (const l of pantry.lots) if (!last.has(l.key) || last.get(l.key)! < l.updatedAt) last.set(l.key, l.updatedAt);
  return [...last].sort((a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0])).map(([k]) => k);
}

/**
 * Mette i gruppi nell'ordine dato (fissato all'apertura della scheda, così le righe non saltano mentre si tocca).
 * I prodotti nuovi, non ancora nell'ordine, vanno in cima; gli altri restano nell'ordine di partenza.
 */
export function applyPantryOrder(groups: PantryGroup[], order: string[] | null): PantryGroup[] {
  if (!order) return groups;
  const pos = new Map(order.map((k, i) => [k, i]));
  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (pos.get(a.g.key) ?? -1) - (pos.get(b.g.key) ?? -1) || a.i - b.i)
    .map(({ g }) => g);
}
