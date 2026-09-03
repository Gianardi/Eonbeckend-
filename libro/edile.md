# Professional Brain Pack — EDILE

Versione estesa (Claude, 03/09/2026), costruita da: la prima bozza,
il documento di metodo (`libro/professional-brain-pack-metodo.md`,
da una consulenza ChatGPT), conoscenza generale sul mestiere, e le
idee emerse discutendo con Gianardi una seconda consulenza (Copilot) —
tenute quelle di sostanza (modello cognitivo, ontologia con attributi,
modulo WhatsApp, modello di priorità, catalogo errori critici), non il
numero fisso di casi imposto da quel documento (vedi nota in fondo).

**Ancora una bozza**, non verità definitiva — da correggere con
l'esperienza reale di Gianardi e dei suoi colleghi prima di derivarne
casi per la Evaluation Suite (sezione L) o modifiche al prompt di EON.
Non entra nel prompt così com'è: solo le correzioni vere, trovate
testando, ci entrano, in poche righe mirate (vedi il metodo).

## A. Identità professionale

Piccola impresa edile o artigiano (muratore, capomastro), spesso con
1-5 persone. Passa la maggior parte della giornata **fuori
dall'ufficio**, sui cantieri — non alla scrivania. Usa il telefono più
della tastiera: detta a voce, scrive messaggi brevi, spesso con
errori/abbreviazioni perché ha le mani sporche o poco tempo. I clienti
sono in gran parte privati (famiglie che ristrutturano casa), a volte
imprese o amministratori di condominio per lavori più grossi.

## B. Giornata e contesto

Mattina su un cantiere (o più di uno, con spostamenti), sopralluoghi da
nuovi clienti, telefonate per organizzare consegne di materiale,
momenti rubati per la burocrazia (preventivi, fatture, permessi) di
solito alla sera o in pausa pranzo. Interruzioni continue: un cliente
che chiama, un fornitore in ritardo, un imprevisto in cantiere. Rumore
di fondo frequente (trapano, betoniera) quando detta a voce.

## Modello cognitivo dell'edile

Non solo cosa dice, ma come organizza mentalmente il proprio lavoro —
utile per capire COME interpretare le sue richieste, non solo COSA
contengono.

- **Organizza per cantiere/cliente, non per data**: la sua unità
  mentale è "il lavoro di Rossi", non "il 15 settembre" — il calendario
  è una conseguenza, non il punto di partenza. Un riferimento vago come
  "il lavoro di Rossi" va quindi risolto prima per cliente/cantiere, e
  solo dopo eventualmente per tempo.
- **Ricorda i clienti per luogo/lavoro, non per anagrafica**: "quello
  del bagno in via Garibaldi" è spesso più naturale di un nome e
  cognome completi — il nome esatto può non essere la prima cosa che
  gli viene in mente.
- **Usa le fotografie come memoria esterna**: non solo documentazione
  per il cliente, ma il modo con cui l'edile stesso ricorda "a che
  punto eravamo" — una richiesta di foto è spesso una richiesta di
  memoria, non di documentazione formale.
- **Usa WhatsApp come strumento operativo primario**: molte decisioni e
  informazioni (misure, richieste del cliente, foto) passano da lì
  prima che da qualsiasi altro sistema — EON oggi non ci accede
  (Communication Hub, ancora da fare), ma il Pack deve tenerne conto
  quando l'utente fa riferimento a "quello che ho scritto su WhatsApp".
- **Decide in fretta, con poche informazioni**: sul cantiere non ha
  tempo per analisi lunghe — si aspetta che anche EON sia rapido e
  diretto, non che faccia tante domande.
- **Valuta l'urgenza dal contesto, non dal tono**: dice "urgente" per
  abitudine più spesso di quanto intenda davvero un'emergenza — la
  vera urgenza si riconosce da segnali concreti (un cliente che aspetta
  da giorni, un lavoro fermo, materiale mancante), non dalla parola
  usata.
- **Distingue rumore da problema reale**: un imprevisto quotidiano
  (piove, un operaio è in ritardo) è normale amministrazione, non
  richiede necessariamente un'azione formale — solo se l'utente lo
  chiede esplicitamente.

## C. Mondo professionale

- **Clienti**: privati (la maggioranza), imprese, amministratori di
  condominio. Spesso più clienti con lo stesso cognome in paesi piccoli.
- **Cantieri/lavori**: il luogo fisico e il progetto in corso — un
  cliente può avere più cantieri nel tempo, raramente più di uno attivo
  insieme.
- **Luoghi**: il cantiere stesso, l'ufficio/casa (per la burocrazia), i
  fornitori (ferramenta, rivenditore materiali).
- **Persone**: il cliente, eventuali collaboratori/dipendenti/
  subappaltatori, i fornitori (non sono clienti, non vanno mai confusi
  con loro).
- **Documenti**: preventivi, capitolati, planimetrie, permessi
  (SCIA/CILA), fatture.
- **Pagamenti**: acconti, SAL (pagamenti legati all'avanzamento), saldo
  finale.

## D. Ontologia del dominio

Per ogni entità: definizione, attributi chiave, relazioni principali,
ciclo di vita, ambiguità comune da tenere presente.

**Cliente** — persona o azienda per cui si lavora. *Attributi*: nome,
zona/indirizzo, telefono, tipo (privato/impresa/condominio). *Relazioni*:
ha uno o più Cantieri; ha un Referente se non è lui il contatto diretto.
*Ciclo di vita*: nasce al primo contatto, resta anche a lavori finiti
(storico, futuri lavori). *Ambiguità*: omonimi frequenti in paesi
piccoli — distinguere per zona/indirizzo.

**Referente** — persona di contatto quando il Cliente è un'azienda o un
condominio (es. l'amministratore, non il condominio stesso). *Relazioni*:
collegato a un Cliente. *Ambiguità*: l'utente può nominare il referente
invece del cliente formale ("l'amministratore Bianchi" per il condominio X).

**Immobile** — l'edificio/unità dove si lavora, distinto dal Cliente
(un cliente può avere più immobili) e dal Cantiere (l'immobile esiste
anche senza lavori in corso). *Relazioni*: appartiene a un Cliente; può
ospitare più Cantieri nel tempo.

**Cantiere** — il progetto/lavoro fisico in corso. *Attributi*: stato
(in corso/fermo/concluso), immobile di riferimento. *Relazioni*: di un
Cliente, su un Immobile, nasce spesso da un Sopralluogo. *Ciclo di
vita*: vedi sezione F. *Ambiguità*: "il lavoro di Rossi" può indicare
il Cantiere, il Preventivo, o la Fattura a seconda della fase.

**Sopralluogo** — prima visita di valutazione. *Relazioni*: precede
spesso un Preventivo. *Ciclo di vita*: singolo evento, non ricorrente
(salvo sopralluoghi successivi per verifiche).

**Preventivo** — proposta economica. *Attributi*: importo, stato
(inviato/accettato/rifiutato/scaduto). *Relazioni*: contiene un
Capitolato; se accettato genera una Commessa/Esecuzione. *Ambiguità*:
più preventivi in sospeso per lo stesso cliente vanno distinti.

**Variante** — modifica a un Preventivo/Commessa già avviata (lavoro
aggiuntivo o cambiato in corso d'opera). *Relazioni*: collegata a una
Commessa esistente, non un lavoro nuovo indipendente.

**Commessa** — il lavoro accettato e formalizzato (a volte coincide con
"Cantiere" nel linguaggio comune, ma concettualmente è l'accordo
commerciale, il Cantiere è la sua esecuzione fisica). *Relazioni*: nasce
da un Preventivo accettato; genera Attività, SAL, Fatture.

**Attività** — singola azione/task dentro una Commessa (es. "buttare giù
il muro", "posare le piastrelle"). *Relazioni*: appartiene a una
Commessa; può essere assegnata a un Operaio/Squadra.

**Materiale** — beni fisici necessari (cemento, cartongesso, ecc.).
*Relazioni*: collegato a un Fornitore per l'acquisto, a una Consegna per
la logistica.

**Consegna** — evento di arrivo materiale in cantiere. *Attributi*:
data spesso incerta ("quando arriva il cemento"). *Relazioni*: da un
Fornitore, per una Commessa/Cantiere.

**Fornitore** — chi vende materiale/servizi. *Relazioni*: MAI un
Cliente — categoria distinta anche se nominato in modo simile ("Rossi
ferramenta" vs "Rossi cliente").

**Operaio** — dipendente diretto. *Relazioni*: appartiene a una Squadra;
assegnato ad Attività/Cantieri.

**Squadra** — gruppo di Operai che lavora insieme, spesso su un Cantiere.

**Subappaltatore** — impresa esterna per una parte specifica del lavoro
(es. impiantista). *Relazioni*: simile a un Fornitore ma per manodopera/
lavorazione, non materiale — categoria distinta da entrambi.

**Documento** — planimetrie, capitolati, permessi, certificazioni.
*Relazioni*: sempre collegato a una Commessa/Cliente specifico.

**Foto** — vedi sezione dedicata sotto. *Relazioni*: sempre collegata a
un Cantiere e, tramite quello, a un Cliente — mai generica.

**Video** — come le foto, meno frequente, stesso principio di
collegamento obbligatorio a Cantiere/Cliente.

**Messaggio** — comunicazione interna (Portal EON) o esterna
(WhatsApp, non ancora integrata). *Relazioni*: verso un Cliente.

**Pratica edilizia** (SCIA/CILA) — autorizzazione comunale. *Attributi*:
scadenze, stato. *Relazioni*: collegata a una Commessa/Immobile.

**SAL** (Stato Avanzamento Lavori) — evento di pagamento parziale legato
a una percentuale di lavoro completato. *Relazioni*: dentro una
Commessa; genera spesso una Fattura. *Ambiguità*: non è la stessa cosa
di un Pagamento a saldo finale — vedi sezione F/relazioni.

**Fattura** — documento fiscale. *Relazioni*: collegata a un SAL o al
saldo finale di una Commessa; genera (si spera) un Pagamento.

**Pagamento** — denaro ricevuto. *Attributi*: importo, modalità
(contanti/bonifico), data. *Relazioni*: collegato a una Fattura.

**Contestazione** — problema/difetto segnalato dal cliente o trovato
dall'edile stesso. *Relazioni*: collegata a una Commessa/Cantiere;
spesso documentata con Foto.

**Garanzia** — periodo di responsabilità post-lavoro. *Relazioni*:
collegata a una Commessa conclusa.

**Intervento post-vendita** — assistenza dopo la fine lavori (in
garanzia o a pagamento). *Relazioni*: collegato a una Commessa
conclusa, può generare un nuovo Impegno/Cantiere minore.

## E. Grafo delle relazioni

Percorso principale (il caso più comune):

```
Cliente ──has──> Immobile ──has──> Cantiere
                                       │
                                  nasce da
                                       │
                                  Sopralluogo
                                       │
                                  porta a
                                       │
                                  Preventivo ──contiene──> Capitolato
                                       │
                                  se accettato
                                       ▼
                                  Commessa ──genera──> Attività ──assegnata a──> Operaio/Squadra
                                       │
                                  durante l'esecuzione
                                       ▼
                                  SAL (1..N) ──genera──> Fattura ──genera──> Pagamento
                                       │
                                  a fine lavori
                                       ▼
                                  Garanzia ──può portare a──> Intervento post-vendita
```

Relazioni secondarie/indirette:

- **Foto/Documento/Video** → sempre a un Cantiere → (tramite quello) a
  un Cliente — mai un salto diretto a caso
- **Materiale** → **Fornitore** (acquisto) e **Consegna** (logistica) →
  collegati a una Commessa, MAI a un Cliente come se fosse un fornitore
- **Variante** → una Commessa esistente, non un nuovo Preventivo
  indipendente
- **Contestazione** → una Commessa/Cantiere, spesso con Foto a supporto
- **Subappaltatore** → un'Attività specifica dentro una Commessa, non
  l'intero Cantiere
- **Referente** → un Cliente (quando il cliente stesso non è la persona
  che parla, es. condominio)

## F. Processi — ciclo di vita tipico di un lavoro

1. Primo contatto (telefonata/passaparola) → eventuale nuovo Cliente
2. Sopralluogo → valutazione
3. Preventivo (con Capitolato) → invio al cliente
4. Attesa risposta — se resta senza risposta per giorni, è un caso da
   poter segnalare (follow-up), non da ignorare
5. Accettazione → Commessa → inizio esecuzione (Cantiere attivo)
6. Esecuzione in corso: Attività quotidiane, Foto di avanzamento, ordini
   Materiale/Consegne, gestione Squadra, eventuali Varianti
7. SAL intermedi → Fatture parziali → Pagamenti
8. Contestazioni, se emergono, gestite durante o a fine lavori
9. Fine lavori → foto finali, eventuale Documento di fine lavori,
   Fattura saldo → inizio Garanzia
10. Eventuale Intervento post-vendita

Capire IN QUALE fase è un lavoro aiuta a interpretare richieste
ambigue: "il lavoro di Rossi" durante l'esecuzione probabilmente indica
il Cantiere attivo, non il Preventivo ormai superato; dopo la fine
lavori probabilmente indica la Fattura o la Garanzia.

## G. Linguaggio

Terminologia tipica: **SAL**, **SCIA/CILA**, **capitolato**,
**massetto** (strato di base sotto un pavimento), **cartongesso**,
**sopralluogo**, **subappalto**. Verbi per un impegno non solo
"vedere/incontrare": "passo da", "faccio un salto da", "vado a dare
un'occhiata da", "do un'occhiata a". Espressioni per la memoria/foto:
"fammi vedere com'era prima", "a che punto eravamo rimasti" — sono
richieste di documentazione storica, non frasi da riconoscere alla
lettera. Un termine tecnico mal riconosciuto dal microfono (es.
"massetto" sentito come "mai detto") non va corretto in silenzio se
cambia il senso della frase: meglio chiedere conferma.

## H. Intenzioni professionali

Mappate sulle operazioni che EON già riconosce (`interpreta_richiesta`),
non nuove categorie da inventare nel codice — organizzate per
famiglia, con esempi meno letterali del solito per mostrare che
l'intento conta più della frase:

- **mostra** (recupero/consultazione): foto, documenti, storico
  cliente, un preventivo già fatto, chi deve ancora pagare, chi è su
  quale cantiere. Include richieste indirette come "fammi vedere com'era
  prima" (= foto storiche di un cantiere) o "a che punto eravamo" (=
  stato/ultime attività di un cantiere).
- **crea** (registrazione/pianificazione): impegno, appunto, cliente,
  preventivo, pagamento ricevuto, compito assegnato.
- **modifica** (coordinamento/controllo operativo): spostare un
  appuntamento, correggere un appunto, aggiornare un cliente, registrare
  una Variante su una Commessa esistente.
- **cancella**: annullare un impegno, eliminare un cliente.
- **invia** (comunicazione): messaggio, foto, un sollecito di pagamento.
- **contatta**: avviare un contatto diretto e immediato (chiamare ora).
- **consulta** (valutazione/decisione): parere/confronto ("quale
  preventivo preparo prima?", "conviene fare prima il getto o aspettare
  il materiale?") — MAI trasformato in automatico in un'azione.

"Consigliare/pianificare/ricordare/coordinare/controllare" (linguaggio
comune) si riconducono a queste sette — un consiglio è sempre
**consulta**; pianificare o ricordare è sempre **crea**; coordinare la
squadra è **crea**/**modifica** su Attività; controllare lo stato
economico è **mostra**.

## I. Comportamento EON — per intento/categoria

Non solo COSA chiede l'edile, ma COME BRAIN deve ragionare: cosa capire,
quale contesto usare, quali entità/relazioni verificare, quali
informazioni servono, quando procedere, quando chiarire, quando
confermare, quando fermarsi, quali errori evitare.

**Foto/documenti/video del cantiere (mostra)** — *Capire*: l'utente
vuole vedere una risorsa esistente, anche se la chiede in modo indiretto
("com'era prima"). *Contesto*: cliente/cantiere corrente se non
specificato. *Entità*: Cantiere → Cliente. *Procedere quando*: il
cantiere è identificabile con certezza. *Chiarire quando*: più cantieri
possibili per lo stesso cliente. *Mai*: sostituire con un promemoria
solo perché il recupero non trova nulla — dirlo onestamente invece.
*Errore da evitare*: collegare la foto giusta al cliente sbagliato.

**Impegni e appuntamenti (crea)** — *Capire*: sopralluoghi, consegne,
scadenze, promemoria vanno sempre registrati come impegno vero.
*Procedere quando*: manca del tutto l'orario — decide da solo (primo
giorno utile, orario plausibile), senza fermarsi. *Confermare quando*:
l'orario è vago/relativo ("quando arriva il cemento") — stima e chiede
conferma in testo. *Mai*: dare lo stesso orario a più impegni distinti
nella stessa frase; saltarne uno per fretta.

**Clienti e omonimi (mostra/crea)** — *Capire*: prima di creare o
collegare, verificare per nome. *Chiarire quando*: ci sono omonimi
(frequenti in paesi piccoli) — usare zona/indirizzo per distinguere.
*Mai*: scegliere un cliente omonimo a caso.

**Appunti in cantiere (crea/modifica)** — *Capire*: note veloci e
informali senza data sono appunti, non impegni. *Modificare quando*:
una correzione arriva subito dopo un appunto appena creato — applicarla
lì, non crearne uno nuovo.

**Comunicazione con i clienti (invia)** — *Fermarsi sempre*: è
un'operazione delicata, richiede conferma reale prima di mandare,
qualunque sia il tono della richiesta. *Procedere solo dopo aver*:
recuperato davvero foto/documenti da allegare, mai promesso un invio di
qualcosa mai recuperato.

**Preventivi (crea/consulta)** — *Capire*: creare un preventivo è
un'azione; decidere quale preparare prima tra più in sospeso è un
parere. *Mai*: trasformare un parere richiesto in un'azione automatica.
*Segnalare quando richiesto*: un preventivo senza risposta da giorni —
solo se l'utente lo chiede, non di iniziativa propria.

**Varianti (modifica)** — *Capire*: una Variante si collega a una
Commessa esistente, non è un lavoro nuovo indipendente — verificare
prima che la Commessa esista.

**Pagamenti e SAL (crea/mostra)** — *Capire*: un SAL è un pagamento
parziale legato all'avanzamento, distinto dal saldo finale — non
confonderli nel capire di cosa parla l'utente. *Procedere quando*:
l'importo e il collegamento a una Commessa sono chiari.

**Squadra, attività, subappaltatori (crea/mostra)** — *Capire*:
assegnare un compito o sapere chi è su quale cantiere sono richieste
dirette. *Distinguere*: un subappaltatore non è né un dipendente né un
fornitore di materiale — categoria propria.

**Contestazioni (crea/mostra)** — *Capire*: un problema segnalato va
collegato con certezza alla Commessa/Cantiere giusto, spesso con foto a
supporto — massima attenzione al collegamento corretto (vedi errori
critici).

## Modulo WhatsApp (per il futuro Communication Hub)

Osservazione realistica su come un edile usa davvero WhatsApp oggi,
utile quando si progetterà l'integrazione (non ancora fatta):

- **Vantaggi per l'edile**: immediato, foto/vocali senza sforzo, tutti
  lo sanno usare (anche i clienti anziani), gruppi per coordinare la
  squadra.
- **Limiti**: informazioni si perdono nello scroll, nessuno storico
  organizzato per cliente/cantiere, difficile recuperare "cosa avevamo
  detto due mesi fa".
- **Comportamenti tipici**: manda una foto con due parole invece di un
  messaggio strutturato; usa gruppi con clienti e fornitori mescolati;
  decide misure/date direttamente in chat, senza riportarle altrove.
- **Cosa EON NON deve fare**: non deve sostituire WhatsApp (l'edile
  continuerà a usarlo comunque) — deve invece essere pronto, quando il
  canale sarà collegato, a capire il contenuto professionale di quei
  messaggi (una foto = avanzamento cantiere, una misura scritta in chat
  = dato da salvare), non trattarli come testo generico.

## Modello di priorità

Per riconoscere urgenze vere, senza che la priorità autorizzi mai a
saltare una conferma dovuta:

1. **Sicurezza** — sempre la priorità più alta, se menzionata
2. **Attività bloccanti** — un lavoro fermo perché manca qualcosa (es.
   materiale, autorizzazione)
3. **Clienti in attesa da tempo** — un preventivo/risposta rimasta
   senza seguito per giorni
4. **Scadenze con data reale** (pratiche edilizie, consegne concordate)
5. **Materiali mancanti** — bloccano un'attività programmata
6. **Pagamenti insoluti** — importanti ma raramente urgenti in senso
   operativo
7. **Urgenza dichiarata ma senza segnali concreti** — trattarla come
   normale priorità, non alzare automaticamente il livello solo per il
   tono della frase

## Catalogo errori critici

| Errore | Gravità | Come prevenirlo |
|---|---|---|
| Foto/documento collegato al cliente sbagliato | Alta | Mai collegare se il riferimento non è certo — chiedere |
| Pagamento attribuito alla Commessa/SAL sbagliato | Alta | Verificare sempre a quale Commessa si riferisce prima di registrare |
| Attività assegnata al cantiere errato | Alta | Stessa verifica di cliente/cantiere prima di procedere |
| Cliente omonimo scelto a caso | Alta | Chiedere sempre in caso di ambiguità reale |
| Fornitore trattato come cliente | Media | Categoria distinta esplicita (sezione D) |
| Variante trattata come nuovo lavoro indipendente | Media | Verificare la Commessa esistente prima di procedere |
| Orario indovinato quando serviva una stima dichiarata | Media | Regola sull'orario (sezione I) |
| Comunicazione inviata senza conferma reale | Alta | Mai bypassare la conferma per un'operazione delicata |
| Prezzo/sconto deciso da EON | Alta | Mai inventare, sempre chiedere all'utente |

## J. Situazioni limite

- **Rumore di fondo in cantiere**: più probabilità di dettatura
  imprecisa che in un ufficio — gestire come i nomi mal riconosciuti già
  previsti in EON
- **Frasi con tutto insieme**: impegno + cliente + materiale da ordinare
  nella stessa frase — vanno scomposte, non perse o accorpate
- **Termini generici che cambiano significato**: "il lavoro di Rossi"
  dipende dalla fase del processo (sezione F) e dal contesto
- **Urgenza apparente vs reale**: vedi modello di priorità
- **Riferimento a WhatsApp**: l'utente può citare "quello che ho scritto
  su WhatsApp" — EON deve dire onestamente che non ha accesso a quel
  canale (oggi), non fingere di saperlo

## K. Cosa NON deve fare EON

- Non inventare mai quantità di materiale, misure o prezzi non detti
  esplicitamente
- Non decidere un prezzo o uno sconto da solo
- Non promettere una tempistica di fine lavori se non confermata dal
  professionista
- Non collegare mai una foto/documento/pagamento al cliente o alla
  Commessa sbagliati per velocità
- Non confondere un fornitore o un subappaltatore con un cliente
- Non trasformare mai un parere richiesto (consulta) in un'azione senza
  che l'utente lo accetti esplicitamente
- Non fingere di avere accesso a WhatsApp o ad altri canali non ancora
  collegati

## L. Casi di valutazione — situazioni da trasformare in test

Ogni riga = una capacità da verificare con formulazioni diverse (non
una frase fissa), come già fa `eval/casi.json`. Materiale grezzo, non
ancora casi JSON pronti — organizzato per intento/categoria.

**Recupero risorse (mostra)**
1. Foto di un cantiere con cliente esplicito → deve recuperarle davvero
2. Foto con riferimento ambiguo (più cantieri per lo stesso cliente) →
   deve chiedere quale
3. Richiesta indiretta ("fammi vedere com'era prima") → capire che è una
   richiesta di foto storiche, non una domanda generica
4. Documenti di un cliente specifico → recupero diretto se non ambiguo
5. Storico di un cliente prima di un sopralluogo → deve restituire
   informazioni reali, non inventarle se mancano

**Impegni e tempo (crea)**
6. Impegno senza alcun orario → deve procedere subito, mai chiedere
7. Impegno con orario vago/relativo → stima e chiede conferma in testo
8. Più impegni in sequenza nella stessa frase → orari distinti, nessuno
   perso
9. Consegna materiale con data incerta → gestita come orario vago
10. Correzione veloce dopo un impegno appena creato → modifica lo stesso
    impegno, non ne crea uno nuovo

**Clienti e ambiguità (mostra/crea)**
11. Cliente omonimo in un contesto con zona/indirizzo disponibile →
    distingue correttamente
12. Cliente omonimo senza altri dati disponibili → chiede quale
13. Nome mal riconosciuto dal microfono, simile a un cliente esistente →
    chiede conferma, non corregge in silenzio
14. Cliente nuovo mai visto, azienda/nome completo → segnala che non è
    in anagrafica, offre di aggiungerlo, procede comunque con l'azione
15. Persona citata di sfuggita in un impegno, nome di battesimo semplice
    → procede senza chiedere di aggiungerla come cliente

**Cantiere: foto, documenti, appunti (crea/modifica)**
16. Appunto veloce dettato in cantiere → registrato come appunto, non
    impegno
17. Correzione di un appunto appena creato (rumore, ripensamento) →
    modifica lo stesso appunto
18. Foto come prova di una contestazione → collegata al cantiere/cliente
    corretto, mai a caso
19. Termine tecnico mal riconosciuto che cambia il senso ("massetto" →
    "mai detto") → chiede conferma

**Comunicazione (invia/contatta)**
20. Aggiornamento di avanzamento da mandare a un cliente → si ferma per
    conferma reale
21. Sollecito di pagamento → si ferma per conferma reale, tono
    appropriato
22. Richiesta di mandare foto/documento mai recuperato prima → recupera
    prima, poi propone l'invio — mai promette un invio a vuoto
23. Vuole contattare un cliente ma manca il telefono → chiede il numero,
    offre di salvarlo, ma non blocca un'azione indipendente che non
    richiede il telefono

**Preventivi, varianti, SAL (crea/consulta/modifica)**
24. Creare un preventivo dopo un sopralluogo → azione diretta
25. Parere su quale preventivo preparare prima, che nomina clienti reali
    di sfuggita → parere motivato, mai un'azione automatica
26. Variante su una commessa esistente → collegata alla commessa giusta,
    non trattata come lavoro nuovo
27. Registrare un SAL vs. un pagamento a saldo finale → non li confonde
28. Preventivo senza risposta da giorni, segnalazione richiesta
    esplicitamente dall'utente → gestita, non inventata di iniziativa

**Squadra e fornitori (crea/mostra)**
29. Assegnare un compito a un collaboratore → azione diretta
30. Fornitore nominato in una frase che sembra un cliente ("richiama la
    ferramenta per il cemento") → non trattato come cliente
31. Subappaltatore per una lavorazione specifica → distinto sia da
    fornitore che da dipendente diretto

**Situazioni limite trasversali**
32. Frase con tutto insieme (impegno + cliente + materiale) → scomposta
    correttamente, nulla perso
33. Riferimento generico ("il lavoro di Rossi") in fasi diverse del
    processo (appena dopo un sopralluogo vs. cantiere in esecuzione vs.
    dopo la fine lavori) → interpretato in modo coerente con la fase
    reale
34. Urgenza dichiarata ma senza segnali concreti → non salta conferme
    dovute
35. Riferimento a WhatsApp ("guarda quello che ho scritto ieri sera") →
    onestà sul fatto che EON non ha accesso a quel canale oggi

---

**Nota sul numero di casi**: una seconda consulenza (Copilot) chiedeva
un totale fisso di 1100 casi e 300 intenti. Non seguito qui — vedi la
discussione con Gianardi nella sessione del 03/09/2026: scritti con
cura, non a un numero imposto; crescono da qui in avanti quando un test
vero (o una lamentela reale di un edile che usa l'app) li giustifica,
non tutti insieme stanotte.
