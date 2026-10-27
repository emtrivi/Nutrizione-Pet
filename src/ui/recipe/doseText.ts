// Testo della dose indicata dal produttore (passo 4 e scheda PDF).

import type { DoseSuggestion } from '../../engine';
import { formatSmart } from '../format';

export function describeDose(s: DoseSuggestion, dogWeight: number): string {
  if (s.kind === 'none') return s.reason;
  if (s.kind === 'band') return `Produttore, ${s.bandLabel}: ${formatSmart(s.max)} g al giorno${s.fromNoteOnly ? ' (valore scritto solo nella nota)' : ''}.`;
  const hm = s.householdMeasure ? ` (${formatSmart(s.householdMeasure.min)}–${formatSmart(s.householdMeasure.max)} ${s.householdMeasure.label})` : '';
  return `Produttore, per ${formatSmart(dogWeight)} kg: ${formatSmart(s.min)}–${formatSmart(s.max)} ${s.unit === 'capsule' ? 'capsule' : 'g'}${hm}${s.extrapolated ? ' — estrapolata' : ''}.`;
}
