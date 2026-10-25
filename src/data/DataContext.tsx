// Dati personali condivisi tra le schermate. Si caricano all'avvio e si salvano a ogni modifica.
// Protezioni:
// - prima di portare i dati a una struttura nuova (migrazione) se ne conserva una copia;
// - se i dati sono stati salvati da una versione più nuova dell'app (es. dopo il ritiro di un
//   aggiornamento) l'app li mostra ma non li sovrascrive mai (sola lettura);
// - un file illeggibile viene conservato in copia prima di ripartire.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { emptyPersonalData, type PersonalData } from '../engine';
import { parseLocal, serializeLocal } from './personalStore';
import { keepCopy, loadText, saveText } from './storage';

interface DataContextValue {
  data: PersonalData;
  ready: boolean;
  /** Messaggio da mostrare se qualcosa non è andato (caricamento o salvataggio). */
  problem: string | null;
  /** true se i dati vengono da una versione più nuova dell'app: nessuna modifica viene salvata. */
  readOnly: boolean;
  update: (change: (data: PersonalData) => PersonalData) => void;
  /** Attende che l'ultimo salvataggio sia finito (prima di riavviare l'app). */
  flush: () => Promise<void>;
}

const Ctx = createContext<DataContextValue | null>(null);

export const READ_ONLY_MESSAGE =
  'I dati sul telefono sono stati salvati da una versione più nuova dell’app. Per proteggerli, questa versione ' +
  'non li modifica: puoi guardarli ma le modifiche non vengono salvate. Riavvia l’app per ricevere l’aggiornamento.';

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersonalData>(emptyPersonalData);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const loaded = useRef(false);
  const skipNextSave = useRef(true);
  const lastSave = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = await loadText();
        const r = parseLocal(text);
        if (cancelled) return;
        if (r.status === 'illeggibile' && text) {
          await keepCopy(text, new Date(), 'illeggibile');
          setProblem('I dati salvati non erano leggibili: ne ho conservato una copia (Altro → Copie automatiche). Puoi anche usare “Ripristina” con il tuo ultimo backup.');
        } else if (r.status === 'piu_nuovi') {
          setReadOnly(true);
          setProblem(READ_ONLY_MESSAGE);
          if (r.data) setData(r.data);
        } else if (r.status === 'ok') {
          if (r.migratedFrom !== null && text) {
            // Copia della versione precedente, poi la struttura nuova verrà salvata.
            await keepCopy(text, new Date(), `prima-della-migrazione-v${r.migratedFrom}`);
            skipNextSave.current = false;
          }
          setData(r.data);
        }
      } catch {
        if (!cancelled) setProblem('Non riesco a leggere i dati salvati. Usa “Ripristina” con il tuo ultimo backup.');
      } finally {
        loaded.current = true;
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded.current || !ready || readOnly) return;
    // Il primo giro dopo il caricamento non riscrive il file (a meno che serva salvare una migrazione).
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    lastSave.current = saveText(serializeLocal(data)).catch(() =>
      setProblem('Non riesco a salvare i dati sul telefono. Fai subito “Esporta tutto”.'),
    );
  }, [data, ready, readOnly]);

  const update = useCallback(
    (change: (d: PersonalData) => PersonalData) => {
      if (readOnly) {
        setProblem(READ_ONLY_MESSAGE);
        return;
      }
      setData((d) => change(d));
    },
    [readOnly],
  );
  const flush = useCallback(() => lastSave.current, []);
  const value = useMemo(() => ({ data, ready, problem, readOnly, update, flush }), [data, ready, problem, readOnly, update, flush]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData va usato dentro DataProvider');
  return v;
}
