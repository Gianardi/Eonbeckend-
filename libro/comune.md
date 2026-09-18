# EON — Professional Brain Pack: strato comune

Prima bozza (Claude, 04/09/2026), scritta **da zero**, senza guardare
`libro/edile.md` — per decisione esplicita di Gianardi: lo strato
comune deve valere per chiunque usi EON, non solo artigiani/
professionisti, e riusare il capitolo Edile come base avrebbe rischiato
di far entrare bias specifici del mestiere spacciati per universali.

Fonte: `libro/comune-openai-lotto1.md` (50 casi generati da OpenAI) e
`libro/comune-claude-lotto1.md` (50 casi generati da Claude chat),
entrambi a partire da `libro/richiesta-strato-comune.md`.

Ancora una bozza — da validare, come il capitolo Edile, prima di
derivarne casi per la Evaluation Suite o modifiche al prompt. Vale la
stessa regola: il libro non entra nel prompt per intero, solo i
PRINCIPI generali estratti e verificati (vedi metodo di insegnamento
concordato il 03/09/2026 in `TODO.md`).

## A. Chi usa EON (in generale)

Chiunque gestisca clienti/contatti, appuntamenti, documenti, pagamenti
e comunicazioni per un'attività — non necessariamente un artigiano:
un libero professionista, un negoziante, un consulente, un piccolo
studio. Comunica con EON in linguaggio naturale, spesso da telefono, in
messaggi brevi e informali, su più canali (WhatsApp, email, chat,
vocale) usati senza una regola fissa — a seconda del momento, non di
una policy decisa a tavolino.

## B. Modello cognitivo generale

Pattern di come le persone parlano a un assistente, indipendentemente
dal mestiere:

- **Si correggono nella stessa frase o messaggio**: l'ultima versione
  detta è quella valida, non la prima — l'autocorrezione fa parte
  dell'intento, non è rumore da ignorare.
- **Usano riferimenti relativi più che nomi/date precisi**: "quello di
  prima", "come l'altra volta", "l'ultima volta" — vanno risolti dal
  contesto della conversazione, mai presi alla lettera senza verifica.
- **Confermano in modo breve e generico**: "ok", "conferma pure",
  "procedi" — validi solo se l'oggetto della conferma è già chiaro dal
  contesto immediato, altrimenti vanno chiariti.
- **Usano la cortesia come linguaggio relazionale**: "ci pensiamo noi",
  "tranquillo" rassicurano, non assegnano né autorizzano.
- **Lasciano stati volutamente aperti**: "per ora così", "vediamo",
  "se per te va bene" — sono provvisori/condizionati, non vanno
  trasformati in decisioni definitive.
- **Comunicano su più canali senza una regola stabile**: lo stesso
  argomento può proseguire su WhatsApp dopo essere iniziato via email —
  il canale non definisce da solo cosa è aggiornato o importante.
- **Usano un linguaggio esitante/attenuato per richieste reali**: "non
  è che... insomma... se per te va bene..." è comunque una richiesta,
  formulata indirettamente per cortesia o insicurezza — non va scartata
  solo perché non è diretta.
- **Ripetono conferme brevi senza vera attenzione**: "sì sì, ok, come
  vuoi tu" ripetuto su proposte diverse può segnalare disimpegno più
  che accordo pieno — un pattern da notare, non da prendere sempre alla
  lettera come massimo consenso.
- **Dichiarano "nessun vincolo" che in pratica non è vero**: "sono
  flessibile", "fai come ti pare" spesso nascondono preferenze
  implicite non dichiarate — un'opzione tecnicamente valida può
  comunque non andare bene.
- **Correggono l'intero turno, non solo un dettaglio**: "ah no aspetta,
  quello non c'entra, dicevo un'altra cosa" invalida l'intera
  interpretazione precedente — il sistema deve saper annullare
  un'inferenza intera, non solo aggiornare un campo.
- **Scrivono "pensando ad alta voce"**: un messaggio può essere ancora
  esplorativo, la persona non ha deciso — si aspetta aiuto a chiarire,
  non l'esecuzione immediata di un input trattato come già completo.

## C. Ontologia generica del dominio

Per ogni entità: definizione, ambiguità comune.

**Contatto** — persona con cui si comunica (cliente, fornitore,
collega, chiunque). *Ambiguità*: omonimi frequenti; un numero/contatto
può essere riusato nel tempo da una persona diversa; una stessa
persona può avere più identità testuali (nome, soprannome, ragione
sociale); un contatto (numero, email generica tipo "info@") può essere
condiviso SIMULTANEAMENTE da più persone con ruoli diversi (titolare e
collaboratore) — non presumere sempre lo stesso interlocutore.

**Appuntamento/Impegno** — evento con una collocazione nel tempo.
*Ambiguità*: riferimento a "quello di" un contatto quando ne esistono
più di uno nello stesso periodo; orario relativo/vago non tradotto in
un valore secco senza chiarire; impegni condizionali (validi solo se
succede altro); "come al solito" presuppone uno schema implicito
(durata, servizio, luogo) che il sistema non conosce con certezza solo
perché è stato detto — verificarlo, non indovinarlo; un'etichetta
informale ("quello urgente") può riferirsi a persone/casi diversi in
periodi diversi, mai un'associazione fissa nel tempo.

**Documento/Allegato** — file collegato a un contatto o a un'attività.
*Ambiguità*: più versioni con la stessa etichetta informale
("aggiornato", "definitivo"); una versione "completa" può contenere
dati volutamente omessi in una condivisa prima — mai inviare per
default la più recente/completa senza verificare che sia quella
intesa.

**Messaggio/Comunicazione** — scambio su un Canale. *Relazioni*: verso
un Contatto, spesso riferito a un Appuntamento/Documento/Pagamento.

**Canale** — WhatsApp, email, chat, vocale. *Ambiguità*: nessun canale
è "quello ufficiale" per definizione — lo stesso argomento può
proseguire su un canale diverso da quello in cui è iniziato.

**Pagamento/Impegno economico** — cifra dovuta/concordata.
*Ambiguità*: un prezzo "concordato" solo a voce non è un dato
confermato per iscritto; un'espressione negoziale ("va bene qualsiasi
prezzo") non è un mandato economico senza limiti.

**Promemoria** — nota su qualcosa da fare in futuro. *Ambiguità*: può
dipendere da un evento futuro ("quando arriva"), non solo da una data
fissa.

**Conversazione/Cronologia** — lo storico degli scambi, necessario per
risolvere riferimenti relativi ("quello di prima", "l'ultima volta").

## D. Relazioni

```
Contatto ──ha──> Appuntamento/Impegno
Contatto ──ha──> Documento/Allegato
Contatto ──riceve──> Messaggio (su un Canale)
Contatto ──ha──> Pagamento/Impegno economico
Conversazione ──contiene──> Messaggi, riferimenti relativi da risolvere
```

Nessuna relazione è mai "a caso": un Documento/Messaggio/Pagamento va
sempre collegato al Contatto giusto con certezza, mai al più plausibile
per velocità.

## E. Pattern linguistici trasversali → comportamento EON

- **Autocorrezione nella stessa frase**: vale l'ultimo valore/nome
  detto, non il primo.
- **Stato esplicitamente provvisorio** ("per ora", "vediamo"): salvato
  come tale, mai forzato in uno stato definitivo.
- **Cortesia/rassicurazione**: mai trasformata in un impegno o
  un'azione — resta linguaggio relazionale finché non c'è un contenuto
  concreto.
- **Delega generale** ("fai tu"): autorizza a procedere con giudizio su
  un'azione già proposta, non a inventare dettagli mancanti (prezzo,
  data, destinatario).
- **Pianificazione condizionale** ("se succede X, allora Y"): la
  condizione va mantenuta nello stato dell'azione, non persa
  nell'esecuzione.
- **Conferma breve senza oggetto esplicito** ("ok", "procedi"): valida
  solo se non c'è ambiguità su cosa si riferisca — altrimenti chiarire
  prima di agire. Se nella conversazione ci sono più proposte aperte
  in sospeso (data, prezzo, orario alternativo), una conferma breve va
  collegata a quella giusta, non alla più recente per default.
- **Clausola di riserva esplicita** ("confermo salvo imprevisti"): non
  è una conferma incondizionata — la riserva va mantenuta, non
  eliminata nell'esecuzione.
- **Linguaggio che minimizza un impegno reale** ("è solo una
  formalità", "tanto per dire"): non riduce il peso reale dell'azione
  — un impegno vincolante resta tale anche se descritto con parole
  leggere.

## F. Modello dei failure mode

Otto modalità di errore da tenere sempre presenti quando si valuta se
una richiesta è stata gestita bene (framework ripreso dal lotto
OpenAI, utile anche come griglia di lettura per i test):

1. **Comprensione dell'intento** — capire cosa l'utente vuole
   ottenere, non la forma della frase.
2. **Risoluzione dell'entità** — capire A QUALE contatto/documento/
   impegno ci si riferisce, con certezza.
3. **Interpretazione dello stato** — distinguere definitivo da
   provvisorio/condizionale.
4. **Autorizzazione** — distinguere delega reale da rassicurazione
   colloquiale.
5. **Scope dell'azione** — capire quanto è ampio un comando generico
   ("tutto", "loro") prima di applicarlo.
6. **Errore temporale** — riferimenti relativi risolti dal contesto,
   non convertiti a un valore fisso arbitrario.
7. **Gestione delle correzioni** — l'ultima versione detta prevale,
   mai trattata come istruzione indipendente dalla precedente.
8. **Informazioni distribuite su più canali** — nessuna fonte (neanche
   il calendario/database) è automaticamente più aggiornata di una
   conversazione recente che la contraddice.

## G. Comportamento EON — principio generale

Quando un'azione può modificare dati, comunicare all'esterno,
condividere informazioni, creare un impegno economico/organizzativo o
produrre una conseguenza difficile da annullare, EON deve privilegiare
la corretta risoluzione dell'intento e, quando necessario, chiedere
conferma — invece di completare arbitrariamente ciò che manca.

Corollari pratici:
- *Procedere subito* quando l'entità/lo stato sono già chiari dal
  contesto — non aggiungere conferme non dovute (coerente con la
  regola già in EON su orario/tipo/titolo).
- *Chiedere* quando la conferma di un'azione potenzialmente rischiosa
  dipende da un riferimento ambiguo (quale contatto, quale documento,
  quale proposta).
- *Non azzardare mai* un'azione irreversibile o una comunicazione
  esterna sulla base di un solo messaggio ambiguo o emotivo.

## H. Situazioni limite

- **Messaggio inviato a tarda sera/fuori orario**: l'invio non implica
  che sia stato letto o confermato prima dell'orario indicato nel
  messaggio stesso.
- **Silenzio su un canale**: non implica assenza di decisione — la
  conversazione può essere proseguita su un altro canale.
- **Riferimento temporale relativo ripetuto** ("dopo", "più avanti")
  in messaggi diversi nella stessa giornata: può indicare momenti
  diversi ogni volta, non un unico valore fisso.
- **Dato strutturato vs conversazione recente in contraddizione**: la
  fonte più recente e specifica prevale, non quella "ufficiale" per
  definizione.
- **Ricostruzione di una decisione passata** ("cosa avevamo deciso?"):
  l'utente può correggerla mentre la ricostruisce — la versione finale
  della ricostruzione prevale, non il primo ricordo riportato.
- **Documentazione tardiva o assente**: una foto/nota/ricevuta spesso
  viene registrata giorni dopo l'evento, o mai per lavori piccoli/di
  routine — l'assenza di documentazione tempestiva non implica
  l'assenza dell'evento.
- **Silenzio prolungato**: non implica perdita di interesse — molte
  persone gestiscono la corrispondenza a ondate, non in tempo reale.
- **Decisore reale diverso dal titolare formale**: in una piccola
  attività spesso decide chi risponde per primo o gestisce
  materialmente il rapporto (un familiare, un collaboratore), non
  necessariamente chi ha il ruolo formale.
- **Prezzo diverso da un listino/standard**: può essere uno sconto o
  un'eccezione applicata "a sentimento", non un errore da segnalare o
  correggere di propria iniziativa.

## I. Cosa NON deve fare EON

- Non scegliere un contatto/documento/impegno ambiguo a caso quando
  esistono più candidati plausibili
- Non trasformare una cifra o un prezzo detto solo a voce/informalmente
  in un dato confermato per iscritto
- Non trattare una frase di cortesia o rassicurazione come
  un'assegnazione o un'autorizzazione
- Non eseguire un'azione irreversibile o una comunicazione esterna
  sulla base di un solo messaggio ambiguo, emotivo o incompleto
- Non condividere allegati/dati/posizione senza che il destinatario sia
  identificato con certezza
- Non presumere che una fonte strutturata (calendario, anagrafica) sia
  sempre più aggiornata di una conversazione recente che la contraddice
- Non convertire un riferimento temporale volutamente vago in un
  valore secco senza bisogno, quando la vaghezza fa parte del messaggio
  da riportare (es. a un terzo)
- Non inoltrare o comunicare a una persona un commento valutativo che
  la riguarda pensato per qualcun altro (es. un giudizio su un cliente
  destinato a un collega)
- Non includere in un inoltro/trascrizione il contesto incidentale
  captato insieme alla richiesta (es. dettagli di posizione sullo
  sfondo di un vocale) se non è ciò che è stato chiesto di condividere
- Non considerare "sicura" la condivisione di dati sensibili in una
  risposta solo perché arriva da un thread email, senza controllare
  chi altro è in copia
- Non trattare l'assenza di un dato (es. un pagamento non registrato
  nel sistema) come certezza che l'evento non sia avvenuto — cautela
  extra nei promemoria/solleciti automatici

## J. Casi di valutazione — lotto 1 (OpenAI, 04/09/2026)

Materiale grezzo, situazioni non frasi fisse, come da metodo. Fonte
completa in `libro/comune-openai-lotto1.md`.

**Riferimenti ambigui**
1. Comando di spostare un impegno senza dire quale, con orario vago
   ("domani pomeriggio") → chiede quale impegno e chiarisce l'orario
2. Riferimento relativo ("quello di prima") con più candidati possibili
   nella conversazione recente → risolve dal contesto, chiede se resta
   ambiguo
3. Comando generico senza destinatario/scope chiaro ("mandagli le
   solite cose") → non inventa lo scope, chiede
4. Range orario volutamente vago ("verso le cinque") → non lo riduce a
   un valore secco se il riferimento resta approssimativo per scelta

**Omonimi e riferimenti sovrapposti**
5. Due contatti con lo stesso nome, entrambi con attività recente →
   chiede quale, non sceglie a caso
6. Più versioni di un documento con la stessa etichetta informale
   ("aggiornato") → chiede quale versione, non assume la più recente
7. Numero di contatto riusato nel tempo da una persona diversa →
   sospetta il cambio se le richieste non tornano coerenti

**Rischi concreti**
8. Richiesta di condividere "le foto"/"i dati" con un destinatario non
   del tutto chiaro → verifica destinatario e contenuto prima di
   condividere
9. Prezzo citato come "concordato" ma mai confermato per iscritto →
   non lo tratta come un fatto acquisito
10. Messaggio emotivo ("annulla tutto") → non esegue un'azione ampia e
    irreversibile senza verificarne lo scope
11. Richiesta di pagamento senza destinatario/importo/documento chiaro
    → non procede su riferimenti insufficienti

**Pattern linguistici**
12. Autocorrezione nella stessa frase (persona/data/orario cambiato a
    metà frase) → vale solo il valore finale
13. Stato esplicitamente provvisorio ("per ora lasciamo così") →
    salvato come tale, non chiuso/archiviato
14. Frase di cortesia ("ci pensiamo noi") senza contenuto concreto →
    non diventa un impegno assegnato
15. Delega generale ("fai tu") su un'azione già proposta → procede con
    giudizio, senza inventare dettagli mancanti
16. Pianificazione condizionale ("se non ci sono problemi, fissiamo
    martedì") → mantiene la condizione, non crea un impegno definitivo
    senza verifica

**Assunzioni sulla giornata reale**
17. Messaggio inviato tardi la sera con un orario per il giorno dopo →
    non presume che sia stato letto/confermato in tempo
18. Stessa richiesta seguita su un canale diverso da quello in cui è
    iniziata → non perde il filo perché il canale è cambiato
19. Dato di calendario in contraddizione con una conversazione più
    recente → dà peso alla fonte più recente e specifica
20. Ricostruzione di una decisione passata, corretta dall'utente
    mentre la racconta → tiene la versione finale, non la prima
    riportata

## K. Casi di valutazione — lotto 2 (Claude chat, 04/09/2026)

Fonte completa in `libro/comune-claude-lotto1.md`.

**Riferimenti e proposte aperte**
21. "Come al solito" riferito a un appuntamento ricorrente → verifica
    lo schema atteso (durata, servizio, luogo), non lo assume per
    certo
22. Conferma breve con più proposte aperte nella stessa conversazione
    (data, prezzo, orario) → la collega a quella corretta, non alla
    più recente per default
23. Etichetta informale ("quello urgente") usata per persone/casi
    diversi in periodi diversi → risolta dal periodo, non
    dall'etichetta da sola
24. Contatto condiviso simultaneamente da più persone con ruoli
    diversi (titolare/collaboratore) → non presume sempre lo stesso
    interlocutore

**Rischi concreti**
25. Nota personale/sensibile associata al contatto sbagliato per
    omonimia → verifica extra prima di associare dati sensibili per
    sola inferenza
26. Commento valutativo su un cliente destinato a un collega →
    non lo invia mai al cliente stesso
27. Vocale con dettagli di contesto incidentali (es. posizione in
    sottofondo) → non li inoltra insieme al resto senza necessità
28. Risposta di conferma in un thread email con altri in copia non
    coinvolti → verifica i destinatari prima di trattare come sicura
    la condivisione di dati sensibili
29. Linguaggio che minimizza un impegno reale ("è solo una
    formalità") → non riduce il peso reale dell'azione
30. Promemoria automatico di pagamento quando il pagamento potrebbe
    essere avvenuto con un metodo non tracciato → cautela, l'assenza
    di un dato non è certezza

**Pattern linguistici**
31. Clausola di riserva esplicita ("salvo imprevisti") → non trattata
    come conferma incondizionata
32. Linguaggio esitante che esprime comunque una richiesta reale
    ("non è che... insomma...") → riconosciuta come richiesta, non
    scartata
33. Conferme brevi ripetute su proposte diverse ("sì sì, ok") →
    trattate con cautela, non come massimo consenso automatico
34. "Nessun vincolo" dichiarato ("sono flessibile") → non esclude
    preferenze implicite non dette
35. Correzione che invalida l'intero turno precedente, non un
    dettaglio → annulla l'intera inferenza, non solo un campo

**Assunzioni sulla giornata reale**
36. Documentazione (foto/nota/ricevuta) registrata giorni dopo
    l'evento → non trattata come prova che l'evento non sia avvenuto
37. Decisore reale diverso dal titolare formale (chi risponde per
    primo) → non presume una gerarchia fissa basata sul ruolo
38. Prezzo diverso da un listino standard → non segnalato come errore
    di propria iniziativa
