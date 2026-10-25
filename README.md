# Nutrizione Pet

App per iPhone per calcolare e controllare le ricette casalinghe per cani adulti e sani.
Uso personale. **Strumento di supporto, da validare con la nutrizionista.**

## Com'è fatto il progetto

```
src/app/             schermate (Expo Router): schede Cani, Ricette, Diario, Catalogo, Altro
src/data/            dati personali: azioni, modulo del cane, salvataggio sul telefono, backup
app.json, eas.json   configurazione dell'app e della costruzione nel cloud (EAS → TestFlight)
data/catalog/        i tre file di dati (alimenti, integratori, FEDIAF): si leggono, non si modificano
docs/                specifiche e registro delle decisioni (DECISIONI.md)
src/engine/          motore di calcolo, separato dall'interfaccia
src/engine/__tests__ test con i calcoli fatti a mano sul cane d'esempio (30 kg)
src/ui/              componenti grafici, formati dei numeri, testi delle spiegazioni
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

### Costruire e inviare a TestFlight (da GitHub Codespaces)

1. Apri un Codespace sul ramo di lavoro (le dipendenze si installano da sole).
2. `npx eas-cli@latest login --device` (in Codespaces il login dal browser resta in attesa: usare `--device`).
3. `npx eas-cli@latest build --platform ios --profile production --auto-submit`
4. Spegni il Codespace da https://github.com/codespaces.

Prima build: 0.1.0 (1), 25/10/2026, build EAS `3e93b1d2-2aa1-43ba-b9e8-49375fad3f88`.

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
| `backup.ts` | "Esporta tutto" e "Ripristina" (senza catalogo) |

## Comandi

```
npm install      # una volta
npm test         # esegue tutti i test
npm run typecheck
npm run lint
npx expo export --platform ios   # prova che l'app si impacchetta
```
