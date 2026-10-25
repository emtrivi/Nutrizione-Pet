import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { colors } from '../../ui/theme';

const icon = (symbol: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Cani', tabBarIcon: icon('🐕') }} />
      <Tabs.Screen name="ricette" options={{ title: 'Ricette', tabBarIcon: icon('🍲') }} />
      <Tabs.Screen name="diario" options={{ title: 'Diario', tabBarIcon: icon('📅') }} />
      <Tabs.Screen name="catalogo" options={{ title: 'Catalogo', tabBarIcon: icon('📚') }} />
      <Tabs.Screen name="altro" options={{ title: 'Altro', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
