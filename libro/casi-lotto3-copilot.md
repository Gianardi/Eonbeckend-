# Casi plausibili per EON — Lotto 3 (casi 101-150)

Portato da Gianardi il 03/09/2026, stessa fonte/metodo dei lotti 1-2:
**costruiti, non osservati**, da validare con un edile vero. Le voci
genuinamente nuove sono state integrate in `libro/edile.md` (vedi
commit); conservato qui per intero come fonte.

---

## Sezione A — Frasi ambigue per un sistema (continua, 15 casi: A31-A45)

**A31 | WhatsApp**
"Metti tutto in fattura insieme" (riferito a due lavori fatti in momenti diversi)
→ Ambiguo se "insieme" significa stessa fattura o stessa data di emissione.

**A32 | Vocale**
"Digli che passiamo, boh, verso le 10 o le 11, dipende"
→ Range orario incerto reso come informazione da comunicare a terzi — un sistema che sceglie un orario secco (es. le 10) altera l'informazione originale.

**A33 | WhatsApp**
"Quello schema che ti ho mandato prima, usa quello"
→ "Prima" può riferirsi a minuti fa o a settimane fa; se ci sono più schemi inviati nel tempo, serve disambiguazione temporale.

**A34 | Email**
"Vi ringraziamo per la disponibilità e restiamo a disposizione"
→ Formula di chiusura che non implica nessuna azione, ma potrebbe essere scambiata per una richiesta di follow-up se il sistema cerca sempre un'azione in ogni messaggio.

**A35 | WhatsApp**
"Fermi tutti fino a nuovo ordine"
→ Comando forte e generico: "tutti" chi? Solo quel cantiere, tutti i cantieri, tutto il team? Il messaggio da solo non lo specifica.

**A36 | Vocale**
"Eh guarda, fai un po' come vuoi, tanto ti fidi"
→ Delega esplicita di decisione, nessuna azione concreta specificata — un sistema orientato all'azione rischia di non registrare nulla, perdendo il fatto che è stata data un'autorizzazione generale.

**A37 | WhatsApp**
"Manda la foto a chi sai tu"
→ Riferimento a un destinatario condiviso solo nella relazione tra i due interlocutori, non deducibile dal contesto scritto.

**A38 | Email**
Oggetto: "Rif. ns. prec." (nessun altro contesto nel corpo)
→ Riferimento a comunicazione precedente non allegata né citata per esteso — comune negli scambi rapidi tra persone che si conoscono, ma illeggibile per un sistema senza lo storico completo collegato.

**A39 | WhatsApp**
"Ah no aspetta, non quello, l'altro"
→ Correzione che nega esplicitamente la prima interpretazione senza fornire l'alternativa corretta nello stesso messaggio (arriva probabilmente nel messaggio successivo).

**A40 | Vocale**
"Di' al cliente che ci siamo quasi, tipo una settimana, boh, dieci giorni"
→ Range temporale volutamente vago comunicato con l'intenzione di gestire l'aspettativa del cliente — tradurlo in una data precisa tradisce l'intento del messaggio originale.

**A41 | WhatsApp**
"Segna 'da vedere' per ora"
→ Stato esplicitamente provvisorio/incerto: un sistema binario (fatto/non fatto) non ha una categoria per "in sospeso volontariamente".

**A42 | Email**
"Confermiamo quanto sopra" (in risposta a un'email con più paragrafi, di cui solo uno è una vera proposta)
→ "Quanto sopra" ambiguo su quale parte del messaggio precedente sia effettivamente confermata.

**A43 | WhatsApp**
"Vai tranquillo, tanto se c'è un problema te lo dico"
→ Autorizzazione condizionata al silenzio come conferma implicita — pattern comunicativo comune ma difficile da formalizzare come "approvazione".

**A44 | Vocale**
"Metti giù due date, una se piove una se non piove"
→ Pianificazione condizionale (if/else) espressa in linguaggio naturale — richiede che il sistema gestisca due scenari alternativi, non uno stato singolo.

**A45 | WhatsApp**
"Fatto anche l'altro, come l'ultima volta"
→ Doppio riferimento implicito: "l'altro" (quale elemento) e "l'ultima volta" (quale precedente) nella stessa frase breve.

---

## Sezione B — Ambiguità da omonimia o riferimenti sovrapposti (continua, 10 casi: B21-B30)

**B21**
Un cliente che si firma nei messaggi a volte con il nome, a volte con il nome dell'azienda, a volte con un soprannome noto solo al team — tre "identità testuali" per la stessa persona.

**B22**
Due preventivi diversi che condividono lo stesso importo totale (coincidenza) — un riferimento generico "quello da 8000" è ambiguo se non porta altri dettagli.

**B23**
Un fornitore che ha cambiato ragione sociale (fusione/acquisizione) ma viene ancora chiamato con il vecchio nome da tutto il team — mismatch tra nome usato colloquialmente e nome in anagrafica/fatture.

**B24**
Due cantieri dello stesso cliente in comuni diversi ma con lo stesso nome di via (comune in Italia) — "il cantiere in via Dante" ambiguo senza il comune.

**B25**
Un collaboratore che lavora part-time anche per un'altra impresa concorrente — i messaggi che lo riguardano potrebbero riferirsi a impegni non pertinenti al cantiere in questione, cosa che il team sa ma EON no.

**B26**
Due varianti di preventivo inviate lo stesso giorno per errore/velocità (una con IVA, una senza) — "il preventivo di oggi" ambiguo su quale delle due versioni sia quella valida.

**B27**
Un termine come "il capo" usato da persone diverse per riferirsi a persone diverse (il titolare dell'impresa per un dipendente, il capocantiere per un operaio) — gerarchia relativa al parlante, non assoluta.

**B28**
Due materiali con nome commerciale simile ma caratteristiche diverse (es. due tipi di malta con nomi che differiscono per una sigla) — errore di battitura o abbreviazione plausibile in un ordine rapido.

**B29**
Un cliente e il suo geometra di fiducia comunicano entrambi per conto dello stesso cantiere, a volte in disaccordo tra loro — EON riceve indicazioni potenzialmente contrastanti da due fonti "autorizzate".

**B30**
Uno stesso numero di telefono usato in tempi diversi da due persone diverse (es. subentro in un'attività, o cambio di responsabile su un cantiere) — la cronologia dei messaggi mescola due identità sotto lo stesso contatto.

---

## Sezione C — Errori temuti / rischi concreti (continua, 10 casi: C21-C30)

**C21**
Un messaggio con toni scherzosi tra colleghi (es. ironia su un cliente difficile) inoltrato per errore al cliente stesso — rischio reputazionale grave, tipico degli inoltri rapidi da mobile.

**C22**
Una nota interna su un problema di qualità di un fornitore, se trattata come informazione "pubblica" da EON, potrebbe finire citata in una comunicazione col cliente sbagliata per contesto.

**C23**
Un cliente chiede una modifica "senza costi aggiuntivi" in tono scherzoso/provocatorio durante una chiamata; se registrato letteralmente come richiesta accettata, genera un impegno economico non voluto.

**C24**
Coordinate GPS o posizione condivisa per errore (es. tramite WhatsApp) che rivela l'indirizzo di un cantiere riservato (es. abitazione privata di una persona nota) a un destinatario non autorizzato.

**C25**
Un preventivo con margine di guadagno visibile per errore di formattazione (es. colonna nascosta non nascosta bene in un export) inviato al cliente — rischio: il cliente vede il margine dell'impresa.

**C26**
Una richiesta di pagamento anticipato comunicata in modo generico ("serve un acconto") senza importo, poi il cliente versa una cifra a sua discrezione diversa da quella intesa — rischio: discrepanza contabile e imbarazzo nel richiedere la differenza.

**C27**
Un messaggio di scuse per un ritardo, se elaborato da un sistema che genera automaticamente promemoria di "impegni mancati", potrebbe trasformare una gentilezza comunicativa in un dato negativo formale nel profilo del fornitore/collaboratore.

**C28**
Una fotografia di un cantiere che include per errore persone non autorizzate a essere riprese (es. residenti della zona) — rischio privacy se condivisa o archiviata senza attenzione.

**C29**
Un cliente insiste per un colore/materiale sconsigliato dal tecnico ma firma comunque per procedere — se il dissenso tecnico non viene registrato esplicitamente da qualche parte, in caso di problema futuro manca la prova che l'impresa aveva avvisato.

**C30**
Due membri del team danno al cliente informazioni leggermente diverse sullo stesso argomento (es. tempistiche) in momenti diversi, senza saperlo — il cliente nota la discrepanza e la usa come leva in una trattativa.

---

## Sezione D — Terminologia e abbreviazioni di settore (continua, 8 casi: D17-D24)

**D17** — "Controsoffitto" vs "contropareti": termini distinti ma spesso usati in modo intercambiabile da chi non è specializzato in cartongesso.

**D18** — "Impresa edile" vs "ditta individuale" vs "studio tecnico": distinzioni di ruolo che nei messaggi informali vengono appiattite ("chiamo il tecnico" può riferirsi a ruoli molto diversi).

**D19** — Sigle di sicurezza cantiere (es. "POS", "PSC") menzionate senza spiegazione — facilmente confuse tra loro anche da chi lavora nel settore da anni ma non si occupa di sicurezza direttamente.

**D20** — "Collaudo" usato sia in senso tecnico specifico (es. collaudo impianto) sia genericamente per "verifica finale" — ambiguità di scope simile a D13.

**D21** — Unità di misura miste nello stesso messaggio (es. "un metro e mezzo di altezza, tipo 150" — ridondante ma con potenziale incoerenza se i due valori non corrispondono esattamente).

**D22** — "Preliminare" e "definitivo" riferiti a un progetto, termini con significato tecnico-legale preciso ma spesso usati in modo intercambiabile nel linguaggio parlato veloce.

**D23** — Nomi commerciali di prodotti usati come sinonimi generici del materiale stesso (fenomeno tipo "scotch" per nastro adesivo) — nel settore edile capita con alcuni marchi di vernici o adesivi molto diffusi.

**D24** — "Prima nota" (termine contabile) usato da alcuni titolari anche in senso lato per "elenco spese cantiere", non nel senso tecnico-contabile stretto.

---

## Sezione E — Assunzioni "da manuale" da verificare (continua, 8 casi: E16-E23)

**E16**
Ipotesi comune: le comunicazioni scritte hanno priorità su quelle verbali per importanza. Pattern più plausibile: spesso è vero il contrario — una chiamata o un vocale viene percepito come "più serio" di un messaggio scritto, che è visto come promemoria informale.

**E17**
Ipotesi comune: ogni impresa ha una netta separazione tra amministrazione e cantiere. Pattern più plausibile: in piccole imprese, la stessa persona (spesso il titolare) fa entrambe le cose, passando dal cantiere all'email di fatturazione nello stesso pomeriggio, con contesto mentale che cambia rapidamente e senza scrivania fissa.

**E18**
Ipotesi comune: i clienti aspettano risposte entro tempi standard (es. 24-48 ore) come in altri settori di servizi. Pattern più plausibile: l'aspettativa varia enormemente in base al tipo di cliente (privato vs azienda vs pubblica amministrazione) e non è mai stata definita esplicitamente da nessuna parte.

**E19**
Ipotesi comune: le richieste di modifica vengono sempre discusse prima di essere eseguite. Pattern più plausibile: in cantieri piccoli, spesso si esegue prima e si "regolarizza" (comunica, fattura) dopo, specie per modifiche minori.

**E20**
Ipotesi comune: ogni membro del team ha accesso alle stesse informazioni sui cantieri. Pattern più plausibile: le informazioni sono spesso frammentate — ognuno sa bene solo il proprio pezzo, e la ricomposizione avviene "a voce" quando serve, non attraverso un sistema condiviso.

**E21**
Ipotesi comune: i pagamenti vengono tracciati sistematicamente al momento della ricezione. Pattern più plausibile: specie per pagamenti in contanti o bonifici tra privati, la registrazione avviene spesso in un secondo momento, "a memoria", con margine di errore o dimenticanza.

**E22**
Ipotesi comune: la comunicazione con i fornitori segue un processo di richiesta-conferma-ordine standard. Pattern più plausibile: con fornitori abituali il processo si comprime in una telefonata di due minuti senza conferma scritta, basata sulla fiducia della relazione pregressa.

**E23**
Ipotesi comune: i problemi vengono segnalati appena si verificano. Pattern più plausibile: piccoli problemi vengono spesso "tenuti in tasca" per un po' (per non sembrare che si creano problemi) e comunicati solo quando si accumulano o diventano seri — pattern comportamentale, non solo comunicativo.

---

## Come usare questo file

Stesso formato dei lotti precedenti.
