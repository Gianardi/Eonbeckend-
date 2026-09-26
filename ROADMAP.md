# EON — Roadmap completa

Aggiornata al 25/09/2026. Un solo posto con tutto quello che resta da fare,
in ordine. Il dettaglio tecnico di ogni punto è in `TODO.md`.

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

## 0. Domani mattina — pubblicare il pacchetto

1. **[Andrea]** Merge del pacchetto unico (PR #97).
2. **[Claude]** Controllo che la pubblicazione su Vercel sia andata.
3. **[Claude]** Chiudo i vecchi accessi della pagina cliente
   (`supabase/portale_chiudi_accessi.sql`) e blocco il cambio di
   professione (`supabase/profilo_professione_fissa.sql`).
4. **[Andrea]** 5 minuti di prova sul telefono: Esci e rientra, scorri tra
   le pagine, foto in Appunti, "cosa ho da fare domani?", Impostazioni.

---

## 1. Obbligatori prima di vendere

| Cosa | Chi | Note |
|---|---|---|
| **Vercel Pro** (~20 $/mese) | [Andrea] | Il piano gratuito vieta l'uso commerciale e ha il limite di pubblicazioni che ci ha bloccato il 25/09. |
| **Supabase Pro** (~25 $/mese) | [Andrea] | Backup giornalieri, nessuna pausa del progetto. |
| **Servizio email vero** (es. Resend) | [insieme] | Oggi Supabase manda email solo a noi del team. Poi: email in italiano e **conferma email obbligatoria** accesa. |
| **Privacy, termini, consenso GDPR** | [insieme] | Mi servono ragione sociale, P.IVA, sede, email. Io preparo testi e casella "accetto"; li fai controllare a legale/commercialista. |
| **Dominio tuo** (es. eon.it) | [insieme] | Tu lo compri (~10–20 €/anno), io lo collego al posto di eonbeckend.vercel.app. |
| **Avviso automatico degli errori** | [Claude] | Se qualcosa si rompe a un cliente lo so subito. |
| **Compressione delle foto** (subito dopo il merge) | [Claude] | Come WhatsApp: da ~3 MB a ~300 KB per foto, a occhio uguali (lato lungo ~2000 px). Le foto di documenti da leggere (fatture, DURC) restano più nitide. Spazio ~10 volte meno, caricamento più veloce in cantiere. |
| **Pannello di controllo di EON** | [Claude] | Per gestire 100–1000 clienti dal telefono e dal PC: utenti, chi paga, errori, costo AI, feedback arrivati. |
| **Staging uguale a produzione** | [Claude] | Oggi lo schema di prova è diverso (niente cascata sul profilo, niente creazione automatica del profilo). |
| **Scollegare il progetto Vercel doppio** (eonbeckend-mx2t) | [Andrea] | L'app usa solo "eonbeckend"; il doppione raddoppiava le pubblicazioni. |

---

## 2. Per incassare

- **[insieme] Abbonamento con Stripe**: prova gratuita, piano mensile/annuale,
  fattura automatica, blocco se non si paga. Il prezzo lo decidi tu.
- **[insieme] Spazio incluso per cliente** (es. 10 GB ≈ 30.000 foto
  compresse): barra "spazio usato" in Impostazioni → Account, avviso all'80%,
  piano superiore per chi ne vuole di più; mai cancellazioni automatiche.
  L'archivio è su Supabase (non in Claude, che vede i dati solo quando
  risponde e non li conserva come archivio).
- **[Claude] Costo AI per cliente**: misurato dai registri, per fare il
  prezzo giusto.
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

- **[Claude] Installabile** dal browser ("Aggiungi a Home") con icona e
  schermata di avvio.
- **[insieme] App Store e Google Play** (dopo): servono gli account
  sviluppatore (Apple 99 $/anno, Google 25 $ una volta).
- **[Claude] Versione da computer**: oggi l'app è pensata solo per il
  telefono (colonna stretta su schermo largo).
- **[Claude] Accesso con Face ID senza password** (passkey, 1-2 giorni): oggi
  Face ID compila email e password salvate nel portachiavi dell'iPhone.
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

**Menu**
- **La tua azienda → cruscotto**: entrate, uscite, tasse, quanto resta.
- **Chiamate → rubrica**: tutti i clienti col telefono, un tocco e chiami.
- **Cresci**: oggi "Lavori in corso", da decidere cosa diventa.

**Messaggi = Communication Hub**
- Messaggi diventa il punto unico: EON, **WhatsApp** ed **email** arrivano
  nella chat del cliente giusto. Progetto grande, a sé.

**Voce**
- Voce umana di EON (non robotica) e trascrizione di registrazioni e
  telefonate (programma OpenAI, già in parte configurato).

**Servizi esterni** (servono fornitore e costo)
- Meteo per i cantieri · Mappe e traffico tra cantieri.

**Da controllare**
- Fuso orario delle date calcolate dal server (il server lavora in UTC).

**Grafica**
- Una sessione dedicata alla grafica di tutta l'app.

---

## 5. Il cervello di EON (EON Brain)

- Livelli di rischio a 4 valori per le azioni (lettura, scrittura
  leggera, importante, esterna).
- Un codice per ogni richiesta che colleghi tutto quello che EON ha fatto
  ("perché EON ha fatto questa cosa?").
- Memoria di contesto più lunga dei 90 secondi di oggi.
- Suite di valutazione automatica (il "libro" dei professionisti).
- Risposta ancora più veloce (un solo giro con l'AI invece di due).
- Ragionamento più accurato solo sui casi difficili (date, calcoli).
- EON impara dalle risposte tecniche già date (più utenti, meno ricerche).
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

---

## 6. Mercato

- **[Andrea] 3–5 artigiani veri per 2 settimane**: la cosa che vale di più.
- Raccogliere i loro feedback (c'è già "Manda un feedback") e sistemare.
- Decidere il prezzo con i dati veri di uso e di costo.

---

## Fatto il 25/09/2026 (nel pacchetto #97 o già online)

Un cliente = una chat · Messaggi nel Menu · pulizia dati · Cresci in
sospeso · scorri per eliminare · note e descrizione sulle foto · foto negli
Appunti · Calendario rifatto · risposte di EON nella card · scorrere tra le
pagine · Menu pulito · Impostazioni a card (Account, Profilo, Sicurezza,
Aiuto, Esci, Elimina) · registrazione da app vera (account vuoto,
benvenuto, password dimenticata, conferma email pronta, elimina account) ·
una professione per account · **falla di sicurezza della pagina cliente
chiusa** · Vercel pubblica solo la versione vera.
