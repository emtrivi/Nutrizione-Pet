import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform } from 'react-native';
import { useData } from '../../../data/DataContext';
import { dogToForm } from '../../../data/dogForm';
import { deleteDog, updateDog } from '../../../data/personalStore';
import { Notice, Screen } from '../../../ui/components';
import { DogForm } from '../../../ui/DogForm';

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Elimina', style: 'destructive', onPress: onYes },
  ]);
}

export default function ModificaCaneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, update } = useData();
  const dog = data.dogs.find((d) => d.id === id);
  if (!dog) {
    return (
      <Screen>
        <Notice tone="warning">Questo cane non esiste più.</Notice>
      </Screen>
    );
  }
  return (
    <DogForm
      initial={dogToForm(dog)}
      submitLabel="Salva le modifiche"
      onSubmit={(fields) => {
        update((d) => updateDog(d, dog.id, fields, new Date()));
        router.back();
      }}
      onDelete={() =>
        confirm(`Eliminare ${dog.name}?`, 'Il profilo verrà cancellato dal telefono. Non si può annullare (salvo ripristinare un backup).', () => {
          update((d) => deleteDog(d, dog.id));
          router.dismissTo('/');
        })
      }
    />
  );
}
