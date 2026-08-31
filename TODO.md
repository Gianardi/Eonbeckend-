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
