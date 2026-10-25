// Integratori che contengono un nutriente in carenza, con l'anteprima di cosa cambierebbe.
// Non aggiunge nulla da solo: l'utente tocca "Aggiungi" se vuole.

import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { supplementSuggestions, type Color, type EvaluateInput, type NutrientDef } from '../../engine';
import { Badge, Button, Card, Hint } from '../components';
import { formatFixedUnit, formatNumber, formatSmart } from '../format';
import { colors } from '../theme';

const DOT: Record<Color, string> = { verde: colors.green, arancione: colors.orange, rosso: colors.red, grigio: colors.grey };

function Dot({ c }: { c: Color }) {
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DOT[c] }} />;
}

export function SuggestionsPanel({
  def,
  input,
  ctx,
  onAdd,
}: {
  def: NutrientDef;
  input: EvaluateInput;
  ctx: Parameters<typeof supplementSuggestions>[2];
  onAdd: (key: string, dose: number) => void;
}) {
  const list = useMemo(() => supplementSuggestions(input, def.id, ctx), [input, def.id, ctx]);
  return (
    <Card title="Integratori che lo contengono">
      <Hint>
        Anteprima: cosa cambierebbe aggiungendo l’integratore alla ricetta. Guarda anche gli altri nutrienti che cambiano
        colore. Decidi tu; la nutrizionista conferma.
      </Hint>
      {list.length === 0 ? <Hint>Nessun integratore del catalogo da aggiungere per questo nutriente.</Hint> : null}
      {list.map((s) => {
        const unit = s.item.doseUnit === 'capsule' ? (s.dose === 1 ? 'capsula' : 'capsule') : 'g';
        return (
          <View key={s.key} style={{ gap: 6, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{s.item.nameIt}</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {s.item.provisional ? <Badge text="dato provvisorio" tone="warning" /> : null}
              <Text style={{ fontSize: 13, color: colors.muted }}>
                {formatSmart(s.dose)} {unit} ·{' '}
                {s.doseSource === 'produttore' ? `dose del produttore per ${formatSmart(input.dogWeightKg)} kg` : `quanto servirebbe per arrivare al minimo (nessuna dose del produttore)`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Dot c={s.target.before} />
              <Text style={{ fontSize: 14, color: colors.text }}>
                {def.nameIt}: {s.target.beforeValue !== null ? formatFixedUnit(s.target.beforeValue, def.unit) : '—'} →{' '}
              </Text>
              <Dot c={s.target.after} />
              <Text style={{ fontSize: 14, color: colors.text }}>
                {s.target.afterValue !== null ? formatFixedUnit(s.target.afterValue, def.unit) : '—'}
              </Text>
            </View>
            {s.others.map((o) => (
              <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Dot c={o.before} />
                <Text style={{ fontSize: 13, color: colors.muted }}>{o.name} →</Text>
                <Dot c={o.after} />
                <Text style={{ fontSize: 13, color: colors.muted }}>{o.after === 'verde' ? 'migliora' : o.before === 'verde' ? 'peggiora' : 'cambia'}</Text>
              </View>
            ))}
            {s.caP.before !== s.caP.after ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Dot c={s.caP.beforeColor} />
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  Calcio/fosforo {s.caP.before !== null ? formatNumber(s.caP.before, 2) : '—'} →
                </Text>
                <Dot c={s.caP.afterColor} />
                <Text style={{ fontSize: 13, color: colors.muted }}>{s.caP.after !== null ? formatNumber(s.caP.after, 2) : '—'}</Text>
              </View>
            ) : null}
            <Button title={`Aggiungi alla ricetta (${formatSmart(s.dose)} ${unit})`} kind="secondary" onPress={() => onAdd(s.key, s.dose)} />
          </View>
        );
      })}
    </Card>
  );
}
