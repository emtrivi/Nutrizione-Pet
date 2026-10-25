import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import { useData } from '../../data/DataContext';
import { deleteRecipe, generateId, saveRecipe } from '../../data/personalStore';
import {
  computeRequirements,
  duplicateRecipe,
  evaluateRecipe,
  fediaf,
  getCatalog,
  reviewReasons,
  startingGrams,
  type CatalogItem,
  type Dog,
} from '../../engine';
import { Button, Card, Disclaimer, Field, Hint, Notice, styles } from '../../ui/components';
import { draftEnergy, draftFromRecipe, draftLines, draftToRecipe, newDraft, type Draft } from '../../ui/recipe/draft';
import { Step1, Step2, Step3, StepBand } from '../../ui/recipe/Steps123';
import { Step4 } from '../../ui/recipe/Step4';
import { colors } from '../../ui/theme';

const catalog = getCatalog();

const BANDS = [
  {
    title: 'Calorie',
    what: 'Scegli le calorie al giorno per questa ricetta.',
    why: 'Servono per i grammi di partenza e per confrontare i nutrienti con la tabella FEDIAF.',
    now: 'lascia le kcal del cane o scrivine altre, poi tocca Avanti.',
  },
  {
    title: 'Fabbisogni',
    what: 'Ecco quanto serve al cane, ogni 1.000 kcal e al giorno.',
    why: 'Sono i valori con cui l’app controllerà la ricetta.',
    now: 'se la nutrizionista ti ha dato valori diversi tocca “Modifica”, altrimenti Avanti.',
  },
  {
    title: 'Ingredienti',
    what: 'Scegli gli alimenti dal catalogo, per categoria.',
    why: 'Con le loro calorie l’app proporrà dei grammi di partenza, che poi decidi tu.',
    now: 'aggiungi almeno un alimento (di solito una fonte proteica e una energetica), poi Avanti.',
  },
  {
    title: 'Ricetta',
    what: 'Ecco grammi, nutrienti, rapporti, integratori e prezzo.',
    why: 'Le barre mostrano se ogni nutriente è nei limiti; i grammi li decidi tu.',
    now: 'cambia i grammi, aggiungi gli integratori, dai un nome e tocca Salva.',
  },
];

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

/** Proposta dei grammi solo per gli alimenti che non li hanno ancora (o per tutti, se richiesto). */
function withStartingGrams(draft: Draft, kcalTarget: number, split: Parameters<typeof startingGrams>[2], all: boolean): Draft {
  const items = draft.foods.map((f) => catalog.get(f.key)).filter(Boolean) as CatalogItem[];
  const proposal = new Map(startingGrams(items, kcalTarget, split).map((s) => [s.key, s.amount]));
  return { ...draft, foods: draft.foods.map((f) => (all || f.amount === null ? { ...f, amount: proposal.get(f.key) ?? 0 } : f)) };
}

export default function RicettaScreen() {
  const { id, dogId } = useLocalSearchParams<{ id: string; dogId?: string }>();
  const { data, update } = useData();
  const saved = id && id !== 'nuova' ? data.recipes.find((r) => r.id === id) : undefined;
  const dog = data.dogs.find((d) => d.id === (saved?.dogId ?? dogId));
  const multipliers = data.settings.multipliers;

  const [draft, setDraft] = useState<Draft | null>(() =>
    saved ? draftFromRecipe(saved, dog, multipliers) : dog ? newDraft(dog) : null,
  );
  const [step, setStep] = useState(saved ? 4 : 1);
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);
  const [choosingDog, setChoosingDog] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  const energy = useMemo(() => (draft && dog ? draftEnergy(draft, dog, multipliers) : null), [draft, dog, multipliers]);
  const requirements = useMemo(
    () =>
      draft && energy
        ? computeRequirements(fediaf, {
            table: energy.table,
            kcalPerDay: energy.kcalTarget,
            overrides: draft.overrides,
            aminoAcidDigestibilityIncrease: data.settings.aminoAcidDigestibilityIncrease,
          })
        : null,
    [draft, energy, data.settings.aminoAcidDigestibilityIncrease],
  );
  const evaluation = useMemo(
    () =>
      draft && energy && dog && step === 4
        ? evaluateRecipe(
            { lines: draftLines(draft), kcalTarget: energy.kcalTarget, table: energy.table, overrides: draft.overrides, dogWeightKg: dog.weightKg },
            { catalog, fediaf, settings: data.settings, prices: data.prices },
          )
        : null,
    [draft, energy, dog, step, data.settings, data.prices],
  );

  if (!draft || !dog || !energy || !requirements) {
    return (
      <View style={[styles.screen, { padding: 16, gap: 12 }]}>
        <Disclaimer />
        <Notice tone="warning">{saved ? 'Il cane di questa ricetta non esiste più.' : 'Cane non trovato.'}</Notice>
        {saved ? <Button title="Elimina la ricetta" kind="danger" onPress={() => { update((d) => deleteRecipe(d, saved.id)); router.back(); }} /> : null}
      </View>
    );
  }

  const set = (p: Partial<Draft>) => {
    setMessage(null);
    setDraft((d) => (d ? { ...d, ...p } : d));
  };
  const goTo = (s: number) => {
    if (s === 4 && draft.foods.length === 0) {
      setMessage({ tone: 'danger', text: 'Aggiungi almeno un alimento.' });
      return;
    }
    if (s === 4) setDraft(withStartingGrams(draft, energy.kcalTarget, data.settings.calorieSplit, false));
    setMessage(null);
    setStep(s);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const reasons = saved ? reviewReasons(saved, data.dogs, catalog, multipliers) : [];

  const save = () => {
    if (!draft.name.trim()) {
      setMessage({ tone: 'danger', text: 'Dai un nome alla ricetta.' });
      return;
    }
    if (!draftLines(draft).some((l) => l.key.startsWith('food:') && l.amount > 0)) {
      setMessage({ tone: 'danger', text: 'Serve almeno un alimento con dei grammi.' });
      return;
    }
    const now = new Date();
    const recipeId = saved?.id ?? generateId(now);
    const recipe = draftToRecipe(draft, dog, catalog, recipeId, now, multipliers);
    update((d) => saveRecipe(d, recipe));
    setMessage({ tone: 'info', text: 'Ricetta salvata.' });
    if (!saved) router.replace({ pathname: '/ricetta/[id]', params: { id: recipeId } });
  };

  const duplicateFor = (target: Dog) => {
    if (!saved) return;
    const now = new Date();
    const copy = duplicateRecipe(saved, generateId(now), now, target.id);
    update((d) => saveRecipe(d, copy));
    setChoosingDog(false);
    router.replace({ pathname: '/ricetta/[id]', params: { id: copy.id } });
  };

  const band = BANDS[step - 1] as (typeof BANDS)[number];
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: saved ? saved.name : `Nuova ricetta per ${dog.name}` }} />
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Disclaimer />
        <StepBand step={step} {...band} />
        {reasons.length > 0 ? (
          <Notice tone="warning">
            Da rivedere: {reasons.join(' ')} I grammi non sono stati cambiati. Controlla e tocca Salva per segnarla come rivista.
          </Notice>
        ) : null}

        {step === 1 ? <Step1 draft={draft} dog={dog} energy={energy} set={set} /> : null}
        {step === 2 ? <Step2 req={requirements} draft={draft} set={set} /> : null}
        {step === 3 ? <Step3 draft={draft} set={set} /> : null}
        {step === 4 && evaluation ? (
          <Step4
            draft={draft}
            set={set}
            ev={evaluation}
            prices={data.prices}
            dogWeightKg={dog.weightKg}
            onRecalculate={() =>
              confirm(
                'Ricalcolare i grammi?',
                'I grammi di tutti gli alimenti torneranno alla proposta di partenza. Gli integratori non cambiano.',
                'Ricalcola',
                () => setDraft((d) => (d ? withStartingGrams(d, energy.kcalTarget, data.settings.calorieSplit, true) : d)),
              )
            }
          />
        ) : null}

        {step === 4 ? (
          <Card title="Salva">
            <Field label="Nome della ricetta" value={draft.name} onChangeText={(t) => set({ name: t })} placeholder="es. Manzo e riso" />
            <Hint>Le modifiche restano solo qui finché non tocchi Salva.</Hint>
            <Button title="Salva la ricetta" onPress={save} />
            {saved ? (
              <>
                <Button
                  title="Aggiungi al diario"
                  kind="secondary"
                  onPress={() => router.navigate({ pathname: '/diario', params: { dogId: dog.id, recipeId: saved.id, t: String(Date.now()) } })}
                />
                <Button title="Duplica (anche per un altro cane)" kind="secondary" onPress={() => setChoosingDog(true)} />
                <Button
                  title="Elimina la ricetta"
                  kind="danger"
                  onPress={() =>
                    confirm('Eliminare la ricetta?', `“${saved.name}” verrà cancellata. Non si può annullare (salvo ripristinare un backup).`, 'Elimina', () => {
                      update((d) => deleteRecipe(d, saved.id));
                      router.back();
                    })
                  }
                />
              </>
            ) : null}
          </Card>
        ) : null}

        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {step > 1 ? (
            <View style={{ flex: 1 }}>
              <Button title="Indietro" kind="secondary" onPress={() => goTo(step - 1)} />
            </View>
          ) : null}
          {step < 4 ? (
            <View style={{ flex: 1 }}>
              <Button title="Avanti" onPress={() => goTo(step + 1)} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={choosingDog} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChoosingDog(false)}>
        <View style={[styles.screen, { padding: 16, gap: 12 }]}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Per quale cane?</Text>
          <Hint>Se scegli un altro cane, la copia sarà “da rivedere”: controlla calorie e grammi.</Hint>
          {data.dogs.map((d) => (
            <Button key={d.id} title={d.name} kind="secondary" onPress={() => duplicateFor(d)} />
          ))}
          <Button title="Annulla" kind="secondary" onPress={() => setChoosingDog(false)} />
        </View>
      </Modal>
    </View>
  );
}
