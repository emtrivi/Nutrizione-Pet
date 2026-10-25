// Prezzo di un alimento o integratore: al chilo, a confezione o a capsula.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { parseDecimal, decimalToText } from '../data/dogForm';
import { unitPrice, type PriceEntry } from '../engine';
import { Button, Field, Hint, Segmented } from './components';
import { describePrice, formatEuro } from './format';
import { colors } from './theme';

type Mode = PriceEntry['mode'];

function initialTexts(entry: PriceEntry | undefined) {
  return {
    mode: entry?.mode,
    a: entry?.mode === 'per_kg' ? decimalToText(entry.eurPerKg) : entry?.mode === 'per_package' ? decimalToText(entry.packagePrice) : entry?.mode === 'per_unit' ? decimalToText(entry.eurPerUnit) : '',
    b: entry?.mode === 'per_package' ? decimalToText(entry.packageSize) : '',
  };
}

export function PriceEditor({
  doseUnit,
  isCooked,
  entry,
  onSave,
  onRemove,
}: {
  doseUnit: 'g' | 'capsule';
  isCooked: boolean;
  entry: PriceEntry | undefined;
  onSave: (e: PriceEntry) => void;
  onRemove: () => void;
}) {
  const init = initialTexts(entry);
  const modes: { value: Mode; label: string }[] =
    doseUnit === 'capsule'
      ? [
          { value: 'per_package', label: 'A confezione' },
          { value: 'per_unit', label: 'A capsula' },
        ]
      : [
          { value: 'per_kg', label: 'Al chilo' },
          { value: 'per_package', label: 'A confezione' },
        ];
  const [mode, setMode] = useState<Mode>(init.mode && modes.some((m) => m.value === init.mode) ? init.mode : modes[0]!.value);
  const [a, setA] = useState(init.a);
  const [b, setB] = useState(init.b);
  const [error, setError] = useState<string | null>(null);

  const build = (): PriceEntry | string => {
    const va = parseDecimal(a);
    if (va === undefined || va === 'invalid') return 'Scrivi il prezzo in euro, es. 12,50.';
    if (mode === 'per_kg') return { mode, eurPerKg: va };
    if (mode === 'per_unit') return { mode, eurPerUnit: va };
    const vb = parseDecimal(b);
    if (vb === undefined || vb === 'invalid' || vb <= 0) {
      return doseUnit === 'capsule' ? 'Scrivi quante capsule ci sono nella confezione.' : 'Scrivi quanti grammi pesa la confezione.';
    }
    return { mode, packagePrice: va, packageSize: vb };
  };

  const candidate = build();
  const per = typeof candidate === 'string' ? null : unitPrice(candidate, doseUnit);

  return (
    <View style={{ gap: 10 }}>
      {entry ? (
        <Text style={{ fontSize: 15, color: colors.text }}>Prezzo salvato: {describePrice(entry, doseUnit)}</Text>
      ) : (
        <Text style={{ fontSize: 15, color: colors.grey }}>Nessun prezzo inserito.</Text>
      )}
      {isCooked ? (
        <Hint>Questo alimento si pesa cotto: scrivi il prezzo del cotto (per esempio 100 g di riso cotto costano meno di 100 g di riso secco).</Hint>
      ) : null}
      <Segmented options={modes} value={mode} onChange={setMode} />
      <Field
        label={mode === 'per_kg' ? 'Euro al chilo' : mode === 'per_unit' ? 'Euro a capsula' : 'Prezzo della confezione (euro)'}
        value={a}
        onChangeText={setA}
        keyboardType="decimal-pad"
      />
      {mode === 'per_package' ? (
        <Field
          label={doseUnit === 'capsule' ? 'Capsule nella confezione' : 'Peso della confezione (g)'}
          value={b}
          onChangeText={setB}
          keyboardType="decimal-pad"
        />
      ) : null}
      {per !== null ? (
        <Hint>
          {doseUnit === 'capsule'
            ? `= ${formatEuro(per)} a capsula`
            : `= ${formatEuro(per * 1000)} al kg (${formatEuro(per * 100)} ogni 100 g)`}
        </Hint>
      ) : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        title="Salva il prezzo"
        onPress={() => {
          const c = build();
          if (typeof c === 'string') {
            setError(c);
            return;
          }
          setError(null);
          onSave(c);
        }}
      />
      {entry ? <Button title="Togli il prezzo" kind="secondary" onPress={onRemove} /> : null}
    </View>
  );
}
