# EON — istruzioni per chi lavora al progetto

Leggere **prima di tutto**:
1. `ROADMAP.md` — cos'è EON (i tre pilastri), EON Memory, costi e prezzi,
   tutto quello che resta da fare, in ordine.
2. `TODO.md` — il dettaglio di ogni voce, comprese le decisioni prese e il
   perché (cercare la sezione giusta, è lungo).

## REGOLA N. 1 (Andrea, 1/10/2026) — EON è una piccola AI con un modello neurale

- **A capire le frasi è solo il modello neurale** (tipo di richiesta e tutti i
  dettagli: chi, quando, quanto, quale lavoro, quale canale…). **Niente regole
  nuove scritte a mano** (espressioni regolari, elenchi di parole) per capire:
  è lo stile 2015-2018 che Andrea non vuole.
- Il codice serve solo a **fare** (salvare, creare la fattura, chiamare), a
  **normalizzare** quello che il modello ha trovato ("giovedì" → la data) e ai
  **controlli di sicurezza** (conferme prima di mandare o cancellare).
- Una frase nuova da capire → **frasi per il modello** (scrittori, confini),
  riallenare, misurare sui giri. Mai una regola.
- **Nessuna funzione nuova finché ROADMAP 0b.19 (passo A) non è finito.** Se
  Andrea chiede una funzione nuova, dirglielo PRIMA di scrivere codice.
- A ogni pacchetto: `node eval/regole-conta.mjs` e dirgli il numero (deve
  scendere; 893 il 1/10/2026).

## Chi è Andrea

Andrea (Gianardi) è il fondatore, non è un tecnico, lavora **solo dal
telefono** e parla **italiano**.

## Come lavorare con lui

- Rispondere **in italiano**, **brevi e chiari**, senza gergo tecnico.
- EON deve essere "chiedi una cosa e te la fa": semplice, veloce,
  affidabile, fatto con il rigore delle app grandi.
- **Testare prima di consegnare** (Andrea non fa il tester): suite in
  `eval/` (vedi `eval/README.md`), più uno screenshot quando cambia la grafica.
- **Un solo pacchetto, un solo merge**: tutte le modifiche di una sessione
  vanno nello stesso ramo di rilascio e in una sola PR; a lui si manda
  **un solo link**, alla fine.
- Quando scrive, **fermarsi e ascoltare**.
- Essere onesti e critici: dire cosa non è stato provato, cosa è una stima,
  cosa non conviene fare.
- Regola dei tre pilastri: ogni nuova funzione deve rafforzare almeno uno
  tra *tempo* (fa le cose per te), *memoria* (ricorda tutto per te),
  *soldi* (ti fa lavorare e incassare di più).

## Cose tecniche da ricordare

- Produzione Supabase `alxtmsfbxrkrevbioogv`, staging `vdgpadukzoklkrrhrhtm`
  (lo schema di staging NON è identico a produzione: vedi ROADMAP).
  Migrazioni: prima staging, poi produzione; solo aggiunte finché il codice
  nuovo non è online.
- Vercel pubblica solo `main` (i rami `claude/*` no: limite del piano).
- Frontend: `index.html` (app) e `cliente.html` (pagina del cliente, legge
  i dati solo tramite le funzioni `portale_*`). Backend: `api/index.js`.
- **Allenamenti del modello (Andrea, 3/10/2026):** in questo ambiente i programmi in
  sottofondo vanno avanti solo mentre io sto lavorando (un mio turno in corso). Quando
  aspetto un messaggio di Andrea si fermano. Quindi: mentre il modello si allena, lavorare
  su altro (codice, rifiniture, prove) o seguirlo con attese attive; mai lasciarlo "in
  sottofondo" e chiudere il turno pensando che vada avanti da solo.
