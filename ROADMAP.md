# EON — Roadmap completa

Aggiornata al 25/09/2026. Un solo posto con tutto quello che resta da fare,
in ordine. Il dettaglio tecnico di ogni punto è in `TODO.md`.

Legenda: **[Andrea]** serve una tua decisione o un tuo account ·
**[Claude]** lo faccio io · **[insieme]** servono tutti e due.

---

## 0. Domani mattina — pubblicare il pacchetto

1. **[Andrea]** Merge del pacchetto unico (PR #97).
2. **[Claude]** Controllo che la pubblicazione su Vercel sia andata.
3. **[Claude]** Chiudo i vecchi accessi della pagina cliente
   (`supabase/portale_chiudi_accessi.sql`) e blocco il cambio di
   professione (`supabase/profilo_professione_fissa.sql`).
4. **[Andrea]** 5 minuti di prova sul telefono: Esci e rientra, scorri tra
   le pagine, foto in Appunti, "cosa ho da fare domani?", Impostazioni.

---

## 1. Obbligatori prima di vendere

| Cosa | Chi | Note |
|---|---|---|
| **Vercel Pro** (~20 $/mese) | [Andrea] | Il piano gratuito vieta l'uso commerciale e ha il limite di pubblicazioni che ci ha bloccato il 25/09. |
| **Supabase Pro** (~25 $/mese) | [Andrea] | Backup giornalieri, nessuna pausa del progetto. |
| **Servizio email vero** (es. Resend) | [insieme] | Oggi Supabase manda email solo a noi del team. Poi: email in italiano e **conferma email obbligatoria** accesa. |
| **Privacy, termini, consenso GDPR** | [insieme] | Mi servono ragione sociale, P.IVA, sede, email. Io preparo testi e casella "accetto"; li fai controllare a legale/commercialista. |
| **Dominio tuo** (es. eon.it) | [insieme] | Tu lo compri (~10–20 €/anno), io lo collego al posto di eonbeckend.vercel.app. |
| **Avviso automatico degli errori** | [Claude] | Se qualcosa si rompe a un cliente lo so subito. |
| **Compressione delle foto** (subito dopo il merge) | [Claude] | Come WhatsApp: da ~3 MB a ~300 KB per foto, a occhio uguali (lato lungo ~2000 px). Le foto di documenti da leggere (fatture, DURC) restano più nitide. Spazio ~10 volte meno, caricamento più veloce in cantiere. |
| **Pannello di controllo di EON** | [Claude] | Per gestire 100–1000 clienti dal telefono e dal PC: utenti, chi paga, errori, costo AI, feedback arrivati. |
| **Staging uguale a produzione** | [Claude] | Oggi lo schema di prova è diverso (niente cascata sul profilo, niente creazione automatica del profilo). |
| **Scollegare il progetto Vercel doppio** (eonbeckend-mx2t) | [Andrea] | L'app usa solo "eonbeckend"; il doppione raddoppiava le pubblicazioni. |

---

## 2. Per incassare

- **[insieme] Abbonamento con Stripe**: prova gratuita, piano mensile/annuale,
  fattura automatica, blocco se non si paga. Il prezzo lo decidi tu.
- **[Claude] Costo AI per cliente**: misurato dai registri, per fare il
  prezzo giusto.
- **[Andrea] Piano Free "Organizza la giornata"** con pubblicità
  personalizzata (deciso il 17/09): da progettare quando si apre al
  pubblico generico.

---

**Quando i clienti crescono (100+ paganti)**: una persona tecnica di
fiducia reperibile per le emergenze, commercialista e legale per contratti
e fatture; backup con ripristino a qualsiasi minuto (Supabase).

## 3. Una "vera app" sul telefono

- **[Claude] Installabile** dal browser ("Aggiungi a Home") con icona e
  schermata di avvio.
- **[insieme] App Store e Google Play** (dopo): servono gli account
  sviluppatore (Apple 99 $/anno, Google 25 $ una volta).
- **[Claude] Versione da computer**: oggi l'app è pensata solo per il
  telefono (colonna stretta su schermo largo).
- **[Claude] Accesso con Face ID senza password** (passkey, 1-2 giorni): oggi
  Face ID compila email e password salvate nel portachiavi dell'iPhone.
- **[Claude] Avvisi all'ora giusta**: promemoria che suonano anche ad app
  chiusa ("tra 15 minuti chiama Rossi").

---

## 4. Funzioni del prodotto

**Documenti e soldi**
- **Fattura elettronica (SdI)** — per molti artigiani indispensabile
  (discusso il 24/09, serve un intermediario accreditato).
- **PDF allegato in automatico** quando mandi preventivo/fattura su
  WhatsApp o Email.
- **Lettera e Cartello fine lavori** migliorati, con lo stesso formato di
  fatture e preventivi. (Non vanno tolti.)
- **Documenti impresa**: EON legge da solo la scadenza (es. DURC) e ricorda
  il rinnovo 30 giorni prima.

**Menu**
- **La tua azienda → cruscotto**: entrate, uscite, tasse, quanto resta.
- **Chiamate → rubrica**: tutti i clienti col telefono, un tocco e chiami.
- **Cresci**: oggi "Lavori in corso", da decidere cosa diventa.

**Messaggi = Communication Hub**
- Messaggi diventa il punto unico: EON, **WhatsApp** ed **email** arrivano
  nella chat del cliente giusto. Progetto grande, a sé.

**Voce**
- Voce umana di EON (non robotica) e trascrizione di registrazioni e
  telefonate (programma OpenAI, già in parte configurato).

**Servizi esterni** (servono fornitore e costo)
- Meteo per i cantieri · Mappe e traffico tra cantieri.

**Da controllare**
- Fuso orario delle date calcolate dal server (il server lavora in UTC).

**Grafica**
- Una sessione dedicata alla grafica di tutta l'app.

---

## 5. Il cervello di EON (EON Brain)

- Livelli di rischio a 4 valori per le azioni (lettura, scrittura
  leggera, importante, esterna).
- Un codice per ogni richiesta che colleghi tutto quello che EON ha fatto
  ("perché EON ha fatto questa cosa?").
- Memoria di contesto più lunga dei 90 secondi di oggi.
- Suite di valutazione automatica (il "libro" dei professionisti).
- Risposta ancora più veloce (un solo giro con l'AI invece di due).
- Ragionamento più accurato solo sui casi difficili (date, calcoli).
- EON impara dalle risposte tecniche già date (più utenti, meno ricerche).
- Abitudini nel tempo ("ogni lunedì chiami Rossi") — quando ci sarà uso
  reale.

---

## 6. Mercato

- **[Andrea] 3–5 artigiani veri per 2 settimane**: la cosa che vale di più.
- Raccogliere i loro feedback (c'è già "Manda un feedback") e sistemare.
- Decidere il prezzo con i dati veri di uso e di costo.

---

## Fatto il 25/09/2026 (nel pacchetto #97 o già online)

Un cliente = una chat · Messaggi nel Menu · pulizia dati · Cresci in
sospeso · scorri per eliminare · note e descrizione sulle foto · foto negli
Appunti · Calendario rifatto · risposte di EON nella card · scorrere tra le
pagine · Menu pulito · Impostazioni a card (Account, Profilo, Sicurezza,
Aiuto, Esci, Elimina) · registrazione da app vera (account vuoto,
benvenuto, password dimenticata, conferma email pronta, elimina account) ·
una professione per account · **falla di sicurezza della pagina cliente
chiusa** · Vercel pubblica solo la versione vera.
