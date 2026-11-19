// Catalogo alimenti del 30/10/2026 (foglio "VERIFICA_APPROFONDITA"): solo dati aggiunti dove mancavano.
// Confronto con il catalogo della versione 0.5.3: nessun valore già presente cambia, kcal invariate.
import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawFood } from '../catalog';
import { rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import afterImport from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-30.json';
import v053 from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-10-28.json';

// Catalogo come uscito da questa importazione (versione 0.5.4, archiviato).
const catalog = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-30.json', data: afterImport as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const food = (id: string) => catalog.get(`food:${id}`)!;
const before = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-10-28.json', data: v053 as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});

describe('solo aggiunte', () => {
  it('152 voci, stessi codici e stesse sezioni; 104 identiche', () => {
    expect(catalog.foods.map((f) => [f.id, f.recipeCategory])).toEqual(before.foods.map((f) => [f.id, f.recipeCategory]));
    expect(before.foods.filter((f) => JSON.stringify(food(f.id)) === JSON.stringify(f))).toHaveLength(104);
  });
  it('nessun valore già presente cambia; kcal invariate', () => {
    for (const old of before.foods) {
      const now = food(old.id);
      expect(now.kcalPerUnit).toBe(old.kcalPerUnit);
      // omega-3 totali sono calcolati da ALA + EPA + DHA: cambiano se si aggiunge uno di questi
      for (const [id, n] of Object.entries(old.nutrients)) if (id !== 'omega3_total') expect(now.nutrients[id]?.value).toBe(n.value);
    }
  });
});

describe('dati aggiunti (per 100 g ÷ 100 = per 1 g)', () => {
  it('rene di bovino: arginina 1,1415 g, triptofano 0,1773 g', () => {
    expect(before.get('food:beef_kidney_raw')!.nutrients.arginine).toBeUndefined();
    expect(food('beef_kidney_raw').nutrients.arginine!.value).toBeCloseTo(0.011415, 10);
    expect(food('beef_kidney_raw').nutrients.tryptophan!.value).toBeCloseTo(0.001773, 10);
  });
  it('trippa di bovino: metionina + cistina = 0,2618 + 0,1396 = 0,4014 g', () => {
    expect(food('beef_tripe_raw').nutrients.methionine_cystine!.value).toBeCloseTo(0.004014, 9);
  });
  it('cuore di pollo: acido linoleico 1,91 g dichiarato, ALA 0,07 g', () => {
    expect(food('chicken_heart_raw').nutrients.linoleic_acid!.value).toBeCloseTo(0.0191, 10);
    expect(food('chicken_heart_raw').nutrients.linoleic_acid!.status).not.toBe(undefined);
    expect(food('chicken_heart_raw').nutrients.alpha_linolenic_acid!.value).toBeCloseTo(0.0007, 10);
  });
  it('CDB e Igea restano con gli stessi valori', () => {
    for (const p of ['beef_kidney', 'lamb_tripe', 'beef_heart_pieces', 'chicken_gizzards']) {
      expect(food(`${p}_cdb`).fingerprint).toBe(food(`${p}_igea`).fingerprint);
    }
  });
});
