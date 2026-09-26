-- Accesso con Face ID / impronta (passkey), 27/09/2026.
-- Solo aggiunte. Prima staging, poi produzione.
--
-- Ogni riga è una "chiave" creata dal telefono dell'utente: il telefono
-- tiene la parte segreta (protetta da Face ID), qui c'è solo la parte
-- pubblica, che serve al server per controllare la firma. Senza il telefono
-- e il volto dell'utente questa riga non serve a niente.
-- RLS attiva e nessuna policy: legge e scrive solo il server.
create table if not exists public.passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,     -- id della chiave (base64url)
  public_key text not null,               -- chiave pubblica SPKI (base64)
  alg int not null,                       -- -7 = ES256, -257 = RS256
  contatore bigint not null default 0,
  ultima_sfida text,                      -- contro il riuso della stessa firma
  dispositivo text,
  created_at timestamptz not null default now(),
  ultimo_uso timestamptz
);
create index if not exists passkeys_user_idx on public.passkeys (user_id);
alter table public.passkeys enable row level security;
