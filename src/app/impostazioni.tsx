import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useData } from '../data/DataContext';
import { decimalToText, parseDecimal } from '../data/dogForm';
import { withSettings } from '../data/personalStore';
import { DEFAULT_MULTIPLIERS, DEFAULT_SETTINGS, type ActivityLevel, type Settings, type SplitCategory } from '../engine';
import { Button, Card, Explain, Field, Hint, Notice, Screen, Segmented, SwitchRow } from '../ui/components';
import { colors } from '../ui/theme';

const SPLIT_LABELS: Record<SplitCategory, string> = {
  proteica: 'Fonte proteica principale',
  energetica: 'Fonte energetica',
  verdure: 'Verdure e fibra',
  grassi: 'Fonte di grassi',
  frattaglie: 'Frattaglie',
};
const SANITY_LABELS: Record<keyof Settings['sanity'], string> = {
  mealPctOfBodyWeight: 'Peso del pasto oltre (% del peso del cane)',
  vegetablesPctOfFood: 'Verdure oltre (% del peso degli alimenti)',
  liverPctOfFood: 'Fegato oltre (% del peso degli alimenti)',
  otherOffalPctOfFood: 'Altre frattaglie oltre (% del peso degli alimenti)',
};
const ACTIVITIES: ActivityLevel[] = ['bassa', 'normale', 'alta'];

type Texts = Record<string, string>;

function toTexts(s: Settings): Texts {
  const m = s.multipliers ?? DEFAULT_MULTIPLIERS;
  const t: Texts = {
    tolerance: decimalToText(Math.round(s.tolerance * 1000) / 10),
    backupReminderDays: String(s.backupReminderDays),
  };
  for (const k of Object.keys(s.calorieSplit) as SplitCategory[]) t[`split.${k}`] = decimalToText(s.calorieSplit[k]);
  for (const k of Object.keys(s.sanity) as (keyof Settings['sanity'])[]) t[`sanity.${k}`] = decimalToText(s.sanity[k]);
  for (const a of ACTIVITIES) {
    t[`mult.${a}.sterilizzato`] = decimalToText(m[a].sterilizzato);
    t[`mult.${a}.intero`] = decimalToText(m[a].intero);
  }
  return t;
}

export default function ImpostazioniScreen() {
  const { data, update } = useData();
  const [t, setT] = useState<Texts>(() => toTexts(data.settings));
  const [legal, setLegal] = useState(data.settings.legalMaxNaturalMode);
  const [amino, setAmino] = useState(data.settings.aminoAcidDigestibilityIncrease);
  const [error, setError] = useState<string | null>(null);
  const f = (key: string) => ({ value: t[key] ?? '', onChangeText: (v: string) => setT((o) => ({ ...o, [key]: v })), keyboardType: 'decimal-pad' as const });

  const save = () => {
    const num = (key: string, label: string, min: number, max: number): number => {
      const v = parseDecimal(t[key] ?? '');
      if (typeof v !== 'number' || v < min || v > max) throw new Error(`${label}: scrivi un numero tra ${decimalToText(min)} e ${decimalToText(max)}.`);
      return v;
    };
    try {
      const calorieSplit = Object.fromEntries(
        (Object.keys(SPLIT_LABELS) as SplitCategory[]).map((k) => [k, num(`split.${k}`, SPLIT_LABELS[k], 0, 100)]),
      ) as Settings['calorieSplit'];
      const sanity = Object.fromEntries(
        (Object.keys(SANITY_LABELS) as (keyof Settings['sanity'])[]).map((k) => [k, num(`sanity.${k}`, SANITY_LABELS[k], 0, 100)]),
      ) as unknown as Settings['sanity'];
      const multipliers = Object.fromEntries(
        ACTIVITIES.map((a) => [
          a,
          { sterilizzato: num(`mult.${a}.sterilizzato`, `Moltiplicatore ${a}`, 0.8, 5), intero: num(`mult.${a}.intero`, `Moltiplicatore ${a}`, 0.8, 5) },
        ]),
      ) as NonNullable<Settings['multipliers']>;
      const same = ACTIVITIES.every(
        (a) => multipliers[a].sterilizzato === DEFAULT_MULTIPLIERS[a].sterilizzato && multipliers[a].intero === DEFAULT_MULTIPLIERS[a].intero,
      );
      const next: Settings = {
        ...data.settings,
        calorieSplit,
        sanity,
        multipliers: same ? null : multipliers,
        tolerance: num('tolerance', 'Zona arancione', 1, 50) / 100,
        backupReminderDays: Math.round(num('backupReminderDays', 'Promemoria backup', 1, 365)),
        legalMaxNaturalMode: legal,
        aminoAcidDigestibilityIncrease: amino,
      };
      setError(null);
      update((d) => withSettings(d, next));
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Screen>
      <Explain>
        Qui si cambiano i valori che le specifiche lasciano da concordare con la nutrizionista. Cambiarli non modifica i
        grammi delle ricette salvate: cambiano solo proposte, colori e avvisi.
      </Explain>

      <Card title="Ripartizione delle calorie (grammi di partenza)">
        <Hint>Percentuali indicative, da concordare con la nutrizionista. Non serve che la somma sia 100: si riporta a 100 sulle sole categorie scelte nella ricetta.</Hint>
        {(Object.keys(SPLIT_LABELS) as SplitCategory[]).map((k) => (
          <Field key={k} label={`${SPLIT_LABELS[k]} (%)`} {...f(`split.${k}`)} />
        ))}
      </Card>

      <Card title="Controlli di buon senso">
        <Hint>Avvisano senza bloccare. Valori provvisori, da concordare con la nutrizionista.</Hint>
        {(Object.keys(SANITY_LABELS) as (keyof Settings['sanity'])[]).map((k) => (
          <Field key={k} label={SANITY_LABELS[k]} {...f(`sanity.${k}`)} />
        ))}
      </Card>

      <Card title="Colori">
        <Field label="Zona arancione: fuori dal limite fino al (%)" {...f('tolerance')} hint="Confermato dall’utente: 10%." />
        <Segmented
          label="Massimo di legge (L) se il nutriente arriva solo da alimenti naturali"
          options={[
            { value: 'avviso', label: 'Solo avviso' },
            { value: 'rosso', label: 'Rosso' },
          ]}
          value={legal}
          onChange={setLegal}
          hint="Punto aperto: decide la nutrizionista. Se il nutriente arriva anche da un integratore, il limite L vale sempre."
        />
        <SwitchRow
          label="Aminoacidi essenziali +10%"
          value={amino}
          onChange={setAmino}
          hint="FEDIAF lo raccomanda se la digeribilità delle proteine non è garantita. Punto aperto: decide la nutrizionista."
        />
      </Card>

      <Card title="Moltiplicatori proposti">
        <Hint>Usati per proporre le calorie dei cani senza moltiplicatore scelto a mano.</Hint>
        {ACTIVITIES.map((a) => (
          <View key={a} style={{ gap: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Attività {a}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Field label="Sterilizzato" {...f(`mult.${a}.sterilizzato`)} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Non sterilizzato" {...f(`mult.${a}.intero`)} />
              </View>
            </View>
          </View>
        ))}
      </Card>

      <Card title="Backup">
        <Field label="Promemoria dopo (giorni)" {...f('backupReminderDays')} />
      </Card>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button title="Salva le impostazioni" onPress={save} />
      <Button
        title="Torna ai valori iniziali"
        kind="secondary"
        onPress={() => {
          setT(toTexts(DEFAULT_SETTINGS));
          setLegal(DEFAULT_SETTINGS.legalMaxNaturalMode);
          setAmino(DEFAULT_SETTINGS.aminoAcidDigestibilityIncrease);
        }}
      />
    </Screen>
  );
}
