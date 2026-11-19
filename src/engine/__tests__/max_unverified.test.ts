// Segno "max?" (19/11/2026): nutriente con un massimo, dato parziale, verde, e valore noto che arriva
// almeno alla soglia del massimo (all'inizio 70%, in Impostazioni). Il colore resta verde.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, exportBackup, mergeSettings, parseBackup, emptyPersonalData } from '../backup';
import { fediaf, getCatalog } from '../bundledData';
import { evaluateRecipe } from '../recipes';
import type { Requirement } from '../requirements';
import { evaluateNutrient } from '../status';
import type { NutrientTotal } from '../totals';

// minimo 1, massimo 10 ogni 1.000 kcal; ricetta da 1.000 kcal, quindi valore = valore ogni 1.000 kcal
const req = { minPer1000: 1, maxNPer1000: 10, maxLPer100gDM: null, maxCustomPer1000: null } as Requirement;
const total = (value: number, partial: boolean): NutrientTotal =>
  ({ value, partial, missingIn: partial ? ['food:x'] : [], contributions: [], toVerify: false, notes: [] }) as NutrientTotal;
const ev = (value: number, partial: boolean, share?: number) =>
  evaluateNutrient(total(value, partial), req, { recipeKcal: 1000, dryMatterG: null, supplementKeys: [], legalMaxMode: 'avviso', tolerance: 0.1, maxUnverifiedShare: share });

describe('quando compare', () => {
  it('parziale, verde, al 90% del massimo → max? 0,9; il colore resta verde', () => {
    expect(ev(9, true)).toMatchObject({ color: 'verde', maxUnverified: 0.9 });
  });
  it('esattamente al 70% sì, al 69% no', () => {
    expect(ev(7, true).maxUnverified).toBeCloseTo(0.7, 12);
    expect(ev(6.9, true).maxUnverified).toBeNull();
  });
  it('dato completo: nessun segno', () => {
    expect(ev(9, false).maxUnverified).toBeNull();
  });
  it('già sopra il massimo: resta rosso/arancione per eccesso, nessun segno', () => {
    expect(ev(10.5, true)).toMatchObject({ color: 'arancione', maxUnverified: null });
    expect(ev(20, true)).toMatchObject({ color: 'rosso', maxUnverified: null });
  });
  it('soglia modificabile: al 50% il 60% del massimo mostra il segno', () => {
    expect(ev(6, true, 0.5).maxUnverified).toBeCloseTo(0.6, 12);
  });
  it('nessun massimo: nessun segno', () => {
    const noMax = { ...req, maxNPer1000: null } as Requirement;
    const e = evaluateNutrient(total(9, true), noMax, { recipeKcal: 1000, dryMatterG: null, supplementKeys: [], legalMaxMode: 'avviso' });
    expect(e.maxUnverified).toBeNull();
  });
});

describe('nella ricetta: la soglia viene dalle Impostazioni', () => {
  // vitamina A con fegato di pollo e QDiet: valore noto al 10,5% del massimo FEDIAF (100.000 UI/1.000 kcal), parziale
  const lines = [
    { key: 'food:beef_mid_10', amount: 400 },
    { key: 'food:rice_white_cooked', amount: 300 },
    { key: 'food:carrot_raw', amount: 100 },
    { key: 'food:sunflower_oil', amount: 10 },
    { key: 'food:chicken_liver_raw', amount: 50 },
    { key: 'supplement:qdiet', amount: 6 },
    { key: 'supplement:omegor_vitality', amount: 1 },
  ];
  const run = (pct: number) =>
    evaluateRecipe({ lines, kcalTarget: 1218, table: 95, overrides: {}, dogWeightKg: 30 }, { catalog: getCatalog(), fediaf, settings: { ...DEFAULT_SETTINGS, maxUnverifiedPct: pct }, prices: {} })
      .nutrients.vitamin_a!.evaluation;
  it('con il 70% iniziale nessun segno', () => {
    expect(run(70).maxUnverified).toBeNull();
  });
  it('con il 10% il segno compare (10,5%), colore verde', () => {
    expect(run(10)).toMatchObject({ color: 'verde' });
    expect(run(10).maxUnverified).toBeCloseTo(0.105, 2);
  });
});

describe('impostazione e backup', () => {
  it('valore iniziale 70', () => {
    expect(DEFAULT_SETTINGS.maxUnverifiedPct).toBe(70);
  });
  it('backup di versioni precedenti senza il campo → 70; valore non valido → 70; valore valido conservato', () => {
    expect(mergeSettings({ tolerance: 0.1 }).maxUnverifiedPct).toBe(70);
    expect(mergeSettings({ maxUnverifiedPct: 0 } as never).maxUnverifiedPct).toBe(70);
    expect(mergeSettings({ maxUnverifiedPct: 'tanto' } as never).maxUnverifiedPct).toBe(70);
    expect(mergeSettings({ maxUnverifiedPct: 55 }).maxUnverifiedPct).toBe(55);
  });
  it('Esporta tutto e Ripristina conservano la soglia', () => {
    const data = { ...emptyPersonalData(), settings: { ...DEFAULT_SETTINGS, maxUnverifiedPct: 80 } };
    const now = new Date('2026-11-19T10:00:00Z');
    const back = parseBackup(exportBackup(data, now, 'x'), now);
    expect(back.ok && back.data.settings.maxUnverifiedPct).toBe(80);
  });
});
