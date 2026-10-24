// Tipi condivisi del motore di calcolo.
// Il motore non dipende dall'interfaccia: riceve dati, restituisce numeri e stati.

/** Unità usate dal motore (sempre quelle della tabella FEDIAF per ogni nutriente). */
export type Unit = 'g' | 'mg' | 'µg' | 'IU' | 'kcal';

/** Stato del dato come scritto nei cataloghi. */
export type DataStatus =
  | 'measured'
  | 'estimated'
  | 'calculated'
  | 'label'
  | 'analytical_zero'
  | string;

/**
 * Valore di un nutriente in un singolo alimento o integratore, già convertito
 * nell'unità del motore e riferito a 1 g di alimento (o a 1 unità di integratore).
 *
 * Se un nutriente non è noto, la voce NON esiste: mai zero.
 */
export interface ItemNutrient {
  value: number;
  /** Stato originale del dato nel catalogo (o il peggiore tra le parti, per i valori composti). */
  status: DataStatus;
  /** true se il valore è composto e una parte manca: il numero è "almeno". */
  partial: boolean;
  /** true se il dato è da verificare (regola dell'app, es. potassio QDiet). */
  toVerify: boolean;
  /** Spiegazioni da mostrare nel tocco sulla barra (es. "stima da C18:2 non differenziato"). */
  notes: string[];
  /** Componenti separati da mostrare (es. vitamina A: preformata + da beta-carotene). */
  parts?: Record<string, number | null>;
}

export type FediafTable = 95 | 110;

export type ActivityLevel = 'bassa' | 'normale' | 'alta';

/** MCS (massa muscolare): scala WSAVA a 4 livelli. */
export type MuscleScore = 'normale' | 'perdita_lieve' | 'perdita_moderata' | 'perdita_grave';

export interface Dog {
  id: string;
  name: string;
  ageYears?: number;
  weightKg: number;
  idealWeightKg?: number;
  /** Interruttore A3: usa il peso ideale per le calorie (se presente). */
  useIdealWeight: boolean;
  neutered: boolean;
  breed?: string;
  size?: string;
  /** Body Condition Score, 1-9. */
  bcs?: number;
  mcs?: MuscleScore;
  activity: ActivityLevel;
  /** Moltiplicatore scelto a mano (sostituisce quello proposto). */
  multiplierOverride?: number;
  /** Kcal al giorno scritte a mano (sostituiscono RER × moltiplicatore). */
  manualKcal?: number;
  /** Tabella FEDIAF scelta a mano (sostituisce quella proposta). */
  fediafTableOverride?: FediafTable;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
