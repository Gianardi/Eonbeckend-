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

2. **Letture semplici da dati già in memoria — non ancora fatto (fase
   1b).** Stesso principio, esteso a piccole richieste di lettura
   rispondibili filtrando i dati già caricati nel browser (appuntamenti di
   oggi, quanti clienti, messaggi non letti), senza nessuna chiamata di
   rete. Solo letture: nessuna scrittura passa mai dal router.

3. **Livelli di rischio a 4 valori — non ancora fatto.** Sostituire
   `sensitive: true/false` (oggi nei 17 strumenti di `api/index.js`) con
   `risk: "read"|"low_write"|"high_impact"|"external"` — stesso
   comportamento di conferma di oggi, ma metadati più precisi, base per
   policy più fini in futuro.

4. **`request_id` per turno — non ancora fatto.** La tabella
   `ai_audit_log` registra già ogni singola chiamata a uno strumento, ma
   non collega intent, entità, tutti gli strumenti chiamati e la latenza
   di un intero turno in una riga consultabile insieme — utile per capire
   "perché EON ha fatto questa cosa".

5. **Oggetto di contesto esplicito — da valutare se serve davvero.** Oggi
   il "contesto" è la cronologia grezza dei messaggi mandata a Claude,
   più i 90 secondi di continuazione per rispondere a una domanda aperta.
   Un oggetto strutturato (cliente corrente, lavoro corrente...) avrebbe
   senso solo se serve più memoria a breve termine di quella già coperta.

6. **Evaluation Suite — non ancora fatto.** Una suite di test sistematica
   per intenti e situazioni (correzioni, clienti omonimi, richieste
   incomplete...), non frasi specifiche — da fare dopo che i punti sopra
   sono stabili, così c'è più da testare.

7. **Communication Hub multi-canale (email, WhatsApp) — progetto a sé.**
   Già in parte annotato sopra in "Programma OpenAI": nessun adapter
   esterno oggi, `manda_messaggio` scrive solo nel Portal interno. Da
   pianificare separatamente quando si deciderà di investirci, per la sua
   dimensione (webhook in ingresso, risoluzione identità, prevenzione
   duplicati, conversazione unica multi-canale).

Piano completo (analisi, mappa dei gap, fasi) discusso e approvato con
Gianardi il 01/09/2026.

Richiesto da Gianardi il 01/09/2026.

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
