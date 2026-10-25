import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider } from '../data/DataContext';
import { colors } from '../ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <Stack
          screenOptions={{
            headerBackTitle: 'Indietro',
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="cane/nuovo" options={{ title: 'Nuovo cane' }} />
          <Stack.Screen name="cane/[id]/index" options={{ title: 'Cane' }} />
          <Stack.Screen name="cane/[id]/modifica" options={{ title: 'Modifica cane' }} />
          <Stack.Screen name="catalogo/[key]" options={{ title: 'Catalogo' }} />
          <Stack.Screen name="info/[topic]" options={{ presentation: 'modal', title: 'Spiegazione' }} />
        </Stack>
        <StatusBar style="dark" />
      </DataProvider>
    </SafeAreaProvider>
  );
}
