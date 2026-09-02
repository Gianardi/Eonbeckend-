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

## Pulizia e precisazioni

Voce generica per una passata di rifinitura sull'app: perfezionare alcune
funzioni esistenti, sistemare dettagli grafici, e in generale "dare una
pulita" — non un elenco chiuso, si riempie mano a mano che si individuano
cose da sistemare durante l'uso reale dell'app.

Richiesto da Gianardi il 31/08/2026.
