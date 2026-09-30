-- Cartelle dentro la scheda di un cliente (30/09/2026, tester Simone: "dentro il cliente
-- viale Italia 171 poter fare una cartella «foto sinistro Del Santo»").
-- Solo aggiunte: una colonna facoltativa. Le cartelle senza cliente restano come prima (nella Mente).
alter table public.cartelle add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists cartelle_client_id_idx on public.cartelle(client_id) where client_id is not null;
-- Il cliente deve essere dello stesso utente
drop policy if exists cartelle_all_own on public.cartelle;
create policy cartelle_all_own on public.cartelle for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id and (client_id is null or exists (select 1 from public.clients c where c.id = client_id and c.owner_id = auth.uid())));
