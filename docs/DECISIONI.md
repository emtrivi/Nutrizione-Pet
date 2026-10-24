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
