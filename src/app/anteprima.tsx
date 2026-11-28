// Anteprima degli ingredienti delle giornate tipo: quali giornate e quante volte ciascuna.
// Stesso calcolo della Spesa (verdure cotte → crude, confronto con la dispensa, prezzi del catalogo), senza margine.
// Solo da guardare: non scrive nel diario, nella Spesa o nella Dispensa e non si salva.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { useData } from '../data/DataContext';
import {
  RECIPE_CATEGORY_LABELS,
  VEGETABLE_COOKING_YIELD,
  dayPreview,
  getCatalog,
  missingCount,
  type ShoppingItem,
} from '../engine';
import { Card, Explain, Hint, Notice, Screen } from '../ui/components';
import { formatEuro, formatGrams, formatNumber } from '../ui/format';
import { Stepper } from '../ui/Stepper';
import { colors } from '../ui/theme';

const catalog = getCatalog();
const SECTION_LABEL: Record<ShoppingItem['section'], string> = { ...RECIPE_CATEGORY_LABELS, integratori: 'Integratori' };
const YIELD = formatNumber(VEGETABLE_COOKING_YIELD.cooked_steamed ?? 0.9, 1);
const dayWord = (n: number) => (n === 1 ? 'giorno' : 'giorni');
const quantity = (it: Pick<ShoppingItem, 'unit'>, amount: number) =>
  it.unit === 'capsule' ? `${formatNumber(amount)} ${amount === 1 ? 'capsula' : 'capsule'}` : formatGrams(amount);

function SectionHead({ items, i }: { items: ShoppingItem[]; i: number }) {
  const it = items[i] as ShoppingItem;
  if (i > 0 && items[i - 1]!.section === it.section) return null;
  return <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 }}>{SECTION_LABEL[it.section]}</Text>;
}

export default function AnteprimaScreen() {
  const { data } = useData();
  const [times, setTimes] = useState<Record<string, number>>({});
  const plans = data.dayPlans;
  const preview = dayPreview(
    plans.map((p) => ({ planId: p.id, times: times[p.id] ?? 0 })),
    plans,
    data.dogs,
    data.recipes,
    catalog,
    data.prices,
    data.pantry,
  );
  const needed = new Map(preview.totalNeeded.items.map((it) => [it.key, it]));

  return (
    <Screen>
      <Explain>
        Scegli le giornate tipo e quante volte ciascuna: vedi gli ingredienti di ogni giornata e il totale, confrontato con la dispensa.
        È solo da guardare: non cambia il diario, la Spesa o la Dispensa e non si salva.
      </Explain>

      <Card title="Giornate e quante volte">
        {plans.length === 0 ? <Hint>Non hai ancora giornate tipo: creale nella scheda Cani.</Hint> : null}
        {plans.map((p) => {
          const missing = missingCount(p, data.dogs, data.recipes);
          return (
            <View key={p.id} style={{ gap: 6, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{p.name}</Text>
              {missing > 0 ? <Text style={{ fontSize: 13, color: colors.warningText }}>Ricetta mancante: quel cane non è contato.</Text> : null}
              <Stepper label={`volte ${p.name}`} value={times[p.id] ?? 0} onChange={(v) => setTimes((t) => ({ ...t, [p.id]: v }))} unit={(n) => dayWord(n)} />
            </View>
          );
        })}
        {plans.length > 0 ? (
          <Text style={{ fontSize: 15, color: colors.muted }}>
            In tutto: {preview.days} {dayWord(preview.days)}
          </Text>
        ) : null}
      </Card>

      {preview.perDay.map(({ plan, times: n, forecast, missing }) => (
        <Card key={plan.id} title={`${plan.name} · un giorno`}>
          <Hint>
            Tutti i cani insieme, per un giorno (scelta {n} {n === 1 ? 'volta' : 'volte'}).
          </Hint>
          {missing.map((m) => (
            <Notice key={m.dog.id} tone="warning">
              Ricetta mancante per {m.dog.name}: è stata eliminata, non è contata.
            </Notice>
          ))}
          {forecast.items.length === 0 ? <Hint>Nessuna ricetta in questa giornata.</Hint> : null}
          {forecast.items.map((it, i) => (
            <View key={it.key}>
              <SectionHead items={forecast.items} i={i} />
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{it.item.nameIt}</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{quantity(it, it.amount)}</Text>
              </View>
            </View>
          ))}
        </Card>
      ))}

      {preview.days > 0 ? (
        <Card title={`Totale di ${preview.days} ${dayWord(preview.days)}`}>
          {preview.total.items.length === 0 ? <Hint>Nessun ingrediente.</Hint> : null}
          {preview.total.items.map((it, i) => {
            const cost = needed.get(it.key)?.cost ?? null;
            return (
              <View key={it.key}>
                <SectionHead items={preview.total.items} i={i} />
                <View style={{ paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 2 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{it.item.nameIt}</Text>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{quantity(it, it.amount)}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: it.toBuy > 0 ? colors.text : colors.green }}>
                    Serve {quantity(it, it.amount)}, in dispensa {quantity(it, it.inPantry)},{' '}
                    {it.toBuy > 0 ? `ne manca ${quantity(it, it.toBuy)}` : 'non manca niente'}.
                  </Text>
                  {it.rawEstimate !== null && it.toBuy > 0 ? (
                    <Text style={{ fontSize: 13, color: colors.warningText }}>
                      Peso a cotto. Da comprare crudi circa {formatGrams(it.rawEstimate)} (stima: resa di cottura {YIELD}).
                    </Text>
                  ) : null}
                  {it.cookedNotConverted ? (
                    <Text style={{ fontSize: 13, color: colors.warningText }}>Peso a cotto: da comprare in base alla resa (non convertito).</Text>
                  ) : null}
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {cost !== null ? `prezzo previsto ${formatEuro(cost)}` : 'prezzo non inserito'}
                    {cost !== null && it.toBuy > 0 && it.cost !== null ? ` · da comprare ${formatEuro(it.cost)}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
          <View style={{ gap: 2, marginTop: 8 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
              Prezzo previsto: {formatEuro(preview.totalNeeded.total)}
              {preview.totalNeeded.incomplete ? ' — incompleto' : ''}
            </Text>
            <Text style={{ fontSize: 15, color: colors.text }}>
              Di cui da comprare (tolta la dispensa): {formatEuro(preview.total.total)}
              {preview.total.incomplete ? ' — incompleto' : ''}
            </Text>
            {preview.totalNeeded.incomplete ? <Hint>Mancano dei prezzi: si inseriscono nel Catalogo.</Hint> : null}
            <Hint>Stesso calcolo della Spesa, senza margine. Le verdure cotte da comprare crude sono una stima.</Hint>
          </View>
        </Card>
      ) : plans.length > 0 ? (
        <Hint>Scegli almeno una giornata con il +.</Hint>
      ) : null}
    </Screen>
  );
}
