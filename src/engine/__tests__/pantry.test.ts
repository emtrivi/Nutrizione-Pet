// Dispensa (20/11/2026; righe per confezione dal 21/11/2026): quantità in casa, aggiornate solo a mano. Calcoli fatti a mano.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyPersonalData, exportBackup, parseBackup } from '../backup';
import { getCatalog } from '../bundledData';
import {
  EMPTY_PANTRY,
  addBulk,
  addPackages,
  changePackages,
  correctPackageGrams,
  daysCovered,
  editLot,
  lotAmount,
  pantryAmount,
  pantryGroups,
  removeLot,
  sanitizePantry,
  updateRemaining,
  type PantryData,
} from '../pantry';
import type { Recipe } from '../recipes';
import { shoppingForecast } from '../shopping';

const now = new Date('2026-11-21T10:00:00Z');
const BEEF = 'food:beef_mid_10';
const buy = (p: PantryData, key: string, packages: number, packageSize: number, id: string) => addPackages(p, { id, key, day: '2026-11-21', packages, packageSize }, now);
const bulk = (p: PantryData, key: string, grams: number, id: string, day = '2026-11-21') => addBulk(p, { id, key, day, grams }, now);
const rows = (p: PantryData, key: string) => p.lots.filter((l) => l.key === key);

describe('acquisti a confezioni: una riga per prodotto e formato', () => {
  const p1 = buy(EMPTY_PANTRY, BEEF, 1, 1000, 'a1');
  it('due acquisti uguali (1 + 1 da 1.000 g) si uniscono: una riga, 2 confezioni da 1.000 g = 2.000 g', () => {
    const p2 = buy(p1, BEEF, 1, 1000, 'a2');
    expect(rows(p2, BEEF)).toHaveLength(1);
    expect(rows(p2, BEEF)[0]).toMatchObject({ kind: 'confezioni', packages: 2, packageSize: 1000 });
    expect(pantryAmount(p2, BEEF)).toBe(2000);
    expect(p2.purchases).toHaveLength(2); // il registro tiene i due acquisti
  });
  it('un formato diverso (500 g) resta una riga a parte; il totale è 1.000 + 500 = 1.500 g', () => {
    const p2 = buy(p1, BEEF, 1, 500, 'a2');
    expect(rows(p2, BEEF).map((l) => [l.packages, l.packageSize])).toEqual([
      [1, 1000],
      [1, 500],
    ]);
    expect(pantryAmount(p2, BEEF)).toBe(1500);
  });
  it('un altro prodotto con lo stesso formato non si unisce', () => {
    const p2 = buy(p1, 'food:oat_dry', 1, 1000, 'a2');
    expect(p2.lots).toHaveLength(2);
  });
});

describe('+1 e −1', () => {
  const p = buy(EMPTY_PANTRY, BEEF, 2, 1000, 'a1');
  it('+1: 2 → 3 confezioni (3.000 g); −1: 2 → 1 (1.000 g)', () => {
    expect(pantryAmount(changePackages(p, 'a1', 1, now), BEEF)).toBe(3000);
    expect(changePackages(p, 'a1', -1, now).lots[0]?.packages).toBe(1);
  });
  it('−1 sull’ultima confezione toglie la riga', () => {
    const once = changePackages(p, 'a1', -1, now);
    expect(changePackages(once, 'a1', -1, now).lots).toHaveLength(0);
  });
});

describe('modifica completa di una riga', () => {
  const p = buy(EMPTY_PANTRY, BEEF, 2, 1000, 'a1');
  it('2 da 1.000 g → 3 da 750 g = 2.250 g', () => {
    const e = editLot(p, 'a1', 3, 750, now);
    expect(e.lots).toEqual([expect.objectContaining({ id: 'a1', packages: 3, packageSize: 750 })]);
    expect(pantryAmount(e, BEEF)).toBe(2250);
  });
  it('se il nuovo formato è uguale a un’altra riga dello stesso prodotto, le due si uniscono', () => {
    const two = buy(p, BEEF, 1, 500, 'b1'); // 2 × 1.000 + 1 × 500
    const e = editLot(two, 'b1', 1, 1000, now); // la riga da 500 diventa 1 × 1.000
    expect(rows(e, BEEF)).toEqual([expect.objectContaining({ id: 'a1', packages: 3, packageSize: 1000 })]);
  });
  it('0 confezioni toglie la riga', () => {
    expect(editLot(p, 'a1', 0, 1000, now).lots).toHaveLength(0);
  });
});

describe('correzione dei grammi e «resto»', () => {
  const p = buy(EMPTY_PANTRY, BEEF, 2, 1000, 'a1');
  it('2 × 1.000 g corretti a 1.600 g → 1 confezione da 1.000 g + resto di 600 g; il totale è 1.600 g', () => {
    const c = correctPackageGrams(p, 'a1', 1600, 'r1', now, '2026-11-21');
    expect(c.lots).toEqual([
      expect.objectContaining({ id: 'a1', kind: 'confezioni', packages: 1, packageSize: 1000 }),
      expect.objectContaining({ id: 'r1', kind: 'resto', amount: 600 }),
    ]);
    expect(pantryAmount(c, BEEF)).toBe(1600);
  });
  it('il resto non si somma alle confezioni: un nuovo acquisto da 1.000 g va sulla riga delle confezioni', () => {
    const c = buy(correctPackageGrams(p, 'a1', 1600, 'r1', now, '2026-11-21'), BEEF, 1, 1000, 'a2');
    expect(c.lots.find((l) => l.id === 'a1')!.packages).toBe(2);
    expect(c.lots.find((l) => l.id === 'r1')!.amount).toBe(600);
  });
  it('due correzioni fanno due resti separati (mai uniti)', () => {
    const c1 = correctPackageGrams(p, 'a1', 1600, 'r1', now, '2026-11-21'); // 1 × 1.000 + 600
    const c2 = correctPackageGrams(c1, 'a1', 700, 'r2', now, '2026-11-21'); // 0 confezioni + 700
    expect(rows(c2, BEEF).map((l) => [l.kind, lotAmount(l)])).toEqual([
      ['resto', 600],
      ['resto', 700],
    ]);
  });
  it('grammi multipli esatti: 2.000 → 2 confezioni, nessun resto; 0 g → riga tolta', () => {
    expect(correctPackageGrams(p, 'a1', 2000, 'r1', now, '').lots).toHaveLength(1);
    expect(correctPackageGrams(p, 'a1', 0, 'r1', now, '').lots).toHaveLength(0);
  });
});

describe('partite sfuse', () => {
  const p1 = bulk(EMPTY_PANTRY, BEEF, 10000, 's1', '2026-11-20');
  it('due partite dello stesso prodotto e dello stesso peso restano due righe, ognuna con la sua data', () => {
    const p2 = bulk(p1, BEEF, 10000, 's2', '2026-11-21');
    expect(rows(p2, BEEF).map((l) => [l.kind, l.amount, l.day])).toEqual([
      ['partita', 10000, '2026-11-20'],
      ['partita', 10000, '2026-11-21'],
    ]);
    expect(pantryAmount(p2, BEEF)).toBe(20000);
    expect(p2.purchases[1]).toMatchObject({ kind: 'partita', packageSize: 10000 });
  });
  it('una partita non si unisce alle confezioni da 10.000 g', () => {
    expect(buy(p1, BEEF, 1, 10000, 'a1').lots).toHaveLength(2);
  });
  it('«Aggiorna quanto resta»: 10.000 → 6.500 g (acquistati restano 10.000); 0 o «Finito» la tolgono', () => {
    const u = updateRemaining(p1, 's1', 6500, now);
    expect(u.lots[0]).toMatchObject({ amount: 6500, bought: 10000 });
    expect(updateRemaining(p1, 's1', 0, now).lots).toHaveLength(0);
    expect(removeLot(p1, 's1').lots).toHaveLength(0);
    expect(removeLot(p1, 's1').purchases).toHaveLength(1);
  });
  it('+1 e la modifica delle confezioni non toccano una partita', () => {
    expect(changePackages(p1, 's1', 1, now)).toBe(p1);
    expect(editLot(p1, 's1', 2, 500, now)).toBe(p1);
  });
});

describe('righe in dispensa', () => {
  it('per ingrediente: totale, poi confezioni (formato più grande prima), resti, partite', () => {
    let p = bulk(EMPTY_PANTRY, BEEF, 3000, 's1');
    p = buy(p, BEEF, 1, 500, 'a1');
    p = buy(p, BEEF, 2, 1000, 'a2');
    p = correctPackageGrams(p, 'a1', 200, 'r1', now, '2026-11-21');
    const g = pantryGroups(p, getCatalog());
    expect(g).toHaveLength(1);
    expect(g[0]?.total).toBe(3000 + 2000 + 200);
    expect(g[0]?.lots.map((l) => l.id)).toEqual(['a2', 'r1', 's1']);
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
  // dispensa: macinato 2 × 2.000 g + resto 1.000 g = 5.000; carota partita da 1.000 g; avena 6 × 1.000 g
  let pantry = buy(EMPTY_PANTRY, 'food:beef_mid_10', 3, 2000, 'm');
  pantry = correctPackageGrams(pantry, 'm', 5000, 'mr', now, '2026-11-21');
  pantry = bulk(pantry, 'food:carrot_cooked', 1000, 'c');
  pantry = buy(pantry, 'food:oat_dry', 6, 1000, 'o');
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
  it('dati non validi → dispensa vuota; righe non valide scartate', () => {
    expect(sanitizePantry(undefined)).toEqual(EMPTY_PANTRY);
    const s = sanitizePantry({
      lots: [
        { id: 'x', key: 'k', kind: 'confezioni', packages: 0, packageSize: 1000 },
        { id: 'y', key: 'k', kind: 'partita', amount: 500, bought: 800, day: '2026-11-21' },
        { id: 'z', key: 'k', kind: 'boh', amount: 5 },
      ],
      purchases: [{ id: 'x' }],
    });
    expect(s.lots).toEqual([expect.objectContaining({ id: 'y', kind: 'partita', amount: 500, bought: 800 })]);
    expect(s.purchases).toEqual([]);
  });
  it('dispensa salvata dalla versione di prima (un totale per ingrediente): confezioni intere + resto, totale uguale', () => {
    const old = {
      items: {
        'food:beef_mid_10': { amount: 2600, packageSize: 1000, updatedAt: '2026-11-20T10:00:00.000Z' },
        'food:oat_dry': { amount: 1234, packageSize: null, updatedAt: '' },
        'food:rice': { amount: 0, packageSize: 500, updatedAt: '' },
      },
      purchases: [{ id: 'a1', key: 'food:beef_mid_10', day: '2026-11-20', packages: 3, packageSize: 1000 }],
    };
    const s = sanitizePantry(old);
    expect(s.lots).toEqual([
      expect.objectContaining({ key: 'food:beef_mid_10', kind: 'confezioni', packages: 2, packageSize: 1000, day: '2026-11-20' }),
      expect.objectContaining({ key: 'food:beef_mid_10', kind: 'resto', amount: 600 }),
      expect.objectContaining({ key: 'food:oat_dry', kind: 'resto', amount: 1234 }),
    ]);
    expect(pantryAmount(s, 'food:beef_mid_10')).toBe(2600);
    expect(pantryAmount(s, 'food:oat_dry')).toBe(1234);
    expect(pantryAmount(s, 'food:rice')).toBe(0);
    expect(s.purchases).toHaveLength(1);
  });
  it('Esporta tutto e Ripristina conservano righe, partite e resti', () => {
    let pantry = buy(EMPTY_PANTRY, 'food:beef_mid_10', 3, 1000, 'a1');
    pantry = correctPackageGrams(pantry, 'a1', 2500, 'r1', now, '2026-11-21');
    pantry = bulk(pantry, 'food:beef_mid_10', 10000, 's1');
    pantry = bulk(pantry, 'food:beef_mid_10', 10000, 's2');
    const data = { ...emptyPersonalData(), settings: { ...DEFAULT_SETTINGS }, pantry };
    const back = parseBackup(exportBackup(data, now, 'x'), now);
    expect(back.ok && back.data.pantry).toEqual(pantry);
  });
  it('backup vecchi: senza dispensa → vuota; con la dispensa di prima → convertita con gli stessi totali', () => {
    const noPantry = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    delete noPantry.data.pantry;
    const b1 = parseBackup(JSON.stringify(noPantry), now);
    expect(b1.ok && b1.data.pantry).toEqual(EMPTY_PANTRY);
    const oldPantry = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    oldPantry.data.pantry = { items: { 'food:beef_mid_10': { amount: 3000, packageSize: 1000, updatedAt: '' } }, purchases: [] };
    const b2 = parseBackup(JSON.stringify(oldPantry), now);
    expect(b2.ok).toBe(true);
    if (b2.ok) {
      expect(b2.data.pantry.lots).toEqual([expect.objectContaining({ kind: 'confezioni', packages: 3, packageSize: 1000 })]);
      expect(pantryAmount(b2.data.pantry, 'food:beef_mid_10')).toBe(3000);
    }
  });
});
