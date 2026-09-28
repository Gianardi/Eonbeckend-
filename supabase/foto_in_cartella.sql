-- Foto nelle cartelle (28/09/2026, Andrea: "aggiungi in Lavori con
-- assicurazioni queste foto"): una foto può stare in una cartella, come
-- gli appunti. Solo un'aggiunta: la foto resta anche senza cartella.
alter table public.cantiere_foto
  add column if not exists cartella_id uuid references public.cartelle(id) on delete set null;
create index if not exists cantiere_foto_cartella_idx on public.cantiere_foto (cartella_id) where cartella_id is not null;
