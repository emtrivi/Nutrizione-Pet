// Anteprima nel browser: apre la scheda in una nuova finestra con la stampa (da lì "Salva come PDF").

export async function shareRecipePdf(html: string, _fileName: string): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Finestra bloccata dal browser');
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
