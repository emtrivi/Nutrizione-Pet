// Numero intero con − e + (per esempio quante volte una giornata tipo).

import { Pressable, Text, View } from 'react-native';
import { colors } from './theme';

export function Stepper({ value, onChange, label, min = 0, max = 366, unit }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number; unit?: (n: number) => string }) {
  const btn = { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Meno ${label}`} disabled={value <= min} onPress={() => onChange(Math.max(min, value - 1))} style={[btn, value <= min && { opacity: 0.35 }]}>
        <Text style={{ fontSize: 22, color: colors.primary }}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`${label}: ${value}`} style={{ fontSize: 18, fontWeight: '700', minWidth: 28, textAlign: 'center', color: colors.text }}>
        {value}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Più ${label}`} disabled={value >= max} onPress={() => onChange(Math.min(max, value + 1))} style={[btn, value >= max && { opacity: 0.35 }]}>
        <Text style={{ fontSize: 22, color: colors.primary }}>+</Text>
      </Pressable>
      {unit ? <Text style={{ fontSize: 15, color: colors.muted }}>{unit(value)}</Text> : null}
    </View>
  );
}
