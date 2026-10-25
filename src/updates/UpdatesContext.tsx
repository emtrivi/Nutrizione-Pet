// Aggiornamenti via internet (EAS Update).
// expo-updates controlla all'apertura dell'app; qui si controlla anche quando l'app torna in primo
// piano (iOS la tiene aperta a lungo). Un aggiornamento scaricato si applica solo:
// - quando l'utente tocca "Riavvia ora" (dopo aver salvato i dati), oppure
// - alla prossima apertura completa dell'app.
// Non si riavvia mai da solo mentre si sta lavorando.

import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { useData } from '../data/DataContext';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/** Gli aggiornamenti funzionano solo nell'app installata (non nell'anteprima web né in sviluppo). */
export const updatesActive = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;

interface UpdatesValue {
  /** C'è un aggiornamento scaricato e l'utente non ha scelto "Più tardi". */
  showBanner: boolean;
  restarting: boolean;
  dismiss: () => void;
  restart: () => Promise<void>;
}

const Ctx = createContext<UpdatesValue>({ showBanner: false, restarting: false, dismiss: () => {}, restart: async () => {} });

export function UpdatesProvider({ children }: { children: ReactNode }) {
  const { isUpdatePending } = Updates.useUpdates();
  const { flush } = useData();
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!updatesActive) return;
    lastCheck.current = Date.now(); // all'apertura controlla già expo-updates
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
      lastCheck.current = Date.now();
      (async () => {
        try {
          const r = await Updates.checkForUpdateAsync();
          if (r.isAvailable) {
            await Updates.fetchUpdateAsync();
            setDismissed(false);
          }
        } catch {
          // Senza rete o server non raggiungibile: si riprova più tardi, senza disturbare.
        }
      })();
    });
    return () => sub.remove();
  }, []);

  const restart = useCallback(async () => {
    setRestarting(true);
    try {
      await flush(); // i dati sono già salvati a ogni modifica: qui si aspetta solo l'ultima scrittura
      await Updates.reloadAsync();
    } catch {
      setRestarting(false);
    }
  }, [flush]);

  const value = useMemo(
    () => ({ showBanner: updatesActive && isUpdatePending && !dismissed, restarting, dismiss: () => setDismissed(true), restart }),
    [isUpdatePending, dismissed, restarting, restart],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppUpdates(): UpdatesValue {
  return useContext(Ctx);
}

/** Informazioni sulla versione in uso, per Altro → Informazioni. */
export function currentUpdateInfo(): { source: 'aggiornamento' | 'build' | 'anteprima'; date: Date | null; id: string | null; channel: string | null } {
  if (!updatesActive) return { source: 'anteprima', date: null, id: null, channel: null };
  return {
    source: Updates.isEmbeddedLaunch ? 'build' : 'aggiornamento',
    date: Updates.createdAt,
    id: Updates.updateId,
    channel: Updates.channel,
  };
}
