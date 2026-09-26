-- Meno AI, fase 1 — passo 0 "misurare" (26/09/2026): per ogni richiesta
-- i token veri, il costo stimato in dollari e il tipo di richiesta
-- (intento dichiarato dall'AI). Solo aggiunte: la versione online continua
-- a funzionare.
alter table public.ai_request_log add column if not exists token_input integer;
alter table public.ai_request_log add column if not exists token_output integer;
alter table public.ai_request_log add column if not exists token_cache_scritti integer;
alter table public.ai_request_log add column if not exists token_cache_letti integer;
alter table public.ai_request_log add column if not exists costo_usd numeric(10,5);
alter table public.ai_request_log add column if not exists intento text;
