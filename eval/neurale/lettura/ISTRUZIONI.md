# Frasi segnate per il modello che legge tutta la frase (passo A, 1/10/2026)

Scrivi frasi come le detterebbe al telefono un artigiano italiano a EON, la sua
assistente (voce trascritta o scritto di fretta). Ogni frase ha:
1. il **cassetto** (cosa chiede);
2. i **pezzi** segnati così: `[parole]{RUOLO}`.

## Formato del file (JSON)
```
{ "personaggio": "…chi sei, come parli…",
  "frasi": [
    ["manda a [Rossi]{CHI} il [preventivo]{DOC} del [bagno]{LAV} su [whatsapp]{CAN}", "invio_documento"],
    …
  ] }
```

## I ruoli (segna SOLO questi; tutto il resto resta senza segno)
- **CHI** — la persona, ditta o condominio nominato: `[Rossi]{CHI}`, `[la signora Bianchi]{CHI}`,
  `[Condominio Le Rose]{CHI}`, `[il geometra Fumagalli]{CHI}`, `[mia moglie]{CHI}`. Senza "a/da/con" davanti.
- **GIO** — il giorno: `[domani]{GIO}`, `[giovedì]{GIO}`, `[il 15 ottobre]{GIO}`, `[la settimana prossima]{GIO}`, `[fra tre giorni]{GIO}`.
- **ORA** — l'ora o la fascia: `[alle 9]{ORA}`, `[alle nove e mezza]{ORA}`, `[nel pomeriggio]{ORA}`, `[verso le 3]{ORA}`.
- **NGIO / NORA** — il NUOVO giorno / la NUOVA ora quando si sposta qualcosa:
  "sposta il [sopralluogo]{LAV} di [domani]{GIO} a [venerdì]{NGIO} [alle 10]{NORA}".
- **LAV** — il lavoro o il tipo di impegno: `[rifacimento bagno]{LAV}`, `[sopralluogo]{LAV}`, `[la caldaia]{LAV}`.
- **TESTO** — cosa scrivere nel messaggio o cosa ricordare/annotare:
  "scrivi a [Rita]{CHI} [che arrivo alle 10]{TESTO}"; "segnati [che il Bianchi vuole le piastrelle grigie]{TESTO}".
- **CAN** — il canale: `[whatsapp]{CAN}`, `[per mail]{CAN}`, `[sms]{CAN}`.
- **DOC** — il documento o la cosa nominata: `[preventivo]{DOC}`, `[fattura]{DOC}`, `[DURC]{DOC}`, `[DiCo]{DOC}`, `[SAL]{DOC}`, `[foto]{DOC}`, `[visura]{DOC}`.
- **NUM** — il numero del documento: "la fattura [7]{NUM}".
- **TEL / MAIL / IND** — telefono, email, indirizzo detti: `[333 1234567]{TEL}`, `[via Roma 12]{IND}`.
- **AVANZ** — la percentuale dei lavori (SAL): "siamo al [60 per cento]{AVANZ}".
- **CART** — il nome di una cartella: "metti nella cartella [Fornitori]{CART}".
- I SOLDI (importi, quantità, prezzi, sconti, acconti) NON si segnano: li legge un altro modello.

## I cassetti
calendario (impegni e promemoria, anche "ricordami di…") · calendario_modifica (spostare/annullare un impegno) ·
mente (appunto da ricordare, senza data) · documento (fare preventivo o fattura) · cerca_documento (trovare/aprire
un documento o foto) · invio_documento (mandare un documento o foto a qualcuno) · messaggio · email · chiamata ·
cliente (nuovo cliente / dati del cliente) · dati (domanda sui tuoi dati: soldi, agenda, numeri, indirizzi…) ·
domanda (domanda generale, consiglio) · incasso (qualcuno ha pagato) · foto (scattare) · cartella · urgenza ·
sal · dico · assemblea · saluto · **accettato** (un cliente ha accettato un preventivo) · **sollecito** (sollecitare un pagamento) ·
**app** (andare in una sezione dell'app o in un'impostazione: "metti EON sulla home", "cambia la password").

## L'argomento delle domande sui dati (2/10/2026)
Per il cassetto **dati** scrivi anche l'argomento, dopo i due punti: `"dati:incassi"`.
agenda (impegni, quando vado da…, sono libero?) · incassi (quanto ho incassato/fatturato, X ha pagato?) ·
crediti (chi/quanto mi deve, fatture non pagate) · documenti (preventivi e fatture: accettato?, quanti, quant'era) ·
telefono · email · indirizzo · ultima_visita (quando sono stato l'ultima volta da…) · note_cliente (cosa mi ero
segnato su…) · iva · cantieri (lavori in corso, a che punto è, quanti impianti ho fatto) · clienti (quanti clienti,
X è tra i clienti?) · urgenze (urgenze aperte) · assemblea (quand'è l'assemblea di…) · spese (quanto ho speso) ·
scadenze (DURC, assicurazione, revisione) · altro (tutto il resto: IBAN, fondo cassa, codice fiscale…).

## La sezione dell'app (3/10/2026)
Per il cassetto **app** scrivi anche la sezione, dopo i due punti: `"app:installa"`. Senza ruoli.
home · oggi · clienti · calendario · messaggi · chiamate · cestino · menu · obiettivi · compiti (squadra) ·
documenti_impresa (DURC, visura, assicurazione della ditta) · documenti · carta_intestata · lettere · cartello ·
mente (appunti) · foto · cantieri · impostazioni · fatture_preventivi · conti · uscite · entrate · assemblee ·
urgenze · dico · installa (EON sulla schermata Home) · migliora (aiutare EON a crescere, registro delle frasi) ·
privacy · promemoria (notifiche, quanto prima avvisare) · faceid · password · email_account · profilo (nome
dell'attività, mestiere) · aiuto · elimina_account · esci · abbonamento · feedback (suggerimenti, segnalazioni) ·
importa_clienti. Confini: "mostrami le foto di Galli" è cerca_documento; "ho delle spese?" è dati:spese;
"promemoria domani alle 8…" è calendario.

## Regole
- Parla come il tuo personaggio: frasi corte e lunghe, errori di dettatura, dialetto leggero, niente punteggiatura a volte.
- Nomi, ditte, vie, lavori **sempre diversi**: inventali, niente nomi famosi, niente dati veri.
- Distribuisci le frasi su TUTTI i cassetti; più frasi per quelli con tanti pezzi
  (calendario, calendario_modifica, messaggio, invio_documento, documento, dati).
- Metti anche frasi difficili: due persone nominate, l'ora prima del giorno, "no anzi", parole in mezzo,
  frasi dove una parola sembra un nome ma è un lavoro ("la Bosch" caldaia).
- Le parentesi quadre devono coprire parole intere della frase, senza accavallarsi.
