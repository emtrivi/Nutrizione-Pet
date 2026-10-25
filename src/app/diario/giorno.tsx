import { Stack, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { useData } from '../../data/DataContext';
import { entryForDay, formatDay, localDay, summaryText, weekday } from '../../engine';
import { NutrientBarRow } from '../../ui/NutrientBar';
import { SnapshotBars } from '../../ui/SnapshotBars';
import { Card, Explain, Hint, Notice, Row, Screen } from '../../ui/components';
import { formatEuro, formatNumber, formatSmart } from '../../ui/format';
import { colors } from '../../ui/theme';

export default function GiornoScreen() {
  const { dogId, day } = useLocalSearchParams<{ dogId: string; day: string }>();
  const { data } = useData();
  const today = localDay(new Date());
  const dog = data.dogs.find((d) => d.id === dogId);
  const entry = dogId && day ? entryForDay(data.diary, dogId, day, today) : null;
  if (!entry || !day) {
    return (
      <Screen>
        <Notice tone="info">Nessuna ricetta in questo giorno.</Notice>
      </Screen>
    );
  }
  const s = entry.snapshot;
  return (
    <Screen>
      <Stack.Screen options={{ title: `${weekday(day)} ${formatDay(day)}` }} />
      <Explain>
        Copia fissa salvata il {formatDay(s.createdAt.slice(0, 10))}: questi valori non cambiano anche se poi sono cambiati la
        ricetta, il cane o il catalogo.
      </Explain>
      <Card title={s.recipeName}>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          {dog?.name ?? 'cane eliminato'} · periodo dal {formatDay(entry.from)} {entry.to ? `al ${formatDay(entry.to)}` : '(in corso)'}
        </Text>
        {s.lines.map((l) => (
          <Row key={l.key} label={l.name} value={`${formatSmart(l.amount)} ${l.unit === 'capsule' ? (l.amount === 1 ? 'capsula' : 'capsule') : 'g'}`} />
        ))}
        <Row label="Kcal della ricetta" value={s.kcal !== null ? `${formatNumber(s.kcal)} kcal` : 'non disponibili'} hint={`obiettivo ${formatNumber(s.kcalTarget)} · tabella FEDIAF ${s.table}`} />
        <Row label="Cane in quel momento" value={`${formatSmart(s.dogWeightKg)} kg`} hint={`${formatNumber(s.dogKcalPerDay)} kcal al giorno`} />
        {s.cost ? <Row label="Prezzo al giorno" value={`${formatEuro(s.cost.total)}${s.cost.incomplete ? ' (incompleto)' : ''}`} /> : null}
        <Hint>{s.catalogVersion}</Hint>
      </Card>
      <Text style={{ fontSize: 15, color: colors.text }}>Nutrienti: {summaryText(s.summary)}</Text>
      <Card>
        <NutrientBarRow
          name="Calcio / fosforo"
          valueText={s.caP.value !== null ? `${s.caP.partial ? 'almeno ' : ''}${formatNumber(s.caP.value, 2)} : 1` : 'non disponibile'}
          color={s.caP.color}
          bar={s.caP.bar}
          partial={s.caP.partial}
        />
      </Card>
      <SnapshotBars items={s.nutrients} />
    </Screen>
  );
}
