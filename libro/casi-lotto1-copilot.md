# Casi plausibili per EON — Lotto 1 (50 casi)

Portato da Gianardi il 03/09/2026, generato con un altro strumento AI
(non Claude). Esplicitamente etichettato dalla fonte come **plausibile,
non verificato** — ipotesi da validare con un edile vero, non fatti.
Usato per correggere/arricchire `libro/edile.md`; le voci genuinamente
nuove sono state integrate lì (vedi commit). Conservato qui per intero
come fonte, non come parte del Pack.

## Nota metodologica — leggere prima di usare questo file

Questi casi **non sono episodi osservati o verificati**. Sono costruiti a partire da pattern noti e plausibili su come professionisti edili (piccole imprese, artigiani, capicantiere) usano email, WhatsApp e gestionali — dedotti da conoscenza generale, non da esperienza diretta o da dati raccolti sul campo.

Vanno trattati come **ipotesi da validare**, non come verità. Ogni caso che un edile vero legge e scarta ("questo non lo farei mai così") è un'informazione preziosa quanto un caso confermato — serve a correggere il modello, non solo a riempirlo.

Struttura: ogni caso ha un ID, il canale, l'intento presunto, il testo/situazione, e perché è potenzialmente ambiguo o rischioso per un sistema come EON.

---

## Sezione A — Frasi che un sistema potrebbe interpretare male (15 casi)

**A01 | WhatsApp**
"Manda la foto di ieri a Rossi"
→ Ambiguo: "di ieri" può riferirsi alla data della foto o alla data del cantiere. Se ci sono due cantieri "Rossi" (vedi B), rischio di inviare la foto sbagliata alla persona sbagliata.

**A02 | Email**
"Come discusso, procediamo con il preventivo"
→ Nessun preventivo allegato né riferimento esplicito a quale. Un sistema che genera azioni automatiche rischia di "confermare" un preventivo mai fissato per iscritto.

**A03 | WhatsApp**
"Fai partire i lavori lunedì"
→ "Lunedì" senza data: se il messaggio viene letto/elaborato con giorni di ritardo, il sistema potrebbe calcolare il lunedì sbagliato.

**A04 | Vocale trascritto**
"Di' al fornitore che ci servono altri due... quelle cose là, sai quali"
→ Riferimento a un oggetto non nominato esplicitamente, tipico di messaggi vocali informali tra persone che si conoscono bene. Un NLP standard non ha contesto sufficiente.

**A05 | WhatsApp**
"Manda tutto quello che abbiamo su Bianchi"
→ "Tutto" è vago: foto, preventivi, fatture, contatti? Rischio di condividere dati sensibili (es. importi) con destinatario sbagliato se "Bianchi" è ambiguo tra cliente e fornitore.

**A06 | Email**
"Confermo per giovedì, stessa ora di sempre"
→ "Stessa ora di sempre" presuppone una storia condivisa che il sistema non ha, se non è mai stata registrata esplicitamente.

**A07 | WhatsApp**
"Il cantiere di sopra ha bisogno di cemento"
→ "Di sopra" è un riferimento geografico/gerarchico interno al mittente (es. cantiere in salita, o "il prossimo nella lista"), non un nome di cantiere standard.

**A08 | Vocale**
"Prendi nota: 3 sacchi, no aspetta 4, mettiamo 5 per sicurezza"
→ Autocorrezione in tempo reale nel parlato. Un sistema che trascrive linearmente rischia di registrare "3" o "4" invece del valore finale "5".

**A09 | WhatsApp**
"Manda la fattura vecchia, quella che ho detto io"
→ "Quella che ho detto io" fa riferimento a una conversazione precedente non necessariamente presente nel contesto recuperabile da EON.

**A10 | Email breve**
"Ok procedi" (in risposta a un'email con 3 opzioni proposte)
→ Conferma senza specificare quale opzione. Ambiguità totale se le opzioni non sono numerate o l'email precedente non è nel contesto immediato.

**A11 | WhatsApp**
"Chiama il solito numero per il ferro"
→ "Il solito" presuppone una relazione di fornitura abituale non necessariamente codificata in anagrafica.

**A12 | Vocale**
"Segna che oggi abbiamo finito, anzi no, domani finiamo"
→ Correzione di stato progetto in tempo reale; rischio di registrare "finito" prematuramente se il sistema processa frase per frase.

**A13 | WhatsApp con foto**
[foto senza testo]
→ Nessun contesto testuale. Il sistema deve dedurre destinazione/scopo solo da metadati (chi ha mandato cosa, quando) — alto rischio di archiviazione errata.

**A14 | Email**
"Rimando lo stesso preventivo di prima con lo sconto che ci siamo detti"
→ "Lo sconto che ci siamo detti" non è quantificato nel messaggio; se concordato solo a voce, EON non ha modo di verificarlo.

**A15 | WhatsApp**
"Metti in agenda per la settimana prossima, tanto io sono libero sempre tranne il mercoledì"
→ Vincolo negativo ricorrente (esclusione, non inclusione) — pattern che molti sistemi di scheduling gestiscono male.

---

## Sezione B — Ambiguità da omonimia o riferimenti sovrapposti (10 casi)

**B01**
Due clienti chiamati "Rossi" (Mario Rossi edile privato, e "Rossi Costruzioni SRL" azienda). Un messaggio "manda il preventivo a Rossi" è ambiguo se non specificato altrove.

**B02**
Due cantieri nella stessa via, numeri civici vicini (es. Via Garibaldi 12 e Via Garibaldi 14), gestiti in parallelo. "Il cantiere di via Garibaldi" senza numero è ambiguo.

**B03**
Un fornitore e un subappaltatore hanno lo stesso nome di battesimo usato colloquialmente ("Giovanni il ferramenta" vs "Giovanni l'elettricista"). Un messaggio vocale che dice solo "Giovanni" richiede contesto.

**B04**
Un cliente ha cambiato cognome (es. per matrimonio) tra un cantiere vecchio e uno nuovo — stessa persona, EON potrebbe trattarla come due entità diverse se l'anagrafica non è stata aggiornata.

**B05**
"Il lavoro di Rossi" può intendere: il lavoro *per* Rossi (cliente) o il lavoro *fatto da* Rossi (subappaltatore/collega). La preposizione "di" è strutturalmente ambigua in italiano in questo contesto.

**B06**
Due preventivi inviati allo stesso cliente in date diverse per lo stesso tipo di lavoro (es. rifacimento bagno) ma con specifiche diverse — un riferimento generico "il preventivo di Rossi" è ambiguo su quale versione.

**B07**
Un capocantiere e un cliente hanno lo stesso nome comune (es. "Marco"). In un gruppo WhatsApp misto, "chiedi a Marco" è ambiguo senza cognome o ruolo.

**B08**
Un indirizzo email condiviso da due persone in una piccola impresa familiare (padre e figlio) — un messaggio ricevuto non è chiaro su chi debba rispondere o agire.

**B09**
Due fornitori diversi vendono lo stesso materiale (es. "il cemento") a prezzi diversi — "ordina il cemento come al solito" è ambiguo su quale fornitore, specie se "al solito" è cambiato di recente senza che l'abitudine sia aggiornata nel sistema.

**B10**
Stesso cantiere ma nomi diversi usati da persone diverse del team (uno lo chiama "il cantiere di Rossi", un altro "quello di via Roma") — nessuna delle due nomenclature è ufficiale, e EON deve riconciliarle.

---

## Sezione C — Errori temuti / rischi concreti (10 casi)

**C01**
Foto di un difetto strutturale (es. crepa) allegata al cantiere sbagliato per errore di selezione rapida su WhatsApp — rischio: documentazione fuorviante in caso di contestazione legale.

**C02**
Un prezzo indicato "a voce" in una chiamata mai trascritta correttamente, poi ripreso da EON come se fosse un valore confermato per iscritto — rischio: contestazione del cliente su un prezzo mai realmente promesso in quei termini.

**C03**
Una scadenza menzionata da un cliente in tono ipotetico ("se possibile per fine mese") viene registrata come impegno vincolante — rischio: aspettativa del cliente non allineata alla reale disponibilità del team.

**C04**
Messaggio inviato al gruppo WhatsApp sbagliato (es. gruppo "Cantiere A" invece di "Cantiere B") contenente informazioni riservate su un prezzo o un problema con un fornitore — rischio: fuga di informazioni commerciali.

**C05**
Un documento (es. certificazione, DURC) scaduto ma non aggiornato nel sistema, usato automaticamente in una comunicazione col cliente — rischio reputazionale/legale.

**C06**
Promessa di intervento urgente fatta da un collaboratore senza autorità decisionale, poi trattata da EON come impegno ufficiale dell'impresa — rischio: sovraccarico di aspettative non gestibili.

**C07**
Errore di somma in un preventivo verbale (es. "diciamo sui 15" inteso come 15.000 da chi parla, ma interpretabile come 1.500 o 15 al metro quadro da chi ascolta) — rischio: contestazione economica seria.

**C08**
Foto di un cantiere non ancora concordato con il cliente (es. sopralluogo preliminare) condivisa per errore come se fosse "lavoro in corso" — rischio: cliente crede che i lavori siano già iniziati senza accordo formale.

**C09**
Un messaggio di cortesia ("ci pensiamo noi, stia tranquillo") interpretato come impegno formale su tempi/costi non ancora definiti — rischio: gap tra linguaggio relazionale italiano (rassicurazione) e impegno contrattuale.

**C10**
Dati di un cliente condivisi con un fornitore per errore di destinatario in un forward veloce da mobile — rischio: violazione privacy (GDPR) anche minima ma concreta.

---

## Sezione D — Terminologia e abbreviazioni di settore da verificare (8 casi)

**D01** — "SAL" (Stato Avanzamento Lavori): termine tecnico-amministrativo, spesso abbreviato anche a voce ("mandami il sal") — va verificato se il glossario lo tratta come entità o solo come parola.

**D02** — "Capitolato": documento tecnico che descrive lavorazioni e materiali. Spesso confuso colloquialmente con "preventivo" da chi non è del settore, ma nel gergo edile sono cose diverse.

**D03** — Abbreviazioni di materiali via WhatsApp: "cls" (calcestruzzo), "ca" (cemento armato), "tondino" (ferro per armatura) — linguaggio tecnico abbreviato usato anche in messaggi informali.

**D04** — "Dare/avere" usato colloquialmente per indicare crediti/debiti di cantiere tra impresa e cliente, non nel senso contabile stretto.

**D05** — "Extra" o "lavori extra": termine usato genericamente per lavori non previsti nel preventivo originale, spesso senza distinzione tra "variante concordata" e "richiesta informale del cliente".

**D06** — Nomi di materiali con varianti regionali/dialettali (es. "tavelle", "forati", nomi che cambiano tra Nord e Sud Italia per lo stesso materiale).

**D07** — "SCIA", "CILA", pratiche edilizie citate per sigla senza spiegazione, spesso confuse tra loro anche dagli addetti ai lavori non esperti in burocrazia.

**D08** — Uso di "domani mattina presto" o "verso sera" come orari informali, mai tradotti in fascia oraria precisa — pattern linguistico ricorrente nel settore, dove gli orari esatti sono spesso evitati deliberatamente per lasciarsi margine.

---

## Sezione E — Assunzioni "da manuale" probabilmente sbagliate sulla giornata reale (7 casi)

**E01**
Ipotesi comune: l'edile controlla email al mattino in ufficio. Pattern più plausibile: l'email viene controllata a fine giornata o la sera, da mobile, mentre WhatsApp viene controllato più volte durante il giorno tra un cantiere e l'altro.

**E02**
Ipotesi comune: le decisioni su prezzo/tempi passano dal titolare formalmente. Pattern più plausibile: in piccole imprese familiari, un capocantiere o un collaboratore fidato prende decisioni sul campo che vengono "regolarizzate" dopo, non prima.

**E03**
Ipotesi comune: ogni cantiere ha un referente WhatsApp unico e stabile. Pattern più plausibile: il referente cambia (cliente, poi geometra, poi un familiare del cliente) senza che nessuno lo comunichi esplicitamente a chi gestisce le comunicazioni.

**E04**
Ipotesi comune: le richieste urgenti arrivano durante l'orario di lavoro. Pattern più plausibile: messaggi urgenti arrivano anche la sera tardi o nel weekend, e la risposta "urgente" spesso avviene comunque solo il giorno lavorativo successivo — il tono del messaggio non predice l'urgenza reale della risposta.

**E05**
Ipotesi comune: un preventivo accettato genera automaticamente un impegno formale. Pattern più plausibile: l'accettazione verbale ("va bene, andiamo così") precede di giorni o settimane un impegno scritto, e nel frattempo si opera già come se fosse confermato.

**E06**
Ipotesi comune: ogni fornitore ha un canale di comunicazione dedicato e coerente. Pattern più plausibile: con lo stesso fornitore si comunica a volte per telefono, a volte WhatsApp, a volte di persona in cantiere — a seconda di chi risponde più in fretta, non di una policy.

**E07**
Ipotesi comune: le priorità tra cantieri sono decise a inizio settimana e seguite. Pattern più plausibile: le priorità cambiano più volte al giorno in base a imprevisti (meteo, ritardo materiali, problema su un altro cantiere) — la pianificazione formale è spesso già superata quando viene consultata.

---

## Come usare questo file

1. Fallo leggere a un edile vero (anche solo 10-15 minuti, anche a voce).
2. Per ogni caso: chiedi solo "sì, capita" / "no, mai" / "capita ma diverso, cioè...".
3. Segna i "no" e i "diverso" — sono più preziosi dei "sì", perché correggono il modello invece di confermarlo.
4. Poi procedo con il lotto 2 (casi 51-100), integrando le correzioni.
