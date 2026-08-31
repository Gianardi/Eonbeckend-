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

Oggi il microfono serve solo a dettare testo: EON legge quello che dici, ma
risponde sempre e solo per iscritto (notifica/toast). L'idea è poter parlare
con EON e sentirlo rispondere a voce, come una vera conversazione.

È fattibile, e la base c'è già:
- Il "parlare a EON" (riconoscimento vocale) è già implementato.
- Il backend ha già una chiave OpenAI configurata (oggi usata solo per
  trascrivere l'audio in testo con Whisper).

Manca solo la parte "EON che risponde a voce": aggiungere una sintesi vocale
che legga ad alta voce il testo della risposta invece di mostrarlo solo come
notifica scritta. Due livelli possibili:
1. **Gratis e immediato**: la voce nativa del telefono (`speechSynthesis` del
   browser) — zero costi, zero nuove integrazioni, pronto da usare subito.
2. **Qualità più naturale**: il servizio di sintesi vocale di OpenAI (a
   pagamento, richiede una piccola aggiunta lato server dato che la chiave
   OpenAI è già configurata).

Richiesto da Gianardi il 31/08/2026.
