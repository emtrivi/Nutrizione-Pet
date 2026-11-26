/// <reference types="node" />
// Dispensa al primo livello, con «Spesa e previsioni» dentro (26/11/2026).
// Controlla le schede in basso, i file delle pagine e i pulsanti di andata e ritorno.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BACK_TO_PANTRY_BUTTON, PANTRY_HREF, SHOPPING_BUTTON, SHOPPING_HREF, backToPantry } from '../navigation';

const app = join(__dirname, '..', '..', 'app');
const read = (p: string) => readFileSync(join(app, p), 'utf8');
const tabNames = () => [...read('(tabs)/_layout.tsx').matchAll(/<Tabs\.Screen name="([^"]+)" options=\{\{ title: '([^']+)'/g)].map((m) => [m[1], m[2]]);

describe('schede in basso', () => {
  it('sei schede come prima; al posto di «Spesa» c’è «Dispensa», nella stessa posizione', () => {
    expect(tabNames()).toEqual([
      ['index', 'Cani'],
      ['ricette', 'Ricette'],
      ['diario', 'Diario'],
      ['dispensa', 'Dispensa'],
      ['catalogo', 'Catalogo'],
      ['altro', 'Altro'],
    ]);
  });

  it('la scheda «Dispensa» è la pagina della dispensa e si apre sulle righe (prima della registrazione acquisti)', () => {
    expect(existsSync(join(app, '(tabs)/dispensa.tsx'))).toBe(true);
    expect(existsSync(join(app, 'dispensa.tsx'))).toBe(false); // niente doppione con lo stesso indirizzo
    const src = read('(tabs)/dispensa.tsx');
    const rows = src.indexOf('<Card title="In dispensa">');
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThan(src.indexOf('Registra acquisti'));
    expect(src.indexOf('placeholder="Cerca"')).toBeGreaterThan(rows);
    expect(src).toContain('Nessun prodotto trovato.');
    for (const action of ['Confezione finita', 'Consumata in parte', 'Ho finito di registrare gli acquisti', 'title="Storico"', 'Acquisti confermati']) {
      expect(src).toContain(action);
    }
  });
});

describe('Dispensa ⇄ Spesa e previsioni', () => {
  it('in cima alla Dispensa il pulsante «Spesa e previsioni» apre la pagina della spesa', () => {
    const src = read('(tabs)/dispensa.tsx');
    expect(SHOPPING_BUTTON).toBe('Spesa e previsioni');
    expect(SHOPPING_HREF).toBe('/spesa');
    const button = src.indexOf('router.push(SHOPPING_HREF)');
    expect(button).toBeGreaterThan(0);
    expect(button).toBeLessThan(src.indexOf('<Explain>'));
  });

  it('la pagina della spesa è la stessa di prima (previsioni, lista, righe libere), fuori dalle schede', () => {
    expect(existsSync(join(app, 'spesa.tsx'))).toBe(true);
    expect(existsSync(join(app, '(tabs)/spesa.tsx'))).toBe(false);
    const src = read('spesa.tsx');
    expect(src).toContain('shoppingForecast(');
    expect(src).toContain('<Card title="Periodo">');
    expect(src).toContain('backToPantry(router)');
    expect(read('_layout.tsx')).toContain(`<Stack.Screen name="spesa" options={{ title: 'Spesa e previsioni', headerBackTitle: 'Dispensa' }} />`);
  });

  it('«Torna alla dispensa»: un tocco torna indietro se si arriva dalla Dispensa', () => {
    const nav = { canGoBack: () => true, back: vi.fn(), navigate: vi.fn() };
    backToPantry(nav);
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('«Torna alla dispensa» funziona anche se la Spesa è aperta da sola: apre la scheda Dispensa', () => {
    const nav = { canGoBack: () => false, back: vi.fn(), navigate: vi.fn() };
    backToPantry(nav);
    expect(nav.back).not.toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith(PANTRY_HREF);
    expect(PANTRY_HREF).toBe('/dispensa');
    expect(BACK_TO_PANTRY_BUTTON).toBe('Torna alla dispensa');
  });
});
