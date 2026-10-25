// Barre dei nutrienti a partire da valori già calcolati (copia fissa del diario o media):
// stessi colori e stessi segni della schermata ricetta, nessun ricalcolo.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GROUP_LABELS, GROUP_ORDER, NUTRIENTS, type BarGeometry, type Color, type Limits } from '../engine';
import { NutrientBarRow } from './NutrientBar';
import { Badge, Card } from './components';
import { formatFixedUnit, formatSmart } from './format';
import { colors } from './theme';

export interface BarItem {
  valuePer1000: number | null;
  perDay?: number | null;
  partial: boolean;
  color: Color;
  limits: Limits;
  bar: BarGeometry;
}

const RANK: Record<Color, number> = { rosso: 0, arancione: 1, verde: 2, grigio: 3 };

export function SnapshotBars({ items, perDayLabel = 'al giorno' }: { items: Record<string, BarItem>; perDayLabel?: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <View style={{ gap: 12 }}>
      {GROUP_ORDER.map((g) => {
        const defs = NUTRIENTS.filter((n) => n.group === g && items[n.id])
          .map((d, i) => ({ d, i, it: items[d.id] as BarItem }))
          .sort((a, b) => RANK[a.it.color] - RANK[b.it.color] || a.i - b.i);
        const problems = defs.filter(({ d, it }) => d.inFediaf && (it.color === 'rosso' || it.color === 'arancione')).length;
        const isOpen = open[g] ?? problems > 0;
        return (
          <Card key={g}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => setOpen((o) => ({ ...o, [g]: !isOpen }))}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 }}>{GROUP_LABELS[g]}</Text>
              {problems > 0 ? <Badge text={`${problems} da guardare`} tone="danger" /> : null}
              <Text style={{ fontSize: 18, color: colors.primary, marginLeft: 8 }}>{isOpen ? '▾' : '▸'}</Text>
            </Pressable>
            {isOpen
              ? defs.map(({ d, it }) => {
                  const parts: string[] = [];
                  if (it.perDay !== undefined && it.perDay !== null) parts.push(`${perDayLabel} ${formatFixedUnit(it.perDay, d.unit)}`);
                  if (it.limits.min !== null) parts.push(`min ${formatSmart(it.limits.min)}`);
                  if (it.limits.max !== null) parts.push(`max ${formatSmart(it.limits.max)}`);
                  return (
                    <NutrientBarRow
                      key={d.id}
                      name={d.nameIt}
                      valueText={it.valuePer1000 === null ? 'non disponibile' : `${it.partial ? 'almeno ' : ''}${formatFixedUnit(it.valuePer1000, d.unit)}`}
                      color={it.color}
                      bar={it.bar}
                      partial={it.partial}
                      subtitle={parts.join(' · ') || undefined}
                    />
                  );
                })
              : null}
          </Card>
        );
      })}
    </View>
  );
}
