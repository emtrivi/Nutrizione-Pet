// Finestra per scegliere un alimento (di una categoria) o un integratore dal catalogo.

import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { RECIPE_CATEGORY_LABELS, getCatalog, type CatalogItem, type RecipeCategory } from '../../engine';
import { Badge, Button, styles } from '../components';
import { formatSmart, priceRateText } from '../format';
import { colors } from '../theme';

const catalog = getCatalog();
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CatalogPicker({
  visible,
  category,
  supplements,
  exclude,
  onPick,
  onClose,
}: {
  visible: boolean;
  /** Categoria degli alimenti; ignorata se supplements = true. */
  category?: RecipeCategory;
  supplements?: boolean;
  exclude: string[];
  onPick: (item: CatalogItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const { data } = useData();
  const items = useMemo(() => {
    const q = norm(query.trim());
    const base = supplements ? catalog.supplements : catalog.foods.filter((f) => f.recipeCategory === category);
    return base
      .filter((i) => i.availableForNewRecipes && !exclude.includes(i.key))
      .filter((i) => !q || norm(i.nameIt).includes(q))
      .sort((a, b) => a.nameIt.localeCompare(b.nameIt, 'it'));
  }, [query, supplements, category, exclude]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: 16 }]}>
        <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
            {supplements ? 'Scegli un integratore' : `Scegli: ${RECIPE_CATEGORY_LABELS[category ?? 'altro']}`}
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cerca per nome…"
            placeholderTextColor={colors.grey}
            style={styles.input}
            accessibilityLabel="Cerca"
          />
        </View>
        <FlatList
          data={items}
          keyExtractor={(i) => i.key}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={{ color: colors.muted }}>Nessun elemento da aggiungere.</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setQuery('');
                onPick(item);
              }}
              style={({ pressed }) => [styles.card, { marginBottom: 8 }, pressed && { opacity: 0.6 }]}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{item.nameIt}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                {item.kind === 'food'
                  ? `${item.processingLabel} · ${item.kcalPerUnit !== null ? `${formatSmart(item.kcalPerUnit * 100)} kcal per 100 g` : 'kcal sconosciute'}`
                  : item.doseUnit === 'capsule'
                    ? 'a capsule'
                    : 'in grammi'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.grey }}>{priceRateText(data.prices[item.key], item.doseUnit) ?? 'prezzo non inserito'}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {item.indicative ? <Badge text="dato indicativo" tone="warning" /> : null}
                {item.provisional ? <Badge text="dato provvisorio" tone="warning" /> : null}
              </View>
            </Pressable>
          )}
        />
        <View style={{ padding: 16 }}>
          <Button title="Chiudi" kind="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
