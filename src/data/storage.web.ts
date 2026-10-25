// Anteprima nel browser (solo per le verifiche): i dati restano nel browser.

const KEY = 'nutrizione-pet-dati';

export async function loadText(): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export async function saveText(text: string): Promise<void> {
  globalThis.localStorage?.setItem(KEY, text);
}

export async function keepCopy(text: string, now: Date): Promise<void> {
  globalThis.localStorage?.setItem(`${KEY}-illeggibili-${now.getTime()}`, text);
}
