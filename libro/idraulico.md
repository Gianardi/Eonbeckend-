# Professional Brain Pack — IDRAULICO

Prima bozza (Claude, 06/09/2026), costruita con lo stesso metodo dell'edile:
conoscenza generale sul mestiere, stessa struttura (vedi
`libro/professional-brain-pack-metodo.md`). **Ancora una bozza**, non
verità definitiva — da correggere con l'esperienza reale prima di
derivarne casi per la Evaluation Suite o modifiche al prompt di EON. Non
entra nel prompt così com'è: solo le correzioni vere, trovate testando,
ci entrano, in poche righe mirate.

## A. Identità professionale

Piccola impresa idraulica o artigiano singolo, spesso con 1-3 persone
(a volte da solo). A differenza dell'edile, lavora molto per **interventi
puntuali** più che per cantieri lunghi: una perdita da riparare, una
caldaia da sostituire, uno scarico da sturare — anche se esistono lavori
più estesi (rifacimento bagno, impianto di riscaldamento nuovo) che
durano giorni o settimane. I clienti sono in gran parte privati, ma
anche condomini (per parti comuni), uffici, negozi. Il telefono squilla
spesso per urgenze vere, non programmabili.

## B. Giornata e contesto

Giornata organizzata per appuntamenti fissati (interventi programmati,
manutenzioni) intervallati da **urgenze non previste** che si inseriscono
a forza nella giornata (una perdita che allaga, niente acqua calda in
pieno inverno). A differenza dell'edile, l'idraulico deve gestire più
spesso la tensione tra "quello che avevo già in programma" e "quello che
è appena arrivato ed è più urgente" — è un mestiere dove riprogrammare
al volo è la norma, non l'eccezione. Porta con sé attrezzi e un furgone
spesso rifornito di materiale comune (raccordi, guarnizioni, tubi) per
non dover tornare in negozio ad ogni intervento minore.

## Modello cognitivo dell'idraulico

- **Organizza per intervento/cliente, non per data**: come l'edile, "il
  problema di Rossi" è l'unità mentale, il calendario è conseguenza.
- **Distingue urgenza vera da urgenza percepita, in modo più netto
  dell'edile**: un allagamento in corso o l'assenza totale di acqua/
  riscaldamento sono urgenze oggettive, riconoscibili da segnali
  concreti (acqua che esce, temperatura esterna, presenza di persone
  fragili in casa) — non dal tono con cui il cliente la racconta (un
  cliente ansioso può descrivere come "urgentissimo" un rubinetto che
  gocciola, uno tranquillo può minimizzare un principio di allagamento).
- **Ricorda i clienti per problema/impianto, non per anagrafica**: "quello
  della caldaia che perde in via Roma" è spesso più naturale di nome e
  cognome.
- **Usa le fotografie per diagnosi a distanza**: più dell'edile, spesso
  chiede al cliente di mandare una foto PRIMA di uscire, per capire cosa
  serve portare (il pezzo di ricambio giusto) — le foto quindi non sono
  solo documentazione, sono strumento diagnostico operativo.
- **Tiene traccia di scadenze ricorrenti** (manutenzione annuale caldaia,
  controllo fumi) più che l'edile, che lavora più per progetti singoli
  senza scadenze cicliche.
- **Decide in fretta con poche informazioni**, come l'edile, ma spesso al
  telefono prima ancora di vedere il problema — deve capire dalla
  descrizione del cliente (spesso imprecisa: "fa uno strano rumore",
  "perde ma non tanto") quanto sia grave e cosa portare.

## C. Mondo professionale

- **Clienti**: privati (maggioranza), condomini (parti comuni, caldaie
  centralizzate), uffici, negozi, altre imprese (subappalto da un edile
  per la parte idraulica di un cantiere più grande).
- **Interventi**: riparazioni puntuali (perdita, scarico otturato,
  rubinetto), sostituzioni (caldaia, scaldabagno, sanitari), impianti
  nuovi o rifacimenti (bagno, riscaldamento), manutenzioni programmate
  (caldaia, autoclave).
- **Luoghi**: l'abitazione/locale del cliente, il furgone (magazzino
  mobile), il fornitore (idraulica, ferramenta specializzata).
- **Persone**: il cliente, l'amministratore di condominio (per parti
  comuni), un aiutante/apprendista, i fornitori (mai clienti).
- **Documenti**: preventivi, dichiarazioni di conformità (obbligatorie
  per legge su impianti nuovi/modificati), libretti di impianto/caldaia,
  fatture.
- **Pagamenti**: spesso a intervento concluso (non frazionato come i SAL
  edili), a volte acconto per materiale costoso (caldaie, autoclavi).

## D. Ontologia del dominio

**Cliente** — persona o ente per cui si lavora. *Attributi*: nome, zona/
indirizzo, telefono, tipo (privato/condominio/impresa). *Relazioni*: ha
uno o più Immobili; se condominio, ha un Amministratore come referente.
*Ambiguità*: come per l'edile, omonimi frequenti; un cliente può avere
più immobili (casa e seconda casa, appartamento e negozio) — l'intervento
richiesto va sempre collegato all'immobile giusto, non solo al cliente.

**Amministratore di condominio (referente)** — persona di contatto per
interventi su parti comuni. *Relazioni*: collegato a uno o più Condomini
(clienti di tipo condominio), non è lui il proprietario dell'immobile.
*Ambiguità*: un amministratore gestisce spesso più condomini — un
intervento richiesto da lui va sempre agganciato al condominio giusto,
mai assunto per default.

**Immobile** — l'unità dove si interviene. *Attributi*: indirizzo, tipo
(abitazione/ufficio/parte comune). *Relazioni*: appartiene a un Cliente;
ospita uno o più Impianti. *Ambiguità*: stesso cliente, immobili diversi
(casa principale vs seconda casa) — un riferimento vago ("quella casa")
va chiarito se il cliente ne ha più di una.

**Impianto** — idraulico, di riscaldamento, di climatizzazione. *Attributi*:
tipo, età, stato. *Relazioni*: si trova in un Immobile; contiene
apparecchi (Caldaia, Autoclave, Sanitari). *Ciclo di vita*: installato,
mantenuto periodicamente, a volte sostituito.

**Caldaia/Scaldabagno** — apparecchio specifico, spesso soggetto a
manutenzione obbligatoria per legge. *Attributi*: marca/modello, data di
installazione, scadenza della manutenzione/controllo fumi. *Relazioni*:
parte di un Impianto; ha un Libretto di impianto associato. *Ambiguità*:
un cliente con più immobili può avere una caldaia per ciascuno — la
scadenza di manutenzione va sempre riferita alla caldaia/immobile giusto.

**Intervento** — l'unità di lavoro concreta (riparazione, sostituzione,
manutenzione). *Attributi*: tipo (urgente/programmato/manutenzione),
stato (da fare/in corso/concluso). *Relazioni*: riguarda un Cliente, un
Immobile, spesso un Impianto specifico. *Ciclo di vita*: richiesto →
(eventuale sopralluogo/diagnosi telefonica) → eseguito → (eventuale
Dichiarazione di conformità) → fatturato.

**Urgenza/Emergenza** — un Intervento con priorità massima per un
rischio concreto e in corso (allagamento, mancanza di acqua/
riscaldamento, odore di gas — quest'ultimo NON di competenza
dell'idraulico, va sempre indirizzato al gestore gas/vigili del fuoco,
mai gestito come un intervento normale). *Ambiguità*: distinguere
un'urgenza vera da un disagio non urgente richiede attenzione al
segnale concreto (acqua che esce ora, assenza totale di riscaldamento
con temperature rigide, presenza di persone fragili), non al tono
della richiesta.

**Manutenzione programmata** — intervento ricorrente (es. annuale) legato
per legge o per buona pratica a un Impianto/Caldaia. *Relazioni*:
collegata a un Impianto specifico; genera un Impegno futuro alla
scadenza. *Ciclo di vita*: si ripete nel tempo, non è un evento isolato.

**Preventivo** — proposta economica per un intervento non urgente o di
una certa entità (per interventi minori spesso non esiste un preventivo
formale, si concorda a voce). *Relazioni*: se accettato genera
l'Intervento vero e proprio.

**Dichiarazione di conformità** — documento legale obbligatorio dopo
l'installazione o modifica sostanziale di un impianto. *Relazioni*:
collegata a un Intervento di installazione/modifica, non a una semplice
riparazione. *Ambiguità*: non tutti gli interventi la richiedono — solo
installazioni nuove o modifiche sostanziali, mai una semplice
riparazione o manutenzione ordinaria.

**Fornitore** — chi vende materiale (idraulica, ferramenta) o
attrezzature (caldaie, autoclavi). *Relazioni*: MAI un Cliente — stessa
regola dell'edile.

**Fattura** — documento fiscale, di solito emessa a intervento concluso.
*Relazioni*: collegata a un Intervento; genera un Pagamento.

**Pagamento** — denaro ricevuto. *Attributi*: importo, modalità, data.
*Relazioni*: collegato a una Fattura o direttamente a un Intervento per
i lavori minori senza fattura immediata.

## E. Grafo delle relazioni

Percorso principale (caso comune, intervento singolo):

```
Cliente ──has──> Immobile ──has──> Impianto (con Caldaia/Autoclave)
                                       │
                                  richiesta di
                                       │
                                  Intervento (urgente / programmato / manutenzione)
                                       │
                             se installazione/modifica
                                       ▼
                          Dichiarazione di conformità
                                       │
                                  a lavoro concluso
                                       ▼
                                  Fattura ──genera──> Pagamento
```

Percorso secondario (manutenzione ricorrente):

```
Impianto/Caldaia ──genera ricorrenza──> Manutenzione programmata ──diventa──> Impegno futuro
```

Relazioni secondarie:
- **Foto** → sempre a un Intervento/Immobile → (tramite quello) a un
  Cliente — usate anche PRIMA dell'intervento per diagnosi, non solo
  come documentazione a lavoro fatto.
- **Materiale** → Fornitore (acquisto), MAI un Cliente.
- **Amministratore** → uno o più Condomini (clienti), mai il condominio
  stesso come persona.

## F. Processi — ciclo di vita tipico

**Intervento urgente**: chiamata/messaggio del cliente → valutazione
telefonica della gravità reale → (se davvero urgente) intervento il
prima possibile, spesso riorganizzando la giornata → diagnosi sul posto
→ riparazione (spesso nella stessa visita, se il pezzo è disponibile) →
fattura/pagamento.

**Intervento programmato/lavoro più esteso**: richiesta → eventuale
sopralluogo → preventivo (se il lavoro è di una certa entità) →
accettazione → esecuzione (a volte su più giorni per lavori come un
rifacimento bagno) → dichiarazione di conformità se richiesta →
fattura/pagamento.

**Manutenzione programmata**: scadenza che arriva (es. un anno dopo
l'ultima manutenzione caldaia) → contatto proattivo al cliente (a volte
è l'idraulico stesso a ricordarlo, non il cliente a chiederlo) →
intervento breve e standard → aggiornamento della prossima scadenza.

Capire in quale fase è un intervento aiuta a interpretare richieste
ambigue: "il problema di Rossi" durante un'urgenza in corso è la
riparazione stessa; per un cliente con manutenzione periodica, "quando
tocca a Rossi" si riferisce alla prossima scadenza programmata.

## G. Linguaggio

Terminologia tipica: **caldaia**, **scaldabagno**, **autoclave**,
**sifone**, **guarnizione**, **rubinetteria**, **valvola** (a sfera, di
non ritorno), **raccordo**, **spurgo** (dell'aria dai termosifoni),
**disincrostazione**, **libretto di impianto**, **dichiarazione di
conformità**, **contabilizzazione** (calore, in condomini con impianto
centralizzato). Espressioni tipiche di urgenza reale: "sta uscendo
acqua dappertutto", "non c'è più acqua calda da stamattina", "il
termosifone è freddo con questo freddo". Espressioni che possono
sembrare urgenti ma spesso non lo sono: "fa uno strano rumore da un
po'", "perde un pochino ma è così da tempo" — vanno comunque prese sul
serio, ma senza il trattamento di emergenza immediata a meno di segnali
concreti aggiuntivi. Una parola tecnica mal riconosciuta dal microfono
(es. "sifone" sentito come "si fine" o "autoclave" come "ho to clave")
non va corretta in silenzio se cambia il senso: chiedere conferma,
stesso principio dell'edile.

**Autocorrezione nel parlato**: come per l'edile, vale sempre l'ultimo
valore/stato detto in una frase con più correzioni successive.

## H. Intenzioni professionali

Mappate sulle stesse operazioni di `interpreta_richiesta`:

- **mostra**: foto di un intervento, storico di un cliente, quando
  scade la prossima manutenzione, chi deve ancora pagare.
- **crea**: impegno (intervento programmato, manutenzione), appunto
  (nota veloce), cliente, pagamento ricevuto.
- **modifica**: spostare un appuntamento (frequente per urgenze che si
  inseriscono), correggere un appunto, aggiornare un cliente.
- **cancella**: annullare un impegno, eliminare un cliente.
- **invia**: messaggio, foto, promemoria di scadenza manutenzione.
- **contatta**: chiamare subito (specialmente per urgenze).
- **consulta**: parere tecnico ("conviene sostituire o riparare?",
  "questo intervento lo faccio prima io o mando l'aiutante?") — mai
  trasformato in automatico in un'azione.

## I. Comportamento EON — per intento/categoria

**Richiesta di intervento (crea/valuta urgenza)** — *Capire*: distinguere
se è un'urgenza reale (segnali concreti: acqua che esce ora, assenza
totale di acqua calda/riscaldamento, non la parola "urgente" in sé) da
un intervento programmabile. *Procedere quando*: la richiesta è chiara
sul problema, anche se manca l'orario — decidi tu un orario plausibile
(primo giorno utile, o subito se davvero urgente), senza fermarti a
chiedere. *Confermare quando*: la gravità reale non è chiara dal testo
(es. "perde un po'" senza altri dettagli) — puoi chiedere un dettaglio
in più (da quanto, quanta acqua) prima di decidere la priorità, ma senza
bloccare comunque la registrazione dell'intervento.

**Foto per diagnosi (mostra/richiedi)** — *Capire*: una richiesta di foto
da parte dell'idraulico prima di un intervento serve a preparare il
materiale giusto — se l'utente chiede di vedere le foto già mandate da
un cliente per un problema specifico, recuperale davvero con lo
strumento giusto, non rispondere a parole.

**Clienti con più immobili (mostra/crea)** — *Capire*: prima di
registrare o cercare, verificare a quale immobile si riferisce se il
cliente ne ha più di uno — stesso principio del Cantiere per l'edile,
ma qui si applica a "quale casa/impianto", non "quale lavoro".

**Manutenzioni programmate (crea/mostra)** — *Capire*: una manutenzione
ricorrente va registrata con la prossima scadenza, non come un impegno
isolato — se l'utente segnala di aver fatto la manutenzione oggi,
aggiorna anche mentalmente/nell'appunto quando sarà la prossima (di
solito un anno dopo, se non specificato altrimenti chiedi).

**Dichiarazione di conformità (crea/mostra)** — *Capire*: rilevante solo
per installazioni o modifiche sostanziali, mai per una semplice
riparazione — non generarla o menzionarla come necessaria per un
intervento che chiaramente non lo richiede.

**Comunicazione con i clienti (invia)** — *Fermarsi sempre*: stessa
regola dell'edile, conferma reale prima di mandare.

**Preventivi (crea/consulta)** — *Capire*: per interventi minori spesso
non serve un preventivo formale (si concorda a voce l'importo
approssimativo) — non trattare ogni richiesta come se necessitasse
sempre un documento formale, ma se l'utente chiede esplicitamente di
prepararne uno, è un'azione, non un parere.

**Fornitori (crea/mostra)** — *Capire*: stessa regola dell'edile, un
fornitore di materiale o attrezzature non è mai un cliente, anche se
nominato in modo simile a un cliente reale.

## Modello di priorità

A differenza dell'edile, qui l'urgenza reale ha un peso ancora più
diretto e frequente:

1. **Emergenze con rischio immediato** (allagamento in corso, odore di
   gas — quest'ultimo da NON gestire come intervento idraulico normale,
   va sempre detto onestamente all'utente di contattare il gestore gas
   o i vigili del fuoco, non l'idraulico)
2. **Assenza totale di un servizio essenziale** (niente acqua calda,
   niente riscaldamento in condizioni climatiche rigide, niente acqua
   corrente)
3. **Interventi programmati già concordati** (rispettare gli impegni
   presi, anche se non urgenti in sé)
4. **Manutenzioni con scadenza imminente** (caldaia, controllo fumi)
5. **Piccoli disagi non urgenti** (rubinetto che gocciola da tempo,
   rumore intermittente) — normale amministrazione, non richiede
   trattamento di emergenza
6. **Urgenza dichiarata ma senza segnali concreti** — trattarla come
   priorità normale, verificando con una domanda se serve, non alzando
   automaticamente il livello per il tono della frase

## Catalogo errori critici

| Errore | Gravità | Come prevenirlo |
|---|---|---|
| Urgenza reale trattata come non urgente | Alta | Riconoscere i segnali concreti (sezione Modello di priorità), non il tono |
| Intervento collegato all'immobile sbagliato (cliente con più case) | Alta | Verificare sempre quale immobile se il cliente ne ha più di uno |
| Odore di gas gestito come intervento idraulico normale | Alta | Indirizzare sempre a gestore gas/vigili del fuoco, mai trattarlo come competenza propria |
| Dichiarazione di conformità dimenticata su un'installazione nuova | Alta | Verificare se l'intervento è un'installazione/modifica, non solo una riparazione |
| Manutenzione programmata persa/non ricordata | Media | Registrare sempre la prossima scadenza quando se ne fa una |
| Fornitore trattato come cliente | Media | Categoria distinta esplicita (sezione D) |
| Cliente omonimo scelto a caso | Alta | Chiedere sempre in caso di ambiguità reale |
| Prezzo/sconto deciso da EON | Alta | Mai inventare, sempre chiedere all'utente |
| Comunicazione inviata senza conferma reale | Alta | Mai bypassare la conferma per un'operazione delicata |
| Foto richiesta per diagnosi mai recuperata davvero | Media | Usare lo strumento giusto, non rispondere a parole |

## J. Situazioni limite

- **Rumore di fondo durante un intervento**: dettatura imprecisa mentre
  si lavora — stesso trattamento dell'edile per nomi/termini mal
  riconosciuti.
- **Cliente che descrive un problema in modo vago o contraddittorio al
  telefono** ("perde ma non si vede acqua"): chiedere un dettaglio in
  più prima di decidere la priorità, senza però bloccare la
  registrazione dell'intervento.
- **Più richieste urgenti nello stesso momento da clienti diversi**: se
  l'utente chiede di valutare quale fare prima, è un parere (consulta),
  non un'azione automatica — dai un parere motivato in base ai segnali
  di gravità reale disponibili.
- **Riferimento a "quella caldaia" per un cliente con più immobili**:
  chiarire a quale immobile/caldaia si riferisce se non è ovvio dal
  contesto della conversazione.
- **Manutenzione rimandata dal cliente** ("la faccio il mese prossimo"):
  aggiornare la scadenza registrata di conseguenza, non lasciarla con la
  data vecchia.

## K. Cosa NON deve fare EON

- Non trattare l'odore di gas o segnali di pericolo reale come un
  intervento idraulico ordinario — indirizzare sempre a chi di
  competenza (gestore gas, vigili del fuoco), dichiarando onestamente il
  limite.
- Non inventare mai un prezzo, una scadenza di manutenzione, o le
  caratteristiche di un impianto non detti esplicitamente.
- Non decidere un prezzo o uno sconto da solo.
- Non collegare mai una foto o un intervento all'immobile/cliente
  sbagliato per velocità.
- Non confondere un fornitore con un cliente.
- Non trasformare mai un parere richiesto (consulta) in un'azione senza
  che l'utente lo accetti esplicitamente.
- Non generare o menzionare una Dichiarazione di conformità per un
  intervento che non la richiede (una semplice riparazione).
- Non abbassare la priorità di un'urgenza reale solo perché descritta
  con un tono calmo, né alzarla solo perché descritta con tono ansioso
  senza segnali concreti.

## L. Casi di valutazione — situazioni da trasformare in test

**Urgenze e priorità**
1. Allagamento in corso descritto con dettagli concreti → trattato come
   urgenza massima, intervento il prima possibile
2. Rubinetto che gocciola da tempo, descritto con tono allarmato →
   priorità normale, non urgenza vera, verificare con una domanda se
   serve
3. Odore di gas segnalato → EON indirizza a gestore gas/vigili del
   fuoco, non tratta come intervento idraulico
4. Assenza di riscaldamento in pieno inverno → trattata come urgenza
   vera anche senza la parola "urgente" nella richiesta

**Clienti e immobili**
5. Cliente con due immobili, richiesta che nomina "quella casa" senza
   specificare → chiede quale, non assume a caso
6. Cliente con un solo immobile → procede senza chiedere nulla

**Manutenzioni**
7. Manutenzione caldaia appena fatta → registra anche la prossima
   scadenza, non solo l'evento di oggi
8. Cliente che rimanda la manutenzione già programmata → aggiorna la
   data, non la lascia vecchia

**Diagnosi e foto**
9. Richiesta di vedere foto già mandate da un cliente per un problema
   specifico → le recupera davvero
10. Cliente descrive un problema vago al telefono → chiede un dettaglio
    prima di decidere la priorità, senza bloccare la registrazione

**Documenti**
11. Installazione di una caldaia nuova → menziona/gestisce la
    dichiarazione di conformità come rilevante
12. Semplice riparazione di un rubinetto → NON menziona la dichiarazione
    di conformità come necessaria

**Fornitori**
13. Fornitore di materiale idraulico nominato in una frase che sembra un
    cliente → non trattato come cliente

**Situazioni limite trasversali**
14. Due urgenze da clienti diversi nello stesso momento, l'utente chiede
    quale fare prima → parere motivato sui segnali di gravità reale, mai
    un'azione automatica
15. Termine tecnico mal riconosciuto dal microfono che cambia il senso
    della frase → chiede conferma invece di correggere in silenzio
