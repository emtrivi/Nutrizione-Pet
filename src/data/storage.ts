// Salvataggio dei dati personali sul telefono: un file nella cartella Documenti dell'app.
// iOS non cancella questa cartella; gli aggiornamenti dell'app (anche via internet) non la toccano.
// Si perde solo disinstallando l'app: per questo c'è il backup.

import { Directory, File, Paths } from 'expo-file-system';

const FILE_NAME = 'dati-personali.json';
const COPY_PREFIX = 'copia-';

export async function loadText(): Promise<string | null> {
  const file = new File(Paths.document, FILE_NAME);
  return file.exists ? file.text() : null;
}

export async function saveText(text: string): Promise<void> {
  // Si scrive prima un file temporaneo e poi lo si sposta: se l'app si chiude a metà,
  // il file buono precedente resta intatto.
  const tmp = new File(Paths.document, `${FILE_NAME}.tmp`);
  if (tmp.exists) tmp.delete();
  tmp.create();
  await tmp.write(text);
  await tmp.move(new File(Paths.document, FILE_NAME), { overwrite: true });
}

/** Conserva una copia (es. prima di una migrazione o di un file illeggibile). Restituisce il nome. */
export async function keepCopy(text: string, now: Date, reason: string): Promise<string> {
  const name = `${COPY_PREFIX}${now.toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${reason}.json`;
  const file = new File(Paths.document, name);
  if (!file.exists) file.create();
  await file.write(text);
  return name;
}

/** Copie automatiche presenti, dalla più recente. */
export async function listCopies(): Promise<string[]> {
  const dir = new Directory(Paths.document);
  return dir
    .list()
    .filter((e): e is File => e instanceof File && e.name.startsWith(COPY_PREFIX))
    .map((f) => f.name)
    .sort()
    .reverse();
}

export async function readCopy(name: string): Promise<string | null> {
  const file = new File(Paths.document, name);
  return file.exists ? file.text() : null;
}
