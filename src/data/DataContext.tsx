// Dati personali condivisi tra le schermate. Si caricano all'avvio e si salvano a ogni modifica.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { emptyPersonalData, type PersonalData } from '../engine';
import { parseLocal, serializeLocal } from './personalStore';
import { keepCopy, loadText, saveText } from './storage';

interface DataContextValue {
  data: PersonalData;
  ready: boolean;
  /** Messaggio da mostrare se qualcosa non è andato (caricamento o salvataggio). */
  problem: string | null;
  update: (change: (data: PersonalData) => PersonalData) => void;
}

const Ctx = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersonalData>(emptyPersonalData);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = await loadText();
        const parsed = parseLocal(text);
        if (text && !parsed) {
          await keepCopy(text, new Date());
          if (!cancelled) {
            setProblem('I dati salvati non erano leggibili: ne ho conservato una copia. Usa “Ripristina” con il tuo ultimo backup.');
          }
        }
        if (!cancelled && parsed) setData(parsed);
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
    if (!loaded.current || !ready) return;
    saveText(serializeLocal(data)).catch(() =>
      setProblem('Non riesco a salvare i dati sul telefono. Fai subito “Esporta tutto”.'),
    );
  }, [data, ready]);

  const update = useCallback((change: (d: PersonalData) => PersonalData) => setData((d) => change(d)), []);
  const value = useMemo(() => ({ data, ready, problem, update }), [data, ready, problem, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData va usato dentro DataProvider');
  return v;
}
