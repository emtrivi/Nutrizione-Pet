# Nutrizione Pet

App per iPhone per calcolare e controllare le ricette casalinghe per cani adulti e sani.
Uso personale. **Strumento di supporto, da validare con la nutrizionista.**

## Com'è fatto il progetto

```
App.tsx, index.ts    app Expo (React Native), per ora una schermata di prova
app.json, eas.json   configurazione dell'app e della costruzione nel cloud (EAS → TestFlight)
data/catalog/        i tre file di dati (alimenti, integratori, FEDIAF): si leggono, non si modificano
docs/                specifiche e registro delle decisioni (DECISIONI.md)
src/engine/          motore di calcolo, separato dall'interfaccia
src/engine/__tests__ test con i calcoli fatti a mano sul cane d'esempio (30 kg)
src/ui/              piccoli aiuti per l'interfaccia (formato dei numeri)
```

## App per iPhone

- Expo SDK 58, costruita nel cloud con EAS e inviata a TestFlight (nessun Mac necessario).
- Account Expo: `eviemet`. Bundle ID: `com.eviemet.nutrizionepet`.
- App Store Connect: Apple ID dell'app `6826643282`, Team ID `F9PKTRNTLH`.
- Costruire e inviare a TestFlight: `npx eas-cli@latest build --platform ios --profile production --auto-submit`

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
npx expo export --platform ios   # prova che l'app si impacchetta
```
