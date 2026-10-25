// Barra di un nutriente: tratti uguali (rosso, arancione, verde, …) e una freccia nel punto del valore.
// Grigia senza freccia se non c'è riferimento o manca il dato. A righe se il valore è parziale.

import { Pressable, Text, View } from 'react-native';
import type { BarGeometry, Color } from '../engine';
import { colors } from './theme';

const SEGMENT: Record<string, string> = { rosso: colors.red, arancione: colors.orange, verde: colors.green };
const DOT: Record<Color, string> = { rosso: colors.red, arancione: colors.orange, verde: colors.green, grigio: colors.grey };

function Stripes() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
      {Array.from({ length: 30 }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.55)' : 'transparent' }} />
      ))}
    </View>
  );
}

export function Bar({ bar, partial }: { bar: BarGeometry; partial: boolean }) {
  const grey = bar.segments.length === 0 || bar.position === null;
  return (
    <View style={{ height: 22, justifyContent: 'flex-end' }}>
      {!grey ? (
        <Text
          style={{
            position: 'absolute',
            top: -2,
            left: `${(bar.position as number) * 100}%`,
            marginLeft: -6,
            fontSize: 12,
            color: colors.text,
          }}
        >
          ▼
        </Text>
      ) : null}
      <View style={{ height: 10, flexDirection: 'row', borderRadius: 5, overflow: 'hidden', backgroundColor: colors.greyBg }}>
        {grey
          ? null
          : bar.segments.map((s, i) => <View key={i} style={{ flex: 1, backgroundColor: SEGMENT[s], marginLeft: i ? 1 : 0 }} />)}
        {partial && !grey ? <Stripes /> : null}
      </View>
    </View>
  );
}

/** Riga completa: nome, valore (colore neutro), barra; il tocco apre la spiegazione. */
export function NutrientBarRow({
  name,
  valueText,
  color,
  bar,
  partial,
  subtitle,
  onPress,
}: {
  name: string;
  valueText: string;
  color: Color;
  bar: BarGeometry;
  partial: boolean;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}: ${valueText}, ${color}${partial ? ', valore parziale' : ''}`}
      style={({ pressed }) => ({ paddingVertical: 6, gap: 2, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DOT[color] }} />
        <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{name}</Text>
        <Text style={{ fontSize: 15, color: colors.text }}>{valueText}</Text>
      </View>
      <Bar bar={bar} partial={partial} />
      {subtitle ? <Text style={{ fontSize: 12, color: colors.muted }}>{subtitle}</Text> : null}
    </Pressable>
  );
}
