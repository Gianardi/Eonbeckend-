# Professional Brain Pack — EDILE

Prima bozza (Claude, conoscenza generale — vedi `TODO.md`, "Il libro
dei professionisti"), riscritta secondo la struttura definita in
`libro/professional-brain-pack-metodo.md`. Da correggere e completare
con l'esperienza reale di Gianardi prima di derivarne casi per la
Evaluation Suite (sezione L). **Non è codice**: non entra nel prompt
di EON così com'è — solo le correzioni vere, trovate testando, ci
entrano, in poche righe mirate (vedi il metodo).

## A. Identità professionale

Piccola impresa edile o artigiano (muratore, capomastro), spesso con
1-5 persone. Passa la maggior parte della giornata **fuori
dall'ufficio**, sui cantieri — non alla scrivania. Usa il telefono più
della tastiera: detta a voce, scrive messaggi brevi, spesso con
errori/abbreviazioni perché ha le mani sporche o poco tempo. I clienti
sono in gran parte privati (famiglie che ristrutturano casa), a volte
imprese o amministratori di condominio per lavori più grossi.

## B. Giornata e contesto

Mattina su un cantiere (o più di uno, con spostamenti), sopralluoghi da
nuovi clienti, telefonate per organizzare consegne di materiale,
momenti rubati per la burocrazia (preventivi, fatture, permessi) di
solito alla sera o in pausa pranzo. Interruzioni continue: un cliente
che chiama, un fornitore in ritardo, un imprevisto in cantiere. Rumore
di fondo frequente (trapano, betoniera) quando detta a voce.

## C. Mondo professionale

- **Clienti**: privati (la maggioranza), imprese, amministratori di
  condominio. Spesso più clienti con lo stesso cognome in paesi piccoli.
- **Cantieri/lavori**: il luogo fisico e il progetto in corso — un
  cliente può avere più cantieri nel tempo, raramente più di uno attivo
  insieme.
- **Luoghi**: il cantiere stesso, l'ufficio/casa (per la burocrazia), i
  fornitori (ferramenta, rivenditore materiali).
- **Persone**: il cliente, eventuali collaboratori/dipendenti, i
  fornitori (non sono clienti, non vanno mai confusi con loro).
- **Documenti**: preventivi, capitolati, planimetrie, permessi
  (SCIA/CILA), fatture.
- **Pagamenti**: acconti, SAL (pagamenti legati all'avanzamento), saldo
  finale.

## D. Oggetti del mestiere

Gli oggetti che BRAIN deve saper distinguere, anche quando l'utente li
nomina con la stessa parola generica ("il lavoro di Rossi"):

- **Cliente** — persona/famiglia/azienda
- **Cantiere/lavoro** — il progetto fisico in corso per un cliente
- **Sopralluogo** — visita di valutazione, di solito prima di un preventivo
- **Preventivo** — proposta economica, con un **capitolato** (dettaglio
  lavori/materiali) collegato
- **Esecuzione** — la fase attiva dei lavori, dopo l'accettazione del preventivo
- **SAL** (Stato Avanzamento Lavori) — evento di pagamento parziale
  legato a una percentuale di lavoro completato
- **Fattura** — documento fiscale, spesso collegato a un SAL o al saldo finale
- **Pagamento/incasso** — il denaro ricevuto, collegato a una fattura
- **Foto cantiere** — sempre collegata a un cantiere e, tramite quello,
  a un cliente — mai generica
- **Documento tecnico** — planimetria, permesso, certificazione
- **Appunto** — nota libera, senza data né scadenza
- **Impegno/appuntamento** — evento nel tempo (sopralluogo, consegna,
  chiamata, scadenza)
- **Fornitore** — collegato a materiali/consegne, MAI trattato come cliente

## E. Relazioni tra oggetti

- Un **Cliente** ha uno o più **Cantieri** nel tempo
- Un **Cantiere** nasce spesso da un **Sopralluogo**
- Un **Sopralluogo** può portare a un **Preventivo** (con **Capitolato**)
- Un **Preventivo** accettato diventa **Esecuzione** (il cantiere attivo)
- Un'**Esecuzione** può avere più **SAL** nel tempo
- Ogni **SAL** può generare una **Fattura**
- Una **Fattura** genera (si spera) un **Pagamento**
- **Foto** e **Documenti** sono sempre collegati a un **Cantiere**, e
  tramite quello a un **Cliente** — mai un cliente a caso
- Un **Fornitore** è collegato a materiali/consegne, MAI a un **Cliente**
- Un **Impegno** può essere collegato a un Cliente/Cantiere (sopralluogo,
  consegna) o essere generico (commissione senza cliente)

## F. Processi — ciclo di vita tipico di un lavoro

1. Primo contatto (telefonata/passaparola) → eventuale nuovo cliente
2. Sopralluogo → valutazione
3. Preventivo → invio al cliente
4. Attesa risposta — se il preventivo resta senza risposta per giorni,
   è un caso da segnalare (promemoria di follow-up), non da ignorare
5. Accettazione → inizio esecuzione (cantiere attivo)
6. Esecuzione in corso: attività quotidiane, foto di avanzamento, ordini
   materiale, gestione squadra
7. SAL intermedi → fatture parziali → incassi
8. Fine lavori → foto finali, eventuale documento di fine lavori,
   fattura saldo
9. Eventuale assistenza post-lavoro / garanzia

Capire IN QUALE fase è un lavoro aiuta a interpretare richieste
ambigue: "il lavoro di Rossi" durante l'esecuzione probabilmente indica
il cantiere attivo, non il preventivo ormai superato.

## G. Linguaggio

Terminologia tipica: **SAL**, **SCIA/CILA** (pratiche edilizie comunali
prima di alcuni lavori), **capitolato**, **massetto** (strato di base
sotto un pavimento), **cartongesso**, **sopralluogo**. Verbi per un
impegno non solo "vedere/incontrare": "passo da", "faccio un salto da",
"vado a dare un'occhiata da". Un termine tecnico mal riconosciuto dal
microfono (es. "massetto" sentito come "mai detto") non va corretto in
silenzio se cambia il senso della frase: meglio chiedere conferma.

## H. Intenzioni professionali

Cosa vuole ottenere il professionista, indipendentemente dalle parole
usate — mappato sulle operazioni che EON già riconosce
(`interpreta_richiesta`, non nuove categorie da inventare):

- **mostra**: vedere/recuperare qualcosa che esiste (foto, documenti,
  storico cliente, un preventivo già fatto)
- **crea**: registrare qualcosa di nuovo (impegno, appunto, cliente,
  preventivo)
- **modifica**: cambiare qualcosa che esiste (spostare un appuntamento,
  correggere un appunto, aggiornare un cliente)
- **cancella**: rimuovere (annullare un impegno, eliminare un cliente)
- **invia**: far arrivare qualcosa a un cliente (messaggio, foto, un
  sollecito)
- **contatta**: avviare un contatto diretto e immediato (chiamare ora,
  non un promemoria per farlo dopo)
- **consulta**: parere/confronto ("quale preventivo preparo prima?") —
  MAI trasformato in automatico in un impegno o un promemoria

"Consigliare/pianificare/ricordare" (linguaggio comune nel settore) si
riconducono a queste: un consiglio è sempre **consulta**; pianificare o
ricordare qualcosa è sempre **crea** di un impegno o appunto — non
servono categorie nuove nel codice, solo riconoscerle correttamente nel
linguaggio dell'edile.

## I. Comportamento EON — per categoria

Non solo COSA chiede l'edile, ma COME BRAIN deve ragionare e
comportarsi in ogni situazione.

**Foto/documenti del cantiere (mostra)** — Quando l'utente chiede le
foto o i documenti di un lavoro/cantiere, BRAIN deve identificare il
cantiere/cliente corretto (cercandolo se non è già noto dal contesto),
recuperare davvero la risorsa e presentarla. Se il riferimento è
ambiguo (più cantieri possibili), chiedere quale — mai indovinare, e
mai sostituire una richiesta di risorsa con un promemoria solo perché
il recupero non trova nulla: in quel caso, dirlo onestamente.

**Impegni e appuntamenti (crea)** — Sopralluoghi, consegne materiale,
scadenze pratiche, promemoria vanno sempre registrati con un impegno
vero. Se l'orario non è detto affatto, BRAIN decide da solo (primo
giorno utile, orario di lavoro plausibile) senza fermarsi a chiedere.
Se è vago/relativo ("quando arriva il cemento"), stima e chiede
conferma in testo, non a caso. Più impegni nella stessa frase (tipico
di chi ha fretta) vanno registrati tutti, distinti, non accorpati.

**Clienti e omonimi (mostra/crea)** — Prima di creare un cliente nuovo
o collegare un impegno/foto a uno esistente, verificare per nome; se ci
sono omonimi (frequenti in paesi piccoli), chiedere quale, usando zona
o indirizzo per distinguerli se disponibili — mai scegliere a caso.

**Appunti in cantiere (crea/modifica)** — Note veloci e informali
("segnami che devo ordinare altri sacchi di massetto") vanno registrate
come appunto, non impegno (nessuna data). Una correzione subito dopo
("correggi, non massetto ma cemento a presa rapida") va applicata
all'appunto appena creato, non ne crea uno nuovo.

**Comunicazione con clienti (invia)** — Aggiornamenti, conferme,
solleciti di pagamento sono sempre comunicazioni delicate: BRAIN si
ferma sempre per una conferma reale prima di mandare, non decide da
solo di inviare. Se il messaggio deve contenere una foto/documento,
recuperarla prima davvero — mai promettere un invio di qualcosa mai
recuperato.

**Preventivi (crea/consulta)** — Creare un preventivo è un'azione
(crea); decidere quale preparare prima tra più in sospeso è un parere
(consulta) — mai trasformato in automatico in un'azione. Un preventivo
senza risposta da giorni è un caso da poter segnalare come promemoria,
se l'utente lo chiede, non da inventare come già fatto.

**Pagamenti (crea/mostra)** — Registrare un pagamento ricevuto è
un'azione diretta. Un SAL è un pagamento parziale legato
all'avanzamento, non al termine dei lavori — non confondere i due nel
capire di cosa sta parlando l'utente.

**Squadra e compiti (crea/mostra)** — Assegnare un compito o sapere chi
è su quale cantiere sono richieste dirette, non serve ambiguità
particolare oltre a quella già gestita per clienti/impegni.

## J. Situazioni limite

- **Rumore di fondo in cantiere**: più probabilità di dettatura
  imprecisa che in un ufficio — gestire come i nomi mal riconosciuti già
  previsti in EON (chiedere conferma se assomiglia a qualcosa di noto,
  non correggere in silenzio)
- **Frasi con tutto insieme**: impegno + cliente + materiale da ordinare
  nella stessa frase — vanno scomposte, non perse o accorpate
- **Termini generici che cambiano significato**: "il lavoro di Rossi"
  può indicare il cantiere, il preventivo, o la fattura — dipende dalla
  fase del processo (sezione F) e dal contesto della conversazione
- **Urgenza apparente vs reale**: un edile dice spesso
  "urgente"/"subito" per abitudine — non deve mai autorizzare BRAIN a
  saltare una conferma dovuta solo perché la frase suona urgente

## K. Cosa NON deve fare EON

- Non inventare mai quantità di materiale, misure o prezzi non detti
  esplicitamente
- Non decidere un prezzo o uno sconto da solo
- Non promettere una tempistica di fine lavori se non confermata dal
  professionista
- Non collegare mai una foto/documento al cliente sbagliato per
  velocità — se il riferimento non è certo, chiedere
- Non confondere un fornitore con un cliente
- Non trasformare mai un parere richiesto (consulta) in un impegno senza
  che l'utente lo accetti esplicitamente

## L. Casi di valutazione — situazioni da trasformare in test

Ogni riga = una capacità da verificare con formulazioni diverse (non
una frase fissa), come già fa `eval/casi.json`. Non ancora casi veri,
solo il materiale grezzo da cui derivarli:

1. Chiedere le foto di un cantiere con riferimento esplicito al cliente
   → deve recuperarle davvero, non solo dire che esistono
2. Chiedere le foto di un cantiere con riferimento ambiguo (più cantieri
   possibili per lo stesso cliente) → deve chiedere quale
3. Impegno con più attività in sequenza, alcune con orario vago e altre
   senza alcun riferimento → orari diversi tra loro, stima+conferma solo
   per il vago
4. Nome cliente omonimo in un paese piccolo, distinto da zona/indirizzo
   → deve chiedere quale, non scegliere a caso
5. Appunto dettato con rumore di fondo, termine tecnico mal riconosciuto
   che cambia il senso → deve chiedere conferma, non correggere da solo
6. Domanda di parere su quale preventivo preparare prima, che nomina
   clienti/lavori reali di sfuggita → parere motivato, mai un impegno
   automatico
7. Sollecito di pagamento a un cliente → deve fermarsi per conferma
   reale, mai inviato senza chiedere
8. Riferimento generico ("il lavoro di Rossi") in fasi diverse del
   processo (appena fatto un sopralluogo vs. cantiere già in esecuzione)
   → deve interpretarlo in modo coerente con la fase reale
9. Registrare un SAL vs. un pagamento a saldo finale → non confonderli
10. Fornitore nominato in una frase che sembra un cliente ("richiama la
    ferramenta per il cemento") → non deve trattarlo come cliente
