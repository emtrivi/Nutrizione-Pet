// Dispensa: quanto c'è in casa di ogni ingrediente, nello stesso peso delle ricette.
// Due momenti separati: ACQUISTO (una bozza con la data, confermata con «Ho finito») e CONSUMO
// («Confezione finita», «Consumata in parte» sulle righe). Acquisti confermati, modifiche e consumi
// vanno nello storico (ultimi 3 mesi). Il diario non scala niente.
// È una scheda in basso: si apre sulle righe, con la ricerca; «Spesa e previsioni» porta alla pagina della spesa.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { parseDecimal } from '../../data/dogForm';
import { generateId, withPantry } from '../../data/personalStore';
import {
  addDays,
  applyPantryOrder,
  confirmDraft,
  consumePartial,
  discardDraft,
  draftAddLine,
  draftChangePackages,
  draftEditLine,
  draftRemoveLine,
  draftSetDay,
  formatDay,
  getCatalog,
  lastPackageSize,
  localDay,
  lotAmount,
  packageFinished,
  pantryGroups,
  pantryRecentOrder,
  partialValues,
  searchPantryGroups,
  startEditPurchase,
  visibleHistory,
  weekday,
  type CatalogItem,
  type PantryData,
  type PantryHistoryEntry,
  type PantryLot,
  type PurchaseLine,
} from '../../engine';
import { Badge, Button, Card, Explain, Field, Hint, Notice, Screen, Segmented, styles } from '../../ui/components';
import { HISTORY_LABEL, historyText, lineText, packagesText, purchaseByProduct, qty } from '../../ui/pantryText';
import { SHOPPING_BUTTON, SHOPPING_HREF } from '../../ui/navigation';
import { CatalogPicker } from '../../ui/recipe/Pickers';
import { colors } from '../../ui/theme';

const catalog = getCatalog();
const unitOf = (key: string): 'g' | 'capsule' => catalog.get(key)?.doseUnit ?? 'g';
const nameOf = (key: string) => catalog.get(key)?.nameIt ?? key;
const unitWord = (unit: 'g' | 'capsule') => (unit === 'capsule' ? 'capsule' : 'g');
/** Numero scritto con la virgola, senza punti delle migliaia (per i campi da modificare). */
const plain = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

type Mode = 'confezioni' | 'partita';
type LineEditor = { lineId: string; packages: string; size: string; grams: string };
type ConsumeEditor = { lotId: string; remaining: string; consumed: string; last: 'remaining' | 'consumed' | null };

const HISTORY_TONE: Record<PantryHistoryEntry['type'], 'info' | 'warning' | 'danger' | 'grey'> = {
  acquisto: 'info',
  modifica: 'warning',
  finita: 'danger',
  consumo: 'grey',
};

function confirmAsk(title: string, message: string, yes: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annulla', style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

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

/** Scelta del giorno con ‹ › e «Oggi». */
function DayStepper({ label, value, onChange, today }: { label: string; value: string; onChange: (d: string) => void; today: string }) {
  const btn = { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.primary };
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: giorno prima`} onPress={() => onChange(addDays(value, -1))} style={btn}>
          <Text style={{ color: colors.primary, fontSize: 18 }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 17, minWidth: 130, textAlign: 'center', color: colors.text }} accessibilityLabel={`${label} ${formatDay(value)}`}>
          {weekday(value)} {formatDay(value)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: giorno dopo`}
          disabled={value >= today}
          onPress={() => onChange(addDays(value, 1))}
          style={[btn, value >= today && { opacity: 0.4 }]}
        >
          <Text style={{ color: colors.primary, fontSize: 18 }}>›</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: oggi`} onPress={() => onChange(today)} hitSlop={6}>
          <Text style={{ color: colors.primary, fontSize: 15 }}>Oggi</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function DispensaScreen() {
  const { data, update } = useData();
  const pantry = data.pantry;
  const draft = pantry.draft;
  const today = localDay(new Date());
  const [picking, setPicking] = useState(false);
  const [formDay, setFormDay] = useState(today);
  const [buy, setBuy] = useState<{ item: CatalogItem | null; mode: Mode; packages: string; size: string; grams: string }>({
    item: null,
    mode: 'confezioni',
    packages: '1',
    size: '',
    grams: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [lineEditor, setLineEditor] = useState<LineEditor | null>(null);
  const [consume, setConsume] = useState<ConsumeEditor | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Ordine delle righe (dal prodotto toccato più di recente), fissato quando si apre la scheda:
  // così una riga non salta in cima mentre la si sta usando.
  const [order, setOrder] = useState<string[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      setOrder(pantryRecentOrder(pantry));
      // eslint-disable-next-line react-hooks/exhaustive-deps -- solo all'apertura della scheda
    }, []),
  );

  const change = (f: (p: PantryData) => PantryData) => update((d) => withPantry(d, f(d.pantry)));
  const editing = !!draft?.editingOf;
  const day = draft?.day ?? formDay;

  const packages = parseDecimal(buy.packages);
  const size = parseDecimal(buy.size);
  const grams = parseDecimal(buy.grams);
  const unit = buy.item?.doseUnit ?? 'g';
  const preview = typeof packages === 'number' && typeof size === 'number' ? Math.round(packages) * size : null;

  // ------------------------------------------------ acquisto (bozza)
  const addLine = () => {
    if (!buy.item) return setError('Scegli l’ingrediente.');
    const now = new Date();
    const item = buy.item;
    if (buy.mode === 'partita') {
      if (typeof grams !== 'number' || grams <= 0) return setError(`Quantità della partita: scrivi ${unit === 'capsule' ? 'il numero di capsule' : 'i grammi'}, per esempio 10000.`);
      change((p) => draftAddLine(p, { key: item.key, kind: 'partita', grams }, generateId(now), now, day));
    } else {
      if (typeof packages !== 'number' || packages <= 0 || !Number.isInteger(packages)) return setError('Numero di confezioni: scrivi un numero intero, per esempio 3.');
      if (typeof size !== 'number' || size <= 0) return setError(`Contenuto di una confezione: scrivi ${unit === 'capsule' ? 'il numero di capsule' : 'i grammi'}, per esempio 1000.`);
      change((p) => draftAddLine(p, { key: item.key, kind: 'confezioni', packages, packageSize: size }, generateId(now), now, day));
    }
    setBuy((b) => ({ item: null, mode: b.mode, packages: '1', size: '', grams: '' }));
    setError(null);
    setNotice(null);
  };

  const finish = () => {
    if (!draft) return;
    const now = new Date();
    const wasEditing = editing;
    const n = draft.lines.length;
    change((p) => confirmDraft(p, generateId(now), now));
    setLineEditor(null);
    setFormDay(today);
    setNotice(
      wasEditing
        ? 'Modifiche salvate: la dispensa è aggiornata e lo storico registra la correzione.'
        : `Acquisto del ${formatDay(draft.day)} registrato (${n} ${n === 1 ? 'prodotto' : 'prodotti'}): ora è in dispensa e nello storico.`,
    );
  };

  const saveLine = (line: PurchaseLine) => {
    if (!lineEditor) return;
    const now = new Date();
    const u = unitOf(line.key);
    if (line.kind === 'confezioni') {
      const n = parseDecimal(lineEditor.packages);
      const s = parseDecimal(lineEditor.size);
      if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) return setEditError('Confezioni: scrivi un numero intero (0 toglie il prodotto).');
      if (typeof s !== 'number' || s <= 0) return setEditError(`Formato: scrivi ${u === 'capsule' ? 'le capsule' : 'i grammi'} di una confezione.`);
      change((p) => draftEditLine(p, line.id, { packages: n, packageSize: s }, now));
    } else {
      const g = parseDecimal(lineEditor.grams);
      if (typeof g !== 'number' || g < 0) return setEditError(`Scrivi ${u === 'capsule' ? 'le capsule' : 'i grammi'} della partita (0 la toglie).`);
      change((p) => draftEditLine(p, line.id, { grams: g }, now));
    }
    setLineEditor(null);
    setEditError(null);
  };

  const renderDraftLine = (line: PurchaseLine) => {
    const u = unitOf(line.key);
    const name = nameOf(line.key);
    const open = lineEditor?.lineId === line.id ? lineEditor : null;
    return (
      <View key={line.id} style={{ gap: 6, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{name}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {line.kind === 'partita' ? <Badge text="Partita sfusa" tone="info" /> : null}
          <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{line.kind === 'confezioni' ? lineText(line, u) : qty(line.grams, u)}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {line.kind === 'confezioni' ? (
            <>
              <Action title="−1" label={`Una confezione in meno di ${name} nell’acquisto`} onPress={() => change((p) => draftChangePackages(p, line.id, -1, new Date()))} />
              <Action title="+1" label={`Una confezione in più di ${name} nell’acquisto`} onPress={() => change((p) => draftChangePackages(p, line.id, 1, new Date()))} />
            </>
          ) : null}
          <Action
            title="Modifica"
            label={`Modifica ${name} nell’acquisto`}
            onPress={() => {
              setEditError(null);
              setLineEditor({ lineId: line.id, packages: String(line.packages), size: plain(line.packageSize), grams: plain(line.grams) });
            }}
          />
          <Action title="Togli" label={`Togli ${name} dall’acquisto`} tone="danger" onPress={() => change((p) => draftRemoveLine(p, line.id, new Date()))} />
        </View>
        {open ? (
          <View style={{ gap: 6 }}>
            {line.kind === 'confezioni' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <SmallInput value={open.packages} onChangeText={(t) => setLineEditor({ ...open, packages: t })} label={`Numero di confezioni ${name}`} width={70} />
                <Text style={{ color: colors.muted }}>confezioni da</Text>
                <SmallInput value={open.size} onChangeText={(t) => setLineEditor({ ...open, size: t })} label={`Formato della confezione ${name}`} />
                <Text style={{ color: colors.muted }}>{unitWord(u)}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <SmallInput value={open.grams} onChangeText={(t) => setLineEditor({ ...open, grams: t })} label={`Quantità della partita ${name}`} width={100} />
                <Text style={{ color: colors.muted }}>{unitWord(u)}</Text>
              </View>
            )}
            {editError ? <Text style={{ color: colors.danger, fontSize: 14 }}>{editError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Action title="Salva" label={`Salva ${name}`} onPress={() => saveLine(line)} />
              <Action title="Annulla" label="Annulla" onPress={() => setLineEditor(null)} />
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  // ------------------------------------------------ consumo
  const consumeTyped = (lot: PantryLot, field: 'remaining' | 'consumed', text: string) => {
    const v = parseDecimal(text);
    const res = typeof v === 'number' ? partialValues(lotAmount(lot), field === 'remaining' ? { remaining: v } : { consumed: v }) : null;
    const other = field === 'remaining' ? 'consumed' : 'remaining';
    setConsume({ lotId: lot.id, remaining: '', consumed: '', [field]: text, [other]: res ? plain(res[other]) : '', last: field } as ConsumeEditor);
  };

  const saveConsume = (lot: PantryLot) => {
    if (!consume || !consume.last) return setEditError('Scrivi quanto resta oppure quanto hai consumato.');
    const v = parseDecimal(consume.last === 'remaining' ? consume.remaining : consume.consumed);
    const u = unitOf(lot.key);
    const total = lotAmount(lot);
    const input = consume.last === 'remaining' ? { remaining: typeof v === 'number' ? v : NaN } : { consumed: typeof v === 'number' ? v : NaN };
    const res = partialValues(total, input);
    if (!res) return setEditError(`Scrivi un numero tra 0 e ${qty(total, u)}.`);
    if (!(res.consumed > 0)) return setEditError('Non risulta consumato niente.');
    const now = new Date();
    change((p) => consumePartial(p, lot.id, input, { resto: generateId(now), history: generateId(now) }, now));
    setConsume(null);
    setEditError(null);
  };

  const renderLot = (lot: PantryLot, u: 'g' | 'capsule', name: string) => {
    const open = consume?.lotId === lot.id ? consume : null;
    const finished = () => {
      const now = new Date();
      change((p) => packageFinished(p, lot.id, generateId(now), now));
      if (open) setConsume(null);
    };
    const actions = (
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Action
          title={lot.kind === 'confezioni' ? 'Confezione finita' : 'Finita'}
          label={lot.kind === 'confezioni' ? `Confezione finita di ${name} da ${qty(lot.packageSize, u)}` : `Finita ${lot.kind === 'partita' ? 'la partita' : 'il resto'} di ${name}`}
          tone="danger"
          onPress={finished}
        />
        <Action
          title="Consumata in parte"
          label={`Consumata in parte ${name}${lot.kind === 'confezioni' ? ` da ${qty(lot.packageSize, u)}` : ''}`}
          onPress={() => {
            setEditError(null);
            setConsume({ lotId: lot.id, remaining: '', consumed: '', last: null });
          }}
        />
      </View>
    );
    const editor = open ? (
      <View style={{ gap: 6, marginTop: 4 }}>
        <Hint>Scrivi uno dei due: l’altro si calcola da solo (in tutto {qty(lotAmount(lot), u)}).</Hint>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: colors.muted, width: 110 }}>Restano</Text>
          <SmallInput value={open.remaining} onChangeText={(t) => consumeTyped(lot, 'remaining', t)} label={`Quanto resta di ${name}`} width={100} />
          <Text style={{ color: colors.muted }}>{unitWord(u)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: colors.muted, width: 110 }}>Ho consumato</Text>
          <SmallInput value={open.consumed} onChangeText={(t) => consumeTyped(lot, 'consumed', t)} label={`Quanto hai consumato di ${name}`} width={100} />
          <Text style={{ color: colors.muted }}>{unitWord(u)}</Text>
        </View>
        {lot.kind === 'confezioni' ? <Hint>Le confezioni intere restano; quella aperta diventa una riga «Resto».</Hint> : null}
        {editError ? <Text style={{ color: colors.danger, fontSize: 14 }}>{editError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Action title="Salva" label={`Salva il consumo di ${name}`} onPress={() => saveConsume(lot)} />
          <Action title="Annulla" label="Annulla" onPress={() => setConsume(null)} />
        </View>
      </View>
    ) : null;

    if (lot.kind === 'confezioni') {
      return (
        <View key={lot.id} style={{ gap: 6, paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>
              {packagesText(lot.packages)} da {qty(lot.packageSize, u)}
            </Text>
            <Text style={{ fontSize: 15, color: colors.muted }}>{qty(lotAmount(lot), u)}</Text>
          </View>
          {actions}
          {editor}
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
          <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{partita ? (lot.day ? `del ${formatDay(lot.day)}` : '') : 'confezione aperta'}</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{qty(lot.amount, u)}</Text>
        </View>
        {partita && lot.bought > 0 ? <Hint>Acquistati {qty(lot.bought, u)}, restano {qty(lot.amount, u)}.</Hint> : null}
        {actions}
        {editor}
      </View>
    );
  };

  const allGroups = applyPantryOrder(pantryGroups(pantry, catalog), order?.length ? order : pantryRecentOrder(pantry));
  const groups = searchPantryGroups(allGroups, search);
  const history = visibleHistory(pantry, new Date());
  const sessions = [...pantry.sessions].sort((a, b) => b.day.localeCompare(a.day) || b.confirmedAt.localeCompare(a.confirmedAt));

  return (
    <Screen>
      <Button title={`🛒 ${SHOPPING_BUTTON}`} onPress={() => router.push(SHOPPING_HREF)} />

      <Explain>
        Quanto hai in casa di ogni ingrediente, nello stesso peso delle ricette (per le verdure cotte, il peso cotto). Quando fai la
        spesa registri l’acquisto e lo confermi; quando consumi usi «Confezione finita» o «Consumata in parte» sulle righe. Il diario non
        scala niente.
      </Explain>

      {draft ? (
        <Notice tone="warning">
          {editing
            ? `Stai modificando l’acquisto del ${formatDay(draft.day)}: le modifiche non sono ancora in dispensa. Tocca «Salva le modifiche» più sotto.`
            : `Acquisto del ${formatDay(draft.day)} non ancora confermato (${draft.lines.length} ${draft.lines.length === 1 ? 'prodotto' : 'prodotti'}): non è ancora in dispensa. Tocca «Ho finito di registrare gli acquisti» più sotto.`}
        </Notice>
      ) : null}
      {notice ? <Notice tone="info">{notice}</Notice> : null}

      <Card title="In dispensa">
        {allGroups.length > 0 ? (
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca"
            accessibilityLabel="Cerca nella dispensa"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
            style={styles.input}
          />
        ) : null}
        {allGroups.length === 0 ? <Hint>La dispensa è vuota.</Hint> : null}
        {allGroups.length > 0 && groups.length === 0 ? <Hint>Nessun prodotto trovato.</Hint> : null}
        {groups.map(({ key, name, unit: u, total, lots }) => (
          <View key={key} style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.text }}>{name}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{qty(total, u)}</Text>
            </View>
            {lots.map((lot) => renderLot(lot, u, name))}
          </View>
        ))}
        {allGroups.length > 1 && !search ? <Hint>In cima i prodotti usati o comprati più di recente.</Hint> : null}
      </Card>

      <Card title={editing && draft ? `Modifica l’acquisto del ${formatDay(draft.day)}` : 'Registra acquisti'}>
        <DayStepper
          label="Data dell’acquisto"
          value={day}
          today={today}
          onChange={(d) => (draft ? change((p) => draftSetDay(p, d, new Date())) : setFormDay(d))}
        />
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
            {preview !== null ? <Hint>Totale: {qty(preview, unit)}. Stesso prodotto e stesso formato si sommano in un’unica riga.</Hint> : null}
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
        <Button title="Aggiungi all’acquisto" kind="secondary" onPress={addLine} />

        {draft && draft.lines.length > 0 ? (
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 }}>Prodotti di questo acquisto</Text>
            <Hint>Qui puoi correggere liberamente: le correzioni non vanno nello storico.</Hint>
            {draft.lines.map(renderDraftLine)}
          </View>
        ) : null}
        {draft && draft.lines.length === 0 && editing ? <Hint>Hai tolto tutti i prodotti: salvando, l’acquisto viene annullato.</Hint> : null}

        {draft ? (
          <>
            <Button title={editing ? 'Salva le modifiche' : 'Ho finito di registrare gli acquisti'} onPress={finish} disabled={!editing && draft.lines.length === 0} />
            <Action
              title={editing ? 'Annulla le modifiche' : 'Scarta questo acquisto'}
              label={editing ? 'Annulla le modifiche' : 'Scarta questo acquisto'}
              tone="danger"
              onPress={() =>
                confirmAsk(
                  editing ? 'Annullare le modifiche?' : 'Scartare questo acquisto?',
                  editing ? 'L’acquisto resta com’era.' : 'I prodotti inseriti non entrano in dispensa.',
                  editing ? 'Annulla le modifiche' : 'Scarta',
                  () => {
                    change(discardDraft);
                    setLineEditor(null);
                  },
                )
              }
            />
          </>
        ) : null}
      </Card>

      {sessions.length > 0 ? (
        <Card title="Acquisti confermati">
          <Hint>Ultimi 3 mesi. Se modifichi un acquisto, la dispensa si aggiorna e lo storico registra la correzione.</Hint>
          {sessions.map((s) => (
            <View key={s.id} style={{ gap: 4, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>Acquisto del {formatDay(s.day)}</Text>
                {draft ? null : (
                  <Action
                    title="Modifica"
                    label={`Modifica l’acquisto del ${formatDay(s.day)}`}
                    onPress={() => {
                      change((p) => startEditPurchase(p, s.id, new Date()));
                      setNotice(null);
                    }}
                  />
                )}
              </View>
              {purchaseByProduct(s.lines, catalog).map((text) => (
                <Hint key={text}>{text}</Hint>
              ))}
            </View>
          ))}
          {draft ? <Hint>Per modificare un acquisto, prima conferma o scarta quello in corso.</Hint> : null}
        </Card>
      ) : null}

      <Card title="Storico">
        {history.length === 0 ? <Hint>Ancora niente: qui compaiono gli acquisti confermati, le modifiche e i consumi degli ultimi 3 mesi.</Hint> : null}
        {history.map((e) => (
          <View key={e.id} style={{ gap: 4, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border, alignItems: 'flex-start' }}>
            <Badge text={HISTORY_LABEL[e.type]} tone={HISTORY_TONE[e.type]} />
            <Text style={{ fontSize: 15, color: colors.text }}>{historyText(e, catalog)}</Text>
          </View>
        ))}
      </Card>

      <CatalogPicker
        visible={picking}
        all
        exclude={[]}
        onClose={() => setPicking(false)}
        onPick={(item) => {
          const known = draft?.lines.find((l) => l.key === item.key && l.kind === 'confezioni')?.packageSize ?? lastPackageSize(pantry, item.key);
          setBuy((b) => ({ ...b, item, size: known ? plain(known) : b.size }));
          setPicking(false);
        }}
      />
    </Screen>
  );
}
