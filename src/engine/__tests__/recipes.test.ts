// Fase 2: ricette. Ricetta di prova del cane d'esempio (30 kg), calcoli fatti a mano.
//   macinato bovino 400 g · riso bianco cotto 300 g · carota cruda 100 g · olio di girasole 10 g
//   fegato di pollo 50 g · QDiet 6 g · Omegor 1 capsula   → 1.336,755 kcal (vedi totals.test.ts)
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../backup';
import { barGeometry } from '../bars';
import { fediaf, getCatalog } from '../bundledData';
import { NUTRIENTS } from '../nutrients';
import {
  dogSnapshot,
  duplicateRecipe,
  evaluateRecipe,
  markReviewed,
  recipeSummary,
  reviewReasons,
  sanityWarnings,
  shortName,
  startingDose,
  startingGrams,
  summaryText,
  type Recipe,
} from '../recipes';
import type { Dog } from '../types';

const catalog = getCatalog();
const item = (key: string) => catalog.get(key)!;
const lines = [
  { key: 'food:beef_mid_10', amount: 400 },
  { key: 'food:rice_white_cooked', amount: 300 },
  { key: 'food:carrot_raw', amount: 100 },
  { key: 'food:sunflower_oil', amount: 10 },
  { key: 'food:chicken_liver_raw', amount: 50 },
  { key: 'supplement:qdiet', amount: 6 },
  { key: 'supplement:omegor_vitality', amount: 1 },
];
const now = new Date('2026-10-25T10:00:00Z');

describe('grammi di partenza (ripartizione indicativa 55/30/2/8/5)', () => {
  const split = DEFAULT_SETTINGS.calorieSplit;

  it('una voce per categoria, 1.218 kcal', () => {
    // manzo:   1.218 × 55% = 669,9 kcal ÷ 1,88 kcal/g   = 356,3 → 356 g
    // riso:    1.218 × 30% = 365,4 kcal ÷ 1,30          = 281,1 → 281 g
    // carota:  1.218 × 2%  =  24,4 kcal ÷ 0,33          =  73,8 →  74 g
    // olio:    1.218 × 8%  =  97,4 kcal ÷ 9,00          =  10,8 →  11 g
    // fegato:  1.218 × 5%  =  60,9 kcal ÷ 1,1399        =  53,4 →  53 g
    const r = startingGrams(
      ['food:beef_mid_10', 'food:rice_white_cooked', 'food:carrot_raw', 'food:sunflower_oil', 'food:chicken_liver_raw'].map(item),
      1218,
      split,
    );
    expect(r.map((x) => x.amount)).toEqual([356, 281, 74, 11, 53]);
  });

  it('solo le categorie scelte, riportate a 100', () => {
    // manzo 55/85 = 64,7% → 788,1 kcal ÷ 1,88 = 419,2 → 419 g; riso 30/85 → 429,9 ÷ 1,30 = 330,7 → 331 g
    const r = startingGrams([item('food:beef_mid_10'), item('food:rice_white_cooked')], 1218, split);
    expect(r.map((x) => x.amount)).toEqual([419, 331]);
  });

  it('due alimenti nella stessa categoria si dividono la quota', () => {
    // 788,1 kcal ÷ 2 = 394,1: manzo ÷ 1,88 = 209,6 → 210 g; salmone ÷ 2,022 = 194,9 → 195 g
    const r = startingGrams([item('food:beef_mid_10'), item('food:salmon_raw'), item('food:rice_white_cooked')], 1218, split);
    expect(r.map((x) => x.amount)).toEqual([210, 195, 331]);
  });
});

describe('dose di partenza degli integratori (cane da 30 kg)', () => {
  it('QDiet: la più bassa della tabella; farina d’ossa: la fascia; Omegor: nessuna indicazione', () => {
    expect(startingDose(item('supplement:qdiet'), 30).amount).toBe(4.5);
    expect(startingDose(item('supplement:bone_meal'), 30).amount).toBe(7.5);
    expect(startingDose(item('supplement:omegor_vitality'), 30).amount).toBe(0);
  });
});

describe('barre a tratti uguali', () => {
  const lim = { min: 100, max: 200 };
  it.each([
    [50, 0.1111], // rosso basso: 50 ÷ 90 = 0,556 del primo tratto → 0,556 ÷ 5
    [95, 0.3], // arancione basso, a metà → 1,5 ÷ 5
    [100, 0.4], // sul minimo: inizio del verde
    [150, 0.5], // metà del verde
    [200, 0.6], // sul massimo: fine del verde (è ancora verde)
    [210, 0.7], // arancione alto, a metà
    [1000, 1], // molto oltre: in fondo
  ])('valore %d → freccia a %d', (v, pos) => {
    const g = barGeometry(v, lim);
    expect(g.segments).toEqual(['rosso', 'arancione', 'verde', 'arancione', 'rosso']);
    expect(g.position).toBeCloseTo(pos, 4);
  });

  it('solo minimo: tre tratti, nessun tratto alto', () => {
    const g = barGeometry(150, { min: 100, max: null });
    expect(g.segments).toEqual(['rosso', 'arancione', 'verde']);
    expect(g.position).toBeCloseTo(2.5 / 3, 10); // metà del verde (che arriva al doppio del minimo)
  });

  it('nessun riferimento o dato mancante: niente freccia', () => {
    expect(barGeometry(5, { min: null, max: null })).toEqual({ segments: [], position: null });
    expect(barGeometry(null, lim).position).toBeNull();
  });
});

describe('valutazione della ricetta di prova (tabella 95, 1.218 kcal)', () => {
  const prices = {
    'food:beef_mid_10': { mode: 'per_kg' as const, eurPerKg: 12 },
    'food:rice_white_cooked': { mode: 'per_kg' as const, eurPerKg: 2.5 },
  };
  const ev = evaluateRecipe(
    { lines, kcalTarget: 1218, table: 95, overrides: {}, dogWeightKg: 30 },
    { catalog, fediaf, settings: DEFAULT_SETTINGS, prices },
  );

  it('calorie: 1.336,755 contro 1.218 → +9,75% → arancione', () => {
    expect(ev.kcal.value).toBeCloseTo(1336.755, 9);
    expect(ev.kcal.diffPct).toBeCloseTo(9.75, 9);
    expect(ev.kcal.color).toBe('arancione');
  });

  it('calcio rosso per carenza, zinco verde', () => {
    expect(ev.nutrients.calcium!.evaluation.color).toBe('rosso');
    expect(ev.nutrients.calcium!.evaluation.direction).toBe('carenza');
    expect(ev.nutrients.zinc!.evaluation.color).toBe('verde');
    // freccia del calcio: 0,8637 nel primo tratto rosso [0 – 1,305) → 0,662 ÷ 5 = 0,132
    expect(ev.nutrients.calcium!.bar.position).toBeCloseTo(0.8637 / 1.305 / 5, 3);
  });

  it('rapporto Ca/P 0,904: 9,6% sotto 1 → arancione', () => {
    expect(ev.caP.value).toBeCloseTo(0.90447, 5);
    expect(ev.caP.classification.color).toBe('arancione');
    expect(ev.caP.bar.position).toBeCloseTo(0.20895, 4);
  });

  it('ripartizione delle calorie 4/9/4 (informativa)', () => {
    // proteine 89,575 g × 4 = 358,3; grassi 65,4892 × 9 = 589,4; carboidrati 92,945 × 4 = 371,78 → 1.319,48
    expect(ev.energySplit!.protein).toBeCloseTo(27.155, 2);
    expect(ev.energySplit!.fat).toBeCloseTo(44.669, 2);
    expect(ev.energySplit!.carbohydrate).toBeCloseTo(28.176, 2);
    expect(ev.energySplit!.partial).toBe(true); // carboidrati del QDiet non dichiarati
  });

  it('omega-6/omega-3 (informativo, parziale)', () => {
    // linoleico 7,0455 ÷ (ALA 0,003 + EPA+DHA 0,803) = 8,74
    expect(ev.omega.alphaLinolenic.value).toBeCloseTo(0.003, 12);
    expect(ev.omega.epaDha.value).toBeCloseTo(0.803, 12);
    expect(ev.omega.ratio).toBeCloseTo(8.7413, 4);
    expect(ev.omega.partial).toBe(true);
  });

  it('riepilogo dei colori sui 43 nutrienti con riga FEDIAF', () => {
    const n = NUTRIENTS.filter((d) => d.inFediaf).length;
    expect(n).toBe(43);
    const s = ev.summary;
    expect(s.verde + s.arancione + s.rosso + s.grigio).toBe(43);
    expect(summaryText({ rosso: 2, arancione: 4, verde: 0, grigio: 3 })).toBe('2 rossi, 4 arancioni, 3 grigi');
  });

  it('nei gruppi i problemi vengono prima', () => {
    const minerals = ev.groups.find((g) => g.group === 'minerali')!.items.map((v) => v.evaluation.color);
    const rank = { rosso: 0, arancione: 1, verde: 2, grigio: 3 };
    expect([...minerals].sort((a, b) => rank[a] - rank[b])).toEqual(minerals);
    expect(minerals[0]).toBe('rosso');
  });

  it('prezzo: 4,80 + 0,75 = 5,55 €, incompleto', () => {
    expect(ev.cost.total).toBeCloseTo(5.55, 10);
    expect(ev.cost.incomplete).toBe(true);
  });

  it('controllo di buon senso: fegato 50 ÷ 860 g = 5,8% (oltre il 5%)', () => {
    expect(ev.sanity).toEqual(['Il fegato è il 5,8% del peso degli alimenti: oltre il 5%.']);
  });

  it('integratori: QDiet 6 g entro 4,5–9; Omegor senza indicazione del produttore', () => {
    expect(ev.supplements.map((s) => s.status)).toEqual(['entro', 'nessuna_indicazione']);
  });
});

describe('controlli di buon senso', () => {
  it('pasto troppo pesante, troppe verdure, troppe frattaglie (soglie modificabili)', () => {
    const w = sanityWarnings(
      [
        { key: 'food:carrot_raw', amount: 900 },
        { key: 'food:beef_kidney_raw', amount: 200 },
        { key: 'food:beef_mid_10', amount: 900 },
      ],
      catalog,
      30,
      DEFAULT_SETTINGS.sanity,
    );
    // totale 2.000 g = 6,7% di 30 kg; carota 900 ÷ 2.000 = 45%; rene 200 ÷ 2.000 = 10%
    expect(w).toEqual([
      'Il pasto pesa 2000 g: oltre il 6% del peso del cane. Controlla le quantità.',
      'Le verdure sono il 45% del peso degli alimenti: oltre il 30%.',
      'Le altre frattaglie sono il 10% del peso degli alimenti: oltre il 5%.',
    ]);
  });
});

describe('“da rivedere”: l’app non cambia mai i grammi', () => {
  const dog: Dog = {
    id: 'cane-1',
    name: 'Fido',
    weightKg: 30,
    useIdealWeight: false,
    neutered: true,
    activity: 'normale',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const recipe: Recipe = {
    id: 'r1',
    name: 'Manzo e riso',
    dogId: dog.id,
    kcalTarget: 1436,
    table: 110,
    requirementOverrides: {},
    lines: lines.map((l) => ({ ...l, fingerprint: catalog.get(l.key)!.fingerprint })),
    catalogVersion: catalog.version.label,
    reviewedAgainst: dogSnapshot(dog),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  it('appena salvata: niente da rivedere', () => {
    expect(recipe.reviewedAgainst.kcalPerDay).toBeCloseTo(1435.68, 2);
    expect(reviewReasons(recipe, [dog], catalog)).toEqual([]);
  });

  it('cambia il peso: da rivedere (e cambiano anche le kcal calcolate)', () => {
    const heavier = { ...dog, weightKg: 32 };
    // 32^0,75 = 13,4543 → 70 × 13,4543 × 1,6 = 1.506,9 kcal
    expect(reviewReasons(recipe, [heavier], catalog)).toEqual([
      'Il peso del cane è cambiato (da 30 a 32 kg).',
      'Le calorie del cane sono cambiate (da 1436 a 1507 kcal).',
    ]);
  });

  it('cambiano i dati del catalogo: da rivedere', () => {
    const old = { ...recipe, lines: recipe.lines.map((l, i) => (i === 0 ? { ...l, fingerprint: 'vecchia' } : l)) };
    expect(reviewReasons(old, [dog], catalog)).toEqual(['I dati del catalogo sono cambiati per “Macinato bovino crudo”.']);
  });

  it('copiata per un altro cane: da rivedere; segnata come rivista: a posto, grammi uguali', () => {
    const other = { ...dog, id: 'cane-2', name: 'Luna', weightKg: 12 };
    const copy = duplicateRecipe(recipe, 'r2', now, other.id);
    expect(copy.name).toBe('Manzo e riso (copia)');
    expect(reviewReasons(copy, [dog, other], catalog)).toEqual(['Ricetta copiata da un altro cane: controlla calorie e grammi.']);
    const reviewed = markReviewed(copy, other, catalog, now);
    expect(reviewReasons(reviewed, [dog, other], catalog)).toEqual([]);
    expect(reviewed.lines.map((l) => l.amount)).toEqual(recipe.lines.map((l) => l.amount));
  });

  it('cane eliminato', () => {
    expect(reviewReasons(recipe, [], catalog)).toEqual(['Il cane di questa ricetta non esiste più.']);
  });
});

describe('nomi brevi e riepilogo per la lista', () => {
  it('ingredienti con i grammi', () => {
    expect(shortName(item('supplement:qdiet'))).toBe('Q.Diet Compensa');
    expect(recipeSummary([lines[0]!, lines[5]!, lines[6]!], catalog)).toBe(
      'Macinato bovino crudo 400 g · Q.Diet Compensa 6 g · Omegor Vitality 1000 1 capsula',
    );
  });
});
