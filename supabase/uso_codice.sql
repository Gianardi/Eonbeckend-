-- Quante risposte dà il codice da solo nell'app, senza AI (28/09/2026).
-- Serve al pannello admin ("Cosa può fare il codice"): accanto alle
-- richieste finite all'AI (ai_request_log) si vede quante ne ha già
-- risolte il codice. Si salva SOLO il tipo di risposta (es. "disponibilita",
-- "pagina", "soldi") e il momento: mai la frase detta dall'utente.
-- Solo aggiunte. Prima staging, poi produzione.
create table if not exists public.uso_codice (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete cascade,
  tipo text not null
);
create index if not exists uso_codice_created_idx on public.uso_codice (created_at desc);
-- Nessuna policy: scrive e legge solo il server, con la chiave di servizio
alter table public.uso_codice enable row level security;

-- Anche questo registro si tiene al massimo 12 mesi (stessa pulizia notturna)
create or replace function public.pulisci_registri_vecchi()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ogni tabella solo se esiste (lo schema di staging non è identico a produzione)
  if to_regclass('public.ai_request_log') is not null then delete from public.ai_request_log where created_at < now() - interval '12 months'; end if;
  if to_regclass('public.ai_audit_log') is not null then delete from public.ai_audit_log where created_at < now() - interval '12 months'; end if;
  if to_regclass('public.app_errori') is not null then delete from public.app_errori where ultima_volta < now() - interval '12 months'; end if;
  if to_regclass('public.uso_codice') is not null then delete from public.uso_codice where created_at < now() - interval '12 months'; end if;
  if to_regclass('public.ai_runs') is not null then delete from public.ai_runs where coalesce(updated_at, created_at) < now() - interval '30 days'; end if;
  if to_regclass('public.feedback') is not null then execute 'delete from public.feedback where created_at < now() - interval ''24 months'''; end if;
end $$;
revoke all on function public.pulisci_registri_vecchi() from public, anon, authenticated;
