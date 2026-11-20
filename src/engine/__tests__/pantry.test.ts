// Dispensa (20/11/2026): quantità in casa, aggiornate solo a mano. Calcoli fatti a mano.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyPersonalData, exportBackup, parseBackup } from '../backup';
import { getCatalog } from '../bundledData';
import { EMPTY_PANTRY, addPurchase, daysCovered, finishPackage, pantryAmount, removePantryItem, sanitizePantry, setPantryAmount, type PantryData } from '../pantry';
import type { Recipe } from '../recipes';
import { shoppingForecast } from '../shopping';

const now = new Date('2026-11-20T10:00:00Z');
const buy = (p: PantryData, key: string, packages: number, packageSize: number, id: string) =>
  addPurchase(p, { id, key, day: '2026-11-20', packages, packageSize }, now);

describe('acquisti, "finito" e correzioni', () => {
  const p1 = buy(EMPTY_PANTRY, 'food:beef_mid_10', 3, 1000, 'a1'); // 3 vaschette da 1.000 g
  it('3 vaschette da 1.000 g → 3.000 g, confezione da 1.000 g', () => {
    expect(p1.items['food:beef_mid_10']).toMatchObject({ amount: 3000, packageSize: 1000 });
    expect(p1.purchases).toHaveLength(1);
  });
  it('poi 2 da 500 g → 4.000 g; la confezione ricordata diventa 500 g', () => {
    expect(buy(p1, 'food:beef_mid_10', 2, 500, 'a2').items['food:beef_mid_10']).toMatchObject({ amount: 4000, packageSize: 500 });
  });
  it('"finito" toglie una confezione: 3.000 → 2.000; mai sotto zero', () => {
    expect(pantryAmount(finishPackage(p1, 'food:beef_mid_10', now), 'food:beef_mid_10')).toBe(2000);
    const low = setPantryAmount(p1, 'food:beef_mid_10', 300, now);
    expect(pantryAmount(finishPackage(low, 'food:beef_mid_10', now), 'food:beef_mid_10')).toBe(0);
  });
  it('correzione a mano: 1.234 g; senza confezione nota "finito" non cambia nulla', () => {
    const fixed = setPantryAmount(EMPTY_PANTRY, 'food:oat_dry', 1234, now);
    expect(pantryAmount(fixed, 'food:oat_dry')).toBe(1234);
    expect(finishPackage(fixed, 'food:oat_dry', now)).toBe(fixed);
  });
  it('togli: l’ingrediente esce dalla dispensa, il registro degli acquisti resta', () => {
    const r = removePantryItem(p1, 'food:beef_mid_10');
    expect(pantryAmount(r, 'food:beef_mid_10')).toBe(0);
    expect(r.purchases).toHaveLength(1);
  });
});

describe('per quanti giorni basta', () => {
  it('2.400 g con 400 g al giorno → 6 giorni; 2.399 g → 5; 0 → 0; dose 0 → non calcolabile', () => {
    expect(daysCovered(2400, 400)).toBe(6);
    expect(daysCovered(2399, 400)).toBe(5);
    expect(daysCovered(0, 400)).toBe(0);
    expect(daysCovered(1000, 0)).toBeNull();
  });
});

describe('lista della spesa = previsione − dispensa', () => {
  const catalog = getCatalog();
  const A: Recipe = {
    id: 'A',
    name: 'A',
    dogId: 'fido',
    kcalTarget: 1218,
    table: 95,
    requirementOverrides: {},
    lines: [
      { key: 'food:beef_mid_10', amount: 400, fingerprint: '' },
      { key: 'food:carrot_cooked', amount: 100, fingerprint: '' },
      { key: 'food:oat_dry', amount: 100, fingerprint: '' },
    ],
    catalogVersion: '',
    reviewedAgainst: { dogId: 'fido', weightKg: 30, kcalPerDay: 1218 },
    createdAt: '',
    updatedAt: '',
  };
  // 50 giorni, margine 5%:
  //   macinato 400 × 50 = 20.000 → 21.000 g; in dispensa 5.000 → da comprare 16.000 g; 16 × 8,90 = 142,40 €
  //   carota al vapore 100 × 50 = 5.000 → 5.250 g; in dispensa 1.000 → 4.250 g, crudi circa 4.250 ÷ 0,9 = 4.722,2 → 4.723 g
  //   avena 100 × 50 = 5.000 → 5.250 g; in dispensa 6.000 → da comprare 0 ("c'è già")
  const shopping = { horizonDays: 50, marginPct: 5, plans: [{ id: 'p', dogId: 'fido', recipeId: 'A', days: 50 }], extras: [] };
  let pantry = setPantryAmount(EMPTY_PANTRY, 'food:beef_mid_10', 5000, now);
  pantry = setPantryAmount(pantry, 'food:carrot_cooked', 1000, now);
  pantry = setPantryAmount(pantry, 'food:oat_dry', 6000, now);
  const prices = { 'food:beef_mid_10': { mode: 'per_kg' as const, eurPerKg: 8.9 }, 'food:oat_dry': { mode: 'per_kg' as const, eurPerKg: 2 } };
  const f = shoppingForecast(shopping, [A], catalog, prices, pantry);
  const item = (k: string) => f.items.find((x) => x.key === k)!;
  it('macinato: servono 21.000 g, in dispensa 5.000, da comprare 16.000 g = 142,40 €', () => {
    expect(item('food:beef_mid_10')).toMatchObject({ amount: 21000, inPantry: 5000, toBuy: 16000 });
    expect(item('food:beef_mid_10').cost).toBeCloseTo(142.4, 10);
  });
  it('carota al vapore: da comprare 4.250 g cotti, circa 4.723 g crudi', () => {
    expect(item('food:carrot_cooked')).toMatchObject({ toBuy: 4250, rawEstimate: 4723 });
  });
  it('avena: in dispensa più del necessario → da comprare 0, costo 0', () => {
    expect(item('food:oat_dry')).toMatchObject({ toBuy: 0, cost: 0 });
  });
  it('senza dispensa la lista è la previsione', () => {
    expect(shoppingForecast(shopping, [A], catalog, prices).items.find((x) => x.key === 'food:beef_mid_10')!.toBuy).toBe(21000);
  });
});

describe('dati salvati e backup', () => {
  it('dati di prima o non validi → dispensa vuota; voci non valide scartate', () => {
    expect(sanitizePantry(undefined)).toEqual(EMPTY_PANTRY);
    expect(sanitizePantry({ items: { a: { amount: -1 }, b: { amount: 10, packageSize: 0 } }, purchases: [{ id: 'x' }] })).toEqual({
      items: { b: { amount: 10, packageSize: null, updatedAt: '' } },
      purchases: [],
    });
  });
  it('Esporta tutto e Ripristina conservano la dispensa; un backup di prima si ripristina con la dispensa vuota', () => {
    const pantry = buy(EMPTY_PANTRY, 'food:beef_mid_10', 3, 1000, 'a1');
    const data = { ...emptyPersonalData(), settings: { ...DEFAULT_SETTINGS }, pantry };
    const back = parseBackup(exportBackup(data, now, 'x'), now);
    expect(back.ok && back.data.pantry).toEqual(pantry);
    const old = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    delete old.data.pantry;
    const back2 = parseBackup(JSON.stringify(old), now);
    expect(back2.ok && back2.data.pantry).toEqual(EMPTY_PANTRY);
  });
});
