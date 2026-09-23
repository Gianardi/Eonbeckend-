-- ============================================================
-- EON — Registro AI: aggiunge la risposta data da EON (23/09/2026)
-- ============================================================
-- Migrazione ADDITIVA: non tocca righe già esistenti (la colonna nuova
-- resta null per quelle vecchie). Da eseguire una sola volta nell'SQL
-- Editor di Supabase, PRIMA di mettere in produzione il codice che la
-- usa (api/index.js: registraRichiesta scrive anche "risposta").
--
-- Richiesta di Gianardi (lista di test, 23/09/2026, punto 25): nel
-- Registro AI si vedeva solo la domanda fatta a EON, mai la risposta
-- che aveva dato — utile per capire davvero cosa è successo in un
-- turno senza dover rifare la stessa domanda per controllare.
-- ============================================================

alter table public.ai_request_log
  add column if not exists risposta text; -- il testo della risposta di EON in questo turno, se c'era
