// Giornata tipo: nome e, per ogni cane, una ricetta salvata di quel cane (o nessuna).
// Ogni scelta si salva subito. La giornata guarda sempre la versione attuale delle ricette.

import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { generateId, withDayPlans } from '../../data/personalStore';
import {
  dayPlanRows,
  duplicateDayPlan,
  removeDayPlan,
  renameDayPlan,
  setDayPlanRecipe,
  upsertDayPlan,
  type DayPlan,
  type Recipe,
} from '../../engine';
import { Button, Card, Explain, Field, Hint, Notice, Screen } from '../../ui/components';
import { colors } from '../../ui/theme';

function confirmAsk(title: string, message: string, yes: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annulla', style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

function Choice({ selected, title, subtitle, onPress, label }: { selected: boolean; title: string; subtitle?: string; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
    >
      <Text style={{ fontSize: 20, color: selected ? colors.primary : colors.grey }}>{selected ? '◉' : '○'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: colors.text, fontWeight: selected ? '700' : '400' }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 13, color: colors.muted }}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function GiornataScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, update } = useData();
  const plan = data.dayPlans.find((p) => p.id === id);
  const [name, setName] = useState<string | null>(null);

  if (!plan) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Giornata tipo' }} />
        <Notice tone="warning">Questa giornata tipo non esiste più.</Notice>
      </Screen>
    );
  }

  const change = (f: (p: DayPlan) => DayPlan) => update((d) => withDayPlans(d, d.dayPlans.map((p) => (p.id === plan.id ? f(p) : p))));
  const rows = dayPlanRows(plan, data.dogs, data.recipes);
  const shownName = name ?? plan.name;

  return (
    <Screen>
      <Stack.Screen options={{ title: plan.name }} />
      <Explain>
        Per ogni cane scegli una ricetta salvata (o nessuna). Ogni scelta si salva subito. Se poi modifichi una ricetta, la giornata usa la
        versione nuova.
      </Explain>

      <Card title="Nome">
        <Field
          label="Nome della giornata"
          value={shownName}
          onChangeText={(t) => {
            setName(t);
            if (t.trim()) change((p) => renameDayPlan(p, t, new Date()));
          }}
          placeholder="es. Giornata pollo"
        />
        {!shownName.trim() ? <Text style={{ color: colors.danger, fontSize: 14 }}>Scrivi un nome: finché è vuoto resta «{plan.name}».</Text> : null}
      </Card>

      {data.dogs.length === 0 ? (
        <Card>
          <Hint>Prima aggiungi un cane e una ricetta.</Hint>
        </Card>
      ) : null}

      {rows.map(({ dog, recipe, missing }) => {
        const own = data.recipes.filter((r) => r.dogId === dog.id).sort((a, b) => a.name.localeCompare(b.name, 'it'));
        const pick = (r: Recipe | null) => change((p) => setDayPlanRecipe(p, dog.id, r, new Date()));
        return (
          <Card key={dog.id} title={dog.name}>
            {missing ? (
              <Notice tone="warning">Ricetta mancante: quella scelta è stata eliminata. Scegline un’altra o «Nessuna».</Notice>
            ) : null}
            <Choice selected={!recipe && !missing} title="Nessuna" label={`${dog.name}: nessuna ricetta`} onPress={() => pick(null)} />
            {own.map((r) => (
              <Choice key={r.id} selected={recipe?.id === r.id} title={r.name} label={`${dog.name}: ${r.name}`} onPress={() => pick(r)} />
            ))}
            {own.length === 0 ? <Hint>{dog.name} non ha ricette salvate.</Hint> : null}
            {recipe ? (
              <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/vista/[id]', params: { id: recipe.id } })} hitSlop={6}>
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Vedi «{recipe.name}» (sola lettura) ›</Text>
              </Pressable>
            ) : null}
          </Card>
        );
      })}

      <Card title="Altre azioni">
        <Button
          title="Duplica questa giornata"
          kind="secondary"
          onPress={() => {
            const now = new Date();
            const copy = duplicateDayPlan(plan, generateId(now), now);
            update((d) => withDayPlans(d, upsertDayPlan(d.dayPlans, copy)));
            router.replace({ pathname: '/giornata/[id]', params: { id: copy.id } });
          }}
        />
        <Button
          title="Elimina questa giornata"
          kind="danger"
          onPress={() =>
            confirmAsk('Eliminare la giornata tipo?', `«${plan.name}» verrà cancellata. Le ricette non cambiano.`, 'Elimina', () => {
              update((d) => withDayPlans(d, removeDayPlan(d.dayPlans, plan.id)));
              router.back();
            })
          }
        />
      </Card>
    </Screen>
  );
}
