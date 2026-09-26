-- Pulizia automatica dei registri (27/09/2026), come scritto nell'informativa
-- privacy: i registri tecnici si tengono al massimo 12 mesi.
-- Solo aggiunte (estensione pg_cron + una funzione + un lavoro notturno).
-- Prima staging, poi produzione.
--   ai_request_log (frasi e risposte dell'assistente)  → 12 mesi
--   ai_audit_log   (operazioni degli strumenti)        → 12 mesi
--   app_errori     (errori dell'app e del server)      → 12 mesi
--   ai_runs        (conversazioni in corso con EON)    → 30 giorni (servono pochi minuti)
--   feedback                                           → 24 mesi
create extension if not exists pg_cron;

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
  if to_regclass('public.ai_runs') is not null then delete from public.ai_runs where coalesce(updated_at, created_at) < now() - interval '30 days'; end if;
  if to_regclass('public.feedback') is not null then execute 'delete from public.feedback where created_at < now() - interval ''24 months'''; end if;
end $$;
revoke all on function public.pulisci_registri_vecchi() from public, anon, authenticated;

-- Ogni notte alle 03:17 (ora del server, UTC)
select cron.unschedule(jobid) from cron.job where jobname = 'eon-pulizia-registri';
select cron.schedule('eon-pulizia-registri', '17 3 * * *', $$select public.pulisci_registri_vecchi()$$);
