import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Platform, Text } from 'react-native';
import { pickBackupText, shareBackupFile } from '../../data/backupIO';
import { useData } from '../../data/DataContext';
import { markBackup } from '../../data/personalStore';
import { backupFileName, backupReminder, exportBackup, getCatalog, parseBackup, type PersonalData } from '../../engine';
import { Button, Card, Explain, Hint, InfoButton, LinkRow, Notice, Screen } from '../../ui/components';
import { colors } from '../../ui/theme';

const catalog = getCatalog();

function ask(title: string, message: string, yes: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annulla', style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export default function AltroScreen() {
  const { data, update } = useData();
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);
  const reminder = backupReminder(data.lastBackupAt, new Date(), data.settings.backupReminderDays);

  const exportAll = async () => {
    const now = new Date();
    try {
      await shareBackupFile(exportBackup(data, now, catalog.version.label), backupFileName(now));
      update((d) => markBackup(d, now));
      setMessage({ tone: 'info', text: 'Backup creato. Controlla di averlo salvato in File o su iCloud Drive.' });
    } catch {
      setMessage({ tone: 'danger', text: 'Non è stato possibile creare il backup. Riprova.' });
    }
  };

  const restore = async () => {
    setMessage(null);
    let text: string | null;
    try {
      text = await pickBackupText();
    } catch {
      setMessage({ tone: 'danger', text: 'Non riesco a leggere il file scelto.' });
      return;
    }
    if (text === null) return;
    const r = parseBackup(text, new Date());
    if (!r.ok) {
      setMessage({ tone: 'danger', text: r.error });
      return;
    }
    const restored: PersonalData = r.data;
    ask(
      'Sostituire i dati?',
      `Il backup del ${formatDate(r.exportedAt)} contiene ${restored.dogs.length} cani e ${Object.keys(restored.prices).length} prezzi. ` +
        `I dati attuali (${data.dogs.length} cani) verranno sostituiti. Il catalogo non cambia.`,
      'Sostituisci',
      () => {
        update(() => restored);
        setMessage({ tone: 'info', text: 'Dati ripristinati.' });
      },
    );
  };

  return (
    <Screen>
      <Card title="Backup dei tuoi dati" right={<InfoButton topic="backup" label="Backup: perché e come" />}>
        <Explain>
          I tuoi dati stanno solo su questo telefono. “Esporta tutto” crea un file da salvare in File o su iCloud Drive;
          “Ripristina” lo rilegge. Il catalogo non fa parte del backup.
        </Explain>
        <Text style={{ fontSize: 15, color: reminder.due ? colors.warningText : colors.text }}>{reminder.message}</Text>
        <Button title="Esporta tutto" onPress={exportAll} />
        <Button title="Ripristina da un file" kind="secondary" onPress={restore} />
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      </Card>

      <Card title="Impostazioni">
        <LinkRow href="/impostazioni" title="Valori da concordare con la nutrizionista" subtitle="Ripartizione delle calorie, controlli di buon senso, colori, moltiplicatori, promemoria" />
      </Card>

      <Card title="Spiegazioni">
        <LinkRow href={{ pathname: '/info/[topic]', params: { topic: 'legenda' } }} title="Colori e segni" subtitle="Verde, arancione, rosso, grigio; dato indicativo e provvisorio" />
        <LinkRow href={{ pathname: '/info/[topic]', params: { topic: 'bcs' } }} title="BCS: condizione corporea" />
        <LinkRow href={{ pathname: '/info/[topic]', params: { topic: 'mcs' } }} title="MCS: massa muscolare" />
        <LinkRow href={{ pathname: '/info/[topic]', params: { topic: 'attivita' } }} title="Livelli di attività" />
        <LinkRow href={{ pathname: '/info/[topic]', params: { topic: 'calorie' } }} title="Come si calcolano le calorie" />
        <LinkRow href={{ pathname: '/info/[topic]', params: { topic: 'moltiplicatore' } }} title="Come scegliere il moltiplicatore" />
        <LinkRow href={{ pathname: '/info/[topic]', params: { topic: 'tabella' } }} title="Tabella FEDIAF 95 o 110" />
      </Card>

      <Card title="Informazioni">
        <Hint>Nutrizione Pet, versione {Constants.expoConfig?.version ?? '?'}</Hint>
        <Hint>{catalog.version.label}</Hint>
        <Hint>Riferimenti: FEDIAF Nutritional Guidelines 2025, cane adulto.</Hint>
      </Card>
    </Screen>
  );
}
