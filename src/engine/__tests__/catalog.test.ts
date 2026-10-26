// Lettura dei cataloghi: conversioni di unità verificate a mano sui valori dei file.
// Base del motore: per 1 g di alimento (i file sono per 100 g) o per 1 unità di integratore.
import { describe, expect, it } from 'vitest';
import { canonicalJson, fnv1a, normalizeFood, versionFromFileName } from '../catalog';
import { getCatalog, rawFoods, rawSupplements } from '../bundledData';

const catalog = getCatalog();
const food = (id: string) => catalog.get(`food:${id}`)!;
const supp = (id: string) => catalog.get(`supplement:${id}`)!;

describe('catalogo: contenuto e versione', () => {
  it('97 alimenti e 5 integratori, identificativi unici', () => {
    expect(catalog.foods).toHaveLength(97);
    expect(new Set(catalog.foods.map((f) => f.id)).size).toBe(97);
    expect(catalog.supplements.map((s) => s.id)).toEqual([
      'qdiet',
      'omegor_vitality',
      'bone_meal',
      'calcium_carbonate_pure_reference',
      'eggshell_powder_reference',
    ]);
  });

  it('versione ricavata dal nome del file (decisione A7)', () => {
    expect(catalog.version.foods.label).toBe('26/10/2026');
    expect(catalog.version.supplements.label).toBe('24/10/2026');
    expect(catalog.version.label).toBe('Alimenti v. 26/10/2026 · Integratori v. 24/10/2026');
    expect(versionFromFileName('senza_data.json').date).toBeNull();
  });

  it('18 alimenti "da rivedere" mostrano "dato indicativo"', () => {
    expect(catalog.foods.filter((f) => f.indicative)).toHaveLength(18);
  });

  it('olio di colza non si offre per nuove ricette', () => {
    expect(food('rapeseed_oil').availableForNewRecipes).toBe(false);
    expect(catalog.foods.filter((f) => !f.availableForNewRecipes).map((f) => f.id)).toEqual(['rapeseed_oil']);
  });

  it('iodio e cloruro non ci sono negli alimenti', () => {
    for (const f of catalog.foods) {
      expect(f.nutrients.iodine).toBeUndefined();
      expect(f.nutrients.chloride).toBeUndefined();
    }
  });

  it('vitamina D, E e colina mancanti in 25, 21 e 30 alimenti (restano assenti, non zero)', () => {
    const missing = (id: string) => catalog.foods.filter((f) => !f.nutrients[id]).length;
    expect(missing('vitamin_d')).toBe(25);
    expect(missing('vitamin_e')).toBe(21);
    expect(missing('choline')).toBe(30);
  });

  it('categorie della ricetta guidata e peso crudo/cotto', () => {
    expect(food('beef_mid_10').recipeCategory).toBe('proteica');
    expect(food('turkey_heart_raw').recipeCategory).toBe('proteica');
    expect(food('chicken_liver_raw').recipeCategory).toBe('frattaglie');
    expect(food('rice_white_cooked').recipeCategory).toBe('energetica');
    expect(food('carrot_raw').recipeCategory).toBe('verdure');
    expect(food('sunflower_oil').recipeCategory).toBe('grassi');
    expect(food('rice_white_cooked').processingLabel).toBe('peso a cotto (bollito)');
    expect(food('beef_mid_10').processingLabel).toBe('peso a crudo');
  });
});

describe('alimenti: da "per 100 g" a "per 1 g", minerali da mg a g', () => {
  it('macinato bovino', () => {
    const b = food('beef_mid_10');
    expect(b.nutrients.protein!.value).toBeCloseTo(0.182, 12); // 18,2 g ÷ 100
    expect(b.nutrients.calcium!.value).toBeCloseTo(0.0000714, 12); // 7,14 mg ÷ 1000 ÷ 100
    expect(b.nutrients.phosphorus!.value).toBeCloseTo(0.00148, 12); // 148 mg ÷ 1000 ÷ 100
    expect(b.nutrients.zinc!.value).toBeCloseTo(0.0419, 12); // 4,19 mg ÷ 100 (resta in mg)
    expect(b.kcalPerUnit).toBeCloseTo(1.88, 12); // 188 kcal ÷ 100
    expect(b.nutrients.vitamin_a).toBeUndefined(); // mancante, non zero
  });

  it('zero analitico è un vero zero', () => {
    const b = food('beef_mid_10');
    expect(b.nutrients.carbohydrate!.value).toBe(0);
    expect(b.nutrients.carbohydrate!.status).toBe('analytical_zero');
  });

  it('acido arachidonico da g a mg', () => {
    // fegato di pollo: 0,326 g/100 g = 326 mg/100 g = 3,26 mg/g
    expect(food('chicken_liver_raw').nutrients.arachidonic_acid!.value).toBeCloseTo(3.26, 12);
  });

  it('selenio dalla voce selenium_wet, in µg', () => {
    expect(food('chicken_liver_raw').nutrients.selenium_wet!.value).toBeCloseTo(0.546, 12);
  });

  it('calorie dal valore scritto nel catalogo (decisione A6), con il metodo', () => {
    const rice = food('rice_white_cooked');
    expect(rice.kcalPerUnit).toBeCloseTo(1.3, 12); // 130, non 125,8 del 4/9/4
    expect(rice.kcalMethod).toContain('USDA');
  });
});

describe('vitamina A: UI, oppure retinolo ÷ 0,3, più beta-carotene × 0,833', () => {
  it('carota: non è zero grazie al beta-carotene', () => {
    // UI 0 (zero analitico) + 8.280 µg × 0,833 = 6.897,24 UI/100 g → 68,9724 UI/g
    const va = food('carrot_raw').nutrients.vitamin_a!;
    expect(va.value).toBeCloseTo(68.9724, 10);
    expect(va.partial).toBe(false);
    expect(va.parts!.preformata).toBe(0);
    expect(va.parts!.da_beta_carotene).toBeCloseTo(68.9724, 10);
  });

  it('zucca e spinaci non sono a zero', () => {
    // zucca: 2.100 × 0,833 = 1.749,3 UI/100 g; spinaci: 6.290 × 0,833 = 5.239,57 UI/100 g
    expect(food('pumpkin_cooked').nutrients.vitamin_a!.value * 100).toBeCloseTo(1749.3, 8);
    expect(food('spinach_steamed').nutrients.vitamin_a!.value * 100).toBeCloseTo(5239.57, 8);
  });

  it('fegato di pollo: UI + beta-carotene', () => {
    // 11.100 + 56 × 0,833 = 11.100 + 46,648 = 11.146,648 UI/100 g
    expect(food('chicken_liver_raw').nutrients.vitamin_a!.value * 100).toBeCloseTo(11146.648, 8);
  });

  it('cuore di tacchino: senza UI si usa il retinolo ÷ 0,3', () => {
    // 80 µg ÷ 0,3 = 266,667 + 23 × 0,833 = 19,159 → 285,826 UI/100 g
    const va = food('turkey_heart_raw').nutrients.vitamin_a!;
    expect(va.value * 100).toBeCloseTo(285.8257, 3);
    expect(va.notes.join(' ')).toContain('retinolo');
  });

  it('prodotti animali: beta-carotene non dichiarato = trascurabile, non parziale (regola utente)', () => {
    const va = food('lamb_liver_raw').nutrients.vitamin_a!;
    expect(va.value * 100).toBeCloseTo(24600, 8);
    expect(va.partial).toBe(false);
    expect(va.parts!.da_beta_carotene).toBe(0);
    expect(va.notes).toContain('Beta-carotene non dichiarato: considerato trascurabile nei prodotti animali.');
    // carni, frattaglie, pesci, uova e olio di salmone
    for (const id of ['lamb_lean_raw', 'rabbit_raw', 'horse_raw', 'chicken_heart_raw', 'beef_spleen_raw', 'salmon_oil']) {
      expect(food(id).nutrients.vitamin_a!.partial).toBe(false);
    }
  });

  it('alimenti vegetali e riso cotto senza beta-carotene: restano parziali', () => {
    for (const id of ['rice_white_cooked', 'buckwheat_dry', 'millet_dry', 'pasta_wheat_dry']) {
      expect(food(id).nutrients.vitamin_a!.partial).toBe(true);
    }
  });

  it('dopo la regola restano parziali solo i 4 alimenti vegetali', () => {
    const partial = catalog.foods.filter((f) => f.nutrients.vitamin_a?.partial).map((f) => f.id);
    expect(partial.sort()).toEqual(['buckwheat_dry', 'millet_dry', 'pasta_wheat_dry', 'rice_white_cooked']);
  });

  it('un alimento animale senza vitamina A preformata resta senza dato (non zero)', () => {
    expect(food('beef_mid_10').nutrients.vitamin_a).toBeUndefined();
  });
});

describe('vitamina E: da mg a UI secondo la forma', () => {
  it('carota: 0,66 mg d-alfa-tocoferolo × 1,49 = 0,9834 UI/100 g', () => {
    expect(food('carrot_raw').nutrients.vitamin_e!.value * 100).toBeCloseTo(0.9834, 10);
  });
});

describe('acido linoleico: se manca, C18:2 come stima segnata', () => {
  it('carota usa C18:2', () => {
    const la = food('carrot_raw').nutrients.linoleic_acid!;
    expect(la.value).toBeCloseTo(0.001, 12); // 0,1 g ÷ 100
    expect(la.status).toBe('estimated');
    expect(la.notes[0]).toContain('C18:2');
  });
  it('fegato di pollo usa il valore dichiarato', () => {
    const la = food('chicken_liver_raw').nutrients.linoleic_acid!;
    expect(la.value).toBeCloseTo(0.00475, 12);
    expect(la.notes).toEqual([]);
  });
});

describe('integratori (catalogo revisionato 24/10/2026, con le regole dell’utente)', () => {
  it('tutti e cinque abilitati con "dato provvisorio"', () => {
    for (const s of catalog.supplements) {
      expect(s.provisional).toBe(true);
      expect(s.availableForNewRecipes).toBe(true);
    }
  });

  it('QDiet: per 1 g, minerali in g, oligoelementi in mg', () => {
    const q = supp('qdiet');
    expect(q.doseUnit).toBe('g');
    expect(q.nutrients.calcium!.value).toBe(0.18);
    expect(q.nutrients.copper!.value).toBe(0.25);
    expect(q.nutrients.iodine!.value).toBe(0.045);
    expect(q.nutrients.vitamin_e!.value).toBe(2); // già in UI
    expect(q.nutrients.vitamin_a!.value).toBe(250);
    expect(q.nutrients.vitamin_a!.partial).toBe(false);
    expect(q.kcalPerUnit).toBe(0.96);
  });

  it('QDiet: potassio "da verificare"', () => {
    const k = supp('qdiet').nutrients.potassium!;
    expect(k.value).toBe(0.075);
    expect(k.toVerify).toBe(true);
    expect(k.notes.join(' ')).toContain('da verificare');
  });

  it('Omegor: vitamina E 10 mg × 1,49 = 14,9 UI, non parziale', () => {
    const o = supp('omegor_vitality');
    expect(o.doseUnit).toBe('capsule');
    expect(o.integerDose).toBe(true);
    expect(o.nutrients.vitamin_e!.value).toBeCloseTo(14.9, 12);
    expect(o.nutrients.vitamin_e!.partial).toBe(false);
    expect(o.nutrients.vitamin_e!.notes.join(' ')).toContain('1,49');
    expect(o.nutrients.epa_dha!.value).toBe(0.803);
  });

  it('Omegor: i nutrienti non dichiarati contano zero, con la nota (regola utente)', () => {
    const o = supp('omegor_vitality');
    for (const id of ['calcium', 'phosphorus', 'zinc', 'iodine', 'chloride', 'moisture', 'vitamin_a']) {
      expect(o.nutrients[id]).toMatchObject({
        value: 0,
        status: 'undeclared_negligible',
        partial: false,
        notes: ['Non dichiarato dal produttore, considerato trascurabile.'],
      });
    }
    expect(o.nutrients.epa_dha!.status).toBe('label'); // i dati dichiarati restano quelli
  });

  it('gli altri integratori: non dichiarato = sconosciuto', () => {
    expect(supp('qdiet').nutrients.epa_dha).toBeUndefined();
    expect(supp('bone_meal').nutrients.zinc).toBeUndefined();
    expect(supp('calcium_carbonate_pure_reference').nutrients.moisture).toBeUndefined();
  });

  it('il file Omegor non è stato modificato (la regola si applica alla lettura)', () => {
    const raw = rawSupplements.supplements.find((s) => s.id === 'omegor_vitality')!;
    expect(raw.nutrients.vitamin_e!.form).toBeUndefined();
  });

  it('carbonato di calcio: fosforo 0 vero; guscio d’uovo: fosforo sconosciuto', () => {
    expect(supp('calcium_carbonate_pure_reference').nutrients.phosphorus!.value).toBe(0);
    expect(supp('calcium_carbonate_pure_reference').nutrients.calcium!.value).toBe(0.40043);
    expect(supp('eggshell_powder_reference').nutrients.phosphorus).toBeUndefined();
  });

  it('farina d’ossa: Ca 22,6% e P 17,7% per grammo', () => {
    expect(supp('bone_meal').nutrients.calcium!.value).toBe(0.226);
    expect(supp('bone_meal').nutrients.phosphorus!.value).toBe(0.177);
  });
});

describe('impronta dei valori (per segnare le ricette "da rivedere")', () => {
  it('stessa per contenuto uguale, diversa se cambia un valore', () => {
    const raw = rawFoods.foods.find((f) => f.id === 'beef_mid_10')!;
    const a = normalizeFood(raw).fingerprint;
    const copy = JSON.parse(JSON.stringify(raw));
    expect(normalizeFood(copy).fingerprint).toBe(a);
    copy.nutrients.calcium.value = 7.15;
    expect(normalizeFood(copy).fingerprint).not.toBe(a);
  });
  it('JSON canonico ignora l’ordine delle chiavi', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonicalJson({ a: [2, { c: 4, d: 3 }], b: 1 }));
    expect(fnv1a('')).toBe('811c9dc5');
  });
});
