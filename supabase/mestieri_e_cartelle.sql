-- Mestieri e "Altra attività" (28/09/2026). Solo aggiunte, compatibili col
-- codice di prima. Prima staging, poi produzione.

-- 1. "elettricista" tra i mestieri accettati: dal 27/09 l'app lo propone al
--    posto di Avvocato, ma il vincolo lo rifiutava e l'iscrizione falliva
--    ("Database error saving new user"). I vecchi valori restano validi.
alter table public.profiles drop constraint if exists profiles_profession_check;
alter table public.profiles add constraint profiles_profession_check
  check (profession = any (array['artigiano','amministratore','avvocato','consulente','edile','idraulico','elettricista']));

-- 2. Le risposte del mini questionario di "Altra attività" (che attività,
--    come lavora, quante persone): servono a proporre le cartelle giuste.
alter table public.profiles add column if not exists attivita_tipo text;
alter table public.profiles add column if not exists attivita_modo text;
alter table public.profiles add column if not exists attivita_persone text;

-- Il profilo nasce dall'iscrizione con anche le risposte (solo dove il
-- trigger esiste già: su staging il profilo lo crea l'app).
do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal and tgfoid = to_regproc('public.handle_new_user')) then
    execute $f$
      create or replace function public.handle_new_user()
      returns trigger language plpgsql security definer set search_path to 'public' as $b$
      begin
        insert into public.profiles (id, full_name, business_name, profession, attivita_tipo, attivita_modo, attivita_persone)
        values (
          new.id,
          coalesce(new.raw_user_meta_data->>'full_name', 'Nuovo utente'),
          nullif(new.raw_user_meta_data->>'business_name', ''),
          coalesce(new.raw_user_meta_data->>'profession', 'artigiano'),
          nullif(new.raw_user_meta_data->>'attivita_tipo', ''),
          nullif(new.raw_user_meta_data->>'attivita_modo', ''),
          nullif(new.raw_user_meta_data->>'attivita_persone', '')
        )
        on conflict (id) do nothing;
        return new;
      end;
      $b$;
    $f$;
  end if;
end $$;

-- 3. Cartelle (per "Altra attività"): raccoglitori con un nome, proposti dal
--    questionario e rinominabili; dentro ci sono gli appunti.
create table if not exists public.cartelle (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  icona text,
  ordine int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists cartelle_owner_idx on public.cartelle (owner_id, ordine);
alter table public.cartelle enable row level security;
drop policy if exists cartelle_all_own on public.cartelle;
create policy cartelle_all_own on public.cartelle for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

alter table public.cantiere_appunti add column if not exists cartella_id uuid references public.cartelle(id) on delete set null;
