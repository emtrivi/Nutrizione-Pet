// Diario: cosa ha mangiato ogni cane, per periodi di giorni.
// Regola: assegnando una ricetta si salva una COPIA FISSA (grammi, ingredienti, nutrienti calcolati,
// peso e calorie del cane). Se poi cambiano ricetta, cane o catalogo, il passato non cambia.

import { barGeometry, type BarGeometry } from './bars';
import type { Settings } from './backup';
import type { Catalog } from './catalog';
import { computeDogEnergy } from './energy';
import { NUTRIENTS } from './nutrients';
import type { PriceBook } from './prices';
import { evaluateRecipe, shortName, type Recipe } from './recipes';
import type { RawFediafFile } from './requirements';
import { classify, type Color, type Limits } from './status';
import type { Dog, FediafTable } from './types';

// ---------------------------------------------------------------------------
// Date come testo "AAAA-MM-GG" (giorno di calendario, senza ore né fusi orari)

const DAY_MS = 86_400_000;
const toUtc = (day: string) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function isDay(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtc(s)) === s;
}

/** Oggi secondo l'orologio del telefono. */
export function localDay(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDays(day: string, n: number): string {
  return fromUtc(toUtc(day) + n * DAY_MS);
}

/** Giorni da "from" a "to" compresi (to ≥ from). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;
}

/** Gli ultimi n giorni che finiscono con "end", dal più vecchio al più recente. */
export function lastDays(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

/** "25/10/2026". */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
export function weekday(day: string): string {
  return WEEKDAYS[new Date(toUtc(day)).getUTCDay()] as string;
}

// ---------------------------------------------------------------------------
// Copia fissa

export interface SnapshotNutrient {
  /** Valore ogni 1.000 kcal della ricetta; null se il dato manca. */
  valuePer1000: number | null;
  /** Valore al giorno. */
  perDay: number | null;
  partial: boolean;
  color: Color;
  direction: 'carenza' | 'eccesso' | null;
  limits: Limits;
  maxKind: 'N' | 'L' | 'modificato' | null;
  bar: BarGeometry;
}

export interface DiarySnapshot {
  recipeName: string;
  lines: { key: string; name: string; amount: number; unit: 'g' | 'capsule' }[];
  kcal: number | null;
  kcalTarget: number;
  table: FediafTable;
  dogWeightKg: number;
  dogKcalPerDay: number;
  nutrients: Record<string, SnapshotNutrient>;
  caP: { value: number | null; partial: boolean; color: Color; bar: BarGeometry };
  summary: Record<Color, number>;
  catalogVersion: string;
  /** Prezzo al giorno al momento dell'assegnazione (null se nessun prezzo). */
  cost: { total: number; incomplete: boolean } | null;
  createdAt: string;
}

export interface DiaryEntry {
  id: string;
  dogId: string;
  /** Riferimento alla ricetta di origine (può essere poi modificata o eliminata: la copia resta). */
  recipeId: string;
  /** Primo giorno, "AAAA-MM-GG". */
  from: string;
  /** Ultimo giorno compreso; null = ancora in corso. */
  to: string | null;
  snapshot: DiarySnapshot;
  createdAt: string;
}

export function makeSnapshot(
  recipe: Recipe,
  dog: Dog,
  ctx: { catalog: Catalog; fediaf: RawFediafFile; settings: Settings; prices: PriceBook },
  now: Date,
): DiarySnapshot {
  const ev = evaluateRecipe(
    { lines: recipe.lines, kcalTarget: recipe.kcalTarget, table: recipe.table, overrides: recipe.requirementOverrides, dogWeightKg: dog.weightKg },
    ctx,
  );
  const nutrients: Record<string, SnapshotNutrient> = {};
  for (const [id, v] of Object.entries(ev.nutrients)) {
    nutrients[id] = {
      valuePer1000: v.evaluation.valuePer1000,
      perDay: v.total.value,
      partial: v.total.partial,
      color: v.evaluation.color,
      direction: v.evaluation.direction,
      limits: v.evaluation.limitsPer1000,
      maxKind: v.evaluation.maxKind,
      bar: v.bar,
    };
  }
  const anyPrice = ev.cost.lines.some((l) => l.cost !== null);
  return {
    recipeName: recipe.name,
    lines: recipe.lines.map((l) => {
      const item = ctx.catalog.get(l.key);
      return { key: l.key, name: item ? shortName(item) : l.key, amount: l.amount, unit: item?.doseUnit ?? 'g' };
    }),
    kcal: ev.kcal.value,
    kcalTarget: recipe.kcalTarget,
    table: recipe.table,
    dogWeightKg: dog.weightKg,
    dogKcalPerDay: computeDogEnergy(dog, ctx.settings.multipliers ?? undefined).kcalPerDay,
    nutrients,
    caP: { value: ev.caP.value, partial: ev.caP.partial, color: ev.caP.classification.color, bar: ev.caP.bar },
    summary: ev.summary,
    catalogVersion: ctx.catalog.version.label,
    cost: anyPrice ? { total: ev.cost.total, incomplete: ev.cost.incomplete } : null,
    createdAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Periodi: una sola ricetta al giorno per cane

const END = '9999-12-31';
const endOf = (e: Pick<DiaryEntry, 'to'>) => e.to ?? END;

/** Periodi dello stesso cane che si sovrappongono a [from, to]. */
export function overlapping(entries: DiaryEntry[], dogId: string, from: string, to: string | null): DiaryEntry[] {
  const end = to ?? END;
  return entries.filter((e) => e.dogId === dogId && e.from <= end && endOf(e) >= from);
}

/**
 * Aggiunge un periodo togliendo i giorni sovrapposti ai periodi esistenti dello stesso cane
 * (l'utente ha già confermato la sostituzione). Un periodo tagliato in mezzo diventa due.
 */
export function assignPeriod(entries: DiaryEntry[], entry: DiaryEntry, makeId: () => string): DiaryEntry[] {
  const from = entry.from;
  const to = entry.to ?? END;
  const out: DiaryEntry[] = [];
  for (const e of entries) {
    if (e.dogId !== entry.dogId || e.from > to || endOf(e) < from) {
      out.push(e);
      continue;
    }
    if (e.from < from) out.push({ ...e, to: addDays(from, -1) });
    if (endOf(e) > to) out.push({ ...e, id: e.from < from ? makeId() : e.id, from: addDays(to, 1) });
  }
  out.push(entry);
  return out.sort((a, b) => a.dogId.localeCompare(b.dogId) || a.from.localeCompare(b.from));
}

export function removePeriod(entries: DiaryEntry[], id: string): DiaryEntry[] {
  return entries.filter((e) => e.id !== id);
}

/** Periodo che copre il giorno (al massimo uno). Un periodo "in corso" vale fino a oggi compreso. */
export function entryForDay(entries: DiaryEntry[], dogId: string, day: string, today: string): DiaryEntry | null {
  if (day > today) return null;
  return entries.find((e) => e.dogId === dogId && e.from <= day && endOf(e) >= day) ?? null;
}

// ---------------------------------------------------------------------------
// Media sui giorni

export interface AverageNutrient {
  valuePer1000: number | null;
  partial: boolean;
  limits: Limits;
  color: Color;
  direction: 'carenza' | 'eccesso' | null;
  bar: BarGeometry;
}

export interface DiaryAverage {
  daysTotal: number;
  /** Giorni con una ricetta: solo questi contano. */
  daysWithData: number;
  kcal: number | null;
  nutrients: Record<string, AverageNutrient>;
  caP: { value: number | null; partial: boolean; color: Color; bar: BarGeometry };
  summary: Record<Color, number>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Media dei valori ogni 1.000 kcal dei giorni con una ricetta, confrontata con la media dei limiti
 * di quei giorni. È parziale se un giorno ha il dato parziale o mancante.
 */
export function diaryAverage(
  entries: DiaryEntry[],
  dogId: string,
  endDay: string,
  nDays: number,
  tolerance: number,
): DiaryAverage {
  const snaps = lastDays(endDay, nDays)
    .map((d) => entryForDay(entries, dogId, d, endDay)?.snapshot)
    .filter((s): s is DiarySnapshot => !!s);
  const nutrients: Record<string, AverageNutrient> = {};
  const summary: Record<Color, number> = { verde: 0, arancione: 0, rosso: 0, grigio: 0 };
  for (const def of NUTRIENTS) {
    const items = snaps.map((s) => s.nutrients[def.id]).filter((x): x is SnapshotNutrient => !!x);
    const values = items.map((x) => x.valuePer1000).filter((v): v is number => v !== null);
    const mins = items.map((x) => x.limits.min).filter((v): v is number => v !== null);
    const maxs = items.map((x) => x.limits.max).filter((v): v is number => v !== null);
    const limits: Limits = { min: mean(mins), max: mean(maxs) };
    const value = mean(values);
    const partial = items.some((x) => x.partial) || values.length < snaps.length;
    const c = classify(value, partial, limits, tolerance);
    nutrients[def.id] = { valuePer1000: value, partial, limits, color: c.color, direction: c.direction, bar: barGeometry(value, limits, tolerance) };
    if (def.inFediaf && snaps.length > 0) summary[c.color]++;
  }
  const caPs = snaps.map((s) => s.caP.value).filter((v): v is number => v !== null);
  const caPValue = mean(caPs);
  const caPPartial = snaps.some((s) => s.caP.partial) || caPs.length < snaps.length;
  const caPLimits = { min: 1, max: 2 };
  return {
    daysTotal: nDays,
    daysWithData: snaps.length,
    kcal: mean(snaps.map((s) => s.kcal).filter((v): v is number => v !== null)),
    nutrients,
    caP: {
      value: caPValue,
      partial: caPPartial,
      color: classify(caPValue, caPPartial, caPLimits, tolerance).color,
      bar: barGeometry(caPValue, caPLimits, tolerance),
    },
    summary,
  };
}

// ---------------------------------------------------------------------------
// Avviso nel tempo

export interface Streak {
  id: string;
  name: string;
  /** Giorni di fila, fino a "endDay" compreso, con il nutriente rosso o arancione. */
  days: number;
  worst: 'rosso' | 'arancione';
  direction: 'carenza' | 'eccesso' | null;
}

/**
 * Nutrienti (con riga FEDIAF) rossi o arancioni da almeno "threshold" giorni di fila fino a endDay.
 * Un giorno senza ricetta interrompe la serie (non si sa cosa abbia mangiato).
 */
export function problemStreaks(entries: DiaryEntry[], dogId: string, endDay: string, threshold: number): Streak[] {
  const out: Streak[] = [];
  for (const def of NUTRIENTS.filter((n) => n.inFediaf)) {
    let days = 0;
    let worst: Streak['worst'] = 'arancione';
    let direction: Streak['direction'] = null;
    for (let i = 0; i < 366; i++) {
      const snap = entryForDay(entries, dogId, addDays(endDay, -i), endDay)?.snapshot;
      const n = snap?.nutrients[def.id];
      if (!n || (n.color !== 'rosso' && n.color !== 'arancione')) break;
      days++;
      if (n.color === 'rosso') worst = 'rosso';
      direction ??= n.direction;
    }
    if (days >= threshold) out.push({ id: def.id, name: def.nameIt, days, worst, direction });
  }
  return out.sort((a, b) => b.days - a.days);
}
