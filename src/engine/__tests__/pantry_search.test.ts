// Ricerca nella dispensa e ordine dal prodotto toccato più di recente (26/11/2026). Solo schermata: i dati non cambiano.
import { describe, expect, it } from 'vitest';
import { emptyPersonalData, exportBackup, parseBackup } from '../backup';
import { getCatalog } from '../bundledData';
import {
  addBulk,
  addPackages,
  applyPantryOrder,
  consumePartial,
  EMPTY_PANTRY,
  packageFinished,
  pantryGroups,
  pantryRecentOrder,
  searchPantryGroups,
  searchText,
  type PantryData,
  type PantryGroup,
} from '../pantry';

const catalog = getCatalog();
const at = (h: number) => new Date(2026, 10, 26, h, 0);
const BEEF3 = 'food:beef_03';
const BEEF_CDB = 'food:beef_ground_fine_cdb';
const ARMONIA = 'food:armonia_beef_rabbit_cdb';
const OAT = 'food:oat_dry';

/** Dispensa di prova: confezioni, un resto e una partita sfusa. */
function sample(): PantryData {
  let p: PantryData = EMPTY_PANTRY;
  p = addPackages(p, { id: 'b3', key: BEEF3, day: '2026-11-20', packages: 3, packageSize: 1000 }, at(8));
  p = addPackages(p, { id: 'cdb', key: BEEF_CDB, day: '2026-11-20', packages: 2, packageSize: 500 }, at(9));
  p = consumePartial(p, 'cdb', { remaining: 800 }, { resto: 'cdb:resto', history: 'h1' }, at(10)); // 1 × 500 + resto 300
  p = addBulk(p, { id: 'arm', key: ARMONIA, day: '2026-11-21', grams: 10000 }, at(11));
  p = addPackages(p, { id: 'oat', key: OAT, day: '2026-11-22', packages: 1, packageSize: 1000 }, at(12));
  return p;
}
const names = (gs: PantryGroup[]) => gs.map((g) => g.key);
const kinds = (gs: PantryGroup[], key: string) => gs.find((g) => g.key === key)?.lots.map((l) => l.kind);

describe('ricerca nella dispensa', () => {
  const p = sample();
  const all = pantryGroups(p, catalog);

  it('trova per parte del nome: «manzo» mostra solo le righe con manzo', () => {
    expect(names(searchPantryGroups(all, 'manzo')).sort()).toEqual([ARMONIA, BEEF3, BEEF_CDB].sort());
    expect(names(searchPantryGroups(all, 'aven'))).toEqual([OAT]);
    expect(names(searchPantryGroups(all, 'cdb')).sort()).toEqual([ARMONIA, BEEF_CDB].sort());
  });

  it('non distingue maiuscole, minuscole e accenti', () => {
    expect(names(searchPantryGroups(all, 'MANZO'))).toEqual(names(searchPantryGroups(all, 'manzo')));
    expect(names(searchPantryGroups(all, 'Mànzò'))).toEqual(names(searchPantryGroups(all, 'manzo')));
    expect(names(searchPantryGroups(all, '  avena  '))).toEqual([OAT]);
    // accenti nel nome del prodotto
    const fake: PantryGroup[] = [{ key: 'x', name: 'Purè di patate', unit: 'g', total: 100, lots: all[0]!.lots }];
    expect(searchPantryGroups(fake, 'pure')).toHaveLength(1);
    expect(searchPantryGroups(fake, 'PURÈ')).toHaveLength(1);
    expect(searchText('Purè  Di   Patàte')).toBe('pure di patate');
  });

  it('più parole: devono esserci tutte («manzo fine»)', () => {
    expect(names(searchPantryGroups(all, 'manzo fine'))).toEqual([BEEF_CDB]);
    expect(searchPantryGroups(all, 'manzo pollo')).toEqual([]);
  });

  it('include le righe «Resto» e le partite sfuse del prodotto trovato', () => {
    expect(kinds(searchPantryGroups(all, 'fine di manzo'), BEEF_CDB)).toEqual(['confezioni', 'resto']);
    expect(kinds(searchPantryGroups(all, 'armonia'), ARMONIA)).toEqual(['partita']);
  });

  it('si possono cercare anche «resto» e «sfusa»: solo quelle righe, con il totale intero del prodotto', () => {
    const resto = searchPantryGroups(all, 'resto');
    expect(names(resto)).toEqual([BEEF_CDB]);
    expect(kinds(resto, BEEF_CDB)).toEqual(['resto']);
    expect(resto[0]!.total).toBe(800); // 500 + 300: il totale resta quello del prodotto
    expect(names(searchPantryGroups(all, 'sfusa'))).toEqual([ARMONIA]);
    expect(names(searchPantryGroups(all, 'manzo resto'))).toEqual([BEEF_CDB]);
  });

  it('campo vuoto (o solo spazi) mostra tutta la dispensa', () => {
    expect(searchPantryGroups(all, '')).toEqual(all);
    expect(searchPantryGroups(all, '   ')).toEqual(all);
  });

  it('niente trovato → lista vuota (la schermata scrive «Nessun prodotto trovato»)', () => {
    expect(searchPantryGroups(all, 'salmone')).toEqual([]);
    expect(searchPantryGroups([], 'manzo')).toEqual([]);
  });

  it('la ricerca non cambia i dati', () => {
    const before = JSON.stringify(p);
    searchPantryGroups(pantryGroups(p, catalog), 'manzo');
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('ordine: prima i prodotti toccati più di recente', () => {
  it('l’ultimo acquisto o consumo va in cima', () => {
    let p = sample();
    expect(pantryRecentOrder(p)).toEqual([OAT, ARMONIA, BEEF_CDB, BEEF3]);
    p = packageFinished(p, 'b3', 'h2', at(13)); // finisco una confezione di manzo 3%
    expect(pantryRecentOrder(p)[0]).toBe(BEEF3);
  });

  it('l’ordine si applica alle righe e alla ricerca; i prodotti nuovi vanno in cima; senza ordine resta alfabetico', () => {
    const p = sample();
    const alpha = pantryGroups(p, catalog);
    const ordered = applyPantryOrder(alpha, pantryRecentOrder(p));
    expect(names(ordered)).toEqual([OAT, ARMONIA, BEEF_CDB, BEEF3]);
    expect(names(searchPantryGroups(ordered, 'manzo'))).toEqual([ARMONIA, BEEF_CDB, BEEF3]);
    expect(names(applyPantryOrder(alpha, [BEEF3]))).toEqual([...names(alpha).filter((k) => k !== BEEF3), BEEF3]);
    expect(applyPantryOrder(alpha, null)).toEqual(alpha);
  });

  it('l’ordine non cambia i dati salvati né i totali', () => {
    const p = sample();
    const before = JSON.stringify(p);
    const ordered = applyPantryOrder(pantryGroups(p, catalog), pantryRecentOrder(p));
    expect(JSON.stringify(p)).toBe(before);
    expect(ordered.reduce((s, g) => s + g.total, 0)).toBe(pantryGroups(p, catalog).reduce((s, g) => s + g.total, 0));
  });
});

describe('backup vecchi si ripristinano ancora e si cercano', () => {
  const now = at(14);
  it('dispensa della 0.7.1–0.7.4 (totali) e della 0.7.5 (righe senza storico): ripristino e ricerca', () => {
    const old = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    old.data.pantry = { items: { [BEEF3]: { amount: 2300, packageSize: 1000, updatedAt: '2026-11-01T10:00:00.000Z' } }, purchases: [] };
    const r1 = parseBackup(JSON.stringify(old), now);
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      const found = searchPantryGroups(pantryGroups(r1.data.pantry, catalog), 'MANZO');
      expect(names(found)).toEqual([BEEF3]);
      expect(kinds(found, BEEF3)).toEqual(['confezioni', 'resto']);
      expect(found[0]!.total).toBe(2300);
    }
    const v075 = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    const lots = [{ id: 's1', key: ARMONIA, kind: 'partita', packages: 0, packageSize: 0, amount: 10000, bought: 10000, day: '2026-11-21', updatedAt: '' }];
    v075.data.pantry = { lots, items: {}, purchases: [] };
    const r2 = parseBackup(JSON.stringify(v075), now);
    expect(r2.ok && r2.data.pantry.lots).toEqual(lots);
    if (r2.ok) {
      expect(names(searchPantryGroups(pantryGroups(r2.data.pantry, catalog), 'sfusa'))).toEqual([ARMONIA]);
      expect(pantryRecentOrder(r2.data.pantry)).toEqual([ARMONIA]); // anche senza data di modifica
    }
  });

  it('backup senza dispensa (versioni precedenti alla 0.7.1): dispensa vuota, la ricerca non trova niente', () => {
    const noPantry = JSON.parse(exportBackup(emptyPersonalData(), now, 'x'));
    delete noPantry.data.pantry;
    const r = parseBackup(JSON.stringify(noPantry), now);
    expect(r.ok && r.data.pantry).toEqual(EMPTY_PANTRY);
    if (r.ok) expect(searchPantryGroups(pantryGroups(r.data.pantry, catalog), '')).toEqual([]);
  });

  it('backup della 0.9.0 con dispensa piena: Esporta tutto → Ripristina dà la stessa dispensa', () => {
    const data = { ...emptyPersonalData(), pantry: sample() };
    const back = parseBackup(exportBackup(data, now, 'x'), now);
    expect(back.ok && back.data.pantry).toEqual(data.pantry);
  });
});
