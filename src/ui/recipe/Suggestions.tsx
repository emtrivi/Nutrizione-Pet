// Integratori che contengono un nutriente in carenza, con l'anteprima di cosa cambierebbe.
// Poi gli alimenti del catalogo più ricchi di quel nutriente.
// Non aggiunge nulla da solo: l'utente tocca "Aggiungi" se vuole.

import { useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  foodSuggestions,
  RECIPE_CATEGORY_LABELS,
  FOOD_SUGGESTION_COUNT,
  supplementSuggestions,
  type Color,
  type ColorChange,
  type EvaluateInput,
  type NutrientDef,
  type SupplementSuggestion,
} from '../../engine';
import { Badge, Button, Card, Hint } from '../components';
import { formatFixedUnit, formatNumber, formatSmart } from '../format';
import { colors } from '../theme';

const DOT: Record<Color, string> = {
  verde: colors.green,
  arancione: colors.orange,
  rosso: colors.red,
  grigio: colors.grey,
};

function Dot({ c }: { c: Color }) {
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: DOT[c],
      }}
    />
  );
}

/** Nutriente prima → dopo, altri nutrienti che cambiano colore, calcio/fosforo. */
function Preview({ def, target, others, caP }: { def: NutrientDef; target: ColorChange; others: ColorChange[]; caP: SupplementSuggestion['caP'] }) {
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Dot c={target.before} />
        <Text style={{ fontSize: 14, color: colors.text }}>
          {def.nameIt}: {target.beforeValue !== null ? formatFixedUnit(target.beforeValue, def.unit) : '—'} →{' '}
        </Text>
        <Dot c={target.after} />
        <Text style={{ fontSize: 14, color: colors.text }}>{target.afterValue !== null ? formatFixedUnit(target.afterValue, def.unit) : '—'}</Text>
      </View>
      {others.map((o) => (
        <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Dot c={o.before} />
          <Text style={{ fontSize: 13, color: colors.muted }}>{o.name} →</Text>
          <Dot c={o.after} />
          <Text style={{ fontSize: 13, color: colors.muted }}>{o.after === 'verde' ? 'migliora' : o.before === 'verde' ? 'peggiora' : 'cambia'}</Text>
        </View>
      ))}
      {caP.beforeColor !== caP.afterColor ||
      (caP.before !== null && caP.after !== null && formatNumber(caP.before, 2) !== formatNumber(caP.after, 2)) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Dot c={caP.beforeColor} />
          <Text style={{ fontSize: 13, color: colors.muted }}>Calcio/fosforo {caP.before !== null ? formatNumber(caP.before, 2) : '—'} →</Text>
          <Dot c={caP.afterColor} />
          <Text style={{ fontSize: 13, color: colors.muted }}>{caP.after !== null ? formatNumber(caP.after, 2) : '—'}</Text>
        </View>
      ) : null}
    </>
  );
}

export function SuggestionsPanel({
  def,
  input,
  ctx,
  onAdd,
  onAddFood,
}: {
  def: NutrientDef;
  input: EvaluateInput;
  ctx: Parameters<typeof supplementSuggestions>[2];
  onAdd: (key: string, dose: number) => void;
  onAddFood: (key: string, grams: number) => void;
}) {
  const list = useMemo(() => supplementSuggestions(input, def.id, ctx), [input, def.id, ctx]);
  const foods = useMemo(() => foodSuggestions(input, def.id, ctx), [input, def.id, ctx]);
  return (
    <>
      <Card title="Integratori che lo contengono">
        <Hint>
          Anteprima: cosa cambierebbe aggiungendo l’integratore alla ricetta. Guarda anche gli altri nutrienti che cambiano colore. Decidi tu; la
          nutrizionista conferma.
        </Hint>
        {list.length === 0 ? <Hint>Nessun integratore del catalogo da aggiungere per questo nutriente.</Hint> : null}
        {list.map((s) => {
          const unit = s.item.doseUnit === 'capsule' ? (s.dose === 1 ? 'capsula' : 'capsule') : 'g';
          return (
            <View
              key={s.key}
              style={{
                gap: 6,
                paddingVertical: 8,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{s.item.nameIt}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {s.item.provisional ? <Badge text="dato provvisorio" tone="warning" /> : null}
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {formatSmart(s.dose)} {unit} ·{' '}
                  {s.doseSource === 'produttore'
                    ? `dose del produttore per ${formatSmart(input.dogWeightKg)} kg`
                    : `quanto servirebbe per arrivare al minimo (nessuna dose del produttore)`}
                </Text>
              </View>
              <Preview def={def} target={s.target} others={s.others} caP={s.caP} />
              <Button title={`Aggiungi alla ricetta (${formatSmart(s.dose)} ${unit})`} kind="secondary" onPress={() => onAdd(s.key, s.dose)} />
            </View>
          );
        })}
      </Card>
      <Card title="Alimenti che lo contengono">
        <Hint>
          I {FOOD_SUGGESTION_COUNT} alimenti del catalogo più ricchi di questo nutriente (per 100 g). I grammi sono quelli che lo portano al minimo,
          contando anche le calorie che l’alimento aggiunge: dopo puoi ridurre gli altri alimenti. Decidi tu; la nutrizionista conferma.
        </Hint>
        {foods.length === 0 ? <Hint>Nessun alimento del catalogo da aggiungere per questo nutriente.</Hint> : null}
        {foods.map((f) => (
          <View key={f.key} style={{ gap: 6, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{f.item.nameIt}</Text>
            {f.sameAs.length > 0 ? (
              <Text style={{ fontSize: 13, color: colors.muted }}>Stessi valori anche: {f.sameAs.map((x) => x.nameIt).join(', ')}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {f.item.indicative ? <Badge text="dato indicativo" tone="warning" /> : null}
              <Text style={{ fontSize: 13, color: colors.muted }}>
                {RECIPE_CATEGORY_LABELS[f.item.recipeCategory]} · {formatFixedUnit(f.item.nutrients[def.id]!.value * 100, def.unit)} ogni 100 g
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: f.reachesMin ? colors.muted : colors.orange }}>
              {f.reachesMin
                ? `${formatSmart(f.grams)} g per arrivare al minimo`
                : `Da solo non basta ad arrivare al minimo (porta molte calorie rispetto al nutriente): ecco l’effetto di ${formatSmart(f.grams)} g`}
            </Text>
            <Preview def={def} target={f.target} others={f.others} caP={f.caP} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Dot c={f.kcal.beforeColor} />
              <Text style={{ fontSize: 13, color: colors.muted }}>Calorie {f.kcal.before !== null ? formatNumber(f.kcal.before) : '—'} →</Text>
              <Dot c={f.kcal.afterColor} />
              <Text style={{ fontSize: 13, color: colors.muted }}>{f.kcal.after !== null ? `${formatNumber(f.kcal.after)} kcal` : '—'}</Text>
            </View>
            <Button title={`Aggiungi alla ricetta (${formatSmart(f.grams)} g)`} kind="secondary" onPress={() => onAddFood(f.key, f.grams)} />
          </View>
        ))}
      </Card>
    </>
  );
}
