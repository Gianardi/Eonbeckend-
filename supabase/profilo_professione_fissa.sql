-- La professione è legata all'account (25/09/2026, Gianardi: "se un utente
-- si registra come edile, con le stesse credenziali non può accedere a
-- idraulico"). Scelta alla registrazione, poi non si cambia più dall'app:
-- solo il supporto (service_role) può correggerla.
-- Da applicare DOPO il merge del pacchetto che toglie "Cambia professione".

create or replace function public.blocca_cambio_professione()
returns trigger language plpgsql as $$
begin
  if old.profession is not null
     and new.profession is distinct from old.profession
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'La professione è legata all''account e non si può cambiare';
  end if;
  return new;
end $$;

drop trigger if exists profilo_professione_fissa on public.profiles;
create trigger profilo_professione_fissa
  before update on public.profiles
  for each row execute function public.blocca_cambio_professione();
