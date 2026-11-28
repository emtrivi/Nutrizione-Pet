// Stellina dei preferiti: tocca per aggiungere o togliere. Cambia solo l'elenco dei preferiti, mai la ricetta.

import { Pressable, Text } from 'react-native';
import { useData } from '../data/DataContext';
import { withFavoriteToggled } from '../data/personalStore';
import { isFavorite } from '../engine';
import { colors } from './theme';

export function FavoriteStar({ recipeId, name, size = 26 }: { recipeId: string; name: string; size?: number }) {
  const { data, update } = useData();
  const on = isFavorite(data.favorites, recipeId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Togli ${name} dai preferiti` : `Aggiungi ${name} ai preferiti`}
      hitSlop={10}
      onPress={() => update((d) => withFavoriteToggled(d, recipeId))}
      style={{ paddingHorizontal: 4 }}
    >
      <Text style={{ fontSize: size, lineHeight: size + 4, color: on ? '#C99A00' : colors.grey }}>{on ? '★' : '☆'}</Text>
    </Pressable>
  );
}
