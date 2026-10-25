// Versioni della struttura dei dati personali e migrazioni.
//
// Regole (vedi docs/RILASCI.md):
// - Ogni cambio di struttura alza DATA_SCHEMA_VERSION e aggiunge qui una migrazione dalla versione precedente.
// - Le migrazioni solo aggiungono o completano campi nuovi: non cancellano dati e non inventano
//   quelli essenziali (i cani): un file senza cani resta un file rovinato.
// - Dati salvati da una versione PIÙ NUOVA dell'app non si toccano (sola lettura), per esempio dopo il
//   ritiro di un aggiornamento: così un ritorno indietro non può rovinarli.

import { mergeSettings } from './backup';

/** Versione attuale della struttura dei dati (file locale e backup). */
export const DATA_SCHEMA_VERSION = 2;

type RawData = Record<string, unknown>;
type Migration = (data: RawData) => RawData;

const arrayOr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objectOr = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Migrazioni: la chiave è la versione DI PARTENZA. */
export const MIGRATIONS: Record<number, Migration> = {
  // 1 → 2 (versione 0.3.0): ricette della Fase 2 e nuove impostazioni (ripartizione delle calorie,
  // controlli di buon senso, massimo di legge). I campi mancanti prendono i valori iniziali.
  1: (d) => ({
    ...d,
    recipes: arrayOr(d.recipes),
    diary: arrayOr(d.diary),
    prices: objectOr(d.prices),
    settings: mergeSettings(objectOr(d.settings)),
  }),
};

export type MigrationResult =
  | { ok: true; data: RawData; fromVersion: number; migrated: boolean }
  | { ok: false; reason: 'piu_nuovi' | 'versione_non_valida' | 'migrazione_mancante'; version: number };

/** Porta i dati dalla versione indicata a quella attuale, un passo alla volta. */
export function migrateData(data: RawData, fromVersion: number): MigrationResult {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) return { ok: false, reason: 'versione_non_valida', version: fromVersion };
  if (fromVersion > DATA_SCHEMA_VERSION) return { ok: false, reason: 'piu_nuovi', version: fromVersion };
  let current = data;
  for (let v = fromVersion; v < DATA_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, reason: 'migrazione_mancante', version: v };
    current = step(current);
  }
  return { ok: true, data: current, fromVersion, migrated: fromVersion < DATA_SCHEMA_VERSION };
}
