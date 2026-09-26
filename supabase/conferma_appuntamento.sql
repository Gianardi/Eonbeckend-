-- La risposta del cliente conferma o toglie l'appuntamento (27/09/2026).
-- Solo aggiunte (una funzione e un trigger). Prima staging, poi produzione.
--
-- Andrea: "Di' a Rita che ci vediamo lunedì alle 11" → EON segna
-- l'appuntamento "(da confermare)" e scrive a Rita. Quando Rita risponde
-- dalla sua pagina (messaggio con sender = 'them'):
--   * sì / ok / va bene / perfetto / confermo / d'accordo → confermato
--     (il titolo perde "(da confermare)");
--   * no / non posso / non riesco / purtroppo / annulla / disdico → tolto
--     dal calendario, come "annulla appuntamento" (❌ … (annullato), senza
--     data), e la chat resta per fissarne un altro;
--   * qualsiasi altra cosa (es. "meglio giovedì") → non si tocca niente:
--     la legge il professionista.
-- Vale solo per l'ultimo appuntamento "(da confermare)" di quella chat.

create or replace function public.risposta_conferma_appuntamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t text := lower(trim(coalesce(new.body, '')));
  app record;
  dice_no boolean;
  dice_si boolean;
begin
  if new.sender is distinct from 'them' or new.event_type is not null or t = '' or length(t) > 300 then
    return new;
  end if;
  select id, title into app from public.messages
    where conversation_id = new.conversation_id and event_type = 'appt'
      and deleted_at is null and scheduled_at is not null
      and title like '% (da confermare)'
    order by created_at desc limit 1;
  if app.id is null then return new; end if;

  dice_no := t ~ '^(no\M|nope|non posso|non riesco|non ci sono|non va bene|non mi va bene|non vengo|impossibile|purtroppo|annull|disdic|meglio di no)'
          or t ~ '\m(non posso|non riesco|non ci sono|impossibile|annull\w*|disdic\w*)\M';
  dice_si := not dice_no and t ~ '^(s[iì]\M|si\M|ok\M|okay|okk|va bene|va benissimo|perfetto|confermo|confermato|d''accordo|daccordo|certo|certamente|benissimo|ottimo|a posto|ci sono|ci vediamo|👍|✅)';
  -- "sì ma meglio giovedì": non è un sì pulito, decide il professionista
  if dice_si and t ~ '\m(ma|però|pero|meglio|invece|sposta\w*|altro giorno|altra ora)\M' then dice_si := false; end if;
  -- "non posso, facciamo giovedì?": no a QUESTA data → si toglie; la nuova la fissate in chat

  if dice_si then
    update public.messages set title = left(app.title, length(app.title) - length(' (da confermare)'))
      where id = app.id;
  elsif dice_no then
    update public.messages
      set title = '❌ ' || left(app.title, length(app.title) - length(' (da confermare)')) || ' (annullato)',
          scheduled_at = null
      where id = app.id;
  end if;
  return new;
end $$;
revoke all on function public.risposta_conferma_appuntamento() from public, anon, authenticated;

drop trigger if exists messages_conferma_appuntamento on public.messages;
create trigger messages_conferma_appuntamento
  after insert on public.messages
  for each row execute function public.risposta_conferma_appuntamento();
