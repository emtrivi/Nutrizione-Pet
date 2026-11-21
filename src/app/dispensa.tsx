// Dispensa: quanto c'è in casa di ogni ingrediente, nello stesso peso delle ricette.
// Una riga per prodotto e formato di confezione; le partite sfuse e i resti sono righe a parte.
// Si aggiorna solo a mano (acquisti, +1/−1, correzioni, «Finito»): il diario non scala niente.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useData } from '../data/DataContext';
import { parseDecimal } from '../data/dogForm';
import { generateId, withPantry } from '../data/personalStore';
import {
  addBulk,
  addPackages,
  changePackages,
  correctPackageGrams,
  editLot,
  getCatalog,
  lastPackageSize,
  localDay,
  lotAmount,
  pantryGroups,
  removeLot,
  updateRemaining,
  type CatalogItem,
  type PantryLot,
} from '../engine';
import { Badge, Button, Card, Explain, Field, Hint, Notice, Screen, Segmented, styles } from '../ui/components';
import { formatGrams, formatNumber } from '../ui/format';
import { CatalogPicker } from '../ui/recipe/Pickers';
import { colors } from '../ui/theme';

const catalog = getCatalog();
const qty = (n: number, unit: 'g' | 'capsule') => (unit === 'capsule' ? `${formatNumber(n)} ${n === 1 ? 'capsula' : 'capsule'}` : formatGrams(n));
const unitWord = (unit: 'g' | 'capsule') => (unit === 'capsule' ? 'capsule' : 'g');
const dayIt = (day: string) => (day ? day.split('-').reverse().join('/') : '');
const packagesText = (n: number) => `${formatNumber(n)} ${n === 1 ? 'confezione' : 'confezioni'}`;

type Mode = 'confezioni' | 'partita';
type Editor = { lotId: string; mode: 'modifica' | 'grammi' | 'resta'; packages: string; size: string; grams: string };

function Action({ title, label, onPress, tone = 'primary' }: { title: string; label: string; onPress: () => void; tone?: 'primary' | 'danger' }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress}>
      <Text style={{ color: tone === 'danger' ? colors.danger : colors.primary, fontSize: 15, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

function SmallInput({ value, onChangeText, label, width = 90 }: { value: string; onChangeText: (t: string) => void; label: string; width?: number }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType="decimal-pad"
      accessibilityLabel={label}
      style={[styles.input, { width, paddingVertical: 4 }]}
    />
  );
}

export default function DispensaScreen() {
  const { data, update } = useData();
  const pantry = data.pantry;
  const [picking, setPicking] = useState(false);
  const [buy, setBuy] = useState<{ item: CatalogItem | null; mode: Mode; packages: string; size: string; grams: string }>({
    item: null,
    mode: 'confezioni',
    packages: '1',
    size: '',
    grams: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const packages = parseDecimal(buy.packages);
  const size = parseDecimal(buy.size);
  const grams = parseDecimal(buy.grams);
  const unit = buy.item?.doseUnit ?? 'g';
  const preview = typeof packages === 'number' && typeof size === 'number' ? Math.round(packages) * size : null;

  const register = () => {
    if (!buy.item) return setError('Scegli l’ingrediente.');
    const now = new Date();
    const item = buy.item;
    if (buy.mode === 'partita') {
      if (typeof grams !== 'number' || grams <= 0) return setError(`Quantità della partita: scrivi ${unit === 'capsule' ? 'il numero di capsule' : 'i grammi'}, per esempio 10000.`);
      update((d) => withPantry(d, addBulk(d.pantry, { id: generateId(now), key: item.key, day: localDay(now), grams }, now)));
      setNotice(`Registrata una partita sfusa: ${item.nameIt}, ${qty(grams, unit)}. È una riga a parte.`);
    } else {
      if (typeof packages !== 'number' || packages <= 0 || !Number.isInteger(packages)) return setError('Numero di confezioni: scrivi un numero intero, per esempio 3.');
      if (typeof size !== 'number' || size <= 0) return setError(`Contenuto di una confezione: scrivi ${unit === 'capsule' ? 'il numero di capsule' : 'i grammi'}, per esempio 1000.`);
      const merged = pantry.lots.some((l) => l.kind === 'confezioni' && l.key === item.key && Math.abs(l.packageSize - size) < 1e-9);
      update((d) => withPantry(d, addPackages(d.pantry, { id: generateId(now), key: item.key, day: localDay(now), packages, packageSize: size }, now)));
      setNotice(
        `Registrato: ${item.nameIt}, ${packagesText(packages)} da ${qty(size, unit)}${merged ? ' (aggiunte alla riga con lo stesso formato)' : ''}.`,
      );
    }
    setBuy((b) => ({ item: null, mode: b.mode, packages: '1', size: '', grams: '' }));
    setError(null);
  };

  const closeEditor = () => {
    setEditor(null);
    setEditError(null);
  };

  const saveEditor = (lot: PantryLot, u: 'g' | 'capsule') => {
    if (!editor) return;
    const now = new Date();
    if (editor.mode === 'modifica') {
      const n = parseDecimal(editor.packages);
      const s = parseDecimal(editor.size);
      if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) return setEditError('Confezioni: scrivi un numero intero (0 toglie la riga).');
      if (typeof s !== 'number' || s <= 0) return setEditError(`Formato: scrivi ${u === 'capsule' ? 'le capsule' : 'i grammi'} di una confezione.`);
      update((d) => withPantry(d, editLot(d.pantry, lot.id, n, s, now)));
    } else {
      const g = parseDecimal(editor.grams);
      if (typeof g !== 'number' || g < 0) return setEditError(`Scrivi ${u === 'capsule' ? 'le capsule' : 'i grammi'} che hai in casa (0 toglie la riga).`);
      if (editor.mode === 'grammi') update((d) => withPantry(d, correctPackageGrams(d.pantry, lot.id, g, generateId(now), now, localDay(now))));
      else update((d) => withPantry(d, updateRemaining(d.pantry, lot.id, g, now)));
    }
    closeEditor();
  };

  const groups = pantryGroups(pantry, catalog);

  const renderEditor = (lot: PantryLot, u: 'g' | 'capsule', name: string) => {
    if (!editor || editor.lotId !== lot.id) return null;
    return (
      <View style={{ gap: 6, marginTop: 4 }}>
        {editor.mode === 'modifica' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <SmallInput value={editor.packages} onChangeText={(t) => setEditor({ ...editor, packages: t })} label={`Numero di confezioni ${name}`} width={70} />
            <Text style={{ color: colors.muted }}>confezioni da</Text>
            <SmallInput value={editor.size} onChangeText={(t) => setEditor({ ...editor, size: t })} label={`Formato della confezione ${name}`} />
            <Text style={{ color: colors.muted }}>{unitWord(u)}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: colors.muted }}>{editor.mode === 'grammi' ? 'In tutto ho' : 'Restano'}</Text>
            <SmallInput value={editor.grams} onChangeText={(t) => setEditor({ ...editor, grams: t })} label={`Quantità ${name}`} width={100} />
            <Text style={{ color: colors.muted }}>{unitWord(u)}</Text>
          </View>
        )}
        {editor.mode === 'grammi' ? <Hint>Le confezioni intere restano; la parte che avanza diventa una riga «resto» a parte.</Hint> : null}
        {editError ? <Text style={{ color: colors.danger, fontSize: 14 }}>{editError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Action title="Salva" label={`Salva ${name}`} onPress={() => saveEditor(lot, u)} />
          <Action title="Annulla" label="Annulla" onPress={closeEditor} />
        </View>
      </View>
    );
  };

  const renderLot = (lot: PantryLot, u: 'g' | 'capsule', name: string) => {
    const open = (mode: Editor['mode']) => {
      setEditError(null);
      setEditor({ lotId: lot.id, mode, packages: String(lot.packages), size: String(lot.packageSize), grams: String(lotAmount(lot)) });
    };
    if (lot.kind === 'confezioni') {
      return (
        <View key={lot.id} style={{ gap: 6, paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>
              {packagesText(lot.packages)} da {qty(lot.packageSize, u)}
            </Text>
            <Text style={{ fontSize: 15, color: colors.muted }}>{qty(lotAmount(lot), u)}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Action title="−1" label={`Una confezione in meno di ${name} da ${qty(lot.packageSize, u)}`} onPress={() => update((d) => withPantry(d, changePackages(d.pantry, lot.id, -1, new Date())))} />
            <Action title="+1 confezione" label={`Una confezione in più di ${name} da ${qty(lot.packageSize, u)}`} onPress={() => update((d) => withPantry(d, changePackages(d.pantry, lot.id, 1, new Date())))} />
            <Action title="Modifica" label={`Modifica confezioni e formato di ${name}`} onPress={() => open('modifica')} />
            <Action title="Correggi grammi" label={`Correggi i grammi di ${name}`} onPress={() => open('grammi')} />
            <Action title="Togli" label={`Togli la riga di ${name} da ${qty(lot.packageSize, u)}`} tone="danger" onPress={() => update((d) => withPantry(d, removeLot(d.pantry, lot.id)))} />
          </View>
          {renderEditor(lot, u, name)}
        </View>
      );
    }
    const partita = lot.kind === 'partita';
    return (
      <View
        key={lot.id}
        style={{
          gap: 6,
          padding: 8,
          marginVertical: 4,
          borderRadius: 8,
          borderLeftWidth: 4,
          borderLeftColor: partita ? colors.infoText : colors.grey,
          backgroundColor: partita ? colors.infoBg : colors.greyBg,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Badge text={partita ? 'Partita sfusa' : 'Resto'} tone={partita ? 'info' : 'grey'} />
          <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{partita ? `del ${dayIt(lot.day)}` : 'confezione aperta'}</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{qty(lot.amount, u)}</Text>
        </View>
        {partita && lot.bought > 0 ? <Hint>Acquistati {qty(lot.bought, u)}, restano {qty(lot.amount, u)}.</Hint> : null}
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Action title="Aggiorna quanto resta" label={`Aggiorna quanto resta di ${name}`} onPress={() => open('resta')} />
          <Action title="Finito" label={`Finito ${partita ? 'la partita' : 'il resto'} di ${name}`} tone="danger" onPress={() => update((d) => withPantry(d, removeLot(d.pantry, lot.id)))} />
        </View>
        {renderEditor(lot, u, name)}
      </View>
    );
  };

  return (
    <Screen>
      <Explain>
        Quanto hai in casa di ogni ingrediente, nello stesso peso delle ricette (per le verdure cotte, il peso cotto). Una riga per
        prodotto e formato di confezione; le partite sfuse restano righe a parte. Si aggiorna solo a mano: il diario non scala niente.
      </Explain>

      <Card title="Registra un acquisto">
        <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={[styles.input, { justifyContent: 'center' }]}>
          <Text style={{ fontSize: 16, color: buy.item ? colors.text : colors.grey }}>{buy.item ? buy.item.nameIt : 'Scegli l’ingrediente…'}</Text>
        </Pressable>
        <Segmented
          options={[
            { value: 'confezioni' as Mode, label: 'Confezioni' },
            { value: 'partita' as Mode, label: 'Partita sfusa' },
          ]}
          value={buy.mode}
          onChange={(mode) => setBuy((b) => ({ ...b, mode }))}
        />
        {buy.mode === 'confezioni' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Field label="Confezioni" value={buy.packages} onChangeText={(t) => setBuy((b) => ({ ...b, packages: t }))} keyboardType="number-pad" />
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
            {preview !== null ? <Hint>Totale: {qty(preview, unit)}. Se hai già lo stesso formato, le confezioni si sommano a quella riga.</Hint> : null}
          </>
        ) : (
          <>
            <Field
              label={unit === 'capsule' ? 'Capsule in tutto' : 'Grammi in tutto'}
              value={buy.grams}
              onChangeText={(t) => setBuy((b) => ({ ...b, grams: t }))}
              keyboardType="decimal-pad"
              placeholder={unit === 'capsule' ? 'es. 120' : 'es. 10000'}
            />
            <Hint>Una partita sfusa resta sempre una riga a parte, con la data di acquisto.</Hint>
          </>
        )}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title="Registra l’acquisto" onPress={register} />
      </Card>

      {notice ? <Notice tone="info">{notice}</Notice> : null}

      <Card title="In dispensa">
        {groups.length === 0 ? <Hint>La dispensa è vuota.</Hint> : null}
        {groups.map(({ key, name, unit: u, total, lots }) => (
          <View key={key} style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.text }}>{name}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{qty(total, u)}</Text>
            </View>
            {lots.map((lot) => renderLot(lot, u, name))}
          </View>
        ))}
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
                  {dayIt(p.day)} · {c?.nameIt ?? p.key}:{' '}
                  {p.kind === 'partita' ? `partita sfusa di ${qty(p.packageSize, u)}` : `${packagesText(p.packages)} da ${qty(p.packageSize, u)}`}
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
          const known = lastPackageSize(pantry, item.key);
          setBuy((b) => ({ ...b, item, size: known ? String(known) : b.size }));
          setPicking(false);
        }}
      />
    </Screen>
  );
}
