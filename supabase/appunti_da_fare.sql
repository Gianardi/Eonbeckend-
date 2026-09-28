-- Appunti "da fare" (28/09/2026, richiesta del tester via Andrea):
-- "ricordami di chiamare Pedro" senza giorno né ora va negli appunti, non in
-- calendario, come cosa da fare con la spunta (lista "Da fare" in Home).
-- Solo aggiunte, compatibili col codice di prima. Prima staging, poi produzione.
alter table public.cantiere_appunti add column if not exists da_fare boolean not null default false;
alter table public.cantiere_appunti add column if not exists fatto_il timestamptz;
