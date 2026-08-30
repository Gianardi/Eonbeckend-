-- ============================================================
-- EON — Cestino e archivio
-- ============================================================
-- Migrazione ADDITIVA: non tocca tabelle o dati già esistenti.
-- Da eseguire una sola volta nell'SQL Editor di Supabase.
-- ============================================================

-- 1) Cestino: "eliminare" non cancella subito la riga, la marca con
--    la data di eliminazione. Da lì si può ripristinare (deleted_at
--    torna a null) o eliminare per sempre (cancellazione vera).
--    profiles, documents (tabella non usata dall'app) e ai_audit_log
--    restano fuori: non sono liste di cose che un utente "cestina".
alter table public.clients        add column if not exists deleted_at timestamptz;
alter table public.opportunities  add column if not exists deleted_at timestamptz;
alter table public.employees      add column if not exists deleted_at timestamptz;
alter table public.tasks          add column if not exists deleted_at timestamptz;
alter table public.assigned_tasks add column if not exists deleted_at timestamptz;
alter table public.payments       add column if not exists deleted_at timestamptz;
alter table public.incomes        add column if not exists deleted_at timestamptz;
alter table public.goals          add column if not exists deleted_at timestamptz;
alter table public.conversations  add column if not exists deleted_at timestamptz;
alter table public.messages       add column if not exists deleted_at timestamptz;

-- Le liste normali filtrano sempre per deleted_at is null: un indice
-- parziale le mantiene veloci senza pesare sulle righe già cestinate.
create index if not exists clients_deleted_at_idx         on public.clients        (owner_id) where deleted_at is null;
create index if not exists opportunities_deleted_at_idx   on public.opportunities  (owner_id) where deleted_at is null;
create index if not exists employees_deleted_at_idx       on public.employees      (owner_id) where deleted_at is null;
create index if not exists tasks_deleted_at_idx           on public.tasks          (owner_id) where deleted_at is null;
create index if not exists assigned_tasks_deleted_at_idx  on public.assigned_tasks (owner_id) where deleted_at is null;
create index if not exists payments_deleted_at_idx        on public.payments       (owner_id) where deleted_at is null;
create index if not exists incomes_deleted_at_idx         on public.incomes        (owner_id) where deleted_at is null;
create index if not exists goals_deleted_at_idx           on public.goals          (owner_id) where deleted_at is null;
create index if not exists conversations_deleted_at_idx   on public.conversations  (owner_id) where deleted_at is null;
create index if not exists messages_deleted_at_idx        on public.messages       (conversation_id) where deleted_at is null;

-- 2) Archivio clienti: nascosto dalla vista principale ma non
--    cestinato, sempre recuperabile con un click. Le conversazioni
--    hanno già is_archived; qui aggiungiamo l'equivalente per i
--    clienti — separato da "status" (attivo/trattativa/inattivo),
--    che descrive la fase della trattativa, non la visibilità.
alter table public.clients add column if not exists is_archived boolean not null default false;
