import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyPersonalData, exportBackup, parseBackup } from '../../engine';
import { EMPTY_DOG_FORM, decimalToText, dogToForm, parseDecimal, validateDogForm, type DogFormValues } from '../dogForm';
import {
  addDog,
  deleteDog,
  markBackup,
  parseLocal,
  serializeLocal,
  updateDog,
  withPrice,
  withoutPrice,
} from '../personalStore';

const now = new Date('2026-10-25T09:00:00Z');
const form = (over: Partial<DogFormValues>): DogFormValues => ({ ...EMPTY_DOG_FORM, ...over });

describe('numeri scritti dall’utente', () => {
  it.each([
    ['30', 30],
    ['12,5', 12.5],
    ['12.5', 12.5],
    [' 1 218 ', 1218],
    ['', undefined],
    ['12,5 kg', 'invalid'],
    ['-3', 'invalid'],
    ['1,2,3', 'invalid'],
  ] as const)('"%s" → %s', (text, value) => {
    expect(parseDecimal(text)).toBe(value);
  });

  it('ritorno al testo con la virgola', () => {
    expect(decimalToText(12.5)).toBe('12,5');
    expect(decimalToText(undefined)).toBe('');
  });
});

describe('modulo del cane', () => {
  it('cane d’esempio: solo i campi scritti', () => {
    const r = validateDogForm(form({ name: ' Fido ', weight: '30', manualKcal: '1218' }));
    expect(r).toEqual({
      ok: true,
      fields: { name: 'Fido', weightKg: 30, useIdealWeight: false, neutered: true, activity: 'normale', manualKcal: 1218 },
    });
  });

  it('errori in italiano', () => {
    const r = validateDogForm(form({ weight: '0', age: 'tre', multiplier: '5' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.name).toBe('Scrivi il nome del cane.');
    expect(r.errors.weight).toBe('Il peso attuale: deve essere tra 0,5 e 120.');
    expect(r.errors.age).toBe('L’età: scrivi solo un numero, es. 12,5.');
    expect(r.errors.multiplier).toBe('Il moltiplicatore: deve essere tra 0,8 e 3.');
  });

  it('peso ideale richiesto se si sceglie di usarlo', () => {
    const r = validateDogForm(form({ name: 'Fido', weight: '33', useIdealWeight: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.idealWeight).toBe('Per usare il peso ideale, scrivilo qui.');
  });

  it('tutti i campi, andata e ritorno', () => {
    const values = form({
      name: 'Luna',
      age: '6',
      weight: '33,5',
      idealWeight: '30',
      useIdealWeight: true,
      neutered: false,
      breed: 'Meticcio',
      size: 'grande',
      bcs: 6,
      mcs: 'perdita_lieve',
      activity: 'alta',
      multiplier: '1,7',
      manualKcal: '',
      table: 95,
      notes: 'Nota',
    });
    const r = validateDogForm(values);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const data = addDog(emptyPersonalData(), r.fields, now, 'cane-1');
    expect(dogToForm(data.dogs[0]!)).toEqual(values);
  });
});

describe('azioni sui dati personali', () => {
  const fields = { name: 'Fido', weightKg: 30, useIdealWeight: false, neutered: true, activity: 'normale' as const };

  it('aggiungi, modifica, elimina un cane', () => {
    let d = addDog(emptyPersonalData(), { ...fields, manualKcal: 1218 }, now, 'cane-1');
    expect(d.dogs).toHaveLength(1);
    expect(d.dogs[0]!.createdAt).toBe(now.toISOString());

    const later = new Date('2026-10-26T09:00:00Z');
    d = updateDog(d, 'cane-1', { ...fields, weightKg: 31 }, later);
    expect(d.dogs[0]).toMatchObject({ id: 'cane-1', weightKg: 31, createdAt: now.toISOString(), updatedAt: later.toISOString() });
    expect(d.dogs[0]!.manualKcal).toBeUndefined(); // kcal a mano tolte nel modulo

    d = deleteDog(d, 'cane-1');
    expect(d.dogs).toEqual([]);
  });

  it('prezzi separati dal catalogo', () => {
    let d = withPrice(emptyPersonalData(), 'food:beef_mid_10', { mode: 'per_kg', eurPerKg: 12 }, now);
    expect(d.prices['food:beef_mid_10']).toEqual({ mode: 'per_kg', eurPerKg: 12, updatedAt: now.toISOString() });
    d = withoutPrice(d, 'food:beef_mid_10');
    expect(d.prices).toEqual({});
  });

  it('file locale: andata e ritorno, file rovinati ignorati', () => {
    const d = markBackup(addDog(emptyPersonalData(), fields, now, 'cane-1'), now);
    expect(parseLocal(serializeLocal(d))).toEqual({ status: 'ok', data: d, migratedFrom: null });
    expect(parseLocal(null)).toEqual({ status: 'mancante' });
    expect(parseLocal('{rotto')).toEqual({ status: 'illeggibile' });
    expect(parseLocal('{"format":"altro"}')).toEqual({ status: 'illeggibile' });
  });

  it('impostazioni nuove prendono il valore iniziale', () => {
    const text = JSON.stringify({ format: 'nutrizione-pet-dati-locali', schemaVersion: 1, data: { dogs: [], prices: {}, settings: { tolerance: 0.2 } } });
    const r = parseLocal(text);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.data.settings).toEqual({ ...DEFAULT_SETTINGS, tolerance: 0.2 });
  });

  it('backup del cane d’esempio e ripristino: nulla si perde', () => {
    const d = withPrice(addDog(emptyPersonalData(), { ...fields, manualKcal: 1218 }, now, 'cane-1'), 'supplement:omegor_vitality', { mode: 'per_package', packagePrice: 25, packageSize: 60 }, now);
    const r = parseBackup(exportBackup(d, now, 'v'), now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.dogs).toEqual(d.dogs);
    expect(r.data.prices).toEqual(d.prices);
  });
});

describe('ricette e impostazioni nei dati personali', () => {
  it('salva, sostituisci, elimina una ricetta', async () => {
    const { saveRecipe, deleteRecipe } = await import('../personalStore');
    const r = { id: 'r1', name: 'A', dogId: 'c1' } as unknown as import('../../engine').Recipe;
    let d = saveRecipe(emptyPersonalData(), r);
    d = saveRecipe(d, { ...r, name: 'B' });
    expect(d.recipes.map((x) => x.name)).toEqual(['B']);
    d = deleteRecipe(d, 'r1');
    expect(d.recipes).toEqual([]);
  });

  it('impostazioni vecchie senza i nuovi gruppi prendono i valori iniziali', async () => {
    const { mergeSettings } = await import('../personalStore');
    const s = mergeSettings({ tolerance: 0.15, sanity: { liverPctOfFood: 7 } } as never);
    expect(s.tolerance).toBe(0.15);
    expect(s.sanity).toEqual({ ...DEFAULT_SETTINGS.sanity, liverPctOfFood: 7 });
    expect(s.calorieSplit).toEqual(DEFAULT_SETTINGS.calorieSplit);
  });
});

describe('migrazioni e protezione dei dati negli aggiornamenti', () => {
  // File salvato dalla versione 0.2.0 (struttura 1): cani, prezzi, impostazioni vecchie, nessuna ricetta.
  const v1 = JSON.stringify({
    format: 'nutrizione-pet-dati-locali',
    schemaVersion: 1,
    data: {
      dogs: [{ id: 'c1', name: 'Fido', weightKg: 30, useIdealWeight: false, neutered: true, activity: 'normale', manualKcal: 1218, createdAt: 'x', updatedAt: 'x' }],
      recipes: [],
      diary: [],
      prices: { 'food:beef_mid_10': { mode: 'per_kg', eurPerKg: 12 } },
      settings: { backupReminderDays: 10, tolerance: 0.1, multipliers: null, aminoAcidDigestibilityIncrease: false, diaryAverageDays: 14, diaryAlertDays: 7 },
      lastBackupAt: '2026-10-24T10:00:00.000Z',
    },
  });

  it('i dati della 0.2.0 passano alla struttura 2 senza perdere nulla', async () => {
    const { DATA_SCHEMA_VERSION } = await import('../../engine');
    expect(DATA_SCHEMA_VERSION).toBe(2);
    const r = parseLocal(v1);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.migratedFrom).toBe(1);
    expect(r.data.dogs[0]!.name).toBe('Fido');
    expect(r.data.dogs[0]!.manualKcal).toBe(1218);
    expect(r.data.prices['food:beef_mid_10']).toEqual({ mode: 'per_kg', eurPerKg: 12 });
    expect(r.data.settings.backupReminderDays).toBe(10); // scelta dell'utente conservata
    expect(r.data.settings.calorieSplit).toEqual(DEFAULT_SETTINGS.calorieSplit); // nuova impostazione
    expect(r.data.lastBackupAt).toBe('2026-10-24T10:00:00.000Z');
    // salvata di nuovo, risulta già alla versione attuale
    expect(parseLocal(serializeLocal(r.data))).toMatchObject({ status: 'ok', migratedFrom: null });
  });

  it('file senza numero di versione (0.2.0) vale come versione 1', () => {
    const noVersion = JSON.stringify({ ...JSON.parse(v1), schemaVersion: undefined });
    expect(parseLocal(noVersion)).toMatchObject({ status: 'ok', migratedFrom: 1 });
  });

  it('dati di una versione più nuova (es. dopo il ritiro di un aggiornamento): mostrati ma da non sovrascrivere', () => {
    const v9 = JSON.stringify({ ...JSON.parse(v1), schemaVersion: 9 });
    const r = parseLocal(v9);
    expect(r.status).toBe('piu_nuovi');
    if (r.status === 'piu_nuovi') {
      expect(r.version).toBe(9);
      expect(r.data!.dogs[0]!.name).toBe('Fido');
    }
  });

  it('backup della 0.2.0 (struttura 1) si ripristina con la versione attuale', async () => {
    const { parseBackup } = await import('../../engine');
    const backupV1 = JSON.stringify({ format: 'nutrizione-pet-backup', schemaVersion: 1, exportedAt: '2026-10-24T10:00:00.000Z', catalogVersion: 'v', data: JSON.parse(v1).data });
    const r = parseBackup(backupV1, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.dogs[0]!.name).toBe('Fido');
    expect(r.data.recipes).toEqual([]);
    expect(r.data.settings.sanity).toEqual(DEFAULT_SETTINGS.sanity);
  });

  it('i backup nuovi dichiarano la struttura 2', () => {
    expect(JSON.parse(exportBackup(emptyPersonalData(), now, 'v')).schemaVersion).toBe(2);
  });

  it('migrazione mancante o versione non valida: rifiutata', async () => {
    const { migrateData } = await import('../../engine');
    expect(migrateData({}, 0)).toMatchObject({ ok: false, reason: 'versione_non_valida' });
    expect(migrateData({}, 3)).toMatchObject({ ok: false, reason: 'piu_nuovi' });
  });
});
