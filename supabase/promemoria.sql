-- Promemoria degli appuntamenti sul telefono (29/09/2026). Solo aggiunte.
-- Le iscrizioni alle notifiche (una per telefono/browser), dell'utente.
create table if not exists public.push_iscrizioni (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  ultimo_invio timestamptz,
  errori int not null default 0
);
create index if not exists push_iscrizioni_owner_idx on public.push_iscrizioni (owner_id);
alter table public.push_iscrizioni enable row level security;
drop policy if exists push_iscrizioni_own on public.push_iscrizioni;
create policy push_iscrizioni_own on public.push_iscrizioni for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Quali promemoria sono già partiti (mai due volte lo stesso). Solo il server.
create table if not exists public.promemoria_inviati (
  rif text primary key,          -- "tasks:<id>" o "messages:<id>"
  owner_id uuid not null references auth.users(id) on delete cascade,
  inviato_at timestamptz not null default now()
);
alter table public.promemoria_inviati enable row level security; -- nessuna policy: solo la chiave di servizio

-- Segreti del server (chiave delle notifiche, segreto dell'orologio). Solo la chiave di servizio.
create table if not exists public.eon_segreti (
  nome text primary key,
  valore text not null
);
alter table public.eon_segreti enable row level security; -- nessuna policy

create extension if not exists pg_net;

-- I segreti si mettono a mano (mai nel codice): 'vapid_jwk' (chiave privata
-- delle notifiche, JWK P-256; la pubblica è VAPID_PUBBLICA in index.html) e
-- 'cron_promemoria' (encode(gen_random_bytes(24), 'hex')).
-- L'orologio (solo produzione, 29/09/2026): ogni 5 minuti chiede al server di
-- mandare i promemoria in arrivo.
-- select cron.schedule('eon-promemoria', '*/5 * * * *', $$ select net.http_post(
--   url := 'https://eonbeckend.vercel.app/api?action=invia_promemoria',
--   headers := jsonb_build_object('Content-Type', 'application/json', 'x-eon-cron',
--     (select valore from public.eon_segreti where nome = 'cron_promemoria')),
--   body := '{}'::jsonb) $$);
