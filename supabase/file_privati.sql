-- Spazio file privato (27/09/2026). Da applicare SOLO DOPO che il codice
-- nuovo (file-privati.js, firma_file, portale_firma_file) è online: da quel
-- momento app e pagina del cliente aprono i file con link a scadenza chiesti
-- al server, e l'indirizzo pubblico non serve più.
-- Solo produzione (staging non ha lo spazio file eon-files).
-- Per tornare indietro in caso di problemi: public = true.
update storage.buckets set public = false where id = 'eon-files';
