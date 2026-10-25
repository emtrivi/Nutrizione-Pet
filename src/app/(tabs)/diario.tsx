import { Explain, Screen } from '../../ui/components';
import { UpdateBanner } from '../../updates/UpdateBanner';

export default function DiarioScreen() {
  return (
    <Screen>
      <UpdateBanner />
      <Explain>
        Qui ci sarà il diario: cosa ha mangiato ogni cane, giorno per giorno, con i colori e le medie. Arriva con la
        Fase 3.
      </Explain>
    </Screen>
  );
}
