-- ============================================================
-- EON — Assistente AI con tool calling
-- ============================================================
-- Migrazione ADDITIVA: non tocca tabelle o dati già esistenti.
-- Da eseguire una sola volta nell'SQL Editor di Supabase,
-- dopo aver creato lo schema base del progetto.
-- ============================================================

-- 1) Data vera per gli impegni, accanto al testo che l'app già mostra.
--    (oggi "quando" è solo una stringa tipo "lun 8 set, 17:00": utile da
--    leggere, impossibile da interrogare per intervallo di date)
alter table public.messages add column if not exists scheduled_at timestamptz;
alter table public.tasks add column if not exists scheduled_at timestamptz;

create index if not exists messages_scheduled_at_idx
  on public.messages (scheduled_at) where event_type = 'appt';
create index if not exists tasks_scheduled_at_idx
  on public.tasks (scheduled_at);

-- 2) Registro delle operazioni compiute dall'AI.
--    L'utente può leggerlo (per vedere "cosa ha fatto l'AI"), ma solo
--    il backend (service role) può scriverci: nessuna policy di insert
--    per il ruolo authenticated.
create table if not exists public.ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  input jsonb not null default '{}'::jsonb,
  esito jsonb,
  stato text not null default 'auto', -- auto | confermato | negato | errore
  created_at timestamptz not null default now()
);
create index if not exists ai_audit_log_owner_idx
  on public.ai_audit_log (owner_id, created_at desc);

alter table public.ai_audit_log enable row level security;
create policy "ai_audit_log_select_own" on public.ai_audit_log
  for select using (auth.uid() = owner_id);

-- 3) Conversazioni con l'AI in sospeso su una conferma dell'utente
--    (es. "confermi l'invio del messaggio a Rossi?"). Uso interno del
--    backend soltanto: nessuna policy, il client non ci accede mai
--    direttamente, nemmeno in lettura.
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  stato text not null default 'in_corso', -- in_corso | in_attesa_conferma | concluso | incompleto
  messaggi jsonb not null default '[]'::jsonb,
  in_sospeso jsonb,
  azioni jsonb not null default '[]'::jsonb, -- azioni già eseguite in questo run, per non perderle tra una conferma e l'altra
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_runs enable row level security;

-- 4) Limite di richieste per utente, per evitare che un abuso consumi
--    il credito Anthropic. Anche questa è a uso esclusivo del backend.
create table if not exists public.ai_rate_limits (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  finestra_iniziata_il timestamptz not null default now(),
  conteggio int not null default 0
);
alter table public.ai_rate_limits enable row level security;

create or replace function public.ai_check_rate_limit(
  p_owner_id uuid,
  p_limite int,
  p_finestra_secondi int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  riga public.ai_rate_limits;
  ora timestamptz := now();
begin
  select * into riga from public.ai_rate_limits where owner_id = p_owner_id for update;

  if riga is null then
    insert into public.ai_rate_limits (owner_id, finestra_iniziata_il, conteggio)
    values (p_owner_id, ora, 1);
    return true;
  end if;

  if ora - riga.finestra_iniziata_il > make_interval(secs => p_finestra_secondi) then
    update public.ai_rate_limits
      set finestra_iniziata_il = ora, conteggio = 1
      where owner_id = p_owner_id;
    return true;
  end if;

  if riga.conteggio >= p_limite then
    return false;
  end if;

  update public.ai_rate_limits set conteggio = conteggio + 1 where owner_id = p_owner_id;
  return true;
end;
$$;

-- IMPORTANTE: questa funzione accetta p_owner_id come parametro a piacere,
-- senza verificare che corrisponda a chi chiama (è security definer proprio
-- per poter scrivere sulla tabella indipendentemente da chi è loggato).
-- Postgres concede l'esecuzione a PUBLIC di default: senza queste righe,
-- un qualsiasi utente autenticato potrebbe chiamarla passando l'id di un
-- altro professionista con un limite già esaurito, bloccandogli per sempre
-- l'assistente. La funzione deve restare uso esclusivo del backend (che la
-- chiama con la service role key), mai raggiungibile con il token di un utente.
revoke all on function public.ai_check_rate_limit(uuid, int, int) from public;
revoke all on function public.ai_check_rate_limit(uuid, int, int) from anon, authenticated;
grant execute on function public.ai_check_rate_limit(uuid, int, int) to service_role;
