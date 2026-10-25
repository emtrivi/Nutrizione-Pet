import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, Notice, Screen } from '../../ui/components';
import { INFO } from '../../ui/infoTexts';
import { colors } from '../../ui/theme';

export default function InfoScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const info = topic ? INFO[topic] : undefined;
  if (!info) {
    return (
      <Screen>
        <Notice tone="warning">Spiegazione non trovata.</Notice>
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: info.title }} />
      <Text style={{ fontSize: 16, lineHeight: 23, color: colors.text }}>{info.intro}</Text>
      {info.items ? (
        <Card>
          {info.items.map((it) => (
            <View key={it.label} style={{ paddingVertical: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{it.label}</Text>
              <Text style={{ fontSize: 15, lineHeight: 21, color: colors.text }}>{it.text}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {info.outro ? <Text style={{ fontSize: 15, lineHeight: 21, color: colors.muted }}>{info.outro}</Text> : null}
      <Button title="Chiudi" kind="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
