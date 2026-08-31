-- ============================================================
-- EON — Carta intestata (dati azienda per Preventivo/Fattura/
-- Lettera/Cartello fine lavori)
-- ============================================================
-- Migrazione ADDITIVA: non tocca tabelle o dati già esistenti.
-- Da eseguire una sola volta nell'SQL Editor di Supabase.
--
-- Una configurazione sola per utente (owner_id come chiave primaria,
-- come cantiere_cliente): nome azienda, indirizzo, P.IVA, contatti e
-- logo, usati come intestazione automatica sui documenti generati.
-- ============================================================

create table if not exists public.azienda_intestazione (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  nome_azienda text,
  indirizzo text,
  piva text,
  telefono text,
  email text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.azienda_intestazione enable row level security;
create policy "azienda_intestazione_all_own" on public.azienda_intestazione
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
