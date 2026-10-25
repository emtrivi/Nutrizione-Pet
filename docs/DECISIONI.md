# Decisioni prese

Registro delle scelte che non erano scritte nelle specifiche, con data e chi le ha prese.
Le voci "da confermare" vanno riviste con la nutrizionista.

## 24/10/2026 — decise dall'utente

| Punto | Decisione |
|---|---|
| A2 Tabella FEDIAF | Si confronta il fattore (kcal ÷ kg^0,75) **arrotondato all'intero**: 110 o più → tabella 110; sotto → tabella 95; sotto 95 → tabella 95 con avviso. Così 1.410 kcal per 30 kg (109,996) dà la 110. |
| A3 Peso | Si usa il **peso attuale**; un interruttore permette di usare il peso ideale. |
| A4 Moltiplicatori | Bassa 1,4 / 1,6; normale 1,6 / 1,8; alta 2,0 / 2,0 (sterilizzato / non sterilizzato). Modificabili. *Da confrontare con i menù della nutrizionista.* |
| A5 Vitamina A | UI del catalogo se ci sono, altrimenti retinolo ÷ 0,3; **più** beta-carotene × 0,833 (FEDIAF VII-14: 1 mg = 833 UI), mostrato separato. *La nutrizionista confermerà quanto contare.* |
| A6 Calorie | Si usa il valore `kcal_me_per_100g` scritto nel catalogo e si mostra il metodo (`me_method`). |
| A7 Versione catalogo | Ricavata dalla data nel nome del file (es. "23/10/2026"). Ogni alimento ha anche un'impronta dei valori per accorgersi dei cambiamenti. |

## 24/10/2026 — catalogo integratori

Sostituito con `CATALOGO_INTEGRATORI_UNICO_5_PROFILI_REVISIONATO_2026-10-24.json` (stessi 5 identificativi).
Il file non si modifica: queste regole sono in `src/engine/supplementRules.ts`.

1. Le dosi sono indicazioni del produttore, mai limiti: la barra della dose non blocca mai.
2. QDiet: interpolazione tra 5 e 30 kg; fuori è "estrapolata". Misurino raso = 3 g, mostrato accanto ai grammi.
3. Farina d'ossa Grau: fasce, senza interpolazione (fino a 10 kg 1,5 g; fino a 25 kg 5 g; fino a 40 kg 7,5 g; oltre 40 kg 10 g, quest'ultimo scritto solo nella nota).
4. Omegor: vitamina E d-alfa-tocoferolo naturale, 10 mg × 1,49 = 14,9 UI per capsula; non è valore parziale. La nota del file ("non convertire") è superata da questa regola.
5. Potassio del QDiet (7,5%): mostrato "da verificare".
6. Tutti e cinque abilitati, con l'etichetta "dato provvisorio".

## 24/10/2026 — eccezioni alla regola del dato parziale (decise dall'utente)

La regola generale resta: un dato mancante non è zero e rende il totale "valore parziale".
Due eccezioni:

1. **Beta-carotene nei prodotti animali.** Se carni, frattaglie, pesci, uova (categoria `animal` del catalogo) o olio di salmone (`salmon_oil`) non dichiarano il beta-carotene, la vitamina A **non** è segnata parziale: nei prodotti animali il beta-carotene è praticamente zero. Nel tocco sulla barra: "Beta-carotene non dichiarato: considerato trascurabile nei prodotti animali."
   Per gli alimenti vegetali e per il riso cotto resta parziale (oggi: riso bianco cotto, grano saraceno, miglio, pasta di grano secchi).
   Un alimento animale senza vitamina A preformata (es. macinato bovino) resta senza dato: l'eccezione riguarda solo il beta-carotene.
2. **Omegor.** È olio di pesce con vitamina E: i nutrienti non dichiarati contano **zero**. Nel tocco sulla barra: "Non dichiarato dal produttore, considerato trascurabile."
   Per tutti gli altri integratori i nutrienti non dichiarati restano sconosciuti.
   Se un totale è fatto solo di questi zeri "per scelta" (es. cloruro con il solo Omegor), resta grigio: uno zero per scelta non è un dato.

Nel codice: `ANIMAL_ORIGIN_EXTRA_IDS` e `isAnimalOrigin` in `src/engine/catalog.ts`; `undeclaredAsZeroNote` in `src/engine/supplementRules.ts`.

## Scelte tecniche del motore (proposte, modificabili)

- Integratori: il beta-carotene non è una voce d'etichetta, quindi la sua assenza non rende parziale la vitamina A di un integratore. Negli alimenti invece sì.
- Massimo di legge (L): vale sempre se il nutriente arriva anche da un integratore; se arriva solo da alimenti naturali dipende dall'impostazione "rosso / solo avviso" (punto aperto, per ora "solo avviso").
- Sostanza secca: se un ingrediente non ha l'acqua nel catalogo, la sostanza secca è parziale e il limite L convertito risulta più severo (prudente).
- Aumento del 10% degli aminoacidi: presente ma spento finché la nutrizionista non decide.

## Punti ancora aperti

Vedi la tabella "Punti aperti" nelle specifiche (`docs/Specifiche_app_menu_cani.pdf`).

## 25/10/2026 — moltiplicatore (richiesta dell'utente)

Nel modulo del cane: spiegazione "Come scegliere il moltiplicatore" (tasto "i") e confronto con i numeri del cane
(1,2 · 1,4 · 1,6 · 1,8 · 2,0 → kcal al giorno e tabella FEDIAF); si tocca un valore per sceglierlo.
Riferimenti generali delle linee guida veterinarie per cani adulti sani; il valore giusto si conferma con peso e BCS.

## 25/10/2026 — Fase 2: scelte proposte (modificabili in Altro → Impostazioni)

| Punto | Scelta | Stato |
|---|---|---|
| Ripartizione delle calorie per i grammi di partenza | proteica 55%, energetica 30%, verdure 2%, grassi 8%, frattaglie 5%; riportata a 100 sulle sole categorie scelte; quota divisa in parti uguali tra gli alimenti della stessa categoria; arrotondamento al grammo | da concordare con la nutrizionista |
| Controlli di buon senso | pasto oltre il 6% del peso del cane; verdure oltre il 30% del peso degli alimenti; fegato oltre il 5%; altre frattaglie oltre il 5% | da concordare con la nutrizionista |
| Massimo di legge (L) su alimenti naturali | "solo avviso" (se arriva anche da un integratore vale sempre) | punto aperto |
| Calorie della ricetta | verde entro ±5% dall'obiettivo, arancione entro ±10%, rosso oltre | proposta |
| Barre | 5 tratti uguali; il tratto rosso alto arriva al doppio del limite +10%; con solo minimo il verde arriva al doppio del minimo; il verde comprende minimo e massimo | proposta |
| Riepilogo dei colori | conta i 43 nutrienti con una riga FEDIAF (gli extra solo informativi non contano) | proposta |
| Omega-6/omega-3 | acido linoleico ÷ (ALA + EPA + DHA), solo informativo | proposta |
| Dose di partenza degli integratori | QDiet: la più bassa della tabella (interpolata); farina d'ossa: la dose della fascia; senza tabella del produttore: 0, la sceglie l'utente | proposta |
| "Da rivedere" | peso o calorie del cane cambiati, ricetta copiata per un altro cane, dati del catalogo cambiati (impronta), cane eliminato. Salvare la ricetta la segna come rivista. I grammi non cambiano mai da soli | specifiche |
| Cane eliminato | le sue ricette restano (segnate "il cane non esiste più") e si possono eliminare | proposta |

## 25/10/2026 — aggiornamenti automatici (EAS Update + EAS Workflows)

Decise dall'utente: pubblicazione solo quando cambia `release/versione.json` (non un ramo dedicato);
avviso «Aggiornamento disponibile — Riavvia ora» con "Più tardi", mai durante una ricetta o un modulo;
modifiche native → build e TestFlight automatici, il resto via EAS Update; mai App Store.

Scelte tecniche (dettagli in `docs/RILASCI.md`):

| Punto | Scelta | Perché |
|---|---|---|
| Compatibilità aggiornamento-build | `runtimeVersion: { policy: "fingerprint" }` | È l'unica politica che rende impossibile mandare un aggiornamento a una build con una parte nativa diversa, ed è la stessa impronta che il workflow usa per decidere se serve una build: una sola regola, nessun numero da ricordare di alzare. Nella documentazione dell'SDK 58 non è più indicata come sperimentale. L'alternativa `appVersion` (consigliata da `eas update:configure`) dipende dal ricordarsi di alzare la versione a ogni modifica nativa: se ci si dimentica, un aggiornamento può arrivare su una build incompatibile. |
| Cosa conta nell'impronta | `fingerprint.config.js` con preset `balanced` esplicito | Esclude versione, `eas.json` e script; JavaScript e `release/` non ne fanno mai parte. Verificato misurando l'impronta (vedi RILASCI.md). |
| Workflow | modello ufficiale "deploy to production" di Expo, solo iOS, ramo EAS Update `production` | Già collaudato da Expo; Android tolto. |
| Ritiro di un aggiornamento | procedura scritta in tre livelli (revert + nuova pubblicazione; Republish dal sito; CLI) | Nessun workflow di ritiro non collaudabile da qui. |
| Dati | `DATA_SCHEMA_VERSION` = 2, migrazioni, copia prima di migrare, sola lettura se i dati sono più nuovi, salvataggio con file temporaneo | Protegge dati e backup anche se un aggiornamento viene ritirato. |
| Versione mostrata | da `release/versione.json` (nell'app, Altro → Informazioni) | `app.json` "version" si alza solo con le build native. |
