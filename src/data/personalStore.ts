// Azioni sui dati personali (cani, prezzi, backup). Funzioni pure: ricevono i dati
// e restituiscono una copia aggiornata; il salvataggio sul telefono è altrove.

import {
  DEFAULT_SETTINGS,
  emptyPersonalData,
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
export const LOCAL_SCHEMA_VERSION = 1;

export function serializeLocal(data: PersonalData): string {
  return JSON.stringify({ format: LOCAL_FORMAT, schemaVersion: LOCAL_SCHEMA_VERSION, data });
}

/** Legge il file locale; null se manca o se è illeggibile (chi chiama decide cosa fare). */
export function parseLocal(text: string | null): PersonalData | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { format?: string; data?: PersonalData };
    if (parsed.format !== LOCAL_FORMAT || !parsed.data || !Array.isArray(parsed.data.dogs)) return null;
    // Impostazioni aggiunte in versioni successive prendono il valore iniziale.
    return {
      ...emptyPersonalData(),
      ...parsed.data,
      settings: mergeSettings(parsed.data.settings),
    };
  } catch {
    return null;
  }
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

/** Impostazioni salvate + valori iniziali per quelle aggiunte dopo (anche dentro i gruppi). */
export function mergeSettings(saved: Partial<Settings> | undefined): Settings {
  const s = saved ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    calorieSplit: { ...DEFAULT_SETTINGS.calorieSplit, ...s.calorieSplit },
    sanity: { ...DEFAULT_SETTINGS.sanity, ...s.sanity },
  };
}
