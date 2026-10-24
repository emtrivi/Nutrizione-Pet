// Prima versione di prova: serve a verificare che l'app arrivi sul telefono
// e che il motore di calcolo funzioni dentro l'app. Le schermate della Fase 1 arrivano dopo.

import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeDogEnergy, getCatalog, rer } from './src/engine';
import { formatNumber } from './src/ui/format';

const catalog = getCatalog();

const example = (kcal: number) =>
  computeDogEnergy({ weightKg: 30, useIdealWeight: false, activity: 'normale', neutered: true, manualKcal: kcal });

export default function App() {
  const e95 = example(1218);
  const e110 = example(1410);
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nutrizione Pet</Text>
        <Text style={styles.warning}>Strumento di supporto, da validare con la nutrizionista.</Text>

        <Text style={styles.heading}>Versione di prova</Text>
        <Text style={styles.text}>
          Se vedi questa pagina, l’app è arrivata sul telefono e il motore di calcolo funziona.
          Le schermate dei cani, del catalogo e del backup arrivano nelle prossime versioni.
        </Text>

        <Text style={styles.heading}>Controllo: cane d’esempio da 30 kg</Text>
        <Text style={styles.text}>RER: {formatNumber(rer(30), 1)} kcal (atteso circa 897)</Text>
        <Text style={styles.text}>
          1.218 kcal → fattore {formatNumber(e95.factor, 2)} → tabella {e95.table} (attesa 95)
        </Text>
        <Text style={styles.text}>
          1.410 kcal → fattore {formatNumber(e110.factor, 2)} → tabella {e110.table} (attesa 110)
        </Text>

        <Text style={styles.heading}>Catalogo</Text>
        <Text style={styles.text}>{catalog.version.label}</Text>
        <Text style={styles.text}>
          {catalog.foods.length} alimenti, {catalog.supplements.length} integratori
        </Text>
      </ScrollView>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { paddingTop: 72, paddingHorizontal: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  warning: {
    fontSize: 14,
    color: '#7a4a00',
    backgroundColor: '#fff4e0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  text: { fontSize: 16, lineHeight: 22, color: '#222' },
});
