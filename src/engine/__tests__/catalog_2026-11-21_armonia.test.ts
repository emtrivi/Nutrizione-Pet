// Armonia manzo e coniglio / manzo e agnello (21/11/2026, seconda versione): solo dati aggiunti dove mancavano.
// Confronto con il catalogo della versione 0.7.3: nessun valore già presente cambia, kcal invariate.
import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawFood } from '../catalog';
import { getCatalog, rawFoods, rawSupplements, SUPPLEMENTS_FILE } from '../bundledData';
import v073 from '../../../data/catalog/archivio/CATALOGO_CANI_REVISIONATO_2026-11-21_v0.7.3.json';

const catalog = getCatalog();
const food = (id: string) => catalog.get(`food:${id}`)!;
const before = buildCatalog({
  foods: { fileName: 'CATALOGO_CANI_REVISIONATO_2026-11-21.json', data: v073 as unknown as { foods: RawFood[] } },
  supplements: { fileName: SUPPLEMENTS_FILE, data: rawSupplements },
});
const ARMONIA = ['armonia_beef_rabbit_cdb', 'armonia_beef_rabbit_igea', 'armonia_beef_lamb_cdb', 'armonia_beef_lamb_igea'];

describe('solo aggiunte alle quattro voci Armonia', () => {
  it('le altre 162 voci sono identiche', () => {
    const others = before.foods.filter((f) => !ARMONIA.includes(f.id));
    expect(others).toHaveLength(162);
    for (const f of others) expect(food(f.id)).toEqual(f);
  });
  it('nei file nessun valore già presente cambia; kcal invariate; usabili', () => {
    // Confronto sui valori del file (i valori calcolati, come la vitamina A con il beta-carotene, cambiano di conseguenza).
    const raw = (foods: RawFood[], id: string) => foods.find((f) => f.id === id)!;
    for (const id of ARMONIA) {
      const old = raw((v073 as unknown as { foods: RawFood[] }).foods, id);
      const now = raw(rawFoods.foods, id);
      expect(now.kcal_me_per_100g).toBe(old.kcal_me_per_100g);
      expect(food(id).availableForNewRecipes).toBe(true);
      for (const [n, v] of Object.entries(old.nutrients)) expect(now.nutrients[n]?.value).toBe(v.value);
    }
  });
  it('dati aggiunti per 100 g ÷ 100: colina coniglio 91,387 mg, vitamina D agnello 4,12 UI', () => {
    expect(before.get('food:armonia_beef_rabbit_cdb')!.nutrients.choline).toBeUndefined();
    expect(food('armonia_beef_rabbit_cdb').nutrients.choline!.value).toBeCloseTo(0.91387222, 8);
    expect(food('armonia_beef_lamb_cdb').nutrients.vitamin_d!.value).toBeCloseTo(0.0412, 10);
  });
  it('CDB e Igea restano con gli stessi valori', () => {
    expect(food('armonia_beef_rabbit_cdb').fingerprint).toBe(food('armonia_beef_rabbit_igea').fingerprint);
    expect(food('armonia_beef_lamb_cdb').fingerprint).toBe(food('armonia_beef_lamb_igea').fingerprint);
  });
});
