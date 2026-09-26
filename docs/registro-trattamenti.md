# Registro dei trattamenti — EON

Documento interno (art. 30 GDPR). Versione 1.0 del 27/09/2026, periodo di
prova gratuita. Da far controllare a un legale insieme a `privacy.html` e
`termini.html`, e da aggiornare quando nasce la società.

Titolare: **Andrea Gianardi**, persona fisica — gianardiadvisor@icloud.com.
Nessun DPO nominato (non obbligatorio a questa scala).

## A. EON come titolare (dati dei professionisti che usano l'app)

| Trattamento | Dati | Interessati | Finalità e base | Conservazione |
|---|---|---|---|---|
| Account e accesso | nome, attività, professione, email, password cifrata (Supabase Auth), chiave pubblica passkey, ultimo accesso | professionisti | dare il servizio — contratto (6.1.b) | finché c'è l'account |
| Assistente AI | testo e voce delle richieste, risposte | professionisti (e terzi nominati nelle frasi) | dare il servizio — contratto | registro `ai_request_log` 12 mesi |
| Registri tecnici | errori (`app_errori`), operazioni (`ai_audit_log`), costi, IP nei log dei fornitori | professionisti | sicurezza, costi, correzione errori — legittimo interesse (6.1.f) | 12 mesi (pulizia automatica) |
| Feedback | testo del feedback | professionisti | migliorare EON — legittimo interesse | finché serve, max 24 mesi |
| Pannello Admin | conteggi, costi, errori (mai le frasi degli utenti) | professionisti | gestione del servizio — legittimo interesse | come sopra |

## B. EON come responsabile (dati dei clienti dei professionisti, art. 28)

| Trattamento | Dati | Interessati | Per conto di | Conservazione |
|---|---|---|---|---|
| Anagrafica clienti | nome, telefono, email, note, stato | clienti del professionista | il professionista (titolare) | finché il professionista li tiene / elimina l'account |
| Appuntamenti, appunti, compiti | date, luoghi, testi | clienti, dipendenti | il professionista | idem |
| Foto e documenti (storage `eon-files`) | immagini, PDF, documenti caricati | clienti | il professionista | idem |
| Preventivi, fatture, entrate, uscite | importi, voci, nomi | clienti, fornitori | il professionista | idem |
| Chat e pagina cliente (`cliente.html`) | messaggi, vocali (trascritti), allegati | clienti | il professionista | idem |

Accordo art. 28: sezione 10 dei Termini d'uso (accettata alla registrazione).

## Sub-responsabili

| Fornitore | Servizio | Luogo | Garanzie |
|---|---|---|---|
| Supabase | database, storage, auth | Londra (eu-west-2) | Regno Unito: decisione di adeguatezza UE; DPA Supabase |
| Vercel | hosting sito e API | Londra (lhr1); società USA | DPA Vercel, SCC / DPF |
| Anthropic | modello AI (Claude, API) | USA | termini commerciali API (no addestramento), SCC |
| OpenAI | trascrizione vocali (Whisper, API) | USA | termini API (no addestramento di default), SCC / DPF |
| MET Norway, OpenStreetMap (Nominatim) | meteo, luogo | Norvegia / UE | solo nome del luogo o coordinate |
| Google Fonts, jsDelivr | caratteri, libreria Supabase | USA / UE | solo IP; valutare di ospitarli in EON |

Da fare prima della vendita: firmare/scaricare i DPA dei fornitori (Supabase,
Vercel, Anthropic, OpenAI) a nome della società.

## Misure di sicurezza (art. 32)

- HTTPS ovunque; RLS su tutte le tabelle (ogni utente vede solo i suoi dati);
  tabelle del server senza policy (solo chiave di servizio).
- Password gestite da Supabase (hash); Face ID con passkey (solo chiave pubblica).
- Pagina cliente: link personale con codice, letture solo tramite funzioni
  `portale_*`.
- Admin separato (`/admin`), non mostra mai i messaggi degli utenti.
- Cestino prima della cancellazione definitiva; eliminazione account completa.
- **Punto debole noto**: le foto e i documenti nello storage hanno indirizzi
  pubblici (lunghi e casuali, ma chi ha il link li apre). Da fare: storage
  privato con link firmati a scadenza.

## Violazioni dei dati

Chi se ne accorge avvisa subito Andrea. Entro 72 ore notifica al Garante se
c'è rischio per le persone (art. 33); avviso ai professionisti coinvolti
entro 48 ore (Termini, sez. 10); se il rischio è alto, avviso agli
interessati (art. 34). Tenere nota di ogni violazione, anche piccola.
