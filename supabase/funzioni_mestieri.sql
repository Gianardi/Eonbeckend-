-- Funzioni vere dei mestieri (28/09/2026). Solo aggiunte.
-- Urgenze (idraulico, ma valgono per tutti): un impegno può essere urgente
-- e legato a un cliente.
alter table public.tasks add column if not exists urgente boolean not null default false;
alter table public.tasks add column if not exists client_id uuid references public.clients(id) on delete set null;

-- SAL, stato avanzamento lavori (edile): percentuale del lavoro fatto,
-- importo della rata, se è già stata fatturata.
create table if not exists public.sal (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  numero int not null default 1,
  percentuale numeric(5,2) not null check (percentuale > 0 and percentuale <= 100),
  importo numeric(12,2),
  note text,
  fatturato boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists sal_owner_client_idx on public.sal (owner_id, client_id);
alter table public.sal enable row level security;
drop policy if exists sal_all_own on public.sal;
create policy sal_all_own on public.sal for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Dichiarazioni di conformità (elettricista, DM 37/2008): i dati del modulo.
create table if not exists public.dichiarazioni_conformita (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  numero text,
  dati jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists dico_owner_idx on public.dichiarazioni_conformita (owner_id, created_at);
alter table public.dichiarazioni_conformita enable row level security;
drop policy if exists dico_all_own on public.dichiarazioni_conformita;
create policy dico_all_own on public.dichiarazioni_conformita for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
