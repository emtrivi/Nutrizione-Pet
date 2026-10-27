/** Nome del file PDF: "Ricetta_Manzo_e_riso_Fido_2026-10-27.pdf" (senza accenti né simboli). */
export function recipePdfFileName(recipeName: string, dogName: string, now: Date): string {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'senza_nome';
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `Ricetta_${clean(recipeName)}_${clean(dogName)}_${day}.pdf`;
}
