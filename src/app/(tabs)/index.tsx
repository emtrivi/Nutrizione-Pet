import { Link, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { backupReminder, computeDogEnergy } from '../../engine';
import { Badge, Button, Card, Explain, Hint, Notice, Screen, styles } from '../../ui/components';
import { formatNumber, formatSmart } from '../../ui/format';
import { colors } from '../../ui/theme';

export default function CaniScreen() {
  const { data, ready, problem } = useData();
  const reminder = backupReminder(data.lastBackupAt, new Date(), data.settings.backupReminderDays);

  return (
    <Screen>
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
