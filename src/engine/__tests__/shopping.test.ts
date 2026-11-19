// Spesa (19/11/2026): previsione dei grammi da comprare. Calcoli fatti a mano.
//
// Fido:  ricetta A per 20 giorni, ricetta B per 10 giorni (30 giorni)
// Luna:  ricetta A per 30 giorni
// A = macinato 12,8% 400 g, riso cotto 300 g, carota al vapore 100 g, olio di girasole 10 g, Omegor 1 capsula
// B = macinato 10% 300 g, avena 100 g
// Margine 5%.
//   macinato 12,8%: 400 × (20 + 30) = 20.000 g → × 1,05 = 21.000 g; 8,90 €/kg → 21 × 8,90 = 186,90 €
//   carota al vapore: 100 × 50 = 5.000 g → 5.250 g a cotto → crudi stimati 5.250 ÷ 0,9 = 5.833,3 → 5.834 g
//   riso cotto: 300 × 50 = 15.000 g → 15.750 g, peso a cotto non convertito
//   Omegor: 1 × 50 = 50 capsule → 52,5 → 53 capsule
//   macinato 10%: 300 × 10 = 3.000 g → 3.150 g
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyPersonalData, exportBackup, parseBackup } from '../backup';
import { getCatalog } from '../bundledData';
import type { Recipe } from '../recipes';
import { DEFAULT_SHOPPING, sanitizeShopping, shoppingForecast, type ShoppingData } from '../shopping';

const catalog = getCatalog();
const recipe = (id: string, dogId: string, lines: [string, number][]): Recipe => ({
  id,
  name: id,
  dogId,
  kcalTarget: 1218,
  table: 95,
  requirementOverrides: {},
  lines: lines.map(([key, amount]) => ({ key, amount, fingerprint: '' })),
  catalogVersion: '',
  reviewedAgainst: { dogId, weightKg: 30, kcalPerDay: 1218 },
  createdAt: '',
  updatedAt: '',
});
const A = recipe('A', 'fido', [
  ['food:beef_mid_10', 400],
  ['food:rice_white_cooked', 300],
  ['food:carrot_cooked', 100],
  ['food:sunflower_oil', 10],
  ['supplement:omegor_vitality', 1],
]);
const B = recipe('B', 'fido', [
  ['food:beef_10', 300],
  ['food:oat_dry', 100],
]);
const shopping: ShoppingData = {
  horizonDays: 30,
  marginPct: 5,
  plans: [
    { id: 'p1', dogId: 'fido', recipeId: 'A', days: 20 },
    { id: 'p2', dogId: 'fido', recipeId: 'B', days: 10 },
    { id: 'p3', dogId: 'luna', recipeId: 'A', days: 30 },
    { id: 'p4', dogId: 'luna', recipeId: 'cancellata', days: 5 },
  ],
  extras: [
    { id: 'x1', name: 'Sacchetti gelo', quantity: '1 rotolo', price: 3 },
    { id: 'x2', name: 'Ossa da masticare', quantity: '', price: null },
  ],
};
const prices = { 'food:beef_mid_10': { mode: 'per_kg' as const, eurPerKg: 8.9 } };
const f = shoppingForecast(shopping, [A, B], catalog, prices);
const item = (key: string) => f.items.find((x) => x.key === key)!;

describe('previsione', () => {
  it('macinato 12,8%: 20.000 g nella ciotola, 21.000 g con il 5%, 186,90 €', () => {
    expect(item('food:beef_mid_10')).toMatchObject({ bowlAmount: 20000, amount: 21000, unit: 'g', section: 'proteica' });
    expect(item('food:beef_mid_10').cost).toBeCloseTo(186.9, 10);
    expect(item('food:beef_mid_10').byDog).toEqual([
      { dogId: 'fido', amount: 8000 },
      { dogId: 'luna', amount: 12000 },
    ]);
  });
  it('carota al vapore: 5.250 g a cotto, circa 5.834 g da comprare crudi (stima)', () => {
    expect(item('food:carrot_cooked')).toMatchObject({ amount: 5250, rawEstimate: 5834, cookedNotConverted: false });
  });
  it('riso cotto: peso a cotto, non convertito', () => {
    expect(item('food:rice_white_cooked')).toMatchObject({ amount: 15750, rawEstimate: null, cookedNotConverted: true });
  });
  it('Omegor in capsule: 50 → 53 con il margine', () => {
    expect(item('supplement:omegor_vitality')).toMatchObject({ unit: 'capsule', bowlAmount: 50, amount: 53, section: 'integratori' });
  });
  it('macinato 10% solo dalla ricetta B: 3.150 g', () => {
    expect(item('food:beef_10').amount).toBe(3150);
  });
  it('ordine: proteiche, energetiche, verdure, grassi, …, integratori', () => {
    expect(f.items.map((x) => x.section)).toEqual(['proteica', 'proteica', 'energetica', 'energetica', 'verdure', 'grassi', 'integratori']);
  });
  it('giorni per cane; la ricetta cancellata non conta e viene segnalata', () => {
    expect(f.daysByDog).toEqual({ fido: 30, luna: 35 });
    expect(f.missingRecipes.map((p) => p.id)).toEqual(['p4']);
  });
  it('totale: 186,90 + 3 = 189,90 €, incompleto (prezzi mancanti)', () => {
    expect(f.total).toBeCloseTo(189.9, 10);
    expect(f.incomplete).toBe(true);
  });
  it('senza margine: le quantità sono quelle della ciotola', () => {
    const g = shoppingForecast({ ...shopping, marginPct: 0 }, [A, B], catalog, prices);
    expect(g.items.find((x) => x.key === 'food:beef_mid_10')!.amount).toBe(20000);
  });
});

describe('dati salvati e backup', () => {
  it('dati di prima o non validi → spesa vuota con 30 giorni e margine 0', () => {
    expect(sanitizeShopping(undefined)).toEqual(DEFAULT_SHOPPING);
    expect(sanitizeShopping({ horizonDays: -3, marginPct: 'x', plans: [{ id: 1 }], extras: 'no' })).toEqual(DEFAULT_SHOPPING);
  });
  it('Esporta tutto e Ripristina conservano la spesa', () => {
    const now = new Date('2026-11-19T10:00:00Z');
    const data = { ...emptyPersonalData(), settings: { ...DEFAULT_SETTINGS }, shopping };
    const back = parseBackup(exportBackup(data, now, 'x'), now);
    expect(back.ok && back.data.shopping).toEqual(shopping);
  });
  it('un backup di prima (senza spesa) si ripristina con la spesa vuota', () => {
    const now = new Date('2026-11-19T10:00:00Z');
    const old = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    delete old.data.shopping;
    const back = parseBackup(JSON.stringify(old), now);
    expect(back.ok && back.data.shopping).toEqual(DEFAULT_SHOPPING);
  });
});
