-- Risposte del cliente mai perse (27/09/2026). Ogni conversazione ricorda
-- l'ultimo messaggio già letto da EON (analisi della chat): così, quando
-- l'app si riapre, EON legge le risposte arrivate mentre era chiusa, e mai
-- due volte la stessa (due telefoni aperti, o tempo reale + ripresa).
-- Solo aggiunte: si può applicare prima del codice nuovo. Nessun valore di
-- partenza: una chat mai vista dal recupero viene solo "segnata" dal server
-- la prima volta, senza rileggere niente del passato.
alter table public.conversations add column if not exists ultimo_analizzato uuid;

-- Chat come WhatsApp (27/09/2026): quando il cliente scrive, il server legge
-- subito il messaggio (portale_analizza) e scrive qui cosa ne ha fatto
-- ({messaggio_id, azioni, richiesta_decisione, ...}): l'app lo mostra quando
-- si apre, anche se in quel momento era chiusa.
alter table public.conversations add column if not exists ultimo_esito jsonb;
