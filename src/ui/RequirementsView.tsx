// Fabbisogni FEDIAF nei cinque gruppi, apribili e chiudibili.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Requirement, RequirementsResult } from '../engine';
import { Card, Hint } from './components';
import { formatFixedUnit, formatSmart, unitLabel } from './format';
import { colors } from './theme';

function RequirementRow({ r }: { r: Requirement }) {
  if (r.informative) {
    return (
      <View style={{ paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 15, color: colors.grey }}>{r.nameIt}</Text>
        <Text style={{ fontSize: 13, color: colors.grey }}>Nessun riferimento FEDIAF: solo informativo.</Text>
      </View>
    );
  }
  return (
    <View style={{ paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 15, color: colors.text, flex: 1 }}>{r.nameIt}</Text>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
          {r.perDay.min !== null ? `almeno ${formatFixedUnit(r.perDay.min, r.unit)}` : 'nessun minimo'}
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: colors.muted }}>
        {r.minPer1000 !== null
          ? `${formatSmart(r.minPer1000)} ${unitLabel(r.unit)} ogni 1.000 kcal`
          : 'FEDIAF non dà un minimo'}
        {r.digestibilityIncreaseApplied ? ' (+10% aminoacidi)' : ''}
      </Text>
      {r.maxNPer1000 !== null && r.perDay.maxN !== null ? (
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Massimo nutrizionale (N): {formatFixedUnit(r.perDay.maxN, r.unit)} al giorno ({formatSmart(r.maxNPer1000)} ogni
          1.000 kcal)
        </Text>
      ) : null}
      {r.maxLPer100gDM !== null ? (
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Massimo di legge (L): {formatSmart(r.maxLPer100gDM)} {unitLabel(r.unit)} per 100 g di sostanza secca — si
          controlla sulla ricetta.
        </Text>
      ) : null}
    </View>
  );
}

export function RequirementsView({ req }: { req: RequirementsResult }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ proteine: true });
  return (
    <View style={{ gap: 12 }}>
      {req.groups.map((g) => {
        const isOpen = !!open[g.group];
        return (
          <Card key={g.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => setOpen((o) => ({ ...o, [g.group]: !isOpen }))}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{g.label}</Text>
              <Text style={{ fontSize: 18, color: colors.primary }}>{isOpen ? '▾' : '▸'}</Text>
            </Pressable>
            {isOpen ? (
              <View>
                {g.items.map((r) => (
                  <RequirementRow key={r.id} r={r} />
                ))}
                {g.group === 'minerali' ? (
                  <View style={{ paddingTop: 8, gap: 2 }}>
                    <Text style={{ fontSize: 15, color: colors.text }}>
                      Rapporto calcio/fosforo: da {formatSmart(req.caPRatio.min)}:1 a {formatSmart(req.caPRatio.max)}:1
                    </Text>
                    {req.safeLevels.map((s) => (
                      <Hint key={s.id}>
                        {s.id.startsWith('sodium') ? 'Sodio' : 'Cloruro'}: {formatSmart(s.value)} {s.unit} è un livello
                        indicato come sicuro, non un massimo.
                      </Hint>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
