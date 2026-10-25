import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { withPrice, withoutPrice } from '../../data/personalStore';
import {
  GROUP_LABELS,
  GROUP_ORDER,
  NUTRIENTS,
  RECIPE_CATEGORY_LABELS,
  UNDECLARED_NEGLIGIBLE,
  getCatalog,
  suggestDose,
  type CatalogItem,
  type ItemNutrient,
} from '../../engine';
import { Badge, Card, Explain, Hint, Notice, Row, Screen } from '../../ui/components';
import { formatQuantity, formatSmart } from '../../ui/format';
import { PriceEditor } from '../../ui/PriceEditor';
import { colors } from '../../ui/theme';

const catalog = getCatalog();

function NutrientLine({ name, n, scale, unit }: { name: string; n: ItemNutrient | undefined; scale: number; unit: string }) {
  if (!n) {
    return <Row label={name} value="non disponibile" muted />;
  }
  const value = formatQuantity(n.value * scale, unit);
  const tags = [
    n.partial ? 'valore parziale' : null,
    n.toVerify ? 'da verificare' : null,
    n.status === 'analytical_zero' ? 'zero misurato' : null,
  ].filter(Boolean);
  const hint = [...tags, ...n.notes].join(' · ') || undefined;
  const assumed = n.status === UNDECLARED_NEGLIGIBLE;
  return <Row label={name} value={n.partial ? `almeno ${value}` : value} hint={hint} muted={assumed} />;
}

function DoseCard({ item }: { item: CatalogItem }) {
  const rule = item.doseRule;
  if (rule.kind === 'none') {
    return (
      <Card title="Dose del produttore">
        <Hint>{rule.reason}</Hint>
      </Card>
    );
  }
  const examples = [10, 20, 30, 40].map((kg) => ({ kg, s: suggestDose(item, kg) }));
  return (
    <Card title="Dose del produttore">
      <Hint>Indicazione d’uso, non un limite: la dose non viene mai bloccata.</Hint>
      {rule.kind === 'interpolated' ? (
        <Hint>
          Tabella del produttore da {rule.officialFromKg} a {rule.officialToKg} kg; per gli altri pesi la dose è “estrapolata”.
          {rule.householdMeasure ? ` Un ${rule.householdMeasure.label} = ${rule.householdMeasure.grams} g.` : ''}
        </Hint>
      ) : (
        <Hint>A fasce di peso, senza vie di mezzo.</Hint>
      )}
      {examples.map(({ kg, s }) =>
        s.kind === 'range' ? (
          <Row
            key={kg}
            label={`Cane da ${kg} kg`}
            value={`${formatSmart(s.min)}–${formatSmart(s.max)} g`}
            hint={[s.extrapolated ? 'estrapolata' : null, s.householdMeasure ? `${formatSmart(s.householdMeasure.min)}–${formatSmart(s.householdMeasure.max)} misurini` : null].filter(Boolean).join(' · ') || undefined}
          />
        ) : s.kind === 'band' ? (
          <Row key={kg} label={`Cane da ${kg} kg`} value={`fino a ${formatSmart(s.max)} g`} hint={`${s.bandLabel}${s.fromNoteOnly ? ' · valore scritto solo nella nota' : ''}`} />
        ) : null,
      )}
      {item.doseNote ? <Hint>{item.doseNote}</Hint> : null}
    </Card>
  );
}

export default function CatalogItemScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { data, update } = useData();
  const item = key ? catalog.get(key) : undefined;
  if (!item) {
    return (
      <Screen>
        <Notice tone="warning">Voce non trovata nel catalogo.</Notice>
      </Screen>
    );
  }

  const isFood = item.kind === 'food';
  const scale = isFood ? 100 : 1;
  const basis = isFood ? 'per 100 g' : item.doseUnit === 'capsule' ? 'per 1 capsula' : 'per 1 g';
  const isCooked = item.processingState?.startsWith('cooked') ?? false;

  return (
    <Screen>
      <Stack.Screen options={{ title: isFood ? 'Alimento' : 'Integratore' }} />
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{item.nameIt}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {isFood ? <Badge text={RECIPE_CATEGORY_LABELS[item.recipeCategory]} tone="info" /> : null}
        {item.processingLabel ? <Badge text={item.processingLabel} tone="info" /> : null}
        {item.indicative ? <Badge text="dato indicativo" tone="warning" /> : null}
        {item.provisional ? <Badge text="dato provvisorio" tone="warning" /> : null}
        {!item.availableForNewRecipes ? <Badge text="non disponibile per nuove ricette" /> : null}
      </View>

      <Card title="Prezzo">
        <PriceEditor
          key={item.key}
          doseUnit={item.doseUnit}
          isCooked={isCooked}
          entry={data.prices[item.key]}
          onSave={(e) => update((d) => withPrice(d, item.key, e, new Date()))}
          onRemove={() => update((d) => withoutPrice(d, item.key))}
        />
      </Card>

      <Card title="Energia">
        <Row
          label={`Kcal ${basis}`}
          value={item.kcalPerUnit !== null ? formatSmart(item.kcalPerUnit * scale) : 'non disponibile'}
          muted={item.kcalPerUnit === null}
          hint={item.kcalMethod ?? undefined}
        />
      </Card>

      {!isFood ? <DoseCard item={item} /> : null}

      <Explain>
        Valori {basis}, in sola lettura. “Non disponibile” vuol dire che il dato manca nel catalogo: non è zero.
      </Explain>
      {GROUP_ORDER.map((g) => (
        <Card key={g} title={GROUP_LABELS[g]}>
          {NUTRIENTS.filter((n) => n.group === g).map((def) => (
            <NutrientLine key={def.id} name={def.nameIt} n={item.nutrients[def.id]} scale={scale} unit={def.unit} />
          ))}
        </Card>
      ))}

      <Card title="Fonte e note">
        {item.source ? <Hint>Fonte: {item.source}</Hint> : null}
        {item.sourceUrl ? <Hint>{item.sourceUrl}</Hint> : null}
        {item.notes ? <Hint>{item.notes}</Hint> : null}
        <Hint>{catalog.version.label}</Hint>
      </Card>
    </Screen>
  );
}
