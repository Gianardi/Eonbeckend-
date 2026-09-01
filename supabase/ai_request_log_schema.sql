-- ============================================================
-- EON — Registro per turno dell'assistente AI (EON BRAIN, punto 4)
-- ============================================================
-- Migrazione ADDITIVA: non tocca tabelle o dati già esistenti.
-- Da eseguire una sola volta nell'SQL Editor di Supabase.
-- ============================================================

-- ai_audit_log (già esistente) registra ogni singolo strumento chiamato:
-- utile per vedere "cosa ha scritto l'AI nel database", ma un turno che
-- chiama più strumenti finisce sparso su più righe, senza un modo per
-- ricostruirlo insieme. ai_request_log aggiunge una riga per OGNI turno
-- completo (una chiamata a /api?action=assistant, dall'inizio alla fine):
-- messaggio, modello usato, quanti giri, quali strumenti, come è finito,
-- quanto ci ha messo — per poter rispondere a "perché EON ha fatto
-- questa cosa" leggendo una riga sola invece di ricostruirla da più parti.
--
-- Stesse regole di ai_audit_log: l'utente può leggere il proprio
-- registro, ma solo il backend (service role) può scriverci.
create table if not exists public.ai_request_log (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null, -- nuovo | conferma | continuazione
  messaggio text, -- il testo scritto/detto dal professionista, se c'era (non per le conferme)
  modello text, -- claude-haiku-4-5 o claude-sonnet-4-5; null se il turno non ha chiamato nessun modello
  giri int not null default 0, -- quanti giri del ciclo di tool-use sono serviti
  strumenti jsonb not null default '[]'::jsonb, -- nomi degli strumenti eseguiti con successo in questo turno
  stato text, -- concluso | incompleto | in_attesa_conferma | in_attesa_risposta; null se il turno è fallito con un errore
  errore text, -- messaggio dell'errore, solo se il turno è fallito
  durata_ms int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_request_log_owner_idx
  on public.ai_request_log (owner_id, created_at desc);

alter table public.ai_request_log enable row level security;
create policy "ai_request_log_select_own" on public.ai_request_log
  for select using (auth.uid() = owner_id);
