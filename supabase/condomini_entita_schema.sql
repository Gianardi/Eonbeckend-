-- ============================================================
-- EON — Condomini come entità propria, dentro un Condominio (cliente)
-- ============================================================
-- Migrazione ADDITIVA: non tocca tabelle o dati già esistenti.
-- Da eseguire una sola volta nell'SQL Editor di Supabase.
--
-- Nata dall'audit del Pack Amministratore di condominio (17/09/2026,
-- vedi TODO.md e libro/amministratore.md): a differenza di edile e
-- idraulico, il "cliente" di un amministratore (il Condominio, l'edificio)
-- non è mai una singola persona ma un insieme di persone (i Condomini)
-- che condividono l'immobile — la parte più importante e più delicata
-- del mestiere (spese ripartite per millesimi, dati di morosità da non
-- condividere tra un condomino e l'altro, "quale condominio" quando un
-- fornitore lavora per più edifici) dipende da questa distinzione.
--
-- Scelta di modello: il Condominio (l'edificio) NON è una tabella nuova
-- — è semplicemente un cliente esistente (`clients`), esattamente come
-- oggi: l'amministratore lo cerca/crea con cerca_cliente/crea_cliente
-- come farebbe con qualunque altro cliente, e tutti gli strumenti
-- esistenti (crea_impegno, manda_messaggio, recupera_documenti_cliente)
-- funzionano già per l'edificio nel suo insieme senza alcuna modifica.
-- Ciò che manca è SOLO l'insieme di persone al suo interno: la tabella
-- `condomini` aggiunge quello, in modo analogo a come `cantieri` ha
-- aggiunto i lavori multipli per lo stesso cliente edile — versione
-- leggera (non l'intera ontologia Assemblea/Delibera/Fondo lavori del
-- libro, per ora fuori scope), sufficiente per risolvere i problemi
-- reali trovati nell'audit.
-- ============================================================

create table if not exists public.condomini (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  nome text not null,
  ruolo text not null default 'proprietario' check (ruolo in ('proprietario', 'inquilino')),
  unita_immobiliare text,
  quota_millesimale numeric,
  telefono text,
  morosita_importo numeric,
  morosita_da date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists condomini_owner_idx
  on public.condomini (owner_id) where deleted_at is null;
create index if not exists condomini_client_idx
  on public.condomini (client_id) where deleted_at is null;
alter table public.condomini enable row level security;
create policy "condomini_all_own" on public.condomini
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
