# EON — Strato comune: 50 casi ipotetici (OpenAI, lotto 1)

Portato da Gianardi il 04/09/2026, generato da OpenAI a partire dal
testo di richiesta in `libro/richiesta-strato-comune.md`. Casi
costruiti per ipotesi, da validare con utenti reali — non osservati.
Fonte per `libro/comune.md`, scritto da zero (senza guardare
`libro/edile.md`, come deciso con Gianardi).

---

## A. Frasi ambigue nella comunicazione quotidiana

**A01 | WhatsApp** — «Spostalo a domani pomeriggio.» — Non è chiaro
quale appuntamento si debba spostare; "pomeriggio" non identifica un
orario preciso. Il sistema deve ricostruire il contesto e chiedere
chiarimenti quando l'oggetto dell'azione non è sufficientemente
identificato.

**A02 | Vocale** — «Sì, va bene quello di prima.» — "Quello di prima"
può riferirsi all'ultima proposta, al documento o all'appuntamento
menzionato. Richiede comprensione del contesto, non riconoscimento di
parole chiave.

**A03 | Chat** — «Mandagli le solite cose.» — Non sono identificati con
certezza né il destinatario né lo scope di "le solite cose". Un
assistente operativo deve evitare di inventare lo scope di un comando
generico.

**A04 | WhatsApp** — «Ci vediamo verso le cinque, come l'altra volta.»
— "Verso" è volutamente impreciso e il riferimento all'altra volta
potrebbe non essere univoco. Distinguere un'indicazione approssimativa
da un orario confermato.

**A05 | Vocale** — «No, aspetta, non venerdì… giovedì mattina.» — Una
trascrizione/esecuzione troppo rapida potrebbe conservare il primo
giorno anziché la correzione. Le autocorrezioni modificano l'intento
precedente, non sono due istruzioni indipendenti.

**A06 | Chat** — «Conferma pure.» — Non specifica quale proposta,
appuntamento o comunicazione debba essere confermata. Una conferma
senza oggetto esplicito è pericolosa quando produce un'azione esterna.

**A07 | Email** — «Fallo appena puoi.» — Non stabilisce una scadenza
reale; trattarlo come urgente sarebbe arbitrario. Distinguere priorità
esplicite da formulazioni colloquiali.

**A08 | WhatsApp** — «Ricordami di sentirlo più avanti.» — Mancano
persona e momento del promemoria. Un promemoria richiede almeno un
riferimento temporale o contestuale sufficientemente affidabile.

**A09 | Vocale** — «Quello alle tre no, l'altro sì.» — Richiede di
distinguere almeno due elementi senza nominarli esplicitamente — serve
risoluzione contestuale delle entità e delle alternative.

**A10 | Chat** — «Metti tutto a posto e avvisali.» — "Tutto" e "loro"
hanno scope non definito. Il sistema non deve trasformare
automaticamente termini vaghi in un insieme arbitrario di azioni.

## B. Ambiguità da omonimia o riferimenti sovrapposti

**B01** — Due contatti "Marco", entrambi con una conversazione
recente — il nome da solo non basta a identificare il destinatario
corretto.

**B02** — Più documenti associati alla stessa persona, creati in date
diverse — serve risolvere l'entità con contesto, data e altri
attributi.

**B03** — Due contatti con lo stesso cognome hanno comunicato
recentemente via email — una corrispondenza nominale superficiale può
causare una comunicazione al destinatario sbagliato.

**B04** — Due file entrambi indicati informalmente come "versione
aggiornata" — "aggiornato" è uno stato relativo, non identifica una
singola versione.

**B05** — Più documenti dello stesso mese — data e stato ("definitivo")
devono essere collegati a un'entità precisa, non solo al periodo.

**B06** — Due persone con lo stesso nome, più interazioni nello stesso
giorno — serve usare la cronologia per risolvere riferimenti personali
ambigui.

**B07** — Due persone con lo stesso nome, appuntamenti nello stesso
periodo — nome e tipo di oggetto possono non bastare a individuare
l'evento corretto.

**B08** — Un contatto con più numeri storici, o un numero riusato nel
tempo — i dati di contatto hanno una dimensione temporale, non vanno
trattati come valori statici.

**B09** — Più invii recenti con allegati diversi — "l'ultima volta" va
risolto rispetto all'attività pertinente, non al semplice ultimo
evento cronologico.

**B10** — Più tipi di oggetto (appuntamenti, pratiche, documenti)
riferiti allo stesso periodo — il sistema deve identificare anche il
tipo di oggetto a cui l'utente si riferisce, non solo il periodo.

## C. Errori temuti / rischi concreti

**C01** — Foto/allegati che potrebbero riguardare anche altre persone,
destinatario non sufficientemente identificato — la condivisione di
allegati richiede cautela su destinatario e contenuto.

**C02** — "I dati che abbiamo" può includere informazioni personali non
appropriate per quel destinatario — distinguere autorizzazione alla
condivisione da semplice riferimento generico ai dati.

**C03** — Un prezzo "concordato" mai confermato per iscritto — il
sistema non deve trasformare un'ipotesi in un fatto né un'inferenza in
un impegno.

**C04** — Messaggio emotivo ("annulla tutto, non ne voglio più
sapere") che potrebbe riferirsi solo alla conversazione appena
avvenuta — le azioni irreversibili richiedono verifica dello scope,
specie dopo messaggi emotivi.

**C05** — "Pagalo", senza destinatario/importo/documento chiari — un
azione finanziaria non va eseguita su riferimenti insufficienti.

**C06** — "Conferma che abbiamo accettato" potrebbe richiedere una
bozza, non un invio — distinguere "prepara" da "invia", "valuta" da
"accetta".

**C07** — Condividere la posizione può coinvolgere anche altre persone
e trattare un dato sensibile — richiede verifica di destinatario e
contesto.

**C08** — La versione "completa" di un documento può contenere dati
volutamente omessi nella versione già condivisa — considerare il
contenuto dell'allegato, non solo il suo nome.

**C09** — "Per noi va bene qualsiasi prezzo" può essere una frase
negoziale, non un mandato economico senza limiti — il linguaggio
colloquiale non va interpretato automaticamente come autorizzazione.

**C10** — "Ok, procedi" con più proposte in discussione — una conferma
breve va collegata con certezza all'oggetto a cui si riferisce.

## D. Pattern generali del linguaggio naturale

**D01 — Autocorrezione**: «Mandalo a Luca… anzi no, a Marco.» — l'entità
iniziale viene sostituita; vale la correzione finale, non è rumore da
ignorare.

**D02 — Stato provvisorio esplicito**: «Direi che possiamo farlo, però
vediamo.» — orientamento favorevole ma esplicitamente non definitivo,
va distinto da una decisione presa.

**D03 — Cortesia vs impegno**: «Va benissimo, ci pensiamo noi.» /
«Tranquillo, ci penso io.» — può essere rassicurazione conversazionale,
non assegnazione o autorizzazione — mai trasformata automaticamente in
un task/impegno.

**D04 — Pianificazione condizionale**: «Se non ci sono problemi,
fissiamo per martedì.» — condizione da rappresentare nello stato
dell'azione, non una richiesta di creare subito un impegno definitivo.

**D05 — Delega generale**: «Fai tu, come preferisci.» — delega una
scelta, ma non implica automaticamente un'autorizzazione illimitata su
ogni dettaglio.

**D06 — Stato temporaneo**: «Per ora lasciamo così.» — non significa
chiudere o archiviare, va rappresentato come provvisorio.

**D07 — Correzione con doppio riferimento temporale**: «No, non quello
che ti ho mandato ieri, quello di oggi.» — richiede confronto tra
riferimenti temporali; la correzione annulla il riferimento precedente.

**D08 — Rimando esplicito**: «Quando arriva, poi vediamo cosa fare.» —
l'azione successiva è esplicitamente non ancora determinata, non va
anticipata.

**D09 — Conferma condizionata**: «Se per te è ok, possiamo
considerarlo confermato.» — condizione da mantenere, non un'approvazione
incondizionata da eseguire subito.

## E. Assunzioni "da manuale" probabilmente sbagliate

**E01** — Un messaggio inviato a tarda sera non equivale a una lettura
o conferma reale prima dell'orario indicato — invio ≠ conferma
reciproca.

**E02** — L'assenza di risposta su un canale (es. email) non implica
assenza di decisione — lo stato di una conversazione può essere
distribuito su più canali.

**E03** — Un riferimento temporale relativo ("dopo") ripetuto più
volte nella giornata cambia significato a ogni messaggio — non va
convertito una volta per tutte in un orario fisso.

**E04** — Un appuntamento formalmente fissato può essere stato
modificato più volte tramite messaggi informali — una fonte
strutturata (calendario) non è automaticamente più aggiornata del
contesto recente.

**E05** — Una decisione presa solo a voce, senza traccia scritta
successiva, può comunque esistere ed essere valida — l'assenza di
traccia formale non implica assenza della decisione.

**E06** — «Lo decidiamo quando ci vediamo» non va trasformato subito in
una decisione o attività definitiva — va rappresentata come
intenzione futura ancora aperta.

**E07** — Un promemoria richiesto senza data ("ricordamelo") può
dipendere da un evento futuro, non da un timestamp fisso.

**E08** — La stessa persona può usare canali diversi per comunicazioni
diverse senza una regola stabile — non presumere un canale principale.

**E09** — Un dato strutturato (es. calendario) non è automaticamente
più autorevole di una conversazione più recente che lo contraddice —
serve gestione delle fonti e delle loro date di aggiornamento.

**E10** — Quando si ricostruisce "cosa avevamo deciso", la persona
stessa può correggere la decisione mentre la ricostruisce — la memoria
deve distinguere decisioni storiche, superate e stato attuale.

## Osservazione trasversale (framework degli errori — da OpenAI)

Il problema dello strato comune non è riconoscere comandi fissi. È
capire a quale oggetto, persona, versione, momento e livello di impegno
si riferisce l'utente, mantenendo l'incertezza quando il contesto non
permette di determinarlo con sufficiente sicurezza.

**8 modalità di errore (failure mode) da tenere sempre presenti**:
1. Errore di comprensione dell'intento
2. Errore di risoluzione dell'entità
3. Errore di interpretazione dello stato
4. Errore di autorizzazione
5. Errore di scope dell'azione
6. Errore temporale
7. Errore nella gestione delle correzioni
8. Errore nella gestione di informazioni distribuite su più canali

**Principio generale**: quando un'azione può modificare dati,
comunicare all'esterno, condividere informazioni, creare un impegno
economico/organizzativo o produrre una conseguenza difficile da
annullare, l'assistente deve privilegiare la corretta risoluzione
dell'intento e, quando necessario, chiedere conferma invece di
completare arbitrariamente ciò che manca.
