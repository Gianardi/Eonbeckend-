-- Pagina cliente sicura — passo 2 di 2 (25/09/2026).
-- Da applicare SOLO DOPO che la nuova cliente.html (che usa portale_apri /
-- portale_messaggi / portale_scrivi) è online: toglie le policy che
-- permettevano a chiunque di leggere chat, clienti e profili di tutti.

drop policy if exists "cliente apre con il codice" on public.conversations;
drop policy if exists "cliente legge i suoi messaggi" on public.messages;
drop policy if exists "cliente scrive nella sua conversazione" on public.messages;
drop policy if exists "cliente vede la sua scheda" on public.clients;
drop policy if exists "cliente vede il professionista" on public.profiles;

-- Storage: il bucket è pubblico, quindi i link dei file (getPublicUrl)
-- funzionano senza questa policy; la policy permetteva invece a chiunque
-- di ELENCARE tutti i file di tutti gli utenti.
drop policy if exists "lettura file eon" on storage.objects;

-- Il professionista carica solo nella sua cartella (<id utente>/...),
-- il cliente solo nella cartella della sua conversazione (clienti/<id>/...).
drop policy if exists "professionista carica file" on storage.objects;
create policy "professionista carica file" on storage.objects for insert to authenticated
  with check (bucket_id = 'eon-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "cliente carica file" on storage.objects;
create policy "cliente carica file" on storage.objects for insert to anon
  with check (bucket_id = 'eon-files' and public.portale_cartella_valida(name));
