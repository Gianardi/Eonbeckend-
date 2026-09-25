-- ============================================================
-- EON — Nota sulla foto del cantiere (25/09/2026)
-- ============================================================
-- Migrazione ADDITIVA: una colonna facoltativa, nessun dato toccato.
-- Il testo che l'utente scrive o detta su una foto ("crepa sul muro
-- della cucina, da sistemare prima della pittura"): si vede aprendo la
-- foto e serve a ritrovarla a voce ("la foto della crepa di Rossi").
-- ============================================================

alter table public.cantiere_foto add column if not exists nota text;
