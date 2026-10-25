// Anteprima nel browser: scarica il file di backup e lo rilegge con il selettore del browser.

import * as DocumentPicker from 'expo-document-picker';

export async function shareBackupFile(text: string, fileName: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function pickBackupText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return (await fetch(asset.uri)).text();
}
