# EON — istruzioni per chi lavora al progetto

Leggere **prima di tutto**:
1. `ROADMAP.md` — cos'è EON (i tre pilastri), EON Memory, costi e prezzi,
   tutto quello che resta da fare, in ordine.
2. `TODO.md` — il dettaglio di ogni voce, comprese le decisioni prese e il
   perché (cercare la sezione giusta, è lungo).

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
