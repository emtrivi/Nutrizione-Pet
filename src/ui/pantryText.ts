// Frasi della dispensa e dello storico, in italiano semplice.

import { formatDay, purchaseChanges, type Catalog, type PantryHistoryEntry, type PurchaseLine } from '../engine';
import { formatGrams, formatNumber } from './format';

type Unit = 'g' | 'capsule';

export const qty = (n: number, unit: Unit) => (unit === 'capsule' ? `${formatNumber(n)} ${n === 1 ? 'capsula' : 'capsule'}` : formatGrams(n));
export const packagesText = (n: number) => `${formatNumber(n)} ${n === 1 ? 'confezione' : 'confezioni'}`;

const unitOf = (catalog: Catalog, key: string): Unit => catalog.get(key)?.doseUnit ?? 'g';
const nameOf = (catalog: Catalog, key: string) => catalog.get(key)?.nameIt ?? key;

/** "2 confezioni da 1 kg" oppure "partita sfusa di 10 kg". */
export function lineText(line: PurchaseLine, unit: Unit): string {
  return line.kind === 'confezioni' ? `${packagesText(line.packages)} da ${qty(line.packageSize, unit)}` : `partita sfusa di ${qty(line.grams, unit)}`;
}

const linesText = (lines: PurchaseLine[], unit: Unit) => (lines.length ? lines.map((l) => lineText(l, unit)).join(' + ') : 'niente');

/** Prodotti di un acquisto raggruppati: "Macinato: 2 confezioni da 1 kg + partita sfusa di 10 kg". */
export function purchaseByProduct(lines: PurchaseLine[], catalog: Catalog): string[] {
  const keys = [...new Set(lines.map((l) => l.key))];
  return keys.map((k) => `${nameOf(catalog, k)}: ${linesText(lines.filter((l) => l.key === k), unitOf(catalog, k))}`);
}

export const HISTORY_LABEL: Record<PantryHistoryEntry['type'], string> = {
  acquisto: 'Acquisto',
  modifica: 'Modifica',
  finita: 'Finita',
  consumo: 'Consumo parziale',
};

/** Frase di una voce dello storico. */
export function historyText(e: PantryHistoryEntry, catalog: Catalog): string {
  switch (e.type) {
    case 'acquisto': {
      const items = purchaseByProduct(e.lines, catalog).join('; ');
      const late = e.purchaseDay && e.purchaseDay !== e.day ? ` (registrato il ${formatDay(e.day)})` : '';
      return `Il ${formatDay(e.purchaseDay || e.day)} hai comprato: ${items}.${late}`;
    }
    case 'modifica': {
      const changes = purchaseChanges(e.before, e.after).map((c) => {
        const u = unitOf(catalog, c.key);
        return `${nameOf(catalog, c.key)}: prima ${linesText(c.before, u)}, ora ${linesText(c.after, u)}`;
      });
      const head = `Il ${formatDay(e.day)} hai corretto l’acquisto del ${formatDay(e.purchaseDay)}`;
      return changes.length ? `${head}: ${changes.join('; ')}.` : `${head} (cambiata la data).`;
    }
    case 'finita': {
      const u = unitOf(catalog, e.key);
      const what =
        e.lotKind === 'confezioni'
          ? `una confezione da ${qty(e.packageSize, u)}`
          : e.lotKind === 'partita'
            ? `la partita sfusa (${qty(e.amount, u)})`
            : `il resto (${qty(e.amount, u)})`;
      return `Il ${formatDay(e.day)} hai finito ${what} di ${nameOf(catalog, e.key)}.`;
    }
    case 'consumo': {
      const u = unitOf(catalog, e.key);
      const where = e.lotKind === 'confezioni' ? 'dalle confezioni' : e.lotKind === 'partita' ? 'dalla partita sfusa' : 'dal resto';
      return `Il ${formatDay(e.day)} hai consumato ${qty(e.consumed, u)} di ${nameOf(catalog, e.key)} ${where}: ne restano ${qty(e.remaining, u)}.`;
    }
  }
}
