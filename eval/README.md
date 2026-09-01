# Evaluation Suite — EON BRAIN, punto 6

Suite di test per **intenti e situazioni**, non per frasi specifiche
(vedi `TODO.md`, sezione "EON BRAIN", e la specifica di Gianardi,
sezioni 38-39). L'idea: non testare "l'assistente capisce la frase X",
ma "l'assistente si comporta bene nella situazione Y", con più modi
diversi di dire la stessa cosa.

## Tre pezzi

### `casi.json` — il catalogo

La fonte di verità: ogni caso descrive una situazione (categoria,
descrizione, frase o sequenza di frasi, cosa ci si aspetta). È dati,
non codice — leggibile anche senza eseguire nulla, come promemoria di
cosa EON dovrebbe saper fare. Aggiungere un caso nuovo, quando si nota
un comportamento da verificare, è semplice: una voce in più nell'array
`casi`.

### `router.test.js` — parte automatica, gira subito

Copre solo lo strato **deterministico**: router di navigazione, router
di letture locali, nota di contesto per le correzioni veloci. Nessuna
di queste funzioni chiama l'AI — sono JavaScript puro nel frontend, si
possono verificare al 100% senza un account o una chiave Anthropic.

```
NODE_PATH=/opt/node22/lib/node_modules node eval/router.test.js
```

(Il `NODE_PATH` è specifico di questo ambiente di sviluppo, dove
Playwright è preinstallato lì. Su una macchina normale: `npm install
playwright` una volta, poi semplicemente `node eval/router.test.js`.)

Fa già parte del flusso di lavoro normale: da eseguire dopo ogni
modifica al router o al contesto delle correzioni, prima di aprire una
PR — esattamente come `node --check` per la sintassi.

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
