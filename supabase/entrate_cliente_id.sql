-- Entrate e trattative legate al cliente vero, non solo al nome (27/09/2026).
-- Solo aggiunte: una colonna nuova (client_id) su incomes e opportunities,
-- funzioni e trigger. Prima staging, poi produzione.
--
-- Prima un'entrata sapeva solo il NOME del cliente: con due clienti con lo
-- stesso nome non si sapeva di chi fosse. Ora ha anche il suo id, messo in
-- automatico dal database (l'app e il server non devono cambiare nulla):
--   * nuova entrata / trattativa con un nome → collegata al cliente con quel
--     nome, se ce n'è UNO solo (vivo, archiviato compreso); con due omonimi
--     resta senza id (come prima: si usa il nome);
--   * cambio del nome del cliente sull'entrata → ricollegata;
--   * nuovo cliente → gli si collegano le entrate già scritte col suo nome
--     che non avevano un cliente;
--   * un id di un cliente di un ALTRO utente viene sempre scartato.
-- cliente_collega_dati (cliente_collegato.sql) ora usa prima l'id, poi il
-- nome per le righe vecchie senza id.

alter table public.incomes add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.opportunities add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists incomes_client_id_idx on public.incomes (client_id);
create index if not exists opportunities_client_id_idx on public.opportunities (client_id);

-- L'unico cliente vivo di quell'utente con quel nome (null se nessuno o più d'uno)
create or replace function public.cliente_da_nome(p_owner uuid, p_nome text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 1 then (array_agg(id))[1] end
  from public.clients
  where owner_id = p_owner and deleted_at is null
    and public.cliente_nome_chiave(p_nome) <> ''
    and public.cliente_nome_chiave(name) = public.cliente_nome_chiave(p_nome)
$$;
revoke all on function public.cliente_da_nome(uuid, text) from public, anon, authenticated;

create or replace function public.entrata_trova_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null then
    -- nome del cliente cambiato sull'entrata: se non è più il suo, si ricollega
    if tg_op = 'UPDATE' and new.client_id is not distinct from old.client_id
       and public.cliente_nome_chiave(new.client_name) is distinct from public.cliente_nome_chiave(old.client_name)
       and not exists (select 1 from public.clients c where c.id = new.client_id
                       and public.cliente_nome_chiave(c.name) = public.cliente_nome_chiave(new.client_name)) then
      new.client_id := null;
    end if;
    -- mai il cliente di un altro utente
    if new.client_id is not null and not exists (
      select 1 from public.clients c where c.id = new.client_id and c.owner_id = new.owner_id) then
      new.client_id := null;
    end if;
  end if;
  if new.client_id is null then
    new.client_id := public.cliente_da_nome(new.owner_id, new.client_name);
  end if;
  return new;
end $$;
revoke all on function public.entrata_trova_cliente() from public, anon, authenticated;

drop trigger if exists incomes_trova_cliente on public.incomes;
create trigger incomes_trova_cliente
  before insert or update of client_name, client_id, owner_id on public.incomes
  for each row execute function public.entrata_trova_cliente();
drop trigger if exists opportunities_trova_cliente on public.opportunities;
create trigger opportunities_trova_cliente
  before insert or update of client_name, client_id, owner_id on public.opportunities
  for each row execute function public.entrata_trova_cliente();

-- Nuovo cliente: si prende le entrate già scritte col suo nome, senza cliente
create or replace function public.cliente_nuovo_prende_entrate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is null and public.cliente_da_nome(new.owner_id, new.name) = new.id then
    update public.incomes set client_id = new.id
      where owner_id = new.owner_id and client_id is null
        and public.cliente_nome_chiave(client_name) = public.cliente_nome_chiave(new.name);
    update public.opportunities set client_id = new.id
      where owner_id = new.owner_id and client_id is null
        and public.cliente_nome_chiave(client_name) = public.cliente_nome_chiave(new.name);
  end if;
  return new;
end $$;
revoke all on function public.cliente_nuovo_prende_entrate() from public, anon, authenticated;

drop trigger if exists clients_prende_entrate on public.clients;
create trigger clients_prende_entrate
  after insert on public.clients
  for each row execute function public.cliente_nuovo_prende_entrate();

-- Cliente nel cestino / ripristinato / rinominato / eliminato per sempre:
-- prima per id, poi per nome (solo righe senza id e senza omonimi vivi).
create or replace function public.cliente_collega_dati()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vecchio text := public.cliente_nome_chiave(old.name);
  -- Due clienti vivi con lo stesso nome: le righe senza id (legate solo dal
  -- nome) non si sa di chi sono, quindi non si toccano.
  omonimo boolean := exists (
    select 1 from public.clients c
    where c.owner_id = old.owner_id and c.id <> old.id and c.deleted_at is null
      and public.cliente_nome_chiave(c.name) = public.cliente_nome_chiave(old.name));
begin
  if omonimo or vecchio = '' then vecchio := chr(1); end if;  -- nessuna riga ha questo nome

  if tg_op = 'UPDATE' then
    if new.deleted_at is not null and old.deleted_at is null then
      update public.incomes set deleted_at = new.deleted_at
        where owner_id = old.owner_id and deleted_at is null
          and (client_id = old.id or (client_id is null and public.cliente_nome_chiave(client_name) = vecchio));
      update public.opportunities set deleted_at = new.deleted_at
        where owner_id = old.owner_id and deleted_at is null
          and (client_id = old.id or (client_id is null and public.cliente_nome_chiave(client_name) = vecchio));
      update public.cantiere_foto set deleted_at = new.deleted_at
        where client_id = old.id and deleted_at is null;
      update public.cantiere_appunti set deleted_at = new.deleted_at
        where client_id = old.id and deleted_at is null;
    elsif new.deleted_at is null and old.deleted_at is not null then
      update public.incomes set deleted_at = null
        where owner_id = old.owner_id and deleted_at = old.deleted_at
          and (client_id = old.id or (client_id is null and public.cliente_nome_chiave(client_name) = vecchio));
      update public.opportunities set deleted_at = null
        where owner_id = old.owner_id and deleted_at = old.deleted_at
          and (client_id = old.id or (client_id is null and public.cliente_nome_chiave(client_name) = vecchio));
      update public.cantiere_foto set deleted_at = null
        where client_id = old.id and deleted_at = old.deleted_at;
      update public.cantiere_appunti set deleted_at = null
        where client_id = old.id and deleted_at = old.deleted_at;
    end if;
    if public.cliente_nome_chiave(new.name) <> public.cliente_nome_chiave(old.name) then
      update public.incomes set client_name = new.name
        where owner_id = old.owner_id
          and (client_id = old.id or (client_id is null and public.cliente_nome_chiave(client_name) = vecchio));
      update public.opportunities set client_name = new.name
        where owner_id = old.owner_id
          and (client_id = old.id or (client_id is null and public.cliente_nome_chiave(client_name) = vecchio));
    end if;
    return new;
  end if;

  -- DELETE (prima che il database stacchi le righe collegate dal cliente)
  if old.deleted_at is not null then
    delete from public.incomes
      where owner_id = old.owner_id and deleted_at = old.deleted_at
        and (client_id = old.id or (client_id is null and public.cliente_nome_chiave(client_name) = vecchio));
    delete from public.opportunities
      where owner_id = old.owner_id and deleted_at = old.deleted_at
        and (client_id = old.id or (client_id is null and public.cliente_nome_chiave(client_name) = vecchio));
    delete from public.cantiere_appunti
      where client_id = old.id and deleted_at = old.deleted_at;
  end if;
  return old;
end $$;

-- Le righe che ci sono già: collegate al cliente, se il nome è di uno solo.
-- (Quelle nel cestino insieme al loro cliente: collegate a quel cliente.)
update public.incomes i set client_id = public.cliente_da_nome(i.owner_id, i.client_name)
  where i.client_id is null and i.deleted_at is null;
update public.opportunities o set client_id = public.cliente_da_nome(o.owner_id, o.client_name)
  where o.client_id is null and o.deleted_at is null;
update public.incomes i set client_id = (
    select c.id from public.clients c
    where c.owner_id = i.owner_id and c.deleted_at = i.deleted_at
      and public.cliente_nome_chiave(c.name) = public.cliente_nome_chiave(i.client_name)
    limit 1)
  where i.client_id is null and i.deleted_at is not null;
update public.opportunities o set client_id = (
    select c.id from public.clients c
    where c.owner_id = o.owner_id and c.deleted_at = o.deleted_at
      and public.cliente_nome_chiave(c.name) = public.cliente_nome_chiave(o.client_name)
    limit 1)
  where o.client_id is null and o.deleted_at is not null;
