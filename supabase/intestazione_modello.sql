-- ============================================================
-- EON — Formato dei documenti (25/09/2026)
-- ============================================================
-- Migrazione ADDITIVA: due colonne facoltative sulla Carta intestata,
-- nessun dato esistente toccato.
--   modello: il modello scelto per preventivi/fatture/lettere/cartelli
--            (classico | moderno | essenziale | elegante), dalla galleria
--            di EON o proposto leggendo la foto di una fattura dell'utente
--   colore:  colore principale del formato, "#RRGGBB"
-- ============================================================

alter table public.azienda_intestazione add column if not exists modello text;
alter table public.azienda_intestazione add column if not exists colore text;

alter table public.azienda_intestazione drop constraint if exists azienda_intestazione_modello_valido;
alter table public.azienda_intestazione add constraint azienda_intestazione_modello_valido
  check (modello is null or modello in ('classico', 'moderno', 'essenziale', 'elegante'));

alter table public.azienda_intestazione drop constraint if exists azienda_intestazione_colore_valido;
alter table public.azienda_intestazione add constraint azienda_intestazione_colore_valido
  check (colore is null or colore ~ '^#[0-9A-Fa-f]{6}$');
