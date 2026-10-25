// Azioni sui dati personali (cani, prezzi, backup). Funzioni pure: ricevono i dati
// e restituiscono una copia aggiornata; il salvataggio sul telefono è altrove.

import {
  DATA_SCHEMA_VERSION,
  assignPeriod,
  removePeriod,
  type DiaryEntry,
  emptyPersonalData,
  mergeSettings,
  migrateData,
  type PersonalData,
  type PriceBook,
  type PriceEntry,
  type Recipe,
  type Settings,
} from '../engine';
import type { DogFields } from './dogForm';

export function generateId(now: Date = new Date()): string {
  return `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addDog(data: PersonalData, fields: DogFields, now: Date, id = generateId(now)): PersonalData {
  const ts = now.toISOString();
  return { ...data, dogs: [...data.dogs, { ...fields, id, createdAt: ts, updatedAt: ts }] };
}

/** Sostituisce i campi del cane: quelli non presenti nel modulo vengono tolti (es. kcal a mano cancellate). */
export function updateDog(data: PersonalData, id: string, fields: DogFields, now: Date): PersonalData {
  return {
    ...data,
    dogs: data.dogs.map((d) =>
      d.id === id ? { ...fields, id: d.id, createdAt: d.createdAt, updatedAt: now.toISOString() } : d,
    ),
  };
}

export function deleteDog(data: PersonalData, id: string): PersonalData {
  return { ...data, dogs: data.dogs.filter((d) => d.id !== id) };
}

export function setPrice(data: PersonalData, key: string, entry: PriceEntry, now: Date): PriceBook {
  return { ...data.prices, [key]: { ...entry, updatedAt: now.toISOString() } };
}

export function withPrice(data: PersonalData, key: string, entry: PriceEntry, now: Date): PersonalData {
  return { ...data, prices: setPrice(data, key, entry, now) };
}

export function withoutPrice(data: PersonalData, key: string): PersonalData {
  const { [key]: _removed, ...rest } = data.prices;
  return { ...data, prices: rest };
}

export function markBackup(data: PersonalData, now: Date): PersonalData {
  return { ...data, lastBackupAt: now.toISOString() };
}

// ---------------------------------------------------------------------------
// File dei dati sul telefono

export const LOCAL_FORMAT = 'nutrizione-pet-dati-locali';
export const LOCAL_SCHEMA_VERSION = DATA_SCHEMA_VERSION;

export function serializeLocal(data: PersonalData): string {
  return JSON.stringify({ format: LOCAL_FORMAT, schemaVersion: LOCAL_SCHEMA_VERSION, data });
}

export type LocalLoad =
  | { status: 'mancante' }
  | { status: 'illeggibile' }
  | { status: 'ok'; data: PersonalData; migratedFrom: number | null }
  /** Salvati da una versione più nuova dell'app: si mostrano se possibile, ma non si sovrascrivono. */
  | { status: 'piu_nuovi'; version: number; data: PersonalData | null };

function normalize(d: Record<string, unknown>): PersonalData {
  return {
    ...emptyPersonalData(),
    ...(d as Partial<PersonalData>),
    settings: mergeSettings(d.settings as Partial<Settings> | undefined),
  };
}

/** Legge il file locale e, se serve, lo porta alla struttura attuale (senza salvarlo). */
export function parseLocal(text: string | null): LocalLoad {
  if (!text) return { status: 'mancante' };
  let parsed: { format?: string; schemaVersion?: unknown; data?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: 'illeggibile' };
  }
  const raw = parsed.data;
  if (parsed.format !== LOCAL_FORMAT || typeof raw !== 'object' || raw === null || !Array.isArray((raw as { dogs?: unknown }).dogs)) {
    return { status: 'illeggibile' };
  }
  // I file della versione 0.2.0 non hanno sempre il numero: valgono come versione 1.
  const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
  const m = migrateData(raw as Record<string, unknown>, version);
  if (!m.ok) {
    if (m.reason === 'piu_nuovi') {
      let shown: PersonalData | null = null;
      try {
        shown = normalize(raw as Record<string, unknown>);
      } catch {
        shown = null;
      }
      return { status: 'piu_nuovi', version, data: shown };
    }
    return { status: 'illeggibile' };
  }
  return { status: 'ok', data: normalize(m.data), migratedFrom: m.migrated ? version : null };
}

// ---------------------------------------------------------------------------
// Ricette e impostazioni

/** Aggiunge la ricetta o la sostituisce se esiste già (stesso id). */
export function saveRecipe(data: PersonalData, recipe: Recipe): PersonalData {
  const exists = data.recipes.some((r) => r.id === recipe.id);
  return {
    ...data,
    recipes: exists ? data.recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [...data.recipes, recipe],
  };
}

export function deleteRecipe(data: PersonalData, id: string): PersonalData {
  return { ...data, recipes: data.recipes.filter((r) => r.id !== id) };
}

export function withSettings(data: PersonalData, settings: Settings): PersonalData {
  return { ...data, settings };
}

// ---------------------------------------------------------------------------
// Diario

/** Aggiunge un periodo al diario (i giorni sovrapposti dello stesso cane vengono sostituiti). */
export function addDiaryPeriod(data: PersonalData, entry: DiaryEntry): PersonalData {
  return { ...data, diary: assignPeriod(data.diary, entry, () => generateId()) };
}

export function deleteDiaryPeriod(data: PersonalData, id: string): PersonalData {
  return { ...data, diary: removePeriod(data.diary, id) };
}

export { mergeSettings };
