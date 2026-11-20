// Dispensa: quanto c'è in casa di ogni ingrediente, nello stesso peso delle ricette.
// Si aggiorna solo a mano (acquisti, "finito", correzioni): il diario non scala niente.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useData } from '../data/DataContext';
import { parseDecimal } from '../data/dogForm';
import { generateId, withPantry } from '../data/personalStore';
import { addPurchase, finishPackage, getCatalog, localDay, pantryList, removePantryItem, setPantryAmount, type CatalogItem } from '../engine';
import { Button, Card, Explain, Field, Hint, Notice, Screen, styles } from '../ui/components';
import { formatGrams, formatNumber } from '../ui/format';
import { CatalogPicker } from '../ui/recipe/Pickers';
import { colors } from '../ui/theme';

const catalog = getCatalog();
const qty = (n: number, unit: 'g' | 'capsule') => (unit === 'capsule' ? `${formatNumber(n)} ${n === 1 ? 'capsula' : 'capsule'}` : formatGrams(n));

export default function DispensaScreen() {
  const { data, update } = useData();
  const pantry = data.pantry;
  const [picking, setPicking] = useState(false);
  const [buy, setBuy] = useState<{ item: CatalogItem | null; packages: string; size: string }>({ item: null, packages: '1', size: '' });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const packages = parseDecimal(buy.packages);
  const size = parseDecimal(buy.size);
  const unit = buy.item?.doseUnit ?? 'g';
  const preview = typeof packages === 'number' && typeof size === 'number' ? packages * size : null;

  const register = () => {
    if (!buy.item) return setError('Scegli l’ingrediente.');
    if (typeof packages !== 'number' || packages <= 0) return setError('Numero di confezioni: scrivi un numero, per esempio 3.');
    if (typeof size !== 'number' || size <= 0) return setError(`Contenuto di una confezione: scrivi ${unit === 'capsule' ? 'il numero di capsule' : 'i grammi'}, per esempio 1000.`);
    const now = new Date();
    const item = buy.item;
    update((d) => withPantry(d, addPurchase(d.pantry, { id: generateId(now), key: item.key, day: localDay(now), packages, packageSize: size }, now)));
    setNotice(`Registrato: ${item.nameIt}, ${formatNumber(packages)} × ${qty(size, unit)} = ${qty(packages * size, unit)}.`);
    setBuy({ item: null, packages: '1', size: '' });
    setError(null);
  };

  const list = pantryList(pantry, catalog);
  return (
    <Screen>
      <Explain>
        Quanto hai in casa di ogni ingrediente, nello stesso peso delle ricette (per le verdure cotte, il peso cotto). Si
        aggiorna solo a mano: acquisti, «Finito» quando finisci una confezione, correzioni. Il diario non scala niente.
      </Explain>

      <Card title="Registra un acquisto">
        <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={[styles.input, { justifyContent: 'center' }]}>
          <Text style={{ fontSize: 16, color: buy.item ? colors.text : colors.grey }}>{buy.item ? buy.item.nameIt : 'Scegli l’ingrediente…'}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="Confezioni" value={buy.packages} onChangeText={(t) => setBuy((b) => ({ ...b, packages: t }))} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={unit === 'capsule' ? 'Capsule per confezione' : 'Grammi per confezione'}
              value={buy.size}
              onChangeText={(t) => setBuy((b) => ({ ...b, size: t }))}
              keyboardType="decimal-pad"
              placeholder={unit === 'capsule' ? 'es. 60' : 'es. 1000'}
            />
          </View>
        </View>
        {preview !== null ? <Hint>Totale: {qty(preview, unit)}</Hint> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title="Registra l’acquisto" onPress={register} />
      </Card>

      {notice ? <Notice tone="info">{notice}</Notice> : null}

      <Card title="In dispensa">
        {list.length === 0 ? <Hint>La dispensa è vuota.</Hint> : null}
        {list.map(({ key, name, unit: u, item }) => {
          const text = editing[key];
          return (
            <View key={key} style={{ gap: 6, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{name}</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: item.amount > 0 ? colors.text : colors.danger }}>
                  {item.amount > 0 ? qty(item.amount, u) : 'finito'}
                </Text>
              </View>
              {item.packageSize ? <Hint>Confezione da {qty(item.packageSize, u)}</Hint> : null}
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {item.packageSize && item.amount > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Finito una confezione di ${name}`}
                    onPress={() => update((d) => withPantry(d, finishPackage(d.pantry, key, new Date())))}
                  >
                    <Text style={{ color: colors.primary, fontSize: 15 }}>Finito (una confezione)</Text>
                  </Pressable>
                ) : null}
                {text === undefined ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Correggi ${name}`} onPress={() => setEditing((e) => ({ ...e, [key]: String(item.amount) }))}>
                    <Text style={{ color: colors.primary, fontSize: 15 }}>Correggi</Text>
                  </Pressable>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      value={text}
                      onChangeText={(t) => setEditing((e) => ({ ...e, [key]: t }))}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`Quantità in dispensa ${name}`}
                      style={[styles.input, { width: 100, paddingVertical: 4 }]}
                    />
                    <Text style={{ color: colors.muted }}>{u === 'capsule' ? 'capsule' : 'g'}</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const v = parseDecimal(text);
                        if (typeof v === 'number') update((d) => withPantry(d, setPantryAmount(d.pantry, key, v, new Date())));
                        setEditing((e) => {
                          const { [key]: _done, ...rest } = e;
                          return rest;
                        });
                      }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Salva</Text>
                    </Pressable>
                  </View>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={`Togli ${name} dalla dispensa`} onPress={() => update((d) => withPantry(d, removePantryItem(d.pantry, key)))}>
                  <Text style={{ color: colors.danger, fontSize: 15 }}>Togli</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </Card>

      {pantry.purchases.length > 0 ? (
        <Card title="Ultimi acquisti">
          {[...pantry.purchases]
            .reverse()
            .slice(0, 10)
            .map((p) => {
              const c = catalog.get(p.key);
              const u = c?.doseUnit ?? 'g';
              return (
                <Hint key={p.id}>
                  {p.day.split('-').reverse().join('/')} · {c?.nameIt ?? p.key}: {formatNumber(p.packages)} × {qty(p.packageSize, u)}
                </Hint>
              );
            })}
        </Card>
      ) : null}

      <CatalogPicker
        visible={picking}
        all
        exclude={[]}
        onClose={() => setPicking(false)}
        onPick={(item) => {
          const known = pantry.items[item.key]?.packageSize;
          setBuy((b) => ({ ...b, item, size: known ? String(known) : b.size }));
          setPicking(false);
        }}
      />
    </Screen>
  );
}
