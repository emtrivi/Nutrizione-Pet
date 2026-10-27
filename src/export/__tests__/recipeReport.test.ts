// Scheda PDF della ricetta: contenuto controllato sul cane d'esempio (calcoli fatti a mano).
//   30 kg, sterilizzato, attività normale → moltiplicatore 1,6
//   peso metabolico 30^0,75 = 12,819 kg · RER = 70 × 12,819 = 897,3 kcal · MER = 897,3 × 1,6 = 1.435,7 kcal
//   fattore 1.435,7 ÷ 12,819 = 112,0 → 112 → tabella 110
// Ricetta: manzo 12,8% 400 g (8,90 €/kg → 3,56 €) + riso cotto 300 g (prezzo non inserito)
//   kcal 752 + 390 = 1.142 · manzo 752 ÷ 1.142 = 65,8%
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, computeDogEnergy, evaluateRecipe, fediaf, getCatalog, NUTRIENTS, type Dog } from '../../engine';
import { recipePdfFileName } from '../fileName';
import { recipeReportHtml } from '../recipeReport';

const catalog = getCatalog();
const dog: Dog = {
  id: 'd1',
  name: 'Fido',
  weightKg: 30,
  idealWeightKg: 28,
  useIdealWeight: false,
  neutered: true,
  bcs: 6,
  mcs: 'normale',
  activity: 'normale',
  createdAt: '2026-10-27T10:00:00Z',
  updatedAt: '2026-10-27T10:00:00Z',
};
const e = computeDogEnergy(dog);
const foods = [
  { key: 'food:beef_mid_10', amount: 400 },
  { key: 'food:rice_white_cooked', amount: 300 },
];
const supplements = [{ key: 'supplement:bone_meal', amount: 7.5 }];
const prices = { 'food:beef_mid_10': { mode: 'per_kg' as const, eurPerKg: 8.9 } };
const overrides = { calcium: { min: 1.5 } };
const ev = evaluateRecipe(
  { lines: [...foods, ...supplements], kcalTarget: e.kcalPerDay, table: e.table, overrides, dogWeightKg: 30 },
  { catalog, fediaf, settings: DEFAULT_SETTINGS, prices },
);
const html = recipeReportHtml({
  recipeName: 'Manzo & riso',
  saved: true,
  reviewReasons: [],
  dog,
  energy: { dogEnergy: e, kcalTarget: e.kcalPerDay, kcalFromDog: true, factorRounded: e.factorRounded, proposedTable: e.proposedTable, table: e.table },
  ev,
  foods,
  supplements,
  overrides,
  prices,
  settings: DEFAULT_SETTINGS,
  catalog,
  appVersion: '0.5.0',
  now: new Date(2026, 9, 27, 9, 5),
});
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('scheda PDF: cane e calcolo delle calorie', () => {
  it('profilo completo', () => {
    for (const s of ['Fido', 'Sterilizzato Sì', 'Peso attuale 30 kg', 'Peso ideale stimato 28 kg', 'BCS (1-9) 6', 'MCS (massa muscolare) Normale']) {
      expect(text).toContain(s);
    }
  });
  it('peso metabolico, RER, moltiplicatore, MER, fattore e tabella', () => {
    expect(text).toContain('Peso metabolico 12,819 kg');
    expect(text).toContain('RER (fabbisogno a riposo) 897,3 kcal 70 × 12,819');
    expect(text).toContain('Moltiplicatore 1,6 proposto per attività e sterilizzazione');
    expect(text).toContain('MER (fabbisogno al giorno del cane) 1.435,7 kcal 897,3 × 1,6');
    expect(text).toContain('Fattore (kcal ÷ peso metabolico) 112');
    expect(text).toContain('Tabella FEDIAF del cane 110');
  });
});

describe('scheda PDF: ingredienti e prezzo', () => {
  it('grammi, kcal, quota di calorie, prezzo al kg e prezzo della riga', () => {
    expect(text).toMatch(/Macinato bovino crudo, 12,8% grassi \(USDA Foundation\).*400 g 752,0 \d+,\d% 8,90 €\/kg 3,56 €/);
    expect(text).toMatch(/Riso bianco cotto senza sale.*300 g 390,0 .*— prezzo non inserito/);
  });
  it('integratore con dose del produttore e totale incompleto', () => {
    expect(text).toContain('7,5 g');
    expect(text).toContain('Produttore, fino a 40 kg');
    expect(text).toContain('Prezzo al giorno 3,56 € (incompleto)');
  });
  it('carattere speciale nel nome protetto', () => {
    expect(html).toContain('<h1>Manzo &amp; riso</h1>');
  });
});

describe('scheda PDF: tutti i nutrienti e i rapporti', () => {
  it('una riga per ogni nutriente del dizionario', () => {
    for (const n of NUTRIENTS) expect(text).toContain(n.nameIt);
    const rows = html.split('<table class="grid nut">').slice(1).map((t) => (t.split('</table>')[0]!.match(/<tr>/g) ?? []).length - 1);
    expect(rows.reduce((a, b) => a + b, 0)).toBe(NUTRIENTS.length);
  });
  it('calcio: minimo modificato a mano e segnalato', () => {
    expect(text).toMatch(/Calcio [^|]*1,5 g \(modificato\)/);
    expect(text).toContain('modificato a mano in questa ricetta');
  });
  it('rapporti, disclaimer e versioni', () => {
    expect(text).toContain('Calcio / fosforo');
    expect(text).toContain('Omega-6 / omega-3');
    expect(text).toContain('Strumento di supporto, da validare con la nutrizionista.');
    expect(text).toContain('Nutrizione Pet 0.5.0');
    expect(text).toContain('esportata il 27/10/2026 09:05');
  });
});

describe('nome del file', () => {
  it('senza accenti né simboli', () => {
    expect(recipePdfFileName('Manzo & più riso', 'Fido', new Date(2026, 9, 27))).toBe('Ricetta_Manzo_piu_riso_Fido_2026-10-27.pdf');
  });
});
