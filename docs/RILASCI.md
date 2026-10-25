# Rilasci e aggiornamenti di Nutrizione Pet

Obiettivo: chi sviluppa prepara e dichiara pronta una versione; l'utente riceve l'aggiornamento
sull'iPhone senza terminale e senza Codespaces.

## Come funziona

```
push su GitHub che cambia release/versione.json
        │
        ▼
EAS Workflow "Pubblica versione" (.eas/workflows/pubblica.yml), sui server di Expo
        │
        ├─ 1. impronta della parte nativa (fingerprint)
        ├─ 2. c'è già una build iOS con la stessa impronta?
        │
        ├─ SÌ → aggiornamento via internet (EAS Update, ramo/canale "production")
        │        l'app lo scarica e mostra «Aggiornamento disponibile — Riavvia ora»
        │
        └─ NO → nuova build iOS → invio a TestFlight
                 (TestFlight la installa da solo se "Aggiornamenti automatici" è attivo)
```

- I commit di sviluppo **non** fanno partire nulla: il workflow parte solo se il push cambia
  `release/versione.json` (filtro `paths`).
- **Mai** pubblicazione sull'App Store: solo TestFlight ed EAS Update.
- Account Expo, project ID, bundle ID e credenziali Apple restano quelli già funzionanti
  (`@eviemets-team/nutrizione-pet`, `7da057fe-…`, `com.eviemet.nutrizionepet`).

### Cosa arriva via internet e cosa richiede una build

| Modifica | Come arriva |
|---|---|
| Schermate, testi, calcoli, catalogo, correzioni JavaScript | aggiornamento via internet (minuti) |
| Numero di versione, `release/versione.json`, `eas.json` | non cambiano l'impronta: nessuna build |
| Nuovo pacchetto nativo (es. lo slider), plugin, impostazioni iOS in `app.json`, nuovo SDK Expo | build nuova + TestFlight (automatica) |

Verificato il 25/10/2026 calcolando l'impronta iOS su una copia del progetto: uguale cambiando
versione, `release/versione.json`, codice, catalogo ed `eas.json`; diversa cambiando impostazioni
iOS o aggiungendo un plugin.

## Configurazione una tantum (utente)

1. **Collegare GitHub a Expo**: expo.dev → progetto *nutrizione-pet* → **GitHub** → installare
   l'app GitHub di Expo sul repository `emtrivi/Nutrizione-Pet` e collegarlo (cartella base: radice).
2. **Chiave App Store Connect per l'invio automatico**: expo.dev → progetto → **Credentials** → iOS →
   `com.eviemet.nutrizionepet`: deve esserci una *App Store Connect API Key* usata da EAS Submit
   (creata alla prima build del 25/10/2026). Se manca, l'invio a TestFlight dal workflow fallisce
   con "App Store Connect API Keys cannot be set up in --non-interactive mode".
3. **iPhone → TestFlight → Nutrizione Pet → Aggiornamenti automatici: attivo.**

## Pubblicare una versione (chi sviluppa)

1. Lavorare e fare commit normalmente (nessuna pubblicazione).
2. Prima di dichiarare pronta una versione, tutto deve passare:
   - `npm test`, `npm run typecheck`, `npm run lint`
   - `npx expo export --platform ios` (l'app si impacchetta)
   - prova nell'anteprima web dei percorsi toccati
3. Se cambia la **struttura dei dati personali**: alzare `DATA_SCHEMA_VERSION`, aggiungere la
   migrazione in `src/engine/migrations.ts` e i test (vedi "Dati personali" sotto).
4. Se la modifica è **nativa** (nuovo pacchetto nativo, plugin, impostazioni iOS): alzare anche
   `version` in `app.json`, così TestFlight mostra un numero nuovo. Per le modifiche solo JavaScript
   `app.json` non si tocca.
5. Aggiornare `release/versione.json` (`versione`, `data`, `note`) e fare commit con un messaggio
   chiaro, per esempio `Pubblica 0.3.1: …` (diventa il messaggio dell'aggiornamento su Expo).
6. Push. Il workflow decide da solo tra aggiornamento via internet e build TestFlight.

### Rinnovo TestFlight (ogni 2-3 mesi)

Le build TestFlight scadono dopo 90 giorni e gli aggiornamenti via internet non allungano la
scadenza. Per una build nuova anche senza modifiche native: cambiare la data in
`release/rinnovo-testflight.json` e fare push (workflow `.eas/workflows/rinnovo-testflight.yml`).

## Ritirare un aggiornamento difettoso

Il recupero automatico di `expo-updates` (se l'app non parte torna alla versione precedente) è un
aiuto, non una garanzia: un errore che non blocca l'avvio non viene ritirato da solo.

**A. Procedura ordinaria (chi sviluppa, senza terminale per l'utente).** È la più sicura perché usa
lo stesso percorso collaudato delle pubblicazioni.
1. `git revert` dei commit difettosi (o ripristino dei file dalla versione buona).
2. Nuovo numero in `release/versione.json` con nota "Ritiro di X: torna a Y".
3. Push: il workflow pubblica il codice buono come nuovo aggiornamento (10-20 minuti).

**B. Dal sito expo.dev (utente, senza chi sviluppa).** Progetto → **Updates** → ramo `production` →
aprire l'ultimo aggiornamento buono → **Republish**. Da verificare la prima volta che serve: i
comandi del sito possono cambiare.

**C. Ultima risorsa (terminale, Codespaces).** `npx eas-cli@latest update:rollback` (sceglie un
aggiornamento precedente o quello incluso nella build) oppure
`npx eas-cli@latest update:roll-back-to-embedded --branch production --platform ios`.

Dopo il ritiro, sull'iPhone: chiudere e riaprire l'app (o "Riavvia ora" quando compare l'avviso).

## Dati personali: protezioni

- I dati stanno in un file nella cartella Documenti dell'app: gli aggiornamenti non lo toccano.
- Il salvataggio scrive prima un file temporaneo e poi lo sostituisce (niente file a metà).
- La struttura ha un numero (`DATA_SCHEMA_VERSION`, oggi 2). Un file più vecchio viene portato alla
  struttura attuale con le migrazioni, **dopo** averne conservato una copia automatica.
- Se il file è stato salvato da una versione **più nuova** (per esempio dopo il ritiro di un
  aggiornamento), l'app lo mostra ma non lo sovrascrive mai (sola lettura) e lo dice.
- Le copie automatiche si ripristinano da Altro → Copie automatiche.
- I backup ("Esporta tutto") hanno lo stesso numero di struttura: quelli più vecchi si ripristinano
  con le migrazioni; quelli più nuovi vengono rifiutati con un messaggio chiaro.

Regole per chi sviluppa:
1. Cambiare la struttura solo aggiungendo campi; i campi nuovi devono avere un valore iniziale.
2. Ogni cambio alza `DATA_SCHEMA_VERSION` di 1 e aggiunge la migrazione dalla versione precedente.
3. Le migrazioni non cancellano dati e non inventano dati essenziali (un file senza cani resta rovinato).
4. Test obbligatori: file della versione precedente → attuale; backup della versione precedente;
   file di una versione futura → sola lettura.

## L'avviso nell'app

- expo-updates controlla all'apertura; l'app controlla anche quando torna in primo piano (al massimo
  ogni 15 minuti).
- Quando un aggiornamento è scaricato compare «Aggiornamento disponibile — Riavvia ora» con
  **Riavvia ora** e **Più tardi**, solo nelle schede principali (Cani, Ricette, Diario, Catalogo,
  Altro): mai dentro una ricetta o un modulo in compilazione.
- "Riavvia ora" aspetta che l'ultimo salvataggio sia finito. "Più tardi" lo nasconde: si installerà
  alla prossima apertura completa dell'app.
- Altro → Informazioni mostra la versione e se è arrivata via internet o con l'installazione.

## Limiti noti

- **Piano gratuito Expo**: 15 build iOS al mese; invii a TestFlight gratuiti; aggiornamenti inclusi
  fino a 1.000 utenti al mese; circa 60 minuti al mese di calcolo per i workflow (impronta e
  pubblicazione li consumano). Se si esauriscono, il servizio si ferma fino al mese dopo, senza costi.
- Dall'ambiente di sviluppo di Claude i server Expo non sono raggiungibili: l'esito dei workflow si
  vede su expo.dev (pagina Workflows) o nelle email di Expo.
- La prima versione con gli aggiornamenti (0.3.0) arriva per forza con una build TestFlight: le build
  precedenti non contengono expo-updates.
