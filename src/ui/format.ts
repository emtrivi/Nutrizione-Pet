// Numeri in formato italiano: virgola per i decimali, punto per le migliaia.

import { unitPrice, type PriceEntry, type Unit } from '../engine';

export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int = '0', dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return sign + (dec ? `${grouped},${dec}` : grouped);
}

/** Decimali scelti in base alla grandezza: 1.218 · 63,5 · 1,77 · 0,245 · 0,0123. */
export function formatSmart(value: number): string {
  const a = Math.abs(value);
  if (a === 0) return '0';
  let decimals: number;
  if (a >= 100) decimals = 0;
  else if (a >= 10) decimals = 1;
  else if (a >= 1) decimals = 2;
  else decimals = Math.min(6, 2 - Math.floor(Math.log10(a))); // sotto 1: tre cifre significative
  // Zeri finali inutili tolti: 60,0 → 60; 1,70 → 1,7.
  return formatNumber(value, decimals).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');
}

/** Unità come si scrivono in italiano (UI invece di IU). */
export function unitLabel(unit: Unit | string): string {
  return unit === 'IU' ? 'UI' : unit;
}

const SMALLER: Record<string, { unit: string; factor: number } | undefined> = {
  g: { unit: 'mg', factor: 1000 },
  mg: { unit: 'µg', factor: 1000 },
};

/** Valore con unità; i valori piccoli passano all'unità più piccola (0,0071 g → 7,1 mg). */
export function formatQuantity(value: number, unit: Unit | string): string {
  let v = value;
  let u: string = unit;
  while (v !== 0 && Math.abs(v) < 1 && SMALLER[u]) {
    const next = SMALLER[u]!;
    v *= next.factor;
    u = next.unit;
  }
  return `${formatSmart(v)} ${unitLabel(u)}`;
}

/** Valore nell'unità indicata, senza cambiarla (per confrontarsi con le tabelle FEDIAF). */
export function formatFixedUnit(value: number, unit: Unit | string): string {
  return `${formatSmart(value)} ${unitLabel(unit)}`;
}

export function formatEuro(value: number): string {
  return `${formatNumber(value, 2)} €`;
}

/** Descrizione del prezzo inserito. */
export function describePrice(entry: PriceEntry, doseUnit: 'g' | 'capsule'): string {
  switch (entry.mode) {
    case 'per_kg':
      return `${formatEuro(entry.eurPerKg)} al kg`;
    case 'per_package':
      return `${formatEuro(entry.packagePrice)} per ${formatSmart(entry.packageSize)} ${doseUnit === 'capsule' ? 'capsule' : 'g'}`;
    case 'per_unit':
      return `${formatEuro(entry.eurPerUnit)} a capsula`;
  }
}

/** Prezzo al chilo (o a capsula) di un prezzo inserito, es. "8,90 €/kg"; null se non valido. */
export function priceRateText(entry: PriceEntry | undefined, doseUnit: 'g' | 'capsule'): string | null {
  const p = entry ? unitPrice(entry, doseUnit) : null;
  if (p === null) return null;
  return doseUnit === 'capsule' ? `${formatEuro(p)} a capsula` : `${formatEuro(p * 1000)}/kg`;
}
