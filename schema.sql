-- ============================================================
-- EON — Schema del database (Postgres / Supabase)
-- ============================================================
-- Come si usa:
-- 1. Crea un progetto su https://supabase.com (gratis)
-- 2. Vai su "SQL Editor" nel pannello
-- 3. Incolla tutto questo file e premi "Run"
-- 4. Fatto: tabelle, sicurezza e permessi sono già a posto
-- ============================================================

-- Estensione per generare ID univoci
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILI: un record per ogni professionista iscritto
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  business_name text,
  profession text not null check (profession in ('artigiano','amministratore','avvocato','consulente')),
  created_at timestamptz default now()
);

-- ============================================================
-- CLIENTI
-- ============================================================
create table clients (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  status text not null check (status in ('attivo','trattativa','inattivo')),
  value numeric default 0,
  description text,
  last_contact text,
  color text,
  created_at timestamptz default now()
);

-- ============================================================
-- OPPORTUNITÀ / TRATTATIVE
-- ============================================================
create table opportunities (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  client_name text,
  value numeric default 0,
  probability text check (probability in ('Alta','Media','Bassa')),
  deadline date,
  stage text,
  created_at timestamptz default now()
);

-- ============================================================
-- DIPENDENTI / COLLABORATORI
-- ============================================================
create table employees (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  role text,
  color text,
  created_at timestamptz default now()
);

-- ============================================================
-- COMPITI DEL PROFESSIONISTA (Oggi / AI vs Tocca a te)
-- ============================================================
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  owner_type text not null check (owner_type in ('ai','user')),
  status text not null check (status in ('todo','progress','late','done')) default 'todo',
  time text,
  created_at timestamptz default now()
);

-- ============================================================
-- COMPITI ASSEGNATI AI DIPENDENTI
-- ============================================================
create table assigned_tasks (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  deadline date,
  employee_names text[],
  created_at timestamptz default now()
);

-- ============================================================
-- PAGAMENTI DA FARE (fornitori, rate, scadenze)
-- ============================================================
create table payments (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  supplier text not null,
  description text,
  amount numeric not null,
  due_date date,
  status text check (status in ('dapagare','pagato','ritardo')) default 'dapagare',
  created_at timestamptz default now()
);

-- ============================================================
-- ENTRATE (incassi previsti e ricevuti)
-- ============================================================
create table incomes (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  client_name text not null,
  description text,
  amount numeric not null,
  due_date date,
  status text check (status in ('attesa','incassato','scaduto')) default 'attesa',
  created_at timestamptz default now()
);

-- ============================================================
-- OBIETTIVI (lavorativi e personali)
-- ============================================================
create table goals (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  category text not null check (category in ('lavoro','personale')),
  done boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- CONVERSAZIONI (una per cliente o collaboratore)
-- ============================================================
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  contact_name text not null,
  is_client boolean default false,
  is_prospect boolean default false,
  is_archived boolean default false,
  to_see_today boolean default false,
  to_call_today boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- MESSAGGI dentro ogni conversazione
-- ============================================================
create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender text not null check (sender in ('me','them')),
  event_type text check (event_type in ('doc','appt','update')),
  title text,
  body text,
  amount numeric,
  created_at timestamptz default now()
);

-- ============================================================
-- FATTURE / PREVENTIVI / REGALI (documenti generati)
-- ============================================================
create table documents (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  doc_type text not null check (doc_type in ('fattura','preventivo','regalo')),
  client_name text,
  amount numeric,
  content jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- SICUREZZA: ognuno vede e modifica SOLO i propri dati
-- ============================================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table opportunities enable row level security;
alter table employees enable row level security;
alter table tasks enable row level security;
alter table assigned_tasks enable row level security;
alter table payments enable row level security;
alter table incomes enable row level security;
alter table goals enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table documents enable row level security;

-- Profilo: ognuno vede/modifica solo il proprio
create policy "profilo proprio" on profiles for all using (auth.uid() = id);

-- Tabelle con owner_id diretto: stessa regola per tutte
create policy "solo i miei clienti" on clients for all using (auth.uid() = owner_id);
create policy "solo le mie opportunità" on opportunities for all using (auth.uid() = owner_id);
create policy "solo i miei dipendenti" on employees for all using (auth.uid() = owner_id);
create policy "solo le mie attività" on tasks for all using (auth.uid() = owner_id);
create policy "solo i miei compiti assegnati" on assigned_tasks for all using (auth.uid() = owner_id);
create policy "solo i miei pagamenti" on payments for all using (auth.uid() = owner_id);
create policy "solo le mie entrate" on incomes for all using (auth.uid() = owner_id);
create policy "solo i miei obiettivi" on goals for all using (auth.uid() = owner_id);
create policy "solo le mie conversazioni" on conversations for all using (auth.uid() = owner_id);
create policy "solo i miei documenti" on documents for all using (auth.uid() = owner_id);

-- Messaggi: sicuri tramite la conversazione a cui appartengono
create policy "solo i messaggi delle mie conversazioni" on messages for all using (
  exists (
    select 1 from conversations
    where conversations.id = messages.conversation_id
    and conversations.owner_id = auth.uid()
  )
);

-- ============================================================
-- Quando un utente si registra, crea automaticamente il profilo
-- (professione e nome verranno aggiornati dall'app durante l'onboarding)
-- ============================================================
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, profession)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Nuovo utente'), 'artigiano');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
