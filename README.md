# Nutrizione Pet

App per iPhone per calcolare e controllare le ricette casalinghe per cani adulti e sani.
Uso personale. **Strumento di supporto, da validare con la nutrizionista.**

## Com'è fatto il progetto

```
src/app/             schermate (Expo Router): schede Cani, Ricette, Diario, Catalogo, Altro
src/data/            dati personali: azioni, modulo del cane, salvataggio sul telefono, backup
app.json, eas.json   configurazione dell'app, della costruzione (EAS → TestFlight) e degli aggiornamenti
.eas/workflows/      processi automatici su Expo: pubblica.yml, rinnovo-testflight.yml
release/             versione.json (dichiara pronta una versione), rinnovo-testflight.json
fingerprint.config.js impronta della parte nativa (preset balanced)
src/updates/         avviso «Aggiornamento disponibile — Riavvia ora»
data/catalog/        i tre file di dati (alimenti, integratori, FEDIAF): si leggono, non si modificano
docs/                specifiche, decisioni (DECISIONI.md), rilasci e ritiro aggiornamenti (RILASCI.md)
src/engine/          motore di calcolo, separato dall'interfaccia
src/engine/__tests__ test con i calcoli fatti a mano sul cane d'esempio (30 kg)
src/ui/              componenti grafici, barre, formati dei numeri, testi delle spiegazioni
src/ui/recipe/       ricetta guidata (4 passi), scelta dal catalogo, dettaglio dei nutrienti
```

## App per iPhone

- Expo SDK 58, costruita nel cloud con EAS e inviata a TestFlight (nessun Mac necessario).
- Progetto Expo: `@eviemets-team/nutrizione-pet` (owner `eviemets-team`, ID `7da057fe-9294-45e9-b684-7a233703b730`).
  Non cambiare owner né projectId: il progetto esiste sotto il team.
- Bundle ID: `com.eviemet.nutrizionepet`.
- App Store Connect: Apple ID dell'app `6826643282`, Team ID `F9PKTRNTLH`.
- Credenziali Apple (certificato, profilo, chiave API) conservate su EAS, valide fino al 25/10/2027: non ricrearle.
- Numero di build: gestito da EAS (`appVersionSource: remote` + `autoIncrement`), sale da solo a ogni costruzione.
  La versione visibile (`version` in `app.json`) si cambia a mano solo quando serve.

### Aggiornamenti e rilasci (automatici)

Vedi **docs/RILASCI.md**. In breve: si dichiara pronta una versione cambiando `release/versione.json`;
il workflow EAS `.eas/workflows/pubblica.yml` pubblica un aggiornamento via internet (EAS Update) se la
parte nativa non è cambiata, altrimenti fa una build e la invia a TestFlight. Nessun terminale.

Prima build: 0.1.0 (1), 25/10/2026, build EAS `3e93b1d2-2aa1-43ba-b9e8-49375fad3f88`.

**Solo in emergenza** (se i workflow non sono disponibili), da GitHub Codespaces:
`npx eas-cli@latest login --device` e poi
`npx eas-cli@latest build --platform ios --profile production --auto-submit`.

### Avvisi di sicurezza delle dipendenze (`npm audit`)

Restano 5 avvisi "high", tutti negli strumenti di sviluppo, non nell'app installata sul telefono:
`node-forge` (nessuna versione corretta esiste ancora) e `zod` 3 (corretto solo in zod 4),
dentro `@expo/cli` e `eslint-config-expo`. Non usare `npm audit fix --force`: proporrebbe
di tornare a Expo SDK 44 e romperebbe l'app. Si risolveranno aggiornando Expo quando escono le correzioni.

Il motore contiene:

| File | Cosa fa |
|---|---|
| `energy.ts` | RER, moltiplicatore, kcal, fattore, scelta della tabella 95/110 |
| `requirements.ts` | fabbisogni FEDIAF per 1.000 kcal e per giorno, nei 5 gruppi |
| `catalog.ts` | legge i cataloghi e converte tutto a una base comune; i dati mancanti restano mancanti |
| `supplementRules.ts` | regole dell'utente sugli integratori (dosi, vitamina E Omegor, potassio QDiet) |
| `totals.ts` | somma dei nutrienti di una ricetta, con "valore parziale" |
| `status.ts` | colori delle barre (verde, arancione, rosso, grigio) |
| `dose.ts` | dose di partenza degli integratori |
| `prices.ts` | prezzi al kg, a confezione, a capsula; totale "incompleto" se manca un prezzo |
| `backup.ts` | "Esporta tutto" e "Ripristina" (senza catalogo), impostazioni |
| `migrations.ts` | versione della struttura dei dati e migrazioni |
| `recipes.ts` | grammi di partenza, valutazione della ricetta, controlli di buon senso, "da rivedere" |
| `bars.ts` | barre a tratti uguali e posizione della freccia |

## Comandi

```
npm install      # una volta
npm test         # esegue tutti i test
npm run typecheck
npm run lint
npx expo export --platform ios   # prova che l'app si impacchetta
```
