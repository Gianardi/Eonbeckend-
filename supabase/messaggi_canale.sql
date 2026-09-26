-- Centro messaggi (26/09/2026): da quale canale è passato ogni messaggio.
-- null = EON (tutti i messaggi di prima). 'whatsapp' / 'email' = scritto in
-- EON e mandato dal professionista con WhatsApp o con l'email del telefono.
-- Solo aggiunte: la versione online continua a funzionare.
alter table public.messages add column if not exists canale text;

-- La pagina del cliente mostra solo i messaggi EON: quelli mandati su
-- WhatsApp o per email il cliente li ha già lì, non vanno ripetuti.
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
    from messages m where m.conversation_id = c.id and m.deleted_at is null and coalesce(m.canale, 'eon') = 'eon'
  ), '[]'::json);
end $$;
