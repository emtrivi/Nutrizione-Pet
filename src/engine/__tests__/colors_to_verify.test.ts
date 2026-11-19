// Colore viola "da verificare" (19/11/2026): diario e copie salvate prima.
// Ricetta "manzo e avena": il macinato 12,8% non dichiara gli aminoacidi, quindi l'arginina è parziale
// e già sotto il minimo → viola in carenza. Il cloruro non è in nessun ingrediente → viola senza valore.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../backup';
import { fediaf, getCatalog } from '../bundledData';
import { makeSnapshot, problemStreaks, type DiaryEntry } from '../diary';
import { summaryText, type Recipe } from '../recipes';
import type { Dog } from '../types';

const catalog = getCatalog();
const ctx = { catalog, fediaf, settings: DEFAULT_SETTINGS, prices: {} };
const dog: Dog = { id: 'c1', name: 'Fido', weightKg: 30, useIdealWeight: false, neutered: true, activity: 'normale', manualKcal: 1218, createdAt: '', updatedAt: '' };
const recipe: Recipe = {
  id: 'r1',
  name: 'Manzo e avena',
  dogId: dog.id,
  kcalTarget: 1218,
  table: 95,
  requirementOverrides: {},
  lines: [
    { key: 'food:beef_mid_10', amount: 400, fingerprint: '' },
    { key: 'food:oat_dry', amount: 100, fingerprint: '' },
  ],
  catalogVersion: '',
  reviewedAgainst: { dogId: dog.id, weightKg: 30, kcalPerDay: 1218 },
  createdAt: '',
  updatedAt: '',
};
const snap = makeSnapshot(recipe, dog, ctx, new Date('2026-11-19T10:00:00Z'));
const entry = (snapshot: typeof snap, from: string, to: string): DiaryEntry => ({ id: from, dogId: dog.id, recipeId: 'r1', from, to, snapshot, createdAt: '' });

describe('copia fissa del diario', () => {
  it('salva il viola: arginina in carenza da verificare, cloruro senza dato', () => {
    expect(snap.nutrients.arginine).toMatchObject({ color: 'viola', direction: 'carenza', partial: true });
    expect(snap.nutrients.chloride).toMatchObject({ color: 'viola', direction: null, valuePer1000: null });
    expect(snap.summary.viola).toBeGreaterThan(0);
    expect(summaryText(snap.summary)).toMatch(/^\d+ verdi?, \d+ arancion[ei], \d+ ross[oi], \d+ da verificare, \d+ informativ[oi]$/);
  });
});

describe('avvisi nel tempo', () => {
  it('il viola in carenza conta come prima (quando era rosso): 5 giorni di fila', () => {
    const s = problemStreaks([entry(snap, '2026-11-15', '2026-11-19')], dog.id, '2026-11-19', 5);
    expect(s.find((x) => x.id === 'arginine')).toMatchObject({ days: 5, worst: 'viola', direction: 'carenza' });
  });
  it('il dato mancante (viola senza valore) non fa scattare avvisi', () => {
    const s = problemStreaks([entry(snap, '2026-11-15', '2026-11-19')], dog.id, '2026-11-19', 1);
    expect(s.find((x) => x.id === 'chloride')).toBeUndefined();
  });
  it('una copia vecchia con il rosso e una nuova con il viola fanno una serie unica; il peggiore è il rosso', () => {
    const old = { ...snap, nutrients: { ...snap.nutrients, arginine: { ...snap.nutrients.arginine!, color: 'rosso' as const } } };
    const s = problemStreaks([entry(old, '2026-11-10', '2026-11-14'), entry(snap, '2026-11-15', '2026-11-19')], dog.id, '2026-11-19', 7);
    expect(s.find((x) => x.id === 'arginine')).toMatchObject({ days: 10, worst: 'rosso' });
  });
});

describe('copie salvate prima del viola', () => {
  it('riepilogo senza viola: si legge come allora (grigi)', () => {
    const legacy = { verde: 20, arancione: 1, rosso: 15, grigio: 7 };
    expect(summaryText(legacy)).toBe('20 verdi, 1 arancione, 15 rossi, 7 grigi');
  });
});
