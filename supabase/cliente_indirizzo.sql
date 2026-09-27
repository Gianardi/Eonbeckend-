-- "Portami lì" (27/09/2026): l'indirizzo del cliente, per aprire il
-- percorso nelle Mappe. Solo aggiunta.
alter table public.clients add column if not exists address text;
