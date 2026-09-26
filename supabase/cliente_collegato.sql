-- Un cliente, tutto collegato (26/09/2026).
-- Andrea: "ho rimosso dei clienti e in La tua azienda ci sono ancora i loro
-- dati. Vorrei una connessione totale tra i diversi spazi."
-- Solo aggiunte (una funzione e due trigger). Prima staging, poi produzione.
--
-- Quando un cliente:
--   * va nel cestino      → ci vanno anche le sue entrate, trattative,
--                           foto e appunti di cantiere (stessa ora)
--   * torna dal cestino   → tornano anche loro (solo quelle cestinate
--                           insieme a lui, non quelle tolte a mano prima)
--   * cambia nome         → entrate e trattative seguono il nuovo nome
--   * sparisce per sempre → spariscono per sempre anche entrate, trattative
--                           e appunti cestinati con lui (le foto restano nel
--                           cestino: sono file, si tolgono da lì)
-- Entrate e trattative sono legate al cliente dal nome (client_name), foto
-- e appunti dall'id (client_id). Il confronto sul nome non bada a maiuscole
-- e spazi, come nell'app (nomeChiave).

create or replace function public.cliente_nome_chiave(n text)
returns text language sql immutable
set search_path = pg_catalog
as $$ select lower(regexp_replace(trim(coalesce(n, '')), '\s+', ' ', 'g')) $$;

create or replace function public.cliente_collega_dati()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vecchio text := public.cliente_nome_chiave(old.name);
  -- Due clienti vivi con lo stesso nome: le entrate (legate solo dal nome)
  -- non si sa di chi sono, quindi non si toccano.
  omonimo boolean := exists (
    select 1 from public.clients c
    where c.owner_id = old.owner_id and c.id <> old.id and c.deleted_at is null
      and public.cliente_nome_chiave(c.name) = public.cliente_nome_chiave(old.name));
begin
  if tg_op = 'UPDATE' then
    if omonimo then vecchio := chr(1); end if;  -- nessuna entrata ha questo nome
    if new.deleted_at is not null and old.deleted_at is null then
      update public.incomes set deleted_at = new.deleted_at
        where owner_id = old.owner_id and deleted_at is null and public.cliente_nome_chiave(client_name) = vecchio;
      update public.opportunities set deleted_at = new.deleted_at
        where owner_id = old.owner_id and deleted_at is null and public.cliente_nome_chiave(client_name) = vecchio;
      update public.cantiere_foto set deleted_at = new.deleted_at
        where client_id = old.id and deleted_at is null;
      update public.cantiere_appunti set deleted_at = new.deleted_at
        where client_id = old.id and deleted_at is null;
    elsif new.deleted_at is null and old.deleted_at is not null then
      update public.incomes set deleted_at = null
        where owner_id = old.owner_id and deleted_at = old.deleted_at and public.cliente_nome_chiave(client_name) = vecchio;
      update public.opportunities set deleted_at = null
        where owner_id = old.owner_id and deleted_at = old.deleted_at and public.cliente_nome_chiave(client_name) = vecchio;
      update public.cantiere_foto set deleted_at = null
        where client_id = old.id and deleted_at = old.deleted_at;
      update public.cantiere_appunti set deleted_at = null
        where client_id = old.id and deleted_at = old.deleted_at;
    end if;
    if public.cliente_nome_chiave(new.name) <> vecchio and vecchio not in ('', chr(1)) then
      update public.incomes set client_name = new.name
        where owner_id = old.owner_id and public.cliente_nome_chiave(client_name) = vecchio;
      update public.opportunities set client_name = new.name
        where owner_id = old.owner_id and public.cliente_nome_chiave(client_name) = vecchio;
    end if;
    return new;
  end if;

  -- DELETE: prima che il database stacchi foto e appunti dal cliente
  if old.deleted_at is not null then
    if not omonimo then
      delete from public.incomes
        where owner_id = old.owner_id and deleted_at = old.deleted_at and public.cliente_nome_chiave(client_name) = vecchio;
      delete from public.opportunities
        where owner_id = old.owner_id and deleted_at = old.deleted_at and public.cliente_nome_chiave(client_name) = vecchio;
    end if;
    delete from public.cantiere_appunti
      where client_id = old.id and deleted_at = old.deleted_at;
  end if;
  return old;
end $$;

revoke all on function public.cliente_collega_dati() from public, anon, authenticated;

drop trigger if exists clients_collega_dati on public.clients;
create trigger clients_collega_dati
  after update of deleted_at, name on public.clients
  for each row execute function public.cliente_collega_dati();

drop trigger if exists clients_collega_dati_eliminazione on public.clients;
create trigger clients_collega_dati_eliminazione
  before delete on public.clients
  for each row execute function public.cliente_collega_dati();
