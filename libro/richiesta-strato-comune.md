Testo pronto da incollare in ChatGPT/Claude chat (o altro strumento AI)
per generare i casi dello strato comune. Non menzionare l'edile né
altri mestieri già scritti, per evitare contaminazione (vedi
`TODO.md`).

---

Sto costruendo lo "strato comune" di un assistente AI (EON) che aiuta
piccoli professionisti e imprenditori italiani a gestire clienti,
appuntamenti, documenti/foto, pagamenti e comunicazioni (email,
WhatsApp, chat), parlandogli in linguaggio naturale invece che con
comandi fissi.

Lo strato comune deve valere per QUALSIASI persona che usa l'assistente
— non per un mestiere specifico. Niente gergo tecnico di un settore
(niente edilizia, niente termini di cantiere): potrebbe essere un
parrucchiere, un consulente, un negoziante, un libero professionista,
chiunque gestisca clienti e appuntamenti nella vita quotidiana.

Mi servono casi plausibili (NON dati osservati o verificati — costruiti
per ipotesi, da validare poi con utenti veri) che mostrino situazioni
in cui un assistente AI potrebbe capire male una richiesta, o rischiare
un errore concreto. Ogni caso: un ID, il canale (email/WhatsApp/
vocale/chat), la frase o situazione, e perché è ambigua o rischiosa per
un sistema che deve gestire davvero calendario, contatti, documenti,
pagamenti.

Organizza i casi in 5 gruppi, circa 10 casi ciascuno per lotto (50 casi
a lotto):

**A. Frasi ambigue nella comunicazione quotidiana** — riferimenti vaghi
("quello di prima", "come al solito"), correzioni a voce in tempo
reale, conferme che non specificano a cosa si riferiscono, range
temporali volutamente vaghi, comandi generici senza scope chiaro.

**B. Ambiguità da omonimia o riferimenti sovrapposti** — contatti con
lo stesso nome, stesso indirizzo/numero riusato da persone diverse nel
tempo, appuntamenti/documenti con etichette informali che cambiano
significato nel tempo, più opzioni/versioni con lo stesso riferimento.

**C. Errori temuti / rischi concreti** — dato collegato al contatto
sbagliato, comunicazione inviata al destinatario sbagliato, prezzo o
impegno inventato/mai confermato, privacy (posizione, foto, dati
sensibili condivisi per errore), azioni irreversibili prese da un
singolo messaggio emotivo o ambiguo.

**D. Pattern generali del linguaggio naturale** — autocorrezione nella
stessa frase, cortesia/rassicurazione scambiata per impegno formale,
delega generale ("fai tu")/autorizzazione per silenzio, stato
esplicitamente provvisorio ("da vedere"), pianificazione condizionale
("se succede X allora Y").

**E. Assunzioni "da manuale" probabilmente sbagliate sulla giornata
reale** — su quando/come le persone controllano email vs messaggi,
su chi decide davvero in una piccola attività, su quanto la
pianificazione formale regge nella pratica, su quando si documenta
davvero un lavoro/una decisione.

Per ogni caso, se è utile, aggiungi una breve nota sul perché è
rilevante per un sistema che deve capire l'intento (non riconoscere
frasi fisse) e comportarsi bene — non serve una spiegazione lunga,
basta una riga.

Non forzare un numero fisso enorme di casi tutti insieme: qualità
prima di quantità, meglio pochi casi realmente distinti che tanti
ripetitivi. Fermati se inizi a ripetere pattern già dati.
