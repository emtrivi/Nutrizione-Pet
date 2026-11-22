// Pasti: la razione del giorno divisa in 1, 2 o 3 pasti, con i grammi pronti da pesare.
// Numero di pasti, percentuali e pasto delle capsule si ricordano per ogni cane. La ricetta non cambia.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { parseDecimal } from '../../data/dogForm';
import { withMeals } from '../../data/personalStore';
import {
  MEAL_COUNTS,
  equalPcts,
  getCatalog,
  mealPlanFor,
  pctsValid,
  setCapsuleMeal,
  setMealCount,
  setMealPcts,
  splitRecipe,
  type MealCount,
  type MealsData,
} from '../../engine';
import { Card, Hint, Segmented, styles } from '../components';
import { formatNumber, formatSmart } from '../format';
import { colors } from '../theme';

const catalog = getCatalog();
export const mealName = (i: number) => `Pasto ${i + 1}`;
export const pctText = (p: number) => `${formatNumber(p, Number.isInteger(Math.round(p * 10) / 10) ? 0 : 1)}%`;
export const mealQty = (amount: number, unit: 'g' | 'capsule') =>
  unit === 'capsule' ? `${formatSmart(amount)} ${amount === 1 ? 'capsula' : 'capsule'}` : `${formatSmart(amount)} g`;
const plainPct = (p: number) => (Number.isInteger(Math.round(p * 10) / 10) ? String(Math.round(p)) : (Math.round(p * 10) / 10).toString().replace('.', ','));

export function MealsCard({ dogId, dogName, lines }: { dogId: string; dogName: string; lines: { key: string; amount: number }[] }) {
  const { data, update } = useData();
  const plan = mealPlanFor(data.meals, dogId);
  const [edit, setEdit] = useState<string[] | null>(null);
  const change = (f: (m: MealsData) => MealsData) => update((d) => withMeals(d, f(d.meals)));

  const texts = edit && edit.length === plan.count ? edit : plan.pcts.map(plainPct);
  const typed = texts.map((t) => parseDecimal(t));
  const nums = typed.map((v) => (typeof v === 'number' ? v : NaN));
  const valid = pctsValid(nums, plan.count);
  const sum = nums.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);

  const typePct = (i: number, t: string) => {
    let next = texts.map((x, j) => (j === i ? t : x));
    if (plan.count === 2) {
      // con due pasti l'altro si completa da solo
      const v = parseDecimal(t);
      if (typeof v === 'number' && v >= 0 && v <= 100) next = next.map((x, j) => (j === i ? t : plainPct(100 - v)));
    }
    setEdit(next);
    const values = next.map((x) => parseDecimal(x));
    if (values.every((v) => typeof v === 'number')) change((m) => setMealPcts(m, dogId, values as number[]));
  };

  const split = splitRecipe(lines, catalog, plan);
  const equal = plan.pcts.every((p, i) => Math.abs(p - (equalPcts(plan.count)[i] ?? 0)) < 0.01);

  return (
    <Card title="Pasti">
      <Segmented
        label={`Pasti al giorno per ${dogName}`}
        options={MEAL_COUNTS.map((n) => ({ value: n, label: n === 1 ? '1 pasto' : `${n} pasti` }))}
        value={plan.count}
        onChange={(n: MealCount) => {
          setEdit(null);
          change((m) => setMealCount(m, dogId, n));
        }}
      />
      {plan.count === 1 ? (
        <Hint>Un solo pasto: i grammi sono quelli della ricetta. Scegli 2 o 3 per dividerla. La scelta si ricorda per {dogName}.</Hint>
      ) : (
        <>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Quanto della razione in ogni pasto</Text>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {texts.map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: colors.muted }}>{mealName(i)}</Text>
                <TextInput
                  value={t}
                  onChangeText={(x) => typePct(i, x)}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Percentuale ${mealName(i)}`}
                  style={[styles.input, { width: 64, paddingVertical: 4 }]}
                />
                <Text style={{ color: colors.muted }}>%</Text>
              </View>
            ))}
          </View>
          {valid ? (
            <Hint>
              Somma 100%. {equal ? 'Pasti uguali.' : ''} Arrotondati ai 5 g (integratori in grammi a 1 g): il piccolo resto va sul pasto più grande,
              così ogni ingrediente somma sempre al totale del giorno.
            </Hint>
          ) : (
            <Text style={{ color: colors.danger, fontSize: 14 }}>
              La somma fa {formatNumber(sum, Number.isInteger(sum) ? 0 : 1)}%: deve fare 100%. Finché non torna, uso le percentuali di prima (
              {plan.pcts.map(pctText).join(' / ')}).
            </Text>
          )}
          {!equal ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEdit(null);
                change((m) => setMealPcts(m, dogId, equalPcts(plan.count)));
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Rimetti i pasti uguali</Text>
            </Pressable>
          ) : null}

          {split.meals.map((meal, i) => (
            <View key={i} style={{ gap: 4, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {mealName(i)} · {pctText(plan.pcts[i] ?? 0)}
              </Text>
              {meal.length === 0 ? <Hint>Niente in questo pasto.</Hint> : null}
              {meal.map((l) => (
                <View key={l.key} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{catalog.get(l.key)?.nameIt ?? l.key}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{mealQty(l.amount, l.unit)}</Text>
                </View>
              ))}
            </View>
          ))}

          {split.capsules.length > 0 ? (
            <View style={{ gap: 6, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Capsule: in quale pasto</Text>
              <Hint>Le capsule non si dividono. Di partenza sono alternate tra i pasti; la scelta si ricorda per {dogName}.</Hint>
              {split.capsules.map((c) => {
                const name = catalog.get(c.key)?.nameIt ?? c.key;
                return (
                  <View key={c.key} style={{ gap: 2 }}>
                    <Text style={{ fontSize: 15, color: colors.text }}>
                      {name} ({mealQty(c.total, 'capsule')} al giorno)
                    </Text>
                    {c.meals.map((m, piece) => (
                      <Segmented
                        key={piece}
                        label={c.pieces > 1 ? `${piece + 1}ª capsula` : c.total === 1 ? 'La capsula' : `Le ${formatSmart(c.total)} capsule`}
                        options={Array.from({ length: plan.count }, (_, i) => ({ value: i, label: mealName(i) }))}
                        value={m}
                        onChange={(meal: number) => change((x) => setCapsuleMeal(x, dogId, c.key, c.pieces, piece, meal))}
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}
