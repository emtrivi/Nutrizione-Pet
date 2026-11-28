/// <reference types="node" />
// Preferiti, sola lettura, giornate tipo e anteprima (28/11/2026): controlli sui file delle schermate.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = join(__dirname, '..', '..', 'app');
const read = (p: string) => readFileSync(join(app, p), 'utf8');

describe('ricetta in sola lettura (dai Preferiti)', () => {
  const src = read('vista/[id].tsx');
  it('non ha campi modificabili né azioni che cambiano la ricetta', () => {
    for (const forbidden of ['TextInput', '<Field', 'Segmented', 'useData().update', 'update(', 'saveRecipe', 'deleteRecipe', 'withMeals', 'setMeal', 'MealsCard ']) {
      expect(src).not.toContain(forbidden);
    }
    expect(src).not.toMatch(/\{\s*data,\s*update\s*\}/);
  });
  it('mostra ingredienti, calorie e pasti; «Modifica ricetta» è un pulsante separato, in fondo', () => {
    for (const t of ['title="Ingredienti"', 'title="Calorie"', 'title="Pasti"', 'Sola lettura']) expect(src).toContain(t);
    const modify = src.indexOf('Modifica ricetta"');
    expect(modify).toBeGreaterThan(src.indexOf('title="Pasti"'));
    expect(src.slice(modify - 200, modify)).toContain('borderTopWidth: 1');
  });
});

describe('scheda Cani: Preferiti e Giornate tipo', () => {
  const src = read('(tabs)/index.tsx');
  it('sotto i cani, prima dell’accesso rapido', () => {
    const dogs = src.indexOf('Aggiungi un cane');
    const fav = src.indexOf('★ Preferiti');
    const days = src.indexOf('title="Giornate tipo"');
    expect(dogs).toBeGreaterThan(0);
    expect(fav).toBeGreaterThan(dogs);
    expect(days).toBeGreaterThan(fav);
    expect(src.indexOf('Accesso rapido')).toBeGreaterThan(days);
  });
  it('i preferiti si aprono in sola lettura; le giornate nella loro pagina; c’è l’anteprima', () => {
    expect(src).toContain("pathname: '/vista/[id]'");
    expect(src).toContain("pathname: '/giornata/[id]'");
    expect(src).toContain("router.push('/anteprima')");
  });
  it('la stellina c’è nella lista delle ricette e nella ricetta', () => {
    expect(read('(tabs)/ricette.tsx')).toContain('<FavoriteStar');
    expect(read('ricetta/[id].tsx')).toContain('headerRight: saved ? () => <FavoriteStar');
    expect(read('vista/[id].tsx')).toContain('<FavoriteStar');
  });
});

describe('anteprima degli ingredienti', () => {
  const src = read('anteprima.tsx');
  it('esiste, usa il calcolo condiviso e non salva niente', () => {
    expect(existsSync(join(app, 'anteprima.tsx'))).toBe(true);
    expect(src).toContain('dayPreview(');
    for (const forbidden of ['update(', 'withShopping', 'withPantry', 'addDiaryPeriod', 'withDayPlans', 'scongel']) expect(src).not.toContain(forbidden);
  });
  it('mostra «serve, in dispensa, ne manca» e il prezzo previsto', () => {
    expect(src).toContain('Serve {quantity(it, it.amount)}, in dispensa {quantity(it, it.inPantry)}');
    expect(src).toContain('ne manca');
    expect(src).toContain('Prezzo previsto');
  });
});
