-- Scheda cliente (26/09/2026): email del cliente e appunti legati a un
-- cliente. Solo aggiunte: la versione online continua a funzionare.
alter table public.clients add column if not exists email text default '';
alter table public.cantiere_appunti add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists cantiere_appunti_client_idx on public.cantiere_appunti (client_id) where deleted_at is null;
