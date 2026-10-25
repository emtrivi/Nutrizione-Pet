// Passi 1, 2 e 3 della ricetta guidata.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { parseDecimal } from '../../data/dogForm';
import {
  GROUP_LABELS,
  GROUP_ORDER,
  NUTRIENTS,
  RECIPE_CATEGORY_LABELS,
  getCatalog,
  type Dog,
  type RecipeCategory,
  type Requirement,
  type RequirementOverride,
  type RequirementsResult,
} from '../../engine';
import { Badge, Button, Card, Field, Hint, InfoButton, Notice, Row, Segmented } from '../components';
import { formatFixedUnit, formatNumber, formatSmart, unitLabel } from '../format';
import { colors } from '../theme';
import type { Draft, draftEnergy } from './draft';
import { CatalogPicker } from './Pickers';

const catalog = getCatalog();

/** Fascia in alto: passo, cosa si fa, perché, cosa fare adesso. */
export function StepBand({ step, title, what, why, now }: { step: number; title: string; what: string; why: string; now: string }) {
  return (
    <View style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 12, gap: 4 }}>
      <Text style={{ color: '#D6E8DE', fontSize: 13, fontWeight: '600' }}>Passo {step} di 4</Text>
      <Text style={{ color: '#fff', fontSize: 19, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>
        {what} <Text style={{ fontStyle: 'italic' }}>{why}</Text>
      </Text>
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20 }}>Adesso: {now}</Text>
    </View>
  );
}

type Energy = ReturnType<typeof draftEnergy>;

// ---------------------------------------------------------------------------
// Passo 1: calorie

export function Step1({ draft, dog, energy, set }: { draft: Draft; dog: Dog; energy: Energy; set: (p: Partial<Draft>) => void }) {
  return (
    <Card title={`Calorie per ${dog.name}`} right={<InfoButton topic="tabella" label="Tabella FEDIAF" />}>
      <Row label="Kcal del cane (profilo)" value={`${formatNumber(energy.dogEnergy.kcalPerDay)} kcal`} hint={`tabella del cane: ${energy.dogEnergy.table}`} />
      <Field
        label="Kcal al giorno per questa ricetta"
        value={draft.kcalText}
        onChangeText={(t) => set({ kcalText: t })}
        keyboardType="decimal-pad"
        placeholder={`${Math.round(energy.dogEnergy.kcalPerDay)} (quelle del cane)`}
        error={energy.kcalInvalid ? 'Scrivi solo un numero.' : undefined}
        hint="Vuoto = le kcal del profilo del cane."
      />
      <Segmented
        label="Tabella FEDIAF per questa ricetta"
        options={[
          { value: 'auto', label: `Automatica (${energy.proposedTable})` },
          { value: 95, label: '95' },
          { value: 110, label: '110' },
        ]}
        value={draft.tableMode}
        onChange={(m) => set({ tableMode: m })}
      />
      <Row label="Kcal usate" value={`${formatNumber(energy.kcalTarget)} kcal`} />
      <Row label="Fattore" value={formatNumber(energy.factorRounded)} />
      <Row label="Tabella in uso" value={String(energy.table)} />
      {energy.belowReference ? (
        <Notice tone="warning">Calorie sotto il riferimento FEDIAF: i nutrienti totali potrebbero risultare insufficienti.</Notice>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Passo 2: fabbisogni (modificabili, con "ripristina FEDIAF")

function OverrideEditor({
  req,
  current,
  onSave,
  onReset,
}: {
  req: Requirement;
  current: RequirementOverride | undefined;
  onSave: (o: RequirementOverride) => void;
  onReset: () => void;
}) {
  const [min, setMin] = useState(current?.min != null ? String(current.min).replace('.', ',') : '');
  const [max, setMax] = useState(current?.max != null ? String(current.max).replace('.', ',') : '');
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: 8, paddingVertical: 6 }}>
      <Field
        label={`Minimo ogni 1.000 kcal (${unitLabel(req.unit)})`}
        value={min}
        onChangeText={setMin}
        keyboardType="decimal-pad"
        placeholder={req.fediafMinPer1000 !== null ? `FEDIAF: ${formatSmart(req.fediafMinPer1000)}` : 'nessuno'}
      />
      <Field
        label={`Massimo ogni 1.000 kcal (${unitLabel(req.unit)}, facoltativo)`}
        value={max}
        onChangeText={setMax}
        keyboardType="decimal-pad"
        placeholder={req.maxNPer1000 !== null ? `FEDIAF N: ${formatSmart(req.maxNPer1000)}` : 'nessuno'}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Usa questi valori"
            onPress={() => {
              const a = parseDecimal(min);
              const b = parseDecimal(max);
              if (a === 'invalid' || b === 'invalid') return setError('Scrivi solo numeri, es. 1,5.');
              if (a === undefined && b === undefined) return setError('Scrivi almeno un valore, oppure ripristina FEDIAF.');
              setError(null);
              const o: RequirementOverride = {};
              if (a !== undefined) o.min = a;
              if (b !== undefined) o.max = b;
              onSave(o);
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Ripristina FEDIAF" kind="secondary" onPress={onReset} />
        </View>
      </View>
    </View>
  );
}

export function Step2({ req, draft, set }: { req: RequirementsResult; draft: Draft; set: (p: Partial<Draft>) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ proteine: true });
  const [editing, setEditing] = useState<string | null>(null);
  const modifiedCount = Object.keys(draft.overrides).length;
  return (
    <View style={{ gap: 12 }}>
      {modifiedCount > 0 ? <Notice tone="info">Valori modificati in questa ricetta: {modifiedCount}.</Notice> : null}
      {GROUP_ORDER.map((g) => {
        const isOpen = !!open[g];
        return (
          <Card key={g}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => setOpen((o) => ({ ...o, [g]: !isOpen }))}
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{GROUP_LABELS[g]}</Text>
              <Text style={{ fontSize: 18, color: colors.primary }}>{isOpen ? '▾' : '▸'}</Text>
            </Pressable>
            {isOpen
              ? NUTRIENTS.filter((n) => n.group === g).map((n) => {
                  const r = req.byId[n.id] as Requirement;
                  return (
                    <View key={n.id} style={{ paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ flex: 1, fontSize: 15, color: r.informative ? colors.grey : colors.text }}>{r.nameIt}</Text>
                        {r.modified ? <Badge text="modificato" tone="info" /> : null}
                        <Pressable accessibilityRole="button" onPress={() => setEditing(editing === n.id ? null : n.id)} hitSlop={8}>
                          <Text style={{ color: colors.primary, fontSize: 14 }}>{editing === n.id ? 'Chiudi' : 'Modifica'}</Text>
                        </Pressable>
                      </View>
                      <Text style={{ fontSize: 13, color: colors.muted }}>
                        {r.minPer1000 !== null
                          ? `min ${formatSmart(r.minPer1000)} ${unitLabel(r.unit)} ogni 1.000 kcal · ${formatFixedUnit(r.perDay.min as number, r.unit)} al giorno`
                          : r.informative
                            ? 'nessun riferimento FEDIAF'
                            : 'nessun minimo'}
                        {r.maxCustomPer1000 !== null ? ` · max ${formatSmart(r.maxCustomPer1000)} (modificato)` : ''}
                        {r.maxNPer1000 !== null ? ` · max N ${formatSmart(r.maxNPer1000)}` : ''}
                        {r.maxLPer100gDM !== null ? ` · max L ${formatSmart(r.maxLPer100gDM)} per 100 g SS` : ''}
                      </Text>
                      {editing === n.id ? (
                        <OverrideEditor
                          req={r}
                          current={draft.overrides[n.id]}
                          onSave={(o) => {
                            set({ overrides: { ...draft.overrides, [n.id]: o } });
                            setEditing(null);
                          }}
                          onReset={() => {
                            const { [n.id]: _x, ...rest } = draft.overrides;
                            set({ overrides: rest });
                            setEditing(null);
                          }}
                        />
                      ) : null}
                    </View>
                  );
                })
              : null}
          </Card>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Passo 3: ingredienti per categoria

const STEP3_CATEGORIES: RecipeCategory[] = ['proteica', 'energetica', 'verdure', 'grassi', 'frattaglie'];

export function Step3({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const [picking, setPicking] = useState<RecipeCategory | null>(null);
  const chosen = draft.foods.map((f) => f.key);
  return (
    <View style={{ gap: 12 }}>
      {STEP3_CATEGORIES.map((cat) => {
        const items = draft.foods.map((f) => catalog.get(f.key)).filter((i) => i && i.recipeCategory === cat);
        return (
          <Card key={cat} title={RECIPE_CATEGORY_LABELS[cat]}>
            {items.length === 0 ? <Hint>Nessun alimento scelto.</Hint> : null}
            {items.map((i) =>
              i ? (
                <View key={i.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 15, color: colors.text }}>{i.nameIt}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Badge text={i.processingLabel ?? ''} tone="info" />
                      {i.indicative ? <Badge text="dato indicativo" tone="warning" /> : null}
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Togli ${i.nameIt}`}
                    hitSlop={8}
                    onPress={() => set({ foods: draft.foods.filter((f) => f.key !== i.key) })}
                  >
                    <Text style={{ color: colors.danger, fontSize: 14 }}>Togli</Text>
                  </Pressable>
                </View>
              ) : null,
            )}
            <Button title="Aggiungi" kind="secondary" onPress={() => setPicking(cat)} />
          </Card>
        );
      })}
      <CatalogPicker
        visible={picking !== null}
        category={picking ?? undefined}
        exclude={chosen}
        onClose={() => setPicking(null)}
        onPick={(item) => {
          set({ foods: [...draft.foods, { key: item.key, amount: null }] });
          setPicking(null);
        }}
      />
    </View>
  );
}
