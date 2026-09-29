# EON — Roadmap completa

Aggiornata al 28/09/2026. Un solo posto con tutto quello che resta da fare,
in ordine. Il dettaglio tecnico di ogni punto è in `TODO.md`.

**In breve**
- I tre pilastri: tempo, memoria, soldi.
- **0 · Adesso, in quest'ordine** (deciso con Andrea il 26/09).
- **0b · Considerazioni di Andrea del 28/09**: registrazione, "altra
  attività", mestieri, mappa, fattura elettronica, sito, PC, app vera.
- 1 · Obbligatori prima di vendere.
- 2 · Per incassare (abbonamento, costi).
- 2b · **EON Memory**, "l'iCloud del lavoro" + analisi di costi e spazio.
- 3 · Una vera app sul telefono (Face ID, avvisi, App Store).
- 4 · Funzioni del prodotto.
- 5 · Il cervello di EON:
  - 5b · **meno AI, stessa qualità**: apprendimento e **modello AI nostro**;
  - 5c · **EON Admin**, il tuo pannello privato;
  - 5d · **EON "mente" del professionista**, che diventa come lui.
- 6 · Mercato: da 5 a 50 artigiani.
- 7 · Quanto può valere EON, e i principi di lavoro.

Legenda: **[Andrea]** serve una tua decisione o un tuo account ·
**[Claude]** lo faccio io · **[insieme]** servono tutti e due.

---

## Cos'è EON — i tre pilastri (deciso con Andrea, 25/09/2026)

1. **Fa le cose per te** — parli e EON segna l'appuntamento, scrive il
   preventivo, prepara la fattura. *Il tempo.*
2. **Ricorda tutto per te** — clienti, foto, documenti, note in un unico
   posto di lavoro, separato dalla vita privata, ritrovabile a voce in 3
   secondi. *La memoria.* (Vedi "Archivio di lavoro", sezione 2b.)
3. **Ti fa lavorare e incassare di più** — preventivi più veloci, clienti
   seguiti, messaggi in ordine, pagamenti sotto controllo. *I soldi.*

**Il risultato: liberi la testa.** In una riga: **"Parli, EON fa. E si
ricorda tutto."**

Regola: ogni pilastro si deve poter mostrare in 30 secondi a un artigiano
che non ci conosce. Oggi 1 e 2 sì; il 3 è il più debole (servono fattura
elettronica SdI e promemoria dei pagamenti): è da lì che si parte dopo la
parte "per vendere". Ogni nuova funzione deve rafforzare almeno uno dei tre
pilastri, altrimenti non si fa.

---

## Domani si riparte da qui (riepilogo del 29/09/2026, notte)

**Online** (PR #136, #137, #138): urgenze, SAL, DiCo; il lettore unico
(0b.10); utente virtuale per ogni professione, promemoria, incassi e
cartelle (0b.11). L'orologio dei promemoria in produzione risponde bene
(200, 23:35 UTC) e c'è già 1 telefono iscritto.

**Da fare per Andrea**
1. Ricaricare il credito dell'AI (Anthropic) e attivare la ricarica
   automatica: il 28/09 i "niente" venivano da lì.
2. Provare un promemoria vero: segnare un impegno tra circa 40 minuti e
   vedere se arriva l'avviso 30 minuti prima (su iPhone EON deve essere
   aperta dalla schermata Home).

**Da fare per Claude, in ordine**
0. In arrivo (29/09): il socio tester scrive cosa vuole trovare in ogni sezione;
   Andrea lo manda in un blocco unico, professione per professione → un pacchetto.
1. Controllare con Andrea il primo promemoria vero (non ancora provato su
   un telefono vero).
2. 0b.12 Manuali dell'AI per ogni professione (elettricista, Altra
   attività, 15 casi di prova per mestiere): serve il credito.
3. 0b.13 Frasi di esempio e frasi vere (passo 1): serve il credito.
4. Mente-cervello al posto di Cresci (prima le simulazioni); squadra del
   cantiere (versione semplice); giro della giornata sulla mappa.
5. Prima di riaprire le iscrizioni: account email (Resend, Andrea),
   captcha, tetto di spesa dell'AI.
6. Dopo la società: fattura elettronica (0b.4). In attesa: il nome del
   gestionale dell'amministratore (0b.5), morosità.

**Fatto il 29/09 (notte), nel prossimo pacchetto:** pronta prima dei tester
(0b.16): 5 giri di frasi nuove alla cieca (652 frasi, 5 mestieri + "La mia
attività"): 95% al primo colpo, 651/652 dopo le correzioni. Prove più severe
(ora giusta, tutti gli appuntamenti, totale del preventivo): trovati e
corretti errori veri ("alle 7" finiva alle 19, "anzi", orari a parole, IVA 10
con un importo solo, "Hotel Posta" letto come email).

**Fatto il 29/09 (sera), nel prossimo pacchetto:** il modello di EON (0b.15),
nostro, dentro l'app: prova cieca 74/77 (96%) al primo colpo.

**Fatto il 29/09 (pomeriggio), nel prossimo pacchetto:** EON capisce col codice
anche le frasi lunghe (0b.14): preventivo dettato voce per voce, correzioni a
voce, 136/136 frasi vere di Andrea, 140/143 frasi nuove per i 5 mestieri.

**Fatto il 29/09 (mattina), nel prossimo pacchetto:** nella Mente si cancella un
appunto scorrendo il dito verso sinistra ("Elimina" in rosso → Cestino, con
"Annulla"), come già per chat e documenti. Prova: `eval/mente-scorri.test.js`.

**Fatto il 29/09, nel prossimo pacchetto:** la barra in basso (Home, Clienti,
Cresci, Menu) è fissata allo schermo: su iPhone, scorrendo la Home, restava a
metà (foto di Andrea). Prova: `eval/barra-fissa.test.js` (la misura, non
l'iPhone vero: da ricontrollare sul telefono).

Tester: il 29/09 l'account di Simone (Massari) passato da "Altra attività"
a "Amministratore di condominio" (a mano nel database, su richiesta di Andrea).

Sul ramo `claude/ciao-ipc3fm`, non ancora in una PR: ROADMAP 0b.12 e
0b.13. Andranno col prossimo pacchetto.

## 0. Adesso, in quest'ordine (deciso con Andrea, 26/09/2026)

1. **[Claude]** Sistemare i problemi trovati da Andrea nei test del 26/09.
2. **[Andrea]** Scegliere la scritta in alto nella Home (A, B o C).
3. **[Claude] Meno AI, fase 1** (vedi 5b):
   - misurare: costo e tipo di ogni richiesta nei registri;
   - analizzare: elenco di tutto quello che EON fa, in tre gruppi (senza
     AI / AI piccola / AI completa), partendo dalle frasi vere di Andrea
     nei registri — ad Andrea con il risparmio stimato;
   - fare: spostare nel codice il primo gruppo, con i test, senza toccare
     la qualità.
4. **[Claude]** Avviso automatico degli errori.
5. Poi la sezione 1 (prima di vendere) e i primi 5 artigiani (sezione 6).

**Privacy e società** (26/09): per la prova gratuita con i primi artigiani
basta Andrea come persona fisica titolare del trattamento (informativa e
consenso a suo nome). Per vendere gli abbonamenti serve la società (o una
partita IVA) prima di Stripe; allora l'informativa si aggiorna. Testi da
far controllare a un legale.

Pubblicati: pacchetto #97 (25/09) e #70 (26/09), con gli accessi della
pagina cliente chiusi e la professione bloccata in produzione.

---

## 0b. Considerazioni di Andrea del 28/09/2026 — stato e proposte

| # | Cosa | Stato | Chi |
|---|---|---|---|
| 1 | **Registrazione bloccata** ("non mi fa registrare") | Causa trovata: in Supabase le iscrizioni sono **spente** (errore `signup_disabled`, 27/09 sera). L'app ora lo dice in italiano. Per riaprire: Supabase → Authentication → Sign In / Providers → "Allow new users to sign up" acceso. **Ma** le email di conferma oggi arrivano solo al team (serve il servizio email vero, sezione 1): senza, chi si iscrive non riesce a confermare. | [Andrea] interruttore · [insieme] email |
| 2 | **Chiunque, infinite persone?** | Oggi **no** (iscrizioni spente + email solo al team). Con tutto aperto: una persona per email, conferma obbligatoria, limite AI 20 richieste ogni 10 minuti per account; **manca** un captcha (Cloudflare Turnstile, gratis) e un tetto di spesa AI giornaliero per account. Da fare **prima** di aprire a tutti. | [Claude] |
| 3 | **"Chiunque voglia organizzare la propria attività"** → nome più bello, mini questionario, cartelle | **Fatto** (28/09): "Altra attività", questionario a 3 tocchi, cartelle proposte (0b.1). | fatto |
| 4 | **Tratti distintivi per mestiere** (edile, idraulico, elettricista, condominio) | **Fatto** (28/09): colore, icona, esempio a voce e card per mestiere (0b.2). Funzioni vere **urgenze, SAL, DiCo fatte il 28/09** (0b.9). Manca la morosità (condominio, dopo il collegamento al gestionale). | fatto · morosità dopo |
| 5 | **Percorsi con la mappa** | Oggi "Portami lì" apre Mappe/Google Maps. Proposta: **il giro della giornata** su una mappa dentro EON (tappe in ordine, tempi, "Avvia" apre il navigatore). Traffico vero: Google Maps (account di Andrea, gratis fino a qualche migliaio di calcoli al mese, stima). | [insieme] |
| 6 | **Fattura elettronica valida con un tocco o a voce. Gratis?** | Possibile: EON crea l'XML e lo manda allo SdI tramite un intermediario accreditato (strada A, sezione 4). **Non gratis ma pochi centesimi** a fattura (Openapi da ~0,015-0,07 € l'invio + conservazione ~0,035 €, listini da riverificare). Serve: delega dell'artigiano all'intermediario (una volta), dati completi del cliente (CF/P.IVA, codice destinatario o PEC, indirizzo: EON li chiede se mancano), regime giusto (forfettario, bollo, ritenuta…). Il portale gratis dell'Agenzia non si collega alle app. Il 27/09 si era scelta la strada B (collegarsi a Fatture in Cloud): **da ridecidere** — la A è l'argomento di vendita "EON fa la fattura vera". **28/09: dopo la costituzione della società**, piano completo in 0b.4. | [Andrea] società · poi [insieme] |
| 7 | **Sito di presentazione** con "Entra in EON" | Da fare: una pagina sul dominio (eon.it o simile) con cosa fa EON, prova gratuita, "Entra". Serve il dominio. | [Andrea] dominio · [Claude] sito |
| 8 | **EON come app** | Oggi: installabile dal browser ("Aggiungi a Home"), icona e Face ID. | fatto |
| 9 | **EON da computer** | **Fatto** (28/09): menu laterale e più colonne. | fatto |
| 10 | **App vera negli store** | Si "impacchetta" la stessa app (es. Capacitor) per App Store e Google Play: stesso codice, in più notifiche vere e microfono nativo. Servono gli account sviluppatore (Apple 99 $/anno, Google 25 $ una volta) e la revisione di Apple. | [insieme] |
| 11 | **Microfono nell'app vera: serve OpenAI?** | **No.** Oggi EON usa il riconoscimento vocale del telefono (Apple/Google), gratis. Nell'app vera si usa quello nativo di iPhone/Android, sempre gratis. OpenAI (o simili) solo se vogliamo di più: voce più umana, trascrivere telefonate e vocali lunghi. | — |
| 12 | **Tutto in roadmap** | Regola fissa: ogni considerazione di Andrea finisce qui, con stato e chi la fa. | [Claude] |
| 13 | **Tester: "ricordami di chiamare X" negli appunti, non in calendario** | **Fatto** (28/09), vedi 0b.3. | fatto |

**Decisioni di Andrea (28/09, dopo):**
- **1-2 Iscrizioni aperte a tutti: sì**, in quest'ordine: servizio email vero
  (Resend o simile, account di Andrea) → captcha → tetto di spesa AI al giorno
  per account → riaccendere "Allow new users to sign up" in Supabase.
- **3 "Altra attività"** e **4 mestieri**: **fatti il 28/09** (dopo le
  simulazioni approvate). Vedi 0b.1 e 0b.2 per cosa c'è e cosa manca.
- **Home più semplice** (28/09, Andrea: "più semplice, più chiara, più
  lineare, più stilosa"): riquadro **"Oggi"** con "Calendario →"; un solo
  tasto **"Appunti"** che mostra la prima cosa da fare ("Chiamare Pedro · e
  altre 2") e apre la **card degli appunti**: cose da fare con il cerchio,
  note con la matita e il giorno, in fondo microfono e casella. Tolti il
  tasto calendario e il riquadro "Da fare" separato.
- **Bug trovato e sistemato (28/09)**: il database di produzione rifiutava
  la professione "elettricista" (regola vecchia) → chi si iscriveva come
  elettricista non riusciva. Corretto con `supabase/mestieri_e_cartelle.sql`.
- **5 Giro della giornata sulla mappa**: ok, da fare.
- **6 Fattura elettronica**: Andrea chiede "entrambe o solo noi?". Consiglio:
  **partire solo con "la facciamo noi"** (un tocco, argomento di vendita,
  vale anche per chi non ha un programma); il collegamento a Fatture in Cloud
  solo se i primi artigiani lo chiedono. Fare entrambe subito raddoppia il
  lavoro. Resta: serve la società/P.IVA per il contratto con l'intermediario,
  prove nell'ambiente di test dello SdI. **28/09: rimandata a quando la
  società di Andrea è costituita** (serve la sua P.IVA per iscriversi al
  portale). Tutto il piano è in **0b.4**.
- **7** Dominio e sito: **più avanti**. App negli store: **più avanti**.
  Versione da computer: **fatta il 28/09** (sezione 3).
- **8 Microfono**: si tiene quello attuale.
- **"Apri …" sempre con il codice** (28/09, Andrea: "apri appunti, apri
  fornitori, controlla che tutto possa aprirsi tramite il codice e non
  tramite AI"): **fatto**. Controllati uno a uno tutti i nomi che si vedono
  nell'app (menu, Home e card di ogni mestiere, Menu, Cresci, La tua
  azienda, Documenti, Impostazioni, cartelle). Mancavano: le cartelle
  ("apri Fornitori"), "nuova cartella", la card Appunti ("apri appunti"
  apriva la vecchia pagina), "lavori in corso", "obiettivi", "apri Face ID",
  "apri feedback". Ora tutti col codice; una prova automatica li ripassa
  tutti a ogni pacchetto (`eval/apri-col-codice.test.js`). Regola fissa: ogni
  card o cartella nuova va aggiunta a quella prova.
- **9 "Ricordami di…" negli appunti**: **fatto** (28/09): senza giorno né ora
  → appunti "da fare" con la spunta, lista "Da fare" in Home; "ho chiamato
  Pedro" / "ho finito di…" la spunta. Con un giorno o un'ora → calendario.

### 0b.1 "Altra attività" — FATTO il 28/09
Cosa c'è ora nell'app:
- all'iscrizione due scelte: **"Artigiani"** e **"Altra attività"**;
- "Altra attività" → **3 domande a tocchi** (che attività, come lavori, chi
  lavora con te); le risposte restano nell'account (`profiles.attivita_*`);
- in Home, al posto delle card dei mestieri, le **cartelle proposte** (es.
  bar: Fornitori, Personale, Scadenze, Incassi; da solo niente "Personale"),
  create una volta sola; **+ Nuova cartella**, **Rinomina**, **Elimina** (gli
  appunti tornano negli Appunti); ogni cartella si apre come la card Appunti;
- a voce o scritto: **"segna in Fornitori di chiamare la Peroni"** → da fare
  in Fornitori (lo fa il codice, senza AI).
Manca / da sapere:
- l'AI non conosce ancora le cartelle (frasi diverse da "segna in X…" non
  finiscono nella cartella);
- resta da decidere se "Altra attività" è il Piano Free o a pagamento.

Proposta originale:
- **Nome**: al posto della frase lunga, una scelta che si capisce subito tra
  i mestieri: **"Altra attività"** con sotto "Negozi, bar, studi,
  professionisti, servizi". (Alternative: "La mia attività", "Ogni partita
  IVA".)
- **Mini questionario** (3 domande, a tocchi, 20 secondi): che tipo di
  attività (negozio · bar/ristorante · studio professionale · servizi a
  domicilio · altro), come lavori (clienti fissi / di passaggio / su
  appuntamento), da solo o con dipendenti.
- **Cartelle: non vuote.** Critica: cartelle vuote da nominare = pagina
  bianca, la maggior parte non lo fa e l'app sembra vuota. Meglio: EON
  **propone già le cartelle** in base alle risposte (es. bar: Fornitori,
  Personale, Scadenze, Incassi; studio: Clienti, Pratiche, Scadenze), tutte
  **rinominabili e cancellabili**, più "+ Nuova cartella". Si parla a EON
  come per gli artigiani ("segna in Fornitori di chiamare la Peroni").
- Da decidere prima: se questa parte è il **Piano Free** (sezione 2) o un
  piano a pagamento come gli altri.

### 0b.2 Tratti distintivi per mestiere — FATTO il 28/09
Cosa c'è ora: colore proprio (edile arancio, idraulico azzurro, elettricista
giallo, amministratore verde) su logo, microfono, card e tasti; chip in alto
con icona e nome del mestiere; esempio a voce del mestiere sotto il
microfono; card: edile Cantieri · DURC e documenti impresa · Documenti ·
Foto cantiere; idraulico Interventi · Preventivi e fatture; elettricista
Impianti · Preventivi e fatture · Certificazioni e documenti · Foto quadri;
amministratore Condomini · Assemblee.
Le card aprono **le stesse pagine di prima** (niente rifatto): cambia il
nome, e da allora (28/09) anche il **titolo della pagina aperta** ("Foto
impianti", "Condomini"…) e **la voce**: "apri i condomini", "apri gli
interventi", "apri gli impianti", "apri le certificazioni", "apri le foto
dei quadri" aprono la pagina senza AI.
**SAL** (edile), **urgenze** (idraulico) e **dichiarazione di conformità**
(elettricista): **fatte il 28/09**, vedi 0b.9. **Manca** la **morosità**
(condominio): rimandata a dopo il collegamento al gestionale (0b.5).

Proposta originale:
Stessa app, ma ogni mestiere si riconosce subito:
- **colore e icona propri** (es. edile arancio/cantiere, idraulico blu/goccia,
  elettricista giallo/fulmine, condominio verde/palazzo);
- **parole del mestiere** nelle card e negli esempi ("Cantieri", "Interventi",
  "Impianti", "Condomini"; esempi a voce presi dal lavoro vero);
- **1-2 card solo loro** (es. elettricista: dichiarazioni di conformità;
  condominio: assemblee e scadenze; idraulico: urgenze; edile: SAL).
Prima 4 simulazioni (screenshot) ad Andrea, poi l'app.

### 0b.4 Fattura elettronica fatta da EON — piano (28/09/2026)
**Quando**: si parte **dopo la costituzione della società** di Andrea.

**Come funziona**
- Andrea si iscrive a un portale accreditato (intermediario: Openapi o
  A-Cube) con la P.IVA della società; Claude collega EON a quel portale.
- Servono i dati fiscali **dei clienti** (CF o P.IVA, codice destinatario o
  PEC, indirizzo: EON li chiede a voce se mancano) e **dell'artigiano**
  (P.IVA, indirizzo, regime), una volta in Impostazioni; più l'autorizzazione
  dell'artigiano a inviare a suo nome, una volta (forse basta accettare le
  condizioni in EON: da verificare con il portale).
- Per l'artigiano resta come oggi: "fammi la fattura a Rossi Santiago, 300
  euro rifacimento bagno" → EON la mostra **subito** (formato elettronico) →
  tocco su **"Invia"** (voluto: una fattura inviata non si cancella, si
  corregge con una nota di credito) → portale → Agenzia delle Entrate →
  EON dice **"consegnata"** o **"scartata perché…"** con la correzione. Al
  cliente privato EON dà anche il PDF da mandare su WhatsApp.

**Passi** (stima: ~2 settimane di lavoro nostro; versione solo forfettario
~1 settimana; i tempi del contratto col portale non dipendono da noi)
1. [Andrea] via: "partiamo col forfettario".
2. [Andrea] account sul portale a nome della società ([Claude] prepara il
   confronto Openapi / A-Cube: prezzi e contratto).
3. [Claude] dati fiscali dei clienti (1–2 giorni).
4. [Claude] dati fiscali dell'artigiano e regime (1–2 giorni).
5. [Claude] fattura nel formato ufficiale (XML), controllata prima dell'invio
   (2–3 giorni).
6. [Claude] collegamento al portale in prova.
7. [Claude] risposte del fisco (consegnata / scartata), numerazione, note di
   credito (6+7: 2–3 giorni).
8. [Claude] prove nell'ambiente di test dello SdI: bollo, privato, P.IVA
   (~1 settimana).
9. [Andrea + commercialista] controllo di 5–6 fatture di prova.
10. [Andrea] prima fattura vera, con un cliente di fiducia.
11. [insieme] 2–3 artigiani, ognuno con l'autorizzazione.
12. [Claude] dopo: regime ordinario (IVA, ritenuta, cassa).

**Prezzi** (verificati il 28/09/2026 sui siti, IVA esclusa)
- Fatture in Cloud: forfettari 48 €/anno il primo anno, poi 96 €/anno;
  Standard 144 €/anno; Premium 252 €/anno. Aruba e simili ~30 €/anno (stima
  a memoria, da ricontrollare).
- Costo per EON con Openapi: da 0,015 € a fattura, nessuna attivazione, +
  conservazione a norma (qualche centesimo). Un artigiano con 100 fatture
  l'anno ci costa **~2–10 € l'anno** (stima).
- Conclusione: le fatture elettroniche possono stare **dentro l'abbonamento
  EON senza sovrapprezzo**; l'artigiano risparmia 96–144 €/anno e le fa a
  voce. Argomento di vendita.
- Punto critico: i leader hanno anche scadenzario, invio al commercialista,
  F24, prima nota. Noi all'inizio solo "fattura a voce + invio + esito".
  Per i forfettari basta; l'esportazione per il commercialista è facile da
  aggiungere dopo.

**Nel frattempo (da decidere con Andrea)**
- Oggi le "fatture" di EON **non sono fatture elettroniche valide** e l'app
  non lo dice: proposta una scritta sul documento "Copia di cortesia – non
  valida ai fini fiscali" finché non c'è l'invio vero (pochi minuti).
- I passi 3 e 4 (dati fiscali) si possono fare anche prima della società:
  non urgenti.

Fonti: fattureincloud.it/costo, teamsystem.com (listino Fatture in Cloud),
openapi.com (fatturazione elettronica SdI e prezzi).

### 0b.12 Manuali dell'AI per ogni professione — IN PROGRAMMA (deciso il 29/09: "non oggi")
Andrea: "hai addestrato EON per ogni singola professione?". Il codice (lettore)
è provato per tutte e 5 (0b.11); la parte dell'AI no, è sbilanciata:

| | Codice | Manuale per l'AI | Prove dell'AI (casi.json) |
|---|---|---|---|
| Edile | provato | completo (libro/edile.md) | 3 |
| Idraulico | provato | completo (libro/idraulico.md) | 5 |
| Amministratore | provato | completo (libro/amministratore.md) | 7 |
| Elettricista | provato | solo poche righe (`promptPackElettricista`) | 0 |
| Altra attività | provato | nessuno (solo lo strato comune) | 0 |

Da fare, in ordine: 1) manuale completo dell'elettricista (libro + pack:
quadro, salvavita, differenziale, messa a terra, fotovoltaico, pericoli,
DiCo, verifiche periodiche); 2) manuale per "Altra attività" che si adatta
alle risposte del questionario (negozio, bar, servizi…); 3) almeno 15 casi
di prova per ogni professione in `eval/casi.json`, da far girare con
`eval/live-check.js` sull'AI vera (serve il credito; pochi centesimi a giro).

### 0b.16 Pronta PRIMA dei tester: giri alla cieca — FATTO il 29/09 (notte)
Andrea: "Io devo darla già pronta ai tester… non posso aspettare i tester".
Quindi niente "migliora coi dati dei tester": giri di frasi nuove scritte da
me, per ogni mestiere, **misurate una volta sola prima di toccare il codice**
(il numero vero), poi corretti con regole generali, poi un giro nuovo.

| Giro | Frasi | Al primo colpo (numero vero) | Dopo le correzioni |
|---|---|---|---|
| 5 (lunghe, dettate, "allora… praticamente…") | 186 | 171 (92%) | 186 |
| 6 (nuove, dopo le correzioni del 5) | 175 | 171 (98%) | 175 |
| 7 (la prova cattiva: "anzi", numeri a parole, niente accenti) | 123 | 117 (95%) | 123 |
| 8 (preventivi lunghi dettati, col TOTALE controllato) | 120 | 114 (95%) | 120 |
| 9 ("La mia attività": parrucchiera, meccanico, giardiniere, fotografo…) | 48 | 47 (98%) | 47 (*) |

(*) L'unica che manca ("sposta l'appuntamento con Marta Galli alle 16") è un
limite della prova: l'appuntamento creato un attimo prima, nella prova finta,
non viene ricaricato; sul telefono vero sì (dopo ogni impegno EON ricarica le
conversazioni dal database).

**In tutto: 652 frasi nuove alla cieca, 620 giuste al primo colpo (95%);
dopo le correzioni 651/652.**

Più le prove di prima, rifatte con le regole nuove: frasi vere di Andrea
136/136, prova cieca 77/77, frasi per mestiere 143/143, prova finale 99/100
(l'unica all'AI è "mandale un messaggio…" senza dire a chi: giusto così).

- **Prove più severe** (29/09): prima controllavano solo *che* un
  appuntamento venisse creato; ora controllano anche **l'ora** (107 frasi) e,
  con più appuntamenti in una frase, che ci siano **tutti**; per i preventivi
  dettati, che il **totale** sia quello giusto (14 preventivi). Così sono
  venuti fuori errori che prima passavano.
- **Errori veri trovati e corretti** (i più importanti):
  - "alle 7" veniva segnato alle **19** (anche l'esempio dentro EON dice
    "domani alle 7 getto del solaio"): ora alle 7 è mattina (da 1 a 6 resta
    pomeriggio: "alle 3" = 15).
  - Orari a parole: "alle nove e un quarto", "alle sette e mezza", "alle dieci
    meno un quarto", "a mezzogiorno", "alle 15 e 30".
  - Il ripensamento: "domani alle 8 **anzi** alle 9", "giovedì anzi venerdì".
  - Tre appuntamenti in una frase ("alle 8 Bruni poi alle 11 Tosi **e alle 16**
    pizzeria"): ne segnava due.
  - "posta" (Hotel Posta, cassetta della posta) veniva letta come **email**.
  - "iva 10" con un solo importo: l'IVA restava al 22% e il "10" finiva nella
    descrizione.
  - L'impegno detto prima del verbo: "l'appuntamento con la Marchetti **lo
    sposti** alle 17", "il sopralluogo di Lodi **fallo slittare**", "…
    **cancellalo**"; il perché in coda ("…che è saltata", "…, piove").
  - "Anna mi ha pagato **la fattura** 180 euro" = incasso (non una fattura nuova);
    "è arrivato il bonifico della Moretti 2.000 euro"; "fammi parlare con…" = chiama.
  - "il cliente **vuole** un preventivo…" = nota (non un preventivo da fare subito).
  - "solo di sabato", "ogni lunedì" = abitudine, non un giorno da segnare.
  - Domande senza punto interrogativo: "che pressione deve avere…", "ogni quanto…".
  - Risposte col codice: "cosa ho **la prossima settimana**", "**quanti preventivi**
    ho fatto questo mese", "che lavori ho domani"; "i documenti del condominio
    Girasole" con più condomìni in rubrica (conta la parola che distingue).
  - Annullare: "non trovo «getto» in calendario per domani" invece dell'AI.
- **Cosa NON è provato**: tutto gira nell'app vera sul computer (browser vero,
  server vero, database e AI finti), non su un telefono vero; le frasi le ho
  scritte io, non artigiani veri. Il credito dell'AI resta da ricaricare (per
  le domande tecniche e i casi che il codice non capisce).
- File: `eval/dati/frasi-giro5.json` … `frasi-giro8.json`; si misurano con
  `FRASI=frasi-giro8.json node eval/frasi-nuove-mestieri.test.js --elenco`.

### 0b.15 Il modello di EON — FATTO il 29/09 (sera), versione 1
Andrea: "ci serve per forza il modello funzionante… arrivare ai tester con il
modello già avanzato". Deciso con lui: un modello **nostro**, non pagato a
nessuno, piccolo, **dentro l'app** (funziona anche senza campo); sul server
arriverà un modello "di significato" più grande quando ci saranno le frasi
vere dei tester.

- **Com'è fatto**: legge parole, coppie di parole e pezzi di parola (regge
  gli errori di dettatura), con nomi/giorni/ore/importi/telefoni al posto
  di segnaposto; decide il cassetto tra 20 (calendario, preventivo, cerca
  documento, invio, sposta/annulla, messaggio, email, chiamata, cliente,
  domanda sui dati, domanda all'AI, incasso, foto, cartella, urgenza, SAL,
  DiCo, assemblea, saluto, Mente). 332 KB (`modello-eon.json`), sicurezza
  tarata (quando dice "sono sicuro" ha ragione il 96%).
- **Come lavora con le regole**: prima i **modi di dire → forma normale**
  ("fai il numero di X" = chiama X, "salvami il numero di…" = aggiungi,
  "arrivato il bonifico di X" = X ha pagato, "dove ho messo il…?" = mostrami);
  poi le regole; se non capiscono e il modello è sicuro (≥85%), la frase si
  riscrive nella forma del suo cassetto e si rilegge. Domande e saluti non
  finiscono più nella Mente.
- **Allenamento**: 12 mila frasi generate (`eval/modello/genera-frasi.mjs`:
  5 mestieri, errori di dettatura, riempitivi) + simulatore;
  `node eval/modello/allena.mjs --salva` rifà il modello e lo misura.
- **Numeri onesti** (frasi mai viste): modello da solo 91%; prova finale
  nell'app 79 → 88 col modello al primo colpo (99 dopo le correzioni);
  **prova cieca finale (77 frasi, 5 mestieri, mai toccate prima): 74/77
  (96%) al primo colpo**, 0 sbagliate gravi (1 nota presa per preventivo,
  2 annullamenti all'AI; corretti dopo, con regole generali).
- **Prossimi passi**: (1) coi tester, raccogliere col consenso le frasi che
  non capisce e riallenarlo ogni settimana (0b.13 passo 2); (2) sul server
  il modello "di significato" (serve accesso a Hugging Face, qui bloccato);
  (3) nell'app per App Store, una copia dentro il telefono (Core ML).
- **Per quando partiamo coi tester** (Andrea, 29/09): nel pannello admin la
  pagina dei 4 numeri (attivazione, uso a 4 settimane, "quanto ti
  dispiacerebbe", chi pagherebbe) — soglie in TODO.

### 0b.14 EON capisce col codice, misurato sulle frasi vere — FATTO il 29/09 (primo passo di 0b.13)
Andrea: "doveva funzionare con il codice e non con l'AI… va esteso a tutti
anche a frasi lunghe". Il tester aveva dettato un preventivo di un minuto e
l'AI (senza credito dal 28/09 14:48: 54 richieste fallite in 24 ore) non
rispondeva. Fatto, come le grandi app, misurando su frasi vere:

- **Preventivo lungo dettato, voce per voce, col codice**: anche senza
  punteggiatura; quantità × prezzo (al metro, l'uno, all'ora), IVA, sconto,
  totale detto (se non torna lo dice), numeri in lettere, centesimi, prezzo
  prima della descrizione. Card con le voci e un tasto "Crea". Prova:
  `eval/preventivi-lunghi.test.mjs` (52 preventivi, 25 scritti dopo il
  codice: al primo colpo 20/25) e `eval/preventivo-voci-app.test.js`.
- **Correggere a voce un preventivo già fatto, col codice**: "non 10000 ma
  15000", "fammela da 57.000", "5000 di bagno e 5000 manodopera", "aggiungi
  smaltimento 300", "togli l'IVA", "metti la data al 27 settembre".
- **Le 136 frasi vere di Andrea** (registro 3-29/09, nomi cambiati) nell'app
  vera: da **108 (79%) a 136 (100%)** col codice, 0 sbagliate
  (`eval/frasi-vere-app.test.js`). Sono le frasi su cui si è corretto: il
  100% non vale come prova da solo.
- **143 frasi NUOVE per i 5 mestieri**, scritte senza guardare il codice
  (`eval/frasi-nuove-mestieri.test.js`): al primo colpo **108 (76%)**, 13%
  sbagliate; dopo le correzioni **140 (98%)**, 0 sbagliate. Le 3 che restano:
  due limiti della prova, una cartella che non esiste.
- Regole nuove, generali (non frase per frase): verbi detti col tu ("mi
  cancelli", "mandi…?"), "fra un'ora", consigli e calcoli all'AI, seguiti
  ("me la fai da 57.000"), clienti nuovi con telefono, solo il nome = scheda
  del cliente, più impegni in una frase (anche con le virgole) segnati senza
  AI, spostare/cancellare appuntamenti con conferma e "Annulla", nome
  ambiguo → "con quale?", foto + cliente nuovo, meteo e percorso detti nel
  discorso, assemblee (anche "il 20 ottobre", "giovedì 15"), DiCo, SAL
  senza percentuale, "quanto mi deve X", "3/4" non è una data.

**Onestà**: provato su Chromium con database e AI finti; non su un telefono
vero. Le frasi nuove le ho scritte io: servono le frasi dei tester (0b.13
passo 2) per sapere il numero vero. Resta all'AI (giusto così): consigli,
domande tecniche, chiacchiere.

### 0b.13 Frasi di esempio, frasi vere e un "cervello" nostro — IN PROGRAMMA (deciso il 29/09)
Andrea: "se ci mettessimo 1 milione di frasi esempi?". Risposta onesta: un
milione di frasi **inventate** serve poco, perché si somigliano tutte. Contano
**varietà** e **frasi vere**. Le grandi app (Siri, Alexa, Google) usano milioni
di frasi vere, etichettate, per addestrare un piccolo modello loro. Piano in 3 passi:

1. **Subito, quando c'è il credito dell'AI**: far scrivere all'AI 10–20 mila
   frasi realistiche e diverse per ogni professione (dialetto, errori della
   dettatura, frasi lunghe e confuse, più cose insieme) e farle girare nel
   simulatore (`eval/simulatore.test.mjs`) per trovare i buchi veri del
   lettore. Costo: pochi euro (stima).
2. **Con i tester**: salvare le frasi che il codice non capisce e che vanno
   all'AI, **solo col consenso** (da aggiungere all'informativa privacy; mai
   visibili nel pannello admin come messaggi). L'AI le classifica; ogni
   settimana diventano vocabolario del lettore e nuove prove del simulatore.
3. **Più avanti**: con 20–50 mila frasi vere etichettate, addestrare un
   piccolo modello nostro (come Snips) che gira sul telefono: gratis e
   istantaneo. Le regole di oggi restano come rete di sicurezza.

Pilastri: *tempo* (capisce al primo colpo) e *soldi* (meno AI, meno costi).

### 0b.11 Utente virtuale per ogni professione, promemoria, incassi, cartelle — FATTO il 29/09 (sera)
- **Utente virtuale per ogni professione** (`eval/utente-virtuale-mestieri.test.js`):
  edile, idraulico, elettricista, amministratore e "Altra attività", circa
  **170 frasi a testa** (848 in tutto) con i SUOI clienti, le sue parole e le
  sue funzioni (SAL, urgenze, DiCo, assemblee, cartelle), scritte anche di
  fretta ("eon … grazie", "per favore …"). Passano dall'**app vera e dal
  server vero** (database e AI finti): **848 su 848 fatte col codice**, con
  l'effetto giusto. Ha trovato e fatto sistemare 7 difetti veri:
  - "domani alle 8 getto del solaio da Rossi" (la frase d'esempio dell'edile!)
    andava alla piccola AI: ora il server usa la lettura dell'app;
  - "impianto **foto**voltaico" scartato perché conteneva "foto";
  - "alle 21" e "giovedì" con l'accento non visti dalla Mente (finivano negli
    appunti invece che in calendario);
  - le cortesie ("eon … grazie") facevano sfuggire SAL, DiCo, assemblee;
  - un comando nuovo detto entro 90 secondi da una domanda di EON era preso
    come risposta: ora, se è chiaramente nuovo, riparte da capo;
  - "Neri mi ha detto che…" andava all'AI: ora è un appunto nella scheda;
  - titolo "Da Francesca Neri per cappotto termico **da**".
- **Promemoria sul telefono** (Impostazioni → Promemoria, oppure "Vuoi un
  avviso prima?" una sola volta dopo il primo impegno): **30 minuti prima di
  ogni impegno con l'ora arriva una notifica vera**, anche con EON chiusa.
  Android sì; **iPhone solo con EON aggiunta alla schermata Home** (iOS 16.4+:
  è una regola di Apple), altrimenti EON spiega come fare. Tecnica: notifiche
  web (standard, cifrate e firmate, senza librerie), "orologio" sul database
  (pg_cron ogni 5 minuti, già acceso in produzione), niente doppioni, i
  telefoni spariti si tolgono da soli. **Non provato con un telefono vero**:
  la cifratura è provata "dal lato del telefono" con codice scritto a parte,
  ma la consegna vera (Apple/Google) si vede solo dopo il merge → **da provare
  con Andrea**.
- **Incassi col codice**: "Rita ha pagato 1.200", "segna 500 euro pagati da
  Rita", "ho incassato 300 da Bianchi": l'incasso in sospeso diventa
  incassato; se l'importo è minore chiede "è un acconto?" (resta il resto);
  più incassi in sospeso → quale?; nessuno → ne registra uno nuovo.
- **Cartelle**: "cosa c'è in Fornitori?", "cosa devo fare per Lerici?" aprono
  la cartella col codice; l'AI ora le conosce (legge una cartella, scrive
  "segna in Fornitori…" nella cartella giusta) — con l'AI vera **non provato**
  (serve il credito).

### 0b.10 Il lettore unico: quasi tutto col codice, come le grandi app — FATTO il 29/09
Andrea (29/09, dopo una sera di prove in cui "non funzionava niente"): "non
possiamo dire per ogni cosa cosa deve fare EON… principio logico e non
sistema IF… agisci come AD".
- **Causa vera della sera del 28/09**: il **credito dell'AI (Anthropic) era
  finito** dalle 17: 36 richieste su 46 andate all'AI e fallite ("niente",
  "si impalla"); le 10 fatte dal codice erano andate bene (le fatture non
  erano rotte). **[Andrea] ricaricare il credito e attivare la ricarica
  automatica** su console.anthropic.com → Plans & Billing.
- **Come le grandi app** (Siri/App Intents, Alexa, Google, Snips, Mycroft
  Adapt, Rasa): un solo **lettore** (`lettore.js`) che in ogni frase trova il
  **cassetto** (fattura/preventivo, messaggio, email, WhatsApp, chiamata,
  cartella, cartello, DURC, domanda sui dati, da fare, Mente…) e i **pezzi**
  (chi — cliente noto, nuovo o omonimo —, quando, quanto, cosa, dove). Si
  allarga il **vocabolario**, non le regole.
- **Le 5 regole, per tutto EON**: 1) giorno o ora → calendario (anche "da
  fare domani" senza ora); 2) azione chiara con tutti i pezzi → la fa;
  3) manca un pezzo → **chiede solo quello, con i tasti** (come Siri: "Per
  quale lavoro?", "Quale Gianardi?", "«Chilosi» è il cliente o il lavoro?");
  4) domanda sui dati → risponde dai dati (chi deve pagare, quanto incassato,
  IVA del mese — stima —, cantieri attivi, impegni di un giorno); 5) il resto
  → **Mente**, con il tasto "Era una richiesta a EON" (ripiego in due tempi,
  come Rasa). L'AI resta per i giudizi ("è pesante?", "conviene?"), i
  seguiti di un discorso, gli ordini che il codice non sa fare.
- **Tutte le 25 frasi della sera del 28/09 ora vanno col codice** (nella
  prova automatica): cartelle, "Domani ore 11 Mazzi. Mandare raccomandata
  Brigida" (impegno + da fare di domani), fatture/preventivi anche per
  **clienti nuovi** (li crea), "…e mandalo a Rita" (tasti PDF/WhatsApp/
  Email), "scrivi a Rita se va bene domani alle 18" (appuntamento da
  confermare + messaggio), email e chiamate con omonimi, cartello già
  compilato, DURC (se non c'è lo dice), foto con didascalia ("TV casa Machi"
  → quale Machi?; "TV casa Cucinelli" → cliente nuovo), domande sui soldi.
- **Server**: i "comandi già letti" (documento, messaggio) li esegue il
  codice con gli strumenti di sempre, dati ricontrollati (mai fidarsi
  dell'app), registro "codice".
- **Rete di sicurezza**: se l'AI non risponde, una cosa da segnare va nella
  Mente ("L'AI adesso è ferma: non si perde"), una domanda riceve una
  risposta chiara, un ordine "Adesso non riesco a farlo". Al fondatore,
  nell'app e nel pannello Admin, l'avviso **"Credito dell'AI finito"** (solo
  il conto delle volte, mai i messaggi).
- **Utente virtuale** (`eval/simulatore.test.mjs`, idea di Andrea): quasi
  3.000 frasi generate come le scriverebbe un artigiano (cortesie, importi
  in tanti modi, clienti noti/nuovi/omonimi, giorni e ore, parole dei 4
  mestieri) + le frasi vere di Andrea + quelle da non sbagliare: **100% lette
  giuste**. Gira a ogni pacchetto; ogni frase nuova che sbaglia si aggiunge lì.
- **Da sapere (onesto)**: le 3.000 frasi le ho scritte io, quindi il 100% vale
  per quelle; le frasi vere di tutti i giorni troveranno altri buchi (si
  aggiungono al simulatore). L'IVA è una stima dalle fatture di EON. Email e
  WhatsApp si aprono pronti, l'invio lo tocca Andrea (l'invio automatico
  vuole l'account email, sezione 1). Il messaggio "Ciao Rita, …" parte nella
  chat di EON (come "di' a Rita che…").
- **Prossimi (deciso il 29/09)**: ~~promemoria degli appuntamenti; cartelle
  capite dall'AI~~ (fatti, 0b.11); **Mente-cervello** al posto di Cresci nel menu (Cresci va in
  Menu): pagina "cervello" con riassunto, gruppi collegati e "EON ti conosce
  al X%" — prima le simulazioni; **Squadra del cantiere** (direzione lavori:
  persone coinvolte, ordini a uno o a tutti) — prima la versione semplice,
  il 3D no per ora.

### 0b.9 Funzioni vere dei mestieri: urgenze, SAL, DiCo — FATTO il 28/09 (notte)
Andrea: "vorrei mantenere un tono semplice e calmo, non incasinare la testa
appena entri nell'app". **Regola decisa**: la Home non cambia; le funzioni
stanno **dentro le card che ci sono già**, si chiamano **a voce** e in Home
compare **al massimo un avviso alla volta**, solo quando c'è qualcosa da fare.
Tutto col codice, niente AI.
- **Urgenze** (pensate per l'idraulico, valgono per tutti): "perdita urgente
  da Bianchi", "emergenza allagamento cantina Neri alle 15" → impegno di
  oggi **in cima a "Oggi" con il segno rosso "Urgente"**, legato al cliente;
  resta finché non è fatto (anche se l'ora è passata). "Le urgenze" apre
  l'elenco. **Odore di gas** → nessun intervento da fissare, card di
  sicurezza (chiudere il gas, aprire le finestre, niente interruttori o
  fiamme, uscire e chiamare il pronto intervento gas o il 112). Con un altro
  giorno ("domani"), una domanda o due clienti possibili → decide l'AI.
- **SAL** (edile): "SAL 30% cantiere Rossi" = lavori al 30%. La rata è la
  parte nuova del **valore del lavoro** scritto nel cliente (30% di 12.000 =
  3.600; il SAL dopo al 50% = 20% = 2.400), oppure l'importo detto ("SAL 50%
  Rossi 2.000 euro"). Nella **scheda del cliente** la sezione SAL (numero,
  %, importo, fatturato o no, "Crea fattura", "+ Nuovo SAL"). In Home
  l'avviso **"SAL da fatturare"** (con "Crea fattura", "Apri la scheda", ✕
  "non ora"); se c'è già "Com'è andato?", aspetta. "Crea fattura" fa la
  fattura col percorso del codice ("fattura Mario Rossi SAL avanzamento
  lavori 3600 euro").
- **Dichiarazione di conformità** (elettricista, DM 37/2008): "fai la DiCo
  per l'impianto Verdi" → modulo già compilato (committente e indirizzo dal
  cliente, dati dell'impresa ripresi dall'ultima dichiarazione, norma CEI
  64-8, allegati) → **documento da stampare / salvare in PDF** sul modello
  dell'allegato I, numerato (1/2026, 2/2026…), salvato nella **scheda del
  cliente** e nella card **"Dichiarazione di conformità"** dentro
  "Certificazioni e documenti". "Dichiarazioni di conformità" a voce apre
  l'elenco. Le due spunte che contano (materiali adatti, impianto
  controllato con esito positivo) **le mette l'elettricista**: EON non le
  segna al suo posto (regola già scritta per l'AI: la DiCo la firma lui).
- Database: colonne `tasks.urgente`, `tasks.client_id`; tabelle `sal` e
  `dichiarazioni_conformita` (`supabase/funzioni_mestieri.sql`, staging e
  produzione, solo aggiunte, con cestino).
- **Da sapere (onesto)**:
  - la DiCo è una **bozza sul modello di legge**: va fatta controllare a un
    elettricista vero prima di darla ai clienti (testo dell'allegato I
    riportato a memoria, non confrontato riga per riga con la Gazzetta);
    mancano progetto e schema come file allegati (si segnano solo);
  - il SAL "fatturato" si segna appena si tocca "Crea fattura", anche se la
    fattura poi non va a buon fine (raro; si può ricreare dalla scheda);
  - la fattura del SAL è quella di EON, **non** la fattura elettronica
    (0b.4);
  - l'importo del SAL viene dal "valore" del cliente: se è sbagliato, è
    sbagliata la rata.

### 0b.8 Clienti e frasi col codice, assemblee vere, "Com'è andato?" — FATTO il 28/09 (sera)
Andrea: "Scrivi a Machi domani alle 10: basta Machi, codice e non AI. Se ci
sono 5 Alessio? Frase lunga: anche lì il codice?".
- **Già col codice prima** (lato server, "percorsi rapidi"): nome esatto o
  solo il cognome se unico ("Machi"), appunti con un cliente ("per Baudi
  portare la chiave"), 2–4 omonimi con "Quale intendi?".
- **Nuovo**:
  - **nome detto un po' diverso**, anche solo il cognome ("Macchi"): "Intendi
    Alessio Machi?" con **Sì / No** da toccare; "sì" lo segna col codice;
  - **fino a 8 omonimi** con i nomi da toccare (oltre: AI);
  - il titolo usa il **nome completo** del cliente scelto ("Chiamare Alessio
    Verdi", non "Chiamare Alessio");
  - **"Devo chiamare Machi"** → da fare nella scheda di Alessio Machi (codice);
  - **frasi con più comandi**: il codice divide ("e", "poi", "ah e", punto,
    virgola davanti a un comando), capisce ogni pezzo (impegno con ora,
    anche senza giorno: oggi o **domani se l'ora è passata**; cancellazione
    di un impegno preciso) e li fa **solo se li capisce tutti**; un solo
    avviso con il riepilogo e **Annulla** per tutto. Un pezzo non chiaro →
    frase intera all'AI.
- **"Scrivi a Machi domani alle 10"** = promemoria per Andrea (non un
  messaggio programmato: quello sarebbe una funzione nuova).
- **Assemblee vere** (amministratore): prima la sezione mostrava **solo dati
  di esempio**. Ora tabella `assemblee` (staging e produzione), "+ Nuova
  assemblea", a voce "assemblea in via Roma 12 giovedì alle 21" (codice),
  in calendario. **Scheda dell'assemblea**: data, tipo, stato (Da convocare
  / Convocata / Fatta / Verbale da redigere), "Cosa si è detto" (microfono e
  casella), foto, documenti. Tutto col codice.
- **"Com'è andato?"**: un'ora dopo un appuntamento di oggi **con un
  cliente**, una sola domanda in Home: Fatto / Da rifare / Rimandato o due
  parole → nella scheda del cliente; "Rimandato" chiede "a quando?" e lo
  sposta. Se ignorata resta solo per oggi.
- **Sistemazioni**: indietro torna da dove sei venuto (DURC aperto dalla
  Home → Home); icone delle card nel colore del mestiere ovunque (prima
  nere in Documenti e Preventivi e fatture); in "Prova come…" non si vedono
  le cartelle di "Altra attività" (vedi il mestiere come un cliente nuovo).
- **Restano all'AI**: frasi che il codice non capisce, domande libere, "no"
  a "Intendi…?", "Rimandato" (lo spostamento).

### 0b.7 EON svuota la testa: la Mente, cartelle per tutti, calendario vivo — FATTO il 28/09
Andrea: "al professionista EON deve servire a svuotare la testa: ogni cosa
che dico deve segnarla negli appunti, salvo le funzioni di EON".
- **Un solo avviso**: "Segnato domani ore 11:30" (prima due avvisi, uno con
  "segnati 1 impegni": un difetto).
- **La Mente** al posto di "Appunti" (icona del cervello, "Svuota la testa:
  parla o scrivi"). **Regola**, tutta col codice: azione chiara → la fa;
  domanda → risponde; giorno o ora → calendario (AI); nomina un cliente →
  AI (lo lega alla scheda e al prossimo appuntamento); **tutto il resto →
  Mente**. "Devo…", "controllare…", "comprare…" → cosa da fare; il resto →
  nota. Esempi: "Devo chiamare Fini Alessio", "controllare assicurazioni
  infortunio", "controllare PAC totali".
- **Meteo e incassi** ("quanto ho incassato questo mese", "chi mi deve
  soldi") erano già col codice, senza AI.
- **"Aggiungi cartella EON"** crea la cartella col codice (prima diventava un
  cliente, con l'AI).
- **Cartelle per tutti i mestieri**: sotto le 4 card, "+ Nuova cartella".
  A voce: "segna in X…", "apri X", **"aggiungi in X queste foto"** (foto
  nella cartella; nuova colonna `cantiere_foto.cartella_id`, staging e
  produzione). Nella cartella: "Aggiungi foto", Rinomina, Elimina.
- **Calendario vivo**: in Home solo quello che deve ancora succedere
  (passato = un'ora dopo l'inizio), "N già passati oggi"; finita la
  giornata → **Domani**; serata libera → "Per oggi hai finito. Stacca la
  testa…". In Calendario i passati di oggi in una riga chiusa. Si aggiorna
  da solo ogni 5 minuti e quando si torna nell'app.
- **Prossimi** (proposti, da fare):
  1. **"Com'è andato?"**: finito un appuntamento con un cliente, una sola
     domanda in Home (fatto / da rifare / rimandato, anche a voce); EON lo
     segna nella scheda e sposta l'impegno se serve. Solo appuntamenti con
     un cliente; se ignorata sparisce a fine giornata.
  2. **Promemoria degli appuntamenti** (oggi NON esistono): notifica ad es.
     30 minuti prima; su iPhone solo con EON installata sulla Home; serve
     una parte nuova sul server. Stima 2–3 giorni. Pacchetto a sé.
- Da sapere: una frase che nomina un cliente va ancora all'AI (per legarla
  al suo prossimo appuntamento); si può portare al codice più avanti.

### 0b.6 Ognuno vede solo il suo mestiere; il fondatore li prova tutti — FATTO il 28/09
Andrea: "io con la mia email devo poter accedere a tutto per fare le
simulazioni; un cliente che si registra come edile vede solo le sezioni
edile e nient'altro, come le grandi app".
- **Clienti**: il mestiere è legato all'account e non si cambia (blocco nel
  database dal 25/09). In più ora le sezioni di un altro mestiere non si
  aprono né col tocco né a voce: **Assemblee** solo amministratore,
  **Cartello fine lavori** solo edile (sparisce anche dai Documenti degli
  altri). Regola per il futuro: ogni sezione nuova solo di un mestiere va
  in `SEZIONI_DEL_MESTIERE`.
- **Fondatore** (account in `eon_admin`, oggi solo Andrea): in Impostazioni
  **"Prova come…"** (Edile, Idraulico, Elettricista, Amministratore, Altra
  attività). Striscia in alto "Modalità prova: …" con "Torna al tuo
  account". Il profilo non cambia mai; si vedono i dati veri di Andrea con
  la grafica di quel mestiere; anche l'AI risponde come quel mestiere (il
  server lo accetta solo se l'account è in `eon_admin`).
- Da decidere più avanti: dati di esempio separati per ogni mestiere
  durante la prova (oggi i dati veri di Andrea).

### 0b.5 Amministratori di condominio: EON accanto al gestionale (28/09/2026)
**Cosa è successo**: un amministratore di condominio usa EON per il lavoro
di tutti i giorni (chiamare, assemblee, appunti, cosa è successo in
assemblea) e dice che nel suo gestionale "un funzionamento del genere è
impossibile". Conferma che EON non sostituisce il gestionale: gli sta
accanto. Frase per presentarlo: **"accanto al tuo gestionale, non al suo
posto"** (il gestionale tiene i conti, EON la giornata e la memoria).
- **Non fare**: contabilità condominiale, millesimi, riparti, rendiconti,
  F24/CU/770 dentro EON (lavoro enorme, rischio legale).
- **Proposte** (in attesa della risposta dell'amministratore):
  1. verbale d'assemblea a voce;
  2. la storia di ogni condominio (assemblee, guasti, chiamate, foto in
     ordine di data);
  3. dati dal suo gestionale.
- **Collegare il gestionale a EON**, tre strade: (1) collegamento
  automatico, solo se il gestionale ha un accesso per altre app (API):
  **1–2 settimane di lavoro nostro, una volta per ogni gestionale** (stima),
  per il cliente pochi minuti in Impostazioni; (2) esportazione in Excel e
  import in EON (pochi giorni, funziona con quasi tutti); (3) EON legge i PDF
  (rendiconti, verbali, convocazioni). All'inizio **solo in una direzione**
  (gestionale → EON, EON non tocca i conti). **Privacy**: accordo scritto
  in cui EON è responsabile del trattamento, prima del collegamento (e in
  ogni caso prima di vendere).
- **Prossimo passo** [Andrea]: chiedergli il **nome del gestionale**, cosa
  gli fa perdere più tempo, cosa manca in EON. Documento PDF di 2 pagine
  preparato per lui il 28/09 ("EON per l'amministratore di condominio").
  Poi [Claude] verifica se quel gestionale ha un'API e dà strada e tempi.

### 0b.3 "Ricordami di chiamare…": calendario o appunti — FATTO il 28/09
- **Con un giorno o un'ora** ("lunedì chiama Pedro", "alle 10 chiama Santa
  Maria", "domani", "stasera") → **calendario**, come oggi.
- **Senza nessun quando** ("ricordami di chiamare Pedro", "ricordami di
  comprare il silicone") → **appunti**, nella lista "Da fare" spuntabile,
  visibile in Home. Oggi invece EON lo mette in calendario il primo giorno
  utile alle 8:00 (regola del 23/09).
- Rischio da evitare: un appunto senza data si dimentica. Per questo: la
  lista "Da fare" in Home, e se l'appunto nomina un cliente va anche nella
  sua scheda.

---

## 1. Obbligatori prima di vendere

| Cosa | Chi | Note |
|---|---|---|
| **Vercel Pro** (~20 $/mese) | [Andrea] | Il piano gratuito vieta l'uso commerciale e ha il limite di pubblicazioni che ci ha bloccato il 25/09. |
| **Supabase Pro** (~25 $/mese) | [Andrea] | Backup giornalieri, nessuna pausa del progetto. |
| **Servizio email vero** (es. Resend) | [insieme] | Oggi Supabase manda email solo a noi del team. Poi: email in italiano e **conferma email obbligatoria** accesa. |
| **Privacy, termini, consenso GDPR** | [insieme] | **Fatto per la prova (27/09)**: /privacy, /termini (con accordo art. 28), casella "Accetto", registro dei trattamenti. Da fare: controllo di un legale, poi versione con la società. Storage privato fatto (27/09). |
| **Dominio tuo** (es. eon.it) | [insieme] | Tu lo compri (~10–20 €/anno), io lo collego al posto di eonbeckend.vercel.app. |
| **Avviso automatico degli errori** | [Claude] | **Fatto (27/09)**: ogni errore dell'app e del server va nel pannello Admin (`/admin`, pagina a parte, non dentro l'app). Notifica sul telefono anche ad app chiusa: basta impostare `AVVISO_ERRORI_URL` su Vercel (es. un canale ntfy.sh) [Andrea]. |
| **Compressione delle foto** (subito dopo il merge) | [Claude] | Come WhatsApp: da ~3 MB a ~300 KB per foto, a occhio uguali (lato lungo ~2000 px). Le foto di documenti da leggere (fatture, DURC) restano più nitide. Spazio ~10 volte meno, caricamento più veloce in cantiere. |
| **Pannello di controllo di EON** (EON Admin, vedi 5c) — **prima versione fatta (27/09)**: `/admin` | [Claude] | Per gestire 100–1000 clienti dal telefono e dal PC: utenti, chi paga, errori, costo AI, feedback arrivati, quanto fa EON senza AI. |
| **Staging uguale a produzione** | [Claude] | Oggi lo schema di prova è diverso (niente cascata sul profilo, niente creazione automatica del profilo). |
| **Scollegare il progetto Vercel doppio** (eonbeckend-mx2t) | [Andrea] | L'app usa solo "eonbeckend"; il doppione raddoppiava le pubblicazioni. |

---

## 2. Per incassare

- **[insieme] Abbonamento con Stripe**: prova gratuita, piano mensile/annuale,
  fattura automatica, blocco se non si paga. Il prezzo lo decidi tu.
- **[insieme] Spazio incluso per cliente**: vedi EON Memory (2b) — 20 GB
  nell'abbonamento, extra a pagamento; barra "spazio usato" in
  Impostazioni → Account, avviso all'80%, mai cancellazioni automatiche.
  L'archivio è su Supabase (non in Claude, che vede i dati solo quando
  risponde e non li conserva come archivio).
- **[Claude] Costo AI per cliente**: misurato dai registri, per fare il
  prezzo giusto.
- **Prezzo — ipotesi, non decisione** (26/09): il costo basso (AI 1-2 €
  a cliente con migliaia di clienti e modello nostro) è un **vantaggio**,
  non il prezzo. Piano base 25-35 € (i gestionali per artigiani costano già
  20-50 €); eventuale piano "Lite" a ~9 € come porta d'ingresso. Costi per
  cliente oltre all'AI: server/database ~0,5 €, spazio ~0,3 €, Stripe ~0,4 €,
  SdI/WhatsApp/email ~0,5-1 € (stime). Si decide coi dati dei primi artigiani.
- **[Andrea] Piano Free "Organizza la giornata"** con pubblicità
  personalizzata (deciso il 17/09): da progettare quando si apre al
  pubblico generico.

---

**Quando i clienti crescono (100+ paganti)**: una persona tecnica di
fiducia reperibile per le emergenze, commercialista e legale per contratti
e fatture; backup con ripristino a qualsiasi minuto (Supabase).

## 2b. EON Memory — "l'iCloud del lavoro" (sezione business, 25/09/2026)

**Cos'è.** Il servizio di EON che conserva **tutto il lavoro**: foto,
documenti, preventivi, fatture, note e anche i fatti che EON impara ("Rossi
paga sempre in ritardo", "bagno di Bianchi: piastrelle 30×60"). È il
pilastro 2, "ricorda tutto per te". Tra noi lo chiamiamo "l'iCloud del
lavoro"; ai clienti lo raccontiamo come **la memoria del tuo lavoro**.

**I piani**

| Piano | Spazio | Prezzo |
|---|---|---|
| Prova / Piano Free | 2 GB (~6.000 foto compresse) | gratis |
| **Base — incluso nell'abbonamento** | **20 GB solo per il lavoro** (~60.000 foto) | incluso |
| **Extra** | +100 GB | ~2–3 €/mese |
| **Conservazione a norma** (più avanti) | fatture e documenti fiscali per 10 anni | da definire — serve un fornitore accreditato |

A noi 20 GB pieni costano meno di 0,50 €/mese; 100 GB circa 2 $/mese:
l'extra ha un margine alto. In app: barra "spazio usato" in Impostazioni →
Account, avviso all'80%, mai cancellazioni automatiche.

**Punti di forza per vendere EON** (da usare nel sito, nelle demo, nei
messaggi):
1. **Incluso nell'abbonamento** — nessuno spazio in più da pagare per le
   foto di lavoro.
2. **Non ti riempie più iCloud o Google** — il tuo spazio personale resta
   per le tue cose; niente abbonamento extra ad Apple o Google per colpa
   del lavoro.
3. **Tutto in ordine da solo** — ogni foto e documento va nella scheda del
   cliente giusto, con la nota e la descrizione di EON.
4. **Lo ritrovi a voce in 3 secondi** — "la foto della crepa di Rossi",
   "il preventivo di Bianchi".
5. **Lo mandi al cliente in un tocco** — WhatsApp, email o EON.
6. **Lavoro separato dalla vita privata** — niente foto dei figli in mezzo
   ai cantieri, niente cantieri in mezzo alle vacanze.
7. **Al sicuro** — backup automatici, dati in Europa e cifrati, "Scarica
   tutto" quando vuoi.
8. **Più ci metti, più ti serve** — la memoria del tuo lavoro diventa il
   motivo per restare (per noi: clienti che restano anno dopo anno).

Frase: *"Le foto e i documenti di lavoro sono inclusi in EON: in ordine per
cliente, e non ti riempiono più iCloud."*

**Paletti (da rispettare)**
- **Mai dire "costa meno di iCloud"**: sul prezzo al GB Apple e Google non si
  battono (2 TB a ~10 €). Il valore è ordine + ricerca + uso, non i GB.
- **Solo lavoro**, mai il rullino intero (privacy, spazio, confusione).
- **Mai perdere niente**: backup con ripristino a qualsiasi minuto,
  "Scarica tutto" (anche per il GDPR).
- **Conservazione fiscale "a norma"** solo con fornitore accreditato: non
  prometterla prima.

**Da fare in app** [Claude]
- Compressione delle foto (subito dopo il merge).
- Avviso alla prima foto: "le foto scattate in EON non occupano spazio sul
  tuo iPhone né su iCloud".
- Barra "spazio usato" e avviso all'80%.
- "Scarica tutto".
- Più avanti: "Sposta in EON e libera spazio" (scegli foto di lavoro dalla
  galleria, EON le archivia per cliente e ricorda di cancellarle
  dall'iPhone).

### Costi e spazio — analisi del 25/09/2026 (stime, da confermare coi token veri)

**Dati misurati in produzione**: 36 file per 38 MB (foto media 1,45 MB),
database 15 MB. Una richiesta a EON manda all'AI ~18.000 token di istruzioni
(regole + elenco strumenti) e fa in media 2–2,5 giri; oggi metà delle
richieste va su Sonnet, metà su Haiku. I registri NON salvano ancora i token.

**Costo per richiesta** (prezzi ufficiali: Haiku 4.5 $1/$5, Sonnet 4.5 $3/$15
per milione di token in entrata/uscita; cache: scrittura 1,25×, lettura 0,1×):
Haiku ~1–3 centesimi di $, Sonnet ~3–10 centesimi; media ~2–6 centesimi.
Le cose fatte senza AI (percorsi veloci, letture locali) costano zero.

**Costo per cliente al mese** (~450 richieste): AI ~10–25 € · spazio e
traffico pochi centesimi · Stripe ~0,70 € su 30 € · costi fissi (Supabase +
Vercel ~45 $) ~0,40 € con 100 clienti. **Il vero costo è l'AI, non lo
spazio**: con 30 € di abbonamento oggi l'AI prende metà o più dell'incasso.

**Le 4 leve, PRIMA di fissare il prezzo** [Claude]:
1. **Registrare i token veri** di ogni richiesta (da stime a numeri reali).
2. **Accorciare le istruzioni** da ~18.000 a 6–8.000 token (all'AI solo gli
   strumenti che servono per quella richiesta): circa metà del costo in meno.
3. **Più cose fatte senza AI** (percorsi veloci: calendario, clienti,
   documenti).
4. **Haiku come prima scelta**, Sonnet solo quando serve davvero.
Obiettivo: ~3–8 € di AI per cliente al mese → abbonamento 29–39 € con
margine sano.

**Spazio incluso — proposta** (confronto: iCloud gratis 5 GB, poi 50 GB
~0,99 €/mese, 200 GB ~2,99 €, 2 TB ~9,99 €; Google gratis 15 GB condivisi,
poi 100 GB ~1,99 €, 2 TB ~9,99 € — prezzi indicativi):
- Prova / Piano Free: **2 GB** (~6.000 foto compresse)
- Abbonamento base: **20 GB solo per il lavoro** (~60.000 foto; a noi costa
  meno di 0,50 €/mese anche se pieno)
- Pacchetto extra: **+100 GB a ~2–3 €/mese**

**Come raccontarlo — onesto**: sul prezzo al GB Apple e Google non si
battono (2 TB a ~10 €), quindi mai dire "EON costa meno di iCloud". Il
valore è: spazio **incluso** nell'abbonamento, il lavoro **non riempie più
iCloud/Google** (niente spazio extra da comprare), tutto **in ordine per
cliente** e ritrovabile a voce. Frase: *"Le foto e i documenti di lavoro
sono inclusi in EON: in ordine per cliente, e non ti riempiono più iCloud."*
Lo spazio è un argomento in più per scegliere EON e restarci; il motivo
principale per pagare resta il tempo risparmiato e il lavoro fatto.

## 3. Una "vera app" sul telefono

- **[fatto 26/09] Installabile** dal browser ("Aggiungi a Home") con icona e
  schermata di avvio.
- **[insieme] App Store e Google Play** (dopo): servono gli account
  sviluppatore (Apple 99 $/anno, Google 25 $ una volta).
- **[fatto 28/09] Versione da computer**: da 1024 px in su menu a sinistra
  (con Calendario e Messaggi), Home su due colonne, card su 4 colonne,
  Messaggi come WhatsApp Web, avvisi in alto a destra. Sul telefono uguale.
  Prossimo passo possibile: le altre pagine (Calendario, Azienda) con più
  colonne dove serve.
- **[fatto 27/09] Accesso con Face ID senza password** (passkey, standard
  delle banche): dopo il primo accesso EON propone "Entra con Face ID";
  poi si entra guardando il telefono. Impostazioni → Face ID per attivarlo
  o toglierlo. Le passkey valgono per il dominio su cui nascono: col
  dominio nuovo (eon.it) andranno riattivate una volta (e aggiunto il
  dominio a PASSKEY_ORIGINI).
- **[Claude] Avvisi all'ora giusta**: promemoria che suonano anche ad app
  chiusa ("tra 15 minuti chiama Rossi").

---

## 4. Funzioni del prodotto

**Documenti e soldi**
- **Fattura elettronica (SdI)** — per molti artigiani indispensabile
  (discusso il 24/09, serve un intermediario accreditato).
- **PDF allegato in automatico** quando mandi preventivo/fattura su
  WhatsApp o Email.
- **Lettera e Cartello fine lavori** migliorati, con lo stesso formato di
  fatture e preventivi. (Non vanno tolti.)
- **Documenti impresa**: EON legge da solo la scadenza (es. DURC) e ricorda
  il rinnovo 30 giorni prima.

**Menu e pagamenti**
- **La tua azienda → cruscotto**: entrate, uscite, tasse, quanto resta.
  **Fatto (27/09)**: pagina vera dal Menu, mese/anno, calcolata dai dati
  veri (fatture → entrate, spese → uscite, clienti). Tasse = **stima** con
  una percentuale che l'utente cambia (30% di partenza).
- **Fisco per mestiere** (deciso 27/09 con Andrea): regime (forfettario/
  ordinario), IVA, contributi e coefficienti diversi per ogni professione.
  Si fa nel dettaglio **solo dopo l'ok di 10 artigiani/professionisti**.
- **Conti veri ed esatti** (deciso 27/09, stesso momento: dopo i 10 sì,
  con la società). In quest'ordine:
  1. **Fatturazione elettronica (SdI)** tramite un servizio esterno:
     oggi le fatture di EON sono PDF, validi da mandare al cliente ma
     **non come fattura fiscale**. Collegati: fatture valide, entrate
     vere, e le fatture dei fornitori arrivano da sole → uscite vere.
  2. **Calcolo esatto per il forfettario** (percentuale, contributi,
     acconti e saldo: "a giugno paghi X"). Per l'ordinario resta una
     stima da far confermare al commercialista.
  3. **Collegamento alla banca** (Open Banking, sola lettura): EON legge
     i movimenti e segna da solo chi ha pagato e le spese.
  4. **Accesso del commercialista** a EON per controllare e correggere.
  Serve: società/P.IVA, contratti con i servizi (costi da verificare),
  privacy in regola.
  **Approfondimento (27/09)**:
  - *Fatturazione elettronica, due strade.* (A) EON fa e manda la fattura
    da solo tramite un servizio "ponte" verso lo SdI (es. Openapi,
    Invoicetronic, A-Cube): pochi centesimi a fattura (Openapi: invio da
    €0,015–0,07, conservazione €0,035), ricezione delle fatture dei
    fornitori inclusa; ma EON deve produrre l'XML giusto per ogni caso
    (forfettario, bollo, ritenuta, split payment…) e serve la
    conservazione per 10 anni. (B) EON si collega al programma che
    l'artigiano usa già (es. Fatture in Cloud, API incluse nella
    licenza): meno responsabilità, ma solo per chi ce l'ha e lo paga.
    **Decisione di Andrea (27/09): strada (B)**, perché gli artigiani
    hanno già tutti un loro servizio di fatturazione: EON è partner, non
    concorrente (e l'App Store di Fatture in Cloud può essere un canale
    per trovare clienti). Ai primi artigiani si chiede quale usano, e si
    parte dai più diffusi (Fatture in Cloud, Aruba…).
    **Strada (A) = fonte di business futura**: EON autonomo sulle fatture
    (invio diretto allo SdI tramite servizio ponte), da valutare più
    avanti come ricavo in più. Prima di farla: prove nell'ambiente di
    test dello SdI.
    **Valutazione (27/09, voto 8/10) — cosa tenere d'occhio:**
    1. Verificare che "tutti hanno già un servizio" sia vero: molti
       piccoli artigiani fanno fare tutto al commercialista o usano il
       sito gratuito dell'Agenzia delle Entrate (niente collegamento
       possibile). Per loro serve almeno "mando i dati al commercialista".
    2. Ogni collegamento costa lavoro: farne 1-2, i più usati.
    3. Dipendenza: se Fatture in Cloud cambia regole o fa un suo
       assistente AI, dipendiamo da loro → i dati restano anche in EON.
    4. Il valore della strada (A) non è il guadagno sulla singola fattura
       (minimo) ma poter dire "con EON non paghi più il programma delle
       fatture" (100-250 € l'anno risparmiati): argomento di vendita.
    **Domande ai primi 10 artigiani:** "Con che programma fai le
    fatture?" e "Le fai tu o il commercialista?".
  - *Banca.* Tramite un fornitore autorizzato (Tink, Salt Edge, Yapily,
    Enable Banking…; GoCardless Bank Account Data ha chiuso). Prezzo per
    conto collegato al mese, solo su preventivo, di solito con un minimo
    mensile. Consenso da rinnovare ogni 180 giorni. EON abbina i
    movimenti alle fatture aperte e chiede quando non è sicuro.
- **Chiamate → rubrica**: tutti i clienti col telefono, un tocco e chiami.
- **Cresci**: oggi "Lavori in corso", da decidere cosa diventa.
- **Pagamenti a colpo d'occhio**: gli incassi in calendario con un colore
  diverso dagli altri impegni; chi ha pagato e chi no in una schermata.
- **Card rinominabili** per i mestieri (es. "Foto cantiere" → come vuoi
  tu): cambia solo il nome, non cosa fa.

**Communication Hub — Messaggi diventa il punto unico** (progetto grande)
- **Primo passo fatto (26/09)**: Messaggi ridisegnata nello stile
  dell'app — un solo elenco con EON, WhatsApp ed Email (pallino del
  canale, cerca, filtri, archiviate in fondo); nella chat "Invia con"
  EON / WhatsApp / Email. WhatsApp ed Email per ora "a metà": si apre
  l'app col testo già scritto e il messaggio resta nella chat, ma le
  **risposte** restano in WhatsApp o nella posta. Il cliente nel suo
  portale vede solo i messaggi EON.
- EON, **WhatsApp** ed **email** arrivano e partono dalla chat del cliente
  giusto: una sola conversazione per cliente, qualunque canale usi.
- EON legge i messaggi in arrivo, li collega al cliente, propone la
  risposta e segna gli impegni che ci sono dentro ("ci vediamo giovedì").
- Nella scheda di foto e documenti i pulsanti WhatsApp/Email ci sono già
  ma sono spenti ("presto disponibile") fino all'Hub; oggi funziona EON.
- **Ordine deciso (03/09)**: prima EON usato davvero con dati veri, poi
  l'Hub, poi una prova finale con tutto insieme. Mai il contrario: un
  errore del cervello non deve mandare un messaggio vero a un cliente
  vero.
- Serve: WhatsApp Business (account Meta, costo per messaggio), un
  servizio email, consenso privacy.

**Voce**
- EON che parla anche nella schermata AI grande e che legge ad alta voce
  le domande di conferma.
- **Programma OpenAI** (chiave già sul server): voce umana non robotica;
  **trascrizione di telefonate e vocali dei clienti**; dalla trascrizione
  EON segna da solo in calendario gli impegni presi ("ti richiamo
  venerdì").

**Piano Free "Organizza la giornata"** (uso personale, non i 4 mestieri)
- **Cartelle libere** create dall'utente ("Casa", "Palestra",
  "Ristrutturazione"), che EON riconosce a voce: "segnami in Casa di
  chiamare l'idraulico".
- Schermata di benvenuto che spiega come funziona e che le cartelle si
  personalizzano.
- Cosa metterci davvero: da decidere insieme.

**Servizi esterni** (servono fornitore e costo)
- ~~Meteo per i cantieri~~ **fatto il 26/09** (MET Norway, gratis).
- **Tempi di viaggio col traffico** dentro EON: serve Google Maps (account
  Google Cloud di Andrea; gratis fino a qualche migliaio di calcoli al mese,
  stima). Oggi EON apre le Mappe del telefono con il percorso.

**Da controllare**
- Fuso orario delle date calcolate dal server (il server lavora in UTC).
- Riconoscere un documento anche dal contenuto, non solo dal nome.

**Piccole cose già decise**
- Ingranaggio delle impostazioni anche in Calendario, Clienti, Messaggi,
  quando avranno impostazioni loro.
- Ricerca dei documenti dell'impresa per nome, come per i clienti.

**Grafica**
- Una sessione dedicata alla grafica di tutta l'app.

---

## 5. Il cervello di EON (EON Brain)

- Livelli di rischio a 4 valori per le azioni (lettura, scrittura
  leggera, importante, esterna).
- Un codice per ogni richiesta che colleghi tutto quello che EON ha fatto
  ("perché EON ha fatto questa cosa?").
- Memoria di contesto più lunga dei 90 secondi di oggi.
- **Il "libro" dei professionisti**: centinaia di situazioni vere per
  mestiere (edile fatto; poi strato comune, amministratore di condominio,
  elettricista, avvocato) trasformate in test automatici, per trovare gli
  errori prima dei clienti. Il libro resta nostro, non entra nel prompt.
- Controllo automatico dello schema del database a ogni pubblicazione
  (oggi si lancia a mano).
- Risposta ancora più veloce (un solo giro con l'AI invece di due).
- Ragionamento più accurato solo sui casi difficili (date, calcoli).
- **EON impara dalle risposte tecniche già date** (idea di Andrea, il
  "principio democratico": es. TFR, SCIA, delibere condominiali): più
  utenti, meno ricerche e meno AI. Rischio da risolvere PRIMA: una
  risposta sbagliata salvata si ripeterebbe per tutti; serve sapere quando
  una risposta salvata è vecchia e va rifatta.
- Abitudini nel tempo ("ogni lunedì chiami Rossi") — quando ci sarà uso
  reale.

### 5b. Meno AI, stessa qualità (deciso con Andrea, 25/09/2026)

Obiettivo: EON fa da solo tutto quello che può, l'AI resta solo per i casi
difficili. Meno costi, risposte più veloci. Traguardo realistico: **60–70%
delle richieste senza AI** (stima, da confermare coi dati veri).

**Il percorso deciso con Andrea (26/09/2026)** — principio: la dipendenza
dall'AI scende piano piano, **la qualità non scende mai**.

- **Fase 1 — adesso**: misurare (token e tipo di ogni richiesta) e
  analizzare cosa EON può già fare scritto nel codice, senza AI e senza
  perdere qualità né velocità; poi farlo (passi 0–2 qui sotto). Prima del
  lancio: la base del pannello EON Admin, così il monitoraggio c'è dal
  primo cliente, e il consenso nella privacy per usare i dati (anonimi)
  per migliorare EON.
- **Fase 2 — lancio a 10 → 20 → 50 → 100 clienti**: parte l'apprendimento
  (passo 3). Le situazioni passano una alla volta a EON solo quando hanno
  dimostrato di essere fatte bene quanto dall'AI.
- **Sempre, in EON Admin**: la percentuale di richieste fatte da EON e
  quelle fatte dall'AI, e lo stato di ogni situazione (la fa EON / la fa
  l'AI / quanto le manca per passare a EON). Vedi 5c.
- **Fase finale — il modello nostro**: prendere un modello AI aperto (es.
  Llama, Mistral), specializzarlo sul lavoro di EON coi dati di EON
  (azioni confermate e correzioni degli utenti) e farlo girare sui nostri
  server. Fa la routine, Claude resta per i casi difficili. Conviene con
  centinaia di utenti (stima: centinaia–migliaia di € per addestrarlo,
  centinaia–1.000+ €/mese di server). Da verificare prima: le regole di
  Anthropic sull'uso delle risposte di Claude per addestrare altri modelli.
- **Come funzionerebbe il modello nostro** (26/09): modello aperto (Llama
  di Meta, uso commerciale gratuito; o Mistral, europeo) specializzato con
  gli esempi confermati dagli utenti; gira su un server affittato (a ore
  ~0,5-1 €/h, dedicato ~200-1.000+ €/mese, o "a richiesta"; meglio europeo:
  Hetzner, OVH, Scaleway) oppure da un fornitore a consumo (Together, Groq,
  Fireworks). Tre livelli: codice → modello nostro → Claude, ognuno passa
  al successivo se non è sicuro. Ri-addestrato ogni tanto, e messo online
  solo se passa i test. Conviene con molti clienti (costo fisso che si
  divide): stima AI per cliente ~15 € con 50 clienti, ~3 € con 500, ~1,5 €
  con 5.000. Il conto vero si fa coi token registrati.
- **Curva attesa** (stima): ~90% con AI all'inizio → ~50% dopo la fase 1
  → ~30% dopo l'apprendimento; il 20–30% finale (frasi nuove, domande
  tecniche, testi, foto) resta all'AI o al modello nostro.

I passi tecnici:

1. **Passo 0 — Misurare** [Claude]: salvare i token veri di ogni richiesta
   e il "tipo" di richiesta (spostare appuntamento, nuovo cliente, domanda
   tecnica…). Senza questo ogni cifra resta una stima.
2. **Passo 1 — Analisi del codice** [Claude]: dividere le funzioni in tre
   gruppi: *senza AI* (scritte nel codice), *AI piccola* (Haiku, prompt
   corto), *AI completa* (casi difficili).
3. **Passo 2 — Modifiche** [Claude]: spostare nel codice il primo gruppo,
   accorciare il prompt (da ~18k a 6–8k token), Haiku come predefinito.
   Test prima di ogni consegna.
4. **Passo 3 — EON impara, sotto controllo** [Claude] (quando ci sono
   artigiani veri che lo usano):
   - ogni frase nuova diventa uno **schema** ("sposta X a giovedì alle Y");
   - **in prova**: EON chiama ancora l'AI e confronta di nascosto la sua
     risposta; l'utente non si accorge di niente;
   - **attivo** solo dopo 20 risposte uguali all'AI su utenti diversi e
     nessuna correzione;
   - **controlli a campione**: 1 volta su 20 lo schema attivo viene
     ricontrollato con l'AI;
   - **torna in prova** se l'utente corregge ("no", Annulla, cancella
     subito);
   - **controllo dei dati**: il cliente esiste, l'orario ha senso,
     altrimenti passa all'AI;
   - le azioni delicate chiedono sempre conferma, come oggi;
   - dopo ogni aggiornamento dell'app gli schemi attivi si ritestano;
   - si imparano solo **modi di dire**, mai i dati degli utenti.

Stati di uno schema: **osservato → in prova → attivo** (e **sospeso** se
sbaglia). Nel dubbio vince sempre l'AI: un errore costa più di un risparmio.

### 5c. EON Admin — il pannello privato di Andrea

Solo per l'account di Andrea (e per Claude quando lavora). Numeri e tipi di
richiesta di tutti gli utenti insieme, **mai i messaggi privati**.

- **Oggi**: utenti attivi, richieste, errori, costo AI del giorno/mese.
- **Apprendimento** (la pagina per seguire EON che impara):
  - totale richieste divise in *senza AI* / *con AI*, e come cambia
    settimana dopo settimana (es. 1.500 richieste: 100 senza AI → dopo
    l'addestramento 1.100 senza AI);
  - per ogni tipo di richiesta: quante, quanta parte è già senza AI,
    quanti schemi sono in prova;
  - per ogni schema: esempio di frase, stato, barra di avanzamento
    ("18/20 risposte uguali all'AI"), correzioni ricevute;
  - **risparmio**: quanto costerebbe con l'AI e quanto si spende davvero;
  - pulsanti: sospendi uno schema, rimettilo in prova.
- **Avvisi**: uno schema attivo sbaglia, errori in aumento, costo AI oltre
  la soglia.
- **Riassunto settimanale** sul telefono: "questa settimana 3 schemi
  diventati attivi, 62% senza AI, risparmiati ~X €".
- **Da togliere nella versione commerciale**: il "Registro AI" che oggi
  vede l'utente in Impostazioni → Aiuto (serve a noi, non a lui).

### 5d. EON "mente" del professionista (visione di Andrea, 17/09/2026)

*"EON deve diventare sempre di più come il professionista che lo usa."*
Oggi EON è personalizzato per **mestiere** (uguale per tutti gli
idraulici); il passo dopo è per **persona**. Con quello che abbiamo già,
senza tecnologie nuove:
- **Il suo modo di scrivere**: EON impara il tono dai messaggi che
  l'artigiano ha già mandato ai clienti (come Gmail).
- **Le correzioni valgono per sempre**: se lo correggi due volte sulla
  stessa cosa, la terza la fa giusta da solo.
- **Ricordi veri**: prima di rispondere, EON guarda come ha già gestito
  situazioni simili con quel cliente.
- **Memoria a due livelli**: cosa vale oggi ("chiama Rossi") e cosa vale
  sempre ("lavora il sabato mattina").
- **"Cosa ricordo di te"**: una pagina onesta che mostra cosa EON sa di
  te e perché l'ha usato; si può correggere o cancellare.
Ordine: prima il modo di scrivere (i dati ci sono già). Va insieme a EON
Memory (2b): più EON ricorda, più è tuo.

---

## 6. Mercato

**Prima di darlo a qualcuno: EON "solido", non "perfetto"** (qualche
giorno, non mesi): pacchetto #97 pubblicato e accessi chiusi · la tua
prova dal telefono · avviso automatico degli errori · backup (Supabase
Pro) · compressione delle foto · privacy di base. Il resto lo si migliora
**con** gli artigiani, non prima.

**Da 5 a 50 artigiani, per gradini** (obiettivo di Andrea: 50 che lo usano
davvero):
1. **5** artigiani che conosci, gratis, "è una prova, aiutami a
   migliorarlo", per 2 settimane: la cosa che vale di più.
2. **15**: i loro colleghi, col passaparola (cantieri, fornitori).
3. **50**: EON si vende perché qualcuno dice "io lo uso, mi fa risparmiare
   tempo". Con 50 che lo usano e pagano: azienda vera, numeri veri sui
   costi, apprendimento che funziona, più facile trovare investitori.

- **[Andrea] Da subito: dati veri e uso quotidiano** — una decina di
  clienti veri nell'app, usarla ogni giorno e segnare (col feedback) ogni
  volta che EON non fa quello che ti aspetti: frase esatta + cosa è
  successo.
- Conta chi lo **usa** ogni giorno, non chi si iscrive.
- Raccogliere i feedback (c'è già "Manda un feedback") e sistemare.
- Decidere il prezzo con i dati veri di uso e di costo.

---

## 7. Quanto può valere EON, e i principi di lavoro

**Scenari di valore** (22/09/2026, metodo standard per i software in
abbonamento: multiplo del fatturato annuo; stime, prezzo non ancora
deciso):

| Clienti paganti | a 20 €/mese | a 40 €/mese | a 60 €/mese |
|---|---|---|---|
| **500** (fatturato 120–360 mila €/anno) | 0,36–0,96 M€ | 0,72–1,9 M€ | 1,1–2,9 M€ |
| **10.000** (fatturato 2,4–7,2 M€/anno) | 12–24 M€ | 24–48 M€ | 36–72 M€ |

A 500 interessa a business angel e piccoli fondi italiani; a 10.000 a
fondi veri. Punto di forza: chi mette in EON calendario, clienti e
memoria del lavoro difficilmente cambia (pochi clienti persi).

**Principi di lavoro (sempre validi)**
- I tre pilastri: ogni funzione rafforza tempo, memoria o soldi.
- **Imparare dalle grandi app**: prima di inventare, guardare come lo
  risolvono WhatsApp, Gmail, Apple, e adattarlo; ogni proposta spiegata
  nel merito, mai "perché lo fa Google".
- Meno AI, qualità mai più bassa (5b).
- Testare prima di consegnare; un pacchetto, un merge, un link.
- Onestà: dire cosa è una stima, cosa non è provato, cosa non conviene.

---

## Fatto il 27/09/2026 (notte)

Privacy per la prova: informativa (/privacy), termini con accordo art. 28
(/termini), riga privacy sulla pagina del cliente, registro dei trattamenti
(docs/), casella "Accetto" e card per chi c'era già, pulizia automatica dei
registri · "Invia il preventivo a Rossi" con un comando (WhatsApp/Mail
pronti) · foto e documenti in uno spazio privato con link a scadenza (come
Google Drive). **Da fare**: controllo di un legale; DPA dei fornitori.

## Idea commerciale: foto → prezzi e acquisto (Andrea, 27/09/2026)

Dalla foto con la descrizione EON riconosce l'oggetto (es. "rubinetto
monocomando Grohe") e offre "Cerca il nuovo" / "Cerca l'usato": fase 1 apre
Amazon, ManoMano, Subito già cercati (link di affiliazione → commissione
per EON, pilastro *soldi*); fase 2 prezzi veri dalle API dei negozi (eBay
Browse, Amazon PA-API), mai prezzi inventati dall'AI. Da decidere quando.
Serve: iscrizione ai programmi di affiliazione [Andrea].

## Importare i clienti e prenderli dalla rubrica

Fatto (27/09): import da file (.vcf della rubrica, Excel/CSV del programma
delle fatture). **Da fare** [Claude, ~1 ora]: pulsante "Scegli dalla
rubrica" dove il telefono lo permette (oggi Android con Chrome: Contact
Picker API), stessa scelta con le caselle e niente doppioni; da provare su
un Android vero. Più avanti: pulsante "Prendi dalla rubrica" con l'app
sull'App Store (su iPhone da Safari Apple non lo permette); allineamento
automatico con Fatture in Cloud (strada B). Non si può: leggere i contatti
di WhatsApp, prendere dati "da internet".

## Fatto il 27/09/2026 (sera, prove di Andrea)

Azioni dirette senza AI (password, email, profilo, Face ID, feedback,
"dovreste aggiungere…", assegna un compito) · cambio email · mai clienti
doppi, stesso nome = stesso cliente, archiviato → riattivato · 39 clienti
di Andrea di nuovo attivi · "Caldaia Baudi venerdì ore 15" crea il cliente
con il lavoro · appunti di un cliente sulla sua scheda e sul suo
appuntamento · "Di' a Rita che ci vediamo…" → appuntamento da confermare +
messaggio; sì/no di Rita lo conferma o lo toglie · appunti cancellabili a
voce · scorri per eliminare preventivi e fatture · importa clienti dalla
rubrica o da Excel.

## Fatto il 27/09/2026

Appuntamenti "a casa di / da cliente" con giorno e ora letti senza AI, con
la nota ("portare attrezzi") e il cliente nuovo creato da solo · connessione
totale: cliente tolto, ripristinato o rinominato → lo stesso per le sue
entrate, trattative, foto e appunti (trigger nel database) · 3 entrate di
clienti non più esistenti di Andrea nel Cestino · entrate e trattative
legate al cliente vero (id), anche con due clienti con lo stesso nome ·
corretto: la fattura fatta dalla chat non diventava un'entrata salvata.

## Fatto il 26/09/2026 (prossimo pacchetto)

Scheda del cliente dal nome (contatti, foto, appunti, stato lavori, EON) ·
foto + nuovo cliente · documenti dell'impresa e card per nome (DURC, carta
intestata…) · caricamento immediato e foto compresse · domande di EON dentro
la card · meteo gratuito · percorsi nelle Mappe · EON sulla Home del telefono.

## Fatto il 25/09/2026 (nel pacchetto #97 o già online)

Un cliente = una chat · Messaggi nel Menu · pulizia dati · Cresci in
sospeso · scorri per eliminare · note e descrizione sulle foto · foto negli
Appunti · Calendario rifatto · risposte di EON nella card · scorrere tra le
pagine · Menu pulito · Impostazioni a card (Account, Profilo, Sicurezza,
Aiuto, Esci, Elimina) · registrazione da app vera (account vuoto,
benvenuto, password dimenticata, conferma email pronta, elimina account) ·
una professione per account · **falla di sicurezza della pagina cliente
chiusa** · Vercel pubblica solo la versione vera.
