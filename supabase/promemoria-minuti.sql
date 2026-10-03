-- Quanto prima avvisare (3/10/2026, tester n.2). Solo aggiunte.
-- Vuoto = 30 minuti (come prima). Il server lo legge con select=*, quindi
-- funziona anche prima che questa colonna esista.
alter table public.push_iscrizioni add column if not exists minuti_prima int
  check (minuti_prima is null or minuti_prima between 5 and 240);
