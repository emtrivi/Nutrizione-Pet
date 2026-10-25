// «Aggiornamento disponibile — Riavvia ora», con "Più tardi".
// Compare solo nelle schede principali: mai dentro una ricetta o un modulo in compilazione.

import { Text, View } from 'react-native';
import { Button } from '../ui/components';
import { colors } from '../ui/theme';
import { useAppUpdates } from './UpdatesContext';

export function UpdateBanner() {
  const { showBanner, restarting, dismiss, restart } = useAppUpdates();
  if (!showBanner) return null;
  return (
    <View style={{ backgroundColor: colors.infoBg, borderRadius: 10, padding: 12, gap: 8 }} accessibilityRole="alert">
      <Text style={{ color: colors.infoText, fontSize: 16, fontWeight: '700' }}>Aggiornamento disponibile — Riavvia ora</Text>
      <Text style={{ color: colors.infoText, fontSize: 14, lineHeight: 20 }}>
        L’app si riapre in pochi secondi con la nuova versione. I tuoi dati restano sul telefono. Se rimandi, l’aggiornamento
        si installa alla prossima apertura dell’app.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title={restarting ? 'Riavvio…' : 'Riavvia ora'} onPress={restart} disabled={restarting} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Più tardi" kind="secondary" onPress={dismiss} disabled={restarting} />
        </View>
      </View>
    </View>
  );
}
