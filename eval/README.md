# Evaluation Suite — EON BRAIN, punto 6

Suite di test per **intenti e situazioni**, non per frasi specifiche
(vedi `TODO.md`, sezione "EON BRAIN", e la specifica di Gianardi,
sezioni 38-39). L'idea: non testare "l'assistente capisce la frase X",
ma "l'assistente si comporta bene nella situazione Y", con più modi
diversi di dire la stessa cosa.

## Quattro pezzi

### `casi.json` — il catalogo

La fonte di verità: ogni caso descrive una situazione (categoria,
descrizione, frase o sequenza di frasi, cosa ci si aspetta). È dati,
non codice — leggibile anche senza eseguire nulla, come promemoria di
cosa EON dovrebbe saper fare. Aggiungere un caso nuovo, quando si nota
un comportamento da verificare, è semplice: una voce in più nell'array
`casi`. I casi con id `brain-*` coprono in particolare il nuovo
contratto centrale del BRAIN (IntentFrame, Current Focus, Entity
Resolution uniforme, risorse — vedi `TODO.md`): situazioni scelte
apposta con vocabolario/domini mai usati altrove nel catalogo, per
verificare la capacità generale e non una frase specifica già corretta.

### `router.test.js` — parte automatica lato frontend, gira subito

Copre lo strato **deterministico** del frontend: router di
navigazione, router di letture locali, nota di contesto per le
correzioni veloci, e il Current Focus (nessuna scadenza a tempo).
Nessuna di queste funzioni chiama l'AI — sono JavaScript puro nel
frontend, si possono verificare al 100% senza un account o una chiave
Anthropic.

```
NODE_PATH=/opt/node22/lib/node_modules node eval/router.test.js
```

(Il `NODE_PATH` è specifico di questo ambiente di sviluppo, dove
Playwright è preinstallato lì. Su una macchina normale: `npm install
playwright` una volta, poi semplicemente `node eval/router.test.js`.)

### `backend.test.js` — parte automatica lato backend, gira subito

Stesso principio di `router.test.js` ma per le funzioni pure del
backend (`api/index.js`): `estraiIntentoDaMessaggi` (come si ricostruisce
l'IntentFrame dalla cronologia dei messaggi, incluso lo "scarico"
dell'intento dopo `capacita_non_disponibile`) e `costruisciFocus` (quando
un'entità dichiarata diventa davvero il nuovo Current Focus). Nessuna
chiamata di rete, nessun database, nessuna AI vera: solo la logica di
interpretazione, verificata su cronologie di messaggi costruite a mano
nello stesso formato che userebbe davvero Anthropic. Le due funzioni
sono esportate da `api/index.js` solo per questo (`export {
estraiIntentoDaMessaggi, costruisciFocus }`, in coda al file): non
cambia in nessun modo il comportamento del vero endpoint.

```
node eval/backend.test.js
```

Entrambi `router.test.js` e `backend.test.js` fanno già parte del
flusso di lavoro normale: da eseguire dopo ogni modifica al router, al
contesto delle correzioni, all'IntentFrame o al Current Focus, prima di
aprire una PR — esattamente come `node --check` per la sintassi.

### `live-check.js` — parte che richiede l'AI vera, non ancora eseguita

Copre tutto il resto: riconoscimento dell'intento, ambiguità, clienti
omonimi, correzioni che richiedono un giudizio del modello, robustezza
a errori/informalità, e il principio di non inventare mai nulla. Manda
ogni caso al vero endpoint `/api?action=assistant` e stampa domanda e
risposta vera fianco a fianco con quello che ci si aspettava — per i
casi meccanicamente controllabili dice da solo se è andata bene,
guardando (a seconda di cosa dichiara il caso in `atteso`):
`strumenti_attesi` (quali strumenti sono stati eseguiti — MAI per uno
strumento delicato come sposta_impegno/elimina_impegno/manda_messaggio,
che non esegue subito: per quelli si usa `stato_atteso:
"in_attesa_conferma"`, altrimenti il controllo boccerebbe una richiesta
di conferma corretta scambiandola per un'azione mancata),
`testo_finisce_con_domanda` (per i casi in cui EON deve fermarsi a
chiedere). Per il resto (la maggior parte: capire se una domanda suona
naturale, se un rifiuto è onesto) serve una persona che legga.

**Non è mai stato eseguito**: questo ambiente di sviluppo non ha
accesso a un vero deploy Vercel, a un vero progetto Supabase, né a una
chiave Anthropic live — solo a un browser sandbox per testare il
codice frontend. Richiede:

```
EVAL_API_URL=https://tuo-progetto.vercel.app/api?action=assistant \
EVAL_ACCESS_TOKEN=<token di un utente di PROVA> \
node eval/live-check.js
```

**Usa sempre un account creato apposta per i test, mai quello con i
dati veri dei clienti**: alcuni casi (es. i clienti omonimi) richiedono
che lo script trovi certi dati già in anagrafica, e molti altri casi
scrivono davvero (creano impegni, appunti, a volte chiedono conferma
per azioni delicate) — non è un ambiente "a vuoto" che non tocca nulla.

### `check-schema.js` — gate di verifica schema, prima del deploy

Non è un test sul comportamento del Brain: verifica che lo schema
Supabase reale contenga davvero le tabelle/colonne che il codice
presuppone. Nato da un fatto concreto, non un'ipotesi: due volte in
questo progetto uno script in `supabase/*.sql` è stato scritto ma mai
eseguito sul database vero, ed è stato scoperto solo da un utente
reale, molto dopo che il codice che ci contava era già in produzione
(`cantiere_foto.client_id`, l'intera tabella `ai_request_log`).

```
SUPABASE_URL=https://tuo-progetto.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role> \
node eval/check-schema.js
```

Interroga PostgREST (`GET /rest/v1/<tabella>?select=<colonne>&limit=0`)
per ogni tabella nel contratto scritto in cima al file — nessuna
dipendenza nuova, stesso meccanismo già usato da `db()` in
`api/index.js`. Esce con codice 1 se qualcosa manca, elencando
esattamente cosa. **Quando si aggiunge un tool o una query che
presuppone una tabella/colonna nuova, va aggiornato questo file prima
di aprire la PR** — è la metà "schema" della checklist di composizione
descritta in `TODO.md`.

## Quando aggiungere un caso nuovo

Quando si nota — usando l'app davvero, o durante lo sviluppo — che
EON ha frainteso qualcosa: non aggiungere subito una correzione
puntuale al prompt o un if/else nel codice (vedi il "Principio di
sviluppo", sezione 40 della specifica). Prima chiedersi quale capacità
manca (intent, entity resolution, contesto, descrizione di uno
strumento, pianificazione), poi aggiungere un caso qui che descriva la
situazione in generale — non solo la frase esatta che ha fatto
inciampare EON quella volta — così la correzione, quando arriva, si
può verificare che abbia risolto la situazione e non solo quella frase.
