import { Link, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { generateId, withDayPlans } from '../../data/personalStore';
import { backupReminder, computeDogEnergy, dayPlanRows, favoriteRecipes, newDayPlan, nextDayPlanName, upsertDayPlan } from '../../engine';
import { Badge, Button, Card, Explain, Hint, Notice, Screen, styles } from '../../ui/components';
import { FavoriteStar } from '../../ui/FavoriteStar';
import { formatNumber, formatSmart } from '../../ui/format';
import { colors } from '../../ui/theme';
import { UpdateBanner } from '../../updates/UpdateBanner';

export default function CaniScreen() {
  const { data, ready, problem, update } = useData();
  const favorites = favoriteRecipes(data.favorites, data.recipes, data.dogs);
  const dogName = (id: string) => data.dogs.find((d) => d.id === id)?.name ?? 'cane eliminato';
  const addDayPlan = () => {
    const now = new Date();
    const plan = newDayPlan(generateId(now), nextDayPlanName(data.dayPlans), now);
    update((d) => withDayPlans(d, upsertDayPlan(d.dayPlans, plan)));
    router.push({ pathname: '/giornata/[id]', params: { id: plan.id } });
  };
  const reminder = backupReminder(data.lastBackupAt, new Date(), data.settings.backupReminderDays);

  return (
    <Screen>
      <UpdateBanner />
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      {ready && reminder.due && data.dogs.length > 0 ? (
        <Pressable onPress={() => router.navigate('/altro')} accessibilityRole="button">
          <Notice tone="warning">{reminder.message} Tocca qui e fai “Esporta tutto”.</Notice>
        </Pressable>
      ) : null}

      <Explain>
        Qui ci sono i tuoi cani. Tocca un cane per vedere le calorie al giorno, la tabella FEDIAF in uso e i
        fabbisogni.
      </Explain>

      {ready && data.dogs.length === 0 ? (
        <Card>
          <Text style={{ fontSize: 16 }}>Non hai ancora inserito nessun cane.</Text>
        </Card>
      ) : null}

      {data.dogs.map((dog) => {
        const e = computeDogEnergy(dog, data.settings.multipliers ?? undefined);
        return (
          <Link key={dog.id} href={{ pathname: '/cane/[id]', params: { id: dog.id } }} asChild>
            <Pressable accessibilityRole="link" style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardTitle}>{dog.name}</Text>
                <Text style={{ fontSize: 24, color: colors.grey }}>›</Text>
              </View>
              <Text style={{ fontSize: 15, color: colors.text }}>
                {formatSmart(dog.weightKg)} kg · {formatNumber(e.kcalPerDay)} kcal al giorno
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Badge text={`Tabella FEDIAF ${e.table}`} tone="info" />
                {e.kcalSource === 'scritte_a_mano' ? <Badge text="kcal scritte a mano" /> : null}
                {e.belowReference ? <Badge text="sotto il riferimento FEDIAF" tone="warning" /> : null}
              </View>
            </Pressable>
          </Link>
        );
      })}

      <Button title="Aggiungi un cane" onPress={() => router.push('/cane/nuovo')} />

      {data.dogs.length > 0 ? (
        <Card title="★ Preferiti">
          {favorites.length === 0 ? <Hint>Tocca la stellina ☆ di una ricetta (nella scheda Ricette) per ritrovarla qui.</Hint> : null}
          {favorites.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Vedi ${r.name} (sola lettura)`}
                onPress={() => router.push({ pathname: '/vista/[id]', params: { id: r.id } })}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 10 }, pressed && { opacity: 0.6 }]}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{r.name}</Text>
                <Text style={{ fontSize: 14, color: colors.muted }}>per {dogName(r.dogId)}</Text>
              </Pressable>
              <FavoriteStar recipeId={r.id} name={r.name} size={22} />
              <Text style={{ fontSize: 22, color: colors.grey }}>›</Text>
            </View>
          ))}
          {favorites.length > 0 ? <Hint>Si aprono in sola lettura.</Hint> : null}
        </Card>
      ) : null}

      {data.dogs.length > 0 ? (
        <Card title="Giornate tipo">
          {data.dayPlans.length === 0 ? (
            <Hint>Una giornata tipo dice quale ricetta mangia ogni cane, per esempio «Giornata pollo». Serve per l’anteprima degli ingredienti.</Hint>
          ) : null}
          {data.dayPlans.map((p) => {
            const rows = dayPlanRows(p, data.dogs, data.recipes);
            const missing = rows.some((r) => r.missing);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/giornata/[id]', params: { id: p.id } })}
                style={({ pressed }) => [{ paddingVertical: 10, gap: 2, borderBottomWidth: 0.5, borderBottomColor: colors.border }, pressed && { opacity: 0.6 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.text }}>{p.name}</Text>
                  {missing ? <Badge text="ricetta mancante" tone="warning" /> : null}
                  <Text style={{ fontSize: 22, color: colors.grey }}>›</Text>
                </View>
                {rows.map((r) => (
                  <Text key={r.dog.id} style={{ fontSize: 14, color: r.missing ? colors.warningText : colors.muted }}>
                    {r.dog.name}: {r.recipe ? r.recipe.name : r.missing ? 'ricetta mancante' : 'nessuna'}
                  </Text>
                ))}
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Nuova giornata" kind="secondary" onPress={addDayPlan} />
            </View>
            {data.dayPlans.length > 0 ? (
              <View style={{ flex: 1 }}>
                <Button title="Anteprima ingredienti" onPress={() => router.push('/anteprima')} />
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card title="Accesso rapido">
        <Hint>Ricette e diario arrivano nelle prossime fasi.</Hint>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="Ricette" kind="secondary" onPress={() => router.navigate('/ricette')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Diario" kind="secondary" onPress={() => router.navigate('/diario')} />
          </View>
        </View>
      </Card>
    </Screen>
  );
}
