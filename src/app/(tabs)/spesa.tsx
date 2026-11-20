// Spesa: previsione dei grammi da comprare per i prossimi giorni, sommando i cani.
// Separata dal diario e senza toccarlo: si indicano ricette e giorni per ogni cane.

import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { parseDecimal } from '../../data/dogForm';
import { generateId, withShopping } from '../../data/personalStore';
import {
  RECIPE_CATEGORY_LABELS,
  VEGETABLE_COOKING_YIELD,
  getCatalog,
  shoppingForecast,
  unitPrice,
  type ShoppingData,
  type ShoppingItem,
} from '../../engine';
import { Button, Card, Explain, Field, Hint, Notice, Screen, styles } from '../../ui/components';
import { formatEuro, formatGrams, formatNumber, formatSmart, priceRateText } from '../../ui/format';
import { colors } from '../../ui/theme';

const catalog = getCatalog();
const SECTION_LABEL: Record<ShoppingItem['section'], string> = { ...RECIPE_CATEGORY_LABELS, integratori: 'Integratori' };
const YIELD = formatNumber(VEGETABLE_COOKING_YIELD.cooked_steamed ?? 0.9, 1);

function quantity(item: ShoppingItem, amount: number): string {
  return item.unit === 'capsule' ? `${formatNumber(amount)} ${amount === 1 ? 'capsula' : 'capsule'}` : formatGrams(amount);
}

/** Numero intero con − e + (giorni). */
function DaysStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [text, setText] = useState<string | null>(null);
  const commit = (t: string) => {
    const v = parseDecimal(t);
    if (typeof v === 'number') onChange(Math.min(366, Math.round(v)));
    setText(null);
  };
  const btn = { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Meno giorni ${label}`} onPress={() => onChange(Math.max(0, value - 1))} style={btn}>
        <Text style={{ fontSize: 20, color: colors.primary }}>−</Text>
      </Pressable>
      <TextInput
        value={text ?? String(value)}
        onChangeText={setText}
        onEndEditing={(e) => commit(e.nativeEvent.text)}
        onBlur={() => text !== null && commit(text)}
        keyboardType="number-pad"
        accessibilityLabel={`Giorni ${label}`}
        style={[styles.input, { width: 56, textAlign: 'center', paddingVertical: 4 }]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={`Più giorni ${label}`} onPress={() => onChange(Math.min(366, value + 1))} style={btn}>
        <Text style={{ fontSize: 20, color: colors.primary }}>+</Text>
      </Pressable>
      <Text style={{ fontSize: 14, color: colors.muted }}>giorni</Text>
    </View>
  );
}

export default function SpesaScreen() {
  const { data, update } = useData();
  const s = data.shopping;
  const [picking, setPicking] = useState<string | null>(null);
  const [extra, setExtra] = useState({ name: '', quantity: '', price: '' });
  const [extraError, setExtraError] = useState<string | null>(null);
  // Testi in modifica; senza modifiche si mostrano i valori salvati (che arrivano dopo l'avvio).
  const [edit, setEdit] = useState<{ days?: string; margin?: string }>({});
  const period = { days: edit.days ?? String(s.horizonDays), margin: edit.margin ?? formatSmart(s.marginPct) };

  const save = (next: Partial<ShoppingData>) => update((d) => withShopping(d, { ...d.shopping, ...next }));
  const forecast = shoppingForecast(s, data.recipes, catalog, data.prices, data.pantry);

  const commitPeriod = (field: 'days' | 'margin', text: string) => {
    const v = parseDecimal(text);
    if (field === 'days' && typeof v === 'number' && v >= 1 && v <= 366) save({ horizonDays: Math.round(v) });
    else if (field === 'margin' && (v === undefined || (typeof v === 'number' && v <= 100))) save({ marginPct: v ?? 0 });
    setEdit({});
  };

  const addExtra = () => {
    const price = parseDecimal(extra.price);
    if (!extra.name.trim()) return setExtraError('Scrivi cosa comprare.');
    if (price === 'invalid') return setExtraError('Prezzo: scrivi un numero, per esempio 3,50, oppure lascialo vuoto.');
    save({ extras: [...s.extras, { id: generateId(), name: extra.name.trim(), quantity: extra.quantity.trim(), price: price ?? null }] });
    setExtra({ name: '', quantity: '', price: '' });
    setExtraError(null);
  };

  const pickingDog = data.dogs.find((d) => d.id === picking);

  return (
    <Screen>
      <Explain>
        Previsione della spesa: per ogni cane scegli le ricette e per quanti giorni. L’app somma i grammi di tutti i cani, toglie
        quello che hai in dispensa e mostra i prezzi del catalogo. Non tocca il diario.
      </Explain>
      <Button title="Apri la dispensa" kind="secondary" onPress={() => router.push('/dispensa')} />

      <Card title="Periodo">
        <Field
          label="Giorni della previsione"
          value={period.days}
          onChangeText={(t) => setEdit((p) => ({ ...p, days: t }))}
          keyboardType="number-pad"
          hint="Serve a controllare che ogni cane abbia tutti i giorni coperti (all’inizio 30)."
        />
        <Field
          label="Margine in più sulle quantità (%)"
          value={period.margin}
          onChangeText={(t) => setEdit((p) => ({ ...p, margin: t }))}
          keyboardType="decimal-pad"
          hint="Facoltativo, per esempio 5 per avere un po’ di scorta. Vale per gli ingredienti delle ricette."
        />
        <Button
          title="Aggiorna periodo e margine"
          kind="secondary"
          onPress={() => {
            commitPeriod('days', period.days);
            commitPeriod('margin', period.margin);
          }}
        />
      </Card>

      {data.dogs.length === 0 ? (
        <Card>
          <Hint>Prima aggiungi un cane e una ricetta.</Hint>
        </Card>
      ) : null}

      {data.dogs.map((dog) => {
        const plans = s.plans.filter((p) => p.dogId === dog.id);
        const days = plans.reduce((a, p) => a + p.days, 0);
        return (
          <Card key={dog.id} title={dog.name}>
            {plans.length === 0 ? <Hint>Nessuna ricetta scelta.</Hint> : null}
            {plans.map((p) => {
              const r = data.recipes.find((x) => x.id === p.recipeId);
              return (
                <View key={p.id} style={{ gap: 6, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: r ? colors.text : colors.danger }}>
                      {r ? r.name : 'Ricetta eliminata (non contata)'}
                    </Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Togli ${r?.name ?? 'ricetta'}`} onPress={() => save({ plans: s.plans.filter((x) => x.id !== p.id) })}>
                      <Text style={{ color: colors.danger }}>Togli</Text>
                    </Pressable>
                  </View>
                  <DaysStepper
                    label={r?.name ?? ''}
                    value={p.days}
                    onChange={(v) => save({ plans: s.plans.map((x) => (x.id === p.id ? { ...x, days: v } : x)) })}
                  />
                </View>
              );
            })}
            <Text style={{ fontSize: 14, color: days === s.horizonDays ? colors.muted : colors.warningText }}>
              {days} di {s.horizonDays} giorni
              {days < s.horizonDays ? ` · mancano ${s.horizonDays - days} giorni` : days > s.horizonDays ? ` · ${days - s.horizonDays} giorni in più` : ''}
            </Text>
            <Button title="Aggiungi una ricetta" kind="secondary" onPress={() => setPicking(dog.id)} />
          </Card>
        );
      })}

      <Card title="Lista della spesa">
        {forecast.items.length === 0 ? <Hint>Scegli almeno una ricetta con dei giorni.</Hint> : null}
        {forecast.missingRecipes.length > 0 ? <Notice tone="warning">Alcune righe hanno una ricetta eliminata: non sono contate.</Notice> : null}
        {forecast.items.map((it, i) => {
          const head = i === 0 || forecast.items[i - 1]!.section !== it.section ? SECTION_LABEL[it.section] : null;
          const entry = data.prices[it.key];
          const rate = priceRateText(entry, it.unit);
          const p = entry ? unitPrice(entry, it.unit) : null;
          return (
            <View key={it.key} style={{ gap: 2 }}>
              {head ? <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 }}>{head}</Text> : null}
              <View style={{ paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 2 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{it.item.nameIt}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: it.toBuy > 0 ? colors.text : colors.green }}>
                    {it.toBuy > 0 ? quantity(it, it.toBuy) : 'c’è già'}
                  </Text>
                </View>
                {it.inPantry > 0 ? (
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    Servono {quantity(it, it.amount)}, in dispensa {quantity(it, it.inPantry)}
                    {it.toBuy > 0 ? `: da comprare ${quantity(it, it.toBuy)}` : ': basta'}.
                  </Text>
                ) : null}
                {it.rawEstimate !== null && it.toBuy > 0 ? (
                  <Text style={{ fontSize: 13, color: colors.warningText }}>
                    Peso a cotto. Da comprare crudi circa {formatGrams(it.rawEstimate)} (stima: resa di cottura {YIELD}).
                  </Text>
                ) : null}
                {it.cookedNotConverted ? (
                  <Text style={{ fontSize: 13, color: colors.warningText }}>Peso a cotto: da comprare in base alla resa (non convertito).</Text>
                ) : null}
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {s.marginPct > 0 ? `nella ciotola ${quantity(it, it.bowlAmount)} + ${formatSmart(s.marginPct)}% · ` : ''}
                  {it.cost !== null && p !== null ? `${formatEuro(it.cost)}${rate ? ` (${rate})` : ''}` : 'prezzo non inserito'}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>

      <Card title="Altre cose da comprare">
        <Hint>Righe libere, fuori dalle ricette (per esempio sacchetti, ossa da masticare).</Hint>
        {s.extras.map((x) => (
          <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: colors.text }}>{x.name}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {[x.quantity, x.price !== null ? formatEuro(x.price) : 'prezzo non inserito'].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Togli ${x.name}`} onPress={() => save({ extras: s.extras.filter((e) => e.id !== x.id) })}>
              <Text style={{ color: colors.danger }}>Togli</Text>
            </Pressable>
          </View>
        ))}
        <Field label="Cosa" value={extra.name} onChangeText={(t) => setExtra((e) => ({ ...e, name: t }))} placeholder="es. Sacchetti gelo" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="Quantità (facoltativa)" value={extra.quantity} onChangeText={(t) => setExtra((e) => ({ ...e, quantity: t }))} placeholder="es. 1 rotolo" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Prezzo € (facoltativo)" value={extra.price} onChangeText={(t) => setExtra((e) => ({ ...e, price: t }))} keyboardType="decimal-pad" />
          </View>
        </View>
        {extraError ? <Notice tone="danger">{extraError}</Notice> : null}
        <Button title="Aggiungi alla lista" kind="secondary" onPress={addExtra} />
      </Card>

      <Card title="Totale previsto">
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
          {forecast.total === 0 && forecast.incomplete ? 'nessun prezzo inserito' : `${formatEuro(forecast.total)}${forecast.incomplete ? ' — incompleto' : ''}`}
        </Text>
        {forecast.incomplete ? <Hint>Mancano dei prezzi: si inseriscono nel Catalogo (o nelle righe libere).</Hint> : null}
        <Hint>
          Prezzi del catalogo per quello da comprare (previsione con il margine meno la dispensa) e per le righe libere. Le verdure cotte
          da comprare crude sono una stima.
        </Hint>
      </Card>

      <Modal visible={picking !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(null)}>
        <View style={[styles.screen, { padding: 16, gap: 10 }]}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Ricetta per {pickingDog?.name}</Text>
          {data.recipes.filter((r) => r.dogId === picking).length === 0 ? <Hint>Questo cane non ha ricette salvate.</Hint> : null}
          {data.recipes
            .filter((r) => r.dogId === picking)
            .map((r) => (
              <Button
                key={r.id}
                title={r.name}
                kind="secondary"
                onPress={() => {
                  const used = s.plans.filter((p) => p.dogId === picking).reduce((a, p) => a + p.days, 0);
                  save({ plans: [...s.plans, { id: generateId(), dogId: picking as string, recipeId: r.id, days: Math.max(0, s.horizonDays - used) }] });
                  setPicking(null);
                }}
              />
            ))}
          <Button title="Annulla" kind="secondary" onPress={() => setPicking(null)} />
        </View>
      </Modal>
    </Screen>
  );
}
