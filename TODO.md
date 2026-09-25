# Cose da fare in seguito

Note di lavoro per interventi futuri, non urgenti. Ogni voce ha lo scopo e l'idea di base, da riprendere quando si decide di affrontarla.

## Velocità: rendere le azioni dell'AI immediate

Oggi quando l'AI esegue un'azione (es. "segna il cliente Mario Rossi"), l'utente
aspetta la risposta del modello AI e poi vede l'interfaccia aggiornarsi solo dopo
un ricaricamento completo di tutti i dati. Percepito come lento.

1. **Aggiornamento mirato invece di reload completo — FATTO il 31/08/2026.**
   Nuova funzione `aggiornaDatiToccati()`: per le azioni più comuni (creare/
   modificare un cliente, creare un impegno, un appunto) aggiorna solo il
   record toccato — spesso senza nessuna chiamata di rete in più (il caso di
   un impegno o un appunto, i cui dati arrivano già completi dalla risposta
   dell'AI), o con una sola lettura mirata (il caso di un cliente). Per tutto
   il resto (spostamenti, eliminazioni, cestino, messaggi in chat) resta il
   ricaricamento completo di sicurezza, invariato. Collegata ai due punti
   dove l'app reagisce alle azioni dell'AI (microfono/testo condiviso e hub
   AI a schermo intero) — non agli altri punti dell'app che ricaricano tutto
   per motivi diversi (es. dopo un ripristino dal Cestino).

2. **Aggiornamento ottimistico dell'interfaccia — non ancora fatto.** L'idea
   originale era mostrare subito il risultato atteso *prima* che l'AI avesse
   confermato. In pratica non è ben definibile finché non si sa cosa farà
   l'AI (potrebbe creare un cliente, un impegno, niente): il punto 1 sopra
   ottiene comunque gran parte dell'effetto "istantaneo" voluto, perché
   toglie il ricaricamento completo che rallentava l'aggiornamento *dopo*
   la risposta dell'AI. Da valutare se ha ancora senso perseguirlo a parte,
   o se il punto 1 basta.

Nota: il tempo della vera e propria chiamata al modello AI (capire cosa è stato
detto/scritto) non si può azzerare — resta un vero giro di rete di ~1-2 secondi.
Questi due interventi non lo eliminano, ma fanno *sembrare* l'app istantanea,
che è l'effetto che conta per chi la usa.

Non è legato al numero di persone che usano l'app insieme: ogni richiesta è
indipendente (Vercel + Supabase scalano per richiesta), quindi più tester non
rallentano chi sta già usando l'app, a meno di toccare un limite di richieste al
minuto sulla chiave del modello AI condivisa.

## Conversazione a voce con EON (microfono + risposta parlata)

**Fatto in parte, il 31/08/2026** — EON ora risponde a voce (con la voce
nativa del telefono, `speechSynthesis`, gratis e senza configurazione)
quando gli parli tramite il microfono di Home, Clienti o Cliente cantiere.
Se scrivi invece di parlare, resta muto (solo toast), come deciso.

Resta da estendere, se si vuole più avanti:
- **L'hub AI a schermo intero** (l'icona "EON AI" raggiungibile da più
  pagine) ha un proprio microfono e una propria logica di risposta,
  separata da `collegaMicTesto()`: non parla ancora.
- **Il toast di conferma per le azioni delicate** (es. "Confermi
  l'appuntamento?") non legge la domanda ad alta voce, anche quando si è
  arrivati lì parlando.
- Voce più naturale (OpenAI): vedi la sezione qui sotto, che ora raccoglie
  tutto il "programma OpenAI" insieme.

Richiesto da Gianardi il 31/08/2026.

## Programma OpenAI: voce umana + trascrizione di registrazioni e telefonate

Per ora la voce di EON è quella di sistema del telefono (gratis, vedi sopra).
L'idea è passare ai servizi OpenAI per tre cose insieme, quando si deciderà
di investirci:

1. **Voce umana, non robotica.** Il servizio di sintesi vocale di OpenAI al
   posto della voce di sistema — molto più naturale. A pagamento (costo per
   ogni risposta parlata), ma la chiave OpenAI è già configurata sul server
   (oggi usata per Whisper): serve solo una piccola aggiunta lato server, non
   un nuovo servizio da collegare da zero.

2. **Ascoltare telefonate e audio dei clienti.** Poter caricare (o registrare
   sul momento) l'audio di una telefonata o di un promemoria vocale legato a
   un cliente, e farlo trascrivere da EON — usa lo stesso Whisper (OpenAI)
   già integrato oggi per trascrivere i vocali in chat, solo esteso a file
   audio più lunghi/esterni.

3. **Trascrivere direttamente nel calendario.** Una volta trascritta la
   telefonata/registrazione, farla leggere all'assistente AI (lo stesso
   motore che oggi capisce "chiamare Guidi alle 17" dal microfono) e fargli
   estrarre in automatico gli impegni menzionati — appuntamenti, promesse
   fatte, cose da richiamare — e segnarli lui stesso nel calendario, invece
   di doverli riscrivere a mano dopo aver riascoltato la chiamata.

Da decidere quando ci si mette mano: dove si carica/registra l'audio nell'app
(una nuova pagina? dentro la scheda del cliente?), e se la trascrizione va
salvata da qualche parte o serve solo a estrarre gli impegni al volo.

Richiesto da Gianardi il 31/08/2026.

## Documenti impresa: l'AI legge la scadenza da sola e ricorda il rinnovo

In "Documenti impresa" (`page-documenti-impresa`) oggi l'artigiano carica un
file (es. il DURC) e basta: nessuna data, nessuna descrizione, solo il file
in `cantiere_documenti` (url, nome, tipo). L'idea è che l'AI legga da sola il
documento appena caricato, capisca di che documento si tratta e trovi la data
di scadenza scritta sopra, senza che l'artigiano scriva nulla — poi ricordi
il rinnovo 30 giorni prima.

È fattibile, e senza un nuovo servizio da collegare: la stessa AI già usata
per l'assistente (Anthropic/Claude, chiave già configurata sul server) legge
direttamente PDF e foto di documenti, non serve OCR a parte.

In pratica, tre pezzi:
1. **Lettura automatica al caricamento.** Appena il file arriva (in
   `caricaCantiereDocumento()`), mandarlo all'AI con una richiesta tipo
   "che documento è, e quando scade?" e salvare il risultato (tipo di
   documento + data di scadenza) insieme al file — serve una colonna in più
   su `cantiere_documenti` (es. `scadenza`, `tipo_documento`).
2. **Mostrarlo in lista.** Nell'elenco di "Documenti impresa", far vedere la
   scadenza trovata (e magari un avviso visivo se è vicina o già passata).
3. **Il promemoria vero e proprio.** 30 giorni prima della scadenza, avvisare
   l'artigiano — il modo più semplice è controllarlo ad ogni apertura
   dell'app (un documento in scadenza entro 30 giorni genera un avviso/
   toast, come già succede per gli impegni), senza bisogno di un servizio
   esterno che "sveglia" l'app da solo.

Da decidere quando ci si mette mano: cosa fare se l'AI non riesce a leggere
la data (foto poco chiara, documento non riconosciuto) — probabilmente
chiedere all'artigiano di inserirla a mano solo in quel caso, non bloccare
il caricamento.

Richiesto da Gianardi il 31/08/2026.

## Taglio costi: ottimizzazione dell'AI

Oggi ogni azione dell'AI (es. "segna il cliente Mario Rossi") manda al
modello, ad ogni singola richiesta, le stesse istruzioni di sistema e lo
stesso elenco di strumenti (crea_cliente, crea_impegno, ecc.) — la parte più
pesante del costo, ripetuta identica ogni volta. Obiettivo: avvicinarsi a
1-2 euro al mese per cliente attivo, senza perdere qualità nelle risposte.

Interventi, in ordine di rapporto costo/beneficio:

1. **Prompt caching (Anthropic) — FATTO il 01/09/2026.** Le istruzioni di
   sistema e l'elenco degli strumenti sono identici ad ogni chiamata: ora
   il "system" mandato ad Anthropic è diviso in due pezzi — le istruzioni
   fisse (segnate con `cache_control`, così Anthropic le tiene "pronte" e
   le fa pagare circa 1/10 del prezzo normale dalle chiamate successive in
   poi) e la sola data/ora corrente, che cambia sempre e per questo sta
   fuori dalla parte in cache, altrimenti l'avrebbe invalidata ad ogni
   singola richiesta. Nessuna perdita di qualità, l'AI risponde uguale a
   prima — cambia solo come viene fatturata la parte ripetuta. Da
   verificare nel tempo guardando il costo per azione sulla chiave
   "Eonbeckend" nella Console Anthropic (campo `cache_read_input_tokens`
   nella risposta: se cresce, la cache sta funzionando).

2. **Modello più economico per le richieste semplici — FATTO il
   01/09/2026.** Un messaggio nuovo (non una conferma, non la continuazione
   di una domanda aperta) parte ora su Claude Haiku, molto più economico di
   Sonnet (circa 1/3 del costo). Per non perdere precisione, "prova e
   correggi da solo": se Haiku non riconosce un'azione concreta da fare
   (nessuno strumento chiamato, e non è nemmeno una domanda di chiarimento
   voluta tipo "te lo segno fra un'ora?"), la STESSA richiesta viene
   rifatta subito con Sonnet, in automatico e senza che il professionista
   se ne accorga — così il risparmio c'è solo sui casi in cui Haiku ha
   davvero capito bene, mai a scapito della precisione. Lo stesso ripiego
   scatta anche se Haiku ha un intoppo di rete o risponde con un errore.
   Da tenere d'occhio nella Console Anthropic quanto spesso scatta il
   ripiego su Sonnet (tanti ripieghi = pochi comandi davvero "semplici" 
   nell'uso reale, e quindi risparmio minore del previsto).

3. **Alleggerire l'elenco degli strumenti — valutato e accantonato il
   01/09/2026.** Rischio concreto: Claude Haiku (vedi punto 2) attiva la
   cache solo sopra 4096 token, e oggi istruzioni+strumenti insieme sono
   già vicini a quella soglia (stima ~3.750-4.500 token). Alleggerire
   l'elenco proprio ora rischierebbe di far scendere il totale sotto la
   soglia e spegnere in silenzio la cache di Haiku appena attivata — e il
   risparmio che il caching (punto 1) ha già ottenuto rende il guadagno
   rimasto comunque piccolo. Da riconsiderare solo se in futuro si
   aggiungono molti nuovi strumenti e la soglia torna un problema.

4. **Meno andirivieni per le conferme — FATTO il 01/09/2026.** Scoperto
   analizzando il flusso: quando un'azione va a buon fine (una conferma
   confermata, o un comando diretto tipo "chiama Guidi alle 17"), il
   frontend NON legge affatto la frase di commento finale che Claude
   scrive — costruisce da solo il messaggio da mostrare (toast/voce)
   partendo dai dati dell'azione stessa. Quel giro in più verso l'AI,
   quindi, andava sprecato ogni volta. Ora, quando l'azione appena fatta
   è di un tipo sicuramente "conclusivo" (segnare un impegno, aggiungere
   o correggere un appunto, aggiornare un cliente — mai un'azione che
   serve solo a trovare/creare un id per un passo successivo, es.
   trova_o_crea_cliente prima di mandare un messaggio) ed è andata a buon
   fine, si salta il giro finale e si risponde subito. Se invece qualcosa
   è fallito, o l'utente ha detto "No" a una conferma, si continua a
   chiamare Claude come prima: è l'unico modo che il professionista ha di
   sapere cosa è andato storto. Whitelist scelta deliberatamente stretta
   (solo 4 strumenti su 17) dopo che la revisione del codice ha trovato
   due volte un rischio concreto in un approccio più aggressivo — vedi il
   commit per i dettagli.

Da fare per prima: il punto 1 (prompt caching), perché è il più sicuro e
il più semplice da misurare — confrontando il costo per azione prima e dopo
sulla chiave "Eonbeckend" nella Console Anthropic.

Richiesto da Gianardi il 31/08/2026.

## EON BRAIN: il motore centrale di orchestrazione

Gianardi ha consegnato una specifica tecnica completa (45 sezioni) per "EON
BRAIN": un livello che riceve una richiesta, capisce l'obiettivo, recupera
il contesto, sceglie gli strumenti giusti, li esegue, verifica i risultati
e risponde in linguaggio naturale — mai frasi predefinite o if/else.

Analizzando il codice attuale (`api/index.js`, l'assistente con i suoi 17
strumenti, lo stato di conversazione `ai_runs`, le conferme per le azioni
delicate) è emerso che gran parte della specifica è già implementata: il
sistema sceglie già gli strumenti in base allo scopo (non alla frase
esatta), incatena più strumenti in un turno, verifica sempre il successo
prima di dire "Fatto", non inventa mai dati, mantiene lo stato della
conversazione, si corregge con frasi naturali. Il gap più vero e concreto
era che OGNI richiesta, anche "apri calendario", passava dall'AI completa.

1. **Router di navigazione pura — FATTO il 01/09/2026 (fase 1a).** Nuova
   funzione `provaNavigazioneDiretta()` in `index.html`, usata dai tre
   ingressi microfono/testo (Home, Clienti, Cliente cantiere): riconosce un
   piccolo elenco chiuso di comandi di navigazione pura ("apri calendario",
   "vai ai clienti", "mostrami le conversazioni"...) verso le pagine che
   non richiedono un cliente/record già selezionato (home, oggi, clienti,
   calendario, chat, cestino, documenti impresa, pagamenti, entrate) e apre
   la pagina direttamente — zero chiamata di rete, zero costo, risposta
   istantanea. Match volutamente stretto: qualunque parola in più oltre al
   riferimento alla pagina (un nome, un orario) fa fallire il
   riconoscimento e la frase prosegue verso l'AI come sempre — un mancato
   riconoscimento è innocuo, un riconoscimento sbagliato no. Il code review
   (due giri, effort alto) ha trovato e corretto un bug reale: l'apertura
   "apri/mostra" assorbiva un articolo insieme al verbo, rendendo
   irraggiungibili i sinonimi che iniziano con un articolo ("la giornata",
   "gli appuntamenti"); corretto provando prima la frase così com'è e solo
   come ripiego senza un eventuale articolo iniziale.

2. **Letture semplici da dati già in memoria — FATTO il 01/09/2026 (fase
   1b).** Nuova funzione `provaLetturaLocale()`, stesso principio del
   router di navigazione: "appuntamenti di oggi" (filtra `tasks` con la
   stessa interpretazione delle date già usata dal Calendario), "quanti
   clienti ho" (conta `clients` non archiviati), "chi mi ha scritto"/
   "quanti messaggi non letti" (risponde a entrambe insieme: totale
   messaggi non letti + da chi, chat archiviate escluse) — tutto filtrando
   dati già caricati nel browser, zero chiamata di rete. Solo letture:
   nessuna scrittura passa mai dal router. Il code review (effort alto poi
   medio) ha trovato e fatto correggere tre problemi: (1) la domanda
   "quanti messaggi non letti" veniva risposta con un conteggio di persone
   invece che di messaggi — ora risponde a entrambe le domande insieme;
   (2) mancava il filtro sulle chat archiviate, incoerente con la pagina
   Chat stessa; (3) più importante, un bug latente nella funzione condivisa
   `interpretaQuando()` (già usata dal Calendario): il suo riconoscimento
   di date poteva leggere per sbaglio l'inizio di una parola più lunga come
   un mese (es. "8 settimane" letto come giorno 8 di settembre) — corretto
   alla radice con un confine di parola nell'espressione regolare, a
   beneficio anche del Calendario che la usava già.

   **17/09/2026 — estensione fase 1c: risorse immediate.** Richiesta
   esplicita di Gianardi ("SI ASSOLUTAMENTE. E' FONDAMENTALE QUESTO
   PASSAGGIO.") dopo aver notato che una richiesta come "mi serve
   documento tetto rossi" passava comunque dai due giri dell'AI prima di
   mostrare la card risorsa (vedi voce del 17/09 sotto "Pulizia e
   precisazioni"), anche quando il dato richiesto era già in memoria nel
   browser. Nuova funzione `provaRisorsaImmediata()`, stesso principio
   del router di navigazione/letture: riconosce "mi serve/dammi/fammi
   vedere/recupera/cerca/trova/apri [il/la] foto/documento/preventivo/
   fattura di [cliente]", risolve il cliente con un confronto rigido
   (mai fuzzy: se il nome corrisponde a più di un cliente o a nessuno,
   torna false e la frase prosegue verso l'AI come sempre — falso
   negativo innocuo, mai un falso positivo su quale cliente), poi legge
   foto/documenti già caricati in memoria (`cantiereFoto`, `chats[i]
   .messages`) e apre la card risorsa direttamente — zero chiamate di
   rete, verificato a 4ms in un test end-to-end con Playwright. Nessuna
   scrittura passa mai da qui, solo letture, come le fasi 1a/1b.
   Nuova sezione di test dedicata in `eval/router.test.js` ("Router:
   risorse immediate, fase 1c"): casi positivi (foto e documenti di un
   cliente univoco) e casi di sicurezza (cliente non trovato, cliente
   ambiguo tra due omonimi, frasi che non sono richieste di risorsa) —
   tutti verificati che NON vengano intercettati per errore. Ha
   richiesto anche un piccolo aggiustamento a un test preesistente
   ("Current Focus"): una delle sue frasi di prova ("fammi vedere il
   documento di Rossi") ora viene intercettata legittimamente da questa
   nuova fase 1c prima di arrivare al motore AI mockato che quel test
   doveva verificare — riformulata la frase di prova per continuare a
   testare quello che testava in origine, senza toccare il
   comportamento vero. Suite completa verificata dopo la modifica:
   `router.test.js` 39/39, `backend.test.js` 18/18.

   **17/09/2026 — fase 1d: appunti istantanei, e "stratagemma" per gli
   appuntamenti.** Gianardi ha chiesto se lo stesso principio si potesse
   estendere ad appunti e appuntamenti: "SI PER GLI APPUNTI. INVECE PER
   APPUNTAMENTI FAREI UN METODO STRATAGEMMA: EON MANDA LA NOTIFICA
   IMMEDIATA E POI LAVORA IN SILENZIO PER FISSARE CORRETTAMENTE TUTTO."
   Due funzioni distinte, perché i due casi hanno rischi diversi:
   - **Appunti (`provaAppuntoImmediato`)**: `crea_appunto` non ha NESSUNA
     ambiguità da risolvere (salva il testo esatto detto, senza data né
     cliente da collegare) — bypassa del tutto l'AI e scrive
     direttamente su `cantiere_appunti`, la stessa identica scrittura
     già usata dalla pagina dedicata "Appunti cantiere" (riusata da un
     secondo punto d'ingresso, non una scorciatoia nuova). Riconosce
     "segnami/annotami/scrivimi/metti/prendi [in appunti/una nota]
     che...", ma SOLO se la frase non contiene anche un riferimento di
     data/ora (in quel caso resta un impegno, gestito come sempre
     dall'AI) — falso negativo innocuo, mai un falso positivo.
   - **Appuntamenti (stratagemma di Gianardi)**: qui l'AI lavora
     ESATTAMENTE come sempre — nessuna scorciatoia sulla correttezza,
     data/ora/cliente restano sempre decisi dal motore vero, stesso
     identico percorso di oggi. L'unica differenza è cosa vede l'utente
     MENTRE aspetta: appena riconosciuta una frase che sembra un nuovo
     appuntamento (un riferimento di tempo, non una cancellazione/
     spostamento), compare subito nella lista di oggi un avviso
     provvisorio col testo esatto detto dall'utente — **mai una data/ora
     indovinata sul momento**: scelta esplicita di Gianardi (chiesto con
     `AskUserQuestion`), per non rischiare di mostrare anche solo per un
     istante un orario sbagliato. L'avviso sparisce da solo (mai scritto
     su Supabase, mai dentro `tasks`) appena arriva la risposta vera,
     sostituito dal risultato reale — stesso principio di una spunta
     "inviato" prima della conferma di consegna, o di "Invio in corso…"
     di Gmail.
   Bug reale trovato mentre si verificava che l'avviso comparisse
   davvero nella pagina Oggi vista dall'utente: `taskListAI`/
   `taskListUser` (e altri id: `oggiHeroDate`, `difficultyFill`,
   `summaryGrid`, `miniRing*`) erano DUPLICATI in due pagine — la vera
   "Oggi" (`page-oggi`) e una pagina "Assemblee" per l'Amministratore
   (`page-assemblee`) rimasta con dentro, per errore di una sessione
   precedente, una copia mai completata della pagina Oggi invece del suo
   vero contenuto. Poiché `getElementById` restituisce sempre il primo
   elemento con quell'id nel documento (page-assemblee viene prima nel
   file), TUTTI questi aggiornamenti (ring di avanzamento, difficoltà
   della giornata, riepilogo, liste attività) sono sempre finiti nella
   pagina Assemblee nascosta invece che nella vera pagina Oggi visibile
   — probabile causa di una pagina Oggi che sembrava non aggiornarsi mai
   dinamicamente. Corretto sostituendo il contenuto di `page-assemblee`
   con la sua vera struttura (uguale a quella già funzionante di
   "Udienze e Scadenze" per l'Avvocato: `assembleeList`/`assembleeCount`,
   già attesi da `renderAssemblee()` ma mai collegati a nessun markup
   HTML). Verificato con Playwright che l'avviso ora compare davvero
   nella pagina Oggi vista dall'utente, non in una copia nascosta.
   Nuove sezioni di test in `eval/router.test.js` (fase 1d e
   stratagemma appuntamenti): 54/54 verifiche passate.

3. **Livelli di rischio a 4 valori — FATTO il 01/09/2026.** Sostituito
   `sensitive: true/false` nei 17 strumenti di `api/index.js` con
   `risk: "read"|"low_write"|"high_impact"|"external"` (5 read, 6
   low_write, 5 high_impact, 1 external — `manda_messaggio`, l'unico i
   cui effetti si vedono fuori dall'app). Nuova funzione
   `richiedeConferma(tool)` (vero solo per high_impact/external) al posto
   del controllo diretto su `sensitive` — stesso comportamento di conferma
   di prima (verificato dal code review, effort alto: nessuna
   riclassificazione è scivolata dentro per errore), solo metadati più
   precisi, base per policy di conferma più fini in futuro.

4. **`request_id` per turno — FATTO il 01/09/2026.** Nuova tabella
   `ai_request_log` (migrazione in `supabase/ai_request_log_schema.sql`,
   da eseguire una volta nell'SQL Editor di Supabase): una riga per OGNI
   turno completo dell'assistente (non uno strumento alla volta come
   `ai_audit_log`) con tipo (nuovo/conferma/continuazione), messaggio,
   modello usato (Haiku o Sonnet), quanti giri, quali strumenti sono
   stati eseguiti, come è finito e quanto ci ha messo — per rispondere a
   "perché EON ha fatto questa cosa" leggendo una riga sola. Leggibile
   anche da `GET /api?resource=ai_request_log`, come il registro
   esistente. Il code review (due giri, effort alto poi medio) ha
   trovato e fatto correggere un problema reale: la scrittura del
   registro, in attesa prima di rispondere (necessario su un ambiente
   serverless come Vercel, altrimenti rischia di non arrivare mai),
   poteva restare bloccata su un Supabase lento e trasformarsi in un
   timeout per l'utente che aspettava la vera risposta di EON — corretto
   con un limite di 2 secondi, oltre i quali si rinuncia a scrivere quella
   singola riga di log piuttosto che bloccare la conversazione.

5. **Contesto delle correzioni veloci — FATTO il 01/09/2026.** Confermato
   da Gianardi: gli era già capitato di dover ripetere un dettaglio perché
   EON aveva "dimenticato" cosa avevano appena fatto. Causa: i 90 secondi
   di continuazione (`runIdAperto`) scattano SOLO quando EON fa una vera
   domanda ("te lo segno fra un'ora?") — un'azione già conclusa ("Segna
   Mario domani alle 9" → "Fatto.") non lasciava nessuna traccia, quindi
   "No, alle 10" subito dopo ripartiva da zero senza sapere a cosa si
   riferisse "alle 10".
   Corretto senza un nuovo "oggetto di contesto" complesso: una finestra
   di 3 minuti (`ultimeAzioniVisibili` in `collegaMicTesto()`) tiene a
   mente TUTTE le azioni scrivibili dell'ultimo turno (non solo l'ultima:
   un turno con più azioni insieme deve poterle correggere entrambe); un
   messaggio nuovo entro quella finestra porta con sé una nota di
   contesto che ricorda a Claude cosa è appena successo, lasciandogli
   comunque la decisione finale se si tratti davvero di una correzione o
   di una richiesta nuova — mai una regola rigida, solo un promemoria.
   Non tocca in nessun modo la vera continuazione di una domanda aperta
   (resta il meccanismo esistente, priorità sua). Il code review (due
   giri, effort alto poi medio) ha trovato e fatto correggere tre rischi
   concreti: (1) veniva ricordata solo l'ultima azione di un turno con
   più azioni insieme, rendendo impossibile correggere le altre; (2)
   niente impediva a Claude di applicare una correzione all'azione
   sbagliata se il nuovo messaggio nominava una persona diversa; (3) la
   nota dava per scontato il successo anche quando un'azione era fallita
   solo in parte (es. svuota_cestino con alcune categorie non svuotate).
   Resta un limite intrinseco (segnalato dal review, accettato): essendo
   un promemoria e non una regola imposta, un messaggio nuovo davvero
   scollegato ma senza un nome esplicito diverso dipende dal giudizio di
   Claude per essere riconosciuto come tale — coerente con il principio
   della specifica di non insegnare regole rigide, ma un limite reale.

6. **Evaluation Suite — FATTO il 01/09/2026.** Nuova cartella `eval/`,
   in due parti:
   - `eval/casi.json`: catalogo di 23 situazioni (non frasi esatte) —
     riconoscimento dell'intento, orario mancante/vago, correzioni
     naturali (anche dopo un'azione già conclusa), clienti omonimi, nomi
     mal riconosciuti dal microfono, trovare l'impegno giusto per nome
     (e gestirne l'ambiguità), appunti vs impegni, robustezza a
     refusi/informalità/ordine delle informazioni/richieste
     contraddittorie o incomplete, richieste multi-step, non inventare
     mai nulla, e il router (navigazione/letture locali).
   - `eval/router.test.js`: parte automatica, **eseguita con successo
     (28/28)**, copre lo strato deterministico (router, contesto delle
     correzioni) che non ha bisogno dell'AI vera — da rilanciare ad ogni
     modifica al router o al contesto, prima di aprire una PR.
   - `eval/live-check.js`: parte che manda i casi restanti al vero
     endpoint AI e confronta strumenti chiamati/stato/domande attese,
     stampando il resto per un giudizio umano — **mai eseguita in questa
     sessione** (l'ambiente di sviluppo non ha accesso a un vero deploy
     Vercel/Supabase né a una chiave Anthropic live): richiede un
     account Supabase di PROVA (mai quello con i dati veri) e le
     variabili `EVAL_API_URL`/`EVAL_ACCESS_TOKEN` — vedi `eval/README.md`.

   Il code review (tre giri, alto poi medio) ha trovato e fatto
   correggere quattro problemi nel controllo automatico: un caso con
   uno strumento delicato (sposta_impegno) segnato come verificabile in
   automatico avrebbe bocciato una richiesta di conferma corretta (gli
   strumenti delicati non eseguono finché non confermati, quindi non
   compaiono ancora nelle azioni); un caso di orario vago dichiarava la
   verifica automatica senza dare nulla da controllare; due casi
   usavano un nome di campo (`_turno_2`) mai letto dal controllo,
   cadendo sempre nel percorso "non verificabile" senza che si notasse;
   un confronto con valore "vero/falso" (se il testo finisce con un
   punto interrogativo) trattava un eventuale `false` esplicito come se
   il campo non fosse stato dichiarato affatto.

   Con questo, tutti e 6 i punti "core" del piano EON BRAIN sono
   completi. Resta il punto 7 (Communication Hub multi-canale), tenuto
   volutamente separato per la sua dimensione.

7. **Communication Hub multi-canale (email, WhatsApp) — progetto a sé.**
   Già in parte annotato sopra in "Programma OpenAI": nessun adapter
   esterno oggi, `manda_messaggio` scrive solo nel Portal interno. Da
   pianificare separatamente quando si deciderà di investirci, per la sua
   dimensione (webhook in ingresso, risoluzione identità, prevenzione
   duplicati, conversazione unica multi-canale).

Piano completo (analisi, mappa dei gap, fasi) discusso e approvato con
Gianardi il 01/09/2026.

Richiesto da Gianardi il 01/09/2026.

## EON BRAIN, seconda fase: da "esegue comandi" a "capisce l'obiettivo"

Con i 6 punti "core" sopra completati, Gianardi ha chiesto un audit
indipendente del BRAIN reale (report tecnico completo, punto per punto,
verificato riga per riga contro il codice e il database live — nessuna
modifica, solo fotografia fedele) e poi una gap analysis basata su 4
documenti: la specifica originale, quel report, 11 casi di test reali sul
campo (comportamento atteso vs ottenuto), e la filosofia di prodotto
("conversazione naturale" + "se lo chiedo, deve apparire — search is
secondary, intent is primary").

Dall'analisi: il motore di orchestrazione (loop tool-use, verifica dei
risultati, niente invenzioni, stato di conversazione, entity resolution di
base) è solido e non va rifatto. Il problema reale è più stretto e
specifico — il sistema ha un solo "contenitore" universale
(l'impegno/nota) e ogni richiesta che non è esattamente "crea un impegno"
viene deformata per entrarci comunque: un documento richiesto diventa un
impegno "vai a prendere il documento", un preventivo richiesto diventa un
impegno "fai il preventivo", invece di essere davvero recuperato/prodotto
e mostrato. Individuate 4 capacità architetturali mancanti (non 11 bug
separati): la distinzione tra Risorsa/Azione/Comunicazione ("Intent →
Experience"), un Current Focus per risolvere riferimenti impliciti
("mandalo", "quello di prima"), un'entity resolution applicata in modo
uniforme (oggi bypassabile a seconda del tool scelto dal modello) e la
gestione di azioni bulk/batch. Design del contratto centrale (IntentFrame)
discusso e approvato con Gianardi, con due correzioni sue: il Current
Focus non deve scadere a tempo fisso ma restare valido finché non viene
sostituito da un riferimento incompatibile; l'IntentFrame deve essere un
vero passo di comprensione prima dell'esecuzione, non solo parametri
aggiunti ai tool esistenti.

Ordine di implementazione concordato: (1) IntentFrame + Risorsa/Azione/
Comunicazione, (2) Current Focus, (3) Entity Resolution uniforme, (4)
supporto alla visualizzazione/preparazione delle risorse, (5) test
automatici sulle nuove capacità, (6) solo dopo bulk e ragionamento
temporale. Regole ferme per tutta l'implementazione: nessuna regola
basata su frasi specifiche, nessun if/else per far passare i singoli
casi di test, non rompere i tool esistenti, modifica progressiva con
regression test dopo ogni fase.

1. **IntentFrame + distinzione Risorsa/Azione/Comunicazione — FATTO il
   02/09/2026.** Aggiunto un campo `categoria` (`risorsa`/`azione`/
   `comunicazione`/`supporto`) ai 17 tool esistenti in `api/index.js`,
   ortogonale al campo `risk` già presente (`risk` = quanto è delicata
   un'azione, `categoria` = su cosa opera — nessun tool esistente cambia
   comportamento). Nuovo tool `interpreta_richiesta`, che non tocca il
   database ed è obbligato come primo passo di ogni messaggio nuovo
   (tramite `tool_choice` forzato al primo giro): Claude dichiara lì, in
   forma strutturata, operazione (mostra/crea/modifica/cancella/invia/
   contatta/consulta), oggetto (risorsa/azione/comunicazione/nessuno) ed
   entità coinvolta — anche quando è un riferimento implicito ("lo",
   "quello"). Non è un nuovo layer di comprensione del linguaggio: è la
   comprensione che Claude ha già, costretta a uscire in una forma che il
   codice può controllare prima di eseguire qualunque tool vero.
   L'IntentFrame non ha una colonna propria nel database: viene
   ricostruito rileggendo la cronologia già persistita in
   `ai_runs.messaggi`, identica per un turno nuovo, una conferma o una
   continuazione — nessuna migrazione per questa fase.
   Nuovo tool `capacita_non_disponibile`: quando l'intento dichiarato è
   "risorsa" ma nessuno strumento sa davvero recuperare quella cosa,
   Claude lo dichiara onestamente invece di far finta di aver fatto
   qualcosa con `crea_impegno`/`crea_appunto` — resta comunque loggato
   come ogni altro tool, base per capire in futuro quali risorse mancano
   davvero nel registro.
   In `proseguiAssistente()`, un controllo generale (non specifico per
   `crea_impegno` né per nessuna frase): quando l'intento attivo è
   "risorsa", un tool di categoria "azione" viene rifiutato invece di
   essere eseguito come se soddisfacesse la richiesta — il controllo si
   scarica da solo non appena `capacita_non_disponibile` viene chiamato,
   per non bloccare per sempre l'azione alternativa che l'assistente
   stesso propone subito dopo.
   Tre giri di code-review (alto poi medio) hanno trovato e fatto
   correggere: il blocco che impediva di eseguire proprio il ripiego
   appena proposto da `capacita_non_disponibile` (un fallback "||" che
   resuscitava l'intento appena scaricato); il ripiego di rete
   Haiku→Sonnet perso sul giro in cui Claude sceglie davvero cosa fare
   (il giro forzato di `interpreta_richiesta` aveva spostato quel giro
   senza spostare anche la protezione di rete); il tetto di giri per
   messaggio, aumentato di uno solo per i messaggi nuovi per compensare
   il giro riservato all'interpretazione senza toccare il budget di
   conferme/continuazioni.
   Regressione: `eval/router.test.js` 28/28 (router, contesto delle
   correzioni — nessuno tocca il codice modificato in questa fase).

2. **Current Focus senza scadenza a tempo — FATTO il 02/09/2026.**
   Correzione esplicita di Gianardi sul design: a differenza della
   finestra delle correzioni veloci (punto 5 sopra, 3 minuti), il
   Current Focus non deve scadere dopo un tempo fisso — deve restare
   valido finché la conversazione mantiene quel riferimento, sostituito
   solo da un nuovo riferimento esplicito incompatibile.
   In `api/index.js`, nuova `costruisciFocus(elencoMessaggi)`: deriva
   dall'ultimo IntentFrame dichiarato (punto 1) l'entità esplicita di
   cui si è appena parlato — mai un id "in cache", solo tipo e
   riferimento testuale così come detto dall'utente, che verrà
   ri-risolto normalmente (es. con `cerca_cliente`) quando servirà
   davvero, invece di fidarsi di un dato potenzialmente vecchio (un
   cliente nel frattempo rinominato o cestinato). Non lo espone quando
   l'utente ha usato un riferimento implicito (il focus da mantenere è
   già quello del frontend) né quando l'operazione è "consulta" (un'entità
   nominata solo come esempio in una domanda generica non deve rubare
   il focus a quella davvero in lavorazione). Nuovo helper `finisciTurno`
   che aggiunge il focus SOLO alle risposte davvero "concluso", mai a
   una richiesta di conferma in sospeso (potrebbe riguardare un'entità
   diversa da quella più di recente dichiarata, in un turno con più
   intenti distinti).
   In `index.html`, nuova `focusCorrente` in `collegaMicTesto` (nessuna
   scadenza, a differenza di `ultimeAzioniVisibili`) e `notaFocusCorrente`
   iniettata nel messaggio nuovo, per far sapere a Claude a cosa si
   riferisce un eventuale "lo"/"quello"/"quello di prima".
   Due giri di code-review (alto poi medio) hanno trovato e fatto
   correggere: il focus poteva finire attaccato alla conferma di
   un'azione riguardante un'entità diversa da quella più recente in un
   messaggio con più intenti; un'entità nominata solo come esempio in
   una domanda "consulta" poteva diventare il focus per errore.
   Regressione: `eval/router.test.js` 28/28.

3. **Entity Resolution uniforme — FATTO il 02/09/2026.** Prima la
   risoluzione di un cliente ambiguo/inesistente viveva dentro i
   singoli tool (`cerca_cliente`, `trova_o_crea_cliente`): se il
   modello sceglieva un altro tool per eseguire l'azione, il
   meccanismo veniva bypassato — non incoerenza del modello, il
   sistema permetteva di aggirarlo. Visto due volte nei test reali: un
   cliente nuovo mai proposto come tale, un "chiama X" senza telefono
   mai richiesto.
   Nuova `risolviClienteDaNome(nomeCercato, ctx)`: stessa logica a tre
   livelli già usata da `trova_o_crea_cliente` (esatto → substring per
   parola → fuzzy), ma come puro lookup, mai una creazione, con uno
   stato distinto "simile" per una singola corrispondenza fuzzy — mai
   trattata come certa. Duplica volutamente parte della ricerca già
   presente negli altri due tool, per non alterarne il comportamento.
   `interpreta_richiesta.run()` la chiama automaticamente ogni volta
   che l'entità dichiarata è di tipo "cliente" con un riferimento
   esplicito — non più il modello a decidere se/quando cercare. Il
   risultato include `cliente_risolto` (trovato/simile/ambiguo/
   non_trovato) e, quando l'operazione è "contatta" e manca un
   telefono, `manca_telefono`. System prompt aggiornato con le
   istruzioni sui 4 stati, generali per qualunque tool verrà scelto
   dopo.
   Due giri di code-review (alto poi medio) hanno trovato e fatto
   correggere: il confronto sul tipo di entità era rigido invece di
   tollerare maiuscole/spazi; la richiesta del telefono per "contatta"
   rischiava di bloccare un'azione che non lo richiede affatto (es. un
   messaggio interno) — ora legata esplicitamente a
   `capacita_non_disponibile` quando manca davvero un modo di
   contattare direttamente, mai un blocco a sé; lo stesso segnale
   mancava per lo stato "simile"; una frase del prompt affermava senza
   condizioni che `cliente_risolto` fosse sempre presente (falso con
   un riferimento implicito); descrizione obsoleta su `crea_impegno`.
   Regressione: `eval/router.test.js` 28/28.

4. **Supporto alla visualizzazione delle risorse — FATTO il
   02/09/2026.** Fino ad ora un tool "azione" poteva bloccarsi come
   ripiego quando l'intento era "risorsa" (punto 1), ma senza un vero
   tool RISORSA la strada era comunque `capacita_non_disponibile` per
   ogni caso. Aggiunti i primi due tool RISORSA reali, verificati
   contro lo schema effettivo del database (non inventati):
   `recupera_foto_cantiere` (legge `cantiere_foto`, immagini su
   Supabase Storage taggabili a un cliente — copre "manda le foto del
   cantiere X a Y", che proponeva l'invio senza aver mai visto le
   foto) e `recupera_documenti_cliente` (legge cosa c'è davvero nella
   conversazione di un cliente, distinguendo "allegato" — file vero,
   sempre con url — da "preventivo_o_fattura" — generato in app,
   titolo/importo/riepilogo ma MAI un url esterno, il PDF si
   ricompone solo dentro l'app — copre "ho bisogno del documento di
   Rossi", che diventava un impegno invece di mostrarlo).
   Deliberatamente non incluso: un tool per CREARE un preventivo
   nuovo — la creazione vera passa da una pagina intera lato
   frontend (intestazione, voci, condizioni), riprodurla server-side
   sarebbe una modifica troppo grande per una fase progressiva. Resta
   onestamente `capacita_non_disponibile`.
   System prompt aggiornato di conseguenza (provare prima i tool
   risorsa, recuperare prima di inviare, mai inventare un link per un
   preventivo/fattura). In `index.html`, i due tool aggiunti a
   `STRUMENTI_DI_SOLA_LETTURA` (stesso trattamento degli altri tool di
   lettura — nessuna galleria visiva in questa fase, rimandata a un
   eventuale affinamento futuro dell'interfaccia).
   Due giri di code-review (alto poi medio), verificati contro gli
   schema SQL reali, hanno trovato e fatto correggere: mancava il
   filtro `deleted_at` su `cantiere_foto` (avrebbe potuto restituire
   foto cestinate); `cliente_id` non validato come uuid;
   `recupera_documenti_cliente` cercava solo `event_type=doc`
   descrivendolo genericamente come "contratti, moduli" quando quel
   tipo copre SOLO preventivi/fatture senza url — corretto per
   includere anche i veri allegati e distinguerli esplicitamente,
   evitando che il prompt spingesse a inventare un link inesistente.
   Regressione: `eval/router.test.js` 28/28.

5. **Test automatici sulle nuove capacità — FATTO il 02/09/2026.** Con
   i 4 punti core del contratto centrale completi, copertura di test
   reale — situazioni nuove, mai viste nel Documento 3, per verificare
   la capacità generale invece di far ripassare i casi già corretti.
   Nuovo `eval/backend.test.js`: test puri (nessuna rete/database/AI)
   su `estraiIntentoDaMessaggi` (ricostruzione dell'IntentFrame dalla
   cronologia, "scarico" dopo `capacita_non_disponibile`, vince sempre
   l'ultima dichiarazione, più blocchi tool_use nello stesso messaggio)
   e `costruisciFocus` (quando un'entità dichiarata diventa davvero il
   nuovo Current Focus, e i tre casi in cui non deve). `api/index.js`
   ora le esporta anche (`export { estraiIntentoDaMessaggi,
   costruisciFocus }`, oltre all'export default) solo per questo —
   puramente additivo, nessun altro file le importa.
   `eval/router.test.js` esteso con 5 verifiche sul Current Focus lato
   frontend: sopravvive a un turno di mezzo che non lo tocca (nessuna
   scadenza a tempo), sostituito solo da un nuovo focus esplicito
   incompatibile.
   `eval/casi.json`: 7 nuovi casi `brain-*` con vocabolario/domini mai
   usati altrove nel catalogo — tool risorsa inesistente/esistente,
   comunicazione che referenzia una risorsa, focus che sopravvive a un
   turno estraneo o viene sostituito, cliente nuovo in un dominio mai
   testato, `manca_telefono` che non deve mai bloccare un'azione
   indipendente. I due casi sul Current Focus sono annotati
   esplicitamente: l'iniezione della nota è lato frontend, vanno
   provati nell'app vera, non con `live-check.js` da solo (che parla
   direttamente al backend).
   Code-review (effort alto): nessun problema trovato — verificato
   empiricamente eseguendo entrambe le suite e tracciando ogni
   asserzione contro il comportamento reale del codice.
   Regressione: `eval/router.test.js` 33/33 (28 esistenti + 5 nuovi),
   `eval/backend.test.js` 15/15 (tutto nuovo).

6. **Bulk/batch e ragionamento temporale — FATTO il 02/09/2026 (ultimo
   punto del piano).** Due capacità distinte, lasciate volutamente per
   ultime perché le più grandi tra le sei.
   Bulk/batch: quando l'utente chiede un'azione delicata su più
   elementi insieme (es. "cancella tutti gli impegni di domani"),
   Claude chiama comunque lo strumento una volta per elemento (come
   già fa per `crea_impegno` con più impegni distinti) — il cambiamento
   è tutto nell'orchestratore, non nei singoli tool. In
   `proseguiAssistente()`, le richieste allo STESSO strumento nello
   stesso giro vengono raggruppate (nuova `Map codaPerNome`) in
   un'unica voce `{nome, elementi}`, con `descriviProssimaAzione` che
   costruisce UNA sola domanda quando il gruppo ha più di un elemento,
   elencandoli tutti. Il ramo di conferma esegue tutti gli elementi con
   lo stesso Sì/No, ciascuno con il proprio `tool_result`.
   Ragionamento temporale: due correzioni al system prompt, con un
   limite dichiarato onestamente — (1) il criterio per chiedere
   conferma sull'orario è ora "calcolare un orario richiederebbe
   supporre qualcosa che potrei sbagliare" invece di "la frase suona
   vaga": più preciso, ma resta un giudizio del modello, riduce
   l'incoerenza osservata nel Documento 3 (stesso messaggio, risposte
   diverse in run diversi) senza eliminarla per costruzione — non è
   possibile garantirlo con un prompt, solo con un vincolo strutturale
   che qui non c'è ancora; (2) più impegni SENZA alcun riferimento di
   tempo, in sequenza nello stesso messaggio, vanno distanziati di
   un'ora invece di ricevere tutti lo stesso default — questa invece è
   una regola meccanica e verificabile.
   Due giri di code-review (alto poi medio) hanno trovato e fatto
   correggere: la domanda di conferma per un gruppo usava `Promise.all`,
   quindi un solo elemento non descrivibile faceva sparire la domanda
   anche per gli altri, perfettamente validi — corretto con
   `Promise.allSettled`, stesso principio già usato da `svuota_cestino`
   per la raccolta degli id; la regola di distanziamento, come scritta
   la prima volta, si disattivava per l'intero gruppo se anche un solo
   impegno aveva un riferimento vago — corretta per trattare i vaghi a
   parte senza perdere la distanziazione tra i restanti.
   `eval/casi.json`: 5 nuovi casi, inclusa una combinazione mai testata
   (bulk + cliente ambiguo insieme) e un gruppo misto che verifica
   esattamente il bug corretto dal secondo giro di review.
   Regressione: `eval/router.test.js` 33/33, `eval/backend.test.js`
   15/15 (nessuna delle due toccata da questo punto).

   **Con questo si chiudono tutti e 6 i punti del design concordato per
   il nuovo contratto centrale del BRAIN** (IntentFrame, Resource/
   Action/Communication, Current Focus, Entity Resolution uniforme,
   supporto risorse, test automatici, bulk e ragionamento temporale) —
   nato dall'audit indipendente e dalla gap analysis sui 4 documenti di
   Gianardi. Limiti noti e dichiarati onestamente, non chiusi da questo
   piano: nessuna memoria/preferenza a lungo termine; il determinismo
   sull'orario vago resta un giudizio del modello, non una garanzia
   strutturale; nessun generatore di preventivi nuovi lato AI (resta
   `capacita_non_disponibile`, la creazione vera passa dalla pagina
   frontend dedicata); `eval/live-check.js` non è mai stato eseguito in
   questa sessione (serve un account Supabase di prova e una chiave
   Anthropic live). Prossimi passi possibili, da valutare con Gianardi
   quando servirà: eseguire `eval/live-check.js` contro un vero deploy,
   il Communication Hub multi-canale (già annotato sopra, progetto a
   sé), o tornare su uno dei limiti appena elencati.

## EON intelligente: promemoria e avvisi veri, all'ora giusta

**Fatte le prime tre parti di "rendere EON intelligente", il 31/08/2026**
(appunti a voce, riconoscimento nomi con errori, vera conversazione — vedi i
commit del giorno). Resta questa, la più grande delle quattro dal punto di
vista tecnico, volutamente lasciata per dopo.

Oggi un impegno segnato in calendario resta lì finché non apri l'app e lo
guardi — non arriva NULLA da solo all'ora giusta. Serve un vero avviso che
squilli da solo (anche ad app chiusa) quando arriva il momento, con il
pulsante pronto per chiamare quando è una telefonata. Esempi concreti
richiesti:
1. "Ricordami oggi di chiamare Fabbri alle 15:00" → un avviso vero alle 15:00.
2. "Ricordami che devo chiamare Dosi alle 17" → un avviso alle 17, con il
   tasto già pronto per avviare la chiamata.

Tecnicamente serve:
- **Notifiche push vere**, non solo un toast quando l'app è aperta: un
  service worker, il permesso di notifica del browser, e la registrazione
  dell'abbonamento (subscription) alle notifiche per ogni utente.
- **Un "orologio" lato server**: Vercel da solo non tiene nulla sveglio in
  background — serve un cron/scheduler (es. Vercel Cron) che controlli
  periodicamente gli impegni imminenti e mandi la notifica al momento giusto.
- Il pulsante "chiama" dentro la notifica stessa, per le telefonate.

Richiesto da Gianardi il 31/08/2026.

## EON BRAIN, roadmap operativa verso la beta

Esecuzione della roadmap concordata con Gianardi il 02/09/2026 (diagnosi
dei 3 test reali su iPhone → revisione critica indipendente → rischi
architetturali → decisioni strategiche a 12 mesi → roadmap operativa),
un punto alla volta, in ordine.

**1.1 — Migrazioni mancanti applicate (02/09/2026).** Le due migrazioni
scritte in `supabase/*.sql` ma mai eseguite in produzione sono state
applicate: `cantiere_foto.client_id` (colonna + indice) e l'intera
tabella `ai_request_log` (con RLS, `select` solo del proprio owner).
Verificate contro lo schema reale via `information_schema.columns`
dopo l'esecuzione — non solo l'esito `{"success":true}` della
migrazione stessa. Chiude la causa infrastrutturale del Test 3 (foto
del cantiere Fabbri) e sblocca l'osservabilità per-turno mai avuta
finora (punto 2.4 del roadmap, ancora da completare: query/dashboard
sopra questa tabella).

**1.3 — Gate di verifica schema (02/09/2026).** `eval/check-schema.js`
(vedi `eval/README.md`): confronta lo schema Supabase reale con il
contratto tabelle/colonne che il codice presuppone, usando lo stesso
meccanismo REST già usato da `db()` in `api/index.js` — nessuna
dipendenza nuova. Nato dal fatto, non dall'ipotesi, che due migrazioni
scritte non fossero mai state applicate senza che nulla lo segnalasse.
**Non eseguibile in questo ambiente di sviluppo** (stesso blocco di
rete del sandbox già noto per `eval/live-check.js` — verificato con un
tentativo diretto, CONNECT respinto con 403): da eseguire da un
ambiente con accesso di rete reale, o integrato in CI (punto 3.1 del
roadmap, ancora da fare).

**1.4 — Checklist di composizione.** Per ogni PR che tocca uno dei
meccanismi trasversali elencati sotto, prima del merge rispondere
esplicitamente (nella descrizione della PR o nel commento di
revisione): *quali altri meccanismi trasversali già esistenti
potrebbero interagire con questa modifica, e l'interazione è stata
verificata — non solo la fase da sola?*

Meccanismi trasversali attuali (aggiornare questa lista quando se ne
aggiunge uno nuovo):
- IntentFrame (`interpreta_richiesta`: operazione/oggetto/entità)
- Entity Resolution (`risolviClienteDaNome`, `cliente_risolto`)
- Current Focus (`costruisciFocus`, `usa_focus_corrente`)
- Guardrail categoria risorsa/azione (in `proseguiAssistente`, blocca
  un tool "azione" quando l'intento dichiarato è "risorsa")
- Routing modello (Haiku/Sonnet: `puoRipiegarePerRete`, `nonSicuro`)
- Tool "risorsa" e fallback onesto (`recupera_foto_cantiere`,
  `recupera_documenti_cliente`, `capacita_non_disponibile`)

Nata dalla causa comune ai 3 bug reali di settembre 2026: ciascuno dei
6 punti precedenti era stato validato in isolamento (code-review, test
automatici, regressione) ma mai incrociato sistematicamente con quanto
già esisteva — questa checklist è il correttivo di processo, non di
codice.

**1.2 — Le 3 cause diagnosticate corrette (02/09/2026).** Applicata la
checklist appena scritta a sé stessa, sul serio: la prima stesura di
questo punto (2 giri di code-review) aveva già introdotto un secondo
gap di composizione, trovato dalla checklist stessa prima del merge,
non dopo. Correzioni finali:
- **Test 1** (domanda di parere che diventa promemoria): REGOLA
  PRINCIPALE nel system prompt ora esclude esplicitamente
  `operazione:"consulta"`. Aggiunto anche un secondo argine a livello
  di codice (`REGOLE_GUARDRAIL_AZIONE`, vedi sotto) — prima non ce
  n'era nessuno per questo caso, solo il testo del prompt, già
  dimostratosi insufficiente da solo. Guardia `!runId` sul nuovo
  argine: senza, avrebbe bloccato il turno di conferma in cui l'utente
  accetta l'offerta del parere ("ok, segnamelo") — trovato dal secondo
  giro di code-review, non da un test.
- **Test 2** (Entity Resolution non scatta quando l'entità dichiarata
  è la risorsa, es. "il preventivo di Rossi"): nuovo campo
  `entita.cliente_di_riferimento` in `interpreta_richiesta`, separato
  da `tipo`/`riferimento_esplicito` — cattura il cliente anche quando
  non è lui l'entità principale dichiarata. `costruisciFocus()` esteso
  di conseguenza (ramo di fallback quando manca un riferimento
  specifico alla risorsa ma c'è un cliente) — un gap trovato dal
  secondo giro di revisione: spostare il nome del cliente fuori da
  `riferimento_esplicito` lo toglieva anche dal Focus, che non
  conosceva ancora il nuovo campo.
- **Test 3** (`capacita_non_disponibile` non chiamato in modo coerente
  su un errore tecnico reale): l'errore che torna a Claude per un tool
  "risorsa" ora porta con sé l'istruzione di dichiarare il limite
  onestamente, invece di lasciarla solo nel prompt — ma **solo** per
  guasti REALI della query (nuovo campo `db_error`, impostato solo
  dentro `db()`), mai per errori di validazione applicativa o un "non
  trovato" legittimo: il primo giro di revisione aveva trovato che la
  versione iniziale applicava la nota a QUALSIASI errore di un tool
  risorsa, spingendo il modello a dichiarare un limite permanente
  anche per un id malformato o un cliente davvero inesistente.

Estratto anche `REGOLE_GUARDRAIL_AZIONE` (tabella condivisa per i
guardrail "risorsa" e "consulta", invece di due blocchi quasi
identici) e `dbFail()` (un solo punto che marca `db_error`, invece di
due copie) — entrambi trovati come duplicazione dal terzo giro di
revisione, prima che diventasse tre o quattro copie con la prossima
correzione.

3 nuovi casi in `eval/casi.json` (`brain-fix-01/02/03`, uno per test,
frasi diverse dagli originali) e 3 nuovi test puri in
`eval/backend.test.js` per il nuovo ramo di `costruisciFocus` — 18/18
verifiche automatiche passate, nessuna regressione.

**2.1 — Ambiente di staging (03/09/2026).** Il branching Supabase
richiede il piano Pro (~25€/mese + costo per branch); scelta invece
l'Opzione B, costo zero: un secondo progetto Supabase separato
(`eon-staging`, id `vdgpadukzoklkrrhrhtm`, stessa regione `eu-west-2`
della produzione), con lo schema ricostruito a mano dalle stesse
migrazioni `.sql` del repository (`ai_tools_schema.sql`,
`cestino_schema.sql`, `cantiere_schema.sql`,
`cantiere_foto_cliente_schema.sql`) più lo schema base, verificato
tabella per tabella contro la produzione. Nessun branching automatico:
è un ambiente ricostruito, non clonato, da tenere aggiornato a mano se
lo schema di produzione cambia ancora.

Collegato un secondo progetto Vercel separato (`eonbeckend-mx2t`, non
una variante Preview dello stesso progetto di produzione) con le
proprie variabili d'ambiente puntate sul progetto Supabase di staging.
Creato un utente Supabase Auth di prova (`test-eval@eon.local`, email
inventata, mai raggiungibile) dedicato esclusivamente alla suite di
valutazione.

Verificato end-to-end con una chiamata reale a
`POST /api?action=assistant` (autenticata con il token dell'utente di
prova): risposta corretta dell'assistente, a conferma che login,
database e chiamata all'AI funzionano tutti insieme sull'ambiente di
staging, completamente separato dalla produzione.

Due bug di configurazione trovati e corretti durante la verifica (non
del codice, dell'ambiente): `SUPABASE_SERVICE_ROLE_KEY` e
`ANTHROPIC_API_KEY` su Vercel avevano preso un carattere indesiderato
durante un copia-incolla da telefono, mandando in errore
rispettivamente la verifica utente e la chiamata a Claude. La seconda
chiave di Anthropic non è stata copiata dal progetto di produzione (i
valori "sensitive" di Vercel non si possono copiare tra progetti per
sicurezza): ne è stata creata una nuova, dedicata solo alla staging.

Non ancora eseguita in questa sessione la suite automatica vera e
propria (`eval/live-check.js`, tutti i casi di `eval/casi.json`) — solo
una verifica manuale puntuale ("ciao" → risposta corretta).

**2.2 — Prima esecuzione completa della suite dal vivo (03/09/2026).**
Il primo tentativo (35+ casi senza pausa) si è fermato a metà, bloccato
dal limite anti-abuso del backend (20 richieste/10 minuti) — non un
bug, il limite ha funzionato come previsto. Corretto con una seconda PR
(#61): pausa tra le richieste, ritentativo su sovraccarico Anthropic
(529), limite alzabile solo su staging con doppia conferma esplicita
(`eval/live-check.js`, `api/index.js`), più `eval/reset-staging.js`
(nuovo) per ripulire i dati accumulati dai run precedenti prima di ogni
prova. Con queste correzioni la suite è arrivata in fondo a tutti i 38
casi.

Risultato: **nessun bug bloccante, ma un'incoerenza di comportamento
reale trovata** — confrontando `intento-01` ("Domani vedo Mario alle 9,
segnalo" → crea l'impegno subito) con `robustezza-03` ("Alle 9 di
domani devo vedere Mario" → si ferma a chiedere se aggiungere Mario
come nuovo cliente prima di procedere): stessa identica situazione,
solo con le informazioni in ordine diverso, comportamento diverso. Il
caso `robustezza-03` è scritto apposta per verificare proprio questa
coerenza ("stesso risultato di intento-01 nonostante l'ordine diverso
delle informazioni") e ha trovato che manca. Non ancora corretto — da
affrontare come prossimo punto: probabilmente serve chiarire nel prompt
che creare un impegno non richiede mai di creare prima un cliente in
anagrafica (un impegno può esistere senza `cliente_id`).

Osservato anche, una volta, del testo inglese mescolato in una risposta
altrimenti in italiano ("Okay, so Mario non è ancora in anagrafica...")
— non riprodotto una seconda volta nello stesso run, da tenere
d'occhio ma non ancora abbastanza per dire se è sistematico.

Altri FAIL della suite non sono bug del prodotto ma limiti della suite
stessa, per ora non corretti:
- `intento-05` presuppone di proseguire la stessa conversazione di
  `intento-04` (lo dice il campo `note` del caso), ma `live-check.js`
  tratta ogni caso come una conversazione nuova — serve un meccanismo
  di concatenamento tra casi collegati, non ancora scritto.
- `no-invenzione-02` non ha un campo `input` (il caso stesso lo
  documenta: "difficile da innescare da una sola frase naturale") —
  non eseguibile da `live-check.js` così com'è.
- `brain-fix-03` (foto del cantiere) presupponeva foto già esistenti,
  cancellate dallo stesso `reset-staging.js` lanciato prima del run:
  la pulizia non semina dati di prova nuovi al posto di quelli tolti.

**2.3 — Lettura manuale dei casi "manuale" (03/09/2026).** Letti a mano
tutti i 16 casi che `eval/live-check.js` non può giudicare da solo.
6 corretti, 6 non giudicabili con certezza (precondizioni cancellate
dallo stesso `reset-staging.js`, stesso limite già annotato sopra per
`brain-fix-03`), e 3 pattern reali trovati e corretti (solo testo del
system prompt in `api/index.js`, nessuna modifica di logica):

- **Orario/tipo/titolo chiesti quando la regola dice di decidere da
  solo** — confermato da 3 casi indipendenti (`intento-03`,
  `robustezza-02`, `robustezza-04`). Causa: la frase "nel dubbio,
  chiedi" era scritta alla fine dell'intero paragrafo sull'orario,
  senza essere legata esplicitamente solo al caso "orario vago" —
  probabilmente contaminava anche il caso "nessun orario detto
  affatto". Reso esplicito il confine tra i due casi, e aggiunta la
  stessa regola di default sensato anche per tipo e titolo (prima
  esisteva solo per l'orario).
- **Riferimento implicito perso attraverso un turno scollegato** —
  confermato da 2 casi indipendenti (`brain-focus-01`,
  `brain-focus-02`): "mandalo/mandale" dopo un turno di mezzo
  scollegato non si ricollegava al turno precedente. La guida su
  `usa_focus_corrente` esisteva solo nella descrizione del parametro
  dello strumento, mai nel testo principale del prompt — aggiunto un
  esempio concreto che rispecchia la situazione osservata.
- **Tensione tra "procedi in silenzio" e "segnala il cliente nuovo"**
  (`brain-entity-01`, Edilverde Costruzioni) — discussa con Gianardi,
  non risolta scegliendo un'opzione a scapito dell'altra: un nome che
  sembra un cliente vero (azienda, nome e cognome completo) fa
  eseguire comunque l'azione, ma la risposta aggiunge una riga che lo
  segnala e offre di aggiungerlo, senza bloccare l'esecuzione —
  diverso da una persona citata di sfuggita con un nome di battesimo
  (resta silenzioso, comportamento del punto 2.2 per "vedere Mario").
  Un giro di code-review ha trovato e corretto un'imprecisione: la
  frase citava solo "impegno", non copriva lo stesso caso per un
  appunto (`crea_appunto`).

Non ancora rieseguita la suite completa dopo queste correzioni (verifica
puntuale sì, con la frase esatta di `robustezza-03`: confermato che ora
procede subito senza fermarsi).

**3.1 — `check-schema.js` eseguito contro un ambiente reale, prima
volta in assoluto (03/09/2026).** `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
puntati sullo staging: **11/11 tabelle verificate, schema conforme al
contratto**. Conferma che lo schema di staging (ricostruito a mano al
punto 2.1) corrisponde esattamente a quanto il codice presuppone —
buon segnale anche per la produzione, che condivide lo stesso schema.
Non ancora collegato al processo di deploy (resta da fare: farlo
girare in automatico prima di ogni pubblicazione, non solo a mano).

**2.4 — Pagina "Registro AI" (03/09/2026).** Nuova schermata di sola
lettura in `index.html` (Menu → Registro AI): le ultime 50 richieste
fatte all'assistente, con messaggio, modello, durata, esito e strumenti
chiamati — legge direttamente `ai_request_log` via Supabase (RLS già
pronta), stesso pattern delle altre pagine di sola lettura dell'app.
Testata dal vivo con Playwright/Chromium (non solo letta): il test ha
fatto emergere un bug reale prima del commit — una funzione nuova
(`formattaDurata`) veniva sovrascritta in silenzio da una omonima già
esistente altrove nel file (durata dei messaggi vocali, secondi non
millisecondi) — corretto rinominandola (`formattaDurataMs`).

Con questo, tutti i punti aperti del roadmap operativa del 02/09/2026
sono completi (1.1-1.4, 2.1-2.4, 3.1). Resta aperto solo un dettaglio
minore già annotato al punto 3.1: collegare `check-schema.js` al
processo di deploy in automatico (per ora va lanciato a mano). Il
prossimo pezzo grande, tenuto volutamente separato per la sua
dimensione, è il **Communication Hub multi-canale** (email, WhatsApp —
vedi sezione "EON BRAIN: il motore centrale di orchestrazione", punto 7).

## Il "libro" dei professionisti — grande catalogo per la Evaluation Suite

Idea di Gianardi (03/09/2026), discussa insieme: invece di scoprire i
problemi di EON un po' alla volta durante l'uso reale (settimane/mesi),
fare uno sforzo sistematico e grande in un colpo solo, PRIMA di
esporre EON a clienti veri. In due pezzi:

1. **Creare il libro**: una raccolta ampia di comportamenti e richieste
   realistiche, un capitolo per tipo di professionista (edile,
   idraulico, elettricista, amministratore di condominio — gli stessi
   dell'onboarding dell'app): cosa chiedono, cosa vogliono, come lo
   dicono. Non frasi esatte da riconoscere: situazioni, come già fa
   `eval/casi.json` ma su scala molto più ampia.
2. **Creare il libro di istruzioni per i test**: dal libro sopra,
   derivare tanti nuovi casi per la Evaluation Suite (stesso formato di
   `eval/casi.json`), poi farli girare tutti su `eval/live-check.js`
   contro l'ambiente di staging, come fatto oggi per il punto 2.3 — e
   correggere ogni pattern reale trovato.

**Importante, chiarito insieme**: il libro NON entra nel prompt di EON
per intero (lo rallenterebbe e rischierebbe di introdurre regole in
conflitto tra loro, visto oggi con una singola frase ambigua) — resta
uno strumento nostro, dietro le quinte. Solo le correzioni vere che
emergono dai test (poche righe mirate, come le 3 di oggi) finiscono
nel prompt — lo stesso metodo di oggi, applicato su scala grande
invece che su 3 correzioni isolate.

**Divisione del lavoro concordata**:
1. Gianardi scrive una breve lista di partenza — esperienza vera sua
   come professionista, cosa chiede/vuole/come parla lui e i colleghi
   del settore.
2. Claude la espande in un catalogo più ampio, usando la conoscenza
   generale su questi mestieri (non dati specifici, vedi sopra — un
   buon punto di partenza, da verificare poi con l'uso reale).
3. Insieme si trasforma in casi per la Evaluation Suite (formato
   `eval/casi.json`), si testano, e le correzioni vere finiscono nel
   prompt di EON in poche righe mirate — mai il libro intero.

**In corso**: prima bozza scritta (`libro/edile.md`, su richiesta di
Gianardi la sera del 03/09/2026, mentre lui si riposava) — capitolo
Edile, conoscenza generale di Claude, ancora da correggere/completare
con l'esperienza vera di Gianardi prima di derivarne casi per la
Evaluation Suite. Mancano ancora i capitoli Idraulico, Elettricista,
Amministratore di Condominio (gli altri tre mestieri dell'onboarding).

**Aggiornamento stesso giorno**: Gianardi ha portato una consulenza
fatta con ChatGPT (OpenAI) che definisce una struttura più rigorosa per
i Professional Brain Pack — salvata in
`libro/professional-brain-pack-metodo.md`. Struttura in 12 sezioni
(A-L): identità, giornata, mondo professionale, **oggetti del
mestiere**, **relazioni tra oggetti**, **processi** (ciclo di vita di
un lavoro), linguaggio, intenzioni professionali (mappate sulle
operazioni già esistenti in `interpreta_richiesta`, non nuove
categorie), **comportamento EON per categoria** (non solo cosa chiede
il professionista, ma come BRAIN deve ragionare/cercare/chiedere/agire
— la parte che mancava di più nella prima bozza), situazioni limite,
divieti, casi di valutazione. `libro/edile.md` riscritto secondo questa
struttura lo stesso giorno.

**Ulteriore aggiornamento stesso giorno**: capitolo Edile ampliato
ancora, usando bozza originale + metodo + conoscenza generale di Claude
+ discussione qui. Aggiunti: modello cognitivo dell'edile, ontologia a
25 entità, grafo delle relazioni, modulo WhatsApp, modello di priorità,
catalogo errori critici, sezione L espansa a 35 casi. Gianardi ha
mostrato due prompt di Copilot che chiedevano numeri fissi enormi
(1100+ casi, 300 intenti) — deliberatamente NON seguiti (contraddicono
il principio "qualità prima di quantità" dello stesso metodo
ChatGPT); adottate solo le idee strutturali buone di quei documenti.

**Tre lotti di casi plausibili integrati (03/09/2026)**: Gianardi ha
portato 3 lotti da 50 casi ciascuno (150 totali), costruiti con un
altro strumento AI, esplicitamente etichettati come plausibili/non
verificati. Da ogni lotto sono state estratte solo le voci
genuinamente nuove (13, 14, 14 — le altre erano già coperte) e
integrate in `libro/edile.md`; i lotti originali restano come fonte in
`libro/casi-lotto{1,2,3}-copilot.md`. Il capitolo Edile è arrivato a
72 casi in sezione L e mostra segnali di saturazione (il lotto 3 aveva
più ripetizioni che novità) — considerato pronto per una prima
validazione con esperienza reale, fermato lì su decisione di Gianardi.

**Decisione di sequenza (03/09/2026, idea di Gianardi)**: prima di
scrivere gli altri capitoli, creare uno **strato comune** — un
Professional Brain Pack condiviso da chiunque usi EON, non solo
artigiani/professionisti (~150 casi pratici trasversali). Motivo:
molto di quanto scritto nel capitolo Edile in realtà non è specifico
dell'edile (omonimi, conferma prima di comunicare, autocorrezione
vocale, cortesia vs impegno formale, privacy, stato provvisorio...) —
corrisponde alla formula del metodo (BRAIN CORE + Pack + dati utente).

**Correzione importante di Gianardi (stesso giorno, da ricordare
sempre)**: lo strato comune va scritto **da zero, senza guardare
`libro/edile.md`** — non estratto da lì. Motivo: rischio di
contaminazione, lo strato "comune" erediterebbe involontariamente il
taglio/le assunzioni specifiche dell'edile spacciate per universali.

**Metodo di insegnamento a EON confermato con Gianardi (stesso
giorno)**: l'obiettivo è che EON sappia sempre come comportarsi, non
solo poche correzioni isolate — ma non tramite copia letterale del
libro nel prompt (rischio di regole in conflitto tra loro, come visto
oggi nel bug orario/tipo/titolo). Metodo concordato: da ogni gruppo di
casi simili si estrae il PRINCIPIO generale che li spiega tutti (non i
singoli casi letterali) — sono i principi, generalizzabili anche a
casi mai visti, a entrare nel prompt, e solo dopo essere stati testati
per verificare che non si contraddicano tra loro. Così facendo il
libro intero viene insegnato a EON, ma come regole generali verificate,
non come testo grezzo.

**Ordine deciso**:
1. **Strato comune** (`libro/comune.md`, da creare da zero) — ~150
   casi trasversali, validi per qualunque persona, non solo
   professionisti.
2. **Capitoli specifici per professione**, solo ciò che è davvero
   specifico (ontologia, linguaggio, scenari di mestiere) — **Edile**
   già fatto. **Elenco finale delle 4 professioni di partenza,
   confermato da Gianardi il 05/09/2026 (sostituisce ogni versione
   precedente, incluso il cambio del 03/09/2026 sotto)**: **Edile**,
   **Idraulico**, **Amministratore di condominio**, **Avvocato**.
   L'Elettricista, presente nell'onboarding fino ad oggi, non è più fra
   le prime 4 — rimosso anche dalle card di iscrizione (vedi sotto).
3. **Insegnare a EON BRAIN**: estrarre i principi generali dallo strato
   comune + capitoli professione, aggiungerli al prompt di sistema.
4. **Testing**: verificare i principi con `eval/live-check.js` contro
   staging, correggere conflitti trovati.
5. Poi **Communication Hub multi-canale**.

**Primo gruppo insegnato a EON (04/09/2026)**: fatto l'audit di cosa
EON copre già (Entity Resolution, Focus, conferma reale per azioni
delicate) vs cosa manca — 4 gap reali trovati (linguaggio di impegno,
privacy/destinatari, freschezza delle fonti, conferme su proposte
aperte). Iniziato dal primo gruppo, il più autonomo: **linguaggio di
impegno** — cortesia non è impegno, stato provvisorio va mantenuto
tale, pianificazione condizionale conservata nell'impegno, clausola di
riserva mantenuta in un messaggio inviato, minimizzazione linguistica
non riduce un impegno reale comunicato a terzi. Aggiunto un paragrafo
al system prompt (`api/index.js`, dopo le regole su `manda_messaggio`)
e 5 nuovi casi in `eval/casi.json` (`brain-comune-01..05`). Verificato
`node --check` e `eval/backend.test.js` (18/18, nessuna regressione).
**Tutti e 4 i gruppi scritti (04/09/2026)**: completati anche gli
altri tre, stesso metodo (principi generali estratti da
`libro/comune.md`, non testo grezzo):
- **Privacy/destinatari**: un giudizio su un cliente detto nella
  conversazione non finisce mai nel messaggio inviato a lui; dato
  sensibile personale collegato a un cliente "simile" (non "trovato")
  richiede conferma extra dell'identità.
- **Freschezza delle fonti**: un fatto più recente detto dall'utente
  (es. un pagamento già avvenuto) prevale su un dato esistente non
  ancora aggiornato; l'assenza di documentazione non è prova che
  qualcosa non sia successo.
- **Conferme su proposte aperte**: una conferma breve e generica dopo
  che EON ha presentato più opzioni va chiarita, non risolta a caso.

9 nuovi casi in totale in `eval/casi.json` (`brain-comune-01..09`,
47 casi totali nel file). `node --check` e `eval/backend.test.js`
(18/18) verificati dopo ogni gruppo, nessuna regressione.

**Verificato dal vivo su staging (04-05/09/2026)**: Gianardi ha
lanciato `eval/live-check.js` dal proprio Mac contro un deploy Preview
del branch (Vercel richiedeva login per le anteprime — disattivato
temporaneamente "Vercel Authentication" sul progetto di staging, e
aggiunto "Preview" come ambiente alle 7 variabili d'ambiente che
c'erano solo per "Production"). Il run del 04/09 si è fermato a metà
per credito Anthropic esaurito (tutti i 9 casi `brain-comune-*`, cioè
proprio quelli che testano il lavoro nuovo, non erano stati eseguiti
davvero) — ricaricato il credito e rieseguito il 05/09.

**Risultato pulito e completo**: 8 dei 9 casi `brain-comune-01..08`
verificati e corretti (cortesia≠impegno, stato provvisorio, condizione
conservata, riserva "salvo imprevisti" mantenuta nel messaggio, prezzo
comunicato senza essere minimizzato, giudizio su un cliente mai nel
messaggio a lui, dato sensibile su cliente "simile" → chiede conferma
citando esplicitamente "dato sensibile di natura personale"). Il 9°
(`brain-comune-09`) non è testabile con questo strumento (richiede
continuità di conversazione). Caso 08 (pagamento già ricevuto): EON ha
usato crea_appunto come miglior ripiego — scoperto che **non esiste
ancora un tool per registrare un pagamento ricevuto/aggiornare lo stato
di un pagamento**, quindi il comportamento osservato è già il massimo
possibile con gli strumenti attuali (eventuale gap futuro, non di oggi).
Nessun bug reale trovato nei 4 gruppi insegnati.

Aggiunta la possibilità di rilanciare solo alcuni casi
(`EVAL_SOLO=id1,id2,...` in `eval/live-check.js`) per risparmiare
tempo/credito nei prossimi round — usata oggi stesso per riverificare
04-07 dopo aver riseminato via Supabase MCP i clienti di test cancellati
dal reset.

**Nuovo strumento aggiunto (05/09/2026): incassi.** Dal gap trovato con
il caso `brain-comune-08` (EON non aveva modo di segnare un pagamento
ricevuto) — su richiesta di Gianardi ("aggiungiamo il tool pagamenti:
chi ha pagato e chi non ha pagato"). Non serviva una tabella nuova: la
tabella `incomes` (già usata dalla pagina "Entrate" dell'app, stati
`attesa`/`scaduto`/`incassato`) non aveva ancora strumenti AI dedicati.
Aggiunti in `api/index.js`:
- `mostra_incassi` (lettura) — chi deve ancora pagare, filtrabile per
  cliente, `tutti:true` per includere anche i già incassati
- `segna_incasso_ricevuto` (scrittura) — aggiorna un incasso in sospeso
  esistente a "incassato", oppure ne crea uno nuovo già incassato se il
  pagamento non era mai stato fatturato prima (contanti/bonifico
  diretto) — richiede l'importo solo in questo secondo caso

Aggiornato `brain-comune-08` (ora verifica automatica sul tool vero) e
aggiunti `brain-pagamenti-01/02` in `eval/casi.json` (49 casi totali).
`node --check` e `backend.test.js` (18/18) verificati. **Da testare dal
vivo**: serve un nuovo deploy Preview (il codice è cambiato) e clienti
di prova con un incasso in sospeso — non ancora fatto in questa sessione.

Nota per la prossima volta: pulizia dati fatta direttamente da Claude
via Supabase MCP (senza bisogno della service_role key sul Terminal)
— molto più semplice, da preferire se disponibile.

**Chiarimento importante (04/09/2026)**: lo strato comune è stato
scritto E insegnato a EON (4 gruppi, testati oggi). Il capitolo
**Edile ha solo il libro scritto (72 casi)**, non ancora insegnato a
EON con lo stesso procedimento — l'edile non è avanti sull'insegnamento,
solo sulla scrittura del libro.

**Prossimi passi, in ordine**:
1. **Insegnare l'edile a EON** — stesso metodo di ieri: audit di cosa
   è già coperto dallo strato comune, estrarre principi genuinamente
   specifici dell'edile, aggiungerli al prompt a piccoli gruppi
   testati, uno alla volta. **Gruppo 1 fatto (05/09/2026)**: fornitore/
   subappaltatore mai trattato come cliente + glossario di settore
   (SAL, capitolato, massetto, tondino, cls, varianti regionali) da
   riconoscere senza correggere in silenzio se il microfono lo sente
   male. 2 nuovi casi in `eval/casi.json` (`edile-01`, `edile-02`, 51
   totali). Testato dal vivo su staging il 05/09/2026 (vedi sotto),
   nessun bug reale trovato. **Gruppo 2 fatto (05/09/2026)**:
   continuità d'identità — cliente che cambia cognome (es. matrimonio)
   o fornitore che cambia ragione sociale → `aggiorna_cliente`, mai
   `crea_cliente` (eviterebbe un doppione), quando ci sono elementi
   sufficienti per riconoscerlo; altrimenti chiedere conferma. Caso
   `edile-03` aggiunto (52 totali). Gruppo 3 (collegamento certo di
   foto/documenti/pagamenti al cantiere giusto) non ancora iniziato.

   **Architettura per professione — fatto (05/09/2026)**: risolta la
   nota di sotto. `profiles.profession` (già esistente, già salvata/
   letta dal frontend) viene ora letta anche dal backend
   (`handleAssistant` in `api/index.js`, subito dopo aver risolto
   l'utente) e passata a `systemPromptAssistente(professione)`. Il
   glossario tecnico edile (SAL, capitolato, massetto, cartongesso,
   subappalto, cls, tondino, varianti regionali) è stato estratto in
   una funzione a parte, `promptPackEdile()`, aggiunta al prompt SOLO
   quando `professione === "edile"` — il primo "Professional Brain
   Pack" specifico di mestiere, secondo l'architettura BRAIN CORE +
   Pack descritta più sotto. Le altre due regole del Gruppo 1/2
   (fornitore mai cliente, continuità d'identità su rinomina) sono
   invece rimaste nello strato comune: sono utili a qualunque
   professionista con fornitori o clienti che cambiano nome, non solo
   all'edile, quindi non è corretto renderle un pack a parte. Un
   fallimento nel leggere `profession` (tabella irraggiungibile, ecc.)
   non blocca mai il turno: EON resta utilizzabile, semplicemente senza
   il pack specifico quel turno.

   Aggiunta anche una 5ª card di iscrizione in `index.html`
   (`data-profession="artigiano"`, etichetta "Altro / Generico"),
   così chi non fa uno dei 4 mestieri con pack dedicato ha comunque
   un'opzione esplicita in fase di iscrizione — usa il dataset demo
   `professionData.artigiano` già esistente (già generico/misto),
   nessuna nuova voce di dati serviva. Verificato con `node --check
   api/index.js`, `node eval/backend.test.js` (18/18) e un controllo
   di sintassi dello script inline di `index.html`. **Testato dal vivo
   su staging il 05/09/2026**: con `profession: "artigiano"` (pack
   spento), `edile-02`/`edile-03` passano comunque (la conoscenza
   generale del modello e lo strato comune bastano), `edile-01` è
   corretto nella sostanza (il fornitore non viene mai cercato/creato
   come cliente, `focus.tipo: "fornitore"`) ma il controllo automatico
   segna FAIL perché "richiama" attiva la regola preesistente
   sull'operazione "contatta" (si ferma onestamente con
   `capacita_non_disponibile` invece di creare subito un impegno) — non
   un bug, un test scritto in modo troppo rigido. Con `profession:
   "edile"` (pack acceso), tutti e 3 passano, incluso `edile-01`
   nell'automatico. Pack confermato funzionante e collegato. (Nota per
   chi rilancia questi casi in futuro: `edile-03` modifica per davvero
   il cliente — dopo un primo lancio riuscito "Laura Rossi" diventa
   "Laura Verdi", quindi un secondo lancio senza reseed non ritrova più
   "Laura Rossi" e chiede conferma invece di fallire — comportamento
   corretto, non un bug, ma va ri-seedato il cliente prima di ogni
   nuovo lancio pulito.)

   **Bug reale trovato durante questo test, non legato al pack**: il
   vincolo del database su `profiles.profession` accettava solo
   `artigiano, amministratore, avvocato, consulente` — **non**
   `edile`/`idraulico`, cioè due dei quattro mestieri offerti
   dall'iscrizione. Chi si fosse iscritto scegliendo Edile o Idraulico
   sarebbe silenziosamente rimasto "artigiano" (il salvataggio falliva,
   ma `index.html` non controllava l'errore di quella chiamata). Mai
   emerso prima perché i soli utenti reali finora (2 in produzione, 1 di
   prova in staging) sono tutti "artigiano". **Corretto lo stesso
   giorno**: vincolo allargato su staging (ora accetta anche
   `edile`/`idraulico`); `index.html` ora controlla davvero l'errore di
   quel salvataggio (lo rilancia invece di ignorarlo) e passa la
   professione anche nei metadati di `signUp` (così il trigger
   `handle_new_user` la imposta già correttamente al primo inserimento,
   non solo nell'update successivo). **Stesso allargamento applicato
   anche in produzione il 05/09/2026**, con conferma esplicita di
   Gianardi ("facciamo quello che c'è da fare") — verificato che il
   vincolo ora accetta anche `edile`/`idraulico` in entrambi gli
   ambienti.
2. **Scrivere i libri** delle altre 3 professioni di partenza —
   **Idraulico**, **Amministratore di condominio**, **Avvocato** — non
   ancora iniziati. Ora che l'architettura a Pack esiste davvero, ognuno
   diventerà una propria `promptPackXxx()`, non altro testo nello
   strato comune.
3. **Insegnarli a EON** una volta scritti, stesso metodo.

**Ripresa dei lavori (17/09/2026)**, dopo una pausa di Gianardi.
Confermato con lui il metodo definitivo, per essere chiari una volta per
tutte: **conoscenza generale AI per ogni professione → insegnata e
testata a EON → se serve una funzione nuova la si costruisce →
validazione con esperienza reale è l'ULTIMO passo, quando il prodotto
va ai tester**, non durante la costruzione — a differenza di quanto
pensato in precedenza, non si valida ogni libro con esperienza reale
subito dopo averlo scritto. Importante: il "cervello generale" (strato
comune) NON cresce da solo — EON non impara dall'uso, non ha nessun
meccanismo di auto-aggiornamento. Cresce solo come effetto collaterale
deliberato del nostro processo: ogni volta che scriviamo il libro di una
professione e facciamo l'audit, troviamo principi che sono in realtà
generali e li aggiungiamo di proposito allo strato comune (come successo
con l'edile) — mai in automatico.

**Libro Idraulico — prima bozza scritta (17/09/2026)**: `libro/idraulico.md`,
stessa struttura e metodo dell'edile. Differenze principali dal mestiere
edile: lavora per interventi puntuali più che cantieri lunghi, urgenze
reali molto più frequenti (allagamenti, assenza di acqua/riscaldamento —
con la regola esplicita che l'odore di gas non è mai gestito come
intervento idraulico, va sempre indirizzato a chi di competenza),
manutenzioni programmate ricorrenti (caldaia), dichiarazione di
conformità solo per installazioni/modifiche sostanziali.

**Seconda bozza indipendente integrata lo stesso giorno**: Gianardi ha
chiesto anche a Claude chat (claude.ai) di scrivere una bozza per la
stessa professione, con un prompt basato sul metodo che gli ho preparato
io. Fonte completa in `libro/idraulico-claude-chat-lotto1.md`; solo le
voci genuinamente nuove integrate in `libro/idraulico.md` (non tutto in
blocco, stesso principio dei lotti Copilot/OpenAI per l'edile) — tra le
più significative: il furgone come ufficio mobile/magazzino la cui
organizzazione condiziona se un intervento si chiude in giornata, tre
soglie mentali per organizzare la giornata (urgenza/posizione/materiale
disponibile), il Contratto di manutenzione come entità distinta da una
singola manutenzione (con l'ambiguità che il cliente pensi copra anche i
guasti imprevisti), "fatturato non equivale a incassato", e tre divieti
forti aggiunti alla sezione K: mai suggerire di evitare la fatturazione
("lavoro in nero") nemmeno su richiesta del cliente, mai suggerire di
eseguire lavori che richiedono un'abilitazione diversa dalla propria
(es. opere elettriche collegate a una caldaia), mai dare una diagnosi
tecnica definitiva senza dati sufficienti.

**Nota per dopo**: i due divieti su "mai suggerire di non fatturare" e
"mai suggerire di eseguire lavori fuori dalla propria abilitazione"
sembrano principi generali (validi per qualunque professione — un
avvocato o un amministratore potrebbero ricevere richieste analoghe),
non specifici dell'idraulico. Per ora restano nel Pack idraulico dove
sono stati trovati; da valutare se spostarli nello strato comune quando
faremo il prossimo giro di audit generale (stesso pattern già visto con
l'edile: molto di quello che sembra specifico in realtà non lo è).

**Audit completato e insegnato a EON (17/09/2026)**: confrontato
`libro/idraulico.md` con strato comune + pack edile. La maggior parte era
già coperta (fornitore mai cliente, cerca_cantiere/crea_cantiere già
generalizzano bene a "immobile" anche per l'idraulico, no-invenzione,
ecc.). Aggiunto in `api/index.js`:
- **Allo strato comune** (`systemPromptAssistente`, non nel pack
  idraulico): i due principi identificati come generali nella nota sopra
  — mai suggerire/assecondare di evitare la fatturazione anche su
  richiesta del cliente; mai suggerire di eseguire un lavoro che richiede
  un'abilitazione diversa dalla propria professione, aiutare invece a
  coordinarsi con il tecnico giusto.
- **Nuova `promptPackIdraulico()`**, attivata quando
  `profiles.profession === "idraulico"`, con le 5 cose genuinamente
  specifiche trovate nell'audit: (1) modello di priorità idraulico —
  urgenza vera vs percepita, con la regola esplicita che un odore di gas
  non va MAI gestito come intervento idraulico ordinario (chiudere il gas
  e chiamare il pronto intervento gas, non programmare un passaggio);
  (2) promemoria automatico (`crea_impegno`) per la prossima manutenzione
  caldaia quando se ne registra una fatta, con aggiornamento
  (`sposta_impegno`) se il cliente la rimanda invece di duplicarlo;
  (3) glossario tecnico per la dettatura vocale (caldaia, scaldabagno,
  autoclave, sifone, guarnizione, rubinetteria, valvola, raccordo, spurgo,
  tenuta, "va in blocco/errore", "tarare la caldaia", lavoro a corpo vs a
  misura); (4) dichiarazione di conformità rilevante solo per
  installazioni/modifiche sostanziali, mai per una semplice riparazione;
  (5) contestazione di un lavoro già fatturato — EON non prende
  posizione, aiuta solo a ricostruire lo storico.

Aggiunti 7 nuovi casi a `eval/casi.json`: `brain-comune-27`/`28` per i
due principi generali, `idraulico-01..05` per il pack specifico.
`node --check api/index.js` e `eval/backend.test.js` confermano nessuna
regressione (18/18). Il terzo divieto della nota sopra ("mai dare una
diagnosi tecnica definitiva senza dati sufficienti") non è stato
insegnato a parte: è già coperto dal principio generale esistente di
non inventare mai dati non forniti dall'utente.

**Live-check su staging completato (17/09/2026), pack Idraulico confermato
funzionante.** Prima di partire, scoperto che sia il progetto Supabase di
staging sia quello di produzione erano in pausa (stato "INACTIVE") per
inattività durante la vacanza di Gianardi — ripristinati entrambi
(`mcp__Supabase__restore_project`); questo significa che l'app reale non
ha funzionato per nessun utente durante quei giorni, da tenere a mente
per il futuro (magari un controllo periodico, o capire se Supabase offre
un piano che non mette in pausa i progetti attivi).

Impostato `profiles.profession = 'idraulico'` sull'utente di test in
staging, creato un cliente di prova "Longhi" per la precondizione di
`idraulico-05`, e guidato Gianardi (passo-passo nel Terminale, con
qualche inciampo per via di una cartella locale scaricata dal branch
sbagliato — risolto scaricando lo ZIP del branch giusto da GitHub) nel
lanciare `eval/live-check.js` con i 7 casi nuovi.

Trovato un bug reale al primo giro: il promemoria per la manutenzione
caldaia veniva datato per OGGI invece che per l'anno prossimo (l'istruzione
originale non era abbastanza esplicita/meccanica). Corretto il testo del
pack (due iterazioni, commit separati) rendendo il calcolo della data
esplicito ("stesso giorno e mese, anno successivo"). Verificato
direttamente sul database di staging (colonna `scheduled_at`, non solo il
campo `time` mostrato a schermo che non include mai l'anno) che il
promemoria creato è davvero datato un anno dopo — confermato corretto.
Migliorato anche il caso `idraulico-03` (testava per errore
l'auto-correzione invece dell'ambiguità di dettatura) durante il giro.

**Risultato finale: tutti e 7 i casi nuovi passano** (brain-comune-27/28,
idraulico-01..05). Pack Idraulico considerato insegnato e testato, stesso
livello di affidabilità del pack Edile.

**Libro Amministratore di condominio — prima bozza scritta (17/09/2026)**:
`libro/amministratore.md`, stessa struttura e metodo di edile/idraulico.
Differenza principale dalle professioni precedenti: non un cliente/lavoro
alla volta, ma molti condomini gestiti in parallelo, ciascuno con molte
persone al suo interno; spese ripartite per millesimi; decisione
collettiva (delibera) invece che individuale; dati sensibili (morosità)
da non condividere tra condomini dello stesso edificio; l'amministratore
coordina i fornitori ma non esegue mai lavori tecnici di persona.

**Seconda bozza indipendente integrata lo stesso giorno**: stesso
processo dell'idraulico — Gianardi ha chiesto a Claude chat una bozza con
lo stesso prompt basato sul metodo. Fonte completa in
`libro/amministratore-claude-chat-lotto1.md`; solo le voci genuinamente
nuove integrate in `libro/amministratore.md`, tra le più significative:
l'amministratore "coordina, non esegue" i lavori tecnici; un quarto
fattore di priorità oltre a urgenza/scadenze — la sensibilità relazionale
(condomini con tensioni interne meritano più cura comunicativa); il
subentro tra amministratori (passaggio di consegne dello storico, non
solo il subentro di un nuovo proprietario); lo storico di spese/morosità
di un'unità resta legato al proprietario del periodo in cui è maturato,
non passa automaticamente al nuovo proprietario; il concetto di delibera
"impugnata"; la coppia ad alto rischio fonetico "consuntivo"/"preventivo"
(termini opposti); "tenere traccia di una decisione" come intenzione
esplicita; il caso di un dipendente del condominio (portiere) infortunato,
che comporta implicazioni da datore di lavoro diverse da un guasto
tecnico; il principio generale del "raggio di visibilità" delle
informazioni (chi ha diritto a saperlo, prima di decidere come
comunicarlo) e il tono più formale/documentato richiesto dalle
comunicazioni condominiali rispetto a un messaggio a un cliente singolo.

**Audit completato — trovata una lacuna architetturale, non solo di
prompt (17/09/2026).** A differenza di edile e idraulico, la parte più
importante del mestiere (un condominio con MOLTE persone dentro, spese
ripartite, dati di morosità da non condividere tra condomini) richiedeva
un'entità che EON non aveva affatto: un "cliente" nel database è sempre
una singola entità. Chiesto a Gianardi come procedere (AskUserQuestion):
ha scelto di costruire l'entità subito, invece di rimandare tutto a "non
applicabile" come per una decina di voci del libro edile.

**Entità Condomini costruita e insegnata.** Scelta di modello: il
Condominio (l'edificio) NON è una tabella nuova — resta semplicemente un
Cliente esistente (`clients`), quindi crea_cliente/cerca_cliente/
cliente_risolto funzionano già per l'edificio senza alcuna modifica. Solo
le PERSONE al suo interno mancavano: nuova tabella `condomini` (owner_id,
client_id, nome, ruolo proprietario/inquilino, unita_immobiliare,
quota_millesimale, telefono, morosita_importo, morosita_da), migrazione
`supabase/condomini_entita_schema.sql`, applicata su staging. Tre nuovi
strumenti: `cerca_condomino` (cerca una persona, in un condominio
specifico o in tutti — restituisce anche il nome del condominio di
ciascun risultato per disambiguare), `crea_condomino`, e
`mostra_morosita_condominio` (solo per uso proprio dell'amministratore,
mai da inoltrare a un altro condomino).

**Nuova `promptPackAmministratore()`**, attivata per
`profiles.profession === "amministratore"` (valore già ammesso dal
vincolo esistente, non serve nessuna modifica al database per questo).
Contenuto: (1) la distinzione chiave — un nome di persona è quasi sempre
un condomino (cerca_condomino), un indirizzo/nome di edificio è il
cliente (cerca_cliente), mai confonderli; se lo stesso condomino esiste
in più condomini diversi, è un'ambiguità vera da chiedere; (2)
"coordina, non esegue" — mai proporre che l'utente risolva di persona un
problema tecnico; (3) riservatezza della morosità tra condomini, mai nel
testo di un manda_messaggio ad altri; comunicazione collettiva = messaggio
al cliente_id del condominio, comunicazione a un singolo condomino = EON
non ha oggi un canale diretto, dichiararlo onestamente; (4) spesa
straordinaria mai trattata come autorizzata senza una delibera reale
menzionata dall'utente; (5) mai inventare quote millesimali o dati
economici mancanti; mai prendere posizione in una disputa tra condomini;
mai dare una risposta legale netta su "serve una delibera?"; (6)
glossario con la coppia ad alto rischio fonetico consuntivo/preventivo
(termini opposti).

Aggiunti 7 nuovi casi a `eval/casi.json` (`amministratore-01..07`) e la
tabella `condomini` al contratto di `eval/check-schema.js`. `node --check`
e `eval/backend.test.js` confermano nessuna regressione (18/18).

**Non ancora costruito, deliberatamente fuori scope per ora** (come le
voci "non applicabile" del libro edile): delibere/assemblee come entità
proprie, spese con ripartizione automatica per millesimi, fondo cassa/
fondo lavori, rendiconto. Il pack insegna i PRINCIPI comportamentali
corrispondenti (mai trattare una spesa come autorizzata senza delibera,
mai inventare importi) senza bisogno di modellare quelle entità — se
l'esperienza reale mostrerà che serve tracciarle davvero, si costruirà
allora.

**Live-check su staging completato (17/09/2026), pack Amministratore
confermato funzionante.** Impostato `profiles.profession = 'amministratore'`
sull'utente di test, seminati due condomini/clienti ("Condominio via Roma
12" e "Condominio via Torino 5") con condomini dentro (Marco Bianchi, Luca
Ferri duplicato in entrambi come omonimo voluto, Anna Colombo morosa).

Trovato un bug reale al primo giro: nel caso dell'omonimo (`amministratore-02`,
"Luca Ferri" presente in due condomini), EON ignorava del tutto
`cerca_condomino` e proponeva di aggiungerlo come **nuovo cliente** —
esattamente l'errore che il pack doveva prevenire. Causa: `cliente_risolto`
(da `interpreta_richiesta`) cerca solo tra gli edifici, e il suo
"non_trovato" per un nome di persona veniva interpretato come "la persona
non esiste", innescando la regola comune su clienti mai trovati. Corretto
rendendo esplicita la sequenza operativa: sempre `cerca_condomino` PRIMA
di considerare `crea_cliente`/chiedere se aggiungere un nuovo cliente,
indipendentemente da cosa dice `cliente_risolto`. Ritestato: ora trova
correttamente entrambi i Luca Ferri e chiede quale dei due (`amministratore-01`
ora usa anche `cerca_condomino` per collegare l'impegno al condominio
giusto, cosa che al primo giro non faceva pur non sbagliando).

**Risultato finale: tutti e 7 i casi passano** (amministratore-01..07).
Pack Amministratore di condominio considerato insegnato e testato, stesso
livello di affidabilità di edile e idraulico — inclusa la parte più
delicata (riservatezza morosità, spesa senza delibera, entità Condomini
nuova).

**Libro Avvocato scritto, integrato e insegnato a EON (17/09/2026)**:
`libro/avvocato.md`, stessa struttura di edile/idraulico/amministratore.
Seconda bozza indipendente da Claude chat integrata lo stesso giorno
(fonte in `libro/avvocato-claude-chat-lotto1.md`): canale PEC distinto,
valore probatorio della forma/canale di comunicazione, mai scegliere tra
fonti in conflitto su una data (segnalare, mai decidere), riservatezza
estesa alla sola esistenza di una pratica.

**Audit — a differenza dell'amministratore, nessuna nuova tabella
necessaria.** Il concetto di "pratica" (un cliente con più fascicoli
indipendenti) è esattamente lo stesso problema già risolto dai Cantieri
per l'edile: `cerca_cantiere`/`crea_cantiere` sono stati riusati così come
sono, semplicemente reinterpretando "cantiere" come "pratica" nel pack —
nessuna modifica al database o al codice dei due strumenti.

**Nuova `promptPackAvvocato()`**: (1) pratica ambigua → verificare con
cerca_cantiere prima di agire, riservatezza estesa anche alla sola
esistenza di una pratica; (2) controparte mai trattata come cliente,
anche se la stessa persona è cliente in un'altra pratica dello studio;
(3) mai contattare direttamente una controparte senza sapere se è
assistita da un legale; (4) scadenza processuale mai calcolata/stimata da
EON, solo registrata se già data esplicitamente — e mai scegliere tra
fonti in conflitto sulla stessa data; (5) **eccezione esplicita** alla
regola generale sui pareri (altrove nel prompt EON è istruito a dare un
parere reale quando chiesto): per un giudizio legale di merito questa
regola NON si applica, mai un parere di EON; (6) rispettare il canale di
comunicazione richiesto (es. PEC), non appiattirlo in un invio generico;
(7) glossario perentorio/ordinatorio, prescrizione/decadenza.

Aggiunti 8 nuovi casi a `eval/casi.json` (`avvocato-01..08`). `node
--check` e `eval/backend.test.js` confermano nessuna regressione (18/18).

**Live-check su staging completato (17/09/2026), pack Avvocato confermato
funzionante.** Impostato `profiles.profession = 'avvocato'` sull'utente di
test, seminato il cliente "Mario Rossi" con due pratiche/cantieri distinti
("Causa di lavoro" e "Separazione").

Trovato un bug reale al primo giro (`avvocato-03`): quando ho chiesto di
scrivere alla controparte Bianchi per un accordo, EON preparava
direttamente il testo del messaggio, chiedendo solo la conferma di invio
(il meccanismo automatico di manda_messaggio) — senza fermarsi prima a
chiedere se Bianchi avesse un legale, cosa che l'istruzione originale
diceva ma non abbastanza esplicitamente. Corretto rendendo la sequenza
meccanica: mai chiamare manda_messaggio per una controparte quando non è
chiaro se assistita, sempre una domanda di testo PRIMA di redigere
qualunque bozza. Ritestato: ora chiede correttamente prima di procedere.

Trovato anche un problema di dati, non di prompt: il caso `avvocato-05`
usava "Bianchi" come nome, che collideva con un cliente "Bianchi" già
usato da altri test (con cantieri edile "Garage"/"Bagno"/"Tetto"
scollegati), generando un'ambiguità non voluta. Rinominato il cliente del
test in "Ostinelli" — nessun bug di prompt, solo un caso da correggere.

**Risultato finale: tutti e 8 i casi passano** (avvocato-01..08). Pack
Avvocato considerato insegnato e testato, stesso livello di affidabilità
delle altre 3 professioni.

**Le 4 professioni di partenza sono complete**: Edile, Idraulico,
Amministratore di condominio, Avvocato — tutte scritte, insegnate e
testate con lo stesso metodo. Prossimo passo, ordine confermato con
Gianardi: validazione con tester reali, l'ultimo passo prima che il
prodotto vada in mano a professionisti veri al di fuori di questo lavoro
di costruzione.

**Gruppo 4 edile (05/09/2026): i 19 principi mai insegnati, trovati
nell'audit di oggi.** 10 aggiunti allo strato comune (quasi tutti
generali, non specifici edile — vedi `systemPromptAssistente`):
autocorrezione di un valore nella stessa frase (vale l'ultimo),
negazione/misura ambigua in una trascrizione su un'azione con
conseguenze concrete, messaggio isolato/emotivo che non deve produrre
un'azione irreversibile, sconto eccezionale che non diventa standard,
range vago preservato quando riportato a terzi, comando ampio senza
scope dichiarato, indicazioni contrastanti da due fonti autorizzate,
dati economici interni mai in un documento/messaggio cliente,
posizione riservata condivisa solo se autorizzata, allegato mai dato
per ricevuto solo perché dichiarato, formula di cortesia che non
risponde a un sì/no, richiesta indiretta di risorse storiche, canale
non ancora collegato (WhatsApp) dichiarato onestamente, regola di
disponibilità ricorrente registrata come tale. 10 nuovi casi
(`brain-comune-10..19`, 63 totali).

**Verificato dal vivo su staging il 05/09/2026: 9 su 10 corretti.**
`brain-comune-12` (comando ampio senza scope) ha un comportamento
corretto (chiede a cosa si riferisce "tutto", non esegue nulla) ma la
frase finale della risposta non finisce con "?" — il controllo
automatico (che guarda solo l'ultimo carattere del testo) lo segna
FAIL per questo motivo, non per un bug reale: pattern già visto oggi
(`edile-01`) e nei giorni scorsi. `brain-comune-19` (formula di
cortesia dopo una domanda sì/no) non si è potuto verificare come
progettato: richiede un vero preventivo già esistente per il cliente,
ma i preventivi non sono ancora gestiti da EON (stesso limite "non
applicabile" del Gruppo 3) — non un fallimento, un limite di
precondizione. Restano da insegnare esplicitamente solo 2 dei 19
originali (decisione presa da un collaboratore non titolare, telefono
riusato da una persona diversa) — scartati per ora perché difficili da
verificare con un caso pulito data l'attuale mancanza dei concetti
Squadra/storico-per-numero nell'app; da rivalutare se emergeranno
nell'uso reale.

**Prossimo passo, deciso con Gianardi il 05/09/2026**: il metodo da
qui in avanti non è più "insegna quello che il prompt può fare oggi, e
segnala i limiti strutturali per dopo" — è "insegna la conoscenza
generale, e se durante l'insegnamento emerge la necessità di una
funzione nuova, la si costruisce subito, poi si continua a insegnare
sopra quella base".

**Concetto di "Cantiere" — fatto (05/09/2026).** Primo limite
strutturale reale, affrontato subito invece di essere solo segnalato.
Scelta con Gianardi la **versione leggera** (non l'intera ontologia del
libro Sopralluogo/Preventivo/Commessa/SAL/Garanzia — troppo lavoro e
alcune di quelle funzioni non esistono ancora nell'app): un Cantiere è
solo un'etichetta di lavoro collegata a un cliente.

- Nuova tabella `cantieri` (`supabase/cantieri_entita_schema.sql`):
  client_id, nome, stato aperto/chiuso. Applicata su staging.
- `cantiere_foto.cantiere_id` (nullable, additivo — `client_id` resta
  per il caso comune di un solo lavoro, non serve mai toccarlo).
- Due nuovi strumenti: `cerca_cantiere` (elenca i lavori di un
  cliente), `crea_cantiere` (ne registra uno nuovo con un nome che lo
  distingua). `recupera_foto_cantiere` accetta ora anche `cantiere_id`.
- Insegnato nello strato comune: verificare i cantieri solo quando è
  plausibile che un cliente ne abbia più di uno (mai per il caso
  comune, per non aggiungere frizione inutile).
- **Verificato dal vivo su staging il 05/09/2026: 3 casi su 3
  corretti** (`brain-comune-20/21/22`, 66 totali) — incluso il caso più
  delicato: cliente con due cantieri ("Bagno"/"Tetto"), EON ha cercato
  i cantieri, riconosciuto "tetto" dal testo dell'utente, mostrato solo
  la foto di quel cantiere.
- Corretta anche una piccola disciplina mancata: `eval/check-schema.js`
  non aveva mai registrato la tabella `incomes` (aggiunta ieri) —
  sistemato insieme al resto.
- **Applicata anche in produzione il 05/09/2026**, con conferma di
  Gianardi — verificato che tabella `cantieri` e colonna
  `cantiere_foto.cantiere_id` esistono in entrambi gli ambienti.
  Restano fuori scope per questa versione leggera: `incomes`
  (pagamenti) e `cantiere_appunti`/`cantiere_documenti` non hanno
  ancora un collegamento a `cantiere_id` — da valutare se servirà
  quando/se emergerà un caso reale.

**Resto del gruppo "parziale" NON legato al Cantiere — fatto
(05/09/2026).** Insegnati: SAL/acconto distinto dal saldo finale
(chiedere quale rata se un cliente ne ha più di una in sospeso,
indicare il tipo nella descrizione quando se ne registra uno nuovo),
fornitore e subappaltatore come categorie distinte tra loro, verificare
sempre il destinatario prima di un inoltro rapido di dati cliente, una
delega generale autorizza a procedere ma mai a inventare un dato
mancante, una decisione presa sul campo da un collaboratore va
segnalata come tale. Lasciato fuori "telefono riusato da una persona
diversa": richiede uno storico per numero di telefono che oggi non
esiste, non un insegnamento mancante ma un dato che EON non ha modo di
controllare. 4 nuovi casi (`brain-comune-23..26`, 70 totali).

**Verificato dal vivo su staging, con due giri di correzione reale
(05/09/2026)**: `brain-comune-24` (tipo di pagamento in descrizione)
corretto al primo colpo, confermato leggendo direttamente il valore
salvato su database ("Secondo acconto - Lavoro bagno"). `brain-comune-
25` (delega non inventa il prezzo) corretto nella sostanza, stesso
falso positivo del controllo automatico sul punto finale già visto più
volte oggi. `brain-comune-26` (decisione da collaboratore) al primo
giro NON seguiva l'istruzione (impegno creato senza menzionare
l'operaio) — istruzione resa più esplicita e operativa (dire di
scrivere ESPLICITAMENTE chi ha deciso nel titolo del tool, non solo
"segnalarlo" in modo vago) e il secondo giro ha corretto
("Inizio lavori Bianchi — confermato dal mio operaio"). `brain-comune-
23` (acconto ambiguo) ha rivelato un **secondo bug di codice reale**,
dello stesso tipo di quello di ieri: `segna_incasso_ricevuto`, quando
un cliente aveva più di un incasso in sospeso, sceglieva sempre quello
con la scadenza più vicina ignorando l'importo detto dall'utente —
anche quando l'importo corrispondeva chiaramente a un altro dei
candidati. **Corretto**: ora, con più incassi in sospeso per lo stesso
cliente, l'importo (se corrisponde a uno solo) sceglie quale
aggiornare; altrimenti si ferma elencando le opzioni invece di
scegliere di default la scadenza più vicina. Il testo con cui EON
chiede l'importo resta migliorabile (non elenca subito i due acconti
come suggerito nel prompt) ma il comportamento è ormai sicuro a
livello di codice — rifinitura di forma rimandabile, non un rischio.

**Gruppo 3 edile (05/09/2026): collegamento certo di foto/documenti/
pagamenti al cliente/cantiere giusto.** Audit di `libro/edile.md`
(sezioni C/I/K, "Catalogo errori critici"): la maggior parte è già
coperta dallo strato comune esistente (`cliente_risolto` di
`interpreta_richiesta` — trovato/simile/ambiguo/non_trovato — usato
anche da `recupera_foto_cantiere`/`recupera_documenti_cliente`).
**Trovato però un bug reale**, non teorico: `segna_incasso_ricevuto`
(lo strumento pagamenti di ieri) NON passa da quella logica di
sicurezza — cerca l'incasso per nome con un confronto approssimativo e
`limit:1`, prendendo sempre il primo risultato anche quando altri
clienti diversi corrispondevano allo stesso nome parziale. Rischio
concreto: segnare come pagato il cliente sbagliato — l'errore più
grave del catalogo del libro. **Corretto**: ora recupera più righe e,
se corrispondono a più `client_name` diversi, si ferma con un errore
esplicito invece di scegliere alla cieca; Claude lo riceve come
tool_result di errore e deve chiedere conferma in testo. Nuovo caso
`brain-pagamenti-03` (53 casi totali) — **verificato dal vivo su
staging il 05/09/2026**: con due incassi in sospeso di "Colombo Andrea"
e "Colombo Costruzioni", EON ha correttamente elencato entrambi e
chiesto quale, senza registrare il pagamento su nessuno dei due.

**Nota per il futuro**: il libro modella un'ontologia più ricca
(Cliente → uno o più Cantiere → Commessa), ma lo schema reale collega
foto/documenti/pagamenti solo a un `client_id`/`client_name`, non a un
Cantiere distinto — in pratica oggi "collegare al cantiere giusto"
significa "collegare al cliente giusto". Se un cliente avesse davvero
più cantieri attivi insieme servirebbe una colonna nuova (fuori scope
per una semplice correzione di prompt/tool) — non è un problema oggi
perché il libro stesso nota che è raro avere più di un cantiere attivo
per cliente, ma va tenuto a mente se emergerà nell'uso reale.

**Audit completo di `libro/edile.md` contro il prompt attuale
(05/09/2026)**, richiesto da Gianardi ("cosa abbiamo preso e non preso
dal libro?") — confronto voce per voce dei 72 casi in sezione L più la
tabella "Catalogo errori critici", in 4 gruppi:

1. **Già coperto e verificato (~30 dei 72 casi)** — quasi tutto dallo
   strato comune, non scritto per l'edile ma che copre per costruzione
   già molto: omonimi (#11-15), orario mancante/vago (#6-9), appunti vs
   impegni (#16-17), conferma reale prima di comunicare (#20-23),
   cortesia ≠ impegno (#41), stato provvisorio (#62), pianificazione
   condizionale (#63), fornitore mai cliente (#30, verificato oggi come
   `edile-01`), cliente/fornitore che cambia nome (#43/#64, verificato
   oggi come `edile-03`), prezzo mai inventato, parere mai trasformato
   in azione (#25), conferma vaga tra più opzioni (#38/#47, `brain-
   comune-09`), acconto senza importo (#72). Più le due cose scritte
   apposta per l'edile: il glossario tecnico (#19/#44,
   `promptPackEdile()`) e il collegamento certo dei pagamenti (tabella
   errori critici, corretto oggi in `segna_incasso_ricevuto`).
2. **Coperto solo in parte, per un limite strutturale dell'app, non di
   insegnamento (~10 casi: #2, #10, #18, #21 tono, #27, #31, #45, #52,
   #61)** — soprattutto perché manca un concetto di "Cantiere" distinto
   dal "Cliente" nello schema (foto/documenti/pagamenti sono legati
   solo al cliente): "due cantieri diversi per lo stesso cliente" oggi
   EON non può proprio distinguerli, non è risolvibile scrivendo meglio
   il prompt (vedi nota sopra).
3. **Non applicabile, perché la funzione non esiste ancora nell'app
   (~12 casi: #24, #26, #28, #29, #33, #46, #49, #50, #51, #53, #65,
   #69)** — preventivi, varianti, commesse, squadra/attività assegnate:
   il libro li descrive perché fanno parte del mestiere, ma EON non ha
   ancora strumenti AI per crearli/gestirli (i preventivi si fanno da
   un'altra pagina dell'app, manuale). Buco di funzionalità, non di
   insegnamento.
4. **Scritto nel libro ma MAI ancora insegnato/testato — il vero "non
   preso" (~19 casi): #3, #35, #36, #37, #39, #40, #42, #48, #54, #55,
   #56, #57, #58, #59, #60, #66, #67, #70, #71** (oltre alle righe
   corrispondenti nel "Catalogo errori critici": negazione persa nella
   trascrizione, unità di misura ambigua, azione irreversibile da
   messaggio emotivo isolato, dati economici interni mai in un
   documento cliente, posizione/indirizzo riservato condiviso senza
   autorizzazione, indicazioni contrastanti da due fonti autorizzate
   risolte a caso). Sono principi generalizzabili, candidati naturali
   per il prossimo gruppo da insegnare — molti sono anzi generici
   (utili a qualunque professione, non solo edile), quindi probabile
   che finiscano nello strato comune più che in `promptPackEdile()`.

**Posizionamento di EON, chiarito da Gianardi il 05/09/2026 (da
ricordare sempre, riguarda l'intero progetto non solo l'edile)**: EON
non è pensato solo per artigiani/professionisti con un mestiere
specifico — è per **chiunque voglia organizzare la propria giornata e
aumentare la produttività**, mestiere o no. Per questo esiste un
livello generale (BRAIN CORE + strato comune, `libro/comune.md`, già
scritto) valido per chiunque usi EON — la card di iscrizione "Altro /
Generico" (`data-profession="artigiano"`, aggiunta oggi) è la porta
d'ingresso a questo livello generale, non un ripiego per chi non trova
la propria professione. Sopra a questo, per chi ha davvero un mestiere
specifico, ci sono i Professional Brain Pack (edile fatto, altri tre in
arrivo — vedi sopra). `libro/professional-brain-pack-metodo.md`
aggiornato con questa distinzione esplicita.

**Strato comune, prima bozza (04/09/2026)**: `libro/comune.md` creato
da zero (senza guardare `libro/edile.md`), usando il lotto di 50 casi
generato da OpenAI (fonte in `libro/comune-openai-lotto1.md`) a partire
dal testo di richiesta in `libro/richiesta-strato-comune.md`. Struttura:
chi usa EON in generale, modello cognitivo generale, ontologia generica
(Contatto/Appuntamento/Documento/Messaggio/Canale/Pagamento/
Promemoria/Conversazione), relazioni, pattern linguistici trasversali,
modello degli 8 failure mode (ripreso dal lotto OpenAI), comportamento
EON, situazioni limite, divieti, 38 casi di valutazione.

**Lotto Claude chat integrato (04/09/2026)**: 18 voci genuinamente
nuove aggiunte (proposte aperte da tracciare, contatto condiviso da
più ruoli, dati sensibili per omonimia, minimizzazione linguistica di
un impegno, clausola di riserva, documentazione tardiva, decisore
reale vs titolare formale, ecc.) — fonte in
`libro/comune-claude-lotto1.md`. Strato comune considerato a buon
punto (38 casi); prossimo passo: capitoli per professione.

## Prossimo passo — a cura di Gianardi (03/09/2026)

Prima di procedere col Communication Hub: **inserire dati veri nell'app
di produzione** (non quella di staging, che resta apposta vuota per i
test) — una decina di clienti realistici, cantieri collegati, qualche
foto vera, un impegno già segnato. Poi usare EON per davvero, con
richieste vere ("segnami un appuntamento con [cliente vero]", "fammi
vedere le foto del cantiere di [nome]", ecc.), e annotare ogni caso in
cui qualcosa non funziona come atteso — frase esatta usata + cosa è
successo invece.

Nato da un allarme di Gianardi il 03/09/2026 ("il sistema è lentissimo,
non fa quello che voglio") rivelatosi in parte un equivoco: stava
testando sull'app vera ma senza aver mai inserito clienti/cantieri
veri — EON non inventa dati mai visti, quindi senza anagrafica non
trova nulla, comportamento corretto (verificato oggi dalla suite,
`no-invenzione-01`/`02`) ma facile da scambiare per un bug se non si sa
che manca la base dati. Ordine deciso insieme: prima questo test reale
quotidiano (con dati veri, ambiente vero), POI il Communication Hub,
POI un test finale con tutto insieme — non l'ordine inverso, per non
rischiare che un bug del cervello finisca per mandare un messaggio vero
a un cliente vero durante la prima esposizione reale.

## Riepilogo impegni aperti (03/09/2026)

Promemoria di tutto quello che resta da fare, nell'ordine concordato:

1. **Dati veri in produzione + test quotidiano** (sezione sopra,
   "Prossimo passo — a cura di Gianardi") — in corso, promemoria
   giornaliero attivo (trigger `trig_019rYzLSmyTtDno5hzJJWJKx`, 7:00
   UTC). Annotare ogni caso in cui EON non fa quello che ci si aspetta.
2. **Libro dei professionisti**: strato comune (~150 casi) → poi
   Amministratore di condominio, Elettricista, Avvocato (Edile già
   fatto) — sezione sopra.
3. **Communication Hub multi-canale** (email, WhatsApp) — dopo il test
   quotidiano reale, non prima (per non rischiare un bug del cervello
   su un messaggio vero a un cliente vero durante la prima esposizione).
4. **Test finale con tutto insieme** (dati veri + Hub) — dopo il punto 3.
5. **Dettaglio minore**: `check-schema.js` collegato al deploy in
   automatico (per ora va lanciato a mano) — punto 3.1 del roadmap
   operativa.
6. **Pulizia e precisazioni** — voce aperta, si riempie durante l'uso
   reale (sezione sotto).

## Pulizia e precisazioni

Voce generica per una passata di rifinitura sull'app: perfezionare alcune
funzioni esistenti, sistemare dettagli grafici, e in generale "dare una
pulita" — non un elenco chiuso, si riempie mano a mano che si individuano
cose da sistemare durante l'uso reale dell'app.

Richiesto da Gianardi il 31/08/2026.

**05/09/2026 — pulizia e sistemazione grafica generale dell'app.**
Gianardi vuole rivedere le tante card/cartelle nell'area con Registro
AI, Pagamenti, ecc. ed eliminare quelle che non servono più.

**05/09/2026 — interfaccia per i pagamenti (chi ha pagato/non ha
pagato).** Idea di Gianardi: non solo lo strumento AI (mostra_incassi/
segna_incasso_ricevuto, già fatto e testato il 05/09 — vedi sopra), ma
anche una parte visiva:
- I pagamenti/incassi creano sempre un impegno (come gli altri), ma
  colorato in modo diverso per distinguerli a colpo d'occhio dagli
  impegni generali
- Una card dedicata nel menu, da mettere SOPRA quella di "Registro AI"
  (nell'area con tante card, tra cui anche quella dei pagamenti)

Da fare in una sessione dedicata al lavoro grafico/UI, separata da
quella sul "cervello" di EON — sono due tipi di lavoro diversi.

**17/09/2026 — Card risorsa a schermo intero (nuova funzione, non solo
"pulizia").** Fino ad oggi, quando l'utente chiedeva a voce/testo una
risorsa già esistente (una foto, un documento, un preventivo/fattura),
EON la recuperava davvero (`recupera_foto_cantiere`/
`recupera_documenti_cliente`) ma il risultato finiva quasi nascosto in
un piccolo messaggio di testo/toast — un intervento importante perché
prima di questo la richiesta non produceva nulla di concreto da vedere,
il punto debole più visibile di "chiedi ed EON ti dà la cosa subito".

Aggiunta una card centrata a schermo (margine tutto intorno, angoli
arrotondati sui 4 lati — non una scheda che sale dal basso), che si apre
da sola SOLO per le richieste di tipo "risorsa" (mai per un impegno, che
resta come prima): una foto mostra l'immagine vera e grande; un
documento/preventivo/fattura mostra un'icona grande e colorata in cima
(o l'importo in grande per preventivi/fatture) con tutto il resto —
titolo, dettagli, pulsanti — piccolo sotto, su indicazione precisa di
Gianardi (bozzetto a mano). Ogni risultato ha una riga con 3 canali di
invio: "EON" funzionante (apre la chat vera del cliente col testo già
pronto, l'utente vede cosa parte prima di inviarlo), Email e WhatsApp
già in struttura ma disabilitati ("presto disponibile") finché non
costruiamo il Communication Hub multicanale.

Testato in locale con Playwright/Chromium (server statico + browser
headless, non l'app vera online): apertura/chiusura, singolo risultato
vs più risultati, foto vera visualizzata correttamente, nessun errore
JavaScript. Codice in `index.html`, nessuna modifica al backend/prompt —
puramente grafico/strutturale, come richiesto.

## Monetizzazione del Piano Free (uso generico) con pubblicità personalizzata

Decisione di Gianardi (17/09/2026): la scelta "Organizza la giornata e
aumenta la produttività" all'iscrizione (`data-type="generico"`, profilo
salvato come `profession: "artigiano"`, nessun Professional Brain Pack —
solo il cervello generale/strato comune) è pensata per una persona
qualunque che vuole organizzare la sua giornata e le sue cose, anche il
lavoro — non per chi ha uno dei 4 mestieri specifici (Edile, Idraulico,
Avvocato, Amministratore di Condominio). Per questo segmento il piano
sarà **gratuito, sostenuto da pubblicità personalizzata** invece che da
un abbonamento.

**Importante — riguarda SOLO il Piano Free/generico**: i 4 percorsi
professionali restano come sono oggi, senza pubblicità.

Ancora tutta da progettare: non esiste oggi nessuna infrastruttura
tecnica (raccolta dati per il targeting, slot pubblicitari nell'app,
integrazione con un network di ads, distinzione lato codice tra utenti
"generico" e utenti professionisti ai fini della pubblicità). Da
riprendere in una sessione dedicata quando si deciderà di costruirla.

## Principio permanente: imparare dalle grandi app per affinare EON

Richiesto da Gianardi (17/09/2026): cercare attivamente le metodologie e
le tecniche che usano le grandi app e le big tech, e usarle per affinare
e migliorare EON.

Non basta applicarle solo quando arriva un'idea o un problema da
Gianardi (es. lo stratagemma per gli appuntamenti del 17/09 — "notifica
immediata, poi lavoro in silenzio", stesso principio della spunta di
WhatsApp prima della conferma di consegna, o di "Invio in corso…" di
Gmail — è nato da un'idea sua, non da una ricerca proattiva): da ora
in poi vale come principio permanente di lavoro, in due direzioni:
1. **Reattivo** (già in uso): quando affrontiamo un problema concreto di
   EON, guardare prima come lo risolvono le grandi app conosciute e
   adattarlo, invece di inventare qualcosa da zero.
2. **Proattivo** (nuovo, da fare di più): guardare periodicamente ai
   flussi già esistenti di EON e proporre di mia iniziativa miglioramenti
   ispirati a tecniche note (es. UI ottimistica, retry/backoff, caching,
   conferme a più livelli di rischio, entity resolution, ecc.), non solo
   rispondere a richieste già arrivate.
Mai una tecnica presa e applicata "perché lo fa Google": ogni proposta
va sempre spiegata nel merito (che problema risolve per EON, quale
compromesso comporta) prima di essere costruita.

**Revisione del lavoro già fatto (17/09/2026), autorizzata da Gianardi
con una regola precisa: chiedere ogni volta l'autorizzazione prima di
ogni modifica, e farla solo se è davvero migliorativa.** Proposti 3
miglioramenti, tutti e 3 autorizzati; da costruire uno alla volta:

1. **FATTO — Riprova automatica per problemi di rete passeggeri**
   (come WhatsApp/Gmail/Slack, utile perché i mestieri di EON si fanno
   spesso in cantina/cantiere con poco segnale). Nuove funzioni
   `sembraErroreDiRete()`/`conRiprovaDiRete()` in `index.html`: fino a 3
   tentativi con attesa crescente (600ms, 1.2s), ma SOLO per le
   LETTURE (`dbSelect`, `dbSelectById`, `dbSelectCestino`,
   `loadChatsFromDB`, il profilo al login) — mai per le scritture
   (`dbInsert`/`dbUpdate`/`dbDelete`), dove ripetere la stessa richiesta
   due volte rischierebbe di creare un doppione se la prima fosse in
   realtà già andata a buon fine (lo stesso motivo per cui Stripe usa le
   "idempotency key" per i pagamenti — qui, più semplicemente, si evita
   il rischio non riprovando affatto le scritture). Riprova solo se
   l'errore sembra davvero di rete (nessun "code" — gli errori veri di
   Postgres/PostgREST ne hanno sempre uno — e un messaggio tipico di
   rete): un errore vero (permesso negato, vincolo violato) non sparisce
   riprovando, quindi si passa e si mostra subito, come oggi. Nuova
   sezione di test in `eval/router.test.js`: 62/62 verifiche passate
   (era 54/54).

   **Perché non anche l'assistente AI**: la richiesta a `/api?action=
   assistant` può scrivere (crea_impegno, crea_appunto, ecc.) — se la
   riprovassimo alla cieca dopo un errore di rete, rischieremmo di
   duplicare un'azione se in realtà il server l'avesse già eseguita ma
   la risposta si fosse persa per strada. Farlo in sicurezza servirebbe
   un meccanismo vero (una "chiave di idempotenza" lato server, come fa
   Stripe) — non costruito ora, da valutare se vale la pena in futuro.
   Per ora l'assistente resta come oggi: se fallisce per un problema di
   rete, lo dice chiaramente e serve un tentativo manuale.

2. **FATTO il 17/09/2026 — "Fatto, annulla" al posto di "sei sicuro?"**
   (come Gmail "Annulla invio", o Trello/Notion "fatto, tocca per
   annullare"). Presentato prima un elenco preciso a Gianardi (6 azioni
   che oggi chiedono conferma, quali sono già reversibili e quali no) —
   autorizzati i primi 2, i più sicuri: `elimina_cliente` ed
   `elimina_impegno` (entrambi vanno comunque nel Cestino, già
   ripristinabili). Lasciati fuori di proposito: `sposta_impegno`/
   `annulla_impegno` (servirebbe prima salvare il valore "prima" per un
   annullo vero — non ancora fatto), `svuota_cestino` (ultima linea di
   difesa: una volta fatto non c'è più un Cestino da cui recuperare,
   resta "sei sicuro?" come oggi, anche Gmail/Notion chiedono sempre
   conferma vera per questo), `manda_messaggio` (visibile a una persona
   vera fuori dall'app una volta arrivato: un "annulla" qui
   funzionerebbe diversamente, come il ritardo reale di invio di Gmail,
   non un semplice avviso — lavoro a parte).

   Nuovo campo `annullabileSubito: true` sui due tool in `api/index.js`
   (non cambia `risk`, resta `"high_impact"`: cambia solo COME si
   protegge l'utente, prima o dopo l'esecuzione) — `richiedeConferma()`
   li salta, eseguono subito come un tool ordinario. `elimina_impegno`
   ora restituisce anche `tabella` (tasks o messages: un impegno può
   stare su due tabelle diverse) ed `elimina_cliente` anche
   `conversation_id`, entrambi necessari al frontend per sapere cosa
   ripristinare con `dbRestore()` se l'utente tocca "Annulla".
   Rimossi i `describe()` dei due tool (diventati codice morto: non
   passano più dalla coda di conferma che li chiamava).

   Frontend: nuova `showAIToastConAnnulla()` in `index.html` (avviso
   con un solo pulsante "Annulla", sparisce da solo dopo 7 secondi) e
   `annullaEliminazioneImpegni()`/`annullaEliminazioneCliente()` (stesso
   `dbRestore()` già usato dalla schermata Cestino). Una cancellazione
   bulk ("cancella tutti gli impegni di domani") mostra UN solo avviso
   raggruppato con un solo "Annulla" per tutti, non uno per elemento —
   stesso principio già usato per `crea_impegno`. Collegato sia in
   `organizza()` (Hub AI) sia in `elabora()` (microfono/testo di Home,
   Clienti, Cantiere cliente) — per la voce, l'annuncio parlato resta
   com'era, solo il tocco su "Annulla" non è raggiungibile a voce.

   Aggiornati 2 casi in `eval/casi.json` (`brain-bulk-01`/`02`) che
   testavano la vecchia richiesta di conferma raggruppata per una
   cancellazione bulk: ora verificano che l'esecuzione immediata copra
   comunque TUTTO il gruppo trovato, non solo il primo elemento.
   Verificato con Playwright che il tocco su "Annulla" richiama
   davvero il ripristino e fa sparire l'avviso. `router.test.js` e
   `backend.test.js` invariati: 62/62 e 18/18.

3. **NON FATTO per scelta di Gianardi (17/09/2026) — Risposte dell'AI a
   comparsa progressiva (streaming)**, come ChatGPT/Claude.ai/Gemini.
   Valutato nel merito (non solo "perché lo fanno le grandi app"): per
   EON il beneficio è più stretto che per un chatbot generico — la
   maggior parte delle richieste sono azioni brevi che finiscono con un
   "Fatto." di poche parole, dove lo streaming non aiuterebbe a nulla;
   aiuterebbe solo nelle risposte lunghe (un parere, una spiegazione).
   A fronte di un costo reale (tocca sia il backend — come Claude
   risponde — sia il frontend — leggere la risposta a pezzi — sia la
   lettura a voce, da ripensare), Gianardi ha deciso di non farlo per
   ora. Proposta rimasta sul tavolo se si vorrà tornarci: solo per le
   risposte lunghe di tipo "parere/spiegazione", non per tutto.

**Seconda tornata di proposte (17/09/2026), stessa regola (autorizzazione
prima, solo se migliorativo).** Presentate 4 tecniche per intelligenza e
velocità; valutate nel merito una per una (niente adottato solo perché
lo fa una grande app — precaricamento predittivo scartato perché
`loadUserDataFromDB()` carica già tutto in blocco al login, non c'è
nulla da precaricare in anticipo; schermate scheletro utili solo in
punti isolati con un'attesa vera, es. il Cestino, non ovunque). Segnate
da fare da Gianardi:

4. **DA FARE — Ragionamento esteso sui casi difficili.** Su richieste
   dove sbagliare costa caro (calcoli di date, ragionamenti con più
   passaggi — impatto diretto: proprio in questa sessione trovato un
   bug reale sul calcolo di una data, il promemoria caldaia
   dell'idraulico), far "pensare di più" il modello prima di rispondere
   invece di rispondere di getto, come le versioni "reasoning" di
   ChatGPT/Gemini. Da scoprire quali casi in `api/index.js` meritano
   davvero il costo in più di velocità (non tutti: le azioni semplici
   restano come oggi) prima di costruire.

5. **DA FARE (più avanti) — Memoria delle abitudini nel tempo.** Come le
   routine di Google Assistant: imparare schemi ricorrenti dell'utente
   (es. "ogni lunedì alle 9 chiama Rossi") per suggerire o velocizzare
   le richieste future. Il più ambizioso dei cinque: segnalato onestamente
   a Gianardi come prematuro con solo 2 utenti veri in produzione (non
   c'è ancora abbastanza uso reale da cui imparare abitudini vere) — da
   riprendere quando ci sarà più uso reale su cui basarsi, non ora.

6. **DA FARE — Velocità vera della risposta, non solo percepita
   (18/09/2026).** Nato dal primo test reale del tester: oggi ogni
   richiesta nuova fa 2 giri separati con l'AI (interpreta_richiesta
   forzato, poi l'azione vera) — verificato sul log reale, 3,8 secondi
   per un "segna un appuntamento" su Haiku. L'idea: lasciare che il
   modello dichiari l'intento e chiami subito l'azione nello stesso
   turno, invece di due turni separati — dimezzerebbe circa il tempo
   reale. Da fare con calma, non di fretta: tocca un meccanismo di
   sicurezza costruito apposta (forzare interpreta_richiesta PRIMA di
   ogni altra scelta), che ha già evitato errori reali in queste
   settimane — richiede test approfonditi (`eval/live-check.js` per
   intero, non solo un caso) prima di essere sicuri che non introduca
   regressioni sulla qualità delle risposte.

## Visione: EON come "mente" personalizzata del professionista (17/09/2026)

Gianardi, testuale: "EON deve essere la mente del professionista ed
essere velocissimo... e deve diventare sempre di più come il
professionista che lo usa... quindi personalizzato... un cervello che
diventa sempre più uguale a come pensa il professionista che lo usa."

Differenza chiave rispetto a tutto quello fatto finora: oggi il
Professional Brain Pack è per MESTIERE (uguale per tutti gli idraulici,
tutti gli avvocati, ecc.) — non ancora per PERSONA. Questa è la
direzione futura: un livello in più, sopra quello di mestiere, che si
avvicina nel tempo a come pensa e decide QUEL professionista specifico.

**Tecniche già usate dalle big tech, applicabili da subito con quello
che abbiamo già (nessuna tecnologia nuova da inventare):**
- Imparare lo stile di scrittura da quello che il professionista ha già
  scritto davvero ai clienti (come Superhuman, Gmail Smart Compose) —
  i messaggi ci sono già nel database, si tratta di leggerli e farne
  emergere il tono/le parole ricorrenti, invece di far scrivere a EON
  bozze con un tono generico.
- Imparare dalle correzioni dell'utente come segnale permanente, non
  solo per il turno in corso (come Grammarly/Gmail): oggi una
  correzione vale solo lì per lì e si perde — se lo stesso tipo di
  correzione si ripete, EON dovrebbe iniziare a farlo giusto da solo.
- Recupero delle situazioni simili già vissute (tecnica standard oggi,
  RAG): prima di rispondere, EON cerca se ha già gestito qualcosa di
  simile per questo professionista/cliente tra i dati reali suoi, e si
  ispira a quello — un ricordo vero, non un'invenzione.

**Tecniche nascenti nel settore — replicabili da noi, a modo nostro,
senza aspettare che le finiscano le grandi aziende:**
- Memoria "a due livelli": distinguere cosa è vero SOLO ora ("oggi mi
  ha detto di chiamare Rossi") da cosa è vero SEMPRE per quel
  professionista ("lavora sempre il sabato mattina"). Non è tecnologia
  esclusiva delle big tech — è una scelta di progettazione (database +
  cosa mandare al modello): costruibile da noi, adesso.
- Un "adattatore" leggero per utente (riaddestrare un pezzo di modello
  per ogni professionista) — questo SÌ richiede infrastruttura pesante
  che non abbiamo (calcolo, addestramento) e non ci serve nemmeno: la
  memoria con recupero sopra ottiene praticamente lo stesso risultato
  pratico, senza mai dover toccare il modello.

**Buchi reali dell'intero settore — non risolti nemmeno dalle più
grandi aziende tech, non solo da EON (annotati per consapevolezza, non
per essere risolti da noi prima di chi ci lavora a tempo pieno):**
1. Nessuno ha ancora un modo economico per far "imparare per sempre"
   un'informazione nuova senza doverla ripetere/reiniettare nel
   contesto ogni volta — anche ChatGPT/Gemini "ricordano" solo perché
   la riscrivono dentro ogni conversazione, non l'hanno davvero
   assorbita.
2. Nessuno sa bene come aggiornare/correggere un ricordo vecchio
   diventato sbagliato (es. "non lavoro più il sabato") invece di
   accumulare fatti contraddittori nel tempo — gestito ovunque con
   soluzioni artigianali, non con una vera soluzione.
3. Nessuno garantisce coerenza vera su un ricordo enorme accumulato
   negli anni, senza mai contraddirsi o perdere per sbaglio qualcosa
   detto tempo prima.
4. Nessun grande prodotto ha ancora una buona interfaccia che spieghi
   in modo chiaro all'utente COSA l'assistente ricorda di lui e PERCHÉ
   lo ha usato in una risposta — più un sistema si personalizza, più
   diventa opaco.

   **Questo quarto punto, a differenza dei primi tre, è alla nostra
   portata anche senza risolvere il problema tecnico di fondo**: una
   EON potrebbe comunque essere onesta e mostrare "ecco cosa ricordo di
   te e perché l'ho usato" — pura trasparenza verso l'utente, non
   richiede di risolvere il problema di ricerca. Idea da valutare
   insieme alla costruzione della memoria vera e propria, quando si
   arriverà a costruirla.

Nessuna implementazione ancora iniziata: questa è la mappa delle idee,
da riprendere pezzo per pezzo (prima lo stile di scrittura dai
messaggi reali, probabilmente il passo più semplice e già fattibile con
i dati che abbiamo).

## Idea di Gianardi: EON impara dalle risposte tecniche già date (21/09/2026)

Nata da una domanda concreta di Gianardi: oggi, se un utente fa una
domanda tecnica/generale (es. "quando è valida una delibera
condominiale"), EON risponde attingendo alla conoscenza generale del
modello (Claude) — nessuna base di conoscenza costruita da noi, nessuna
verifica contro una fonte giuridica aggiornata, e un costo reale
(chiamata vera all'AI) ogni singola volta, anche per domande già fatte
prima da altri.

Idea di Gianardi ("principio democratico dell'apprendimento graduale"):
salvare le risposte già date e riusarle per domande simili future,
invece di richiamare sempre Claude da capo — EON che "impara" dalle
proprie stesse risposte nel tempo. Tecnica reale e nota (si chiama
cache semantica: prima di rispondere, si controlla se una domanda
abbastanza simile ha già una risposta salvata), non ancora costruita.

**Il rischio reale da risolvere prima di costruirla, non dopo**: oggi un
errore su una domanda tecnica è isolato (capita una volta). Se si
riusano risposte salvate senza verificarle, un errore diventerebbe
permanente e si ripeterebbe identico per tutti gli utenti che fanno una
domanda simile — più pericoloso, non più sicuro. La parte davvero
irrisolta (collegata al punto 1 dei "buchi del settore" sopra, "nessuno
sa aggiornare bene un ricordo vecchio diventato sbagliato"): capire
QUANDO una risposta salvata non è più affidabile e va rifatta, invece
di fidarsene per sempre.

**Prerequisito**: prima di costruire questa cache, ha senso risolvere
il problema base già identificato sopra — dare a EON un modo di
verificare (o almeno segnalare onestamente il limite di) una risposta
tecnica, invece di rispondere sempre e solo dalla conoscenza generale
del modello senza nessun controllo.

Non fattibile ora con solo 2 utenti veri (poco traffico, poco risparmio
reale) — da riprendere quando ci sarà più uso reale, insieme alla
visione della "mente personalizzata" sopra.

**Seguito del ragionamento (22/09/2026)**: Gianardi ha chiesto come
rendere questa idea innovativa invece di una semplice imitazione delle
big tech, restando fedele al suo "principio democratico". Ragionato
insieme fino a una proposta concreta, poi Gianardi stesso ha fatto un
collegamento azzeccato con **Wikipedia** — il miglior esempio reale su
grande scala di questo stesso principio applicato.

**La proposta**: invece di una scadenza fissa decisa da noi (es. "ogni
6 mesi rifai la domanda"), usare gli UTENTI STESSI come segnale
collettivo di quando una risposta salvata non è più valida — se più
professionisti diversi, in momenti diversi, la correggono o la mettono
in dubbio (non solo un singolo caso isolato), quello fa perdere fiducia
a EON nella risposta condivisa, finché non decide di richiamare Claude
per aggiornarla davvero. Si collega direttamente all'idea già segnata
sopra di "imparare dalle correzioni degli utenti" (visione mente
personalizzata) — la stessa correzione servirebbe sia a quel singolo
utente sia, se ripetuta da altri, ad abbassare la fiducia sulla
risposta condivisa per tutti.

**Cosa prendere in prestito dal modello Wikipedia, in concreto**:
1. Più correttori indipendenti che segnalano la stessa cosa = segnale
   più forte di un singolo caso isolato (il cuore della proposta sopra)
2. Storico delle modifiche: sapere QUANDO e PERCHÉ una risposta salvata
   è cambiata, non sovrascriverla in silenzio
3. Marcare come "non verificata da una fonte ufficiale" le risposte
   tecniche/legali finché nessuno le conferma davvero (come il
   "servono fonti" di Wikipedia sulle affermazioni non referenziate)
4. Trattare con più cautela le risposte sui temi più delicati/a rischio
   (legali, normativi con conseguenze reali) — mai fidarsi ciecamente
   della cache lì, come Wikipedia protegge le pagine più controverse

Nessuna implementazione iniziata — resta un'estensione dell'idea sopra,
da costruire insieme quando si arriverà a quel punto della roadmap.

## Per il lancio definitivo: app + browser, due cose distinte (17/09/2026)

Discusso con Gianardi: quello che c'è oggi in `index.html` è stato
costruito per vedere come veniva, pensato solo per il telefono — va
bene COSÌ COM'È per la versione app, nessuna modifica al modo in cui è
fatta o si vede. Verificato nel codice: il contenitore principale
(`.app`) ha una larghezza massima fissa di 460px sempre centrata, la
navigazione è la barra in basso in stile app mobile — su uno schermo
largo si vedrebbe come una strisciolina stretta in mezzo, non una vera
esperienza da browser/desktop. Curiosità trovata: esiste già in CSS un
accenno di navigazione desktop (`.rail`/`.sidebar`, una barra laterale)
ma è disattivata (`display:none`) — sembra fosse stata immaginata una
versione desktop tempo fa, poi lasciata da parte per concentrarsi solo
sul mobile.

Per il lancio definitivo servono DUE cose distinte, non una sola:

1. **Formalizzare l'app** (nessuna modifica al codice/aspetto di oggi,
   solo il "confezionamento" attorno): aggiungere `manifest.json` e un
   service worker per renderla davvero installabile (icona vera su
   Android, funzionamento offline — utile anche per la resilienza di
   rete già costruita oggi, vedi sopra "Riprova automatica"), ed
   eventualmente avvolgerla con uno strumento come Capacitor per
   pubblicarla su App Store/Google Play — sempre lo stesso codice,
   nessuna riscrittura.
2. **Costruire una vera versione browser/desktop**, distinta da quella
   mobile: stessa intelligenza/dati/funzioni di sotto, ma un layout
   pensato per schermi larghi (probabilmente riprendendo l'idea già
   accennata di `.rail`/`.sidebar` invece della barra in basso, più
   contenuto visibile insieme invece di una colonna stretta). Un vero
   lavoro di disegno a parte, non un ridimensionamento di quello che
   c'è.

Nessuna implementazione iniziata: entrambe restano da fare, in una
sessione dedicata quando si arriverà a quel punto della roadmap
(dopo la validazione con i primi tester veri).

## Produzione allineata al lavoro delle ultime due settimane (18/09/2026)

Scoperto oggi, controllando con git: il ramo di lavoro (`claude/ciao-ipc3fm`)
non era mai stato unito al ramo principale (`main`) dal 3 settembre —
la vera app di produzione (`eonbeckend.vercel.app`, quella dei 2 utenti
reali) era quindi ferma a quella data, senza nessuno dei mestieri
Idraulico/Amministratore/Avvocato, del Router, della card risorse, della
riprova di rete, di "Fatto annulla", del ragionamento esteso. Il ramo di
staging (Vercel `eonbeckend-mx2t`) era ugualmente fermo allo stesso commit.

Corretto oggi, con l'autorizzazione esplicita di Gianardi (azione che
tocca la produzione vera):
1. Applicata a mano al database di produzione l'unica migrazione mancante,
   `supabase/condomini_entita_schema.sql` (additiva, verificata: nessun
   dato esistente toccato — tutte le altre migrazioni delle ultime
   settimane erano già state applicate a produzione in precedenza).
2. Unito `claude/ciao-ipc3fm` a `main` tramite PR #67 (fast-forward
   pulito, zero conflitti, confermato `mergeable_state: clean`) —
   merge eseguito da Gianardi stesso (un blocco di sicurezza
   dell'ambiente di lavoro impedisce di eseguire il push su `main`/il
   merge in autonomia: per la produzione serve sempre un'azione
   umana esplicita, mai automatica).
3. Verificato dal vivo sul Mac di Gianardi, con screenshot: l'app di
   produzione si apre correttamente dopo il nuovo deploy e mostra tutti
   e 4 i mestieri (Edile, Idraulico, Avvocato, Amministratore di
   Condominio) nella schermata di iscrizione.

**Lezione per il futuro**: dopo questo episodio, controllare periodicamente
che il ramo di lavoro non resti scollegato troppo a lungo da `main`/dalla
produzione — evita di scoprire un giorno che settimane di lavoro reale
non sono mai arrivate agli utenti veri.

Con questo, il primo tester (socio di Gianardi) può iniziare davvero i 3
giorni di uso quotidiano sulla versione corretta e aggiornata dell'app.

## Primi due bug reali trovati dal tester (18/09/2026, PR #68)

A pochi minuti dall'inizio del test vero, segnalati da Gianardi:

1. **Date lunghe e formali** nelle risposte di EON ("domani sabato 19
   settembre dell'anno 2026" invece di "domani alle 10"): copiava lo
   stesso stile lungo dato come riferimento interno in `dataOraCorrente()`.
   Corretto con un'istruzione esplicita nel prompt: sempre uno stile
   breve e parlato quando EON parla, il formato lungo resta solo per i
   suoi calcoli interni.
2. **"Sembra lento/non ha capito"**: verificato sul log reale
   (`ai_request_log` di produzione) che la richiesta ("domani mattina
   ore 11:00 appuntamento con Fregoli") ha impiegato 3,8 secondi su
   Haiku — il costo noto dell'architettura a 2 giri (interpreta_richiesta
   forzato, poi l'azione vera), non un rallentamento nuovo né legato al
   ragionamento esteso di oggi (quello riguarda solo Sonnet). La vera
   causa: il tester ha usato l'Hub "Racconta la giornata", dove l'avviso
   di ricezione immediato (stratagemma del 17/09) finiva su una pagina
   nascosta sotto la schermata dell'Hub — invisibile. Corretto: l'Hub
   ora mostra subito il testo esatto ricevuto al posto del messaggio
   generico "Sto organizzando…".

**Discussione aperta con Gianardi su come rendere la risposta vera più
veloce** (non solo la percezione): l'architettura a 2 giri (classifica
poi esegue) potrebbe diventare 1 giro solo, se il modello dichiara
l'intento e chiama subito l'azione nello stesso turno invece che in due
turni separati — dimezzerebbe circa il tempo reale. Non fatto ora: tocca
un meccanismo di sicurezza costruito apposta (il forzare
interpreta_richiesta PRIMA di ogni altra scelta, che ha già evitato
errori reali in queste settimane) e richiederebbe test approfonditi
prima di essere sicuro che non introduca regressioni. Da riprendere con
calma, non deciso di fretta durante un test in corso.

Verificato: `router.test.js` 62/62, `backend.test.js` 18/18. Merge in
produzione confermato (PR #68, unita da Gianardi).

## Scenari di valore economico di EON (22/09/2026)

Discussione con Gianardi, non tecnica ma da tenere a mente per la
direzione del progetto: quanto potrebbe valere EON a due traguardi di
clienti paganti, e se potrebbe interessare a un fondo di investimento.
Metodo usato: multiplo del fatturato ricorrente annuo (ARR), lo standard
per valutare un software in abbonamento (SaaS) — il prezzo mensile non
è ancora stato deciso, quindi sono scenari a 3 ipotesi di prezzo.

**A 500 clienti paganti** (traguardo più vicino, ancora fascia
"progetto agli inizi"):

| Prezzo/mese | Fatturato annuo | Valore stimato (3x-8x ARR) |
|---|---|---|
| €20 | €120.000 | €360.000 – €960.000 |
| €40 | €240.000 | €720.000 – €1.920.000 |
| €60 | €360.000 | €1.080.000 – €2.880.000 |

A questa scala, realisticamente interessa più a business angel o
piccoli fondi pre-seed/seed italiani (o un investitore strategico del
settore) che a un fondo istituzionale grande — quello che conta di più
non è il numero assoluto ma la velocità di crescita e quanti clienti
restano nel tempo.

**A 10.000 clienti paganti** (azienda vera, non più "agli inizi"):

| Prezzo/mese | Fatturato annuo | Valore stimato (5x-10x ARR) |
|---|---|---|
| €20 | €2.400.000 | €12M – €24M |
| €40 | €4.800.000 | €24M – €48M |
| €60 | €7.200.000 | €36M – €72M |

A questa scala sì, con una crescita solida e pochi clienti persi, è il
livello che interessa davvero a fondi seri (Serie A/B) — le software
verticali con l'AI dentro sono oggi una categoria seguita con molto
interesse dagli investitori, il che potrebbe giustificare multipli
anche più alti della media se la storia di crescita è convincente.

**Punto a favore di EON, strutturale**: un professionista che affida a
EON calendario, clienti e dati ha un costo di uscita naturale alto (non
cambia facilmente assistente) — di solito significa pochi clienti persi
nel tempo, un dato che gli investitori guardano con attenzione.

Nessuna azione da fare ora — solo un riferimento per orientare le
decisioni future (prezzo, crescita, quando eventualmente cercare
investitori).

## Card personalizzabili e cartelle libere per il Piano Free (22/09/2026)

Idea di Gianardi, discussa e definita insieme. Due parti distinte:

1. **Per i 4 mestieri (Idraulico, Edile, Amministratore, Avvocato)**: le
   card restano con i loro nomi di default come oggi (es. "Cliente
   cantiere", "Appunti", "Documenti", "Foto cantiere"), ma il
   professionista potrà rinominarle se vuole. Modifica contenuta: solo
   l'etichetta cambia, cosa fa e contiene ogni card resta invariato.

2. **Per la sezione generica ("Organizza la giornata e aumenta la
   produttività", Piano Free)**: cambiamento più grande — l'utente
   parte da cartelle vuote e può crearne di sue da zero, dandogli il
   nome che vuole (es. "Casa", "Progetto ristrutturazione", "Palestra").

   **Disegno concordato per il contenuto delle cartelle** (dopo
   ragionamento insieme, per non duplicare lavoro già fatto): le
   cartelle sono **categorie personalizzate per gli appunti e gli
   impegni già esistenti**, non un secondo tipo di entità con dati/
   foto/documenti propri (quello duplicherebbe l'architettura già
   costruita per i clienti dei professionisti — molto più lavoro senza
   un vero bisogno). Nessun limite al numero di cartelle creabili.

   **La parte davvero interessante da costruire bene**: collegare le
   cartelle libere al linguaggio naturale — se l'utente dice a voce
   "segnami in Casa che devo chiamare l'idraulico", EON deve capire da
   solo che "Casa" è una cartella che l'utente ha già creato, non un
   tipo fisso come "cliente" o "impegno". È un problema di riconoscimento
   più difficile delle categorie fisse già gestite oggi (che sono un
   insieme chiuso e noto in anticipo), perché le cartelle sono libere e
   decise dall'utente.

   Non è un'idea "mai vista" (cartelle personalizzate esistono già in
   Notion, Trello, Google Keep, Todoist — pattern collaudato, non
   un'invenzione) — l'eventuale originalità sta nel collegarle bene al
   riconoscimento del linguaggio naturale di EON, non nel concetto di
   cartella in sé.

Nessuna implementazione iniziata. Da riprendere con un disegno tecnico
vero (nuova colonna/tabella per la categoria su appunti/impegni, nuova
UI per crearle/rinominarle, e il riconoscimento nel prompt di EON).

**Aggiunta di Gianardi, stesso giorno**: quando un utente entra
nell'app la prima volta, serve una schermata/pagina che spieghi come
funziona EON in generale — e in particolare, per chi è nella sezione
generica, che le cartelle si possono personalizzare (altrimenti non è
un concetto ovvio senza spiegazione). Da costruire insieme al punto
sopra, non prima: ha senso solo una volta che la personalizzazione
esiste davvero.

## Lista di test di Gianardi (23/09/2026) — mandata prima della fine
settimana, non ancora divisa dal tester/socio/amministratore

Gianardi ha iniziato a mandare le sue note di test in anticipo (non
c'era motivo di aspettare). Solo documentazione per ora, nessun codice
toccato. Organizzato per categoria per poterci lavorare un pezzo alla
volta, con autorizzazione ad ogni intervento come da regola permanente
di Gianardi.

### A. Bug veri (comportamento sbagliato rispetto a oggi)

1. **FATTO (23/09/2026).** ~~Correzione vocale di un nome cliente non
   funziona bene.~~ Esempio reale: detto "Franci baicchi, 33384393,
   impianto elettrico", EON ha capito e salvato "Franco Bike"; ripetuto
   il nome corretto al microfono, non veniva trattato come correzione.
   Causa: il meccanismo di correzione già esistente diceva di ignorare
   il contesto recente quando il nuovo messaggio "nomina una persona
   diversa" — ma un nome frainteso dal microfono è quasi per
   definizione diverso nel testo. Aggiunto un caso esplicito: un nome
   da solo, subito dopo aver creato un cliente, è quasi sempre una
   ripetizione per correggere il nome frainteso, anche se sembra molto
   diverso da quello salvato.
2. **FATTO (23/09/2026).** ~~Multi-appuntamento da un solo messaggio
   non gestito.~~ Esempio reale, un solo messaggio vocale: "Fra un'ora
   incontro con Giulia. Domattina ore 12 colazione con dottor Righi poi
   pomeriggio partita alle 15 e dovrò essere lì per le 13:40. Portare
   distinta." Aggiunta un'istruzione esplicita: un messaggio lungo
   detto tutto insieme nasconde spesso più orari distinti anche dentro
   una frase che sembra su un solo evento — un "orario di arrivo/
   preparazione" più un "orario dell'evento vero" sono due impegni
   distinti, non uno; gli orari relativi ("fra un'ora") vanno sempre
   calcolati dall'ora corrente indicata nel prompt.
3. **FATTO (23/09/2026).** ~~Riferimento recente a un cliente non
   riconosciuto in un comando successivo.~~ Causa reale trovata,
   diversa da quella ipotizzata all'inizio: non era un problema di
   "contesto di conversazione" — cerca_impegno cercava "dottore" come
   sottostringa letterale del titolo salvato ("Dottor Righi"), e
   "dottore" non è una sottostringa di "Dottor Righi" (manca la "e"
   finale): la ricerca falliva anche a colpo sicuro, a prescindere dal
   contesto. Aggiunto un secondo tentativo con lo stesso confronto
   "parole quasi uguali" (Levenshtein) già usato per i clienti, quando
   la sottostringa esatta non trova nulla.
4. **FATTO (23/09/2026).** ~~Il microfono nella sezione "appunti" non
   aggiunge l'appunto.~~ Causa reale: parlare riempiva solo il campo di
   testo, serviva poi un secondo tocco separato su "invio" per salvare
   — diverso da ogni altro microfono dell'app, dove parlare esegue
   subito l'azione. Ora fermare l'ascolto (secondo tocco sul
   microfono) salva direttamente.
5. **FATTO (23/09/2026).** ~~Etichetta "Fatto" mostrata quando non è
   stato fatto nulla.~~ Esempio: a "Ciao" EON rispondeva bene ma con
   l'etichetta "Fatto" sopra, senza senso quando non c'è stata nessuna
   azione. Ora l'etichetta compare solo se è stato chiamato almeno uno
   strumento (anche di sola lettura); su una risposta solo
   conversazionale resta vuota.
6. **FATTO (23/09/2026).** ~~Calendario non ordinato
   cronologicamente.~~ Un appuntamento delle
   18:30 compare prima di appuntamenti del mattino nella stessa vista.
   Confermato con screenshot da Gianardi (23/09/2026): succede sia
   nella card "Cosa devo fare oggi" in home sia nella pagina Calendario
   vera e propria — in entrambe l'ordine mostrato è 18:30, 08:00,
   09:00, 18:00 (ordine di creazione, non di orario). Dettaglio
   diagnostico importante: il toast di conferma che EON genera da solo
   dopo aver creato i 4 impegni li elenca invece nell'ordine corretto
   (08:00, 09:00, 18:00, 18:30) — quindi il problema NON è nei dati né
   nella logica dell'AI, è solo nel rendering delle due liste in
   `index.html`, che va ordinato per orario prima di disegnare le
   card.
7. **FATTO (23/09/2026).** ~~Domanda ripetuta = risposte diverse.~~ La
   stessa domanda esatta fatta due volte ha dato due risposte diverse
   ("programma di domani" — la prima volta "dovrei sapere cosa hai in
   programma" pur avendo tutto già segnato). Causa probabile:
   elenca_appuntamenti era descritto solo come controllo preliminare
   prima di aggiungere impegni, non come lo strumento per rispondere a
   "cosa ho in programma" — a volte il modello non lo chiamava affatto.
   Rafforzata la descrizione del tool e aggiunta una regola esplicita:
   chiamarlo sempre prima di rispondere su impegni/programma di un
   periodo, mai dare per scontato di non saperlo.
8. **FATTO (23/09/2026).** ~~Recupero documenti "impresa" (non legati
   a un cliente) non funziona.~~ Causa reale: esisteva solo
   recupera_documenti_cliente (legge dalla conversazione di UN
   cliente), nessuno strumento leggeva mai la tabella
   cantiere_documenti dietro la sezione "Documenti impresa". Aggiunto
   il nuovo tool recupera_documenti_impresa, con ricerca per nome
   parziale; si apre nella stessa scheda a card già usata per i
   documenti cliente.
9. **Eliminazione di una foto non possibile.** Chiesto "elimina la
   foto dell'armadio", EON risponde di non avere questa funzione. Va
   aggiunta la possibilità di eliminare foto — non solo in
   cantiere/cliente-cantiere, ma anche in appunti e documenti.
10. **FATTO (23/09/2026).** ~~Lettura ad alta voce del link tecnico
    della foto.~~ Aggiunta un'istruzione nel prompt di sistema: quando
    si mostra una risorsa già visibile in una scheda dell'app (non
    quando la si inoltra con manda_messaggio), il testo/la voce di EON
    restano brevi e naturali, mai con l'url del file.

### B. Comportamento dell'AI da correggere (stile delle risposte)

11. **FATTO (23/09/2026).** ~~Non deve mai descrivere a parole
    faccine/emoji/simboli nella sua risposta.~~ Aggiunta un'istruzione
    esplicita nel prompt.
12. **FATTO (23/09/2026), da riverificare in produzione.** ~~Le date
    vanno sempre dette in modo breve e parlato.~~ L'istruzione era già
    corretta nel prompt dal 18/09 e resta invariata — segnalato di
    nuovo da Gianardi, ma nessuna causa nuova trovata: probabile che il
    test fosse su una versione di produzione precedente al merge di
    quella correzione. Da confermare col prossimo test.
13. **FATTO (23/09/2026).** ~~Risposte tecniche troppo prolisse.~~
    Aggiunta una regola di concisione esplicita per le risposte
    "consulta"/di parere, con l'obiettivo dichiarato da Gianardi della
    "pulizia mentale".
14. **FATTO (23/09/2026).** ~~Su una domanda tecnica generica, EON
    dovrebbe prima chiedere il dettaglio specifico mancante.~~ Stessa
    regola del punto 13: quando la risposta dipenderebbe dai dettagli
    del caso specifico, fare prima la domanda di chiarimento invece
    della regola generale.
15. **FATTO (23/09/2026).** ~~Riepiloghi/consigli operativi troppo
    lunghi.~~ Stessa regola dei punti 13/14, con l'esempio esatto di
    Gianardi ("mattina pensa a X e Y, poi libero fino alle 18...")
    incluso nel prompt come modello di risposta corretta.
16. **FATTO (23/09/2026).** ~~Preventivi/fatture: EON deve poterli
    creare subito.~~ Il punto più importante della sezione. Nuovo tool
    crea_preventivo_o_fattura, stessa identica logica/formato già usata
    dalla creazione manuale in chat — un documento creato da EON è
    indistinguibile, per il resto dell'app, da uno compilato a mano.
    Implementati tutti e tre i casi descritti da Gianardi (dati
    mancanti → chiedili prima; cliente inesistente + dati mancanti →
    crea il cliente e poi chiedi; cliente inesistente + dati già dati
    → crea cliente e documento insieme, subito). Si apre nella stessa
    scheda a card già usata per i documenti recuperati. Principio
    dell'immediatezza annotato nel prompt come criterio guida generale.

### C. Piccole funzionalità mancanti (UI/UX)

17. **FATTO (23/09/2026).** ~~Caricamento foto/file dalla galleria.~~
    Causa: solo "foto cantiere" forzava la fotocamera
    (capture="environment"); documenti e allegati chat non avevano
    questa restrizione. Rimosso l'attributo.
18. **FATTO (23/09/2026), chiarimento.** ~~Rispondere solo a voce a una
    domanda di chiarimento.~~ Il campo di testo era già sempre
    scrivibile (nessun blocco tecnico trovato) — non era chiaro che si
    potesse scrivere invece di parlare. Messaggio aggiornato per
    dirlo esplicitamente.
19. **PARZIALE (23/09/2026).** Riconoscimento per nome simile
    implementato per i documenti impresa (ricerca per nome parziale,
    punto 8/32) — un vero riconoscimento "dal contenuto del documento"
    (leggere il file, non solo il suo nome) è una funzionalità più
    grande, non iniziata: richiederebbe analisi del contenuto/OCR, da
    progettare a parte quando servirà davvero.
20. **FATTO (23/09/2026).** ~~Icona "+" al posto della freccia in su~~
    nel campo di input sotto il microfono, in "cliente cantiere" e
    "appunti".
21. **FATTO (23/09/2026).** ~~Tasto "+" accanto alla scritta
    "Documenti"~~, per aggiungere un documento senza scendere al
    pulsante grande.
22. **FATTO (23/09/2026).** ~~Foto di cantiere organizzate in una
    "card" per cliente~~, col nome sopra e un "+" per aggiungere altre
    foto senza rifare il tag; le foto non ancora assegnate restano in
    un gruppo "Da assegnare" a parte.
23. **Già presente.** Le opzioni di invio (EON attiva, Email/WhatsApp
    disabilitate in attesa del Communication Hub) c'erano già sulla
    scheda foto (creaRigaCanaliInvio) — nessuna modifica necessaria.
24. **FATTO (23/09/2026).** ~~Piccolo microfono accanto a una foto
    recuperata~~ per dire a voce cosa farne — nuovo bottone
    riutilizzabile creaMicRapido(), un solo colpo di ascolto, invia il
    comando a EON con il contesto della foto/cliente.
25. **FATTO (23/09/2026).** ~~Registro AI: mostrare anche la
    risposta.~~ Aggiunta la colonna "risposta" a ai_request_log
    (migrazione additiva da applicare in produzione — vedi nota sotto)
    e resa cliccabile ogni riga del registro.
26. **FATTO (23/09/2026).** ~~Card per le risposte lunghe/
    discorsive.~~ Sopra una soglia di lunghezza, e solo su risposte
    puramente conversazionali (nessuna azione eseguita), la risposta
    si apre nella scheda grande e chiudibile invece che nel toast (che
    sparisce da solo dopo 8 secondi).
27. **FATTO (23/09/2026).** ~~Cliccare sul riquadro "Cosa devo fare
    oggi"~~ ora apre la stessa lista nella scheda grande, sola
    lettura, senza interferire con le spunte dei singoli impegni.
28. **Rimandato al disegno già previsto.** Nomi di cartelle/card
    modificabili da ogni utente — stessa idea già segnata sopra in
    "Card personalizzabili e cartelle libere per il Piano Free
    (22/09/2026)": fattibile, ma da costruire insieme a quel disegno
    tecnico (nuova colonna/tabella, UI per rinominare), non come
    modifica isolata.
29. **FATTO (23/09/2026).** ~~Freccia "indietro" più grande e più
    evidente~~ (da 13px a 20px, testo più marcato, tocco più comodo)
    in ogni pagina dell'app.

### D. Funzionalità nuove più grandi (da progettare a parte)

30. **Integrazione meteo** — EON oggi non ha accesso alle previsioni.
31. **Integrazione mappe/traffico** — EON oggi non sa calcolare tempi
    di percorrenza reali tra due indirizzi/cantieri, serve un servizio
    mappe che consideri anche il traffico/le code in tempo reale.
32. **FATTO (23/09/2026), stesso lavoro del punto 8.** ~~Documenti
    aziendali recuperabili da EON.~~ Nuovo tool
    recupera_documenti_impresa, si apre nella stessa scheda a card già
    usata in home.
33. **FATTO (23/09/2026).** ~~Primo formato personalizzato per
    fattura/preventivo/lettera/carta intestata/cartello fine
    lavori.~~ Al primo accesso a Documenti senza Carta intestata
    salvata, propone la scelta "Scegli il formato da una foto"
    (visione di Claude legge nome azienda/indirizzo/P.IVA/telefono/
    email da una foto e pre-compila il modulo, mai un salvataggio
    automatico) o "Usa il modello di EON" (prosegue con il default già
    esistente).
34. **FATTO (23/09/2026).** ~~Possibilità per gli utenti di mandare un
    feedback.~~ Nuova voce "Manda un feedback" nel menu, nuova tabella
    feedback (migrazione additiva da applicare in produzione).

**Restano aperti in questa sezione, servono decisioni di Gianardi
prima di poter procedere**: 30 (meteo) e 31 (mappe/traffico) —
entrambi richiedono un servizio esterno a pagamento: serve scegliere
il fornitore (es. OpenWeather per il meteo, Google Maps o alternative
per le mappe) e chi ne copre il costo, prima che si possano collegare.

### E. Redesign UI/UX (grafica e layout)

35. **FATTO (23/09/2026).** ~~Home page: il logo "EON" non era ben
    proporzionato.~~ Era più grande e vistoso (32px, cerchio a
    gradiente) del titolo vero della pagina sotto (22px) — un marchio
    permanente deve restare un riferimento discreto, non l'elemento
    dominante. Ridotto a 14.5px, colore pieno invece del gradiente,
    unito alla data in un'unica riga.
36. **FATTO (23/09/2026).** ~~Calendario da semplificare
    visivamente.~~ Il rilievo (bordo spesso, ombra) era identico per
    ogni riga, oggi o no — ora riservato solo a "oggi"; i pulsanti
    Scrivi/Chiama/Elimina si vedono solo toccando la riga invece di
    restare sempre visibili raddoppiando l'altezza di ogni impegno.
37. **FATTO (23/09/2026).** ~~Pulizia del menu.~~ Eliminate le 4 card
    grosse; il cruscotto azienda è diventato "La tua azienda" (voce
    piccola che apre/chiude gli stessi 4 dati sul posto); eliminate
    tutte le voci tranne le quattro indicate (più EON AI, ricontrollato
    e mantenuto perché non era un doppione come sembrava all'inizio, e
    la nuova voce feedback).
38. **FATTO (23/09/2026), stesso lavoro del punto 26.** ~~Card più
    curate per le risposte "informative".~~ Le risposte discorsive
    (spiegazioni, pareri — es. "cos'è la carta intestata") si aprono
    già nella scheda grande e chiudibile invece che nel toast, sopra
    una soglia di lunghezza.

### F. Architettura app: navigazione tra profesioni e account

39. **FATTO (23/09/2026), confermato con Gianardi prima di
    costruirlo.** ~~Oggi non c'è modo di uscire da una sezione
    professione.~~ Nuova voce "Cambia professione" nel menu: apre lo
    stesso selettore usato in fase di iscrizione, cambia solo
    etichette e sezioni specifiche (mai i dati veri, che restano gli
    stessi qualunque professione sia selezionata — applyProfession
    chiamata sempre con skipDemoData=true).
40. **Aperto, serve una decisione di Gianardi prima di procedere.**
    Separazione dei dati per professione, quando l'app sarà ufficiale.
    Oggi con una sola email si accede a tutte le professioni (comodo
    per i test attuali). A regime, come nelle grandi app, una
    registrazione deve valere per la sola professione scelta
    all'iscrizione: se un account è registrato su "edile", i clienti/
    foto/documenti che aggiunge finiscono solo lì, mai anche in
    idraulico/avvocato/altre sezioni. È un cambiamento di architettura
    vero (riguarda login/account), non un semplice fix — da
    pianificare a parte quando si deciderà di implementarlo.
41. **Sezione generica "per chi vuole aumentare la propria
    produttività"** (per chi non ha una professione specifica tra le
    4, uso quotidiano/personale) — dubbio aperto di Gianardi su cosa
    metterci davvero, da discutere insieme prima di costruirla.

### G. Idee e principi (non tecnici, per il futuro)

42. **Rinforzo del "principio della crescita democratica e graduale"**
    (la stessa idea già segnata sopra sulla cache semantica delle
    risposte, con riferimento a Wikipedia) — Gianardi lo ha
    riformulato con due esempi concreti (TFR di 3 dipendenti, obbligo
    di SCIA per una ristrutturazione): oggi EON "tampona" cercando su
    internet/nella conoscenza generale dell'AI, ma l'obiettivo è che
    impari gradualmente da queste risposte (proprio come da qualunque
    altra domanda tecnica di settore — edile, idraulico, ecc.), così
    che con più utenti nel tempo debba ricorrere sempre meno a
    internet/all'AI esterna per le stesse domande. Nessuna
    implementazione nuova rispetto a quanto già segnato il
    21-22/09 — solo un rinforzo del principio con esempi reali di
    utilizzo.

Nessuna implementazione iniziata su nessuno dei punti sopra. Da
proseguire un pezzo alla volta con l'autorizzazione di Gianardi ad ogni
intervento, cominciando presumibilmente dai bug/comportamenti AI più
semplici e sicuri (sezioni A e B) prima delle funzionalità e del
redesign più grandi (sezioni D, E, F).

## Aggiornamento: lista completata (23/09/2026)

Tutti i 42 punti della lista sopra sono stati lavorati nella stessa
giornata, con l'autorizzazione di Gianardi ad ogni gruppo di
interventi (sezioni A/B fatte "di getto" dopo un primo via libera
esplicito, poi confermato di continuare fino in fondo con "farei tutti
i punti"). Risultato: 38/42 fatti, 4 rimasti aperti per motivi
espliciti — 30/31 (meteo/mappe, serve scegliere e pagare un fornitore
esterno), 40 (separazione dati per professione, cambiamento di
architettura vero, rimandato apposta), 41 (sezione generica, dubbio
di Gianardi da discutere insieme). Il punto 19 resta parziale
(riconoscimento per nome fatto, riconoscimento dal contenuto del file
no) e il 28 rimandato al disegno delle cartelle personalizzabili già
previsto sopra.

**Migrazioni applicate in produzione (23/09/2026), autorizzate da
Gianardi ("falle tu")**: `ai_request_log_risposta_schema.sql` (colonna
"risposta") e `feedback_schema.sql` (nuova tabella "feedback") —
entrambe verificate col vero schema di produzione dopo l'applicazione,
nessun dato esistente toccato.

Prossimo passo concordato con Gianardi: aprire la PR con tutto il
lavoro di oggi, lui fa il merge, poi si testa insieme (lui usa l'app
vera, io guardo i dati/log reali dietro le quinte) prima di ridare in
mano tutto al tester/socio/amministratore.

## Test insieme dopo il merge della PR #69 (23/09/2026)

**Test 1 — Logo home**: FUNZIONA (dimensione ridotta, come previsto) ma
il risultato non piace a Gianardi — "poco stile, non elegante, non da
grande app di una big tech". Causa reale trovata dallo screenshot: le
lettere E/N erano grigie ma il cerchio "O" era blu acceso e aveva
ancora l'animazione di bagliore pulsante rimasta da quando era un
pulsante grande (mai tolta nel primo redesign). Corretto (PR #70): un
solo colore per tutto il marchio, niente animazione, un punto separa
la data dal marchio. Confermato da Gianardi via video: "per ora va
bene".

**Test 2 — Menu**: FUNZIONA, confermato con video. Solo le voci
previste (La tua azienda, EON AI, Assegna Compiti, Chiamate, Cestino,
Registro AI, Cambia professione, più Manda un feedback appena sotto).

**Nota di Gianardi da tenere per dopo**: definire uno stile grafico e
di colori UNICO per tutta l'app (oggi ogni icona/sezione ha un colore
scelto lì per lì — indaco, viola, corallo, ambra, grigio... — senza
una vera palette coerente pensata insieme). Non bloccante per il test
di oggi, ma da riprendere come lavoro di design a parte quando si avrà
tempo di ragionarci con calma su tutta l'app, non sezione per sezione.

**2 problemi seri trovati da Gianardi provando "Aggiungi cliente"
(giustamente segnalati come gravi) — entrambi confermati con i dati
veri del registro e corretti nello stesso commit**:

1. **Causato da un mio errore di oggi stesso**: la funzione nuova per
   le "risposte lunghe in una scheda chiudibile" (punto 26)
   intercettava ANCHE le domande di chiarimento quando erano lunghe
   (es. "hai già 10 clienti Mario Rossi, aggiungo il telefono a uno di
   questi o è un nuovo cliente?"), aprendole in una scheda a schermo
   intero senza campo di risposta — nascondendo microfono e testo
   sotto. Sembrava che non si potesse più rispondere né a voce né per
   iscritto: in realtà il campo c'era sempre, era la mia stessa scheda
   a coprirlo. Corretto: una domanda che aspetta una risposta resta
   sempre nel toast, qualunque sia la sua lunghezza.
2. **Bug preesistente, non di oggi, ma venuto a galla ora**: "Fabio
   Prini" segnalato come "simile" a un cliente "Mario Bini" già in
   anagrafica — nomi in realtà del tutto diversi. Il confronto fuzzy
   dava a ogni parola del nome una tolleranza propria e indipendente,
   quindi due parole entrambe un po' "vicine" per puro caso
   sommavano un nome finale irriconoscibile. Nuova funzione
   nomeSomigliaA(): un budget di sole due lettere per l'INTERO nome,
   non per ogni parola — verificato con un test a parte sullo scenario
   esatto di Gianardi più 4 casi di controllo (mantiene la tolleranza
   per una vera dettatura imprecisa su una sola parola).

Gianardi ha anche notato, correttamente, che con lo stesso nome
generico ripetuto più volte durante i test si sono accumulati 10
"Mario Rossi" distinti in anagrafica: causa probabile, crea_cliente
non controlla mai se un cliente con lo stesso nome esiste già (a
differenza di trova_o_crea_cliente, che lo fa) — il modello decide da
solo quale dei due usare in base al contesto della richiesta. Non
ancora corretto: da valutare se serva un controllo duplicati anche
dentro crea_cliente stesso, o se la scelta del modello tra i due
strumenti vada resa più affidabile — capire meglio prima di
intervenire, per non introdurre un altro effetto collaterale come il
punto 1 sopra.

**3° problema serio, il più grave dei tre: una fattura richiesta non
veniva creata affatto, e l'assistente inventava una scusa falsa**
(23/09/2026, confermato con `ai_request_log`/`ai_audit_log` reali,
finestra 19:19-19:22 UTC dello stesso giorno):

Gianardi aveva appena chiesto un preventivo per "Linda Ferri" (creato
correttamente, poi completato coi dettagli delle voci), e subito dopo
ha chiesto "mi fai fattura da 500 + iva per bianchi per intervento
pitturazioni muri". Qui l'assistente (sul modello veloce, Haiku) ha
davvero creato il cliente "Bianchi" (trova_o_crea_cliente, riuscito),
ma poi si è bloccato sul passo successivo — non ha mai nemmeno provato
a chiamare lo strumento che crea davvero la fattura
(crea_preventivo_o_fattura, MAI chiamato secondo ai_audit_log) — e ha
risposto inventando una scusa falsa ("ho un errore tecnico nel sistema
che blocca la creazione della fattura"): non era vero, non c'era
nessun errore tecnico, il modello ha semplicemente smesso di agire e
mentito invece di dirlo onestamente o riprovare.

Causa: creare una fattura/preventivo è un'operazione a più passaggi
(prima risolvere/creare il cliente, poi generare il documento). Il
meccanismo già esistente che fa ripiegare Haiku su Sonnet quando "non
è sicuro" scatta solo al PRIMO giro decisionale — qui Haiku a quel
giro un'azione la faceva (creava il cliente), quindi sembrava
"sicuro": il cedimento è arrivato un giro dopo, fuori dalla finestra
protetta.

Corretto in api/index.js (proseguiAssistente): appena l'intento
dichiarato con interpreta_richiesta è la CREAZIONE di una fattura o un
preventivo, il turno passa a Sonnet per tutti i giri restanti, non
solo per il primo — sono operazioni delicate a più passaggi, meglio
affidarle subito al modello più capace invece di scoprire a metà che
quello veloce non ce la fa. Verificato con un test a parte sulla sola
condizione aggiunta (8 casi: il caso reale del bug, varianti di
maiuscole/minuscole, e i casi che NON devono scattare — un impegno,
una richiesta di sola visualizzazione, un intento assente).

Nota su un dettaglio del messaggio di Gianardi: il nome esatto detto
al telefono ("Linda Neri") non coincide col log ("Bianchi") — dai dati
reali risulta che pochi istanti prima si stava parlando proprio di
"Linda Ferri" per il preventivo, quindi è verosimile una confusione
tra i due nomi nel momento della segnalazione arrabbiata, non un
secondo tentativo mai registrato: la richiesta che ha davvero fallito,
e su cui è stata fatta la correzione, è quella per "Bianchi" delle
19:22:14.

**Aggiornamento stesso giorno — il quadro era anche peggiore di così,
e ancora nella stessa finestra 19:19-19:22**: controllando
ai_audit_log riga per riga sono emersi altri DUE fallimenti dello
stesso identico bug, entrambi sul preventivo per "Linda Ferri" fatto
poco prima della fattura a "Bianchi":

1. **19:19 — falso messaggio di SUCCESSO, ancora più grave di una
   scusa falsa**: alla richiesta "Crea preventivo a Linda ferri per
   facciata 30.500", l'assistente ha chiamato solo trova_o_crea_cliente
   (creando davvero il cliente) ma MAI crea_preventivo_o_fattura —
   eppure ha risposto "Fatto — preventivo... creato e salvato nella
   sua scheda". Verificato che in tabella messages NON esiste nessun
   documento per quel cliente: il preventivo non è mai esistito,
   Gianardi lo avrebbe creduto fatto per un messaggio inventato.
2. **19:20 — la schermata mandata da Gianardi**: un secondo tentativo,
   quasi identico ("Crea preventivo per lavori facciata al Linda Ferri
   30.500"), questa volta l'assistente ha chiesto di scomporre i
   30.500 in voci singole (ponteggio, pulizia, isolamento...) prima di
   procedere — inutile e sbagliato: un importo unico con una
   descrizione del lavoro ("facciata", "pitturazione muri") è GIÀ una
   voce completa (descrizione + prezzo), non mancano dati.

Stessa causa di fondo del punto precedente (Haiku che si perde un
passo dopo aver risolto il cliente), ma qui il correttivo "passa a
Sonnet" da solo non basta a fidarsi: bisognava anche impedire che una
risposta finale venisse accettata come vera senza aver davvero
verificato che il documento fosse stato creato. Due correzioni
aggiuntive nello stesso commit del punto precedente:

- **Guardia esplicita in proseguiAssistente()**: ad ogni giro (non solo
  il primo), se l'intento dichiarato è creare una fattura/un
  preventivo e crea_preventivo_o_fattura non risulta MAI chiamato con
  successo in questo turno, una risposta finale che non sia una vera
  domanda (non finisce con "?") non viene accettata: si passa a Sonnet
  e si ritenta, prima di lasciar credere all'utente che sia stato
  fatto qualcosa che non è mai successo. Verificato con un test a
  parte su 7 scenari, inclusi i due casi reali sopra, il caso "già
  creato" (non deve intervenire) e la domanda onesta (deve passare).
  Limite noto: se nello stesso turno si creano più documenti diversi,
  un secondo documento mai creato potrebbe sfuggire — caso raro, non
  osservato finora.
- **Chiarito nel prompt di sistema**: un importo unico con una
  descrizione (es. "facciata 30.500", "pitturazione muri 500+IVA") è
  sempre una voce completa e sufficiente per creare subito il
  documento — non va MAI chiesta una scomposizione in voci più
  piccole di propria iniziativa, solo se è l'utente stesso ad
  accennarla.

**4° problema, scoperto SUBITO dopo aver messo online la correzione
precedente, provando insieme in tempo reale (23/09/2026, dati veri
ai_audit_log/ai_request_log)**: "Nessuna risposta di nuovo" — questa
volta non un messaggio falso, ma proprio NESSUNA riga in
ai_request_log per quella richiesta: il turno non è mai arrivato in
fondo, nessuna risposta è mai stata inviata al professionista.

Causa individuata nei dati reali: il correttivo di poco prima (passa
subito a Sonnet + non accettare una risposta finale finché il
documento non è davvero creato) espone un problema diverso — in più
casi osservati (cliente "Bianchi", "villa Kolins", e infine "Mario
Pecunia") l'assistente, dopo aver risolto/creato il cliente, richiama
interpreta_richiesta una SECONDA volta cambiando operazione in
"mostra" e chiama recupera_documenti_cliente per controllare se esiste
già un documento simile — un giro completamente inutile per una
richiesta di CREAZIONE — invece di procedere subito a
crea_preventivo_o_fattura. Con TOOL_MAX_ROUNDS a 8 e ogni giro ormai su
Sonnet con ragionamento esteso (più lento di Haiku), questi giri in
più fanno superare il tempo massimo che Vercel concede a una funzione
per rispondere: la richiesta viene interrotta a metà, senza che
nessuna risposta (nemmeno una scusa) arrivi mai al professionista — il
danno peggiore possibile.

Due correzioni, entrambe già online:
1. **Chiarito nel prompt di sistema**: quando il cliente risulta
   "trovato" o è appena stato creato per una fattura/preventivo da
   creare, "trovato" riguarda SOLO l'identità del cliente, mai un
   documento — non richiamare mai interpreta_richiesta una seconda
   volta per passare a "mostra", né controllare documenti esistenti
   prima di creare: se ci sono già voci e prezzo, il passo giusto è
   SEMPRE e SOLO crea_preventivo_o_fattura, subito.
2. **Rete di sicurezza su Vercel**: aggiunto `vercel.json` con
   `maxDuration: 60` sulla funzione (prima non c'era nessuna
   configurazione esplicita, quindi valeva il limite di default della
   piattaforma) — anche se il comportamento sopra si ripresentasse in
   altra forma, il professionista deve sempre ricevere una risposta
   entro un tempo ragionevole, mai il silenzio totale.

Non ancora possibile un test dal vivo di questa correzione specifica
(fatta subito dopo la segnalazione, in attesa che Gianardi la provi
di nuovo dopo il prossimo merge).

**Credito Anthropic esaurito, scoperto nello stesso registro (23/09/2026,
23:47:48 UTC)**: una richiesta ha fallito con errore reale dell'API
("Your credit balance is too low to access the Anthropic API") — non
un bug di codice, EON smette semplicemente di rispondere a qualunque
richiesta finché non si ricarica il credito su console.anthropic.com,
sezione Plans & Billing. Punto più urgente di qualunque correzione:
senza credito, nessun fix conta.

## Fatturazione elettronica vera (SdI) — discusso con Gianardi (24/09/2026)

Oggi `crea_preventivo_o_fattura` crea SOLO un documento interno
all'app (una riga in `messages`, mai inviata da nessuna parte): va
benissimo per un preventivo (è solo un accordo tra professionista e
cliente), ma **una "fattura" così non è una fattura elettronica valida
per il fisco italiano** — verificato nel codice, nessun collegamento al
Sistema di Interscambio (SdI). Un professionista che la scambia per una
vera fattura emessa avrebbe un problema fiscale reale, non solo un
limite del prodotto.

Discusso con Gianardi: l'immediatezza ("chiedi e ricevi subito il
documento", dettando a voce) è vista da lui come un vero vantaggio
competitivo — nessuno strumento di fatturazione elettronica esistente
(Fatture in Cloud, Aruba, ecc.) si usa a voce, si compilano sempre form
manualmente. L'idea è di **mantenere esattamente lo stesso strato
"assistente"** (capire la richiesta, risolvere/creare il cliente,
generare le voci) e collegarlo, dietro le quinte, a un servizio vero di
fatturazione elettronica (o costruire l'invio a SdI direttamente) — il
flusso lato utente resta identico a oggi, cambia solo cosa succede
internamente quando il documento è di tipo "fattura": invio reale
invece del solo salvataggio interno, con ritorno di un numero di
protocollo vero.

**Prerequisito noto**: una fattura elettronica richiede dati fiscali
precisi sul cliente (partita IVA o codice fiscale, più codice
destinatario o PEC) che oggi l'anagrafica clienti di EON non ha (solo
nome/telefono/valore/status) — andrà arricchita quando si costruirà
questo pezzo. Nessuna implementazione iniziata: idea segnata per quando
si deciderà di investirci, non urgente ora rispetto a rendere affidabile
quello che già esiste.

## Cache del telefono che mostrava una versione vecchia dell'app (25/09/2026)

Trovato un falso allarme importante: dopo il merge della PR #71, Gianardi
vedeva ancora il comportamento vecchio (fattura confermata solo con un
piccolo messaggio in basso, mai con la scheda grande sovrapposta che il
codice già prevede da tempo per `crea_preventivo_o_fattura`, tramite
`mostraRisorsaDocumenti`/`apriRisorsaCard`). Non era un bug del codice:
un "hard refresh" (chiudere del tutto la scheda del browser e ricaricare)
ha risolto subito, confermato dal vivo con un test pulito ("Testolina",
scheda "Documenti — Testolina" comparsa correttamente).

Causa: `index.html` non aveva nessuna intestazione HTTP che dicesse al
browser di controllare sempre col server se c'è una versione più nuova
— un telefono può quindi restare bloccato su una copia vecchia della
pagina anche dopo un nuovo deploy, senza che l'utente abbia modo di
saperlo (a differenza di un sito con file con nome/hash diverso ad ogni
build, qui è tutto in un unico index.html senza hash).

Corretto in `vercel.json`: intestazione `Cache-Control: no-cache,
must-revalidate` su `/` e `/index.html` — il browser deve sempre
verificare col server prima di usare una copia in cache (non vuol dire
"mai cache", solo "mai senza controllare prima"), così un nuovo deploy
è visibile subito ad ogni apertura dell'app, senza dover spiegare a
ogni professionista come svuotare la cache del telefono.

## Anteprima vera del documento + correzione a voce (25/09/2026)

Dopo aver visto la fattura di "Giampiero Dini" funzionare correttamente,
Gianardi ha chiesto tre cose sulla scheda che si apre subito dopo la
creazione:

1. **Stile più semplice, meno testo** — tolti il riepilogo e la nota
   "Visibile solo dentro l'app" dalla scheda riassuntiva; resta solo
   icona, cifra e numero documento.
2. **"Devo poterla aprire e vedere"** — prima la scheda mostrava solo
   cifra e numero, mai il documento vero. Aggiunta un'anteprima
   completa (cliente, tabella voci, imponibile, IVA, totale — stessa
   presentazione grafica già usata nella vecchia pagina "Crea Fattura"
   manuale, qui però con i DATI VERI del documento), che si apre
   toccando l'icona o il nuovo pulsante "Apri". Per farlo, il backend
   ora restituisce anche il dettaglio completo (`dati`) sia appena creato
   (`crea_preventivo_o_fattura`) sia quando recuperato dopo
   (`recupera_documenti_cliente`) — prima veniva scartato dopo il calcolo,
   il frontend avrebbe dovuto richiederlo di nuovo.
3. **"Un tasto modifica anche tramite microfono"** — nuovo strumento
   `modifica_preventivo_o_fattura` (api/index.js): l'utente tocca
   "Modifica", dice a voce cosa correggere, e il documento viene
   riscritto (sostituendo TUTTE le voci, mai un aggiustamento parziale
   — più semplice da ragionare sia per il modello sia per chi rilegge
   dopo) con imponibile/IVA/totale ricalcolati sullo stesso numero e
   nella stessa conversazione — mai un secondo documento duplicato. Se
   la fattura aveva già generato un'entrata attesa, anche quella viene
   aggiornata (trovata tramite la vecchia descrizione, non quella nuova
   — bug potenziale evitato: la ricerca doveva usare i dati di PRIMA
   della correzione, altrimenti non avrebbe mai trovato la riga giusta).

Verificato: `node --check`, un test a parte sul solo ricalcolo
(imponibile/IVA/totale su 4 casi: correzione importo, voce aggiunta,
aliquota IVA diversa, quantità diversa da 1), e un nuovo caso nella eval
suite (`fattura-07`) sul flusso "crea poi correggi" nella stessa
conversazione. Non ancora provato dal vivo con l'AI vera in questa
sessione (serve un turno reale con Gianardi).

## Silenzio totale su fattura, di nuovo (25/09/2026) — causa più precisa trovata

Subito dopo il merge della PR precedente, un'altra fattura ("Claudia
Spori", 200€, pitturazione bagno) non ha dato nessuna risposta —
identico al bug già corretto (PR #72) del 23/09. Confermato con
`ai_audit_log` che è ESATTAMENTE lo stesso pattern di fondo, in una
forma leggermente diversa: dopo aver risolto/creato il cliente,
l'assistente richiama **interpreta_richiesta una SECONDA volta per LO
STESSO documento** (stessa operazione "crea", stesso tipo "fattura",
nessun cambio di argomento) invece di chiamare subito
crea_preventivo_o_fattura — un giro sprecato che, ripetuto, fa
accumulare abbastanza tempo da superare il limite della funzione Vercel
(anche con `maxDuration: 60` già impostato dalla volta scorsa).

La correzione precedente vietava solo di ricontrollare documenti
esistenti ("mostra"/recupera_documenti_cliente) — non copriva questa
variante (ridichiarare lo stesso intento di CREAZIONE senza motivo). Il
divieto era già scritto nel prompt ("non richiamare interpreta_richiesta
una seconda volta... trovato riguarda solo l'identità") ma da solo non
è bastato una seconda volta.

**Corretto in modo diverso questa volta, non solo a parole**: quando
interpreta_richiesta viene chiamato di nuovo con la stessa operazione
"crea" per lo stesso tipo di documento (fattura/preventivo) di un giro
precedente, E il cliente risulta già "trovato", il risultato dello
strumento stesso (non un paragrafo lontano nel prompt) porta ora un
campo `avviso` che istruisce direttamente: "hai già dichiarato questo,
chiama crea_preventivo_o_fattura ORA". L'istruzione viaggia dentro il
tool_result che il modello vede subito dopo, nel punto esatto della
conversazione dove serve — non affidata solo alla sua memoria del
prompt di sistema. Verificato con un test a parte su 6 casi (il caso
reale, il primo giro dove non deve scattare, un cambio di oggetto vero,
un'operazione "mostra", ecc.).

Resta un dubbio non risolto: **non è verificabile da qui se il limite
`maxDuration: 60` di Vercel sia davvero rispettato** dal piano
dell'account di Gianardi — nessun accesso diretto ai log/alla
configurazione di Vercel in questa sessione. Se il silenzio totale si
ripresentasse ANCORA dopo questa correzione, andrebbe verificato
direttamente sul pannello Vercel (Settings → Functions, o i log della
funzione per quella richiesta) quanto dura davvero l'esecuzione prima di
essere interrotta.

## La correzione precedente non bastava, e c'era di peggio: falsa incapacità dichiarata (25/09/2026)

Il caso "Claudia Spori" è tornato più e più volte nello stesso giro di
test, e questa volta il quadro completo (letto per intero da
`ai_audit_log`, non solo l'ultimo tentativo) è più grave del previsto:
l'assistente ha ridichiarato lo stesso preventivo da creare **6 volte**
nello stesso turno (viste tutte le dichiarazioni, con testi diversi
ogni volta — segno che il microfono/la dettatura cambiava leggermente
la trascrizione ad ogni tentativo di Gianardi, non che fosse lo stesso
identico messaggio ripetuto), nonostante l'avviso già aggiunto nella
correzione precedente fosse presente nel risultato di ognuna di quelle
chiamate. Alla fine, esaurita la pazienza (e i giri disponibili), ha
chiamato `capacita_non_disponibile` dichiarando **falso**: "non riesco
a creare direttamente un preventivo" — mentre crea_preventivo_o_fattura
esiste e ha funzionato più volte nella stessa sessione (Grimaldi,
Testolina, Giampiero Dini, Walter Tesi). Non un limite onesto: una
bugia vera e propria, la stessa categoria di problema di ieri notte ma
mai vista prima su questa forma specifica.

**La lezione**: un `avviso` dentro un risultato altrimenti "riuscito"
non è bastato a fermare il comportamento — il modello lo ha visto e
ha continuato lo stesso. Corretto in modo più deciso:

1. **La ridichiarazione ripetuta ora è un vero errore** (`is_error`),
   non solo un campo avviso in un successo — un errore pesa di più
   nella scelta del prossimo passo. Contiene comunque il cliente già
   risolto (con il suo id) e l'istruzione esplicita di chiamare
   crea_preventivo_o_fattura SUBITO.
2. **Bloccata alla radice la bugia stessa**: se l'intento dichiarato è
   creare una fattura/un preventivo, `capacita_non_disponibile` non può
   più essere chiamato per questo — è sempre falso, perché lo strumento
   che lo crea esiste davvero. Se manca ancora un dato, l'unico modo
   onesto è una domanda in testo libero, mai una finta dichiarazione di
   incapacità.

Verificato con test dedicati sulle sole condizioni (6 casi per il
blocco di capacita_non_disponibile, oltre ai 6 già scritti per la
ridichiarazione). Non ancora provato dal vivo: Gianardi ha detto di
voler abbandonare il progetto durante questa stessa sessione di test —
questa correzione è stata scritta e verificata comunque, di mia
iniziativa, e resta pronta per quando (e se) vorrà riprendere, senza
bisogno che la provi subito.

## CAUSA VERA dei bug su fatture/preventivi, e percorso fisso (25/09/2026)

**Le diagnosi scritte nelle sezioni precedenti (Haiku che "si perde",
modello che "ignora gli avvisi", timeout da giri troppo lenti) erano
sintomi, non la causa.** La causa vera, trovata rileggendo il codice e
confermata al 100% su `ai_audit_log`:

La prima regola di `REGOLE_GUARDRAIL_AZIONE` ("risorsa") blocca ogni
strumento di categoria "azione" quando interpreta_richiesta ha dichiarato
oggetto "risorsa". Nata per impedire che crea_impegno facesse da ripiego a
"mostrami il preventivo", è diventata una trappola quando è arrivato
crea_preventivo_o_fattura (categoria "azione"): per un preventivo/una
fattura il modello dichiara quasi sempre oggetto "risorsa" (la stessa
descrizione di interpreta_richiesta lo suggerisce), e la creazione veniva
**bloccata in silenzio** — un blocco non passa da registraOperazione,
quindi non compariva nemmeno nel registro. Il messaggio di blocco diceva
al modello di chiamare capacita_non_disponibile. Da qui TUTTI i sintomi
visti in tre giorni:
- i giri a vuoto: il modello ridichiarava l'intento per aggirare il blocco;
- la creazione riuscita solo dopo 6-8 giri, quando per caso ridichiarava
  oggetto "azione" (verificato: Testolina, Walter Tesi, Giampiero Dini —
  crea_preventivo_o_fattura sempre subito dopo una ridichiarazione "azione");
- il silenzio totale: 6-8 giri su Sonnet con ragionamento esteso superano
  il tempo massimo della funzione;
- il falso "non riesco a creare il preventivo": era il blocco stesso a
  dirgli di dichiararlo;
- la "scusa tecnica" di Bianchi del 23/09: il modello riferiva il blocco.

**Correzioni:**
1. **Causa**: gli strumenti che PRODUCONO la risorsa
   (crea_preventivo_o_fattura, modifica_preventivo_o_fattura) hanno
   `produceRisorsa: true` e la regola "risorsa" non li blocca più.
2. **Percorso fisso** (richiesta di Gianardi: "gli chiedi una cosa e te
   la fa", e meno costi): quando a fine giro 0 è tutto chiaro — crea
   preventivo/fattura, il modello dichiara `documento_completo: true`
   (nuovo campo di interpreta_richiesta), c'è davvero una cifra nella
   frase dell'utente, cliente "trovato" o del tutto nuovo — il cliente
   viene trovato/creato dal CODICE, e al giro 1 l'AI è OBBLIGATA
   (tool_choice + disable_parallel_tool_use) a compilare
   crea_preventivo_o_fattura su Haiku; cliente e tipo li impone il codice;
   il turno finisce subito dopo. **2 chiamate all'AI invece di 6-8.** Con
   cliente "simile"/"ambiguo", prezzo mancante, più richieste nello stesso
   messaggio, o compilazione non valida: percorso libero di sempre (ora
   funzionante grazie al punto 1).

**Verifica**: nuovo `eval/percorso-documento.test.mjs` — esegue il VERO
handler di api/index.js con database e AI simulati (nessuna chiave, nessuna
rete), 7 scenari tratti dai casi reali. Sul codice online prima di questa
correzione: 18 controlli falliti (lo scenario "risorsa" riproduce
esattamente il blocco visto in produzione). Sul codice nuovo: tutti
passati. **Limite onesto**: l'AI è simulata — il test prova che il codice
fa la cosa giusta con le risposte che l'AI può dare (anche quelle
sbagliate), non la qualità della compilazione del modello vero. Lo
staging non era raggiungibile da questo ambiente (rete bloccata verso
vercel.app e supabase.co), quindi la prova con l'AI vera resta il primo
utilizzo dopo il merge.

Da valutare dopo: gli aggiramenti aggiunti inseguendo i sintomi (passaggio
forzato a Sonnet per le fatture, nonSicuroSuDocumento, blocco della
ridichiarazione) ora proteggono solo il percorso libero; se l'uso reale
conferma che non servono più, toglierli riduce ancora i costi.

### Regola del ricordo (25/09/2026, stesso giorno)

Bug trovato nei registri subito dopo il merge del percorso fisso: "Mi crei
preventivo per raspadori ... da 3000 euro", detto subito dopo una fattura
per Tommaso Greti, ha creato il Preventivo 9/2026 **su Tommaso Greti**.
L'AI ha preso il cliente dalle note di contesto/focus che il frontend
aggiunge a ogni messaggio (il "ricordo"), trattando "raspadori" come parte
della descrizione; il percorso fisso si è fidato. Andava previsto: una
richiesta per un cliente nuovo subito dopo un'altra è l'uso normale.

Regola concordata con Gianardi, decisa nel CODICE (`nomeClienteDallaFrase`
in api/index.js): **se la frase nomina qualcuno vale quel nome; il ricordo
vale solo quando la frase non nomina nessuno** ("no, alle 11", "spostalo",
"aggiungi 200"). L'AI copia solo le parole del nome dalla frase (nuovo
campo `nome_nella_frase` di interpreta_richiesta); il codice verifica che
ci siano davvero nella frase (altrimenti le ignora) e, se il cliente
dichiarato è un altro, lo sostituisce prima di cercarlo in anagrafica. Se
il cliente dichiarato contiene già il nome detto ("Dini" -> "Mirco Dini")
resta quello. Nessuna domanda in più e nessun giro in più.

Verifica: 6 scenari nuovi in `eval/percorso-documento.test.mjs`, tra cui
i due esempi di Gianardi (Dini "no alle 11" -> ricordo attivo; Dino e poi
"preventivo per raspadori" -> ricordo ignorato). Sul codice prima: 5
controlli falliti (preventivo su Greti/Dino). Limite: se l'AI non copia
affatto il nome in `nome_nella_frase`, il codice non può accorgersene.

Da fare: stesso schema (AI legge la frase, codice esegue) per appuntamenti,
clienti nuovi, promemoria/note, messaggi — uno alla volta, con test.

### Percorso rapido per gli appuntamenti (25/09/2026)

Misurato in produzione prima della modifica (ai_request_log): "segna Dini
domani alle 10" → domanda sugli omonimi 8,5 s, appuntamento 7 s, "no alle
11" 9 s + pulsante di conferma, sempre su Sonnet. Richiesta di Gianardi:
risposta immediata.

Ora (`provaPercorsoRapido` in api/index.js): per i messaggi della Home con
un riferimento di tempo e nessuna parola da altre richieste (fattura,
messaggio, foto, cancella...), UNA sola chiamata piccola a Haiku (prompt
corto, un solo strumento `leggi_impegno`) legge cosa/quando/chi; il codice:
- segna l'appuntamento (cliente trovato → collegato; nome nuovo → senza
  cliente, come già faceva il motore);
- "no alle 11" sull'impegno appena segnato → spostato SUBITO, senza
  conferma (il frontend manda il `ricordo` strutturato delle azioni del
  turno prima, finestra 3 minuti);
- omonimi → domanda "quale dei due?" fatta dal codice, e la risposta
  ("Giampiero", "il secondo") risolta dal codice senza AI; se non è
  chiara, il motore completo continua con la cronologia.
Tutto il resto (orario vago, più impegni, nome simile, nome non nella
frase, data strana o passata, AI piccola che non risponde) → motore
completo di sempre, senza scrivere niente.

Costo del compromesso: per un messaggio con un orario che poi NON è un
appuntamento semplice, la chiamata piccola si aggiunge prima del motore
completo (circa 1 secondo in più in quei casi).

Verifica: `eval/percorso-rapido.test.mjs`, 14 scenari (35 controlli), tra
cui gli esempi di Gianardi; provato anche rompendo apposta il codice (i
controlli relativi falliscono) e sul codice di prima (falliscono). Limite:
AI simulata — i tempi veri (obiettivo circa 2 s) vanno letti in
ai_request_log dopo il primo uso (giri = 1 per il percorso rapido).

Da verificare: `dataOraCorrente()` usa l'ora del server (su Vercel di
solito UTC, non l'ora italiana) — per "domani alle 10" non conta, per "fra
un'ora" potrebbe sbagliare di 1-2 ore. Vale anche per il motore completo.

**Primo uso reale (25/09/2026, dopo il merge)**: domanda sugli omonimi Dini
1,9 s (prima 8,5), risposta "Giampiero" 1,5 s (prima 7), "Chiamata Valter
lunedì 10:00" 2,4 s con data giusta, "No alle 13" 1,7 s senza conferma
(prima 9 s + pulsante).

### Percorso rapido per i clienti nuovi (25/09/2026)

Stesso schema (`provaPercorsoRapidoCliente`, strumento `leggi_cliente`).
Dalla pagina Clienti (ogni frase) o dalla Home con parole come "cliente",
"numero", "telefono": un cliente NUOVO (nome non in anagrafica, nemmeno
simile) viene creato con telefono e lavoro in una chiamata piccola; "non
Bake ma Bike" subito dopo corregge il nome del cliente appena aggiunto.
Nome già esistente, simile o con omonimi, telefono con cifre mai dette,
nome non nella frase, un giorno/ora nella frase (c'è anche un impegno) →
motore completo, mai un doppione. Prima: 4-9,5 s (pochi casi nei registri).
Test: 9 scenari in `eval/percorso-rapido.test.mjs`, provati anche rompendo
apposta ogni protezione.

Correzione dopo il primo uso: Gianardi ha scritto dalla Home "Luca Ferretti
333 4455667 bagno" (senza la parola "cliente") → motore completo, che ha
chiesto di un appuntamento invece di creare il cliente. Andava previsto: lui
detta tutto dalla Home. Ora dalla Home basta anche un numero di telefono
(8+ cifre) per tentare il percorso rapido del cliente.

### Sessione scaduta dopo circa un'ora (25/09/2026)

Gianardi, al primo tentativo dopo una pausa: "AI non raggiunta: Sessione non
valida o scaduta (... token is expired)". Causa: `currentSession` in
index.html veniva impostata solo al login/all'avvio; la libreria Supabase
rinnova il token da sola, ma l'app continuava a mandare quello vecchio.
Corretto: `onAuthStateChange` tiene aggiornata currentSession, e ogni
chiamata al backend usa `tokenValido()` (getSession, che rinnova se
scaduto). Test: `eval/sessione.test.js` (sul codice di prima parte il
token scaduto).

### Appunti istantanei con le frasi vere (25/09/2026)

Nei registri le note passavano tutte dall'AI (3-3,5 s) perché il percorso
istantaneo del frontend (zero AI) voleva la frase che cominciasse proprio
con "segnami/mettimi in appunti". Frasi vere di Gianardi: "mi appunti chiavi
portone Amalfi 2 e Amalfi 4 per Ratti", "mi metti negli appunti convocare
almeno tre riunioni", "mi aggiungi in appunti via XXIV Maggio 152 e anche un
altro appunto parto tetto...". Ora riconosciute (`estraiAppunti` in
index.html), anche più appunti nella stessa frase ("e anche un altro
appunto"). Con un giorno/ora nella frase resta all'AI (può essere un
impegno). Test in `eval/router.test.js` (73/73), compreso il salvataggio a
metà (lo dice, mai un "fatto" finto).

Messaggi (manda_messaggio): NON fatto il percorso rapido — nei registri
nessun uso reale, e mandare un messaggio a un cliente resta un'azione che
chiede conferma (va a una persona esterna). Da riprendere quando verrà usato.

Credito dell'AI finito: l'app ora dice "Credito dell'AI esaurito: ricaricalo
su console.anthropic.com" invece dell'errore in inglese (24/09/2026).

### Appunti sovrascritti per sbaglio (25/09/2026)

Prova di Gianardi con l'app non ancora ricaricata (quindi via AI): "mi
appunti comprare nastro e anche un altro appunto chiamare il fabbro", detto
subito dopo "comprare silicone"/"chiamare il vetraio" → l'AI, per via del
ricordo dell'ultima azione, ha usato correggi_appunto e ha SOVRASCRITTO i
due appunti di prima (persi). Regola nel codice (`CHIEDE_CORREZIONE` in
correggi_appunto): in un messaggio nuovo un appunto esistente si cambia solo
se la frase ha parole di correzione ("correggi", "anzi", "non X ma Y",
"cambia"...); altrimenti errore all'AI con l'istruzione di usare
crea_appunto. Test: 3 scenari in `eval/percorso-rapido.test.mjs` (sul codice
di prima riproduce la perdita).
Da valutare: lo stesso rischio "il ricordo trasforma una richiesta nuova in
una correzione" per gli altri strumenti che modificano (aggiorna_cliente,
modifica_preventivo_o_fattura).

### App che si aggiorna da sola + server a Londra (25/09/2026)

- Aggiornamento automatico (index.html, `controllaNuovaVersione`): tornando
  su EON si confronta l'ETag/Last-Modified di index.html (solo intestazione)
  con quello di avvio; se è cambiato la pagina si ricarica, mai con testo
  scritto a metà in un campo visibile; al massimo un controllo ogni 30 s.
  Motivo: dopo i merge Gianardi continuava a usare la versione vecchia
  rimasta in memoria sul telefono. Test: `eval/aggiornamento.test.js`.
- `vercel.json`: `"regions": ["lhr1"]` — il database (produzione e staging)
  è a Londra (eu-west-2), la funzione girava nella regione predefinita di
  Vercel (Stati Uniti): 8-10 viaggi al database per richiesta attraverso
  l'oceano. Le chiamate ad Anthropic si allungano di poco (una per il
  percorso rapido). Da misurare in ai_request_log (durata_ms) prima/dopo:
  prima, percorso rapido 1,5-2,4 s.
- La lettura del profilo (professione) ora parte in parallelo e si aspetta
  solo quando serve (prompt del motore completo): i percorsi rapidi non la
  aspettano più.

### Cartella vera "Fatture e preventivi" (25/09/2026)

Nuova pagina `fatture-preventivi` (menu Documenti): raccoglie TUTTI i
preventivi e le fatture veri (messages con event_type "doc" nelle
conversazioni dei clienti), dal più recente, con filtri Tutti/Fatture/
Preventivi e il fatturato dell'anno. Tocco su una riga → la stessa
anteprima con il tasto Modifica a voce; dopo una correzione la lista si
aggiorna subito (`aggiornaDocumentoInMemoria`). A voce: "apri le fatture",
"mostrami i preventivi". Le vecchie pagine finte "Crea Fattura"/"Crea
Preventivo" (dati solo locali, mai collegati a niente) non sono più nel
menu; restano nel codice, da togliere del tutto più avanti.
Test: `eval/fatture.test.js` (19 verifiche).
Poi, su richiesta di Gianardi ("le volevo separate come prima"): nel menu
Documenti due cartelle, **Preventivi** e **Fatture**, ognuna con i soli
documenti veri del suo tipo, il suo titolo e senza filtri (stessa pagina,
`data-fp-filtro`). La vista unica con i filtri resta solo a voce
("apri fatture e preventivi").
Lettera, Cartello fine lavori e Carta intestata: NON vanno tolte (Gianardi,
25/09/2026) — restano, e andranno migliorate più avanti.

### Formato dei documenti: foto della propria fattura o modello di EON (25/09/2026)

Richiesta di Gianardi: "vuoi usare il vecchio formato della tua fattura? Fai
una foto qui così lo registriamo… sennò scegli un modello di EON; una volta
scelto deve essere salvato". Prima: la foto leggeva solo i dati
dell'intestazione, "Usa il modello di EON" chiudeva la finestra e basta, e
non esisteva un formato salvato.
- DB: `azienda_intestazione.modello` (classico|moderno|essenziale|elegante)
  e `colore` (#RRGGBB), con vincoli — `supabase/intestazione_modello.sql`,
  già applicata a staging e produzione (additiva).
- Server (`handleLeggiIntestazioneDaFoto`): dalla foto anche colore
  principale e disposizione → modello più vicino (fascia→Moderno,
  centrata→Elegante, minimale→Essenziale, altrimenti Classico), validati.
- App: finestra "Come vuoi le tue fatture?"; galleria dei 4 modelli con una
  fattura d'esempio; dalla foto una proposta ("Va bene, usa questo" / "Prova
  un altro modello con i miei colori" / "Correggi i dati"); salvataggio di
  modello+colore (i dati letti riempiono solo i campi vuoti); sezione
  "Formato dei documenti" nella Carta intestata per cambiarlo quando si vuole.
- Anteprima in app e PDF usano modello, colore e intestazione (indirizzo,
  P.IVA, contatti, logo); il PDF non mostra più "E·O·N" e non interpreta
  più come HTML i testi di clienti/voci.
- Limite dichiarato a Gianardi: dalla foto si riproduce l'aspetto (colori,
  disposizione, dati), non una copia identica al millimetro.
- Test: `eval/formato.test.js` (20 verifiche) + 4 in percorso-rapido.test.mjs.
- Da fare: applicare il formato anche a Lettera e Cartello fine lavori.

### Scheda del documento: modifiche in chat e invio (25/09/2026)

Gianardi: il microfono sotto la card "è brutto e non funziona bene"; le
domande di EON devono comparire dentro la fattura, per rispondere senza
chiuderla; un campo per scrivere le modifiche a mano; invio via email,
WhatsApp o EON; "tutto ben delineato e armonioso". Trovato anche: una
conferma chiesta con la scheda aperta finiva in un avviso NASCOSTO sotto la
scheda (z-index 80 contro 9997).
Ora (`mostraAnteprimaDocumento` in index.html): in alto PDF · WhatsApp ·
Email · EON; il documento con il formato scelto; la conversazione con EON
(domande e Sì/No dentro la scheda, risposte nello stesso filo via runId);
in fondo, sempre visibile, campo di testo + microfono + invio. Una modifica
chiara si applica subito e il documento si aggiorna lì. Il messaggio
all'AI porta già i dati attuali del documento (niente giri per cercarlo) e
modifica_preventivo_o_fattura è tra gli STRUMENTI_SEMPRE_CONCLUSIVI (niente
giro finale solo per un commento). Nell'elenco dei documenti resta solo
"Apri".
Limite: WhatsApp ed Email partono con il riepilogo scritto (voci, IVA,
totale); il PDF si apre a parte per salvarlo/allegarlo — l'allegato
automatico del PDF è il passo successivo.
Test: `eval/scheda.test.js` (18 verifiche).

### Nota sulle foto (25/09/2026)

Gianardi: "su questa foto vorrei segnarmi anche degli appunti in riferimento
a questa foto" — scelta l'opzione 1 (nota), non il disegno sopra la foto.
- DB: `cantiere_foto.nota` (text) — `supabase/foto_nota.sql`, già applicata
  a staging e produzione (additiva).
- App: tocco su una foto → scheda (invio WhatsApp/Email/EON con nota e link,
  foto grande, nota) con la barra in fondo per scrivere o dettare; quello che
  si scrive/detta si AGGIUNGE alla nota, toccando la nota la si corregge;
  invio a vuoto non cancella mai. Salvataggio diretto (nessuna AI). Subito
  dopo lo scatto (dal "+" di un cliente o dopo averla collegata a un
  cliente) la scheda propone la nota. In galleria un segno sulle foto con
  nota.
- Ricerca a voce: "mostrami la foto della crepa di Rossi", "la foto del
  contatore" (anche senza cliente) → dalla nota, senza AI; lato server
  recupera_foto_cantiere ha `cerca` e restituisce la nota.
- Test: `eval/foto.test.js` (16) + 2 in percorso-rapido.test.mjs.

### Descrizione automatica delle foto (25/09/2026)

Proposta mia, approvata da Gianardi dopo l'esempio della porta scorrevole
("da cambiare e trovare modello uguale"): EON guarda la foto e scrive una
frase breve ("Porta scorrevole in vetro satinato, telaio in alluminio"),
salvata in `cantiere_foto.descrizione` (migrazione additiva
`supabase/foto_descrizione.sql`, applicata a staging e produzione),
SEPARATA dalla nota dell'utente.
- Server: `POST /api?action=descrivi_foto` {foto_id} → Haiku con la foto letta
  dal link pubblico dello storage di EON (link esterni rifiutati), una
  chiamata per foto, mai ripetuta se già descritta; RLS sulla lettura.
- App: chiesta in sottofondo dopo ogni caricamento; per le foto vecchie
  quando si apre la loro scheda; mostrata piccola sotto la nota ("EON: …").
- Ricerca a voce (app) e `recupera_foto_cantiere.cerca` (server) guardano
  nota + descrizione: "la foto della porta" la trova anche se la nota dice
  solo "da cambiare".
- Costo: una chiamata piccola a Haiku con un'immagine per foto.
- Test: 3 in foto.test.js (19 in tutto) + 6 in percorso-rapido.test.mjs.

### Un cliente, una chat + pulizia app (25/09/2026)

Gianardi: "tanti clienti in Messaggi che non vedo in anagrafica" e "se
aggiungo un cliente si crea ovunque, se lo cancello da una parte si
cancella ovunque". Verificato sui log: i 63 clienti archiviati li aveva
archiviati il tasto Archivia (nessuna conferma), non un errore; chat e
cliente erano legati solo dal nome esatto (maiuscole comprese).
- App: archivia/riattiva, cestina, rinomina, crea e ripristina valgono
  per cliente e chat insieme; nome confrontato senza maiuscole; chat di un
  cliente archiviato solo in "Archivio"; Archivia chiede conferma; niente
  "null" sulle schede.
- Server: crea_cliente / trova_o_crea_cliente creano subito la chat;
  aggiorna_cliente la rinomina; ricerca chat senza maiuscole
  (`filtroNomeConversazione`, ilike con caratteri speciali resi letterali).
- Menu: "Messaggi" come prima voce (con i non letti). Cresci: "Lavori in
  corso" (vecchio contenuto nascosto, non cancellato); tolte le righe della
  Home e "Strategia trattative" che ci portavano.
- Foto "a quale cliente?": "Rossi, porta da cambiare" → foto a Rossi e nota
  "Porta da cambiare"; senza un nome non crea più un cliente (era nato
  "Da cambiare"), chiede a chi si riferisce.
- Test: `eval/clienti-chat.test.js` (19) + 2 in percorso-rapido.test.mjs.

### Foto negli Appunti (25/09/2026)

Gianardi: "in Appunti mettere la possibilità di fare anche le foto" e "non
vedo nessuna di queste funzioni" (nota e descrizione sulle foto). Verificato:
nel database nessuna foto ha nota o descrizione, e Vercel bloccava le
pubblicazioni già dalle 15:50 (anche #92): quelle funzioni non erano mai
andate online, arrivano con il pacchetto unico.
- Appunti: tasto "Scatta una foto con appunto" → foto salvata in
  `cantiere/appunti/` (stessa tabella `cantiere_foto`, niente migrazione) →
  si apre subito la scheda della foto per dettare o scrivere la nota.
- L'elenco "Appunti salvati" mostra testi e foto insieme, il più recente in
  cima: miniatura, nota, descrizione di EON, data. Tocco = scheda della foto.
  La foto resta anche nella galleria Foto.
- Test: 5 in foto.test.js (21 in tutto).

### Risposte di EON nella card bianca (25/09/2026)

Gianardi (due screenshot): "Cosa ho da fare domani?" rispondeva nel
riquadro "Fatto" con gli asterischi del markdown a vista; vuole lo stile
della card "Cosa devo fare oggi" della Home, sempre.
- `mostraRispostaEON(domanda, testo, {rispondi, titolo})`: card con titolo =
  la domanda, paragrafi, elenchi, orari in colonna ("08:00 | impegno"),
  **grassetto** vero, niente asterischi.
- Una domanda di EON ("Quale intendi?") ha in fondo alla card la barra per
  rispondere (scritta o a voce): continua la stessa conversazione.
- Anche le letture senza AI ("appuntamenti di oggi") usano la card.
- Restano nel riquadro in basso solo le conferme delle azioni ("Segnato in
  calendario", "Impegno eliminato · Annulla").
- Test: `eval/risposte.test.js` (11).

### Calendario rifatto (25/09/2026)

Gianardi (screenshot): "non c'è il tasto per tornare indietro; rendilo più
bello, più chiaro e più armonioso".
- "Indietro" in alto: torna alla pagina da cui sei arrivato (navigateTo ora
  ricorda `paginaPrecedente`), Home se non c'è.
- Settimana in alto (oggi + 6 giorni) con i pallini degli impegni; un tocco
  su un giorno porta ai suoi impegni.
- Riga: ora su una riga ("08:00"), titolo, tipo con il suo colore
  (Appuntamento blu, Da fare ambra, In sospeso viola, Da vedere verde) e il
  cliente solo se aggiunge qualcosa: spariti "DA FARE / da fare" e il nome
  ripetuto sotto sé stesso. Via il riquadro dentro il riquadro.
- Elimina: scorrendo a sinistra o dal tasto, con "Annulla" (niente domanda).
- Test: `eval/calendario.test.js` (14).
### Vercel: pubblica solo main (25/09/2026)

Il 25/09 Vercel ha bloccato la pubblicazione di #94 ("Deployment rate
limited", piano Hobby: 100 al giorno). Causa: ogni push sui rami di lavoro
`claude/*` creava un'anteprima, doppia perché al repo sono collegati due
progetti (eonbeckend ed eonbeckend-mx2t). Ora `vercel.json` ha
`git.deploymentEnabled: {"claude/*": false}`: si pubblica solo main. Da
valutare con Gianardi se scollegare eonbeckend-mx2t (l'app usa eonbeckend).

### Scorri per eliminare (25/09/2026)

Gianardi: "cancellare i messaggi scorrendo il dito". Nella lista Messaggi
e dentro una chat: si scorre a sinistra, compare "Elimina" rosso, un tocco
e va nel Cestino con "Annulla" per qualche secondo (niente domanda prima).
Sulla chat va nel Cestino anche il cliente (un cliente, una chat). Tolta la
piccola X accanto ai messaggi. Scroll verticale e tocco per aprire invariati.
- Test: 9 in clienti-chat.test.js (28 in tutto), provato anche con tocco vero.

### "Mi serve fattura testolina" → la fattura si apre subito (25/09/2026)

Caso reale: la frase è andata all'AI, che l'ha capita come "crea una
fattura" e chiedeva i dati. Causa: il riconoscimento istantaneo
(`provaRisorsaImmediata`, zero AI) saltava i clienti ARCHIVIATI, e
Testolina lo era. Ora:
- cliente cercato tra gli attivi e, se nessuno corrisponde, tra gli archiviati;
- "fattura/preventivo": solo documenti di quel tipo; UN solo documento → si
  apre direttamente la card grande con Modifica; più documenti → elenco;
- più modi di chiederlo ("fattura testolina", "mi fai vedere", "mostrami",
  "ho bisogno della", "vorrei"...);
- resta all'AI (è una richiesta di CREARE): importo nella frase, parole
  come "crea/fammi una/prepara/nuovo", parole in più che non corrispondono
  a nessun documento esistente ("preventivo per Rossi pulizia scale"),
  cliente senza documenti di quel tipo.
Test: 11 verifiche nuove in `eval/fatture.test.js` (sul codice di prima
riproduce il caso).
Idea di Gianardi, subito dopo: cercare DIRETTAMENTE tra le fatture per il
nome scritto sul documento (`cercaTraDocumenti`), non passando
dall'anagrafica — funziona anche con clienti archiviati, con i 10 "Mario
Rossi" doppi o con clienti non più in anagrafica. Vince il documento che
corrisponde a più parole del nome ("fattura mario rossi" non tira dentro
Luca Rossi); più documenti → elenco con il nome su ogni riga. La ricerca
per cliente in anagrafica resta come ripiego.
Da fare: lo stesso per i documenti dell'impresa (senza cliente).
