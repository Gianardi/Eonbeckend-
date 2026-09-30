-- ============================================================
-- EON — Frasi vere per allenare i modelli, col consenso (30/09/2026)
-- ============================================================
-- Migrazione ADDITIVA: una colonna nuova in profiles e una tabella nuova.
-- Prima staging, poi produzione.
--
-- Andrea: "ogni richiesta del tester viene registrata e poi le metti tutte
-- insieme per addestrare il modello". Si registra SOLO chi ha acceso
-- "Aiuta a migliorare EON" nelle impostazioni (spento per tutti finché
-- l'utente non lo accende). Si salva la frase SENZA dati personali (nomi dei
-- clienti, telefoni, email, indirizzi sostituiti nell'app prima di mandarla),
-- cosa ne ha fatto EON e se l'utente ha annullato. Mai la conversazione.
-- L'utente vede e cancella le sue; nessun altro utente le vede; il pannello
-- admin mostra solo quante sono. Le legge solo il servizio (service role) per
-- l'allenamento.
-- ============================================================

alter table public.profiles add column if not exists aiuta_migliorare boolean not null default false;
alter table public.profiles add column if not exists aiuta_migliorare_dal timestamptz;

create table if not exists public.frasi_addestramento (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  frase text not null check (char_length(frase) <= 600),
  cassetto text,            -- cosa ha capito il modello ("documento", "calendario"…)
  sicurezza real,           -- quanto era sicuro il modello (0-1)
  esito text,               -- cosa ha fatto EON ("documento_neurale", "ai", "annullato"…)
  mestiere text,
  created_at timestamptz not null default now()
);
create index if not exists frasi_addestramento_owner_idx on public.frasi_addestramento (owner_id, created_at desc);
create index if not exists frasi_addestramento_data_idx on public.frasi_addestramento (created_at desc);

alter table public.frasi_addestramento enable row level security;
-- si scrive solo per sé e solo col consenso acceso
drop policy if exists frasi_addestramento_insert_consenso on public.frasi_addestramento;
create policy frasi_addestramento_insert_consenso on public.frasi_addestramento
  for insert with check (
    auth.uid() = owner_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.aiuta_migliorare)
  );
drop policy if exists frasi_addestramento_select_own on public.frasi_addestramento;
create policy frasi_addestramento_select_own on public.frasi_addestramento
  for select using (auth.uid() = owner_id);
drop policy if exists frasi_addestramento_delete_own on public.frasi_addestramento;
create policy frasi_addestramento_delete_own on public.frasi_addestramento
  for delete using (auth.uid() = owner_id);
