# Casi plausibili per EON — Lotto 2 (casi 51-100)

Portato da Gianardi il 03/09/2026, stessa fonte/metodo del Lotto 1
(`libro/casi-lotto1-copilot.md`): **costruiti, non osservati**, da
validare con un edile vero. Le voci genuinamente nuove sono state
integrate in `libro/edile.md` (vedi commit); conservato qui per intero
come fonte.

---

## Sezione A — Frasi ambigue per un sistema (continua, 15 casi: A16-A30)

**A16 | WhatsApp**
"Quello di prima va bene, fai pure"
→ "Quello di prima" fa riferimento a un'opzione discussa in un messaggio precedente, forse anche vocale, non necessariamente testuale e recuperabile.

**A17 | Email**
"In allegato trovi tutto" (nessun allegato presente)
→ Errore umano comune (dimenticare l'allegato). Un sistema che si fida del testo rischia di "confermare" la ricezione di un documento mai arrivato.

**A18 | WhatsApp**
"Passa quando puoi, non c'è fretta" seguito 20 minuti dopo da "allora, sei venuto?"
→ Contraddizione temporale tipica: l'urgenza dichiarata a parole non corrisponde al comportamento reale.

**A19 | Vocale**
"Il cliente ha detto che va bene, anzi ha detto che deve pensarci"
→ Autocorrezione che ribalta completamente il significato (accettazione → sospensione). Un sistema che si ferma alla prima frase sbaglia in modo grave.

**A20 | WhatsApp**
"Fai come l'altra volta"
→ Riferimento a un precedente non specificato — quale "altra volta"? Con quale cliente, quale materiale, quale importo?

**A21 | Email formale**
"Restiamo in attesa di un Vs. riscontro"
→ Linguaggio burocratico-formale che può nascondere una scadenza implicita non dichiarata esplicitamente (es. "se non rispondete entro X, annulliamo").

**A22 | WhatsApp**
"Mandami il numero di quello bravo che conosci"
→ "Quello bravo" è un giudizio soggettivo del passato, non un'entità nominata — richiede storico di conversazioni precedenti per essere risolto.

**A23 | Vocale**
"Segnati: due, no tre... facciamo tre e mezzo per stare larghi"
→ Simile ad A08 ma con unità di misura frazionaria — rischio di arrotondamento errato se il sistema tronca a "tre".

**A24 | WhatsApp**
"Ci vediamo domani come sempre" inviato di venerdì sera
→ "Domani" per il mittente potrebbe intendere lunedì (giorno lavorativo successivo), non sabato.

**A25 | Email**
"Grazie, a presto" in risposta a un preventivo con richiesta di conferma esplicita
→ Formula di cortesia che non conferma né rifiuta — rischio di essere interpretata come accettazione quando è solo educazione.

**A26 | WhatsApp con vocale allegato**
Testo: "ascolta qua" + vocale che contiene l'informazione vera
→ Il contenuto informativo è tutto nell'audio, il testo è solo un rimando — se EON processa solo testo, perde tutto.

**A27 | WhatsApp**
"Stessa cosa dell'altro cantiere, cambia solo il colore"
→ Riferimento relativo ("stessa cosa") che richiede di risolvere sia "l'altro cantiere" che tutte le specifiche associate.

**A28 | Vocale**
"Chiamami che è meglio, così ci mettiamo d'accordo"
→ Messaggio che rimanda esplicitamente l'informazione a un canale diverso (telefonata) — nessuna azione è deducibile dal testo/audio stesso.

**A29 | WhatsApp**
"Fatto, tutto ok" (in risposta a una lista di 4 richieste)
→ Conferma aggregata senza specificare se tutti e 4 i punti sono stati completati o solo l'ultimo/il più recente.

**A30 | Email**
"Come da preventivo n. 45" (ma in anagrafica esistono preventivo "45" e "45 bis")
→ Riferimento numerico che sembra preciso ma è ambiguo in presenza di varianti/revisioni con stesso numero base.

---

## Sezione B — Ambiguità da omonimia o riferimenti sovrapposti (continua, 10 casi: B11-B20)

**B11**
Un materiale ordinato con lo stesso nome commerciale ma da due marche diverse (es. "il silicone" — quale marca, quale tipo tra neutro e acetico) — ambiguità che nel parlato tecnico viene spesso omessa perché "si capisce dal contesto" (ma il contesto non è scritto).

**B12**
Due preventivi per lo stesso cliente ma per due immobili diversi (es. casa e garage) — "il preventivo di Bianchi" è ambiguo su quale dei due.

**B13**
Un cantiere che cambia nome informale nel tempo (prima "il cantiere nuovo", poi dopo l'apertura di un altro cantiere diventa "quello vecchio") — la stessa etichetta informale si riferisce a entità diverse in periodi diversi.

**B14**
Due membri dello stesso team con lo stesso soprannome (es. due "Peppe") — distinti solo dal cognome o dal ruolo, spesso omesso nei messaggi rapidi.

**B15**
Un cliente che gestisce due proprietà come persona fisica e come rappresentante di una ditta — le comunicazioni si mescolano tra le due identità senza distinzione esplicita nei messaggi.

**B16**
Due indirizzi con lo stesso numero civico ma su strade dal nome simile (es. "Via Roma" e "Viale Roma" nella stessa città) — errore di battitura o abbreviazione comune nei messaggi rapidi.

**B17**
Un termine di pagamento ("acconto") riferito in momenti diversi a importi diversi per lo stesso cantiere (primo acconto, secondo acconto) senza che il messaggio specifichi quale.

**B18**
Due fornitori con ragione sociale simile (es. "Ferramenta Bianchi" e "Bianchi Forniture Edili") — confusione plausibile in una rubrica non curata.

**B19**
Un subappaltatore che lavora contemporaneamente su due cantieri dello stesso committente — "il tizio dell'idraulica" è ambiguo su quale dei due cantieri si riferisce il messaggio.

**B20**
Un preventivo verbale rivisto più volte via telefono, mai riscritto — quando si fa riferimento "al preventivo", si intende la versione originale scritta o l'ultima versione concordata a voce (diversa)?

---

## Sezione C — Errori temuti / rischi concreti (continua, 10 casi: C11-C20)

**C11**
Messaggio vocale trascritto automaticamente in modo errato (es. "non" perso nella trascrizione, capovolgendo il senso di una frase tipo "non possiamo iniziare lunedì") — rischio: azione opposta a quella richiesta.

**C12**
Un cliente scrive di sera tardi in un momento di frustrazione ("fate schifo, non vi chiamo più") e il giorno dopo si scusa — se il primo messaggio genera un'azione automatica (es. chiusura pratica), il sistema amplifica un momento emotivo isolato.

**C13**
Foto di un problema di sicurezza sul cantiere (es. mancanza di protezioni) condivisa nel gruppo sbagliato, visibile anche a un cliente non coinvolto — rischio reputazionale e potenzialmente legale.

**C14**
Una data di consegna materiale comunicata dal fornitore come "indicativa" viene trattata da EON come impegno fisso e comunicata al cliente come tale — rischio: aspettativa del cliente disallineata, imputata poi all'impresa.

**C15**
Un messaggio di reclamo del cliente non gestito tempestivamente perché arrivato fuori dai canali monitorati abitualmente (es. email invece di WhatsApp) — rischio: percezione di disinteresse.

**C16**
Errore di trascrizione di una misura (es. "2 metri e 20" trascritto come "2,20" invece di "220 cm" con conseguente confusione di unità) — rischio: errore di ordine materiali con costo reale.

**C17**
Comunicazione di un prezzo scontato "solo per questa volta" trattata da EON come prezzo standard per interazioni future con lo stesso cliente — rischio: perdita economica ricorrente non voluta.

**C18**
Un collaboratore condivide per errore, in un momento di distrazione da mobile, una foto personale (non di lavoro) nel canale professionale con il cliente — rischio: imbarazzo, percezione di scarsa professionalità.

**C19**
Una richiesta di modifica del cliente fatta a voce durante un sopralluogo, mai registrata da nessuna parte, poi negata dal cliente stesso ("io questo non l'ho mai chiesto") — rischio: parola contro parola, nessuna prova.

**C20**
Un preventivo "orientativo" inviato per dare un'idea di massima al cliente, poi usato dal cliente come riferimento vincolante in una contestazione — rischio: incomprensione sul valore legale/informale del documento.

---

## Sezione D — Terminologia e abbreviazioni di settore (continua, 8 casi: D09-D16)

**D09** — "Massetto": termine tecnico specifico spesso confuso da chi non è del settore con "pavimento", ma nel gergo edile indica lo strato sottostante.

**D10** — "Rasatura" vs "stuccatura": termini simili ma non intercambiabili nel gergo dei pittori edili, con confusione frequente nei messaggi rapidi tra chi commissiona e chi esegue.

**D11** — Sigle di certificazioni energetiche ("APE") menzionate senza contesto, spesso confuse con altre sigle catastali/urbanistiche.

**D12** — Termini dialettali/regionali per attrezzi comuni (es. nomi diversi per la stessa cazzuola o lo stesso attrezzo a seconda della zona d'Italia) — rilevante se EON deve generalizzare a un pubblico nazionale.

**D13** — "Fine lavori" usato in modo diverso da chi lo intende come "fine della fase attuale" e chi lo intende come "conclusione totale del cantiere" — ambiguità di scope, non solo di parola.

**D14** — Abbreviazioni di unità di misura scritte in modo non standard nei messaggi veloci (es. "mq" vs "m2" vs "metri quadri" per esteso, usati in modo intercambiabile dalla stessa persona in momenti diversi).

**D15** — "Preventivo" e "offerta" usati come sinonimi da alcuni, ma con differenza di valore legale/vincolante per altri (specie chi ha esperienza con capitolati pubblici).

**D16** — Termini economici informali tipici del settore ("in nero", "fuori fattura") che potrebbero apparire in messaggi informali — questione delicata: EON deve gestire l'esistenza del fenomeno linguistico senza normalizzarlo o incoraggiarlo operativamente.

---

## Sezione E — Assunzioni "da manuale" da verificare (continua, 8 casi: E08-E15)

**E08**
Ipotesi comune: le fatture vengono emesse a fine lavori. Pattern più plausibile: gli acconti vengono fatturati (o richiesti) a stati di avanzamento informali, spesso su richiesta verbale del titolare senza una cadenza fissa pianificata.

**E09**
Ipotesi comune: ogni comunicazione con il cliente passa da un solo canale scelto a priori. Pattern più plausibile: si usa il canale più comodo nel momento (chiamata se urgente, WhatsApp se rapido, email solo per documenti "ufficiali") — la scelta è situazionale, non da policy.

**E10**
Ipotesi comune: i cataloghi/listini fornitori sono aggiornati e consultati prima di ogni ordine. Pattern più plausibile: si ordina "a memoria" dal fornitore abituale, e il prezzo si scopre spesso solo alla consegna o in fattura.

**E11**
Ipotesi comune: i problemi di cantiere vengono documentati con foto sistematicamente. Pattern più plausibile: si fotografa soprattutto quando c'è un problema (per tutelarsi) o un risultato di cui vantarsi — la documentazione "di routine" è spesso assente o incompleta.

**E12**
Ipotesi comune: le richieste dei clienti arrivano attraverso un unico referente aziendale. Pattern più plausibile: in piccole imprese, chiunque risponda per primo al telefono/WhatsApp gestisce la richiesta, anche se non è la persona "titolare" di quel rapporto.

**E13**
Ipotesi comune: gli orari di apertura/chiusura cantiere sono fissi e comunicati. Pattern più plausibile: gli orari si adattano giorno per giorno a meteo, disponibilità di materiali e altri cantieri, comunicati (se comunicati) all'ultimo momento.

**E14**
Ipotesi comune: un preventivo rifiutato viene segnato come chiuso/perso. Pattern più plausibile: un preventivo "rifiutato" spesso resta in un limbo — il cliente potrebbe tornare mesi dopo dicendo "allora, ci sei ancora per quel lavoro?" senza che nessuno l'abbia formalmente riaperto.

**E15**
Ipotesi comune: i sub-appaltatori vengono coordinati con un calendario condiviso. Pattern più plausibile: il coordinamento avviene per telefonate dell'ultimo minuto ("sei libero domani?"), spesso il giorno prima o lo stesso giorno.

---

## Come usare questo file

Stesso protocollo del Lotto 1: fai leggere (o leggi a voce) i casi a un edile vero, segna sì/no/diverso. I "no" e i "diverso" sono le correzioni più utili.
