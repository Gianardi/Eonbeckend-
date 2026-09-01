# Cose da fare in seguito

Note di lavoro per interventi futuri, non urgenti. Ogni voce ha lo scopo e l'idea di base, da riprendere quando si decide di affrontarla.

## Velocità: rendere le azioni dell'AI immediate

Oggi quando l'AI esegue un'azione (es. "segna il cliente Mario Rossi"), l'utente
aspetta la risposta del modello AI e poi vede l'interfaccia aggiornarsi solo dopo
un ricaricamento completo di tutti i dati. Percepito come lento.

Due interventi, da fare insieme per il massimo effetto:

1. **Aggiornamento mirato invece di reload completo.** Dopo un'azione dell'AI,
   `loadUserDataFromDB()` ricarica *tutto* (clienti, cantiere, chat, appuntamenti,
   documenti...) invece di aggiornare solo il record toccato. Sostituire con un
   aggiornamento mirato (solo il cliente/impegno creato o modificato) taglierebbe
   gran parte del tempo percepito.

2. **Aggiornamento ottimistico dell'interfaccia.** Appena l'utente finisce di
   parlare o scrivere, mostrare subito il risultato atteso (es. il cliente nella
   lista) *prima* che l'AI abbia confermato, e sistemare in silenzio se qualcosa
   va storto. L'utente vede la reazione a schermo in millisecondi, mentre il
   salvataggio vero avviene comunque dietro le quinte.

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

1. **Prompt caching (Anthropic).** Le istruzioni di sistema e l'elenco degli
   strumenti sono identici ad ogni chiamata: la cache di Anthropic li tiene
   "pronti" e li fa pagare circa 1/10 del prezzo normale dalle chiamate
   successive in poi. Nessuna perdita di qualità, l'AI risponde uguale a
   oggi — cambia solo come viene fatturata la parte ripetuta. Il singolo
   intervento a più alto impatto e meno rischio.

2. **Modello più economico per le richieste semplici.** Claude Haiku (molto
   più economico di Sonnet) per i comandi diretti tipo "chiamare Guidi
   domani alle 17"; da testare con cura che capisca ugualmente bene i
   comandi vocali/testuali prima di usarlo di default, altrimenti si
   rischia di perdere precisione.

3. **Alleggerire l'elenco degli strumenti.** Se alcuni strumenti si usano
   raramente, valutare se mandarli sempre o solo quando serve — riduce i
   token di ogni chiamata.

4. **Meno andirivieni per le conferme.** Le azioni delicate oggi a volte
   richiedono 2 chiamate (descrivi + esegui) invece di una sola: capire dove
   si può accorciare senza perdere la sicurezza della conferma.

Da fare per prima: il punto 1 (prompt caching), perché è il più sicuro e
il più semplice da misurare — confrontando il costo per azione prima e dopo
sulla chiave "Eonbeckend" nella Console Anthropic.

Richiesto da Gianardi il 31/08/2026.

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
