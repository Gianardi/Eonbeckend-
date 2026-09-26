# EON — Roadmap completa

Aggiornata al 26/09/2026 (sera). Un solo posto con tutto quello che resta da fare,
in ordine. Il dettaglio tecnico di ogni punto è in `TODO.md`.

**In breve**
- I tre pilastri: tempo, memoria, soldi.
- **0 · Adesso, in quest'ordine** (deciso con Andrea il 26/09).
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

## 1. Obbligatori prima di vendere

| Cosa | Chi | Note |
|---|---|---|
| **Vercel Pro** (~20 $/mese) | [Andrea] | Il piano gratuito vieta l'uso commerciale e ha il limite di pubblicazioni che ci ha bloccato il 25/09. |
| **Supabase Pro** (~25 $/mese) | [Andrea] | Backup giornalieri, nessuna pausa del progetto. |
| **Servizio email vero** (es. Resend) | [insieme] | Oggi Supabase manda email solo a noi del team. Poi: email in italiano e **conferma email obbligatoria** accesa. |
| **Privacy, termini, consenso GDPR** | [insieme] | Per la prova: a nome di Andrea (persona fisica). Per vendere: con la società. Io preparo testi e casella "accetto"; li fai controllare a legale/commercialista. |
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
- **[Claude] Versione da computer**: oggi l'app è pensata solo per il
  telefono (colonna stretta su schermo largo).
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

## Fatto il 27/09/2026 (sera, prove di Andrea)

Azioni dirette senza AI (password, email, profilo, Face ID, feedback,
"dovreste aggiungere…", assegna un compito) · cambio email · mai clienti
doppi, stesso nome = stesso cliente, archiviato → riattivato · 39 clienti
di Andrea di nuovo attivi · "Caldaia Baudi venerdì ore 15" crea il cliente
con il lavoro · appunti di un cliente sulla sua scheda e sul suo
appuntamento · "Di' a Rita che ci vediamo…" → appuntamento da confermare +
messaggio; sì/no di Rita lo conferma o lo toglie.

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
