-- ============================================================
-- EON — Cantiere come entità propria, distinta dal Cliente
-- ============================================================
-- Migrazione ADDITIVA: non tocca tabelle o dati già esistenti.
-- Da eseguire una sola volta nell'SQL Editor di Supabase, dopo
-- cantiere_schema.sql e cantiere_foto_cliente_schema.sql.
--
-- Nata da un limite trovato testando il Pack edile (05/09/2026,
-- vedi TODO.md): foto/documenti/pagamenti erano collegati solo a un
-- client_id, quindi un cliente con più lavori insieme (raro ma reale,
-- vedi libro/edile.md sezione C) non poteva distinguerli — "le foto
-- del cantiere di via Roma" e "le foto del cantiere di via Milano"
-- per lo stesso cliente finivano nello stesso mucchio. Versione
-- leggera scelta apposta (non l'intera ontologia Sopralluogo →
-- Preventivo → Commessa → SAL → Garanzia del libro, per ora fuori
-- scope): un Cantiere è solo un'etichetta di un lavoro, collegata a
-- un cliente — abbastanza per risolvere il problema reale trovato.
-- ============================================================

create table if not exists public.cantieri (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  nome text not null,
  stato text not null default 'aperto' check (stato in ('aperto', 'chiuso')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists cantieri_owner_idx
  on public.cantieri (owner_id) where deleted_at is null;
create index if not exists cantieri_client_idx
  on public.cantieri (client_id) where deleted_at is null;
alter table public.cantieri enable row level security;
create policy "cantieri_all_own" on public.cantieri
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- cantiere_foto.client_id resta (una foto può restare collegata solo
-- al cliente, senza un cantiere specifico, quando il cliente ha un
-- solo lavoro): cantiere_id è un affinamento opzionale in più, mai
-- obbligatorio.
alter table public.cantiere_foto
  add column if not exists cantiere_id uuid references public.cantieri(id) on delete set null;

create index if not exists cantiere_foto_cantiere_idx
  on public.cantiere_foto (cantiere_id) where cantiere_id is not null;
