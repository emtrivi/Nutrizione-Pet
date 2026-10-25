import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { RECIPE_CATEGORY_LABELS, getCatalog, unitPrice, type CatalogItem, type RecipeCategory } from '../../engine';
import { Badge, Explain, Segmented, styles } from '../../ui/components';
import { formatEuro, formatSmart } from '../../ui/format';
import { colors } from '../../ui/theme';
import { UpdateBanner } from '../../updates/UpdateBanner';

const catalog = getCatalog();
type Kind = 'food' | 'supplement';
type Filter = 'tutti' | RecipeCategory;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'tutti', label: 'Tutti' },
  { value: 'proteica', label: 'Proteine' },
  { value: 'energetica', label: 'Energia' },
  { value: 'verdure', label: 'Verdure' },
  { value: 'grassi', label: 'Grassi' },
  { value: 'frattaglie', label: 'Frattaglie' },
];

/** Testo senza accenti e in minuscolo, per la ricerca. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function ItemRow({ item, price }: { item: CatalogItem; price: string | null }) {
  return (
    <Link href={{ pathname: '/catalogo/[key]', params: { key: item.key } }} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => [styles.card, { marginBottom: 8 }, pressed && { opacity: 0.7 }]}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{item.nameIt}</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          {item.kind === 'food'
            ? `${item.processingLabel} · ${item.kcalPerUnit !== null ? `${formatSmart(item.kcalPerUnit * 100)} kcal per 100 g` : 'kcal sconosciute'}`
            : item.doseUnit === 'capsule'
              ? 'dose a capsule'
              : 'dose in grammi'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {item.indicative ? <Badge text="dato indicativo" tone="warning" /> : null}
          {item.provisional ? <Badge text="dato provvisorio" tone="warning" /> : null}
          {!item.availableForNewRecipes ? <Badge text="non disponibile per nuove ricette" tone="grey" /> : null}
          <Text style={{ fontSize: 13, color: price ? colors.text : colors.grey }}>{price ?? 'prezzo non inserito'}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function CatalogoScreen() {
  const { data } = useData();
  const [kind, setKind] = useState<Kind>('food');
  const [filter, setFilter] = useState<Filter>('tutti');
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = norm(query.trim());
    const list = kind === 'food' ? catalog.foods : catalog.supplements;
    return list
      .filter((i) => kind === 'supplement' || filter === 'tutti' || i.recipeCategory === filter)
      .filter((i) => !q || norm(i.nameIt).includes(q))
      .sort((a, b) => a.nameIt.localeCompare(b.nameIt, 'it'));
  }, [kind, filter, query]);

  const priceText = (item: CatalogItem) => {
    const entry = data.prices[item.key];
    if (!entry) return null;
    const p = unitPrice(entry, item.doseUnit);
    if (p === null) return null;
    return item.doseUnit === 'capsule' ? `${formatEuro(p)} a capsula` : `${formatEuro(p * 1000)} al kg`;
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => <ItemRow item={item} price={priceText(item)} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <UpdateBanner />
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>Strumento di supporto, da validare con la nutrizionista.</Text>
            </View>
            <Explain>
              Il catalogo si legge e non si modifica: i dati nutrizionali cambiano solo con un aggiornamento dell’app. Il
              prezzo invece lo scrivi tu: tocca un alimento.
            </Explain>
            <Text style={{ fontSize: 13, color: colors.muted }}>{catalog.version.label}</Text>
            <Segmented
              options={[
                { value: 'food', label: `Alimenti (${catalog.foods.length})` },
                { value: 'supplement', label: `Integratori (${catalog.supplements.length})` },
              ]}
              value={kind}
              onChange={setKind}
            />
            {kind === 'food' ? <Segmented options={FILTERS} value={filter} onChange={setFilter} /> : null}
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cerca per nome…"
              placeholderTextColor={colors.grey}
              style={styles.input}
              accessibilityLabel="Cerca nel catalogo"
              clearButtonMode="while-editing"
            />
            {kind === 'food' && filter !== 'tutti' ? (
              <Text style={{ fontSize: 13, color: colors.muted }}>{RECIPE_CATEGORY_LABELS[filter]}: {items.length}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={<Text style={{ color: colors.muted }}>Nessun risultato.</Text>}
      />
    </View>
  );
}
