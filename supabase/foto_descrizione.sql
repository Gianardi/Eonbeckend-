-- ============================================================
-- EON — Descrizione automatica della foto (25/09/2026)
-- ============================================================
-- Migrazione ADDITIVA: una colonna facoltativa, nessun dato toccato.
-- Una frase breve scritta da EON guardando la foto ("porta scorrevole in
-- vetro satinato, telaio in alluminio"), separata dalla nota dell'utente
-- (cantiere_foto.nota): serve a ritrovare la foto a voce anche con parole
-- che l'utente non ha scritto, e come dettaglio per cercare un pezzo uguale.
-- ============================================================

alter table public.cantiere_foto add column if not exists descrizione text;
