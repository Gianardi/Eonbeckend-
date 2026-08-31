-- ============================================================
-- EON — Cantiere: cliente collegato, foto, documenti, appunti
-- ============================================================
-- Migrazione ADDITIVA: non tocca tabelle o dati già esistenti.
-- Da eseguire una sola volta nell'SQL Editor di Supabase.
--
-- Un solo cantiere/progetto per volta, condiviso per tutta l'app
-- (non un cantiere per cliente): foto, documenti e appunti sono
-- quindi legati solo a owner_id, senza un id di cantiere a parte.
-- cantiere_cliente ha owner_id come chiave primaria: al più una
-- riga per utente, il cliente collegato al cantiere in corso.
-- ============================================================

-- created_at qui non serve a ordinare (una sola riga per utente), ma
-- dbSelect() lato client ordina SEMPRE per created_at su ogni tabella
-- che legge: senza questa colonna la query fallisce e il cliente
-- collegato sparirebbe dall'interfaccia a ogni ricaricamento dei dati,
-- pur restando scritto nel database.
create table if not exists public.cantiere_cliente (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cantiere_cliente enable row level security;
create policy "cantiere_cliente_all_own" on public.cantiere_cliente
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.cantiere_foto (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists cantiere_foto_owner_idx
  on public.cantiere_foto (owner_id) where deleted_at is null;
alter table public.cantiere_foto enable row level security;
create policy "cantiere_foto_all_own" on public.cantiere_foto
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.cantiere_documenti (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  nome text not null,
  tipo text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists cantiere_documenti_owner_idx
  on public.cantiere_documenti (owner_id) where deleted_at is null;
alter table public.cantiere_documenti enable row level security;
create policy "cantiere_documenti_all_own" on public.cantiere_documenti
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.cantiere_appunti (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  testo text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists cantiere_appunti_owner_idx
  on public.cantiere_appunti (owner_id) where deleted_at is null;
alter table public.cantiere_appunti enable row level security;
create policy "cantiere_appunti_all_own" on public.cantiere_appunti
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
