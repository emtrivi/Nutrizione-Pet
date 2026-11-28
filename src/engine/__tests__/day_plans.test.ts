// Ricette preferite, giornate tipo e anteprima degli ingredienti (28/11/2026). Conti fatti a mano.
import { describe, expect, it } from 'vitest';
import { deleteRecipe, parseLocal, serializeLocal, withDayPlans, withFavoriteToggled } from '../../data/personalStore';
import { emptyPersonalData, exportBackup, parseBackup, type PersonalData } from '../backup';
import { getCatalog } from '../bundledData';
import {
  dayPlanRows,
  dayPreview,
  duplicateDayPlan,
  favoriteRecipes,
  missingCount,
  newDayPlan,
  nextDayPlanName,
  renameDayPlan,
  sanitizeDayPlans,
  sanitizeFavorites,
  setDayPlanRecipe,
  toggleFavorite,
  type DayPlan,
} from '../dayPlans';
import { addBulk, addPackages, EMPTY_PANTRY } from '../pantry';
import type { PriceBook } from '../prices';
import type { Recipe } from '../recipes';
import type { Dog } from '../types';

const catalog = getCatalog();
const now = new Date(2026, 10, 28, 10, 0);
const BEEF = 'food:beef_mid_10';
const CARROT = 'food:carrot_cooked'; // verdura al vapore: resa 0,9
const OAT = 'food:oat_dry';
const OMEGOR = 'supplement:omegor_vitality'; // capsule

const dog = (id: string, name: string, weightKg: number): Dog => ({ id, name, weightKg, useIdealWeight: false, neutered: true, activity: 'normale' }) as Dog;
const FIDO = dog('fido', 'Fido', 30);
const LUNA = dog('luna', 'Luna', 10);
const recipe = (id: string, name: string, dogId: string, lines: [string, number][]): Recipe => ({
  id,
  name,
  dogId,
  kcalTarget: 1000,
  table: 95,
  requirementOverrides: {},
  lines: lines.map(([key, amount]) => ({ key, amount, fingerprint: '' })),
  catalogVersion: '',
  reviewedAgainst: { dogId, weightKg: 30, kcalPerDay: 1000 },
  createdAt: '',
  updatedAt: '',
});
// Giornata A: Fido «manzo» (macinato 400, carota 100, Omegor 1 capsula) + Luna «manzo» (macinato 150, carota 50)
// Giornata B: Fido «avena» (macinato 300, avena 150) + Luna «avena» (macinato 100, avena 50)
const FA = recipe('FA', 'Fido manzo', 'fido', [[BEEF, 400], [CARROT, 100], [OMEGOR, 1]]);
const FB = recipe('FB', 'Fido avena', 'fido', [[BEEF, 300], [OAT, 150]]);
const LA = recipe('LA', 'Luna manzo', 'luna', [[BEEF, 150], [CARROT, 50]]);
const LB = recipe('LB', 'Luna avena', 'luna', [[BEEF, 100], [OAT, 50]]);
const dogs = [FIDO, LUNA];
const recipes = [FA, FB, LA, LB];

function plan(id: string, name: string, choice: Record<string, Recipe>): DayPlan {
  let p = newDayPlan(id, name, now);
  for (const [dogId, r] of Object.entries(choice)) p = setDayPlanRecipe(p, dogId, r, now);
  return p;
}
const A = plan('A', 'Giornata A', { fido: FA, luna: LA });
const B = plan('B', 'Giornata B', { fido: FB, luna: LB });

// Dispensa: macinato 1 confezione da 1.000 g; carota partita da 100 g; avena 1 confezione da 500 g; Omegor niente.
let pantry = addPackages(EMPTY_PANTRY, { id: 'm', key: BEEF, day: '2026-11-27', packages: 1, packageSize: 1000 }, now);
pantry = addBulk(pantry, { id: 'c', key: CARROT, day: '2026-11-27', grams: 100 }, now);
pantry = addPackages(pantry, { id: 'o', key: OAT, day: '2026-11-27', packages: 1, packageSize: 500 }, now);
// Prezzi: macinato 8,90 €/kg; avena 2 €/kg; Omegor 30 € per 60 capsule = 0,50 €/capsula; carota senza prezzo.
const prices: PriceBook = {
  [BEEF]: { mode: 'per_kg', eurPerKg: 8.9 },
  [OAT]: { mode: 'per_kg', eurPerKg: 2 },
  [OMEGOR]: { mode: 'per_package', packagePrice: 30, packageSize: 60 },
};

describe('ricette preferite', () => {
  it('la stellina aggiunge e toglie; senza doppioni', () => {
    let f = toggleFavorite([], 'FA');
    expect(f).toEqual(['FA']);
    f = toggleFavorite(f, 'LB');
    expect(f).toEqual(['FA', 'LB']);
    expect(toggleFavorite(f, 'FA')).toEqual(['LB']);
    expect(sanitizeFavorites(['FA', 'FA', 3, '', null, 'LB'])).toEqual(['FA', 'LB']);
  });

  it('i preferiti di tutti i cani, in ordine di cane e di nome; quelli eliminati non compaiono', () => {
    expect(favoriteRecipes(['LB', 'FB', 'FA', 'sparita'], recipes, dogs).map((r) => r.id)).toEqual(['FB', 'FA', 'LB']);
  });

  it('la stellina non cambia la ricetta; eliminando la ricetta sparisce dai preferiti', () => {
    let d: PersonalData = { ...emptyPersonalData(), dogs, recipes };
    d = withFavoriteToggled(d, 'FA');
    expect(d.favorites).toEqual(['FA']);
    expect(d.recipes).toEqual(recipes);
    d = deleteRecipe(d, 'FA');
    expect(d.favorites).toEqual([]);
  });
});

describe('giornate tipo', () => {
  it('per ogni cane una ricetta di quel cane, o nessuna', () => {
    expect(A.recipes).toEqual({ fido: 'FA', luna: 'LA' });
    expect(setDayPlanRecipe(A, 'fido', LA, now)).toBe(A); // ricetta di Luna per Fido: rifiutata
    expect(setDayPlanRecipe(A, 'luna', null, now).recipes).toEqual({ fido: 'FA' });
    expect(dayPlanRows(setDayPlanRecipe(A, 'luna', null, now), dogs, recipes).map((r) => [r.dog.name, r.recipe?.name ?? null, r.missing])).toEqual([
      ['Fido', 'Fido manzo', false],
      ['Luna', null, false],
    ]);
  });

  it('rinomina (vuoto non vale), duplica con «(copia)», nome proposto A, B, C', () => {
    expect(renameDayPlan(A, '  Giornata pollo ', now).name).toBe('Giornata pollo');
    expect(renameDayPlan(A, '   ', now).name).toBe('Giornata A');
    const copy = duplicateDayPlan(A, 'A2', now);
    expect(copy).toMatchObject({ id: 'A2', name: 'Giornata A (copia)', recipes: { fido: 'FA', luna: 'LA' } });
    expect(nextDayPlanName([])).toBe('Giornata A');
    expect(nextDayPlanName([A, B])).toBe('Giornata C');
  });

  it('ricetta eliminata: la giornata segnala «ricetta mancante» e non si rompe', () => {
    const left = recipes.filter((r) => r.id !== 'LA');
    const rows = dayPlanRows(A, dogs, left);
    expect(rows.map((r) => [r.dog.name, r.recipe?.id ?? null, r.missing])).toEqual([
      ['Fido', 'FA', false],
      ['Luna', null, true],
    ]);
    expect(missingCount(A, dogs, left)).toBe(1);
    // anteprima A × 2 senza Luna: macinato 400 × 2 = 800, carota 100 × 2 = 200, Omegor 2
    const p = dayPreview([{ planId: 'A', times: 2 }], [A], dogs, left, catalog, prices, EMPTY_PANTRY);
    expect(p.perDay[0]!.missing.map((m) => m.dog.name)).toEqual(['Luna']);
    expect(p.total.items.map((i) => [i.key, i.amount])).toEqual([
      [BEEF, 800],
      [CARROT, 200],
      [OMEGOR, 2],
    ]);
  });

  it('ricetta modificata: la giornata usa la versione attuale', () => {
    const FAnew = { ...FA, lines: [{ key: BEEF, amount: 500, fingerprint: '' }] };
    const p = dayPreview([{ planId: 'A', times: 1 }], [A], dogs, [FAnew, LA], catalog, prices, EMPTY_PANTRY);
    expect(p.total.items.find((i) => i.key === BEEF)!.amount).toBe(650); // 500 + 150
    expect(p.total.items.some((i) => i.key === OMEGOR)).toBe(false);
  });

  it('dati non validi letti dal telefono: le giornate rotte si scartano', () => {
    expect(sanitizeDayPlans(null)).toEqual([]);
    expect(sanitizeDayPlans([{ id: 'x', name: 'X', recipes: { fido: 'FA', luna: 5 } }, { name: 'senza id' }, { id: 'x', name: 'doppia' }])).toEqual([
      { id: 'x', name: 'X', recipes: { fido: 'FA' }, createdAt: '', updatedAt: '' },
    ]);
  });
});

describe('anteprima: giornata A × 2 + giornata B × 1', () => {
  const p = dayPreview(
    [
      { planId: 'A', times: 2 },
      { planId: 'B', times: 1 },
    ],
    [A, B],
    dogs,
    recipes,
    catalog,
    prices,
    pantry,
  );
  const item = (k: string) => p.total.items.find((i) => i.key === k)!;
  const needed = (k: string) => p.totalNeeded.items.find((i) => i.key === k)!;

  it('ogni giornata da sola, un giorno, tutti i cani: A = macinato 550, carota 150, Omegor 1; B = macinato 400, avena 200', () => {
    expect(p.days).toBe(3);
    expect(p.perDay.map((d) => [d.plan.name, d.times])).toEqual([
      ['Giornata A', 2],
      ['Giornata B', 1],
    ]);
    expect(p.perDay[0]!.forecast.items.map((i) => [i.key, i.amount])).toEqual([
      [BEEF, 550],
      [CARROT, 150],
      [OMEGOR, 1],
    ]);
    expect(p.perDay[1]!.forecast.items.map((i) => [i.key, i.amount])).toEqual([
      [BEEF, 400],
      [OAT, 200],
    ]);
  });

  it('totale dei 3 giorni: macinato 550×2 + 400 = 1.500 g; carota 300 g; avena 200 g; Omegor 2 capsule', () => {
    expect(p.total.items.map((i) => [i.key, i.amount, i.unit])).toEqual([
      [BEEF, 1500, 'g'],
      [OAT, 200, 'g'],
      [CARROT, 300, 'g'],
      [OMEGOR, 2, 'capsule'],
    ]);
  });

  it('confronto con la dispensa: serve, in dispensa, ne manca', () => {
    expect(item(BEEF)).toMatchObject({ amount: 1500, inPantry: 1000, toBuy: 500 });
    expect(item(OAT)).toMatchObject({ amount: 200, inPantry: 500, toBuy: 0 });
    expect(item(CARROT)).toMatchObject({ amount: 300, inPantry: 100, toBuy: 200, rawEstimate: 223 }); // 200 ÷ 0,9 = 222,2 → 223 crudi
    expect(item(OMEGOR)).toMatchObject({ amount: 2, inPantry: 0, toBuy: 2 });
  });

  it('prezzo previsto di tutto: 13,35 + 0,40 + 1,00 = 14,75 € (incompleto: carota senza prezzo); da comprare 4,45 + 1,00 = 5,45 €', () => {
    expect(needed(BEEF).cost).toBeCloseTo(13.35, 10);
    expect(needed(OAT).cost).toBeCloseTo(0.4, 10);
    expect(needed(OMEGOR).cost).toBeCloseTo(1, 10);
    expect(needed(CARROT).cost).toBeNull();
    expect(p.totalNeeded.total).toBeCloseTo(14.75, 10);
    expect(p.totalNeeded.incomplete).toBe(true);
    expect(item(BEEF).cost).toBeCloseTo(4.45, 10);
    expect(item(OAT).cost).toBe(0);
    expect(p.total.total).toBeCloseTo(5.45, 10);
  });

  it('volte a 0 o giornate inesistenti non contano; nessuna scelta = niente', () => {
    const q = dayPreview([{ planId: 'A', times: 0 }, { planId: 'sparita', times: 3 }], [A, B], dogs, recipes, catalog, prices, pantry);
    expect(q.days).toBe(0);
    expect(q.perDay).toEqual([]);
    expect(q.total.items).toEqual([]);
  });

  it('l’anteprima non cambia niente: diario, Spesa, Dispensa e ricette restano uguali', () => {
    const d: PersonalData = { ...emptyPersonalData(), dogs, recipes, pantry, prices, dayPlans: [A, B] };
    const before = JSON.stringify(d);
    dayPreview([{ planId: 'A', times: 2 }, { planId: 'B', times: 1 }], d.dayPlans, d.dogs, d.recipes, catalog, d.prices, d.pantry);
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe('Esporta tutto / Ripristina', () => {
  const full: PersonalData = { ...emptyPersonalData(), dogs, recipes, favorites: ['FA', 'LB'], dayPlans: [A, B] };

  it('preferiti e giornate tipo entrano nel backup e tornano uguali', () => {
    const back = parseBackup(exportBackup(full, now, 'x'), now);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.data.favorites).toEqual(['FA', 'LB']);
      expect(back.data.dayPlans).toEqual([A, B]);
    }
  });

  it('il file sul telefono li conserva', () => {
    const r = parseLocal(serializeLocal(withDayPlans(full, [A])));
    expect(r.status === 'ok' && r.data.dayPlans).toEqual([A]);
    expect(r.status === 'ok' && r.data.favorites).toEqual(['FA', 'LB']);
  });

  it('backup vecchi (senza preferiti né giornate) si ripristinano: nessun preferito, nessuna giornata', () => {
    const old = JSON.parse(exportBackup({ ...emptyPersonalData(), dogs, recipes }, now, 'x'));
    delete old.data.favorites;
    delete old.data.dayPlans;
    const r = parseBackup(JSON.stringify(old), now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.favorites).toEqual([]);
      expect(r.data.dayPlans).toEqual([]);
      expect(r.data.recipes).toEqual(recipes);
    }
    // anche della 0.2.0 (struttura 1)
    const v1 = JSON.stringify({ format: 'nutrizione-pet-backup', schemaVersion: 1, exportedAt: now.toISOString(), catalogVersion: 'v', data: { dogs, recipes: [] } });
    const r1 = parseBackup(v1, now);
    expect(r1.ok && r1.data.favorites).toEqual([]);
    expect(r1.ok && r1.data.dayPlans).toEqual([]);
  });

  it('file sul telefono di prima (senza i campi nuovi): si legge con preferiti e giornate vuoti', () => {
    const d = JSON.parse(serializeLocal({ ...emptyPersonalData(), dogs }));
    delete d.data.favorites;
    delete d.data.dayPlans;
    const r = parseLocal(JSON.stringify(d));
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.data.favorites).toEqual([]);
      expect(r.data.dayPlans).toEqual([]);
    }
  });
});
