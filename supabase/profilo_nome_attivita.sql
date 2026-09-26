-- Registrazione (25/09/2026): il profilo nasce con anche il nome
-- dell'attività, preso dai dati dati alla registrazione. Serve quando la
-- conferma email è attiva: in quel caso l'app non ha ancora una sessione
-- per aggiornare il profilo dopo la registrazione.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, business_name, profession)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Nuovo utente'),
    nullif(new.raw_user_meta_data->>'business_name', ''),
    coalesce(new.raw_user_meta_data->>'profession', 'artigiano')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
