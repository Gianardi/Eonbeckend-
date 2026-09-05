# EON — Professional Brain Pack: specifica di progettazione e metodo

Da una consulenza di Gianardi con ChatGPT (OpenAI), 03/09/2026.
Definisce come costruire i Professional Brain Pack di EON: moduli
professionali che insegnano a EON BRAIN non le parole di un mestiere,
ma il suo contesto, i suoi oggetti, i suoi processi e il comportamento
che l'assistente deve adottare. Il primo Pack è quello della categoria
EDILE (`libro/edile.md`). Claude Code produce la prima bozza; viene poi
revisionata e perfezionata con esperienza reale, casi d'uso e test.

## 0. Posizionamento di EON (chiarito da Gianardi il 05/09/2026)

EON non è pensato solo per chi ha un mestiere/professione specifico —
è per **chiunque voglia organizzare la propria giornata e aumentare la
produttività**. Da questo derivano due livelli distinti, entrambi
necessari, mai in alternativa:

- **Livello generale (BRAIN CORE + strato comune)** — valido per
  chiunque usi EON, mestiere o no: come comportarsi con impegni,
  clienti/contatti, comunicazioni, dati sensibili, correzioni,
  ambiguità. Scritto in `libro/comune.md`, insegnato a EON come parte
  sempre presente del prompt di sistema (`systemPromptAssistente()` in
  `api/index.js`). In fase di iscrizione corrisponde alla card "Altro /
  Generico" (`data-profession="artigiano"`) — non è un ripiego per chi
  non trova la propria professione, è la porta d'ingresso naturale a
  questo livello per chiunque non abbia (ancora) un Pack dedicato.
- **Livello specifico (Professional Brain Pack)** — sopra al livello
  generale, solo per chi ha scelto una professione con un Pack dedicato
  in fase di iscrizione: vocabolario, oggetti e processi di quel
  mestiere. Aggiunto al prompt SOLO per chi ha scelto quella
  professione (`promptPackEdile()` e simili in `api/index.js`), mai per
  tutti — un idraulico non deve portarsi dietro il glossario edile.

**Le 4 professioni di partenza con un Pack dedicato, elenco finale
confermato da Gianardi il 05/09/2026** (sostituisce ogni versione
precedente discussa in `TODO.md`): **Edile** (fatto), **Idraulico**,
**Amministratore di condominio**, **Avvocato**. In futuro se ne
aggiungeranno altre — l'architettura a Pack è pensata apposta per
crescere senza mai toccare il livello generale.

## 1. Principio fondamentale

Il Professional Brain Pack NON è un manuale da dare passivamente al
modello e NON è un elenco di frasi da riconoscere. Deve insegnare a
BRAIN a comprendere il mondo professionale e a scegliere il
comportamento appropriato.

Principio guida: non insegnare "se senti questa frase fai X"; insegna
"quando questa situazione significa questo, considera questo contesto
e comportati così". I test devono verificare situazioni e capacità, non
la presenza di una specifica frase.

## 2. Architettura del Professional Brain Pack

Ogni professione usa una struttura comune, così che il BRAIN rimanga
unico mentre cambia il mondo professionale conosciuto:

- **A. Identità professionale** — chi è il professionista, come lavora,
  ambiente, ritmo, strumenti.
- **B. Giornata e contesto** — come si svolge normalmente il lavoro.
- **C. Mondo professionale** — clienti, lavori, luoghi, persone,
  documenti, fornitori, pagamenti.
- **D. Oggetti del mestiere** — gli oggetti che BRAIN deve distinguere.
- **E. Relazioni** — come gli oggetti sono collegati tra loro.
- **F. Processi** — come normalmente evolve un lavoro.
- **G. Linguaggio** — terminologia, abbreviazioni, espressioni
  colloquiali e ambigue.
- **H. Intenzioni professionali** — cosa il professionista può voler
  ottenere, indipendentemente dalle parole usate.
- **I. Comportamento EON** — come BRAIN deve ragionare, cercare,
  chiedere, proporre, agire o fermarsi.
- **J. Situazioni limite** — ambiguità, errori di dettatura, richieste
  multiple, urgenze, dati mancanti.
- **K. Cosa NON deve fare EON** — invenzioni, assunzioni pericolose,
  azioni inappropriate.
- **L. Casi di valutazione** — scenari e varianti linguistiche per la
  Evaluation Suite.

## 3. Intento ≠ strumento

Il professionista parla naturalmente e non conosce né deve conoscere i
nomi dei tool. Esempio: "Fammi vedere le foto del cantiere Fabbri"
significa una richiesta di recupero/visualizzazione di una risorsa;
BRAIN deve prima capire l'obiettivo e solo dopo scegliere lo strumento.
Il Pack non deve creare dipendenze tra singole parole e singoli tool.

## 4. Comportamento EON

Per ogni situazione significativa il Pack deve descrivere: cosa deve
capire BRAIN; quale contesto deve considerare; cosa deve cercare; quali
informazioni sono necessarie; quando può agire; quando deve chiedere;
quando deve proporre; quando deve fermarsi; cosa non deve inventare.

La priorità è l'esperienza dell'utente: se chiede una risorsa, EON deve
cercare di portarla davanti; se chiede un parere, non deve trasformarlo
automaticamente in un'attività di calendario; se chiede un'azione, non
deve sostituirla arbitrariamente con un promemoria.

## 5. Contesto e ambiguità

Il significato di un termine dipende dal contesto. Un riferimento come
"il lavoro di Rossi" può indicare oggetti diversi. BRAIN deve usare
conversazione, entità, focus corrente, dati reali e contesto
professionale prima di scegliere. Se l'ambiguità rimane sostanziale,
deve chiedere chiarimento invece di indovinare.

## 6. Temporalità e organizzazione

Il Pack deve distinguere orari/date precise, periodi vaghi, sequenze,
condizioni ("quando torno", "dopo che finisco"), scadenze e attività
senza orario. Non tutto ciò che viene detto è automaticamente un
appuntamento. Il significato temporale deve derivare dalla situazione e
dall'intento.

## 7. Priorità professionali

Il Pack deve descrivere come riconoscere urgenze, scadenze, attività
bloccanti, clienti in attesa, lavori fermi, attività programmabili e
attività delegabili. Le priorità professionali non autorizzano BRAIN a
saltare conferme o a inventare decisioni.

## 8. Risorse professionali

Per ogni professione devono essere elencate le risorse che possono
essere richieste: documenti, foto, preventivi, fatture, appunti,
storico, ecc. Regola: una richiesta di risorsa deve restare una
richiesta di risorsa. Non deve diventare automaticamente un promemoria
perché il recupero non è riuscito.

## 9. Comunicazione

Il Pack deve distinguere tra informazione interna e comunicazione verso
terzi, indicare le comunicazioni delicate e i casi in cui serve
conferma. La comunicazione non deve essere confusa con la creazione di
un impegno.

## 10. Conoscenza generale vs conoscenza personale

Il Pack contiene conoscenza generale della professione. I dati e le
abitudini del singolo professionista appartengono al contesto/memoria
personale. Esempio: il Pack può sapere che un edile fa sopralluoghi;
solo i dati dell'utente possono insegnare che quel professionista
normalmente li fa al mattino.

## 11. Evoluzione del Pack

Processo previsto: bozza Claude/Anthropic → revisione EON → esperienza
reale → casi → test → osservazione del comportamento → nuova versione.
La prima bozza non è la verità definitiva del mestiere. Va confrontata
con professionisti reali.

## 12. Metodo di lavoro con Claude Code

Claude Code prepara la prima bozza del Professional Brain Pack usando
conoscenza generale e struttura EON. La bozza non deve essere
trasformata subito in codice. Prima si revisiona il contenuto, si
correggono assunzioni, si aggiungono comportamenti EON e si definiscono
i casi di valutazione. Solo dopo si decide come integrarlo tecnicamente
nel BRAIN.

## 13. Obiettivo finale

Il risultato desiderato non è un EON che conosce più comandi. È un EON
che, conoscendo la professione, riesce a comprendere meglio cosa sta
succedendo, cosa l'utente vuole ottenere, quali informazioni servono e
quale comportamento è appropriato.

**Formula guida**: BRAIN CORE + PROFESSIONAL BRAIN PACK + DATI/CONTESTO
DELL'UTENTE → COMPORTAMENTO EON.

## Regola per ogni versione di un Pack

Non aggiungere correzioni isolate per ogni fallimento osservato durante
i test. Quando un test fallisce, chiedersi quale capacità generale
manca al Pack o al BRAIN — non tappare il singolo buco. Ogni nuova
regola deve essere generalizzabile a richieste non viste. Il Pack deve
essere validato con professionisti reali prima di essere considerato
definitivo.
