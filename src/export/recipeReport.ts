// Scheda della ricetta da esportare in PDF e mandare alla nutrizionista: cane e calcolo delle calorie,
// ingredienti con grammi e prezzi, tutti i nutrienti con i limiti FEDIAF, rapporti.
// Solo testo HTML: il PDF lo crea expo-print (src/export/pdfIO.ts).

import {
  ACTIVITY_LABELS,
  RECIPE_CATEGORY_LABELS,
  shortName,
  unitPrice,
  type Catalog,
  type Color,
  type Dog,
  type DogEnergy,
  type FediafTable,
  type NutrientView,
  type PriceBook,
  type RecipeEvaluation,
  type RequirementOverride,
  type Settings,
} from '../engine';
import { describeDose } from '../ui/recipe/doseText';
import { formatEuro, formatFixedUnit, formatNumber, formatSmart, priceRateText, unitLabel } from '../ui/format';

export interface RecipeReportInput {
  recipeName: string;
  /** false se ci sono modifiche non ancora salvate. */
  saved: boolean;
  reviewReasons: string[];
  dog: Dog;
  energy: {
    dogEnergy: DogEnergy;
    kcalTarget: number;
    kcalFromDog: boolean;
    factorRounded: number;
    proposedTable: FediafTable;
    table: FediafTable;
  };
  ev: RecipeEvaluation;
  foods: { key: string; amount: number }[];
  supplements: { key: string; amount: number }[];
  overrides: Record<string, RequirementOverride>;
  prices: PriceBook;
  settings: Settings;
  catalog: Catalog;
  appVersion: string;
  now: Date;
}

const MCS_LABELS: Record<string, string> = {
  normale: 'Normale',
  perdita_lieve: 'Perdita lieve',
  perdita_moderata: 'Perdita moderata',
  perdita_grave: 'Perdita grave',
};
const COLOR_HEX: Record<Color, string> = { verde: '#2e7d32', arancione: '#e08600', rosso: '#c62828', grigio: '#9e9e9e' };
const COLOR_WORD: Record<Color, string> = { verde: 'verde', arancione: 'arancione', rosso: 'rosso', grigio: 'grigio' };
const CATEGORY_ORDER = ['proteica', 'energetica', 'verdure', 'grassi', 'frattaglie', 'altro'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const row = (label: string, value: string, note = '') =>
  `<tr><th>${esc(label)}</th><td>${esc(value)}</td><td class="note">${esc(note)}</td></tr>`;
const dot = (c: Color) => `<span class="dot" style="background:${COLOR_HEX[c]}"></span><span style="color:${COLOR_HEX[c]}">${COLOR_WORD[c]}</span>`;
const pct = (part: number, whole: number) => (whole > 0 ? `${formatNumber((part / whole) * 100, 1)}%` : '—');
const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ` +
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function dogSection(input: RecipeReportInput): string {
  const { dog, energy } = input;
  const e = energy.dogEnergy;
  const profile = [
    row('Nome', dog.name),
    dog.ageYears !== undefined ? row('Età', `${formatSmart(dog.ageYears)} anni`) : '',
    dog.breed ? row('Razza', dog.breed) : '',
    dog.size ? row('Taglia', dog.size) : '',
    row('Sterilizzato', dog.neutered ? 'Sì' : 'No'),
    row('Peso attuale', `${formatSmart(dog.weightKg)} kg`),
    row('Peso ideale stimato', dog.idealWeightKg !== undefined ? `${formatSmart(dog.idealWeightKg)} kg` : 'non indicato'),
    row('BCS (1-9)', dog.bcs !== undefined ? String(dog.bcs) : 'non indicato'),
    row('MCS (massa muscolare)', dog.mcs ? (MCS_LABELS[dog.mcs] ?? dog.mcs) : 'non indicato'),
    row('Attività', ACTIVITY_LABELS[dog.activity]),
    dog.notes ? row('Note', dog.notes) : '',
  ].join('');

  const mult =
    e.kcalSource === 'scritte_a_mano'
      ? row('Moltiplicatore', 'non usato', `kcal scritte a mano nel profilo (proposto per attività e sterilizzazione: ${formatSmart(e.proposedMultiplier)})`)
      : row(
          'Moltiplicatore',
          formatSmart(e.multiplier as number),
          e.multiplierSource === 'modificato' ? `scelto a mano (proposto: ${formatSmart(e.proposedMultiplier)})` : 'proposto per attività e sterilizzazione',
        );
  const calc = [
    row('Peso usato per le calorie', `${formatSmart(e.weightUsedKg)} kg`, e.weightSource === 'ideale' ? 'peso ideale' : 'peso attuale'),
    row('Peso metabolico', `${formatNumber(e.metabolicWeight, 3)} kg`, `${formatSmart(e.weightUsedKg)}^0,75`),
    row('RER (fabbisogno a riposo)', `${formatNumber(e.rer, 1)} kcal`, `70 × ${formatNumber(e.metabolicWeight, 3)}`),
    mult,
    row(
      'MER (fabbisogno al giorno del cane)',
      `${formatNumber(e.kcalPerDay, 1)} kcal`,
      e.kcalSource === 'scritte_a_mano' ? 'scritte a mano nel profilo' : `${formatNumber(e.rer, 1)} × ${formatSmart(e.multiplier as number)}`,
    ),
    row(
      'Fattore (kcal ÷ peso metabolico)',
      formatNumber(e.factorRounded),
      `${formatNumber(e.kcalPerDay, 1)} ÷ ${formatNumber(e.metabolicWeight, 3)} = ${formatNumber(e.factor, 2)}`,
    ),
    row('Tabella FEDIAF del cane', String(e.table), e.tableSource === 'scelta_a_mano' ? `scelta a mano (proposta ${e.proposedTable})` : 'proposta: 110 se il fattore arrotondato è almeno 110'),
    ...e.warnings.map((w) => row('Avviso', w)),
  ].join('');

  const recipeEnergy = [
    row(
      'Calorie obiettivo della ricetta',
      `${formatNumber(energy.kcalTarget, 1)} kcal`,
      energy.kcalFromDog ? 'quelle del cane (MER)' : 'scritte a mano per questa ricetta',
    ),
    row(
      'Tabella FEDIAF della ricetta',
      String(energy.table),
      energy.table === energy.proposedTable ? `proposta (fattore ${formatNumber(energy.factorRounded)})` : `scelta a mano (proposta ${energy.proposedTable})`,
    ),
  ].join('');

  return `<h2>Cane</h2><table class="kv">${profile}</table>
<h3>Calcolo delle calorie</h3><table class="kv">${calc}</table>
<h3>Calorie e tabella usate per questa ricetta</h3><table class="kv">${recipeEnergy}</table>`;
}

function ingredientsSection(input: RecipeReportInput): string {
  const { ev, catalog, prices } = input;
  const recipeKcal = ev.kcal.value ?? 0;
  const foods = [...input.foods].sort(
    (a, b) => CATEGORY_ORDER.indexOf(catalog.get(a.key)?.recipeCategory ?? 'altro') - CATEGORY_ORDER.indexOf(catalog.get(b.key)?.recipeCategory ?? 'altro'),
  );
  const cost = (key: string, amount: number, doseUnit: 'g' | 'capsule') => {
    const entry = prices[key];
    const p = entry ? unitPrice(entry, doseUnit) : null;
    return { line: p === null ? 'prezzo non inserito' : formatEuro(p * amount), rate: priceRateText(entry, doseUnit) ?? '—' };
  };
  let grams = 0;
  const foodRows = foods
    .map((l) => {
      const item = catalog.get(l.key);
      if (!item) return '';
      grams += l.amount;
      const kcal = item.kcalPerUnit !== null ? item.kcalPerUnit * l.amount : null;
      const c = cost(l.key, l.amount, 'g');
      const flags = [item.indicative ? 'dato indicativo' : '', item.processingLabel ?? ''].filter(Boolean).join(' · ');
      return `<tr><td>${esc(item.nameIt)}<div class="note">${esc(flags)}</div></td><td>${esc(RECIPE_CATEGORY_LABELS[item.recipeCategory])}</td>
<td class="n">${formatSmart(l.amount)} g</td><td class="n">${kcal !== null ? formatNumber(kcal, 1) : '—'}</td><td class="n">${kcal !== null ? pct(kcal, recipeKcal) : '—'}</td>
<td class="n">${esc(c.rate)}</td><td class="n">${esc(c.line)}</td></tr>`;
    })
    .join('');
  const suppRows = input.supplements
    .map((l) => {
      const item = catalog.get(l.key);
      if (!item) return '';
      const unit = item.doseUnit === 'capsule' ? (l.amount === 1 ? 'capsula' : 'capsule') : 'g';
      const s = ev.supplements.find((x) => x.key === l.key);
      const c = cost(l.key, l.amount, item.doseUnit);
      const kcal = item.kcalPerUnit !== null ? item.kcalPerUnit * l.amount : null;
      const notes = [
        item.provisional ? 'dato provvisorio' : '',
        s ? describeDose(s.suggestion, input.dog.weightKg) : '',
        s?.status === 'oltre_massimo_produttore' ? 'OLTRE il massimo del produttore (indicazione d’uso, non limite)' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      return `<tr><td>${esc(item.nameIt)}<div class="note">${esc(notes)}</div></td><td>Integratore</td>
<td class="n">${formatSmart(l.amount)} ${unit}</td><td class="n">${kcal !== null ? formatNumber(kcal, 1) : '—'}</td><td class="n">${kcal !== null ? pct(kcal, recipeKcal) : '—'}</td>
<td class="n">${esc(c.rate)}</td><td class="n">${esc(c.line)}</td></tr>`;
    })
    .join('');
  const total = `${formatEuro(ev.cost.total)}${ev.cost.incomplete ? ' (incompleto: mancano dei prezzi)' : ''}`;
  return `<h2>Ingredienti e prezzo</h2>
<table class="grid ing"><colgroup><col style="width:33%"><col style="width:14%"><col style="width:12%"><col style="width:9%"><col style="width:8%"><col style="width:11%"><col style="width:13%"></colgroup><thead><tr><th>Ingrediente</th><th>Sezione</th><th>Quantità</th><th>kcal</th><th>% kcal</th><th>Prezzo al kg</th><th>Prezzo</th></tr></thead>
<tbody>${foodRows}${suppRows}</tbody>
<tfoot><tr><th>Totale</th><td class="note">alimenti</td><td class="n">${formatSmart(grams)} g</td><td class="n">${ev.kcal.value !== null ? formatNumber(ev.kcal.value, 1) : '—'}</td><td class="n">100%</td><td></td><td class="n">${esc(total)}</td></tr></tfoot></table>
<p class="note">Peso nella ciotola come indicato (crudo o cotto). Prezzo al giorno della ricetta: ${esc(total)}.</p>`;
}

function limitsText(v: NutrientView): { min: string; max: string } {
  const u = v.def.unit;
  const l = v.evaluation.limitsPer1000;
  const kind = v.evaluation.maxKind === 'N' ? ' (N)' : v.evaluation.maxKind === 'L' ? ' (L, legge)' : v.evaluation.maxKind === 'modificato' ? ' (modificato)' : '';
  const minMod = v.req.modified && v.req.minPer1000 !== v.req.fediafMinPer1000 ? ' (modificato)' : v.req.digestibilityIncreaseApplied ? ' (+10%)' : '';
  return {
    min: l.min !== null ? `${formatFixedUnit(l.min, u)}${minMod}` : '—',
    max: l.max !== null ? `${formatFixedUnit(l.max, u)}${kind}` : '—',
  };
}

function nutrientNotes(v: NutrientView, catalog: Catalog): string {
  const name = (k: string) => {
    const item = catalog.get(k);
    return item ? shortName(item) : k;
  };
  const notes: string[] = [];
  if (v.total.value === null) notes.push('dato non disponibile negli ingredienti');
  else if (v.total.partial) notes.push(`valore parziale: manca in ${v.total.missingIn.map(name).join(', ')}`);
  if (v.total.toVerify) notes.push('un valore è da verificare');
  if (v.evaluation.legalMaxWarning) notes.push(v.evaluation.legalMaxWarning);
  if (!v.def.inFediaf) notes.push('solo informativo');
  if (v.evaluation.direction && v.evaluation.color !== 'verde' && v.evaluation.color !== 'grigio') {
    notes.push(`${v.evaluation.direction} del ${formatNumber(v.evaluation.distance * 100)}%`);
  }
  return notes.join(' · ');
}

function nutrientsSection(input: RecipeReportInput): string {
  const { ev, catalog } = input;
  const groups = ev.groups
    .map((g) => {
      const rows = g.items
        .map((v) => {
          const u = v.def.unit;
          const lim = limitsText(v);
          const almeno = v.total.partial && v.total.value !== null ? 'almeno ' : '';
          const day = v.total.value !== null ? `${almeno}${formatFixedUnit(v.total.value, u)}` : '—';
          const per1000 = v.evaluation.valuePer1000 !== null ? `${almeno}${formatFixedUnit(v.evaluation.valuePer1000, u)}` : '—';
          const minDay = v.req.perDay.min !== null ? formatFixedUnit(v.req.perDay.min, u) : '—';
          return `<tr><td>${esc(v.def.nameIt)}</td><td class="n">${esc(day)}</td><td class="n">${esc(minDay)}</td><td class="n">${esc(per1000)}</td>
<td class="n">${esc(lim.min)}</td><td class="n">${esc(lim.max)}</td><td>${dot(v.evaluation.color)}</td><td class="note">${esc(nutrientNotes(v, catalog))}</td></tr>`;
        })
        .join('');
      return `<h3>${esc(g.label)}</h3><table class="grid nut"><colgroup><col style="width:17%"><col style="width:12%"><col style="width:10%"><col style="width:12%"><col style="width:10%"><col style="width:11%"><col style="width:9%"><col style="width:19%"></colgroup><thead><tr><th>Nutriente</th><th>Nella ricetta al giorno</th><th>Minimo al giorno</th><th>Ogni 1.000 kcal</th><th>Minimo /1.000 kcal</th><th>Massimo /1.000 kcal</th><th>Colore</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');
  return `<h2>Nutrienti</h2>
<p class="note">Confronto ogni 1.000 kcal della ricetta con la tabella FEDIAF ${ev.requirements.table} (cane adulto). Verde: nei limiti; arancione: fuori fino al ${formatNumber(input.settings.tolerance * 100)}%; rosso: oltre; grigio: dato mancante o nessun riferimento. «Almeno»: il dato manca in qualche ingrediente. N = massimo nutrizionale, L = massimo di legge (per sostanza secca, convertito).</p>
${groups}`;
}

function ratiosSection(input: RecipeReportInput): string {
  const { ev } = input;
  const opt = (t: { value: number | null; partial: boolean }, u: string) =>
    t.value !== null ? `${t.partial ? 'almeno ' : ''}${formatFixedUnit(t.value, u)}` : 'non disponibile';
  const split = ev.energySplit;
  return `<h2>Rapporti</h2><table class="kv">
${row('Calcio / fosforo', ev.caP.value !== null ? `${ev.caP.partial ? 'almeno ' : ''}${formatNumber(ev.caP.value, 2)} : 1` : 'non disponibile', `FEDIAF da ${formatSmart(ev.requirements.caPRatio.min)}:1 a ${formatSmart(ev.requirements.caPRatio.max)}:1 — ${COLOR_WORD[ev.caP.classification.color]}`)}
${row('Acido linoleico (omega-6)', opt(ev.omega.linoleic, 'g'))}
${row('Acido alfa-linolenico (omega-3)', opt(ev.omega.alphaLinolenic, 'g'))}
${row('EPA + DHA (omega-3)', opt(ev.omega.epaDha, 'g'))}
${row('Omega-6 / omega-3', ev.omega.ratio !== null ? `${formatNumber(ev.omega.ratio, 1)} : 1` : '—', `solo informativo, FEDIAF non dà un limite${ev.omega.partial ? '; valore parziale' : ''}`)}
${split ? row('Calorie da proteine / grassi / carboidrati', `${formatNumber(split.protein)}% / ${formatNumber(split.fat)}% / ${formatNumber(split.carbohydrate)}%`, `informativo, calcolo 4/9/4${split.partial ? '; valore parziale' : ''}`) : ''}
${row('Sostanza secca', ev.totals.dryMatterG.value !== null ? `${ev.totals.dryMatterG.partial ? 'almeno ' : ''}${formatNumber(ev.totals.dryMatterG.value, 1)} g` : 'non disponibile')}
</table>`;
}

function settingsSection(input: RecipeReportInput): string {
  const { overrides, settings, ev } = input;
  const mods = Object.entries(overrides)
    .filter(([, o]) => o.min !== undefined || o.max !== undefined)
    .map(([id, o]) => {
      const v = ev.nutrients[id];
      const u = v?.def.unit ?? '';
      const parts = [
        o.min !== undefined ? `minimo ${o.min === null ? 'nessuno' : `${formatSmart(o.min)} ${unitLabel(u)}`}` : '',
        o.max !== undefined ? `massimo ${o.max === null ? 'nessuno' : `${formatSmart(o.max)} ${unitLabel(u)}`}` : '',
      ].filter(Boolean);
      return row(v?.def.nameIt ?? id, `${parts.join(', ')} ogni 1.000 kcal`, 'modificato a mano in questa ricetta');
    })
    .join('');
  return `<h2>Impostazioni usate</h2><table class="kv">
${row('Zona arancione', `fino al ${formatNumber(settings.tolerance * 100)}% fuori dal limite`)}
${row('Aumento del 10% degli aminoacidi', settings.aminoAcidDigestibilityIncrease ? 'acceso' : 'spento')}
${row('Massimo di legge (L) su alimenti naturali', settings.legalMaxNaturalMode === 'avviso' ? 'solo avviso' : 'rosso')}
${mods || row('Fabbisogni modificati', 'nessuno: valori FEDIAF')}
</table>`;
}

/** Pagina HTML completa della scheda. */
export function recipeReportHtml(input: RecipeReportInput): string {
  const { ev } = input;
  const s = ev.summary;
  const kcalLine =
    ev.kcal.value !== null
      ? `${formatNumber(ev.kcal.value, 1)} kcal su ${formatNumber(ev.kcal.target, 1)} (${ev.kcal.diffPct !== null ? `${ev.kcal.diffPct >= 0 ? '+' : ''}${formatNumber(ev.kcal.diffPct, 1)}%` : '—'})`
      : 'kcal sconosciute';
  const warnings = [
    !input.saved ? 'Ricetta con modifiche non salvate: la scheda mostra i valori sullo schermo al momento dell’esportazione.' : '',
    ...input.reviewReasons.map((r) => `Da rivedere: ${r}`),
    ...ev.sanity.map((w) => `${w} (avviso, non blocca)`),
  ].filter(Boolean);
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(input.recipeName)}</title><style>
@page { size: A4; margin: 14mm 12mm; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 10pt; color: #1d1d1f; }
h1 { font-size: 18pt; margin: 0 0 2mm; } h2 { font-size: 13pt; margin: 6mm 0 2mm; border-bottom: 1px solid #ccc; padding-bottom: 1mm; }
h3 { font-size: 11pt; margin: 4mm 0 1mm; }
table { border-collapse: collapse; width: 100%; } .grid { table-layout: fixed; } .grid td, .grid th { overflow-wrap: break-word; } th, td { text-align: left; vertical-align: top; padding: 1.2mm 1.5mm; }
.kv th { width: 34%; font-weight: 600; } .kv td { width: 26%; } .kv tr, .grid tr { border-bottom: 0.5px solid #e2e2e2; }
.grid thead th { background: #f1f3f1; font-size: 8.5pt; } .grid tfoot { border-top: 1px solid #999; font-weight: 600; }
.n { text-align: right; white-space: nowrap; } .ing .n { white-space: normal; } .note { color: #6b6b6b; font-size: 8.5pt; }
.nut td { font-size: 8.5pt; padding: 0.8mm 1mm; } .nut .note { font-size: 7.5pt; } .dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 3px; }
.disclaimer { background: #fff4e0; color: #7a4a00; padding: 2mm 3mm; border-radius: 2mm; margin: 2mm 0; }
.warn { color: #9a5b00; } tr { page-break-inside: avoid; }
</style></head><body>
<h1>${esc(input.recipeName)}</h1>
<div class="note">Ricetta per ${esc(input.dog.name)} · esportata il ${fmtDate(input.now)} · Nutrizione Pet ${esc(input.appVersion)} · ${esc(input.catalog.version.label)}</div>
<div class="disclaimer">Strumento di supporto, da validare con la nutrizionista.</div>
<h2>Riepilogo</h2><table class="kv">
${row('Calorie della ricetta', kcalLine, `colore ${COLOR_WORD[ev.kcal.color]}: verde entro ±5%, arancione entro ±10%`)}
${row('Nutrienti FEDIAF', `${s.verde} verdi, ${s.arancione} arancioni, ${s.rosso} rossi, ${s.grigio} grigi`)}
${row('Prezzo al giorno', `${formatEuro(ev.cost.total)}${ev.cost.incomplete ? ' (incompleto)' : ''}`)}
${row('Tabella FEDIAF', String(ev.requirements.table))}
</table>
${warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')}
${dogSection(input)}
${ingredientsSection(input)}
${nutrientsSection(input)}
${ratiosSection(input)}
${settingsSection(input)}
<p class="disclaimer">Strumento di supporto, da validare con la nutrizionista. Valori calcolati dai cataloghi dell’app (${esc(input.catalog.version.label)}); un dato mancante non è zero.</p>
</body></html>`;
}
