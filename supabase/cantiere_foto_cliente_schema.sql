-- ============================================================
-- EON — Collega le foto del cantiere a un cliente
-- ============================================================
-- Migrazione ADDITIVA: non tocca tabelle o dati già esistenti.
-- Da eseguire una sola volta nell'SQL Editor di Supabase, dopo
-- cantiere_schema.sql (richiede che la tabella cantiere_foto esista
-- già).
--
-- Dopo aver scattato una foto, l'app chiede a quale cliente si
-- riferisce (dettando o scrivendo) e la collega qui: resta comunque
-- visibile anche nella galleria generale "Foto cantiere" (stessa
-- riga, non una copia), e diventa visibile anche nella scheda del
-- cliente collegato. Solo un archivio interno: il cliente non la
-- vede mai, non passa dalla sua conversazione.
-- ============================================================

alter table public.cantiere_foto
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists cantiere_foto_client_idx
  on public.cantiere_foto (client_id) where client_id is not null;
