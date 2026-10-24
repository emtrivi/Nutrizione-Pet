// Regole dell'app sugli integratori, decise dall'utente il 24/10/2026.
// I file del catalogo NON si modificano: queste regole si applicano sopra, alla lettura.

export interface NutrientOverride {
  /** Forma chimica da usare per la conversione (es. vitamina E). */
  form?: string;
  /** Il dato va mostrato come "da verificare". */
  toVerify?: boolean;
  /** Spiegazione mostrata nel tocco sulla barra. */
  note: string;
}

export type DoseRule =
  | {
      /** Interpolazione lineare sulla tabella del produttore (min-max per peso). */
      kind: 'interpolated';
      /** Intervallo di peso coperto dal produttore; fuori è "estrapolata". */
      officialFromKg: number;
      officialToKg: number;
      /** Misura di casa da mostrare accanto ai grammi. */
      householdMeasure?: { label: string; grams: number };
    }
  | {
      /** Fasce di peso, senza interpolazione. */
      kind: 'bands';
      bands: { upToKg: number | null; max: number; fromNoteOnly: boolean }[];
    }
  | { kind: 'none'; reason: string };

export interface SupplementRule {
  /** Mostra l'etichetta "dato provvisorio". */
  provisional: boolean;
  nutrientOverrides?: Record<string, NutrientOverride>;
  dose: DoseRule;
}

export const SUPPLEMENT_RULES: Record<string, SupplementRule> = {
  qdiet: {
    provisional: true,
    nutrientOverrides: {
      potassium: {
        toVerify: true,
        note: 'Potassio 7,5%: dato storico non confermato sulla scheda attuale, da verificare.',
      },
    },
    dose: {
      kind: 'interpolated',
      officialFromKg: 5,
      officialToKg: 30,
      householdMeasure: { label: 'misurino raso', grams: 3 },
    },
  },
  omegor_vitality: {
    provisional: true,
    nutrientOverrides: {
      vitamin_e: {
        form: 'd_alpha_tocopherol',
        note:
          'Vitamina E naturale (d-alfa-tocoferolo) secondo la scheda del produttore: ' +
          '10 mg × 1,49 = 14,9 UI per capsula (FEDIAF VII-14). Regola dell’utente.',
      },
    },
    dose: { kind: 'none', reason: 'Nessuna tabella di dosi del produttore nel catalogo.' },
  },
  bone_meal: {
    provisional: true,
    dose: {
      kind: 'bands',
      bands: [
        { upToKg: 10, max: 1.5, fromNoteOnly: false },
        { upToKg: 25, max: 5, fromNoteOnly: false },
        { upToKg: 40, max: 7.5, fromNoteOnly: false },
        // "oltre 40 kg 10 g" è scritto solo nella nota del produttore.
        { upToKg: null, max: 10, fromNoteOnly: true },
      ],
    },
  },
  calcium_carbonate_pure_reference: {
    provisional: true,
    dose: { kind: 'none', reason: 'Riferimento teorico: nessuna dose del produttore.' },
  },
  eggshell_powder_reference: {
    provisional: true,
    dose: { kind: 'none', reason: 'Riferimento generico: nessuna dose del produttore.' },
  },
};
