-- Assemblee vere per gli amministratori di condominio (28/09/2026).
-- Prima la sezione Assemblee mostrava solo dati di esempio. Ogni assemblea
-- ha la sua scheda: appunti ("cosa si è detto"), foto e documenti la
-- ritrovano con assemblea_id. Solo aggiunte.
create table if not exists public.assemblee (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  condominio text not null,
  client_id uuid references public.clients(id) on delete set null,
  quando timestamptz,
  tipo text not null default 'ordinaria' check (tipo in ('ordinaria', 'straordinaria')),
  stato text not null default 'da convocare' check (stato in ('da convocare', 'convocata', 'fatta', 'verbale da redigere')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists assemblee_owner_quando_idx on public.assemblee (owner_id, quando);
alter table public.assemblee enable row level security;
drop policy if exists assemblee_all_own on public.assemblee;
create policy assemblee_all_own on public.assemblee for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

alter table public.cantiere_appunti add column if not exists assemblea_id uuid references public.assemblee(id) on delete set null;
alter table public.cantiere_foto add column if not exists assemblea_id uuid references public.assemblee(id) on delete set null;
alter table public.cantiere_documenti add column if not exists assemblea_id uuid references public.assemblee(id) on delete set null;
