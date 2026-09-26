-- EON Admin e avviso automatico degli errori (27/09/2026)
-- Solo aggiunte: tabelle nuove, nessuna colonna tolta o cambiata.
-- Prima staging, poi produzione.

-- 1. Gli errori dell'app e del server, raccolti in automatico.
--    Li scrive e li legge SOLO il server con la chiave di servizio:
--    RLS attiva e nessuna policy = nessun utente può leggerli o toccarli.
create table if not exists public.app_errori (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ultima_volta timestamptz not null default now(),
  conteggio int not null default 1,       -- lo stesso errore ripetuto non crea righe nuove
  owner_id uuid references auth.users(id) on delete set null,
  origine text not null default 'app',    -- app | server
  messaggio text not null,
  dettaglio text,                         -- stack, riga, dati utili per capire
  pagina text,
  versione text,
  dispositivo text
);
create index if not exists app_errori_ultima_idx on public.app_errori (ultima_volta desc);
alter table public.app_errori enable row level security;

-- 2. Chi è amministratore di EON (oggi solo Andrea).
create table if not exists public.eon_admin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  errori_visti_fino timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.eon_admin enable row level security;

-- 3. Tutti i numeri del pannello in una chiamata sola (la chiama solo il
--    server, con la chiave di servizio, dopo aver controllato che chi chiede
--    sia in eon_admin).
create or replace function public.admin_riepilogo(p_admin uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  inizio_mese as (select date_trunc('month', now()) as t),
  richieste as (select * from public.ai_request_log where created_at > now() - interval '30 days'),
  spazio as (
    select owner as uid, round(sum(coalesce((metadata->>'size')::bigint, 0)) / 1048576.0, 1) as mb
    from storage.objects where owner is not null group by owner
  ),
  utenti as (
    select u.id, u.email, u.created_at, u.last_sign_in_at,
           p.full_name, p.business_name, p.profession,
           (select count(*) from public.clients c where c.owner_id = u.id and c.deleted_at is null and not coalesce(c.is_archived, false)) as clienti,
           (select count(*) from richieste r where r.owner_id = u.id) as richieste_30g,
           (select max(created_at) from public.ai_request_log r where r.owner_id = u.id) as ultima_richiesta,
           (select round(coalesce(sum(costo_usd), 0), 3) from public.ai_request_log r where r.owner_id = u.id and r.created_at >= (select t from inizio_mese)) as costo_mese_usd,
           coalesce((select mb from spazio s where s.uid = u.id), 0) as spazio_mb
    from auth.users u left join public.profiles p on p.id = u.id
  ),
  errori as (
    select e.id, e.created_at, e.ultima_volta, e.conteggio, e.origine, e.messaggio, e.dettaglio, e.pagina, e.versione, e.dispositivo, u.email
    from public.app_errori e left join auth.users u on u.id = e.owner_id
    order by e.ultima_volta desc limit 60
  ),
  errori_ai as (
    -- solo l'errore, MAI la frase dell'utente (ROADMAP 5c: mai i messaggi privati)
    select r.created_at, r.errore as messaggio, r.modello, u.email
    from public.ai_request_log r left join auth.users u on u.id = r.owner_id
    where r.errore is not null and r.created_at > now() - interval '30 days'
    order by r.created_at desc limit 30
  ),
  giorni as (
    select d::date as giorno,
           (select count(*) from public.ai_request_log r where r.created_at::date = d::date) as richieste,
           (select round(coalesce(sum(costo_usd), 0), 3) from public.ai_request_log r where r.created_at::date = d::date) as costo_usd,
           (select coalesce(sum(conteggio), 0) from public.app_errori e where e.ultima_volta::date = d::date) as errori
    from generate_series(current_date - 13, current_date, interval '1 day') d
  )
  select jsonb_build_object(
    'generato', now(),
    'errori_visti_fino', (select errori_visti_fino from public.eon_admin where user_id = p_admin),
    'totali', jsonb_build_object(
      'utenti', (select count(*) from auth.users),
      'attivi_7g', (select count(distinct owner_id) from public.ai_request_log where created_at > now() - interval '7 days'),
      'richieste_oggi', (select count(*) from public.ai_request_log where created_at::date = current_date),
      'richieste_7g', (select count(*) from public.ai_request_log where created_at > now() - interval '7 days'),
      'costo_mese_usd', (select round(coalesce(sum(costo_usd), 0), 3) from public.ai_request_log where created_at >= (select t from inizio_mese)),
      'senza_ai_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where modello = 'codice' or modello is null) / count(*)) end from richieste),
      'durata_media_ms', (select round(avg(durata_ms)) from richieste where modello is not null and modello <> 'codice'),
      'errori_nuovi', (select count(*) from public.app_errori where ultima_volta > coalesce((select errori_visti_fino from public.eon_admin where user_id = p_admin), '-infinity'))
    ),
    'utenti', coalesce((select jsonb_agg(to_jsonb(utenti) order by coalesce(ultima_richiesta, created_at) desc) from utenti), '[]'::jsonb),
    'errori', coalesce((select jsonb_agg(to_jsonb(errori) order by ultima_volta desc) from errori), '[]'::jsonb),
    'errori_ai', coalesce((select jsonb_agg(to_jsonb(errori_ai) order by created_at desc) from errori_ai), '[]'::jsonb),
    'giorni', coalesce((select jsonb_agg(to_jsonb(giorni) order by giorno) from giorni), '[]'::jsonb)
  );
$$;
revoke all on function public.admin_riepilogo(uuid) from public, anon, authenticated;
grant execute on function public.admin_riepilogo(uuid) to service_role;

-- 4. Andrea è l'amministratore (in produzione; su staging l'id non esiste e
--    la riga non viene inserita).
insert into public.eon_admin (user_id)
select id from auth.users where email = 'gianardiadvisor@icloud.com'
on conflict (user_id) do nothing;
