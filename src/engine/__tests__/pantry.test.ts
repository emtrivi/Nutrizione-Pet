// Dispensa (20/11/2026; acquisto e consumo separati dal 21/11/2026): quantità in casa, aggiornate solo a mano.
// Calcoli fatti a mano.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyPersonalData, exportBackup, parseBackup } from '../backup';
import { getCatalog } from '../bundledData';
import {
  EMPTY_PANTRY,
  addBulk,
  addPackages,
  confirmDraft,
  consumePartial,
  daysCovered,
  discardDraft,
  draftAddLine,
  draftChangePackages,
  draftEditLine,
  draftRemoveLine,
  draftSetDay,
  historyCutoff,
  lotAmount,
  packageFinished,
  pantryAmount,
  pantryGroups,
  partialValues,
  pruneHistory,
  sanitizePantry,
  startEditPurchase,
  visibleHistory,
  type PantryData,
} from '../pantry';
import type { Recipe } from '../recipes';
import { shoppingForecast } from '../shopping';
import { historyText } from '../../ui/pantryText';

const now = new Date(2026, 10, 21, 10, 0); // 21/11/2026, ora del telefono
const later = new Date(2026, 10, 25, 9, 0); // 25/11/2026
const BEEF = 'food:beef_mid_10';
const OAT = 'food:oat_dry';
const buy = (p: PantryData, key: string, packages: number, packageSize: number, id: string) => addPackages(p, { id, key, day: '2026-11-21', packages, packageSize }, now);
const bulk = (p: PantryData, key: string, grams: number, id: string, day = '2026-11-21') => addBulk(p, { id, key, day, grams }, now);
const rows = (p: PantryData, key: string) => p.lots.filter((l) => l.key === key);
const addPack = (p: PantryData, key: string, packages: number, packageSize: number, id: string) =>
  draftAddLine(p, { key, kind: 'confezioni', packages, packageSize }, id, now, '2026-11-21');
const addSfusa = (p: PantryData, key: string, grams: number, id: string) => draftAddLine(p, { key, kind: 'partita', grams }, id, now, '2026-11-21');
const catalog = getCatalog();

describe('acquisto: bozza', () => {
  it('stesso prodotto e formato si sommano nella bozza; formato diverso a parte; la dispensa non cambia finché non confermo', () => {
    let p = addPack(EMPTY_PANTRY, BEEF, 1, 1000, 'l1');
    p = addPack(p, BEEF, 1, 1000, 'l2');
    p = addPack(p, BEEF, 1, 500, 'l3');
    expect(p.draft?.lines.map((l) => [l.packages, l.packageSize])).toEqual([
      [2, 1000],
      [1, 500],
    ]);
    expect(p.draft?.day).toBe('2026-11-21');
    expect(p.lots).toHaveLength(0);
    expect(pantryAmount(p, BEEF)).toBe(0);
  });
  it('le correzioni durante la sessione (+1, −1, modifica, togli, data) non finiscono nello storico', () => {
    let p = addPack(EMPTY_PANTRY, BEEF, 2, 1000, 'l1');
    p = addPack(p, OAT, 1, 500, 'l2');
    p = draftChangePackages(p, 'l1', 1, now); // 3
    p = draftChangePackages(p, 'l1', -1, now); // 2
    p = draftEditLine(p, 'l2', { packages: 2, packageSize: 750 }, now);
    p = addSfusa(p, BEEF, 5000, 'l3');
    p = draftEditLine(p, 'l3', { grams: 8000 }, now);
    p = draftSetDay(p, '2026-11-20', now);
    expect(p.history).toHaveLength(0);
    p = draftRemoveLine(p, 'l3', now);
    expect(p.history).toHaveLength(0);
    p = confirmDraft(p, 'h1', now);
    expect(p.history).toHaveLength(1);
    expect(p.history[0]).toMatchObject({ type: 'acquisto', purchaseDay: '2026-11-20' });
    if (p.history[0]?.type === 'acquisto') expect(p.history[0].lines.map((l) => [l.key, l.packages, l.packageSize])).toEqual([
      [BEEF, 2, 1000],
      [OAT, 2, 750],
    ]);
  });
  it('modifica di un prodotto della bozza: 2 × 1.000 → 3 × 750; se il formato diventa uguale a un’altra riga, si uniscono; −1 sull’ultima la toglie', () => {
    let p = addPack(EMPTY_PANTRY, BEEF, 2, 1000, 'l1');
    expect(draftEditLine(p, 'l1', { packages: 3, packageSize: 750 }, now).draft?.lines[0]).toMatchObject({ packages: 3, packageSize: 750 });
    p = addPack(p, BEEF, 1, 500, 'l2');
    expect(draftEditLine(p, 'l2', { packages: 1, packageSize: 1000 }, now).draft?.lines).toEqual([expect.objectContaining({ id: 'l1', packages: 3, packageSize: 1000 })]);
    const one = addPack(EMPTY_PANTRY, BEEF, 1, 1000, 'l1');
    expect(draftChangePackages(one, 'l1', -1, now).draft?.lines).toHaveLength(0);
  });
  it('la conferma aggiorna dispensa e storico, e chiude la bozza', () => {
    let p = buy(EMPTY_PANTRY, BEEF, 1, 1000, 'gia'); // 1 confezione già in dispensa
    p = addPack(p, BEEF, 2, 1000, 'l1');
    p = addPack(p, BEEF, 1, 500, 'l2');
    p = addSfusa(p, OAT, 10000, 'l3');
    const c = confirmDraft(p, 'h1', now);
    expect(c.draft).toBeNull();
    expect(rows(c, BEEF).map((l) => [l.kind, l.packages, l.packageSize])).toEqual([
      ['confezioni', 3, 1000], // 1 + 2: stessa riga
      ['confezioni', 1, 500],
    ]);
    expect(pantryAmount(c, BEEF)).toBe(3500);
    expect(rows(c, OAT)).toEqual([expect.objectContaining({ kind: 'partita', amount: 10000, bought: 10000, day: '2026-11-21' })]);
    expect(c.sessions).toHaveLength(1);
    expect(c.history).toHaveLength(1);
    expect(historyText(c.history[0]!, catalog)).toMatch(/^Il 21\/11\/2026 hai comprato: .*2 confezioni da 1 kg.*1 confezione da 500 g.*partita sfusa di 10 kg/);
  });
  it('una bozza vuota non si conferma; «Scarta» la toglie senza toccare dispensa e storico', () => {
    const p = buy(EMPTY_PANTRY, BEEF, 1, 1000, 'gia');
    const d = draftRemoveLine(addPack(p, BEEF, 1, 1000, 'l1'), 'l1', now);
    expect(confirmDraft(d, 'h', now)).toBe(d);
    const x = discardDraft(addPack(p, BEEF, 5, 1000, 'l1'));
    expect(x.draft).toBeNull();
    expect(x.lots).toEqual(p.lots);
    expect(x.history).toHaveLength(0);
  });
  it('bozza non confermata salvata e ritrovata (Esporta tutto / Ripristina e lettura dal telefono)', () => {
    const p = addSfusa(addPack(EMPTY_PANTRY, BEEF, 2, 1000, 'l1'), OAT, 10000, 'l2');
    expect(sanitizePantry(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const data = { ...emptyPersonalData(), settings: { ...DEFAULT_SETTINGS }, pantry: p };
    const back = parseBackup(exportBackup(data, now, 'x'), now);
    expect(back.ok && back.data.pantry.draft).toEqual(p.draft);
    // ritrovata: si può confermare dopo
    if (back.ok) expect(pantryAmount(confirmDraft(back.data.pantry, 'h', now), BEEF)).toBe(2000);
  });
});

describe('acquisto già confermato: modifica', () => {
  let base = addPack(EMPTY_PANTRY, BEEF, 2, 1000, 'l1');
  base = addSfusa(base, OAT, 10000, 'l2');
  base = confirmDraft(base, 'h1', now);
  const sid = base.sessions[0]!.id;
  it('il 25/11 correggo l’acquisto del 21/11 (2 → 3 confezioni; partita 10 → 8 kg): dispensa aggiornata e «modifica» con la data', () => {
    let p = startEditPurchase(base, sid, later);
    expect(p.draft?.editingOf).toBe(sid);
    const beefLine = p.draft!.lines.find((l) => l.key === BEEF)!;
    const oatLine = p.draft!.lines.find((l) => l.key === OAT)!;
    p = draftChangePackages(p, beefLine.id, 1, later);
    p = draftEditLine(p, oatLine.id, { grams: 8000 }, later);
    expect(pantryAmount(p, BEEF)).toBe(2000); // finché non salvo, niente cambia
    p = confirmDraft(p, 'h2', later);
    expect(pantryAmount(p, BEEF)).toBe(3000);
    expect(rows(p, OAT)).toEqual([expect.objectContaining({ amount: 8000, bought: 8000 })]);
    expect(p.history.map((e) => [e.type, e.day])).toEqual([
      ['acquisto', '2026-11-21'],
      ['modifica', '2026-11-25'],
    ]);
    expect(historyText(p.history[1]!, catalog)).toMatch(
      /^Il 25\/11\/2026 hai corretto l’acquisto del 21\/11\/2026: .*prima 2 confezioni da 1 kg, ora 3 confezioni da 1 kg.*prima partita sfusa di 10 kg, ora partita sfusa di 8 kg\.$/,
    );
    expect(p.sessions[0]?.lines.find((l) => l.key === BEEF)?.packages).toBe(3);
  });
  it('una correzione tiene conto di quanto già consumato: partita a 6,5 kg, acquisto 10 → 8 kg → restano 4,5 kg', () => {
    let p = consumePartial(base, 'l2', { remaining: 6500 }, { resto: 'r', history: 'c1' }, now);
    p = startEditPurchase(p, sid, later);
    p = draftEditLine(p, 'l2', { grams: 8000 }, later);
    p = confirmDraft(p, 'h2', later);
    expect(rows(p, OAT)).toEqual([expect.objectContaining({ amount: 4500, bought: 8000 })]);
  });
  it('cambio di formato: 2 × 1.000 diventano 2 × 500 → la riga da 1 kg sparisce, nasce quella da 500 g', () => {
    let p = startEditPurchase(base, sid, later);
    const beefLine = p.draft!.lines.find((l) => l.key === BEEF)!;
    p = draftEditLine(p, beefLine.id, { packages: 2, packageSize: 500 }, later);
    p = confirmDraft(p, 'h2', later);
    expect(rows(p, BEEF).map((l) => [l.packages, l.packageSize])).toEqual([[2, 500]]);
  });
  it('salvare senza cambiare niente non scrive nello storico; «Annulla le modifiche» lascia tutto com’era', () => {
    const same = confirmDraft(startEditPurchase(base, sid, later), 'h2', later);
    expect(same.history).toHaveLength(1);
    expect(same.lots).toEqual(base.lots);
    expect(discardDraft(startEditPurchase(base, sid, later))).toEqual({ ...base, draft: null });
  });
});

describe('consumo', () => {
  const p = buy(EMPTY_PANTRY, BEEF, 3, 1000, 'a1');
  it('«Confezione finita»: da 3 a 2 confezioni, con voce «finita» nello storico', () => {
    const f = packageFinished(p, 'a1', 'h1', later);
    expect(f.lots[0]).toMatchObject({ packages: 2, packageSize: 1000 });
    expect(pantryAmount(f, BEEF)).toBe(2000);
    expect(f.history).toEqual([expect.objectContaining({ type: 'finita', day: '2026-11-25', key: BEEF, packageSize: 1000 })]);
    expect(historyText(f.history[0]!, catalog)).toMatch(/^Il 25\/11\/2026 hai finito una confezione da 1 kg di /);
  });
  it('«Confezione finita» sull’ultima confezione toglie la riga; «Finita» su una partita la toglie tutta', () => {
    expect(packageFinished(buy(EMPTY_PANTRY, BEEF, 1, 1000, 'a1'), 'a1', 'h', now).lots).toHaveLength(0);
    const s = packageFinished(bulk(EMPTY_PANTRY, OAT, 6500, 's1'), 's1', 'h', now);
    expect(s.lots).toHaveLength(0);
    expect(s.history[0]).toMatchObject({ type: 'finita', lotKind: 'partita', amount: 6500 });
  });
  it('«Consumata in parte»: scrivendo «restano 2.700 g» oppure «consumati 300 g» il risultato è lo stesso', () => {
    expect(partialValues(3000, { remaining: 2700 })).toEqual({ remaining: 2700, consumed: 300 });
    expect(partialValues(3000, { consumed: 300 })).toEqual({ remaining: 2700, consumed: 300 });
    const a = consumePartial(p, 'a1', { remaining: 2700 }, { resto: 'r1', history: 'h1' }, now);
    const b = consumePartial(p, 'a1', { consumed: 300 }, { resto: 'r1', history: 'h1' }, now);
    expect(a).toEqual(b);
    expect(a.lots).toEqual([
      expect.objectContaining({ id: 'a1', kind: 'confezioni', packages: 2, packageSize: 1000 }),
      expect.objectContaining({ id: 'r1', kind: 'resto', amount: 700 }),
    ]);
    expect(pantryAmount(a, BEEF)).toBe(2700);
    expect(a.history).toEqual([expect.objectContaining({ type: 'consumo', consumed: 300, remaining: 2700 })]);
  });
  it('«Consumata in parte» su una partita: 10.000 g, restano 6.500 oppure consumati 3.500 → stessa riga a 6.500 g', () => {
    const s = bulk(EMPTY_PANTRY, OAT, 10000, 's1');
    const a = consumePartial(s, 's1', { remaining: 6500 }, { resto: 'x', history: 'h' }, now);
    const b = consumePartial(s, 's1', { consumed: 3500 }, { resto: 'x', history: 'h' }, now);
    expect(a).toEqual(b);
    expect(a.lots).toEqual([expect.objectContaining({ id: 's1', kind: 'partita', amount: 6500, bought: 10000 })]);
    expect(historyText(a.history[0]!, catalog)).toMatch(/hai consumato 3,5 kg di .* dalla partita sfusa: ne restano 6,5 kg\.$/);
  });
  it('valori impossibili (più del totale, negativi, niente consumato) non cambiano nulla', () => {
    expect(partialValues(3000, { remaining: 3500 })).toBeNull();
    expect(partialValues(3000, { consumed: -1 })).toBeNull();
    expect(consumePartial(p, 'a1', { consumed: 4000 }, { resto: 'r', history: 'h' }, now)).toBe(p);
    expect(consumePartial(p, 'a1', { remaining: 3000 }, { resto: 'r', history: 'h' }, now)).toBe(p);
  });
  it('il resto non si somma mai alle confezioni: un nuovo acquisto da 1 kg va sulla riga delle confezioni', () => {
    const a = consumePartial(p, 'a1', { remaining: 2700 }, { resto: 'r1', history: 'h1' }, now);
    const c = confirmDraft(addPack(a, BEEF, 1, 1000, 'l1'), 'h2', now);
    expect(rows(c, BEEF).map((l) => [l.kind, lotAmount(l)])).toEqual([
      ['confezioni', 3000],
      ['resto', 700],
    ]);
  });
});

describe('partite sfuse', () => {
  it('due partite dello stesso prodotto e dello stesso peso restano due righe (nella bozza e in dispensa)', () => {
    let p = addSfusa(EMPTY_PANTRY, OAT, 10000, 'l1');
    p = addSfusa(p, OAT, 10000, 'l2');
    expect(p.draft?.lines).toHaveLength(2);
    p = confirmDraft(p, 'h1', now);
    p = confirmDraft(addSfusa(p, OAT, 10000, 'l3'), 'h2', later);
    expect(rows(p, OAT).map((l) => [l.kind, l.amount])).toEqual([
      ['partita', 10000],
      ['partita', 10000],
      ['partita', 10000],
    ]);
    expect(pantryAmount(p, OAT)).toBe(30000);
  });
  it('una partita non si unisce alle confezioni da 10.000 g', () => {
    expect(buy(bulk(EMPTY_PANTRY, OAT, 10000, 's1'), OAT, 1, 10000, 'a1').lots).toHaveLength(2);
  });
});

describe('storico: solo gli ultimi 3 mesi', () => {
  it('il primo giorno tenuto è oggi meno 3 mesi', () => {
    expect(historyCutoff(new Date(2026, 10, 21))).toBe('2026-08-21');
    expect(historyCutoff(new Date(2027, 1, 10))).toBe('2026-11-10');
  });
  it('le voci più vecchie di 3 mesi si cancellano da sole alla prossima operazione; il resto della dispensa non cambia', () => {
    let p = confirmDraft(addPack(EMPTY_PANTRY, BEEF, 3, 1000, 'l1'), 'h1', now); // 21/11/2026
    p = packageFinished(p, p.lots[0]!.id, 'h2', new Date(2026, 11, 1)); // 01/12/2026
    expect(p.history).toHaveLength(2);
    // 22/02/2027: il 21/11 è più vecchio di 3 mesi, l'1/12 no
    expect(visibleHistory(p, new Date(2027, 1, 22)).map((e) => e.id)).toEqual(['h2']);
    const q = packageFinished(p, p.lots[0]!.id, 'h3', new Date(2027, 1, 22));
    expect(q.history.map((e) => e.id)).toEqual(['h2', 'h3']);
    expect(q.sessions).toHaveLength(0); // l'acquisto del 21/11 non è più modificabile
    expect(pantryAmount(q, BEEF)).toBe(1000);
    expect(pruneHistory(q, new Date(2027, 1, 22))).toBe(q);
  });
  it('lo storico parte vuoto: la dispensa di prima non ricostruisce il passato', () => {
    const s = sanitizePantry({ lots: [], items: {}, purchases: [{ id: 'a', key: BEEF, day: '2026-11-20', packages: 3, packageSize: 1000 }] });
    expect(s.history).toEqual([]);
    expect(s.sessions).toEqual([]);
  });
});

describe('righe in dispensa', () => {
  it('per ingrediente: totale, poi confezioni (formato più grande prima), resti, partite', () => {
    let p = bulk(EMPTY_PANTRY, BEEF, 3000, 's1');
    p = buy(p, BEEF, 1, 500, 'a1');
    p = buy(p, BEEF, 2, 1000, 'a2');
    p = consumePartial(p, 'a1', { remaining: 200 }, { resto: 'r1', history: 'h' }, now);
    const g = pantryGroups(p, catalog);
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
  pantry = consumePartial(pantry, 'm', { remaining: 5000 }, { resto: 'mr', history: 'h' }, now);
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
  it('dati non validi → dispensa vuota; righe e voci non valide scartate', () => {
    expect(sanitizePantry(undefined)).toEqual(EMPTY_PANTRY);
    const s = sanitizePantry({
      lots: [
        { id: 'x', key: 'k', kind: 'confezioni', packages: 0, packageSize: 1000 },
        { id: 'y', key: 'k', kind: 'partita', amount: 500, bought: 800, day: '2026-11-21' },
        { id: 'z', key: 'k', kind: 'boh', amount: 5 },
      ],
      purchases: [{ id: 'x' }],
      history: [{ id: 'h', day: '2026-11-21', type: 'boh' }, 'x'],
      draft: { lines: [] },
      sessions: [{ id: 's' }],
    });
    expect(s.lots).toEqual([expect.objectContaining({ id: 'y', kind: 'partita', amount: 500, bought: 800 })]);
    expect(s.purchases).toEqual([]);
    expect(s.history).toEqual([]);
    expect(s.draft).toBeNull();
    expect(s.sessions).toEqual([]);
  });
  it('dispensa della 0.7.5 (righe, senza storico né bozza): righe identiche, storico vuoto', () => {
    const v075 = {
      lots: [
        { id: 'a1', key: BEEF, kind: 'confezioni', packages: 2, packageSize: 1000, amount: 0, bought: 0, day: '2026-11-21', updatedAt: 'x' },
        { id: 'r1', key: BEEF, kind: 'resto', packages: 0, packageSize: 0, amount: 600, bought: 0, day: '2026-11-21', updatedAt: 'x' },
        { id: 's1', key: OAT, kind: 'partita', packages: 0, packageSize: 0, amount: 6500, bought: 10000, day: '2026-11-21', updatedAt: 'x' },
      ],
      items: {},
      purchases: [{ id: 'a1', key: BEEF, day: '2026-11-21', packages: 2, packageSize: 1000 }],
    };
    const s = sanitizePantry(v075);
    expect(s.lots).toEqual(v075.lots);
    expect(s.purchases).toEqual(v075.purchases);
    expect(pantryAmount(s, BEEF)).toBe(2600);
    expect(pantryAmount(s, OAT)).toBe(6500);
    expect(s).toMatchObject({ draft: null, sessions: [], history: [] });
  });
  it('dispensa salvata dalla 0.7.1–0.7.4 (un totale per ingrediente): confezioni intere + resto, totale uguale', () => {
    const old = {
      items: {
        [BEEF]: { amount: 2600, packageSize: 1000, updatedAt: '2026-11-20T10:00:00.000Z' },
        [OAT]: { amount: 1234, packageSize: null, updatedAt: '' },
        'food:rice': { amount: 0, packageSize: 500, updatedAt: '' },
      },
      purchases: [{ id: 'a1', key: BEEF, day: '2026-11-20', packages: 3, packageSize: 1000 }],
    };
    const s = sanitizePantry(old);
    expect(s.lots).toEqual([
      expect.objectContaining({ key: BEEF, kind: 'confezioni', packages: 2, packageSize: 1000, day: '2026-11-20' }),
      expect.objectContaining({ key: BEEF, kind: 'resto', amount: 600 }),
      expect.objectContaining({ key: OAT, kind: 'resto', amount: 1234 }),
    ]);
    expect(pantryAmount(s, BEEF)).toBe(2600);
    expect(pantryAmount(s, OAT)).toBe(1234);
    expect(pantryAmount(s, 'food:rice')).toBe(0);
    expect(s.purchases).toHaveLength(1);
  });
  it('Esporta tutto e Ripristina conservano righe, bozza, acquisti confermati e storico', () => {
    let pantry = confirmDraft(addSfusa(addPack(EMPTY_PANTRY, BEEF, 3, 1000, 'l1'), OAT, 10000, 'l2'), 'h1', now);
    pantry = consumePartial(pantry, pantry.lots[0]!.id, { remaining: 2500 }, { resto: 'r1', history: 'h2' }, now);
    pantry = packageFinished(pantry, 'l2', 'h3', now);
    pantry = startEditPurchase(pantry, pantry.sessions[0]!.id, later);
    pantry = draftChangePackages(pantry, 'l1', 1, later);
    const data = { ...emptyPersonalData(), settings: { ...DEFAULT_SETTINGS }, pantry };
    const back = parseBackup(exportBackup(data, now, 'x'), now);
    expect(back.ok && back.data.pantry).toEqual(pantry);
  });
  it('backup vecchi: senza dispensa → vuota; con la dispensa a totali → convertita; con la dispensa della 0.7.5 → uguale', () => {
    const noPantry = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    delete noPantry.data.pantry;
    const b1 = parseBackup(JSON.stringify(noPantry), now);
    expect(b1.ok && b1.data.pantry).toEqual(EMPTY_PANTRY);
    const oldPantry = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    oldPantry.data.pantry = { items: { [BEEF]: { amount: 3000, packageSize: 1000, updatedAt: '' } }, purchases: [] };
    const b2 = parseBackup(JSON.stringify(oldPantry), now);
    expect(b2.ok).toBe(true);
    if (b2.ok) {
      expect(b2.data.pantry.lots).toEqual([expect.objectContaining({ kind: 'confezioni', packages: 3, packageSize: 1000 })]);
      expect(pantryAmount(b2.data.pantry, BEEF)).toBe(3000);
    }
    const v075 = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    const lots = [{ id: 's1', key: OAT, kind: 'partita', packages: 0, packageSize: 0, amount: 10000, bought: 10000, day: '2026-11-21', updatedAt: '' }];
    v075.data.pantry = { lots, items: {}, purchases: [] };
    const b3 = parseBackup(JSON.stringify(v075), now);
    expect(b3.ok && b3.data.pantry.lots).toEqual(lots);
  });
});
