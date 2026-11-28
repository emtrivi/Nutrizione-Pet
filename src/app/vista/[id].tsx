// Ricetta in SOLA LETTURA (dai Preferiti e dalle Giornate tipo): ingredienti, grammi, calorie, pasti.
// Qui non ci sono campi modificabili né pulsanti che cambiano la ricetta. «Modifica ricetta» è separato, in fondo.

import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { computeTotals, getCatalog, mealPlanFor, reviewReasons, splitRecipe } from '../../engine';
import { Badge, Button, Card, Hint, Notice, Screen } from '../../ui/components';
import { FavoriteStar } from '../../ui/FavoriteStar';
import { formatNumber } from '../../ui/format';
import { mealName, mealQty, pctText } from '../../ui/recipe/MealsCard';
import { colors } from '../../ui/theme';

const catalog = getCatalog();

function Line({ name, value }: { name: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
      <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{name}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  );
}

export default function VistaRicettaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData();
  const recipe = data.recipes.find((r) => r.id === id);

  if (!recipe) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Ricetta' }} />
        <Notice tone="warning">Questa ricetta non esiste più (è stata eliminata).</Notice>
      </Screen>
    );
  }

  const dog = data.dogs.find((d) => d.id === recipe.dogId);
  const lines = recipe.lines.filter((l) => l.amount > 0);
  const foods = lines.filter((l) => catalog.get(l.key)?.kind !== 'supplement');
  const supplements = lines.filter((l) => catalog.get(l.key)?.kind === 'supplement');
  const unitOf = (key: string) => catalog.get(key)?.doseUnit ?? 'g';
  const nameOf = (key: string) => catalog.get(key)?.nameIt ?? key;
  const kcal = computeTotals(lines, catalog).kcal;
  const grams = foods.reduce((s, l) => s + (unitOf(l.key) === 'g' ? l.amount : 0), 0);
  const plan = mealPlanFor(data.meals, recipe.dogId);
  const split = splitRecipe(lines, catalog, plan);
  const reasons = reviewReasons(recipe, data.dogs, catalog, data.settings.multipliers);

  return (
    <Screen>
      <Stack.Screen
        options={{ title: recipe.name, headerRight: () => <FavoriteStar recipeId={recipe.id} name={recipe.name} /> }}
      />
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{recipe.name}</Text>
        <Text style={{ fontSize: 15, color: colors.muted }}>per {dog?.name ?? 'cane eliminato'} · razione di un giorno</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Badge text="Sola lettura" tone="info" />
          {reasons.length > 0 ? <Badge text="da rivedere" tone="warning" /> : null}
        </View>
      </View>
      {reasons.length > 0 ? <Notice tone="warning">Da rivedere: {reasons.join(' ')}</Notice> : null}

      <Card title="Ingredienti">
        {foods.map((l) => (
          <Line key={l.key} name={nameOf(l.key)} value={mealQty(l.amount, unitOf(l.key))} />
        ))}
        {supplements.length > 0 ? <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 }}>Integratori</Text> : null}
        {supplements.map((l) => (
          <Line key={l.key} name={nameOf(l.key)} value={mealQty(l.amount, unitOf(l.key))} />
        ))}
        {lines.length === 0 ? <Hint>Nessun ingrediente.</Hint> : null}
      </Card>

      <Card title="Calorie">
        <Line
          name="Calorie della ricetta"
          value={kcal.value === null ? 'non calcolabili' : `${formatNumber(kcal.value)} kcal${kcal.partial ? ' (dato parziale)' : ''}`}
        />
        <Line name="Obiettivo della ricetta" value={`${formatNumber(recipe.kcalTarget)} kcal`} />
        <Line name="Peso degli alimenti" value={`${formatNumber(grams)} g`} />
      </Card>

      <Card title="Pasti">
        {plan.count === 1 ? (
          <Hint>Un solo pasto al giorno: i grammi sono quelli degli ingredienti.</Hint>
        ) : (
          split.meals.map((meal, i) => (
            <View key={i} style={{ gap: 2, paddingTop: i ? 8 : 0, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {mealName(i)} · {pctText(plan.pcts[i] ?? 0)}
              </Text>
              {meal.length === 0 ? <Hint>Niente in questo pasto.</Hint> : null}
              {meal.map((l) => (
                <Line key={l.key} name={nameOf(l.key)} value={mealQty(l.amount, l.unit)} />
              ))}
            </View>
          ))
        )}
        <Hint>La divisione in pasti si cambia nella ricetta, con «Modifica ricetta».</Hint>
      </Card>

      <View style={{ marginTop: 16, gap: 6, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Hint>Per cambiare grammi, ingredienti o pasti apri la ricetta completa.</Hint>
        <Button title="✎ Modifica ricetta" kind="secondary" onPress={() => router.push({ pathname: '/ricetta/[id]', params: { id: recipe.id } })} />
      </View>
    </Screen>
  );
}
