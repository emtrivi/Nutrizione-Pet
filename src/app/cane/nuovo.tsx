import { router } from 'expo-router';
import { useData } from '../../data/DataContext';
import { generateId, addDog } from '../../data/personalStore';
import { DogForm } from '../../ui/DogForm';

export default function NuovoCaneScreen() {
  const { update } = useData();
  return (
    <DogForm
      submitLabel="Salva il cane"
      onSubmit={(fields) => {
        const now = new Date();
        const id = generateId(now);
        update((d) => addDog(d, fields, now, id));
        router.replace({ pathname: '/cane/[id]', params: { id } });
      }}
    />
  );
}
