// Modulo del cane (nuovo e modifica), con anteprima delle calorie mentre si scrive.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { EMPTY_DOG_FORM, validateDogForm, type DogFields, type DogFormValues } from '../data/dogForm';
import { computeDogEnergy, proposedMultiplier, type ActivityLevel, type MuscleScore } from '../engine';
import { Button, Card, Explain, Field, Hint, Notice, Row, Screen, Segmented, SwitchRow } from './components';
import { formatNumber, formatSmart } from './format';

const BCS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '—' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: n, label: String(n) })),
];
const MCS_OPTIONS: { value: MuscleScore | 'none'; label: string }[] = [
  { value: 'none', label: '—' },
  { value: 'normale', label: 'Normale' },
  { value: 'perdita_lieve', label: 'Lieve' },
  { value: 'perdita_moderata', label: 'Moderata' },
  { value: 'perdita_grave', label: 'Grave' },
];
const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'bassa', label: 'Bassa' },
  { value: 'normale', label: 'Normale' },
  { value: 'alta', label: 'Alta' },
];

export function DogForm({
  initial = EMPTY_DOG_FORM,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  initial?: DogFormValues;
  submitLabel: string;
  onSubmit: (fields: DogFields) => void;
  onDelete?: () => void;
}) {
  const [v, setV] = useState<DogFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof DogFormValues, string>>>({});
  const set = <K extends keyof DogFormValues>(key: K, value: DogFormValues[K]) => setV((old) => ({ ...old, [key]: value }));

  // Anteprima: si calcola solo se i numeri scritti sono validi.
  const check = validateDogForm({ ...v, name: v.name || 'anteprima' });
  const preview = check.ok ? computeDogEnergy(check.fields) : null;
  const proposed = proposedMultiplier(v.activity, v.neutered);

  const submit = () => {
    const r = validateDogForm(v);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    onSubmit(r.fields);
  };

  return (
    <Screen>
      <Explain>
        Scrivi i dati del cane. Servono a calcolare le calorie al giorno e a scegliere la tabella FEDIAF. I campi con
        “facoltativo” si possono lasciare vuoti.
      </Explain>

      <Card title="Dati">
        <Field label="Nome" value={v.name} onChangeText={(t) => set('name', t)} error={errors.name} />
        <Field label="Età (anni, facoltativo)" value={v.age} onChangeText={(t) => set('age', t)} keyboardType="decimal-pad" error={errors.age} />
        <Field label="Razza (facoltativo, solo informativo)" value={v.breed} onChangeText={(t) => set('breed', t)} />
        <Field label="Taglia (facoltativo, solo informativo)" value={v.size} onChangeText={(t) => set('size', t)} placeholder="es. media, grande" />
      </Card>

      <Card title="Peso">
        <Field label="Peso attuale (kg)" value={v.weight} onChangeText={(t) => set('weight', t)} keyboardType="decimal-pad" error={errors.weight} placeholder="es. 30 o 12,5" />
        <Field
          label="Peso ideale stimato (kg, facoltativo)"
          value={v.idealWeight}
          onChangeText={(t) => set('idealWeight', t)}
          keyboardType="decimal-pad"
          error={errors.idealWeight}
        />
        <SwitchRow
          label="Usa il peso ideale per le calorie"
          value={v.useIdealWeight}
          onChange={(b) => set('useIdealWeight', b)}
          hint="Spento: si usa il peso attuale. Acceso: il peso ideale (per esempio se il cane deve dimagrire, su indicazione della nutrizionista)."
        />
      </Card>

      <Card title="Condizione e attività">
        <Segmented
          label="Sterilizzato"
          options={[
            { value: 'si', label: 'Sì' },
            { value: 'no', label: 'No' },
          ]}
          value={v.neutered ? 'si' : 'no'}
          onChange={(x) => set('neutered', x === 'si')}
        />
        <Segmented label="BCS, condizione corporea (1-9)" info="bcs" options={BCS_OPTIONS} value={v.bcs ?? 0} onChange={(n) => set('bcs', n === 0 ? null : n)} error={errors.bcs} hint="— = non indicato" />
        <Segmented label="MCS, massa muscolare" info="mcs" options={MCS_OPTIONS} value={v.mcs ?? 'none'} onChange={(m) => set('mcs', m === 'none' ? null : m)} />
        <Segmented label="Livello di attività" info="attivita" options={ACTIVITY_OPTIONS} value={v.activity} onChange={(a) => set('activity', a)} />
      </Card>

      <Card title="Calorie">
        <Hint>
          L’app propone le calorie; puoi correggerle. Lascia vuoti i due campi qui sotto per usare la proposta.
        </Hint>
        <Field
          label="Moltiplicatore (facoltativo)"
          info="calorie"
          value={v.multiplier}
          onChangeText={(t) => set('multiplier', t)}
          keyboardType="decimal-pad"
          error={errors.multiplier}
          placeholder={`proposto: ${formatSmart(proposed)}`}
          hint={`Vuoto = proposto ${formatSmart(proposed)} (attività ${v.activity}, ${v.neutered ? 'sterilizzato' : 'non sterilizzato'}).`}
        />
        <Field
          label="Kcal al giorno scritte a mano (facoltativo)"
          value={v.manualKcal}
          onChangeText={(t) => set('manualKcal', t)}
          keyboardType="decimal-pad"
          error={errors.manualKcal}
          hint="Se le scrivi (per esempio quelle della nutrizionista), sostituiscono il calcolo."
        />
        <Segmented
          label="Tabella FEDIAF"
          info="tabella"
          options={[
            { value: 'auto', label: 'Automatica' },
            { value: 95, label: '95' },
            { value: 110, label: '110' },
          ]}
          value={v.table}
          onChange={(t) => set('table', t)}
          hint="Automatica: 95 se il fattore è sotto 110, altrimenti 110."
        />
        {preview ? (
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 2 }}>Anteprima</Text>
            <Row label="RER (a riposo)" value={`${formatNumber(preview.rer)} kcal`} />
            <Row label="Kcal al giorno" value={`${formatNumber(preview.kcalPerDay)} kcal`} />
            <Row label="Fattore" value={formatNumber(preview.factorRounded)} />
            <Row label="Tabella FEDIAF" value={String(preview.table)} />
            {preview.warnings.map((w) => (
              <Notice key={w} tone="warning">
                {w}
              </Notice>
            ))}
          </View>
        ) : (
          <Hint>Scrivi il peso per vedere l’anteprima delle calorie.</Hint>
        )}
      </Card>

      <Card title="Note">
        <Field label="Note (facoltativo)" value={v.notes} onChangeText={(t) => set('notes', t)} multiline />
      </Card>

      {Object.keys(errors).length > 0 ? <Notice tone="danger">Controlla i campi segnati in rosso.</Notice> : null}
      <Button title={submitLabel} onPress={submit} />
      {onDelete ? <Button title="Elimina questo cane" kind="danger" onPress={onDelete} /> : null}
    </Screen>
  );
}
