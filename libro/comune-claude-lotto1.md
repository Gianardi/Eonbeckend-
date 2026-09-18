# EON — Casi ipotetici per lo strato comune (Claude chat, lotto 1)

Portato da Gianardi il 04/09/2026, generato da Claude chat a partire
dal testo di richiesta in `libro/richiesta-strato-comune.md`. Stessa
nota metodologica degli altri lotti: ipotesi plausibili, non
osservazioni reali. Fonte per `libro/comune.md`; le voci genuinamente
nuove rispetto al lotto OpenAI sono state integrate lì.

---

## A. Frasi ambigue nella comunicazione quotidiana

**A1 | WhatsApp** — "Segna quello di prima alle 15 come al solito." —
"Quello di prima" ambiguo (ultimo messaggio? ultimo appuntamento?
cliente ricorrente?); "come al solito" presuppone uno schema implicito
(durata, servizio, luogo) che il sistema non conosce con certezza.

**A2 | Vocale** — "Anzi no, spostalo al giovedì— no aspetta, meglio
venerdì mattina." — Autocorrezione in tempo reale; l'ultima istruzione
sovrascrive le precedenti, non le somma.

**A3 | Chat** — "Ok perfetto, confermato." — Conferma senza oggetto
esplicito con più proposte aperte (data, prezzo, orario alternativo);
il sistema deve tracciare quali proposte sono "in sospeso", non solo
l'ultimo messaggio.

**A4 | WhatsApp** — "Ci vediamo la settimana prossima, dimmi tu
quando." — Range vago che delega la scelta senza vincoli espliciti; il
sistema deve proporre opzioni concrete, non bloccarsi né inventare.

**A5 | Email** — Catena "Ri: Ri: Ri:" con più proposte diverse nel
tempo, "procediamo pure" non specifica quale versione.

**A6 | Vocale** — "Manda tutto a quello che sai." — Scope indefinito
("tutto") e destinatario implicito da un contesto precedente che
potrebbe essere sbagliato/obsoleto.

**A7 | Chat** — "Fai come l'altra volta." — Riferimento storico troppo
vago per essere risolto senza chiedere conferma.

**A8 | WhatsApp** — "Nel pomeriggio ci sono, tipo dopo pranzo." —
Fascia oraria informale/soggettiva; non fissare un orario preciso
senza segnalare l'approssimazione.

**A9 | Email** — "Confermo per l'importo di cui abbiamo parlato." —
Importo mai scritto esplicitamente, solo discusso a voce.

**A10 | Vocale** — "Rispondi tu che io adesso non ho tempo, di' quello
che ti sembra giusto." — Delega piena e istantanea in un contesto
emotivo (fretta/stress) che potrebbe non riflettere la reale volontà.

## B. Ambiguità da omonimia o riferimenti sovrapposti

**B1** — Due clienti salvati entrambi come "Marco" senza cognome, uno
storico, uno recente — irrisolvibile senza disambiguazione, mai
scegliere il più recente per default.

**B2** — Numero di telefono riassegnato dall'operatore a una persona
nuova — il sistema associa per errore i nuovi messaggi alla vecchia
scheda cliente.

**B3** — Etichetta informale non univoca ("quello urgente") che indica
persone/casi diversi in periodi diversi.

**B4** — Due preventivi via email allo stesso cliente, stesso oggetto,
importi diversi — "confermo il preventivo" non specifica quale.

**B5** — Stesso indirizzo usato da due clienti diversi in periodi
diversi (subentro, cambio residenza) — l'indirizzo da solo non è un
identificatore affidabile nel tempo.

**B6** — Numero condiviso da più persone con ruoli diversi (titolare
vs commesso) — non è sempre la stessa persona a scrivere.

**B7** — Foto con nome generico ("foto1.jpg") sovrascritta
concettualmente da un'altra simile mesi dopo — senza data/cliente
associato esplicito, "manda la foto di prima" rischia la versione
sbagliata.

**B8** — Due appuntamenti diversi con lo stesso cliente nella stessa
settimana, entrambi chiamati genericamente "l'appuntamento" — "sposta
l'appuntamento" ambiguo su quale.

**B9** — Email aziendale generica (es. "info@") gestita da più
persone nel tempo — rispondere assumendo un solo interlocutore può
disallineare gli accordi.

**B10** — "Il pagamento di prima" quando ci sono stati due pagamenti
parziali recenti per servizi diversi — rischio di errore su importi/
ricevute.

## C. Errori temuti / rischi concreti

**C1** — Nota sanitaria/personale associata al contatto sbagliato per
omonimia, resta visibile sulla scheda sbagliata.

**C2** — Messaggio valutativo su un cliente ("è pesante, meglio
evitarlo") pensato per un collega, inviato per errore al cliente
stesso.

**C3** — Cifra "buttata lì" in una conversazione informale ("diciamo
un 200, poi vediamo") registrata come prezzo confermato in una
comunicazione ufficiale.

**C4** — Vocale registrato in auto, con dettagli di posizione/contesto
in sottofondo, trascritto e inoltrato per intero insieme al resto.

**C5** — Foto di un documento d'identità/contratto condivisa per un
motivo, poi reinoltrata per errore per una richiesta successiva mal
interpretata.

**C6** — Messaggio a caldo, in un momento di frustrazione ("cancella
tutto con questo cliente") — azione irreversibile presa su un impulso
emotivo momentaneo.

**C7** — Cliente conferma rispondendo a un'email con altre persone in
copia non coinvolte nell'accordo specifico — rischio di esporre
prezzo/condizioni a chi non dovrebbe vederli.

**C8** — "Cancella l'appuntamento di domani" con due clienti diversi
che hanno un appuntamento il giorno dopo.

**C9** — "Digli che va bene, tanto è una formalità" riferito a un
accordo che in realtà è vincolante — il linguaggio minimizza un
impegno reale.

**C10** — Sollecito di pagamento automatico inviato a un cliente che
aveva già pagato con un metodo non tracciato (contanti, bonifico non
ancora registrato).

## D. Pattern generali del linguaggio naturale

**D1** — Autocorrezione nella stessa frase ("alle 4, anzi alle 4 e
mezza") — vale il valore finale.

**D2** — Cortesia/rassicurazione ("sei stato gentilissimo!") non
implica automaticamente conferma di un punto preciso.

**D3** — Delega generale ("fai tu, mi fido") seguita da silenzio
prolungato — il silenzio successivo non estende automaticamente la
delega a decisioni future non ancora discusse.

**D4** — Stato esplicitamente provvisorio ("per ora lasciamo così, poi
si vede") — non va trattato come definitivo.

**D5** — Pianificazione condizionale ("se piove rimandiamo") — l'esito
dipende da un evento futuro non ancora verificabile.

**D6** — Linguaggio esitante/attenuato ("non è che... insomma... se
per te va bene...") che esprime comunque una richiesta reale, formulata
indirettamente per cortesia o insicurezza.

**D7** — Conferme brevi ripetute più volte ("sì sì, ok, come vuoi tu")
su proposte diverse — può segnalare disimpegno/scarsa attenzione
invece di accordo pieno.

**D8** — "Confermo salvo imprevisti" — clausola di riserva esplicita,
non una conferma incondizionata.

**D9** — "Boh, fai un po' come ti pare, sono flessibile" — "nessun
vincolo" spesso nasconde comunque preferenze implicite non dichiarate.

**D10** — "Ah no aspetta, quello non c'entra, dicevo un'altra cosa" —
correzione che invalida l'intera interpretazione del turno precedente,
non solo un dettaglio.

## E. Assunzioni "da manuale" probabilmente sbagliate

**E1** — L'email non è controllata regolarmente da tutti — molti
usano WhatsApp per tutto ciò che è urgente, l'email resta invisibile
per ore/giorni.

**E2** — La decisione finale non spetta sempre al titolare formale —
spesso decide chi risponde per primo o gestisce materialmente il
rapporto (un familiare, un collaboratore).

**E3** — Un appuntamento in agenda non è sempre vincolante come un
contratto — molti accordi restano "morbidi" con riconferme informali
last-minute mai messe per iscritto.

**E4** — La documentazione (foto, nota, ricevuta) spesso avviene dopo,
a volte giorni dopo, o non avviene affatto per lavori piccoli/di
routine — l'assenza di documentazione tempestiva non implica assenza
dell'evento.

**E5** — Accordi importanti (prezzo, tempistiche) spesso presi a voce
e solo parzialmente riportati per iscritto, se non per niente.

**E6** — Silenzio di giorni non implica perdita di interesse — molte
persone gestiscono la corrispondenza a ondate.

**E7** — Le persone mescolano i canali secondo comodità del momento,
non secondo una logica coerente per tipo di contenuto.

**E8** — Prezzi/tariffe spesso applicati con sconti o eccezioni "a
sentimento", non scritte da nessuna parte — una cifra diversa dal
listino non è automaticamente un errore.

**E9** — La pianificazione settimanale viene riorganizzata più volte
durante la settimana per imprevisti, comunicati in modo informale e
last-minute.

**E10** — Spesso le persone scrivono "pensando ad alta voce", ancora
indecise, aspettandosi aiuto a chiarire — non un'esecuzione immediata
di un input trattato come già completo e deciso.

---

*Fine Lotto 1 — 50 casi (5 gruppi × 10).*
