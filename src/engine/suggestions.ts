// Suggerimenti: per un nutriente in carenza, quali integratori del catalogo lo contengono e cosa
// cambierebbe aggiungendoli (anteprima). Non si aggiunge nulla da solo: decide l'utente.
// Sostituzione: cambia un alimento con un altro mantenendo le stesse calorie.

import type { Settings } from './backup';
import { UNDECLARED_NEGLIGIBLE, type Catalog, type CatalogItem } from './catalog';
import { suggestDose } from './dose';
import { NUTRIENTS } from './nutrients';
import type { PriceBook } from './prices';
import { evaluateRecipe, type EvaluateInput, type RecipeEvaluation } from './recipes';
import type { RawFediafFile } from './requirements';
import type { Color } from './status';

export interface ColorChange {
  id: string;
  name: string;
  before: Color;
  after: Color;
  beforeValue: number | null;
  afterValue: number | null;
}

export interface SupplementSuggestion {
  key: string;
  item: CatalogItem;
  dose: number;
  /** "produttore": la dose più bassa (o la fascia) del produttore; "minimo": la dose che porterebbe il nutriente al minimo. */
  doseSource: 'produttore' | 'minimo';
  target: ColorChange;
  /** Altri nutrienti (con riga FEDIAF) che cambiano colore. */
  others: ColorChange[];
  caP: { before: number | null; after: number | null; beforeColor: Color; afterColor: Color };
  after: RecipeEvaluation;
}

type Ctx = { catalog: Catalog; fediaf: RawFediafFile; settings: Settings; prices: PriceBook };

const roundUp = (x: number, step: number) => Math.ceil(x / step - 1e-9) * step;

function change(id: string, before: RecipeEvaluation, after: RecipeEvaluation): ColorChange {
  const b = before.nutrients[id]!;
  const a = after.nutrients[id]!;
  return {
    id,
    name: b.def.nameIt,
    before: b.evaluation.color,
    after: a.evaluation.color,
    beforeValue: b.evaluation.valuePer1000,
    afterValue: a.evaluation.valuePer1000,
  };
}

export function supplementSuggestions(input: EvaluateInput, nutrientId: string, ctx: Ctx): SupplementSuggestion[] {
  const before = evaluateRecipe(input, ctx);
  const view = before.nutrients[nutrientId];
  if (!view) return [];
  const present = new Set(input.lines.filter((l) => l.amount > 0).map((l) => l.key));
  const out: SupplementSuggestion[] = [];

  for (const item of ctx.catalog.supplements) {
    const n = item.nutrients[nutrientId];
    if (!n || !(n.value > 0) || n.status === UNDECLARED_NEGLIGIBLE || present.has(item.key)) continue;

    const s = suggestDose(item, input.dogWeightKg);
    let dose: number;
    let doseSource: SupplementSuggestion['doseSource'];
    if (s.kind === 'range') {
      dose = s.min;
      doseSource = 'produttore';
    } else if (s.kind === 'band') {
      dose = s.max;
      doseSource = 'produttore';
    } else {
      // Nessuna dose del produttore: quanto serve per arrivare al minimo del giorno.
      const minPerDay = view.req.perDay.min;
      if (minPerDay === null) continue;
      const missing = minPerDay - (view.total.value ?? 0);
      if (!(missing > 0)) continue;
      dose = item.integerDose ? Math.ceil(missing / n.value) : roundUp(missing / n.value, 0.5);
      doseSource = 'minimo';
    }
    if (!(dose > 0)) continue;

    const after = evaluateRecipe({ ...input, lines: [...input.lines, { key: item.key, amount: dose }] }, ctx);
    const others = NUTRIENTS.filter((d) => d.inFediaf && d.id !== nutrientId)
      .map((d) => change(d.id, before, after))
      .filter((c) => c.before !== c.after);
    out.push({
      key: item.key,
      item,
      dose,
      doseSource,
      target: change(nutrientId, before, after),
      others,
      caP: {
        before: before.caP.value,
        after: after.caP.value,
        beforeColor: before.caP.classification.color,
        afterColor: after.caP.classification.color,
      },
      after,
    });
  }
  return out;
}

/**
 * Sostituzione di un alimento: il nuovo prende le stesse calorie del vecchio (grammi arrotondati
 * al grammo). Se le calorie di uno dei due non sono note, i grammi restano uguali.
 */
export function substituteGrams(oldItem: CatalogItem, oldGrams: number, newItem: CatalogItem): { grams: number; sameKcal: boolean } {
  if (!oldItem.kcalPerUnit || !newItem.kcalPerUnit) return { grams: oldGrams, sameKcal: false };
  return { grams: Math.round((oldGrams * oldItem.kcalPerUnit) / newItem.kcalPerUnit), sameKcal: true };
}
