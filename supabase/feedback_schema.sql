-- ============================================================
-- EON — Feedback degli utenti (23/09/2026)
-- ============================================================
-- Migrazione ADDITIVA: non tocca tabelle o dati già esistenti.
-- Da eseguire una sola volta nell'SQL Editor di Supabase.
--
-- Richiesta di Gianardi (lista di test, 23/09/2026, punto 34):
-- possibilità per gli utenti di mandare un feedback per migliorare
-- l'app, direttamente dall'interno (Menu -> "Manda un feedback").
-- Ogni utente può scrivere il proprio; nessuno può leggere quello
-- degli altri (solo il backend/service role, per ora, finché non
-- servirà una vista amministrativa dedicata).
-- ============================================================

create table if not exists public.feedback (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  testo text not null,
  created_at timestamptz not null default now()
);
create index if not exists feedback_owner_idx
  on public.feedback (owner_id, created_at desc);

alter table public.feedback enable row level security;
create policy "feedback_insert_own" on public.feedback
  for insert with check (auth.uid() = owner_id);
create policy "feedback_select_own" on public.feedback
  for select using (auth.uid() = owner_id);
