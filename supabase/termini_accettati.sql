-- Accettazione di Termini d'uso e Informativa privacy (27/09/2026).
-- Solo aggiunte. Prima staging, poi produzione.
-- Si salva quando e quale versione il professionista ha accettato: alla
-- registrazione (casella obbligatoria) o, per chi c'era già, con la card
-- "Termini e privacy" al primo accesso. Nuova versione dei testi → l'app la
-- ripropone (TERMINI_VERSIONE in index.html).
alter table public.profiles add column if not exists termini_accettati_il timestamptz;
alter table public.profiles add column if not exists termini_versione text;
