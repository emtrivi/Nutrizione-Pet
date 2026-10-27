// Passo 4: grammi, barre dei nutrienti, rapporti, integratori e prezzo.
// Ogni cambio di grammi aggiorna subito tutto; nulla viene bloccato.

import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { parseDecimal } from '../../data/dogForm';
import {
  fediaf,
  getCatalog,
  RECIPE_CATEGORY_LABELS,
  substituteGrams,
  shortName,
  startingDose,
  summaryText,
  unitPrice,
  type CatalogItem,
  type NutrientView,
  type PriceBook,
  type RecipeCategory,
  type RecipeEvaluation,
} from '../../engine';
import { NutrientBarRow, Bar } from '../NutrientBar';
import { Badge, Button, Card, Hint, InfoButton, Notice, Row, styles } from '../components';
import { formatEuro, formatFixedUnit, formatNumber, formatSmart, priceRateText } from '../format';
import { colors } from '../theme';
import { draftLines, type Draft, type DraftLine } from './draft';
import { NutrientDetail } from './NutrientDetail';
import { describeDose } from './doseText';
import { CatalogPicker } from './Pickers';

const catalog = getCatalog();
const DOT = { verde: colors.green, arancione: colors.orange, rosso: colors.red, grigio: colors.grey };

const SLIDER_DEFAULT_MAX: Record<string, number> = { proteica: 1000, energetica: 800, verdure: 300, grassi: 60, frattaglie: 200, altro: 300 };

function AmountControl({
  value,
  unit,
  step,
  sliderMax,
  label,
  onChange,
}: {
  value: number;
  unit: 'g' | 'capsule';
  step: number;
  sliderMax: number;
  label: string;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? formatSmart(value);
  const commit = (t: string) => {
    const v = parseDecimal(t);
    if (typeof v === 'number') onChange(unit === 'capsule' ? Math.round(v) : v);
    setText(null);
  };
  const bump = (d: number) => onChange(Math.max(0, Math.round((value + d) * 10) / 10));
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Meno ${label}`} onPress={() => bump(-step)} style={stepBtn}>
          <Text style={stepTxt}>−</Text>
        </Pressable>
        <TextInput
          value={shown}
          onChangeText={setText}
          onEndEditing={(e) => commit(e.nativeEvent.text)}
          onBlur={() => text !== null && commit(text)}
          keyboardType="decimal-pad"
          accessibilityLabel={`Quantità ${label}`}
          style={[styles.input, { width: 90, textAlign: 'center', paddingVertical: 6 }]}
        />
        <Text style={{ fontSize: 15, color: colors.text }}>{unit === 'capsule' ? (value === 1 ? 'capsula' : 'capsule') : 'g'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Più ${label}`} onPress={() => bump(step)} style={stepBtn}>
          <Text style={stepTxt}>+</Text>
        </Pressable>
      </View>
      <Slider
        minimumValue={0}
        maximumValue={Math.max(sliderMax, value)}
        step={unit === 'capsule' ? 1 : step}
        value={value}
        onValueChange={(v) => onChange(unit === 'capsule' ? Math.round(v) : Math.round(v * 10) / 10)}
        minimumTrackTintColor={colors.primary}
        accessibilityLabel={`Barra ${label}`}
      />
    </View>
  );
}

const stepBtn = {
  width: 40,
  height: 40,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: colors.primary,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const stepTxt = { fontSize: 22, color: colors.primary, lineHeight: 24 };

function costText(item: CatalogItem, amount: number, prices: PriceBook): string {
  const e = prices[item.key];
  const p = e ? unitPrice(e, item.doseUnit) : null;
  return p === null ? 'prezzo non inserito' : `${formatEuro(p * amount)} (${priceRateText(e, item.doseUnit)})`;
}

/** Ordine degli ingredienti nel passo 4: come le sezioni del passo 3 (dentro la sezione, l'ordine di scelta). */
const CATEGORY_ORDER: RecipeCategory[] = ['proteica', 'energetica', 'verdure', 'grassi', 'frattaglie', 'altro'];
const categoryRank = (key: string) => CATEGORY_ORDER.indexOf(catalog.get(key)?.recipeCategory ?? 'altro');

/** Barra della dose: verde fino al massimo del produttore, rossa oltre (non blocca). */
function DoseBar({ dose, max }: { dose: number; max: number }) {
  const pos = dose <= max ? (dose / max) * 0.5 : 0.5 + Math.min(1, (dose - max) / max) * 0.5;
  return <Bar bar={{ segments: ['verde', 'rosso'], position: pos }} partial={false} />;
}

function valueText(v: NutrientView): string {
  const ev = v.evaluation;
  if (ev.valuePer1000 === null) return v.total.value === null ? 'non disponibile' : '—';
  return `${v.total.partial ? 'almeno ' : ''}${formatFixedUnit(ev.valuePer1000, v.def.unit)}`;
}

function subtitle(v: NutrientView): string | undefined {
  const parts: string[] = [];
  if (v.total.value !== null) parts.push(`al giorno ${formatFixedUnit(v.total.value, v.def.unit)}`);
  if (v.evaluation.limitsPer1000.min !== null) parts.push(`min ${formatSmart(v.evaluation.limitsPer1000.min)}`);
  if (v.evaluation.limitsPer1000.max !== null) parts.push(`max ${v.evaluation.maxKind ?? ''} ${formatSmart(v.evaluation.limitsPer1000.max)}`.replace('  ', ' '));
  if (v.total.toVerify) parts.push('da verificare');
  return parts.join(' · ') || undefined;
}

export function Step4({
  draft,
  set,
  ev,
  prices,
  dogWeightKg,
  onRecalculate,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  ev: RecipeEvaluation;
  prices: PriceBook;
  dogWeightKg: number;
  onRecalculate: () => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<NutrientView | null>(null);
  const [picking, setPicking] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { data } = useData();

  // Ricetta così com'è adesso, per i suggerimenti con anteprima.
  const suggestInput = useMemo(
    () => ({ lines: draftLines(draft), kcalTarget: ev.kcal.target, table: ev.requirements.table, overrides: draft.overrides, dogWeightKg }),
    [draft, ev.kcal.target, ev.requirements.table, dogWeightKg],
  );
  const suggestCtx = useMemo(() => ({ catalog, fediaf, settings: data.settings, prices }), [data.settings, prices]);
  const deficits = ev.groups
    .flatMap((g) => g.items)
    .filter((v) => v.def.inFediaf && v.evaluation.direction === 'carenza' && (v.evaluation.color === 'rosso' || v.evaluation.color === 'arancione'));

  const addSupplement = (key: string, dose: number) => {
    const exists = draft.supplements.some((x) => x.key === key);
    set({ supplements: exists ? draft.supplements.map((x) => (x.key === key ? { ...x, amount: dose } : x)) : [...draft.supplements, { key, amount: dose }] });
    setDetail(null);
    const item = catalog.get(key);
    setNotice(`Aggiunto: ${item ? shortName(item) : key} ${formatSmart(dose)} ${item?.doseUnit === 'capsule' ? 'capsule' : 'g'}. Controlla le barre.`);
  };

  const addFood = (key: string, grams: number) => {
    set({ foods: [...draft.foods, { key, amount: grams }] });
    setDetail(null);
    const item = catalog.get(key);
    setNotice(`Aggiunto: ${item ? shortName(item) : key} ${formatSmart(grams)} g (${item ? RECIPE_CATEGORY_LABELS[item.recipeCategory].toLowerCase() : 'alimento'}). Le calorie salgono: controlla le barre ed eventualmente riduci gli altri alimenti.`);
  };

  const updateLine = (field: 'foods' | 'supplements', key: string, amount: number) =>
    set({ [field]: draft[field].map((l: DraftLine) => (l.key === key ? { ...l, amount } : l)) } as Partial<Draft>);

  return (
    <View style={{ gap: 12 }}>
      <Card title="Riepilogo" right={<InfoButton topic="legenda" label="Colori e segni" />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: DOT[ev.kcal.color] }} />
          <Text style={{ fontSize: 16, color: colors.text, flex: 1 }}>
            {ev.kcal.value !== null ? `${formatNumber(ev.kcal.value)} kcal` : 'kcal sconosciute'} su {formatNumber(ev.kcal.target)}
            {ev.kcal.diffPct !== null ? ` (${ev.kcal.diffPct >= 0 ? '+' : ''}${formatNumber(ev.kcal.diffPct, 1)}%)` : ''}
          </Text>
        </View>
        <Hint>Calorie: verde entro il 5% dall’obiettivo, arancione entro il 10%.</Hint>
        <Text style={{ fontSize: 15, color: colors.text }}>Nutrienti: {summaryText(ev.summary) || '—'}</Text>
        <Text style={{ fontSize: 15, color: colors.text }}>
          Prezzo al giorno:{' '}
          {ev.cost.lines.every((l) => l.cost === null)
            ? 'nessun prezzo inserito (si scrive nel Catalogo)'
            : `${formatEuro(ev.cost.total)}${ev.cost.incomplete ? ' — incompleto (mancano dei prezzi)' : ''}`}
        </Text>
      </Card>

      <Card title="Ingredienti">
        <Hint>Peso nella ciotola, come indicato (crudo o cotto). Cambia i grammi con la barra o scrivendo il numero.</Hint>
        {[...draft.foods].sort((a, b) => categoryRank(a.key) - categoryRank(b.key)).map((l) => {
          const item = catalog.get(l.key);
          if (!item) return null;
          const amount = l.amount ?? 0;
          return (
            <View key={l.key} style={{ gap: 4, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{item.nameIt}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Sostituisci ${item.nameIt}`} hitSlop={8} onPress={() => setReplacing(l.key)}>
                  <Text style={{ color: colors.primary, fontSize: 14 }}>Sostituisci</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Badge text={item.processingLabel ?? ''} tone="info" />
                {item.indicative ? <Badge text="dato indicativo" tone="warning" /> : null}
                <Text style={{ fontSize: 13, color: colors.muted }}>{costText(item, amount, prices)}</Text>
              </View>
              <AmountControl
                label={shortName(item)}
                value={amount}
                unit="g"
                step={item.recipeCategory === 'grassi' ? 1 : 5}
                sliderMax={Math.max(SLIDER_DEFAULT_MAX[item.recipeCategory] ?? 300, Math.ceil((amount * 2) / 50) * 50)}
                onChange={(v) => updateLine('foods', l.key, v)}
              />
            </View>
          );
        })}
        <Button title="Ricalcola i grammi di partenza" kind="secondary" onPress={onRecalculate} />
      </Card>

      {notice ? <Notice tone="info">{notice}</Notice> : null}

      {deficits.length > 0 ? (
        <Card title="Suggerimenti">
          <Hint>Nutrienti in carenza: tocca per vedere gli integratori e gli alimenti che li contengono e cosa cambierebbe.</Hint>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {deficits.map((v) => (
              <Pressable
                key={v.def.id}
                accessibilityRole="button"
                onPress={() => setDetail(v)}
                style={[styles.segment, { borderColor: v.evaluation.color === 'rosso' ? colors.red : colors.orange }]}
              >
                <Text style={styles.segmentText}>{v.def.nameIt}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {ev.sanity.map((w) => (
        <Notice key={w} tone="warning">
          {w} (avviso, non blocca)
        </Notice>
      ))}

      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Nutrienti</Text>
      <Hint>Valori ogni 1.000 kcal della ricetta, confrontati con la tabella FEDIAF {ev.requirements.table}. Tocca un nutriente per i dettagli.</Hint>
      {ev.groups.map((g) => {
        const problems = g.items.filter((v) => v.def.inFediaf && (v.evaluation.color === 'rosso' || v.evaluation.color === 'arancione')).length;
        const isOpen = open[g.group] ?? problems > 0;
        return (
          <Card key={g.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => setOpen((o) => ({ ...o, [g.group]: !isOpen }))}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 }}>{g.label}</Text>
              {problems > 0 ? <Badge text={`${problems} da guardare`} tone="danger" /> : null}
              <Text style={{ fontSize: 18, color: colors.primary, marginLeft: 8 }}>{isOpen ? '▾' : '▸'}</Text>
            </Pressable>
            {isOpen
              ? g.items.map((v) => (
                  <NutrientBarRow
                    key={v.def.id}
                    name={v.def.nameIt}
                    valueText={valueText(v)}
                    color={v.evaluation.color}
                    bar={v.bar}
                    partial={v.total.partial}
                    subtitle={subtitle(v)}
                    onPress={() => setDetail(v)}
                  />
                ))
              : null}
          </Card>
        );
      })}

      <Card title="Rapporti">
        <NutrientBarRow
          name="Calcio / fosforo"
          valueText={ev.caP.value !== null ? `${ev.caP.partial ? 'almeno ' : ''}${formatNumber(ev.caP.value, 2)} : 1` : 'non disponibile'}
          color={ev.caP.classification.color}
          bar={ev.caP.bar}
          partial={ev.caP.partial}
          subtitle={`FEDIAF: da ${formatSmart(ev.requirements.caPRatio.min)}:1 a ${formatSmart(ev.requirements.caPRatio.max)}:1 (massimo nutrizionale)`}
        />
        <Text style={{ fontSize: 15, fontWeight: '600', marginTop: 8 }}>Omega-6 / omega-3 (solo informativo)</Text>
        <Row label="Acido linoleico (omega-6)" value={ev.omega.linoleic.value !== null ? `${ev.omega.linoleic.partial ? 'almeno ' : ''}${formatFixedUnit(ev.omega.linoleic.value, 'g')}` : 'non disponibile'} />
        <Row label="Acido alfa-linolenico (omega-3)" value={ev.omega.alphaLinolenic.value !== null ? `${ev.omega.alphaLinolenic.partial ? 'almeno ' : ''}${formatFixedUnit(ev.omega.alphaLinolenic.value, 'g')}` : 'non disponibile'} />
        <Row label="EPA + DHA (omega-3)" value={ev.omega.epaDha.value !== null ? `${ev.omega.epaDha.partial ? 'almeno ' : ''}${formatFixedUnit(ev.omega.epaDha.value, 'g')}` : 'non disponibile'} />
        <Row
          label="Rapporto omega-6 / omega-3"
          value={ev.omega.ratio !== null ? `${formatNumber(ev.omega.ratio, 1)} : 1` : '—'}
          hint={ev.omega.partial ? 'valore parziale: mancano dati in alcuni alimenti. FEDIAF non dà un limite.' : 'FEDIAF non dà un limite.'}
        />
        <Text style={{ fontSize: 15, fontWeight: '600', marginTop: 8 }}>Calorie da proteine, grassi e carboidrati (informativo)</Text>
        {ev.energySplit ? (
          <>
            <Row label="Proteine" value={`${formatNumber(ev.energySplit.protein)}%`} />
            <Row label="Grassi" value={`${formatNumber(ev.energySplit.fat)}%`} />
            <Row label="Carboidrati" value={`${formatNumber(ev.energySplit.carbohydrate)}%`} hint={ev.energySplit.partial ? 'valore parziale' : 'calcolo 4/9/4'} />
          </>
        ) : (
          <Hint>Non disponibile.</Hint>
        )}
      </Card>

      <Card title="Integratori">
        <Hint>Si aggiungono dopo aver visto grammi e nutrienti. La dose proposta è quella del produttore: è un’indicazione d’uso, non un limite, e non viene mai bloccata.</Hint>
        {draft.supplements.map((l) => {
          const item = catalog.get(l.key);
          if (!item) return null;
          const amount = l.amount ?? 0;
          const s = ev.supplements.find((x) => x.key === l.key);
          const max = s && s.suggestion.kind !== 'none' ? s.suggestion.max : null;
          return (
            <View key={l.key} style={{ gap: 4, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{item.nameIt}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Togli ${item.nameIt}`} onPress={() => set({ supplements: draft.supplements.filter((x) => x.key !== l.key) })}>
                  <Text style={{ color: colors.danger }}>Togli</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {item.provisional ? <Badge text="dato provvisorio" tone="warning" /> : null}
                <Text style={{ fontSize: 13, color: colors.muted }}>{costText(item, amount, prices)}</Text>
              </View>
              {s ? <Hint>{describeDose(s.suggestion, dogWeightKg)}</Hint> : null}
              <AmountControl
                label={shortName(item)}
                value={amount}
                unit={item.doseUnit}
                step={item.doseUnit === 'capsule' ? 1 : 0.5}
                sliderMax={max !== null ? Math.max(max * 2, 1) : item.doseUnit === 'capsule' ? 6 : 20}
                onChange={(v) => updateLine('supplements', l.key, v)}
              />
              {max !== null ? <DoseBar dose={amount} max={max} /> : null}
              {s?.status === 'oltre_massimo_produttore' ? (
                <Text style={{ color: colors.red, fontSize: 13 }}>Oltre il massimo consigliato dal produttore (indicazione d’uso, non limite tossicologico).</Text>
              ) : null}
            </View>
          );
        })}
        <Button title="Aggiungi un integratore" kind="secondary" onPress={() => setPicking(true)} />
      </Card>

      <CatalogPicker
        visible={picking}
        supplements
        exclude={draft.supplements.map((s) => s.key)}
        onClose={() => setPicking(false)}
        onPick={(item) => {
          const start = startingDose(item, dogWeightKg).amount;
          set({ supplements: [...draft.supplements, { key: item.key, amount: start }] });
          setPicking(false);
        }}
      />
      <CatalogPicker
        visible={replacing !== null}
        category={replacing ? catalog.get(replacing)?.recipeCategory : undefined}
        exclude={draft.foods.map((f) => f.key)}
        onClose={() => setReplacing(null)}
        onPick={(newItem) => {
          const oldLine = draft.foods.find((f) => f.key === replacing);
          const oldItem = replacing ? catalog.get(replacing) : undefined;
          setReplacing(null);
          if (!oldLine || !oldItem) return;
          const r = substituteGrams(oldItem, oldLine.amount ?? 0, newItem);
          set({ foods: draft.foods.map((f) => (f.key === oldItem.key ? { key: newItem.key, amount: r.grams } : f)) });
          setNotice(
            `Sostituito: ${shortName(oldItem)} ${formatSmart(oldLine.amount ?? 0)} g → ${shortName(newItem)} ${formatSmart(r.grams)} g` +
              (r.sameKcal ? ' (stesse calorie).' : ' (stessi grammi: calorie non note).'),
          );
        }}
      />
      <NutrientDetail
        view={detail}
        recipeKcal={ev.kcal.value}
        onClose={() => setDetail(null)}
        suggest={{ input: suggestInput, ctx: suggestCtx, onAdd: addSupplement, onAddFood: addFood }}
      />
    </View>
  );
}
