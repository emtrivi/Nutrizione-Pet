// Cataloghi inclusi nell'app. Si cambiano solo con un aggiornamento dell'app:
// per aggiornare, sostituire il file in data/catalog e il nome qui sotto.

import foodsJson from '../../data/catalog/CATALOGO_CANI_REVISIONATO_2026-10-26.json';
import supplementsJson from '../../data/catalog/CATALOGO_INTEGRATORI_UNICO_5_PROFILI_REVISIONATO_2026-10-24.json';
import fediafJson from '../../data/catalog/FEDIAF_2025_CANE_ADULTO_MINIMI_MASSIMI.json';
import { buildCatalog, type Catalog, type RawFood, type RawSupplement } from './catalog';
import type { RawFediafFile } from './requirements';

export const FOODS_FILE = 'CATALOGO_CANI_REVISIONATO_2026-10-26.json';
export const SUPPLEMENTS_FILE = 'CATALOGO_INTEGRATORI_UNICO_5_PROFILI_REVISIONATO_2026-10-24.json';
export const FEDIAF_FILE = 'FEDIAF_2025_CANE_ADULTO_MINIMI_MASSIMI.json';

export const rawFoods = foodsJson as unknown as { foods: RawFood[] };
export const rawSupplements = supplementsJson as unknown as { supplements: RawSupplement[] };
export const fediaf = fediafJson as unknown as RawFediafFile;

let cached: Catalog | null = null;

/** Catalogo dell'app, letto una sola volta. */
export function getCatalog(): Catalog {
  cached ??= buildCatalog({
    foods: { fileName: FOODS_FILE, data: rawFoods },
    supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
  });
  return cached;
}
