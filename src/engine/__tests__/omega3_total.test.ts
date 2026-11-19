// Omega-3 totali (19/11/2026): per ogni ingrediente il più alto tra il totale dichiarato e
// ALA + EPA + DHA noti (EPA + DHA contato una volta sola), poi la somma della ricetta. Sempre "almeno".
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../backup';
import { fediaf, getCatalog } from '../bundledData';
import { evaluateRecipe } from '../recipes';

const catalog = getCatalog();
const ctx = { catalog, fediaf, settings: DEFAULT_SETTINGS, prices: {} };
const o3 = (key: string) => catalog.get(key)!.nutrients.omega3_total;

describe('per ingrediente (valori del catalogo per 100 g o per capsula, invariati)', () => {
  it('Omegor: totale dichiarato 0,9 g > EPA + DHA 0,803 g → 0,9 g', () => {
    expect(o3('supplement:omegor_vitality')!.value).toBeCloseTo(0.9, 12);
  });
  it('olio di salmone: EPA 13 + DHA 18,2 = EPA+DHA 31,2 → 31,2 g, non 62,4 (nessun doppio conteggio)', () => {
    expect(o3('food:salmon_oil')!.value).toBeCloseTo(0.312, 12);
  });
  it('olio di lino: ALA 53,368 g → 53,368 g', () => {
    expect(o3('food:linseed_oil')!.value).toBeCloseTo(0.53368, 12);
  });
  it('fegato di pollo: ALA 0,006 + EPA+DHA 0 → 0,006 g', () => {
    expect(o3('food:chicken_liver_raw')!.value).toBeCloseTo(0.00006, 12);
  });
  it('macinato 12,8%: nessun omega-3 noto → dato mancante (non zero)', () => {
    expect(o3('food:beef_mid_10')).toBeUndefined();
  });
  it('sempre "almeno"', () => {
    expect(o3('food:linseed_oil')!.partial).toBe(true);
    expect(o3('supplement:omegor_vitality')!.partial).toBe(true);
  });
});

describe('nella ricetta', () => {
  // olio di lino 10 g + olio di salmone 5 g + 2 capsule di Omegor + macinato 400 g
  //   prima: solo il totale dichiarato dell'Omegor → almeno 2 × 0,9 = 1,8 g
  //   ora:   5,3368 + 1,56 + 1,8 = 8,6968 g (sempre "almeno": il macinato non ha dati)
  const lines = [
    { key: 'food:beef_mid_10', amount: 400 },
    { key: 'food:linseed_oil', amount: 10 },
    { key: 'food:salmon_oil', amount: 5 },
    { key: 'supplement:omegor_vitality', amount: 2 },
  ];
  const ev = evaluateRecipe({ lines, kcalTarget: 1218, table: 95, overrides: {}, dogWeightKg: 30 }, ctx);

  it('omega-3 totali = 8,6968 g, almeno', () => {
    expect(ev.totals.nutrients.omega3_total!.value).toBeCloseTo(8.6968, 10);
    expect(ev.totals.nutrients.omega3_total!.partial).toBe(true);
  });
  it('il rapporto omega-6/omega-3 resta acido linoleico ÷ (ALA + EPA + DHA), indipendente dai totali', () => {
    const { linoleic, alphaLinolenic, epaDha, ratio } = ev.omega;
    expect(ratio).toBeCloseTo(linoleic.value! / (alphaLinolenic.value! + epaDha.value!), 12);
    // ALA 5,3368 + EPA+DHA (1,56 + 1,606) = 8,5028
    expect(alphaLinolenic.value! + epaDha.value!).toBeCloseTo(8.5028, 10);
  });
});
