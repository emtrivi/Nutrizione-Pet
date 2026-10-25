import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { useData } from '../../data/DataContext';
import { addDiaryPeriod, deleteDiaryPeriod, generateId } from '../../data/personalStore';
import {
  addDays,
  diaryAverage,
  entryForDay,
  fediaf,
  formatDay,
  getCatalog,
  lastDays,
  localDay,
  makeSnapshot,
  overlapping,
  problemStreaks,
  reviewReasons,
  summaryText,
  weekday,
  type DiaryEntry,
} from '../../engine';
import { NutrientBarRow } from '../../ui/NutrientBar';
import { SnapshotBars } from '../../ui/SnapshotBars';
import { Badge, Button, Card, Explain, Hint, Notice, Screen, Segmented, SwitchRow, styles } from '../../ui/components';
import { formatNumber } from '../../ui/format';
import { colors } from '../../ui/theme';
import { UpdateBanner } from '../../updates/UpdateBanner';

const catalog = getCatalog();
const AVERAGE_OPTIONS = [5, 7, 14, 21, 30].map((n) => ({ value: n, label: `${n} giorni` }));

function confirm(title: string, message: string, yes: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annulla', style: 'cancel' },
    { text: yes, onPress: onYes },
  ]);
}

/** Scelta di un giorno con ‹ › e "Oggi" (nessun componente nativo). */
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
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: giorno dopo`} onPress={() => onChange(addDays(value, 1))} style={btn}>
          <Text style={{ color: colors.primary, fontSize: 18 }}>›</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: oggi`} onPress={() => onChange(today)} hitSlop={6}>
          <Text style={{ color: colors.primary, fontSize: 15 }}>Oggi</Text>
        </Pressable>
      </View>
    </View>
  );
}

const DOT = { verde: colors.green, arancione: colors.orange, rosso: colors.red, grigio: colors.grey };

function counts(summary: DiaryEntry['snapshot']['summary']) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {(['rosso', 'arancione', 'verde', 'grigio'] as const).map((c) =>
        summary[c] ? (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: DOT[c] }} />
            <Text style={{ fontSize: 13, color: colors.muted }}>{summary[c]}</Text>
          </View>
        ) : null,
      )}
    </View>
  );
}

export default function DiarioScreen() {
  const params = useLocalSearchParams<{ dogId?: string; recipeId?: string; t?: string }>();
  const { data, update } = useData();
  const today = localDay(new Date());
  const [dogId, setDogId] = useState<string | null>(params.dogId ?? data.dogs[0]?.id ?? null);
  const dog = data.dogs.find((d) => d.id === dogId) ?? data.dogs[0];
  const [avgDays, setAvgDays] = useState<number>(data.settings.diaryAverageDays);
  const [assigning, setAssigning] = useState<boolean>(!!params.recipeId);
  const [recipeId, setRecipeId] = useState<string | null>(params.recipeId ?? null);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [ongoing, setOngoing] = useState(true);
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  // Arrivando da una ricetta ("Aggiungi al diario"): modulo già pronto per quella ricetta.
  // "t" cambia a ogni richiesta, così il modulo si riapre anche per la stessa ricetta.
  const request = params.recipeId ? `${params.recipeId}-${params.t ?? ''}` : null;
  const [seenRequest, setSeenRequest] = useState(request);
  if (request !== seenRequest) {
    setSeenRequest(request);
    if (request) {
      if (params.dogId) setDogId(params.dogId);
      setRecipeId(params.recipeId ?? null);
      setAssigning(true);
      setMessage(null);
    }
  }

  const entries = useMemo(() => data.diary.filter((e) => e.dogId === dog?.id), [data.diary, dog?.id]);
  const avg = useMemo(
    () => (dog ? diaryAverage(data.diary, dog.id, today, avgDays, data.settings.tolerance) : null),
    [data.diary, dog, today, avgDays, data.settings.tolerance],
  );
  const streaks = useMemo(
    () => (dog ? problemStreaks(data.diary, dog.id, today, data.settings.diaryAlertDays) : []),
    [data.diary, dog, today, data.settings.diaryAlertDays],
  );

  if (!dog) {
    return (
      <Screen>
        <UpdateBanner />
        <Explain>Il diario è per cane: prima aggiungi un cane nella scheda Cani.</Explain>
      </Screen>
    );
  }
  const recipes = data.recipes.filter((r) => r.dogId === dog.id);

  const save = () => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      setMessage({ tone: 'danger', text: 'Scegli una ricetta.' });
      return;
    }
    const end = ongoing ? null : to;
    if (end !== null && end < from) {
      setMessage({ tone: 'danger', text: 'Il giorno di fine viene prima di quello di inizio.' });
      return;
    }
    const now = new Date();
    const entry: DiaryEntry = {
      id: generateId(now),
      dogId: dog.id,
      recipeId: recipe.id,
      from,
      to: end,
      snapshot: makeSnapshot(recipe, dog, { catalog, fediaf, settings: data.settings, prices: data.prices }, now),
      createdAt: now.toISOString(),
    };
    const doIt = () => {
      update((d) => addDiaryPeriod(d, entry));
      setAssigning(false);
      // Il prossimo periodo riparte da oggi, senza ereditare le date di questo.
      setFrom(today);
      setTo(today);
      setOngoing(true);
      setMessage({ tone: 'info', text: `“${recipe.name}” aggiunta al diario ${end ? `dal ${formatDay(from)} al ${formatDay(end)}` : `dal ${formatDay(from)}, in corso`}.` });
    };
    const clash = overlapping(data.diary, dog.id, from, end);
    if (clash.length > 0) {
      const names = [...new Set(clash.map((c) => c.snapshot.recipeName))].join(', ');
      confirm(
        'Sostituire?',
        `In alcuni di questi giorni c’è già: ${names}. Ogni giorno può avere una sola ricetta: quei giorni avranno “${recipe.name}”. Gli altri giorni non cambiano.`,
        'Sostituisci',
        doIt,
      );
    } else doIt();
  };

  const days = lastDays(today, avgDays).reverse();

  return (
    <Screen>
      <UpdateBanner />
      <Explain>
        Il diario segna cosa ha mangiato ogni cane. Assegni una ricetta a un periodo di giorni: l’app ne salva una copia
        fissa, così se poi cambi la ricetta, il cane o il catalogo, il passato non cambia.
      </Explain>

      {data.dogs.length > 1 ? (
        <Segmented options={data.dogs.map((d) => ({ value: d.id, label: d.name }))} value={dog.id} onChange={setDogId} />
      ) : null}

      {streaks.length > 0 ? (
        <Card title="Avvisi nel tempo">
          <Hint>
            Nutrienti rossi o arancioni da almeno {data.settings.diaryAlertDays} giorni di fila (fino a oggi). Un giorno senza
            ricetta interrompe la serie.
          </Hint>
          {streaks.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.worst === 'rosso' ? colors.red : colors.orange }} />
              <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{s.name}</Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>
                {s.direction === 'carenza' ? 'carenza' : s.direction === 'eccesso' ? 'eccesso' : ''} · {s.days} giorni
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {assigning ? (
        <Card title={`Assegna una ricetta a ${dog.name}`}>
          {recipes.length === 0 ? <Hint>{dog.name} non ha ancora ricette salvate.</Hint> : null}
          {recipes.map((r) => {
            const review = reviewReasons(r, data.dogs, catalog, data.settings.multipliers).length > 0;
            const selected = r.id === recipeId;
            return (
              <Pressable
                key={r.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setRecipeId(r.id)}
                style={[styles.segment, { alignItems: 'flex-start' }, selected && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {r.name}
                  {review ? ' (da rivedere)' : ''}
                </Text>
              </Pressable>
            );
          })}
          <DayStepper label="Dal" value={from} onChange={setFrom} today={today} />
          <SwitchRow label="Ancora in corso" value={ongoing} onChange={setOngoing} hint="Acceso: vale da quel giorno in poi, finché non assegni un’altra ricetta." />
          {!ongoing ? <DayStepper label="Al" value={to} onChange={setTo} today={today} /> : null}
          <Button title="Salva nel diario" onPress={save} />
          <Button title="Annulla" kind="secondary" onPress={() => setAssigning(false)} />
        </Card>
      ) : (
        <Button title="Assegna una ricetta" onPress={() => setAssigning(true)} />
      )}

      <Card title="Media">
        <Segmented options={AVERAGE_OPTIONS} value={avgDays} onChange={setAvgDays} />
        {avg && avg.daysWithData > 0 ? (
          <>
            <Text style={{ fontSize: 15, color: colors.text }}>
              Media su {avg.daysWithData} giorni su {avg.daysTotal}
              {avg.kcal !== null ? ` · ${formatNumber(avg.kcal)} kcal al giorno` : ''}
            </Text>
            <Hint>I giorni senza ricetta non contano. Valori ogni 1.000 kcal. Nutrienti: {summaryText(avg.summary)}.</Hint>
            <NutrientBarRow
              name="Calcio / fosforo"
              valueText={avg.caP.value !== null ? `${avg.caP.partial ? 'almeno ' : ''}${formatNumber(avg.caP.value, 2)} : 1` : 'non disponibile'}
              color={avg.caP.color}
              bar={avg.caP.bar}
              partial={avg.caP.partial}
            />
          </>
        ) : (
          <Hint>Nessuna ricetta negli ultimi {avgDays} giorni.</Hint>
        )}
      </Card>
      {avg && avg.daysWithData > 0 ? <SnapshotBars items={avg.nutrients} /> : null}

      <Card title="Periodi">
        {entries.length === 0 ? <Hint>Nessun periodo nel diario.</Hint> : null}
        {[...entries].reverse().map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: colors.text }}>{e.snapshot.recipeName}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                dal {formatDay(e.from)} {e.to ? `al ${formatDay(e.to)}` : '· in corso'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Togli il periodo ${e.snapshot.recipeName}`}
              onPress={() =>
                confirm('Togliere questo periodo?', `“${e.snapshot.recipeName}” dal ${formatDay(e.from)} verrà tolto dal diario.`, 'Togli', () =>
                  update((d) => deleteDiaryPeriod(d, e.id)),
                )
              }
            >
              <Text style={{ color: colors.danger }}>Togli</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Card title={`Giorno per giorno (ultimi ${avgDays})`}>
        {days.map((day) => {
          const e = entryForDay(data.diary, dog.id, day, today);
          return (
            <Link key={day} href={{ pathname: '/diario/giorno', params: { dogId: dog.id, day } }} asChild disabled={!e}>
              <Pressable accessibilityRole="link" style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, color: colors.text }}>
                    {weekday(day)} {formatDay(day)}
                  </Text>
                  {e ? <Text style={{ fontSize: 22, color: colors.grey, lineHeight: 22 }}>›</Text> : null}
                </View>
                {e ? (
                  <>
                    <Text style={{ fontSize: 14, color: colors.text }}>{e.snapshot.recipeName}</Text>
                    {counts(e.snapshot.summary)}
                  </>
                ) : (
                  <Text style={{ fontSize: 13, color: colors.grey }}>nessuna ricetta</Text>
                )}
              </Pressable>
            </Link>
          );
        })}
      </Card>
      <Badge text={`Avviso dopo ${data.settings.diaryAlertDays} giorni di fila (Altro → Impostazioni)`} />
    </Screen>
  );
}
