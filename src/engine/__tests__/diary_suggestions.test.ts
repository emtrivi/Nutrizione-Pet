// Fase 3: diario, suggerimenti con anteprima, sostituzione. Calcoli fatti a mano.
//
// Ricetta base senza integratori (cane d'esempio, 30 kg, tabella 95, obiettivo 1.218 kcal):
//   manzo 400 g · riso 300 g · carota 100 g · olio 10 g · fegato di pollo 50 g
//   kcal = 752 + 390 + 33 + 90 + 56,995 = 1.321,995
//   calcio = 28,56 + 9 + 33 + 0 + 4 mg = 74,56 mg = 0,07456 g → 0,0564 g ogni 1.000 kcal (rosso)
//   fosforo = 592 + 111 + 35 + 0 + 148,5 mg = 0,8865 g
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../backup';
import { fediaf, getCatalog } from '../bundledData';
import {
  addDays,
  assignPeriod,
  daysBetween,
  diaryAverage,
  entryForDay,
  formatDay,
  isDay,
  lastDays,
  makeSnapshot,
  overlapping,
  problemStreaks,
  weekday,
  type DiaryEntry,
} from '../diary';
import type { Recipe } from '../recipes';
import { substituteGrams, supplementSuggestions } from '../suggestions';
import type { Dog } from '../types';

const catalog = getCatalog();
const ctx = { catalog, fediaf, settings: DEFAULT_SETTINGS, prices: {} };
const base = [
  { key: 'food:beef_mid_10', amount: 400 },
  { key: 'food:rice_white_cooked', amount: 300 },
  { key: 'food:carrot_raw', amount: 100 },
  { key: 'food:sunflower_oil', amount: 10 },
  { key: 'food:chicken_liver_raw', amount: 50 },
];
const input = { lines: base, kcalTarget: 1218, table: 95 as const, overrides: {}, dogWeightKg: 30 };
const now = new Date('2026-10-25T10:00:00Z');

describe('suggerimenti per il calcio (carenza) con anteprima', () => {
  const s = supplementSuggestions(input, 'calcium', ctx);
  const by = (id: string) => s.find((x) => x.key === `supplement:${id}`)!;

  it('integratori che contengono calcio; l’Omegor (non dichiarato = 0) no', () => {
    expect(s.map((x) => x.key).sort()).toEqual([
      'supplement:bone_meal',
      'supplement:calcium_carbonate_pure_reference',
      'supplement:eggshell_powder_reference',
      'supplement:qdiet',
    ]);
    expect(by('bone_meal').target.before).toBe('rosso');
    expect(by('bone_meal').target.beforeValue).toBeCloseTo(0.0564, 4);
  });

  it('farina d’ossa 7,5 g (fascia del produttore per 30 kg): alza il calcio ma anche il fosforo', () => {
    // calcio 0,07456 + 7,5 × 0,226 = 1,76956 g ÷ 1,321995 = 1,3386 → 7,7% sotto 1,45 → arancione
    // fosforo 0,8865 + 7,5 × 0,177 = 2,214 g ÷ 1,321995 = 1,6747 → sopra 1,16 → verde
    // Ca/P 1,76956 ÷ 2,214 = 0,799 → 20% sotto 1 → rosso
    const b = by('bone_meal');
    expect(b.dose).toBe(7.5);
    expect(b.doseSource).toBe('produttore');
    expect(b.target.afterValue).toBeCloseTo(1.3386, 4);
    expect(b.target.after).toBe('arancione');
    expect(b.others.find((o) => o.id === 'phosphorus')).toMatchObject({ before: 'rosso', after: 'verde' });
    expect(b.caP.after).toBeCloseTo(0.7993, 4);
    expect(b.caP.afterColor).toBe('rosso');
  });

  it('QDiet 4,5 g (dose più bassa del produttore per 30 kg)', () => {
    // calcio 0,07456 + 4,5 × 0,18 = 0,88456 g; kcal 1.321,995 + 4,5 × 0,96 = 1.326,315 → 0,6669
    const q = by('qdiet');
    expect(q.dose).toBe(4.5);
    expect(q.target.afterValue).toBeCloseTo(0.6669, 4);
    expect(q.target.after).toBe('rosso');
  });

  it('carbonato di calcio, senza dose del produttore: la dose per arrivare al minimo', () => {
    // minimo al giorno 1,45 × 1,218 = 1,7661 g; manca 1,7661 − 0,07456 = 1,69154 g
    // ÷ 0,40043 = 4,22 g → arrotondato per eccesso a 4,5 g
    // calcio 0,07456 + 4,5 × 0,40043 = 1,8765 g ÷ 1,321995 = 1,4194 → 2,1% sotto → arancione
    const c = by('calcium_carbonate_pure_reference');
    expect(c.doseSource).toBe('minimo');
    expect(c.dose).toBe(4.5);
    expect(c.target.afterValue).toBeCloseTo(1.4194, 4);
    expect(c.target.after).toBe('arancione');
  });

  it('un integratore già nella ricetta non viene riproposto', () => {
    const s2 = supplementSuggestions({ ...input, lines: [...base, { key: 'supplement:qdiet', amount: 6 }] }, 'calcium', ctx);
    expect(s2.map((x) => x.key)).not.toContain('supplement:qdiet');
  });
});

describe('sostituzione di un ingrediente: stesse calorie', () => {
  it('manzo 400 g → salmone: 400 × 1,88 ÷ 2,022 = 371,9 → 372 g', () => {
    const r = substituteGrams(catalog.get('food:beef_mid_10')!, 400, catalog.get('food:salmon_raw')!);
    expect(r).toEqual({ grams: 372, sameKcal: true });
  });
});

describe('date del diario', () => {
  it('giorni di calendario', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // cambio dell'ora: nessun salto
    expect(daysBetween('2026-10-07', '2026-10-14')).toBe(8);
    expect(lastDays('2026-10-25', 3)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25']);
    expect(formatDay('2026-10-07')).toBe('07/10/2026');
    expect(weekday('2026-10-25')).toBe('dom');
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('2026-02-28')).toBe(true);
  });
});

// ---------------------------------------------------------------------------

const dog: Dog = { id: 'c1', name: 'Fido', weightKg: 30, useIdealWeight: false, neutered: true, activity: 'normale', manualKcal: 1218, createdAt: '', updatedAt: '' };
const recipe = (id: string, lines: { key: string; amount: number }[]): Recipe => ({
  id,
  name: id,
  dogId: dog.id,
  kcalTarget: 1218,
  table: 95,
  requirementOverrides: {},
  lines: lines.map((l) => ({ ...l, fingerprint: '' })),
  catalogVersion: '',
  reviewedAgainst: { dogId: dog.id, weightKg: 30, kcalPerDay: 1218 },
  createdAt: '',
  updatedAt: '',
});
const r1 = recipe('Base', base);
const r2 = recipe('Con farina d’ossa', [...base, { key: 'supplement:bone_meal', amount: 7.5 }]);
const snap1 = makeSnapshot(r1, dog, ctx, now);
const snap2 = makeSnapshot(r2, dog, ctx, now);
let n = 0;
const id = () => `p${++n}`;
const entry = (snapshot: typeof snap1, from: string, to: string | null): DiaryEntry => ({
  id: id(),
  dogId: dog.id,
  recipeId: snapshot.recipeName,
  from,
  to,
  snapshot,
  createdAt: '',
});

describe('copia fissa', () => {
  it('contiene grammi, nutrienti calcolati, peso e calorie del cane di quel momento', () => {
    expect(snap1.lines[0]).toEqual({ key: 'food:beef_mid_10', name: 'Macinato bovino crudo', amount: 400, unit: 'g' });
    expect(snap1.kcal).toBeCloseTo(1321.995, 9);
    expect(snap1.nutrients.calcium!.valuePer1000).toBeCloseTo(0.0564, 4);
    expect(snap1.nutrients.calcium!.color).toBe('rosso');
    expect(snap1.dogWeightKg).toBe(30);
    expect(snap1.dogKcalPerDay).toBe(1218);
  });

  it('se poi la ricetta cambia, la copia no', () => {
    const r = recipe('X', base);
    const snap = makeSnapshot(r, dog, ctx, now);
    r.lines[0]!.amount = 999;
    expect(snap.lines[0]!.amount).toBe(400);
  });
});

describe('periodi: una ricetta al giorno per cane', () => {
  it('“ricetta B dal 7 al 14” dentro un periodo A: A si divide in due', () => {
    const a = entry(snap1, '2026-10-01', '2026-10-20');
    const b = entry(snap2, '2026-10-07', '2026-10-14');
    expect(overlapping([a], dog.id, b.from, b.to)).toEqual([a]);
    const out = assignPeriod([a], b, id);
    expect(out.map((e) => [e.from, e.to, e.snapshot.recipeName])).toEqual([
      ['2026-10-01', '2026-10-06', 'Base'],
      ['2026-10-07', '2026-10-14', 'Con farina d’ossa'],
      ['2026-10-15', '2026-10-20', 'Base'],
    ]);
  });

  it('“ancora in corso” e nuovo periodo in corso', () => {
    const a = entry(snap1, '2026-10-01', null);
    let out = assignPeriod([a], entry(snap2, '2026-10-10', '2026-10-12'), id);
    expect(out.map((e) => [e.from, e.to])).toEqual([
      ['2026-10-01', '2026-10-09'],
      ['2026-10-10', '2026-10-12'],
      ['2026-10-13', null],
    ]);
    out = assignPeriod(out, entry(snap1, '2026-10-15', null), id);
    expect(out.map((e) => [e.from, e.to])).toEqual([
      ['2026-10-01', '2026-10-09'],
      ['2026-10-10', '2026-10-12'],
      ['2026-10-13', '2026-10-14'],
      ['2026-10-15', null],
    ]);
  });

  it('periodo in corso vale fino a oggi; i giorni futuri sono vuoti', () => {
    const a = entry(snap1, '2026-10-20', null);
    expect(entryForDay([a], dog.id, '2026-10-25', '2026-10-25')).toBe(a);
    expect(entryForDay([a], dog.id, '2026-10-26', '2026-10-25')).toBeNull();
    expect(entryForDay([a], dog.id, '2026-10-19', '2026-10-25')).toBeNull();
  });
});

describe('media e avviso nel tempo', () => {
  // 20-22: base (calcio rosso); 23-24: con farina d'ossa (calcio arancione); 25: nessuna ricetta
  const entries = [entry(snap1, '2026-10-20', '2026-10-22'), entry(snap2, '2026-10-23', '2026-10-24')];

  it('media su 5 giorni su 6: i giorni senza ricetta non contano', () => {
    // (3 × 0,0564 + 2 × 1,33855) ÷ 5 = 0,56926 g ogni 1.000 kcal
    const avg = diaryAverage(entries, dog.id, '2026-10-25', 6, 0.1);
    expect(avg.daysTotal).toBe(6);
    expect(avg.daysWithData).toBe(5);
    expect(avg.nutrients.calcium!.valuePer1000).toBeCloseTo(0.56926, 4);
    expect(avg.nutrients.calcium!.color).toBe('rosso');
    expect(avg.nutrients.calcium!.limits.min).toBeCloseTo(1.45, 10);
  });

  it('nessun giorno con ricetta: tutto grigio', () => {
    const avg = diaryAverage(entries, dog.id, '2026-12-31', 5, 0.1);
    expect(avg.daysWithData).toBe(0);
    expect(avg.nutrients.calcium!.color).toBe('grigio');
  });

  it('calcio rosso o arancione per 5 giorni di fila (dal 20 al 24)', () => {
    const s = problemStreaks(entries, dog.id, '2026-10-24', 5);
    expect(s.find((x) => x.id === 'calcium')).toMatchObject({ days: 5, worst: 'rosso', direction: 'carenza' });
  });

  it('un giorno senza ricetta interrompe la serie', () => {
    expect(problemStreaks(entries, dog.id, '2026-10-25', 1).find((x) => x.id === 'calcium')).toBeUndefined();
  });

  it('sotto la soglia nessun avviso', () => {
    expect(problemStreaks(entries, dog.id, '2026-10-24', 7).find((x) => x.id === 'calcium')).toBeUndefined();
  });
});
