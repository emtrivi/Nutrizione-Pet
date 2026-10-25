// Geometria delle barre: tratti uguali (non in scala reale) e posizione della freccia.
// Minimo e massimo: rosso | arancione | verde | arancione | rosso.
// Solo minimo: rosso | arancione | verde.  Solo massimo: verde | arancione | rosso.
// La freccia sta nel tratto giusto, in posizione proporzionale dentro quel tratto.

import { DEFAULT_TOLERANCE, type Limits } from './status';

export type SegmentColor = 'rosso' | 'arancione' | 'verde';

export interface BarGeometry {
  segments: SegmentColor[];
  /** Posizione della freccia da 0 (inizio) a 1 (fine); null = barra grigia senza freccia. */
  position: number | null;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Dove cade il valore: indice del tratto e frazione dentro il tratto. */
function place(
  edges: number[],
  value: number,
  last: number,
  greenIndex: number,
): { index: number; fraction: number } {
  // edges: limiti interni crescenti; il primo tratto parte da 0, l'ultimo finisce a "last".
  // Il verde include entrambi gli estremi (sul minimo o sul massimo il valore è verde).
  const bounds = [0, ...edges, last];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i] as number;
    const b = bounds[i + 1] as number;
    const isLast = i === bounds.length - 2;
    if (value < b || (value === b && i === greenIndex) || isLast) {
      return { index: i, fraction: b > a ? clamp01((value - a) / (b - a)) : 1 };
    }
  }
  return { index: bounds.length - 2, fraction: 1 };
}

export function barGeometry(value: number | null, limits: Limits, tolerance = DEFAULT_TOLERANCE): BarGeometry {
  const { min, max } = limits;
  if (min === null && max === null) return { segments: [], position: null };

  let segments: SegmentColor[];
  let edges: number[];
  let last: number;
  if (min !== null && max !== null) {
    segments = ['rosso', 'arancione', 'verde', 'arancione', 'rosso'];
    edges = [min * (1 - tolerance), min, max, max * (1 + tolerance)];
    last = max * (1 + tolerance) * 2; // l'ultimo tratto rosso arriva fino al doppio
  } else if (min !== null) {
    segments = ['rosso', 'arancione', 'verde'];
    edges = [min * (1 - tolerance), min];
    last = min * 2; // il verde si riempie fino al doppio del minimo
  } else {
    const m = max as number;
    segments = ['verde', 'arancione', 'rosso'];
    edges = [m, m * (1 + tolerance)];
    last = m * (1 + tolerance) * 2;
  }
  if (value === null) return { segments, position: null };
  const p = place(edges, Math.max(0, value), last, segments.indexOf('verde'));
  return { segments, position: (p.index + p.fraction) / segments.length };
}
