import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { computeCost, getCatalog, recipeSummary, reviewReasons, type Recipe } from '../../engine';
import { Badge, Button, Card, Explain, Hint, Screen, styles } from '../../ui/components';
import { formatEuro } from '../../ui/format';
import { colors } from '../../ui/theme';
import { UpdateBanner } from '../../updates/UpdateBanner';

const catalog = getCatalog();

export default function RicetteScreen() {
  const { data } = useData();
  const [choosing, setChoosing] = useState(false);

  const row = (r: Recipe) => {
    const dog = data.dogs.find((d) => d.id === r.dogId);
    const cost = computeCost(r.lines, data.prices, catalog.get);
    const review = reviewReasons(r, data.dogs, catalog, data.settings.multipliers).length > 0;
    return (
      <Link key={r.id} href={{ pathname: '/ricetta/[id]', params: { id: r.id } }} asChild>
        <Pressable accessibilityRole="link" style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.cardTitle, { flex: 1 }]}>{r.name}</Text>
            {review ? <Badge text="da rivedere" tone="warning" /> : null}
          </View>
          <Text style={{ fontSize: 14, color: colors.muted }}>per {dog?.name ?? 'cane eliminato'}</Text>
          <Text numberOfLines={2} style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
            {recipeSummary(r.lines, catalog)}
          </Text>
          <Text style={{ fontSize: 14, color: colors.text, fontWeight: '600' }}>
            {cost.lines.every((l) => l.cost === null)
              ? 'prezzo: nessun prezzo inserito'
              : `${formatEuro(cost.total)} al giorno${cost.incomplete ? ' · incompleto' : ''}`}
          </Text>
        </Pressable>
      </Link>
    );
  };

  const start = () => {
    if (data.dogs.length === 1) router.push({ pathname: '/ricetta/[id]', params: { id: 'nuova', dogId: data.dogs[0]!.id } });
    else setChoosing(true);
  };

  return (
    <Screen>
      <UpdateBanner />
      <Explain>
        Le tue ricette. Ognuna appartiene a un solo cane. “Da rivedere” compare se sono cambiati il peso o le calorie del
        cane, o i dati del catalogo: i grammi non vengono mai cambiati da soli.
      </Explain>
      {data.dogs.length === 0 ? (
        <Card>
          <Hint>Prima aggiungi un cane nella scheda Cani.</Hint>
        </Card>
      ) : (
        <Button title="Nuova ricetta" onPress={start} />
      )}
      {choosing ? (
        <Card title="Per quale cane?">
          {data.dogs.map((d) => (
            <Button
              key={d.id}
              title={d.name}
              kind="secondary"
              onPress={() => {
                setChoosing(false);
                router.push({ pathname: '/ricetta/[id]', params: { id: 'nuova', dogId: d.id } });
              }}
            />
          ))}
        </Card>
      ) : null}
      {data.recipes.length === 0 ? <Hint>Nessuna ricetta salvata.</Hint> : null}
      {[...data.recipes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(row)}
    </Screen>
  );
}
