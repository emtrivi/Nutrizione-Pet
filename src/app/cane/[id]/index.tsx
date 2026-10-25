import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useData } from '../../../data/DataContext';
import { ACTIVITY_LABELS, computeDogEnergy, computeRequirements, fediaf, getCatalog, reviewReasons } from '../../../engine';
import { Button, Card, Explain, Hint, InfoButton, LinkRow, Notice, Row, Screen } from '../../../ui/components';
import { formatNumber, formatSmart } from '../../../ui/format';
import { RequirementsView } from '../../../ui/RequirementsView';

const catalog = getCatalog();

const MCS_LABELS = {
  normale: 'Normale',
  perdita_lieve: 'Perdita lieve',
  perdita_moderata: 'Perdita moderata',
  perdita_grave: 'Perdita grave',
};

export default function CaneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData();
  const dog = data.dogs.find((d) => d.id === id);
  if (!dog) {
    return (
      <Screen>
        <Notice tone="warning">Questo cane non esiste più.</Notice>
      </Screen>
    );
  }

  const e = computeDogEnergy(dog, data.settings.multipliers ?? undefined);
  const recipes = data.recipes.filter((r) => r.dogId === dog.id);
  const req = computeRequirements(fediaf, {
    table: e.table,
    kcalPerDay: e.kcalPerDay,
    aminoAcidDigestibilityIncrease: data.settings.aminoAcidDigestibilityIncrease,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: dog.name }} />

      <Card title="Calorie al giorno" right={<InfoButton topic="calorie" label="Come si calcolano le calorie" />}>
        <Row
          label="Peso usato"
          value={`${formatSmart(e.weightUsedKg)} kg`}
          hint={e.weightSource === 'ideale' ? 'peso ideale (scelto nel profilo)' : 'peso attuale'}
        />
        <Row label="Peso metabolico (kg^0,75)" value={formatNumber(e.metabolicWeight, 2)} />
        <Row label="RER, a riposo" value={`${formatNumber(e.rer)} kcal`} hint={`70 × ${formatNumber(e.metabolicWeight, 2)}`} />
        {e.kcalSource === 'calcolate' ? (
          <Row
            label="Moltiplicatore"
            value={formatSmart(e.multiplier as number)}
            hint={e.multiplierSource === 'modificato' ? `scelto a mano (proposto ${formatSmart(e.proposedMultiplier)})` : 'proposto da attività e sterilizzazione'}
          />
        ) : null}
        <Row
          label="Kcal al giorno"
          value={`${formatNumber(e.kcalPerDay)} kcal`}
          hint={e.kcalSource === 'scritte_a_mano' ? 'scritte a mano nel profilo' : `${formatNumber(e.rer)} × ${formatSmart(e.multiplier as number)}`}
        />
        <Row
          label="Fattore"
          value={formatNumber(e.factorRounded)}
          hint={`${formatNumber(e.kcalPerDay)} ÷ ${formatNumber(e.metabolicWeight, 2)} = ${formatNumber(e.factor, 2)}`}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700' }}>Tabella FEDIAF {e.table}</Text>
            <InfoButton topic="tabella" label="Tabella FEDIAF 95 o 110" />
          </View>
          <Text style={{ fontSize: 13 }}>{e.tableSource === 'scelta_a_mano' ? `scelta a mano (proposta ${e.proposedTable})` : 'proposta'}</Text>
        </View>
        {e.warnings.map((w) => (
          <Notice key={w} tone="warning">
            {w}
          </Notice>
        ))}
      </Card>

      <Card title="Profilo">
        {dog.ageYears !== undefined ? <Row label="Età" value={`${formatSmart(dog.ageYears)} anni`} /> : null}
        <Row label="Peso attuale" value={`${formatSmart(dog.weightKg)} kg`} />
        {dog.idealWeightKg !== undefined ? <Row label="Peso ideale stimato" value={`${formatSmart(dog.idealWeightKg)} kg`} /> : null}
        <Row label="Sterilizzato" value={dog.neutered ? 'Sì' : 'No'} />
        <Row label="BCS (1-9)" value={dog.bcs !== undefined ? String(dog.bcs) : 'non indicato'} muted={dog.bcs === undefined} />
        <Row label="MCS" value={dog.mcs ? MCS_LABELS[dog.mcs] : 'non indicato'} muted={!dog.mcs} />
        <Row label="Attività" value={ACTIVITY_LABELS[dog.activity].split(' (')[0] as string} />
        {dog.breed ? <Row label="Razza" value={dog.breed} /> : null}
        {dog.size ? <Row label="Taglia" value={dog.size} /> : null}
        {dog.notes ? <Hint>{dog.notes}</Hint> : null}
        <Button title="Modifica il profilo" kind="secondary" onPress={() => router.push({ pathname: '/cane/[id]/modifica', params: { id: dog.id } })} />
      </Card>

      <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 8 }}>Fabbisogni al giorno</Text>
      <Explain>
        Quanto serve a {dog.name} ogni giorno con {formatNumber(e.kcalPerDay)} kcal, secondo la tabella FEDIAF {e.table}.
        Accanto c’è il valore ogni 1.000 kcal, quello che si confronta con le ricette. Tocca un gruppo per aprirlo.
      </Explain>
      <RequirementsView req={req} />
      <Hint>
        {req.edition}. Le tabelle FEDIAF sono pensate per alimenti completi commerciali: per le ricette casalinghe serve il
        giudizio della nutrizionista.
      </Hint>

      <Card title={`Ricette di ${dog.name}`}>
        {recipes.length === 0 ? <Hint>Nessuna ricetta per {dog.name}.</Hint> : null}
        {recipes.map((r) => (
          <LinkRow
            key={r.id}
            href={{ pathname: '/ricetta/[id]', params: { id: r.id } }}
            title={r.name}
            subtitle={reviewReasons(r, data.dogs, catalog, data.settings.multipliers).length > 0 ? 'da rivedere' : undefined}
          />
        ))}
        <Button title={`Crea una ricetta per ${dog.name}`} onPress={() => router.push({ pathname: '/ricetta/[id]', params: { id: 'nuova', dogId: dog.id } })} />
      </Card>
    </Screen>
  );
}
