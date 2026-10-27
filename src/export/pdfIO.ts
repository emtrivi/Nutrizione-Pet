// Crea il PDF della scheda e apre il foglio di condivisione di iOS (File, Mail, WhatsApp, Stampa…).

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** A4 a 72 punti per pollice. */
const A4 = { width: 595, height: 842 };
const MARGIN = 28;

export async function shareRecipePdf(html: string, fileName: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({
    html,
    ...A4,
    margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
  });
  const dest = new File(Paths.cache, fileName);
  await new File(uri).move(dest, { overwrite: true });
  await Sharing.shareAsync(dest.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Condividi la scheda della ricetta' });
}
