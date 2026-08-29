# EON — Backend: guida passo-passo

Questa guida presuppone **zero esperienza tecnica**. Ogni passaggio dice esattamente dove cliccare.

---

## Parte 1 — Crea il database (Supabase)

1. Vai su **https://supabase.com** → **Start your project** → registrati (puoi usare l'account Google).
2. Crea un nuovo progetto: dagli un nome (es. `eon`), scegli una password per il database (salvala da qualche parte) e la regione **Europe (Frankfurt)** o simile.
3. Aspetta 1-2 minuti che il progetto sia pronto.
4. Nel menu a sinistra, vai su **SQL Editor**.
5. Apri il file `supabase/schema.sql` (te l'ho consegnato), copia **tutto** il contenuto, incollalo nell'editor, premi **Run**.
6. Se vedi "Success. No rows returned", ha funzionato: il database ha ora tutte le tabelle pronte.
7. Vai su **Project Settings → API**. Da qui ti servono tre valori per dopo:
   - **Project URL** → sarà `SUPABASE_URL`
   - **anon public** key → sarà `SUPABASE_ANON_KEY`
   - **service_role** key (cliccare "Reveal") → sarà `SUPABASE_SERVICE_ROLE_KEY` — **questa non va mai condivisa o messa nel frontend**

## Parte 2 — Attiva il login

1. Sempre su Supabase, vai su **Authentication → Providers**.
2. Lascia attivo **Email** (va bene di default) — i tester si registreranno con email e password.
3. (Facoltativo, consigliato dopo) Puoi attivare anche "Magic Link" per un login senza password.

## Parte 3 — Prendi la chiave AI

1. Vai su **https://console.anthropic.com/settings/keys**
2. Crea una nuova chiave (**Create Key**), dalle un nome (es. `eon-produzione`), copiala subito (non si rivede più).
3. Questa sarà `ANTHROPIC_API_KEY`.

## Parte 4 — Metti online il codice (Vercel)

1. Vai su **https://vercel.com** → registrati (consigliato: con GitHub).
2. Se non hai GitHub, creane uno gratis su **https://github.com** — ti servirà solo per caricare questi file.
3. Su GitHub, crea un nuovo repository (es. `eon-backend`), e carica dentro tutti i file che ti ho consegnato (`api/`, `supabase/`, `package.json`).
4. Su Vercel: **Add New → Project**, collega il repository appena creato, premi **Import**.
5. Prima di premere "Deploy", apri **Environment Variables** e aggiungi le 4 chiavi che hai raccolto:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
6. Premi **Deploy**. Dopo 1-2 minuti avrai un indirizzo tipo `https://eon-backend.vercel.app` — è il tuo endpoint AI vero, online 24 ore su 24.

## Parte 5 — Assistente AI con tool calling (aggiornamento)

L'AI ora può eseguire operazioni da sola (creare impegni, cercare clienti, ecc.), non solo scrivere testo. Serve un piccolo aggiornamento al database, additivo: non tocca nulla di quello che già c'è.

1. Su Supabase, vai su **SQL Editor**.
2. Apri il file `supabase/ai_tools_schema.sql`, copia tutto il contenuto, incollalo nell'editor, premi **Run**.
3. Se vedi "Success", ha funzionato: ora ci sono le colonne e le tabelle che servono all'assistente (data vera per gli impegni, registro delle operazioni, limite di richieste).
4. Non serve nessuna nuova variabile d'ambiente su Vercel: l'assistente usa le stesse `SUPABASE_SERVICE_ROLE_KEY` e `ANTHROPIC_API_KEY` già impostate.

## Cosa manca ancora dopo questo

Questi 4 passaggi ti danno: database vero, login vero, endpoint AI sicuro online.

**Manca ancora**: collegare l'app che abbiamo costruito finora (il file HTML) a questo backend, al posto di `window.storage`. Questo è codice frontend che scriviamo insieme nel prossimo passaggio — per ora l'app e il backend esistono separatamente, vanno uniti.

---

Se un passaggio non torna o un pulsante non è dove me lo aspetto (le interfacce cambiano nel tempo), dimmelo con uno screenshot: ti dico esattamente cosa fare da lì.
