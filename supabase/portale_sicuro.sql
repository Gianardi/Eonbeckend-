-- Pagina cliente sicura — passo 1 di 2 (25/09/2026), solo aggiunte.
--
-- Il problema: la pagina del cliente (cliente.html) leggeva conversazioni,
-- messaggi, scheda cliente e profilo con policy aperte a chiunque abbia la
-- chiave pubblica ("access_code IS NOT NULL", "profiles: true"). Siccome
-- OGNI conversazione ha un codice, chiunque poteva leggere le chat, i
-- clienti e i profili di TUTTI gli utenti, non solo la propria.
--
-- La soluzione: la pagina cliente non legge più le tabelle. Chiama queste
-- tre funzioni passando il codice del link; le funzioni trovano SOLO la
-- conversazione con quel codice e restituiscono SOLO i suoi dati.
-- Il passo 2 (portale_chiudi_accessi.sql) toglie le policy aperte: si
-- applica DOPO che la nuova cliente.html è online.

create or replace function public.portale_conversazione(p_codice text)
returns public.conversations
language sql stable security definer set search_path = public as $$
  select * from conversations
  where p_codice is not null and length(p_codice) >= 16
    and access_code = p_codice and deleted_at is null
  limit 1
$$;
revoke all on function public.portale_conversazione(text) from public, anon, authenticated;

-- Apre la pagina: conversazione (solo id e nome), professionista, scheda del lavoro.
create or replace function public.portale_apri(p_codice text)
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  c conversations;
  pro json;
  cli json;
begin
  c := portale_conversazione(p_codice);
  if c.id is null then return null; end if;
  select json_build_object('full_name', full_name, 'business_name', business_name, 'profession', profession)
    into pro from profiles where id = c.owner_id;
  select json_build_object('name', name, 'description', description, 'status', status)
    into cli from clients
    where owner_id = c.owner_id and deleted_at is null
      and lower(trim(name)) = lower(trim(c.contact_name))
    limit 1;
  return json_build_object(
    'conversazione', json_build_object('id', c.id, 'contact_name', c.contact_name),
    'professionista', pro,
    'cliente', cli
  );
end $$;

-- I messaggi di quella conversazione (solo i campi che la pagina mostra).
create or replace function public.portale_messaggi(p_codice text)
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  c conversations;
begin
  c := portale_conversazione(p_codice);
  if c.id is null then return null; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', m.id, 'sender', m.sender, 'event_type', m.event_type, 'title', m.title, 'body', m.body,
      'amount', m.amount, 'created_at', m.created_at, 'file_url', m.file_url, 'file_name', m.file_name, 'file_type', m.file_type
    ) order by m.created_at)
    from messages m where m.conversation_id = c.id and m.deleted_at is null
  ), '[]'::json);
end $$;

-- Il cliente scrive (testo, file o vocale): sempre come "them", sempre nella sua conversazione.
create or replace function public.portale_scrivi(p_codice text, p_body text, p_file_url text default null, p_file_name text default null, p_file_type text default null)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  c conversations;
  nuovo messages;
begin
  c := portale_conversazione(p_codice);
  if c.id is null then raise exception 'link non valido'; end if;
  if coalesce(length(trim(p_body)), 0) = 0 and p_file_url is null then raise exception 'messaggio vuoto'; end if;
  if length(coalesce(p_body, '')) > 5000 then raise exception 'messaggio troppo lungo'; end if;
  -- Un allegato può essere solo un file caricato nella cartella di questa conversazione
  if p_file_url is not null and position('/storage/v1/object/public/eon-files/clienti/' || c.id::text || '/' in p_file_url) = 0 then
    raise exception 'allegato non valido';
  end if;
  insert into messages (conversation_id, sender, body, file_url, file_name, file_type)
    values (c.id, 'them', coalesce(p_body, ''), p_file_url, left(p_file_name, 200), left(p_file_type, 100))
    returning * into nuovo;
  return json_build_object('id', nuovo.id, 'sender', nuovo.sender, 'body', nuovo.body, 'created_at', nuovo.created_at,
    'file_url', nuovo.file_url, 'file_name', nuovo.file_name, 'file_type', nuovo.file_type);
end $$;

-- Per la policy dello storage (passo 2): la cartella clienti/<id> esiste ed è una conversazione con link.
create or replace function public.portale_cartella_valida(p_nome text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations
    where (storage.foldername(p_nome))[1] = 'clienti'
      and id::text = (storage.foldername(p_nome))[2]
      and access_code is not null and deleted_at is null
  )
$$;

grant execute on function public.portale_apri(text) to anon, authenticated;
grant execute on function public.portale_messaggi(text) to anon, authenticated;
grant execute on function public.portale_scrivi(text, text, text, text, text) to anon, authenticated;
grant execute on function public.portale_cartella_valida(text) to anon, authenticated;
