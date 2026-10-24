import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  DEFAULT_SETTINGS,
  backupFileName,
  backupReminder,
  emptyPersonalData,
  exportBackup,
  parseBackup,
  type PersonalData,
} from '../backup';
import { getCatalog } from '../bundledData';
import { doseStatus, interpolate, suggestDose } from '../dose';
import { computeCost, formatEuro, unitPrice } from '../prices';
import type { Requirement } from '../requirements';
import { classify, evaluateNutrient, summarize } from '../status';
import type { NutrientTotal } from '../totals';
import type { Dog } from '../types';

const catalog = getCatalog();

// ---------------------------------------------------------------------------
describe('colori: verde, arancione entro il 10%, rosso oltre', () => {
  const lim = { min: 100, max: 200 };
  it.each([
    [150, 'verde', null],
    [100, 'verde', null], // sul minimo
    [200, 'verde', null], // sul massimo
    [95, 'arancione', 'carenza'], // 5% sotto
    [90, 'arancione', 'carenza'], // esattamente 10% sotto
    [89.9, 'rosso', 'carenza'],
    [210, 'arancione', 'eccesso'], // 5% sopra
    [220, 'arancione', 'eccesso'], // esattamente 10% sopra
    [221, 'rosso', 'eccesso'],
  ] as const)('%d → %s', (value, color, direction) => {
    const c = classify(value, false, lim);
    expect(c.color).toBe(color);
    expect(c.direction).toBe(direction);
  });

  it('solo minimo: nessun tratto alto', () => {
    expect(classify(1e9, false, { min: 100, max: null }).color).toBe('verde');
  });

  it('grigio: nessun riferimento o dato mancante', () => {
    expect(classify(5, false, { min: null, max: null })).toMatchObject({ color: 'grigio', reason: 'nessun_riferimento' });
    expect(classify(null, true, lim)).toMatchObject({ color: 'grigio', reason: 'dato_mancante' });
  });

  it('valore parziale: eccesso resta valido, verde e carenza possono cambiare', () => {
    expect(classify(300, true, lim).provisional).toBe(false);
    expect(classify(150, true, lim).provisional).toBe(true);
    expect(classify(50, true, lim).provisional).toBe(true);
    expect(classify(150, false, lim).provisional).toBe(false);
  });

  it('vitamina A, limiti lontani (1.515 – 100.000)', () => {
    expect(classify(50000, false, { min: 1515, max: 100000 }).color).toBe('verde');
  });

  it('riepilogo', () => {
    expect(summarize(['rosso', 'rosso', 'arancione', 'grigio', 'verde'])).toEqual({
      verde: 1,
      arancione: 1,
      rosso: 2,
      grigio: 1,
    });
  });
});

describe('massimo di legge (L) solo da alimenti naturali: punto aperto', () => {
  const req = {
    minPer1000: 18,
    maxNPer1000: null,
    maxLPer100gDM: 22.7,
    maxCustomPer1000: null,
  } as Requirement;
  // 100 mg in una ricetta da 1.000 kcal con 250 g di SS:
  // L = 22,7 × 250 × 10 ÷ 1.000 = 56,75 mg/1.000 kcal → 100 è sopra del 76%
  const total = { value: 100, partial: false, missingIn: [], contributions: [{ key: 'food:x', value: 100 }] } as unknown as NutrientTotal;
  const base = { recipeKcal: 1000, dryMatterG: 250, supplementKeys: [] as string[] };

  it('modalità "avviso": niente rosso, ma un avviso', () => {
    const e = evaluateNutrient(total, req, { ...base, legalMaxMode: 'avviso' });
    expect(e.color).toBe('verde');
    expect(e.legalMaxWarning).not.toBeNull();
  });
  it('modalità "rosso"', () => {
    const e = evaluateNutrient(total, req, { ...base, legalMaxMode: 'rosso' });
    expect(e.color).toBe('rosso');
    expect(e.limitsPer1000.max).toBeCloseTo(56.75, 10);
  });
  it('se arriva da un integratore, L vale sempre', () => {
    const fromSupp = { ...total, contributions: [{ key: 'supplement:qdiet', value: 100 }] } as NutrientTotal;
    const e = evaluateNutrient(fromSupp, req, { ...base, supplementKeys: ['supplement:qdiet'], legalMaxMode: 'avviso' });
    expect(e.color).toBe('rosso');
    expect(e.maxKind).toBe('L');
  });
});

// ---------------------------------------------------------------------------
describe('dosi degli integratori (indicazioni, mai limiti)', () => {
  const qdiet = catalog.get('supplement:qdiet')!;
  const bone = catalog.get('supplement:bone_meal')!;

  it('interpolazione lineare', () => {
    const pts = [
      { x: 10, y: 1 },
      { x: 20, y: 3 },
    ];
    expect(interpolate(pts, 15)).toBe(2);
    expect(interpolate(pts, 30)).toBe(5); // prolunga l'ultimo segmento
  });

  it.each([
    // peso, min, max, estrapolata
    [5, 1.0, 1.5, false],
    [7.5, 1.25, 2.25, false], // metà tra 5 kg (1–1,5) e 10 kg (1,5–3)
    [15, 2.25, 4.5, false], // metà tra 10 kg (1,5–3) e 20 kg (3–6)
    [30, 4.5, 9.0, false],
    [40, 6.0, 12.0, true], // 0,15–0,30 g/kg come nella nota del produttore
    [3, 0.8, 0.9, true], // sotto 5 kg: prolunga il segmento 5–10 kg
  ])('QDiet a %d kg: %d–%d g', (kg, min, max, extrapolated) => {
    const s = suggestDose(qdiet, kg);
    expect(s.kind).toBe('range');
    if (s.kind !== 'range') return;
    expect(s.min).toBeCloseTo(min, 10);
    expect(s.max).toBeCloseTo(max, 10);
    expect(s.extrapolated).toBe(extrapolated);
  });

  it('QDiet: misurino raso da 3 g accanto ai grammi', () => {
    const s = suggestDose(qdiet, 30);
    if (s.kind !== 'range') throw new Error('atteso intervallo');
    expect(s.householdMeasure).toMatchObject({ label: 'misurino raso', grams: 3, min: 1.5, max: 3 });
  });

  it.each([
    [8, 1.5, 'fino a 10 kg', false],
    [10, 1.5, 'fino a 10 kg', false],
    [10.1, 5, 'fino a 25 kg', false],
    [25, 5, 'fino a 25 kg', false],
    [30, 7.5, 'fino a 40 kg', false],
    [40, 7.5, 'fino a 40 kg', false],
    [45, 10, 'oltre 40 kg', true],
  ])('farina d’ossa a %d kg: fascia, nessuna interpolazione', (kg, max, label, noteOnly) => {
    expect(suggestDose(bone, kg)).toEqual({ kind: 'band', max, unit: 'g', bandLabel: label, fromNoteOnly: noteOnly });
  });

  it('Omegor, carbonato e guscio: nessuna dose del produttore', () => {
    for (const id of ['omegor_vitality', 'calcium_carbonate_pure_reference', 'eggshell_powder_reference']) {
      expect(suggestDose(catalog.get(`supplement:${id}`)!, 30).kind).toBe('none');
    }
  });

  it('oltre il massimo del produttore: segnalato, non bloccato', () => {
    const s = suggestDose(qdiet, 30);
    expect(doseStatus(12, s)).toBe('oltre_massimo_produttore');
    expect(doseStatus(9, s)).toBe('entro');
  });
});

// ---------------------------------------------------------------------------
describe('prezzi', () => {
  it('al chilo, a confezione, a capsula → prezzo per unità', () => {
    expect(unitPrice({ mode: 'per_kg', eurPerKg: 12 }, 'g')).toBeCloseTo(0.012, 12);
    expect(unitPrice({ mode: 'per_package', packagePrice: 3.5, packageSize: 250 }, 'g')).toBeCloseTo(0.014, 12);
    expect(unitPrice({ mode: 'per_package', packagePrice: 25, packageSize: 60 }, 'capsule')).toBeCloseTo(0.416667, 6);
    expect(unitPrice({ mode: 'per_unit', eurPerUnit: 0.42 }, 'capsule')).toBe(0.42);
    expect(unitPrice({ mode: 'per_kg', eurPerKg: 12 }, 'capsule')).toBeNull();
    expect(unitPrice({ mode: 'per_package', packagePrice: 3, packageSize: 0 }, 'g')).toBeNull();
  });

  const lines = [
    { key: 'food:beef_mid_10', amount: 400 },
    { key: 'food:rice_white_cooked', amount: 300 },
    { key: 'supplement:qdiet', amount: 6 },
    { key: 'supplement:omegor_vitality', amount: 1 },
  ];
  const prices = {
    'food:beef_mid_10': { mode: 'per_kg' as const, eurPerKg: 12 },
    'food:rice_white_cooked': { mode: 'per_kg' as const, eurPerKg: 2.5 }, // prezzo del cotto
    'supplement:qdiet': { mode: 'per_package' as const, packagePrice: 24.9, packageSize: 250 },
    'supplement:omegor_vitality': { mode: 'per_package' as const, packagePrice: 25, packageSize: 60 },
  };

  it('costo del giorno', () => {
    // 400 × 0,012 = 4,80; 300 × 0,0025 = 0,75; 6 × 0,0996 = 0,5976; 25 ÷ 60 = 0,41667
    const c = computeCost(lines, prices, catalog.get);
    expect(c.lines.map((l) => l.cost)).toEqual([
      expect.closeTo(4.8, 10),
      expect.closeTo(0.75, 10),
      expect.closeTo(0.5976, 10),
      expect.closeTo(0.416667, 6),
    ]);
    expect(c.total).toBeCloseTo(6.564267, 6);
    expect(c.incomplete).toBe(false);
    expect(formatEuro(c.total)).toBe('6,56 €');
  });

  it('prezzo mancante: totale "incompleto"', () => {
    const { 'food:rice_white_cooked': _r, ...partial } = prices;
    const c = computeCost(lines, partial, catalog.get);
    expect(c.incomplete).toBe(true);
    expect(c.missingPrices).toEqual(['food:rice_white_cooked']);
    expect(c.total).toBeCloseTo(5.814267, 6);
  });
});

// ---------------------------------------------------------------------------
describe('esporta tutto e ripristina', () => {
  const now = new Date('2026-10-24T10:00:00Z');
  const dog: Dog = {
    id: 'cane-1',
    name: 'Fido',
    weightKg: 30,
    useIdealWeight: false,
    neutered: true,
    activity: 'normale',
    manualKcal: 1218,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const data: PersonalData = {
    ...emptyPersonalData(),
    dogs: [dog],
    prices: { 'food:beef_mid_10': { mode: 'per_kg', eurPerKg: 12 } },
  };

  it('andata e ritorno senza perdere nulla', () => {
    const text = exportBackup(data, now, 'Alimenti v. 23/10/2026');
    const r = parseBackup(text, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.dogs).toEqual([dog]);
    expect(r.data.prices).toEqual(data.prices);
    expect(r.data.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.data.lastBackupAt).toBe(now.toISOString());
  });

  it('il backup non contiene il catalogo', () => {
    const text = exportBackup(data, now, 'v');
    expect(text).not.toContain('kcal_me_per_100g');
    expect(text).not.toContain('"foods"');
    expect(text).not.toContain('"supplements"');
    expect(JSON.parse(text).format).toBe(BACKUP_FORMAT);
  });

  it('nome del file', () => {
    expect(backupFileName(now)).toBe('nutrizione-pet-backup-2026-10-24.json');
  });

  it.each([
    ['non è JSON', 'ciao', 'non è leggibile'],
    ['altro formato', '{"format":"altro"}', 'non è un backup'],
    ['versione futura', `{"format":"${BACKUP_FORMAT}","schemaVersion":99,"data":{}}`, 'più nuova'],
    ['senza cani', `{"format":"${BACKUP_FORMAT}","schemaVersion":1,"data":{}}`, 'elenco dei cani'],
    [
      'peso non valido',
      `{"format":"${BACKUP_FORMAT}","schemaVersion":1,"data":{"dogs":[{"id":"a","name":"Rex","weightKg":0,"activity":"normale","neutered":true}]}}`,
      'peso non valido',
    ],
  ])('rifiuta un file rovinato: %s', (_name, text, msg) => {
    const r = parseBackup(text, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });

  it('promemoria dopo 14 giorni', () => {
    expect(backupReminder(null, now).due).toBe(true);
    expect(backupReminder('2026-10-11T10:00:00Z', now)).toMatchObject({ due: false, daysSince: 13 });
    expect(backupReminder('2026-10-10T10:00:00Z', now)).toMatchObject({
      due: true,
      daysSince: 14,
      message: 'Ultimo backup: 14 giorni fa.',
    });
  });
});
