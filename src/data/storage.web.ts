// Anteprima nel browser (solo per le verifiche): i dati restano nel browser.

const KEY = 'nutrizione-pet-dati';
const COPY_PREFIX = `${KEY}-copia-`;

const ls = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export async function loadText(): Promise<string | null> {
  return ls()?.getItem(KEY) ?? null;
}

export async function saveText(text: string): Promise<void> {
  ls()?.setItem(KEY, text);
}

export async function keepCopy(text: string, now: Date, reason: string): Promise<string> {
  const name = `${now.toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${reason}.json`;
  ls()?.setItem(COPY_PREFIX + name, text);
  return `copia-${name}`;
}

export async function listCopies(): Promise<string[]> {
  const s = ls();
  if (!s) return [];
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k?.startsWith(COPY_PREFIX)) out.push(`copia-${k.slice(COPY_PREFIX.length)}`);
  }
  return out.sort().reverse();
}

export async function readCopy(name: string): Promise<string | null> {
  return ls()?.getItem(COPY_PREFIX + name.replace(/^copia-/, '')) ?? null;
}
