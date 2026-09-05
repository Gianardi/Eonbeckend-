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
