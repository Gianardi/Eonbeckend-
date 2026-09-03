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

**Eseguito la prima volta il 03/09/2026**, contro il primo ambiente di
staging del progetto (vedi `TODO.md`, punto 2.1 del roadmap operativa).
Questo ambiente di sviluppo non ha comunque accesso diretto a un vero
deploy Vercel/Supabase/Anthropic — va lanciato da una macchina con
accesso di rete reale:

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

Tra una richiesta e l'altra c'è una pausa (`EVAL_DELAY_MS`, default 3
secondi) e un ritentativo automatico su un sovraccarico momentaneo di
Anthropic (529): senza, la prima esecuzione reale ha sbattuto contro il
limite anti-abuso del backend (`AI_RATE_LIMIT`/`AI_RATE_WINDOW_SECONDS`
in `api/index.js`, 20 richieste ogni 10 minuti — un valore pensato per
un professionista vero, non per una suite di 35+ casi) prima di
arrivare a metà dei casi. Su un ambiente di **solo staging** (mai
produzione) quel limite può anche essere alzato impostando su Vercel
`AI_RATE_LIMIT`, `AI_RATE_WINDOW_SECONDS` e `AI_RATE_LIMIT_STAGING_CONFERMATO=si`
— servono tutte e tre insieme, vedi il commento sopra `AI_RATE_LIMIT`
in `api/index.js`.

### `reset-staging.js` — pulizia dei dati di test, prima di una run

`live-check.js` non riparte mai da un database vuoto: ogni run lascia
clienti/impegni/appunti creati dai casi che scrivono davvero. Trovato
concretamente il 03/09/2026: il caso `intento-01` era segnalato FAIL
non per un bug, ma perché il database aveva accumulato DUE clienti di
nome "Mario" da run precedenti — EON ha correttamente chiesto quale dei
due, il controllo automatico si aspettava invece un `crea_impegno`
diretto. Da lanciare prima di ogni run di `live-check.js`, sullo
**stesso utente di prova**, mai su un account con dati veri:

```
SUPABASE_URL=https://tuo-progetto-staging.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role dello STAGING> \
EVAL_OWNER_ID=<id dell'utente di prova> \
CONFIRM_STAGING=si \
node eval/reset-staging.js
```

Richiede sia l'id utente sia la conferma esplicita invece di indovinare
"l'utente corrente" da solo — cancella per davvero, non c'è un modo per
tornare indietro.

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
