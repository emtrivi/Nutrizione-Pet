// Dati personali, "Esporta tutto" e "Ripristina".
// Il backup NON contiene il catalogo: ripristinarlo non sovrascrive mai il catalogo dell'app.

import type { PriceBook } from './prices';
import type { Recipe } from './recipes';
import type { LegalMaxMode } from './status';
import type { ActivityLevel, Dog } from './types';

/** Categorie della ricetta guidata che ricevono una parte delle calorie. */
export type SplitCategory = 'proteica' | 'energetica' | 'verdure' | 'grassi' | 'frattaglie';

export interface SanityThresholds {
  /** Peso totale del pasto oltre questa % del peso del cane. */
  mealPctOfBodyWeight: number;
  /** Verdure oltre questa % del peso degli alimenti. */
  vegetablesPctOfFood: number;
  /** Fegato oltre questa % del peso degli alimenti. */
  liverPctOfFood: number;
  /** Altre frattaglie (rene, milza, altre) oltre questa % del peso degli alimenti. */
  otherOffalPctOfFood: number;
}

export const BACKUP_FORMAT = 'nutrizione-pet-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export interface Settings {
  /** Giorni dopo cui ricordare il backup (all'inizio 14). */
  backupReminderDays: number;
  /** Zona arancione (all'inizio 0,10). */
  tolerance: number;
  /** Moltiplicatori modificati (null = quelli proposti). */
  multipliers: Record<ActivityLevel, { sterilizzato: number; intero: number }> | null;
  /** Aumento del 10% degli aminoacidi (punto aperto, spento). */
  aminoAcidDigestibilityIncrease: boolean;
  /** Media del diario (all'inizio 14 giorni) e avviso nel tempo (all'inizio 7). */
  diaryAverageDays: number;
  diaryAlertDays: number;
  /** Ripartizione indicativa delle calorie per i grammi di partenza (%), da concordare con la nutrizionista. */
  calorieSplit: Record<SplitCategory, number>;
  /** Soglie dei controlli di buon senso (provvisorie, da concordare con la nutrizionista). */
  sanity: SanityThresholds;
  /** Massimo di legge (L) quando il nutriente arriva solo da alimenti naturali (punto aperto). */
  legalMaxNaturalMode: LegalMaxMode;
}

export const DEFAULT_SETTINGS: Settings = {
  backupReminderDays: 14,
  tolerance: 0.1,
  multipliers: null,
  aminoAcidDigestibilityIncrease: false,
  diaryAverageDays: 14,
  diaryAlertDays: 7,
  calorieSplit: { proteica: 55, energetica: 30, verdure: 2, grassi: 8, frattaglie: 5 },
  sanity: { mealPctOfBodyWeight: 6, vegetablesPctOfFood: 30, liverPctOfFood: 5, otherOffalPctOfFood: 5 },
  legalMaxNaturalMode: 'avviso',
};

export interface PersonalData {
  dogs: Dog[];
  recipes: Recipe[];
  /** Diario: la forma arriverà nella Fase 3. */
  diary: unknown[];
  prices: PriceBook;
  settings: Settings;
  lastBackupAt: string | null;
}

export function emptyPersonalData(): PersonalData {
  return { dogs: [], recipes: [], diary: [], prices: {}, settings: { ...DEFAULT_SETTINGS }, lastBackupAt: null };
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  /** Solo informativo: con quale catalogo è stato fatto il backup. */
  catalogVersion: string;
  data: Omit<PersonalData, 'lastBackupAt'>;
}

/** Crea il testo del file di backup. */
export function exportBackup(data: PersonalData, now: Date, catalogVersion: string): string {
  const { lastBackupAt: _ignored, ...rest } = data;
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    catalogVersion,
    data: rest,
  };
  return JSON.stringify(file, null, 2);
}

/** Nome del file, es. "nutrizione-pet-backup-2026-10-24.json". */
export function backupFileName(now: Date): string {
  return `${BACKUP_FORMAT}-${now.toISOString().slice(0, 10)}.json`;
}

export type RestoreResult = { ok: true; data: PersonalData; exportedAt: string } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkDog(v: unknown, i: number): string | null {
  if (!isObject(v)) return `Cane n. ${i + 1}: dati non validi.`;
  if (typeof v.id !== 'string' || !v.id) return `Cane n. ${i + 1}: manca l’identificativo.`;
  if (typeof v.name !== 'string') return `Cane n. ${i + 1}: manca il nome.`;
  if (typeof v.weightKg !== 'number' || !(v.weightKg > 0)) return `Cane “${v.name}”: peso non valido.`;
  if (!['bassa', 'normale', 'alta'].includes(v.activity as string)) {
    return `Cane “${v.name}”: livello di attività non valido.`;
  }
  if (typeof v.neutered !== 'boolean') return `Cane “${v.name}”: sterilizzato sì/no mancante.`;
  return null;
}

/**
 * Legge un file di backup. Non modifica nulla: chi chiama decide se sostituire i dati.
 * Il backup di un'altra app o rovinato viene rifiutato con un messaggio semplice.
 */
export function parseBackup(text: string, now: Date): RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Il file non è leggibile: non sembra un backup di questa app.' };
  }
  if (!isObject(parsed) || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Questo file non è un backup di questa app.' };
  }
  if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Il backup è stato creato da una versione più nuova dell’app: aggiorna l’app e riprova.',
    };
  }
  const data = parsed.data;
  if (!isObject(data)) return { ok: false, error: 'Il backup è incompleto.' };
  const dogs = data.dogs;
  if (!Array.isArray(dogs)) return { ok: false, error: 'Il backup non contiene l’elenco dei cani.' };
  for (let i = 0; i < dogs.length; i++) {
    const err = checkDog(dogs[i], i);
    if (err) return { ok: false, error: err };
  }
  const recipes = Array.isArray(data.recipes) ? data.recipes : [];
  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    if (!isObject(r) || typeof r.id !== 'string' || typeof r.dogId !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.lines)) {
      return { ok: false, error: `Ricetta n. ${i + 1}: dati non validi.` };
    }
  }
  const ids = new Set<string>();
  for (const dog of dogs as Dog[]) {
    if (ids.has(dog.id)) return { ok: false, error: `Cane “${dog.name}” presente due volte.` };
    ids.add(dog.id);
  }
  return {
    ok: true,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : now.toISOString(),
    data: {
      dogs: dogs as Dog[],
      recipes: Array.isArray(data.recipes) ? (data.recipes as Recipe[]) : [],
      diary: Array.isArray(data.diary) ? data.diary : [],
      prices: isObject(data.prices) ? (data.prices as PriceBook) : {},
      settings: { ...DEFAULT_SETTINGS, ...(isObject(data.settings) ? (data.settings as Partial<Settings>) : {}) },
      // Dopo un ripristino, l'ultimo backup è quello appena letto.
      lastBackupAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    },
  };
}

/** Promemoria "ultimo backup … giorni fa". */
export function backupReminder(
  lastBackupAt: string | null,
  now: Date,
  thresholdDays = DEFAULT_SETTINGS.backupReminderDays,
): { due: boolean; daysSince: number | null; message: string } {
  if (!lastBackupAt) {
    return { due: true, daysSince: null, message: 'Non hai ancora fatto un backup: usa “Esporta tutto”.' };
  }
  const days = Math.floor((now.getTime() - new Date(lastBackupAt).getTime()) / 86_400_000);
  const due = days >= thresholdDays;
  const when = days === 0 ? 'oggi' : days === 1 ? 'ieri' : `${days} giorni fa`;
  return { due, daysSince: days, message: `Ultimo backup: ${when}.` };
}
