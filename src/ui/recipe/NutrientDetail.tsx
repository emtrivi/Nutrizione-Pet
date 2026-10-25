// Tocco su una barra: valore, limite, da quali ingredienti arriva, pagina FEDIAF.

import { Modal, ScrollView, Text, View } from 'react-native';
import { getCatalog, shortName, type NutrientView } from '../../engine';
import { Bar } from '../NutrientBar';
import { Button, Card, Hint, Notice, Row } from '../components';
import { formatFixedUnit, formatSmart, unitLabel } from '../format';
import { colors } from '../theme';

const catalog = getCatalog();
const COLOR_WORD = { verde: 'verde: nei limiti', arancione: 'arancione: fuori di poco (fino al 10%)', rosso: 'rosso: fuori di oltre il 10%', grigio: 'grigio' };

export function NutrientDetail({ view, recipeKcal, onClose }: { view: NutrientView | null; recipeKcal: number | null; onClose: () => void }) {
  if (!view) return null;
  const { def, req, total, evaluation: ev } = view;
  const u = def.unit;
  const name = (key: string) => {
    const i = catalog.get(key);
    return i ? shortName(i) : key;
  };
  const contributions = [...total.contributions].filter((c) => c.value !== 0 || c.assumedZero).sort((a, b) => b.value - a.value);
  const sum = total.value ?? 0;
  const greyReason =
    ev.reason === 'nessun_riferimento'
      ? 'FEDIAF non dà un riferimento per questo nutriente (trattino nella tabella): la barra è grigia e mostra solo il valore.'
      : ev.reason === 'dato_mancante'
        ? 'Nessun ingrediente della ricetta ha questo dato nel catalogo: non è zero, è sconosciuto.'
        : null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{def.nameIt}</Text>
        <Bar bar={view.bar} partial={total.partial} />
        <Text style={{ fontSize: 15, color: colors.text }}>Colore {COLOR_WORD[ev.color]}.</Text>
        {greyReason ? <Notice tone="info">{greyReason}</Notice> : null}
        {total.partial && total.value !== null ? (
          <Notice tone="warning">
            Valore parziale: il dato manca in {total.missingIn.length} ingredienti, quindi il valore vero è “almeno” questo.
            {ev.direction === 'eccesso' ? ' L’eccesso resta valido.' : ' Il colore potrebbe cambiare quando arriveranno i dati.'}
          </Notice>
        ) : null}

        <Card title="Valore">
          <Row label="Nella ricetta (al giorno)" value={total.value !== null ? `${total.partial ? 'almeno ' : ''}${formatFixedUnit(total.value, u)}` : 'non disponibile'} muted={total.value === null} />
          <Row
            label="Ogni 1.000 kcal della ricetta"
            value={ev.valuePer1000 !== null ? formatFixedUnit(ev.valuePer1000, u) : '—'}
            hint={recipeKcal ? `la ricetta ha ${formatSmart(recipeKcal)} kcal` : undefined}
          />
        </Card>

        <Card title="Limiti (ogni 1.000 kcal)">
          <Row
            label="Minimo"
            value={ev.limitsPer1000.min !== null ? formatFixedUnit(ev.limitsPer1000.min, u) : 'nessuno'}
            hint={req.modified && req.minPer1000 !== req.fediafMinPer1000 ? `modificato (FEDIAF: ${req.fediafMinPer1000 !== null ? formatSmart(req.fediafMinPer1000) : 'nessuno'})` : `FEDIAF tabella ${req.digestibilityIncreaseApplied ? '(+10%)' : ''}`}
          />
          <Row
            label="Massimo"
            value={ev.limitsPer1000.max !== null ? formatFixedUnit(ev.limitsPer1000.max, u) : 'nessuno'}
            hint={
              ev.maxKind === 'N'
                ? 'massimo nutrizionale FEDIAF (N)'
                : ev.maxKind === 'L'
                  ? `massimo di legge FEDIAF (L): ${formatSmart(req.maxLPer100gDM as number)} ${unitLabel(u)} per 100 g di sostanza secca, convertito con la sostanza secca della ricetta`
                  : ev.maxKind === 'modificato'
                    ? 'massimo modificato in questa ricetta'
                    : undefined
            }
          />
          {ev.legalMaxWarning ? <Notice tone="warning">{ev.legalMaxWarning}</Notice> : null}
        </Card>

        <Card title="Da quali ingredienti arriva">
          {contributions.length === 0 ? <Hint>Nessun contributo noto.</Hint> : null}
          {contributions.map((c) => (
            <Row
              key={c.key}
              label={name(c.key)}
              value={formatFixedUnit(c.value, u)}
              hint={[sum > 0 && c.value > 0 ? `${Math.round((c.value / sum) * 100)}%` : null, ...(c.notes ?? [])].filter(Boolean).join(' · ') || undefined}
              muted={c.assumedZero}
            />
          ))}
          {total.missingIn.length > 0 ? (
            <View style={{ paddingTop: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Dato mancante in:</Text>
              <Hint>{total.missingIn.map(name).join(', ')}</Hint>
            </View>
          ) : null}
          {total.toVerify ? <Notice tone="warning">Uno dei valori è “da verificare”.</Notice> : null}
        </Card>

        {req.source || def.note ? (
          <Card title="Fonte">
            {req.source ? <Hint>{req.source}</Hint> : null}
            {def.note ? <Hint>{def.note}</Hint> : null}
          </Card>
        ) : null}
        <Button title="Chiudi" kind="secondary" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}
