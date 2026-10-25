// Testi delle spiegazioni (tasto "i"), in italiano semplice.

export interface InfoTopic {
  title: string;
  intro: string;
  items?: { label: string; text: string }[];
  outro?: string;
}

export const INFO: Record<string, InfoTopic> = {
  bcs: {
    title: 'BCS: condizione corporea (da 1 a 9)',
    intro:
      'Il BCS dice se il cane è magro, giusto o in sovrappeso. Si valuta guardando il cane dall’alto e di lato, ' +
      'e toccando le costole con le dita piatte, senza premere.',
    items: [
      { label: '1 – 3: troppo magro', text: 'Costole, vertebre e ossa del bacino si vedono facilmente; poco o nessun grasso. Al 3 le costole si sentono subito e possono vedersi.' },
      { label: '4 – 5: ideale', text: 'Le costole si sentono senza fatica, con un sottile strato di grasso. Dall’alto si vede la “vita” dietro le costole; di lato la pancia risale.' },
      { label: '6: leggermente sovrappeso', text: 'Le costole si sentono, ma con un po’ di grasso in più. La vita si vede poco.' },
      { label: '7: sovrappeso', text: 'Le costole si sentono con difficoltà. Grasso sulla schiena e alla base della coda. Vita appena visibile o assente.' },
      { label: '8 – 9: obeso', text: 'Le costole non si sentono sotto lo spesso strato di grasso. Niente vita, pancia gonfia, grasso evidente su collo, schiena e coda.' },
    ],
    outro: 'Nell’app il BCS è un promemoria: non cambia da solo le calorie. Se il BCS non è ideale, parlane con la nutrizionista.',
  },
  mcs: {
    title: 'MCS: massa muscolare',
    intro:
      'L’MCS dice quanto muscolo ha il cane, indipendentemente dal grasso: anche un cane grasso può aver perso muscolo. ' +
      'Si valuta toccando con la mano la schiena lungo la colonna, le scapole, la testa e le ossa del bacino.',
    items: [
      { label: 'Normale', text: 'Muscoli pieni e sodi: le ossa della colonna non sporgono.' },
      { label: 'Perdita lieve', text: 'Le vertebre si sentono un po’ di più, i muscoli sono appena meno pieni.' },
      { label: 'Perdita moderata', text: 'Vertebre e scapole si sentono chiaramente; muscoli visibilmente ridotti.' },
      { label: 'Perdita grave', text: 'Ossa molto evidenti al tatto e alla vista; muscoli molto ridotti.' },
    ],
    outro: 'Una perdita di muscolo va segnalata alla veterinaria o alla nutrizionista.',
  },
  attivita: {
    title: 'Livello di attività',
    intro: 'Serve a proporre il moltiplicatore delle calorie. Puoi sempre correggerlo a mano.',
    items: [
      { label: 'Bassa', text: 'Meno di 1 ora al giorno di passeggiata tranquilla. Proposto: 1,4 se sterilizzato, 1,6 se non sterilizzato.' },
      { label: 'Normale', text: 'Da 1 a 3 ore al giorno di attività leggera (passeggiate, gioco). Proposto: 1,6 se sterilizzato, 1,8 se non sterilizzato.' },
      { label: 'Alta', text: 'Più di 3 ore al giorno, oppure attività intensa (corsa, sport cinofili, lavoro). Proposto: 2,0.' },
    ],
    outro: 'Questi moltiplicatori sono da confrontare con quelli della nutrizionista.',
  },
  calorie: {
    title: 'Come si calcolano le calorie',
    intro: 'L’app propone le calorie al giorno; tu puoi sempre correggerle.',
    items: [
      { label: '1. Peso metabolico', text: 'Il peso elevato alla 0,75 (kg^0,75). Per 30 kg è 12,82.' },
      { label: '2. RER, fabbisogno a riposo', text: '70 × peso metabolico. Per 30 kg: 70 × 12,82 = 897 kcal.' },
      { label: '3. Moltiplicatore', text: 'RER × moltiplicatore (proposto da attività e sterilizzazione). Per esempio 897 × 1,6 = 1.436 kcal.' },
      { label: 'Oppure: kcal scritte a mano', text: 'Se scrivi le kcal al giorno (per esempio quelle della nutrizionista), l’app usa quelle.' },
    ],
    outro: 'Quando cambi peso o calorie, l’app non modifica nessun grammo delle ricette: le segnerà “da rivedere”.',
  },
  tabella: {
    title: 'Tabella FEDIAF: 95 o 110',
    intro:
      'FEDIAF (le linee guida europee sull’alimentazione di cani e gatti) dà due colonne per il cane adulto. ' +
      'Servono a dire quanti nutrienti servono ogni 1.000 kcal.',
    items: [
      { label: 'Il fattore', text: 'kcal al giorno divise per il peso metabolico. Si arrotonda all’intero, come lo vedi sullo schermo.' },
      { label: 'Fattore 110 o più → tabella 110', text: 'Per il cane medio, con 1-3 ore di attività leggera al giorno.' },
      { label: 'Fattore sotto 110 → tabella 95', text: 'Per il cane che mangia meno: servono gli stessi minerali e vitamine in meno cibo, quindi i minimi per 1.000 kcal sono circa il 16% più alti (grassi esclusi). È la più severa.' },
      { label: 'Fattore sotto 95', text: 'FEDIAF non ha una colonna: si usa la 95 e compare un avviso, perché i nutrienti totali potrebbero risultare insufficienti.' },
    ],
    outro: 'La tabella in uso è sempre scritta sullo schermo e puoi cambiarla a mano nel profilo del cane.',
  },
  legenda: {
    title: 'Colori e segni',
    intro: 'Le barre colorate arrivano con le ricette (Fase 2). Ecco cosa vorranno dire:',
    items: [
      { label: 'Verde', text: 'Tra il minimo e il massimo.' },
      { label: 'Arancione', text: 'Fuori dal limite, ma di poco: fino al 10%.' },
      { label: 'Rosso', text: 'Fuori dal limite di oltre il 10%.' },
      { label: 'Grigio', text: 'Nessun riferimento FEDIAF, oppure dato mancante. Un dato mancante non è mai zero e non è mai verde.' },
      { label: 'A righe, “almeno X”', text: 'Valore parziale: il nutriente manca in alcuni ingredienti. Un rosso per eccesso resta valido; un verde o una carenza possono cambiare.' },
      { label: 'Massimo N', text: 'Massimo nutrizionale FEDIAF.' },
      { label: 'Massimo L', text: 'Massimo di legge FEDIAF, per i nutrienti aggiunti come additivi; si controlla sulla sostanza secca della ricetta.' },
      { label: '“Dato indicativo”', text: 'Alimento del catalogo da rivedere (spesso verdure al vapore con dati di bollitura).' },
      { label: '“Dato provvisorio”', text: 'Integratore con dati non ancora confermati dall’etichetta.' },
      { label: '“Da verificare”', text: 'Un singolo valore incerto (per esempio il potassio del QDiet).' },
    ],
  },
  backup: {
    title: 'Backup: perché e come',
    intro:
      'I tuoi dati (cani, prezzi, impostazioni, e poi ricette e diario) stanno solo sul telefono. ' +
      'Se elimini l’app o reinstalli una nuova versione di prova, potresti perderli.',
    items: [
      { label: 'Esporta tutto', text: 'Crea un file e apre la condivisione: scegli “Salva su File” e una cartella, per esempio su iCloud Drive.' },
      { label: 'Ripristina', text: 'Scegli quel file: i dati attuali vengono sostituiti da quelli del backup, dopo una conferma.' },
      { label: 'Il catalogo non c’entra', text: 'Il backup non contiene il catalogo degli alimenti: ripristinarlo non lo cambia mai.' },
    ],
    outro: 'L’app ti ricorda di fare un backup dopo 14 giorni. Le versioni TestFlight scadono dopo 90 giorni: fai un backup prima di installare quella nuova.',
  },
};
