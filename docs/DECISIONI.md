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
| Workflow | modello ufficiale "deploy to production" di Expo, solo iOS, pubblicazione sul canale `production` (dal 25/10/2026; prima sul ramo `production`, ma lo 0.4.0 non arrivava all'app) | Già collaudato da Expo; Android tolto. |
| Ritiro di un aggiornamento | procedura scritta in tre livelli (revert + nuova pubblicazione; Republish dal sito; CLI) | Nessun workflow di ritiro non collaudabile da qui. |
| Dati | `DATA_SCHEMA_VERSION` = 2, migrazioni, copia prima di migrare, sola lettura se i dati sono più nuovi, salvataggio con file temporaneo | Protegge dati e backup anche se un aggiornamento viene ritirato. |
| Versione mostrata | da `release/versione.json` (nell'app, Altro → Informazioni) | `app.json` "version" si alza solo con le build native. |

## 25/10/2026 — Fase 3: diario, suggerimenti, sostituzione (scelte proposte)

| Punto | Scelta |
|---|---|
| Copia fissa | All'assegnazione si salvano ingredienti con grammi, kcal, peso e kcal del cane, e per ogni nutriente valore, colore, limiti e barra già calcolati. Il diario non ricalcola mai il passato. |
| Periodi | Una ricetta al giorno per cane. Un periodo "in corso" vale fino a oggi; i giorni futuri restano vuoti. Assegnando giorni già occupati l'app chiede conferma e toglie solo quei giorni dai periodi esistenti (un periodo tagliato in mezzo diventa due, con la stessa copia fissa). |
| Media | Media dei valori ogni 1.000 kcal dei soli giorni con ricetta, confrontata con la media dei limiti di quei giorni; a righe ("almeno") se un giorno ha il dato parziale o mancante. Calcio/fosforo con i limiti FEDIAF 1–2. |
| Avviso nel tempo | Nutrienti con riga FEDIAF rossi o arancioni per almeno N giorni di fila fino a oggi (N = 7 all'inizio, in Impostazioni). Un giorno senza ricetta interrompe la serie. |
| Suggerimenti | Solo per nutrienti in carenza (rossi o arancioni). Si propongono gli integratori del catalogo che contengono il nutriente (non quelli "non dichiarati = 0" né quelli già nella ricetta). Dose: la più bassa del produttore (o la fascia); se il produttore non dà una dose, quella che porterebbe il nutriente al minimo del giorno, arrotondata per eccesso a 0,5 g (o a 1 capsula). Anteprima: nutriente prima/dopo, altri nutrienti che cambiano colore, calcio/fosforo. Si aggiunge solo toccando "Aggiungi". |
| Sostituzione | Il nuovo alimento prende le stesse calorie del vecchio (grammi arrotondati al grammo); se le calorie non sono note restano gli stessi grammi. |
| Date | Pulsanti ‹ › e "Oggi" invece del selettore nativo: nessun componente nativo nuovo, quindi la versione arriva via internet. |
| Struttura dei dati | Nessun cambio di numero (resta 2): il campo "diario" esisteva già vuoto, quindi un eventuale ritiro dell'aggiornamento non crea incompatibilità. |

## 26/10/2026 — catalogo alimenti: aggiunte dal foglio Excel della nutrizionista

Nuovo file `data/catalog/CATALOGO_CANI_REVISIONATO_2026-10-26.json` = catalogo del 23/10 (95 voci identiche,
spostato in `data/catalog/archivio/`) + due voci dal foglio `data/catalog/fonti/Catalogo_Nutrizione_Pet_LINO_MANZO10_COMPLETATI_2026-10-26.xlsx`:

- `beef_10` Macinato di manzo crudo 10% grassi (USDA SR Legacy 174030), distinto da `beef_mid_10` (12,8%, Foundation) per scelta della nutrizionista.
  La forma della vitamina E era vuota nel foglio: indicata all'importazione come naturale (d-alfa-tocoferolo), come scritto nella nota
  della voce ("E alfa-tocoferolo") e come per tutti gli altri alimenti. Acido arachidonico, EPA, DHA e cloruro restano sconosciuti (celle vuote).
- `linseed_oil` Olio di lino spremuto a freddo (USDA SR Legacy 167702); minerali a 0 come dichiarato dalla fonte.

Procedura (script `scripts/catalogo_da_excel.py`): le voci già presenti devono essere identiche, altrimenti lo script si ferma ed
elenca le differenze (vanno confermate a parte); nessuna voce si cancella; cella vuota = dato non noto. Le impronte delle 95 voci
esistenti non cambiano, quindi nessuna ricetta diventa "da rivedere". Arriva con un aggiornamento via internet.

## 26/10/2026 — suggerimenti anche dalla fonte di grassi (decisione dell'utente)

Per gli acidi grassi in carenza (acido linoleico; arachidonico, ALA ed EPA+DHA solo se si sceglie a mano un minimo,
perché FEDIAF non ne dà per l'adulto) il dettaglio del nutriente propone, oltre agli integratori, gli **alimenti della
fonte di grassi** del catalogo che lo contengono e si possono usare nelle ricette, dal più ricco. Solo la fonte di grassi:
proporre carne o cereali cambierebbe troppo la ricetta.

Grammi proposti: i minimi che portano il nutriente al minimo ogni 1.000 kcal contando anche le calorie dell'olio,
g = (m·K/1.000 − T) ÷ (n − m·k/1.000), arrotondati per eccesso al grammo. Un olio troppo povero rispetto alle
calorie che porta (es. cocco per il linoleico) non si propone. Anteprima: nutriente prima/dopo, altri nutrienti che
cambiano colore, calcio/fosforo e calorie prima/dopo. Si aggiunge solo toccando "Aggiungi". *Da confermare con la nutrizionista.*

## 26/10/2026 — 18 voci CDB / Igea dal foglio della nutrizionista

Foglio `data/catalog/fonti/Catalogo_Nutrizione_Pet_115_ALIMENTI_CDB_IGEA_2026-10-26.xlsx`: 9 prodotti di Centro
Distribuzione BARF, ciascuno con una voce CDB e una Igea (stessi valori, prezzi separati). Le 97 voci di prima sono
identiche (catalogo precedente in `archivio/CATALOGO_CANI_REVISIONATO_2026-10-26_97_voci.json`); tutte e 18 sono
"dato indicativo" (micronutrienti da USDA per la parte molle; calcio e fosforo dei macinati con osso stimati dalle ceneri).

**Calorie (decisione dell'utente):** le kcal dichiarate dal venditore non tornano con proteine e grassi (da −47% a +31%),
quindi si calcolano come nel resto del catalogo, 4 kcal/g proteine + 9 kcal/g grassi; il valore del venditore resta
scritto nel metodo delle kcal. Esempio: macinato di pollo con osso 4 × 15,2 + 9 × 19,4 = 235,4 kcal (venditore 125).
Script: `--kcal-da-proteine-grassi`.

## 27/10/2026 — tre ricotte dal foglio della nutrizionista

Foglio `data/catalog/fonti/Catalogo_Nutrizione_Pet_118_RICOTTA_CAPRA_FRESCA_CORRETTA_2026-10-27.xlsx`: ricotta vaccina
(CREA 166820 + USDA 170851, indicativa), di pecora (CREA 166810) e fresca di capra (scheda Pinna Formaggi, solo
macronutrienti, indicativa). Le 115 voci di prima sono identiche (catalogo precedente in `archivio/`).

- Il Tipo "Proteine" del foglio non è tra i valori ammessi: importate come nuovo Tipo **Latticini** (animale), che nella
  ricetta sta nella fonte proteica, come chiesto ("Categoria Proteine invariata"). Prodotto di origine animale: il
  beta-carotene non dichiarato non rende parziale la vitamina A (regola del 24/10).
- Kcal come il resto del catalogo (4/9/4): 147,3 / 158,3 / 155 (fonti 146 / 157 / 155).
- Vitamina E della vaccina "Naturale (alfa-tocoferolo…)": d-alfa-tocoferolo come per gli altri alimenti.
- Nel foglio le 18 voci CDB/Igea hanno ancora le kcal del venditore: lo script le riconosce (sono scritte nel metodo
  delle kcal) e non le considera una modifica; restano le kcal 4/9 decise il 26/10.

## 27/10/2026 — esporta la ricetta in PDF (richiesta dell'utente)

Nella ricetta (passo 4) il pulsante "Esporta PDF (per la nutrizionista)" crea una scheda A4 e apre la condivisione di iOS.
Contenuto: riepilogo; cane (profilo, BCS, MCS, attività) e calcolo delle calorie (peso usato, peso metabolico, RER,
moltiplicatore, MER, fattore, tabella proposta e usata); calorie e tabella della ricetta; ingredienti e integratori con
quantità, kcal, quota di calorie, prezzo al kg e prezzo, totale; tutti i nutrienti del dizionario per gruppo (al giorno,
minimo al giorno, ogni 1.000 kcal, minimo e massimo con il tipo, colore, note: parziale con gli ingredienti senza dato,
da verificare, avviso del massimo di legge, di quanto si è fuori); rapporti (Ca/P, omega, ripartizione delle calorie,
sostanza secca); impostazioni usate e fabbisogni modificati; avviso "Strumento di supporto…". Se la ricetta ha
modifiche non salvate la scheda lo dice.

Richiede `expo-print` (modulo nativo): la versione 0.5.0 è una **build nuova per TestFlight**, non un aggiornamento via internet.

## 27/10/2026 — suggerimenti anche dagli alimenti del catalogo (richiesta dell'utente)

Sostituisce la regola del 26/10 ("solo fonte di grassi, solo acidi grassi"). Per ogni nutriente FEDIAF in carenza
(rosso o arancione) il dettaglio mostra, dopo gli integratori, **"Alimenti che lo contengono"**: i 5 alimenti del
catalogo (tutte le sezioni, solo quelli usabili nelle ricette e non già presenti) più ricchi per 100 g. Voci con valori
identici (es. lo stesso prodotto CDB e Igea) contano una volta ("Stessi valori anche: …").

Grammi: i minimi che portano il nutriente al minimo ogni 1.000 kcal contando le calorie aggiunte (stessa formula del
26/10). Se l'alimento da solo non può arrivarci (porta troppe calorie rispetto al nutriente) o servirebbero più di 500 g,
l'anteprima mostra l'effetto di 100 g con l'avviso "Da solo non basta". Anteprima e "Aggiungi" come per gli integratori.

## 28/10/2026 — 34 voci CDB / Igea (17 prodotti)

Foglio `data/catalog/fonti/Catalogo_Nutrizione_Pet_152_ALIMENTI_CDB_IGEA_2026-10-28.xlsx`. Importate **solo le 34 voci
nuove**: le 118 voci già presenti restano identiche (lo script riconosce le kcal di CDB e ricotte già ricalcolate e non le
considera modifiche); catalogo precedente in `archivio/`. Tutte "dato indicativo", kcal 4/9 già nel foglio (valori del
venditore nelle note), interpretazioni dei refusi e proxy USDA descritti nel foglio "Nuove voci 28-10".

Da far guardare alla nutrizionista: la **milza di bovino** è nel foglio come "Carne (muscolo)", quindi sta nella fonte
proteica e non conta nel controllo "altre frattaglie oltre il 5%" (la milza già presente è tra le frattaglie). Ali e colli di
pollo e colli di tacchino contengono osso ma hanno calcio e fosforo vuoti (grigi), come scelto nel foglio.

I test dei suggerimenti usano il catalogo fisso del 27/10, così i calcoli a mano non cambiano quando si aggiungono alimenti.

## 28/10/2026 — revisione delle voci CDB / Igea (foglio "TRIPPA_FONTE_PROTEICA")

Foglio `data/catalog/fonti/Catalogo_Nutrizione_Pet_152_TRIPPA_FONTE_PROTEICA_2026-10-28.xlsx`, mostrato all'utente
come elenco "prima → dopo" e applicato con `--applica-modifiche` (lo script ora confronta anche tipo, testi e fonti
delle voci esistenti; un nutriente con lo stesso valore tiene fonte e note di prima). 101 voci identiche, 51 modificate,
kcal tutte invariate; catalogo della 0.5.2 in `archivio/CATALOGO_CANI_REVISIONATO_2026-10-28_v0.5.2.json`.

- Milza CDB/Igea → tipo Milza (frattaglie).
- Trippa di bovino (anche la voce USDA già presente), trippa di agnello e durelli → fonte proteica (nome del file e celle
  del foglio; il foglio "Decisioni 28-10 finali" diceva invece trippa tra le frattaglie: segnalato all'utente).
- Ali e colli di pollo, colli di tacchino: calcio e fosforo da BARFLAB (stime molto incerte, scritte nelle note).
- Polpa di tacchino: micronutrienti da carne cruda (USDA 171088) invece che cotta.
- Altri dati USDA aggiunti (metionina + cistina, fenilalanina + tirosina, beta-carotene, calcio e fosforo di merluzzo).

Le ricette con questi alimenti diventano "da rivedere" solo se cambiano i valori (non il solo cambio di sezione).
I test delle importazioni precedenti usano i cataloghi archiviati di quel momento.

## 30/10/2026 — dati aggiunti dal foglio "VERIFICA_APPROFONDITA" (importato il 02/11/2026)

Foglio `data/catalog/fonti/Catalogo_Nutrizione_Pet_152_VERIFICA_APPROFONDITA_2026-10-30.xlsx`: solo celle vuote riempite,
come dichiarato nel foglio "Metodo e limiti II" e verificato confrontando tutte le voci: 254 valori aggiunti in 48 voci
(aminoacidi di cuore, rene, trippe e durelli; somme metionina + cistina, fenilalanina + tirosina e EPA + DHA, controllate
uguali alla somma delle parti; acido linoleico e ALA del cuore di pollo), nessun valore già presente cambiato, nessun
cambio di sezione, kcal invariate. 104 voci identiche. Catalogo della 0.5.3 in `archivio/CATALOGO_CANI_REVISIONATO_2026-10-28.json`.
Alcuni valori (trippa, cuore di pollo) vengono da una copia secondaria dell'archivio USDA (cooks.com), come scritto nelle note.

## 12/11/2026 — 8 tagli di pollo (importati il 13/11/2026)

Foglio `data/catalog/fonti/Catalogo_Nutrizione_Pet_160_ALIMENTI_POLLO_2026-11-12.xlsx`: petto, sovracoscia, fuso e coscia
intera disossati, con e senza pelle, crudi e cotti al forno, da USDA SR Legacy (affidabilità normale, kcal 4/9/4 già nel
foglio e ricontrollate). Le 152 voci di prima sono identiche; catalogo della 0.5.4 in `archivio/`.
Nuovo stato "Cotto al forno" (`cooked_roasted`, nell'app "peso a cotto (al forno)"): i valori sono per 100 g di carne
cotta, quindi si pesa dopo la cottura.

## 19/11/2026 — colore viola "da verificare" (richiesta dell'utente)

- **Grigio** = solo informativo: FEDIAF non dà un riferimento.
- **Viola** = da verificare: c'è un riferimento ma nessun ingrediente porta il dato ("dato mancante, da verificare"),
  oppure il dato è parziale e il valore noto è già sotto il minimo (non si sa se manca davvero).
- Riepilogo: "X verdi, Y arancioni, Z rossi, N da verificare, M informativi" (passo 4, PDF, diario). Le copie del
  diario salvate prima non hanno il viola: il loro riepilogo si legge come allora ("… grigi").
- Calcoli invariati. Suggerimenti e avvisi nel tempo trattano il viola in carenza come prima il rosso/arancione;
  il dato mancante (viola senza valore) non fa scattare avvisi, come prima il grigio.

## 19/11/2026 — omega-3 totali (richiesta dell'utente)

Per ogni ingrediente: il più alto tra il totale dichiarato nel catalogo e la somma degli omega-3 noti, ALA + EPA + DHA
(EPA + DHA dichiarato insieme o come somma di EPA e DHA separati, contato una volta sola: si prende il più alto dei due).
Poi la somma della ricetta. Sempre "almeno" (altri omega-3 non sono nel catalogo). Calcolato all'apertura del catalogo,
i file e le impronte non cambiano; il rapporto omega-6/omega-3 resta acido linoleico ÷ (ALA + EPA + DHA).

## 19/11/2026 — segno "max?" (decisione dell'utente con la nutrizionista)

Compare solo per i nutrienti con un massimo e un dato parziale, verdi, quando il valore già noto arriva almeno al 70%
del massimo (soglia modificabile in Impostazioni → Colori, salvata nelle impostazioni e nel backup; i backup vecchi
partono da 70). Piccolo segno "max?" accanto al valore; nel dettaglio e nel PDF: "con i dati noti sei al X% del
massimo, il resto non è verificabile". Il colore resta verde; nessun calcolo cambia. Le copie del diario non lo mostrano.

## 19/11/2026 — Spesa (richiesta dell'utente)

Scheda "Spesa", separata dal diario: per ogni cane si scelgono ricette e giorni (es. A 20, B 5, C 5 su 30); l'app somma
i grammi per ingrediente di tutti i cani (ricetta × giorni), con il prezzo del catalogo (prezzo per il peso nella ciotola).
Margine facoltativo in % sulle quantità delle ricette; grammi arrotondati per eccesso al grammo, capsule al numero intero.
Verdure pesate cotte: peso da comprare crudo stimato con una resa di cottura di 0,9 (peso cotto ÷ peso crudo, STIMA);
cereali, legumi e carni pesati cotti non vengono convertiti (lo dice la lista). Righe libere con quantità e prezzo
facoltativi. Dati salvati in `shopping` (backup compresi; i backup vecchi si ripristinano con la spesa vuota).

## 20/11/2026 — Dispensa (richiesta dell'utente)

Quantità in casa per ingrediente, nello stesso peso delle ricette (verdure cotte: peso cotto, confermato dall'utente);
capsule per gli integratori a capsule. Acquisto "N confezioni da X" (l'app fa il totale e ricorda la confezione),
"Finito" toglie una confezione (mai sotto zero), correzione a mano, "Togli". Nessuno scalo automatico dal diario.
In ogni ricetta: "in dispensa X, basta per N giorni" (giorni interi) o "in dispensa: niente". Lista della spesa =
previsione con il margine − dispensa (mai sotto zero) + righe libere; prezzo sul "da comprare". Dati in `pantry`
(backup compresi; i backup vecchi si ripristinano con la dispensa vuota).

## 20/11/2026 — duplicare una ricetta per un altro cane (richiesta dell'utente)

Per un altro cane la copia prende calorie obiettivo e tabella FEDIAF del nuovo cane (quelle del suo profilo: calcolate,
o scritte a mano lì), come una ricetta nuova senza calorie scritte a mano. Ingredienti e quantità identici, nessuna
scalatura (integratori compresi); la copia resta "da rivedere". Per lo stesso cane nulla cambia.

## 21/11/2026 — 3 prodotti CDB / Igea (6 voci)

Foglio `data/catalog/fonti/Catalogo_Nutrizione_Pet_166_ALIMENTI_CDB_IGEA_2026-11-21.xlsx`: Armonia manzo e coniglio,
Armonia manzo e agnello, polpa di tacchino macinata (CDB e Igea, dato indicativo, fonte proteica, kcal 4/9 già nel foglio).
Le 160 voci di prima sono identiche; catalogo della 0.7.2 in `archivio/`.
**Armonia manzo e coniglio**: proteine 52,9% e acqua 33,2% (325,9 kcal/100 g) sono improbabili per un macinato crudo
(il gemello con l'agnello ha 17,8% e 64,3%); segnalato, importato così su richiesta dell'utente in attesa di conferma.

## 21/11/2026 — Armonia: dati aggiunti (foglio "ARMONIA_INTEGRATI")

Foglio `data/catalog/fonti/Catalogo_Nutrizione_Pet_166_ARMONIA_INTEGRATI_2026-11-21.xlsx`: 42 valori aggiunti alle 4 voci
Armonia (cistina e metionina + cistina, acido linoleico, ALA, EPA/DHA del coniglio, beta-carotene, vitamine D, E, K,
colina), solo dove mancavano; nessun valore presente cambiato, kcal invariate, le altre 162 voci identiche. Armonia manzo
e coniglio resta usabile nelle ricette su richiesta dell'utente, con i valori dell'etichetta (proteine 52,9%, acqua 33,2%)
in attesa di conferma. Catalogo della 0.7.3 in `archivio/CATALOGO_CANI_REVISIONATO_2026-11-21_v0.7.3.json`.

## 21/11/2026 — Dispensa a righe (0.7.5)

La dispensa passa da un totale per ingrediente a righe ("lotti"): **confezioni** (N confezioni intere di un formato; un
acquisto dello stesso prodotto e formato si somma alla riga, un formato diverso fa una riga nuova; +1/−1; modifica di
numero e formato, che unisce le righe se il formato diventa uguale), **resto** (la parte non intera dopo una correzione
dei grammi di una riga a confezioni: mai sommato alle confezioni intere, ogni correzione fa il suo resto) e **partita
sfusa** (grammi in tutto, sempre una riga a parte con la data, «Aggiorna quanto resta», «Finito»). A zero la riga sparisce.
Il totale per ingrediente è la somma delle righe: Spesa e ricette lo usano come prima. Dati e backup di prima si convertono
in lettura (confezioni intere + resto, stesso totale); il riepilogo `items` resta scritto per le versioni precedenti.
Schema dei dati invariato (2).

## 21/11/2026 — Dispensa: acquisto e consumo separati (0.8.0)

**Acquisto**: una bozza (`pantry.draft`, salvata sul telefono) con la data (di partenza oggi, non nel futuro). Dentro si
aggiungono confezioni e partite sfuse con le stesse regole di unione; +1, −1, modifica e togli correggono la bozza e non
vanno nello storico. «Ho finito di registrare gli acquisti» porta le righe in dispensa, salva l'acquisto confermato
(`pantry.sessions`) e scrive la voce «acquisto». Un acquisto confermato si riapre con «Modifica»: al salvataggio la
dispensa riceve solo la differenza (confezioni per prodotto e formato; partite per riga, tenendo conto di quanto già
consumato) e lo storico scrive «modifica» con la data del giorno, prima/dopo per i prodotti cambiati. Una sola bozza alla volta.
**Consumo**: sulle righe solo «Confezione finita» (una confezione in meno; per partite e resti «Finita» toglie la riga)
e «Consumata in parte» (si scrive quanto resta o quanto si è consumato, l'altro si calcola; per le confezioni restano
quelle intere e la parte aperta diventa un «Resto»). Tolti +1/−1, «Modifica», «Correggi grammi» e «Togli» dalle righe.
**Storico** (`pantry.history`): acquisto, modifica, finita, consumo parziale; si tengono 3 mesi (dal giorno di oggi meno
3 mesi), anche gli acquisti confermati: le voci più vecchie si cancellano alla prima operazione successiva e non si
mostrano. Parte vuoto. Righe e registro di prima invariati; backup vecchi si ripristinano (campi nuovi vuoti).

## 22/11/2026 — Pasti (0.9.0)

La ricetta resta la razione del giorno; la sezione «Pasti» (passo 4 e PDF) la divide in 1, 2 o 3 pasti solo per pesarla.
Numero di pasti, percentuali e pasto di ogni capsula si ricordano **per cane** (`meals`, nuovo campo dei dati e dei backup;
manca nei dati di prima = 1 pasto; eliminando un cane si tolgono i suoi pasti). Percentuali di partenza uguali; si salvano
solo se la somma fa 100% (con 2 pasti l'altro si completa da solo); cambiando il numero di pasti tornano uguali.
Arrotondamento: alimenti ai 5 g, integratori in grammi a 1 g (scelta mia: 5 g su dosi di pochi grammi non avrebbe senso);
ogni pasto è arrotondato tranne quello con la percentuale più alta (il primo a parità), che prende il resto: la somma dei
pasti è sempre il totale. Integratori a capsule: ogni capsula intera in un pasto, di partenza alternate (1ª al primo pasto,
2ª al secondo...); una dose non intera resta tutta in un pasto. Il diario non cambia (una ricetta per giornata).

## 26/11/2026 — Dispensa al primo livello e ricerca (0.9.1)

Solo schermate e navigazione: dati, calcoli, colori, diario, cataloghi e Spesa invariati; nessun cambio di struttura dei dati.
**Navigazione**: la scheda in basso «Spesa» diventa «Dispensa» (stessa posizione, sempre 6 schede) e si apre sulle righe.
In cima, «Spesa e previsioni» apre la pagina di prima (`/spesa`, fuori dalle schede); da lì «Torna alla dispensa» (o la
freccia in alto) torna indietro in un tocco, e se la Spesa è aperta da sola apre la scheda Dispensa. Nella Dispensa la
lista «In dispensa» viene prima di «Registra acquisti»; il resto della pagina è com'era.
**Ricerca**: campo «Cerca» in cima alla lista, filtra mentre si scrive; ogni parola deve comparire nel nome (maiuscole e
accenti non contano). Un prodotto trovato mostra tutte le sue righe, resti e partite comprese; si possono cercare anche
«resto» e «sfusa». Il totale del prodotto resta quello di tutte le righe. Nessun risultato → «Nessun prodotto trovato».
**Ordine**: prima i prodotti toccati più di recente (la data di modifica già salvata sulle righe). L'ordine si fissa quando
si apre la scheda, così una riga non salta in cima mentre la si tocca (rischio di toccare il prodotto sbagliato); si
aggiorna alla riapertura. I prodotti nuovi compaiono in cima.

## 27/11/2026 — Pubblicazione: aggiornamento via internet separato da build e TestFlight

La 0.9.1 non è arrivata: il flusso cercava una build con la stessa impronta, il file della 0.5.0 (4) era scaduto sui
server di Expo (circa 30 giorni nel piano gratuito), quindi ha fatto la build 0.5.0 (5) e ha saltato l'aggiornamento;
poi l'invio a TestFlight è fallito («Unable to find Apple ID for Bundle ID»). Ora `pubblica.yml` fa solo l'aggiornamento
(sempre), build e TestFlight solo con `rinnovo-testflight.json`; entrambi solo dal ramo principale. L'impronta della
build installata è in `release/impronta-ios.json` e un test la controlla prima di ogni pubblicazione.
