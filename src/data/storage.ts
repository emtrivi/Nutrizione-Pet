// Salvataggio dei dati personali sul telefono: un file nella cartella Documenti dell'app.
// iOS non cancella questa cartella; si perde solo disinstallando l'app (per questo c'è il backup).

import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'dati-personali.json';

export async function loadText(): Promise<string | null> {
  const file = new File(Paths.document, FILE_NAME);
  return file.exists ? file.text() : null;
}

export async function saveText(text: string): Promise<void> {
  const file = new File(Paths.document, FILE_NAME);
  if (!file.exists) file.create();
  await file.write(text);
}

/** Conserva una copia di un file illeggibile, per non perderlo. */
export async function keepCopy(text: string, now: Date): Promise<void> {
  const file = new File(Paths.document, `dati-illeggibili-${now.getTime()}.json`);
  file.create();
  await file.write(text);
}
