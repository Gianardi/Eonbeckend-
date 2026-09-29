/* Il frasario di EON (30/09/2026): tutti i modi di dire, per ogni azione.
   Andrea: "deve arrivare ai tester pronto: per tutte le loro richieste di
   lavoro, in qualsiasi modo siano formulate, il sistema funzioni".
   Come fanno gli assistenti grandi (Snips, Rasa, Alexa): una piccola
   grammatica per ogni azione. Ogni regola combina pezzi alternativi:
     {a|b|c}   uno a caso        [x]   c'è o non c'è
     <SLOT>    un pezzo dal vocabolario (nomi, giorni, lavori, contenuti…)
   Così da poche centinaia di regole escono decine di migliaia di frasi
   diverse (verbi, ordine delle parole, parlato, errori di dettatura).
   NON contiene frasi dei giri alla cieca (eval/dati/): servono a misurare.
   Uso: import { generaFrasario } from "./frasario.mjs" */

let seme = 20260930;
const caso = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
const uno = (a) => a[Math.floor(caso() * a.length)];

/* ---------- I clienti: persone, ditte, condomìni, negozi ---------- */
const NOMI_P = ["Mario", "Luca", "Giulia", "Paola", "Franco", "Sergio", "Anna", "Marco", "Elena", "Roberto", "Chiara", "Stefano", "Laura", "Giorgio", "Silvia", "Davide", "Monica", "Alberto", "Federica", "Nicola", "Teresa", "Simone", "Carla", "Enzo", "Rita", "Walter", "Lucia", "Bruno", "Sonia", "Gianni", "Marta", "Pietro", "Valentina", "Claudio", "Barbara", "Fabio"];
const COGNOMI = ["Rossi", "Bianchi", "Ferrari", "Esposito", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferraro", "Galli", "Martini", "Leone", "Longo", "Gentile", "Martinelli", "Vitale", "Lombardo", "Serra", "Coppola", "De Santis", "D'Angelo", "Marchetti", "Parisi", "Villa", "Conte", "Ferri", "Fabbri", "Bianco", "Marini", "Grasso", "Valentini", "Messina", "Sala", "De Angelis", "Gatti", "Pellegrini", "Palumbo", "Sanna", "Farina", "Rizzi", "Monti", "Cattaneo", "Morelli", "Amato", "Silvestri", "Mazza", "Testa", "Grassi", "Pellegrino", "Carbone", "Giuliani", "Benedetti", "Barone", "Orlando", "Neri", "Pace", "Riva", "Sartori", "Bassi", "Orsini", "Nardi", "Mele", "Lodi"];
const TIPI_DITTA = ["bar", "ristorante", "pizzeria", "trattoria", "hotel", "albergo", "b&b", "agriturismo", "farmacia", "officina", "palestra", "negozio", "studio", "panificio", "pasticceria", "gelateria", "tabaccheria", "lavanderia", "ottica", "enoteca", "libreria", "scuola", "capannone", "magazzino", "residence", "agenzia", "autofficina", "macelleria", "fioreria", "parrucchiere"];
const NOMI_DITTA = ["Sport", "Centrale", "Aurora", "Stella", "Sole", "Luna", "Miramare", "Bellavista", "Il Faro", "Da Gino", "Da Rosa", "La Vela", "Il Gabbiano", "Belvedere", "Moderno", "Italia", "Roma", "Europa", "Verde", "Blu", "Tosi", "Martini", "Ferri", "Nardi", "Gioia", "Primavera", "Il Poggio", "La Collina", "Mare Blu", "Il Calice", "Arcobaleno", "Energy", "Fit", "Posta", "Vittoria", "del Porto", "San Marco"];
const CONDOMINI = ["Aurora", "Il Faro", "Le Querce", "Parco Sole", "Il Glicine", "Girasole", "Le Magnolie", "Le Palme", "Le Vele", "Primavera", "Il Castello", "San Giorgio", "Belvedere", "Le Rose", "Il Pino", "via Verdi 14", "via Roma 22", "corso Italia 5", "via Manzoni 9", "via Dante 8", "via Garibaldi 3", "Parco Fiorito", "Villa Serena"];
const DONNE = new Set(["Giulia", "Paola", "Anna", "Elena", "Chiara", "Laura", "Silvia", "Monica", "Federica", "Teresa", "Carla", "Rita", "Lucia", "Sonia", "Marta", "Valentina", "Barbara"]);
/* Un cliente a caso, con le sue forme: nudo, "a", "da", "di", "con" */
function cliente() {
  const r = caso();
  if (r < 0.34) { const n = uno(NOMI_P), c = uno(COGNOMI); const d = DONNE.has(n); const s = caso(); const nudo = s < 0.45 ? n + " " + c : s < 0.75 ? c : (d ? "la " : "il ") + c; const art = nudo.startsWith("la ") ? "la" : nudo.startsWith("il ") ? "il" : ""; const x = nudo.replace(/^(?:la|il) /, "");
    return { nudo, a: art === "la" ? "alla " + x : art === "il" ? "al " + x : "a " + nudo, da: art === "la" ? "dalla " + x : art === "il" ? "dal " + x : "da " + nudo, di: art === "la" ? "della " + x : art === "il" ? "del " + x : "di " + nudo, con: art ? "con " + nudo : "con " + nudo }; }
  if (r < 0.46) { const t = uno(["la signora", "il signor", "il dottor", "l'avvocato", "l'ingegner", "il geometra", "l'architetto"]); const c = uno(COGNOMI); const nudo = t + " " + c; const f = t.startsWith("la ") ? "la" : t.startsWith("l'") ? "l'" : "il"; const x = nudo.replace(/^(?:la |il |l')/, "");
    return { nudo, a: (f === "la" ? "alla " : f === "l'" ? "all'" : "al ") + x, da: (f === "la" ? "dalla " : f === "l'" ? "dall'" : "dal ") + x, di: (f === "la" ? "della " : f === "l'" ? "dell'" : "del ") + x, con: "con " + nudo }; }
  if (r < 0.78) { const t = uno(TIPI_DITTA), n = uno(NOMI_DITTA); const voc = /^[aeiouh]/.test(t); const fem = /^(?:pizzeria|trattoria|farmacia|officina|palestra|panificio|pasticceria|gelateria|tabaccheria|lavanderia|ottica|enoteca|libreria|scuola|agenzia|autofficina|macelleria|fioreria)$/.test(t) && t !== "panificio"; const x = t + " " + n;
    return { nudo: (voc ? "l'" : fem ? "la " : "il ") + x, a: (voc ? "all'" : fem ? "alla " : "al ") + x, da: (voc ? "all'" : fem ? "alla " : "dal ") + x, di: (voc ? "dell'" : fem ? "della " : "del ") + x, con: "con " + (voc ? "l'" : fem ? "la " : "il ") + x }; }
  const c = uno(CONDOMINI); const conParola = caso() < 0.7; const x = (conParola ? "condominio " : "") + c;
  return { nudo: (conParola ? "il " : "") + x, a: (conParola ? "al " : "a ") + x, da: (conParola ? "al " : "a ") + x, di: (conParola ? "del " : "di ") + x, con: "con il " + (conParola ? "" : "condominio ") + x };
}

/* ---------- Tempo, soldi, lavori ---------- */
const ORE_P = ["una", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici"];
const GIORNI = ["domani", "oggi", "dopodomani","fra una settimana", "tra 3 giorni", "fra due settimane", "a fine mese", "lunedì della prossima settimana", "la prossima settimana giovedì", "il 1 dicembre", "in giornata", "a fine giornata",  "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "lunedì prossimo", "giovedì prossimo", "domattina", "stasera", "oggi pomeriggio", "domani mattina", "domani pomeriggio", "venerdì mattina", "il 12 ottobre", "il 3 novembre", "il 20/10", "martedì 14", "giovedì 22"];
function ora() {
  const r = caso();
  if (r < 0.45) return "alle " + (6 + Math.floor(caso() * 14)) + uno(["", "", "", " e mezza", " e un quarto", ":30", ":15", " e 45", " in punto"]);
  if (r < 0.7) return "alle " + uno(ORE_P) + uno(["", "", " e mezza", " e un quarto", " meno un quarto", " del pomeriggio", " di mattina"]);
  if (r < 0.8) return uno(["verso le ", "per le ", "entro le ", "ore "]) + (7 + Math.floor(caso() * 12));
  if (r < 0.88) return uno(["a mezzogiorno", "all'una", "alle 8 anzi alle 9", "alle 10 no alle 11"]);
  return "alle " + (7 + Math.floor(caso() * 12)) + ":" + uno(["00", "30", "15", "45"]);
}
const quando = () => { const r = caso(); return r < 0.6 ? uno(GIORNI) + " " + ora() : r < 0.75 ? ora() + " " + uno(GIORNI) : r < 0.88 ? uno(["tra un'ora", "fra mezz'ora", "tra due ore", "fra venti minuti", "tra un quarto d'ora", "fra un'oretta"]) : uno(GIORNI) + " " + ora(); };
const soldi = () => uno(["150", "300", "450", "800", "1.200", "1.500", "2.000", "2.800", "3.500", "4.800", "6.000", "12.000", "25.000", "900", "650", "1250", "3000"]) + uno([" euro", " euro", "", " €", " euro più iva", " euro iva inclusa", " euro iva 10", " iva al 22"]);
const soldiParole = () => uno(["mille euro", "duemila euro", "cinquecento euro", "tremila", "milleduecento euro", "ottocento euro", "quindicimila euro"]);
const LAVORI = ["rifacimento bagno", "getto del solaio", "massetto", "demolizione", "cappotto", "rifacimento tetto", "posa piastrelle", "intonaco", "tinteggiatura", "ponteggio", "impermeabilizzazione", "cucina", "cartongesso", "crepa", "muretto", "grondaie", "sostituzione caldaia", "manutenzione caldaia", "perdita", "scarico intasato", "miscelatore", "boiler", "autoclave", "termosifoni", "piatto doccia", "analisi fumi", "tubo rotto", "impianto gas", "quadro elettrico", "salvavita", "punti luce", "prese", "messa a terra", "fotovoltaico", "colonnina", "videocitofono", "impianto elettrico", "faretti", "allarme", "citofono", "ascensore", "pulizia scale", "facciata", "infiltrazione", "bilancio", "verbale", "rata", "sito web", "logo", "volantini", "servizio fotografico", "vetrina", "biglietti da visita", "potatura", "taglio siepi", "tagliando", "piega e colore", "cucina su misura", "persiane", "serramenti", "parquet", "cancello", "tapparelle", "zanzariere"];
const LAVORO = () => uno(LAVORI);
const COSE = ["il silicone", "le viti", "20 sacchi di cemento", "il nastro", "i tasselli", "il teflon", "i raccordi", "il cavo da 2 e mezzo", "le scatole 503", "le piastrelle", "la colla", "il primer", "la guaina", "le guarnizioni", "i faretti", "la vernice", "le cartucce", "la carta", "il gasolio", "le punte del trapano", "i guanti", "la scala", "il flessibile", "la tinta", "i sacchi della spazzatura"];

/* ---------- Contenuti ---------- */
const MSG = ["arrivo tra dieci minuti", "il materiale è arrivato", "domani non riesco a passare", "passo nel pomeriggio", "il preventivo è pronto", "la fattura te la mando stasera", "lunedì iniziamo alle 8", "serve che lasci aperto il cancello", "sono in ritardo di mezz'ora", "i lavori finiscono venerdì", "mi serve una foto del contatore", "la caldaia nuova arriva giovedì", "ci vediamo domani alle 9", "va bene per sabato", "il pezzo di ricambio non è ancora arrivato", "domani chiudiamo l'acqua dalle 8 alle 12", "ho bisogno delle chiavi", "il bonifico non è arrivato", "confermo l'appuntamento", "le foto sono pronte", "il lavoro è finito", "può pagare il saldo", "ci sentiamo in settimana", "stamattina passa il mio operaio", "mi mandi le misure", "la rata scade a fine mese", "l'assemblea è rinviata", "abbiamo trovato una perdita"];
const NOTE = ["<C.nudo> ha il cane in giardino", "<C.nudo> vuole {il parquet chiaro|le prese anche in camera|il box doccia grande|i sanitari sospesi|finire prima di natale|il colore bianco|lavorare solo di mattina}", "<C.nudo> {si lamenta|si è lamentato|si è lamentata} {del rumore|del ritardo|del prezzo|della polvere|del parcheggio}", "<C.nudo> paga sempre in ritardo", "<C.nudo> è {allergica|allergico} {alla polvere|all'ammoniaca|ai gatti}", "<C.nudo> {ha detto che ci pensa|ci pensa e mi fa sapere|non è convinto|non è convinta|è molto pignolo|è molto pignola}", "{al|dal} <C.nudo> {il contatore è in cantina|la chiave è sotto il vaso|il quadro è in garage|manca la messa a terra|la caldaia ha vent'anni|il cancello fa rumore|c'è l'amianto sul tetto}", "{da|a casa di} <C.nudo> {il muro è portante|l'impianto è vecchio|il tetto va rifatto|le tubature sono in piombo}", "il codice del cancello {di|della|del} <C.nudo> è 4412", "<C.nudo> ha pagato metà in anticipo", "<C.nudo> {preferisce|vuole} essere {chiamato|chiamata} dopo le 18", "la moglie di <C.nudo> vuole cambiare le piastrelle", "al condominio l'amministratore vuole {tre preventivi|il DURC|la polizza}", "il fornitore nuovo fa lo sconto del 10 per cento", "il prezzo del rame è salito", "il furgone fa un rumore strano", "il muratore domani non viene", "l'operaio nuovo è bravo", "la betoniera va revisionata", "il geometra ha detto che la pratica è in comune", "il permesso per il ponteggio non è ancora arrivato", "idea: {fare un listino nuovo|proporre la manutenzione annuale|fare le foto dei lavori per il sito|prendere un apprendista|fare la tessera fedeltà}"];
const DOMANDE = ["come si {sistema|ripara|sblocca|sostituisce|monta|calcola|dimensiona|fa} {una caldaia in blocco|un miscelatore|un salvavita che salta|la messa a terra|un massetto|il cappotto|un preventivo fatto bene|il ricarico|un impianto fotovoltaico|il computo metrico|un relè|la pendenza di uno scarico}", "quanto costa {al metro quadro|più o meno|di solito} {un cappotto|rifare un tetto|una caldaia a condensazione|un impianto elettrico|rifare un bagno|una tinteggiatura|un massetto}", "ogni quanto {va fatta|si fa|va controllata} {la revisione della caldaia|la verifica della messa a terra|la manutenzione dell'ascensore|la pulizia della canna fumaria}", "che {sezione di cavo|colla|malta|spessore|pressione|potenza|tassello|guaina} {serve|ci vuole|devo usare|uso|va bene} per {un forno|il gres|un muro in pietra|il massetto|la caldaia|il fotovoltaico|il cartongesso|un terrazzo}", "è obbligatori{o|a} {la dico|la SCIA|il DURC|la maggioranza|il libretto} per {cambiare una presa|rifare il bagno|il cappotto|cambiare l'amministratore|la caldaia}", "serve {il permesso|la SCIA|l'assemblea|la dico|il progetto} per {il ponteggio|rifare la facciata|un impianto sopra i 6 kilowatt|sostituire la caldaia centralizzata|chiudere il balcone}", "{mi consigli|secondo te|conviene|è meglio} {il forfettario|comprare il furgone|prendere un apprendista|chiedere l'acconto|fare il listino|aumentare i prezzi}", "perché {la caldaia perde pressione|salta il salvavita|il muro fa la muffa|l'intonaco si stacca|lo scarico fa cattivo odore}", "che differenza c'è tra {intonaco e rasatura|magnetotermico e differenziale|caldaia a condensazione e camera stagna|gres e ceramica}", "chi paga {la sostituzione delle finestre|il rifacimento dei balconi|l'ascensore|le spese di pulizia} {in condominio|tra i condomini}", "come {trovo|faccio a trovare} {clienti nuovi|un operaio|un fornitore affidabile}", "quanto devo {mettere da parte per le tasse|chiedere all'ora|fatturare per stare tranquillo}", "cos'è {il DURC|la SCIA|il SAL|il superbonus|la dico|la ritenuta d'acconto}"];

/* ---------- Le grammatiche per azione ---------- */
const G = {
  calendario: [
    "[<RIEMPI>]{segna|segnami|metti|mettimi|fissa|fissami|prenota|aggiungi|scrivi in agenda|metti in calendario} <QUANDO> {<LAVORO> <C.da>|appuntamento <C.con>|sopralluogo <C.da>|<LAVORO> per <C.nudo>|incontro <C.con>}",
    "[<RIEMPI>]<QUANDO> {<LAVORO>|sopralluogo|appuntamento|consegna|riunione|preventivo|verifica|montaggio|intervento} {<C.da>|<C.a>|per <C.nudo>|<C.di>}",
    "[<RIEMPI>]<QUANDO> {devo andare|devo essere|devo passare|passo|vado|sono} <C.da> [per {il|la} <LAVORO>]",
    "[<RIEMPI>]{ho|abbiamo} {appuntamento|un appuntamento|il sopralluogo|l'incontro} <C.con> <QUANDO>",
    "[<RIEMPI>]<QUANDO> {arriva|viene|passa} {il camion|il fornitore|il tecnico|l'elettricista|il muratore|il geometra|la betoniera|il ponteggio} [<C.da>]",
    "[<RIEMPI>]<QUANDO> {dentista|banca|commercialista|meccanico|posta|revisione del furgone|riunione in cantiere|dal notaio}",
    "[<RIEMPI>]{ricordami|ricordamelo|avvisami} <QUANDO> di {chiamare|sentire|richiamare|passare da} <C.nudo>",
    "[<RIEMPI>]{tra un'ora|fra mezz'ora|tra due ore|fra venti minuti} {devo richiamare|chiamo|passo da|devo sentire} <C.nudo>",
    "[<RIEMPI>]<QUANDO> <LAVORO> <C.da> {e poi|poi|,} <ORA> <LAVORO> <C.da>",
    "[<RIEMPI>]{il|la} <LAVORO> <C.di> {segnalo|mettilo|fissalo} <QUANDO>",
    "[<RIEMPI>]{mercoledì|giovedì|venerdì|lunedì} <ORA> {anzi|no} <ORA> <LAVORO> <C.da>",
    // richieste indirette (30/09)
    "{me lo segni|me lo metti in agenda|mi segni|me lo metti in calendario}[?] <QUANDO> {<LAVORO>|sopralluogo|riunione|appuntamento} <C.da>",
    "<QUANDO> {devo fare|c'è|ho} {il|la} <LAVORO> <C.da>, {me lo segni|me lo metti in agenda|segnamelo}[?]",
    "{ho preso|ho fissato|abbiamo fissato} appuntamento <C.con> {per|} <QUANDO>",
    "<C.nudo> mi {aspetta|ha dato appuntamento|vuole vedere} <QUANDO> [per {il|la} <LAVORO>]",
    "{c'è da andare|bisogna andare|devo andare} <C.da> <QUANDO>",
    // giro 13: parole inglesi, frasi lunghe con più pensieri
    "{call|meeting|riunione|call veloce} {con|col} {il geometra|il fornitore|<C.nudo>|la squadra} <QUANDO>",
    "deadline {logo|sito|preventivo|consegna} {per|di} <C.nudo> <QUANDO>",
    "allora oggi {da|dal|dalla} <C.nudo> tutto ok, <QUANDO> torno per {il|la} <LAVORO> e ricordami di comprare <COSA>",
    // telegramma (giro 11)
    "<C.nudo> {domani|lunedì|martedì|mercoledì|giovedì|venerdì|sabato} {7|8|9|10|11|14|15|16|17} <LAVORO>",
    "<C.nudo> <LAVORO> {domani|lunedì|martedì|mercoledì|giovedì|venerdì|sabato} {7|8|9|10|11|14|15|16|17}",
    "{mo'|mo|e mo'} {segnami|segna} che <QUANDO> vado <C.da> {pe'|per} {il|la} <LAVORO>",
  ],
  calendario_modifica: [
    "[<RIEMPI>]{sposta|spostami|rimanda|posticipa|anticipa|rinvia} {l'appuntamento|il sopralluogo|la consegna|la riunione|l'incontro|la verifica|il <LAVORO>} <C.di> {a <GIORNO>|<ORA>|a <GIORNO> <ORA>}",
    "[<RIEMPI>]{sposta|rimanda|anticipa} <C.nudo> {<ORA>|a <GIORNO>|a <GIORNO> <ORA>}",
    "[<RIEMPI>]{l'appuntamento|il sopralluogo|la consegna|la verifica|l'incontro} <C.con> {spostalo|spostala|me lo sposti|rimandalo|rimandala|fallo slittare|anticipalo} {<ORA>|a <GIORNO>|a <GIORNO> <ORA>}",
    "[<RIEMPI>]{annulla|cancella|elimina|togli|disdici|leva} {l'appuntamento|il sopralluogo|la consegna|la riunione|l'impegno|la verifica} <C.con> [<GIORNO>]",
    "[<RIEMPI>]{annulla|cancella|elimina|togli} {l'appuntamento|il sopralluogo|la verifica|la consegna} <C.di> {che è saltato|che è saltata|, piove|perché non posso|che hanno chiuso}",
    "[<RIEMPI>]{l'appuntamento|il sopralluogo|la consegna} <C.con> {cancellalo|cancellala|annullalo|annullala|toglilo}",
    "[<RIEMPI>]{annulla|cancella} {gli appuntamenti|tutto|gli impegni} di <GIORNO>",
    "[<RIEMPI>]{mi sposti|mi cancelli|mi annulli} {l'appuntamento|il sopralluogo|l'incontro} <C.con> [<ORA>]",
    "[<RIEMPI>]<GIORNO> non riesco {ad andare|a passare} <C.da> {cancellalo|spostalo a <GIORNO>|annullalo}",
    "[<RIEMPI>]cambia {l'orario|l'ora} {dell'appuntamento|del sopralluogo} <C.con> <ORA>",
    "[<RIEMPI>]{il sopralluogo|la consegna|l'appuntamento|la verifica} <C.da> {lo facciamo|la facciamo|lo spostiamo|la spostiamo|rimandiamolo|rimandiamola|spostiamolo|spostiamola} {<ORA>|a <GIORNO>} [invece che <ORA>]",
    "[<RIEMPI>]<C.nudo> ha {disdetto|annullato|chiamato}, {cancella|annulla|sposta a <GIORNO>} {l'appuntamento|il sopralluogo|la manutenzione} [di <GIORNO>]",
    "{niente|guarda|no}, {il sopralluogo|l'appuntamento|la consegna} <C.da> {salta|non si fa più|è saltato}, {toglilo|cancellalo|toglila|cancellala}",
    "{il sopralluogo|l'appuntamento|la consegna} <C.da> {spostamelo|spostamela|rimandamelo|cancellamelo|annullamelo} {a <GIORNO>|<ORA>|a <GIORNO> <ORA>|}",
  ],
  mente: [
    "[<RIEMPI>]<NOTA>",
    "[<RIEMPI>]{ricordati|ricorda|segnati|tieni a mente|mettilo nella mente|appunta|annota|prendi nota|nota} {che|:} <NOTA>",
    "[<RIEMPI>]{ricordami di|devo|mi devo ricordare di|non dimenticare di|da fare:} {comprare|prendere|ordinare|ritirare} <COSA> [per <C.nudo>]",
    "[<RIEMPI>]{ricordami di|devo|mi devo ricordare di} {chiamare|richiamare|sentire} <C.nudo> {per il saldo|per il preventivo|per le misure|per la fattura}",
    "[<RIEMPI>]{ricordami di|devo} {rinnovare|pagare|controllare|mandare} {il DURC|l'assicurazione del furgone|la bolletta|la polizza|il bollo|il verbale|il bilancio|il patentino}",
    "[<RIEMPI>]{segnami|segna} che devo {comprare <COSA>|richiamare <C.nudo>|passare <C.da>|ordinare <COSA>}",
    "[<RIEMPI>]{nota per|appunto per} <C.nudo>: <NOTA>",
    "[<RIEMPI>]{cose da comprare|lista della spesa}: <COSA>, <COSA> e <COSA>",
    "[<RIEMPI>]{ho finito|finito|fatto} {il|la} <LAVORO> <C.da> {, tutto a posto|, manca solo il collaudo|, domani consegna|}",
    "[<RIEMPI>]<C.nudo> vuole {un preventivo|due preventivi|il preventivo} anche per {il|la} <LAVORO>",
    "[<RIEMPI>]<C.nudo> {vuole|preferisce} i lavori {solo di sabato|solo la mattina|ogni lunedì|il pomeriggio}",
    "[<RIEMPI>]{bisogna|c'è da|bisognerebbe|ci sarebbe da} {comprare|ordinare|prendere|ritirare} <COSA> [per <C.nudo>]",
    "[<RIEMPI>]{per|al|alla|dal} <C.nudo> {servono|serve|ci vogliono|ci vuole} <COSA>",
    "[<RIEMPI>]{mi ricordi di|ricordami di} {comprare|prendere|ordinare} <COSA>[?]",
    "[<RIEMPI>]{oggi|ieri|stamattina|prima} {sono stato|sono passato|sono andato} <C.da> e {il bagno è quasi finito|manca solo il collaudo|tutto a posto|il cliente è contento|c'è da rifare il pezzo}",
    "[<RIEMPI>]{oggi|stamattina|ieri} ho {parlato con|visto|sentito} <C.nudo> e {mi ha detto che ci pensa|vuole anche <LAVORO>|paga a fine mese|è contento}",
    "{compra|prendi|ordina} <COSA>",
    "{non dimenticare di|non scordarti di} {ordinare|comprare|prendere|chiamare} {<COSA>|<C.nudo>}",
    "{non scordarti che|non dimenticare che|ricordati che} <C.nudo> {vuole|preferisce|ha chiesto} {il box doccia in cristallo|il colore bianco|la certificazione|le prese in più}",
  ],
  documento: [
    "[<RIEMPI>]{fammi|fai|prepara|preparami|crea|creami|emetti|fammi un|mi fai un|mi prepari un} {preventivo|fattura|preventivo|fattura} {per|a} <C.nudo> {per|di} {il|la} <LAVORO> <SOLDI>",
    "[<RIEMPI>]{preventivo|fattura} <C.nudo> <LAVORO> <SOLDI>",
    "[<RIEMPI>]{preventivo|fattura} {per|a} <C.nudo>: <LAVORO> <SOLDI>, <LAVORO> {20|30|12|45|8} {metri quadri|mq|metri|pezzi} a {35|40|55|12|90} euro[, <LAVORO> <SOLDI>]",
    "[<RIEMPI>]{allora|dunque|} preventivo per <C.nudo> {demolizione|smontaggio|fornitura} <SOLDI> {poi|e|,} {posa|montaggio|manodopera} {18|25|40} {mq|metri quadri|ore} a {30|40|45} euro {e|,} {smaltimento|pulizia finale|trasporto} <SOLDI>",
    "[<RIEMPI>]{fattura|preventivo} di <SOLDI> {a|per} <C.nudo> per {il|la} <LAVORO>",
    "[<RIEMPI>]{fattura d'acconto|fattura di saldo|fattura acconto} {a|per} <C.nudo> <SOLDI>",
    "[<RIEMPI>]{mi serve un|serve un|devo fare un|devo fare il} preventivo per <C.nudo> {per|di} {il|la} <LAVORO> [circa <SOLDI>]",
    "[<RIEMPI>]{preventivo|fattura} {per|a} <C.nudo> <SOLDI_PAROLE> per {il|la} <LAVORO>",
    "{fammi|fai} 'na {fattura|preventivo} <C.a> di <SOLDI_PAROLE> per {il|la} <LAVORO>",
    "{fattura|preventivo} <C.nudo> <LAVORO> <SOLDI>",
    "[<RIEMPI>]{fai|fammi} {un preventivo|una fattura} {per|a} <C.nudo>",
  ],
  cerca_documento: [
    "[<RIEMPI>]{fammi vedere|mostrami|mi fai vedere|apri|trova|cerca|dove sono|dove ho messo} {i preventivi|le fatture|il preventivo|la fattura|i documenti|le foto} <C.di>",
    "[<RIEMPI>]{mi serve|mi servono|dammi|mi dai} {il preventivo|la fattura|i documenti|la dico|il DURC|la visura} <C.di>",
    "[<RIEMPI>]{le foto|la foto|le fotografie} {del bagno|del tetto|del quadro|del cantiere|della cucina|della caldaia|del contatore|della crepa|della facciata} <C.di>",
    "[<RIEMPI>]{mandami|mi mandi|mi giri|fammi avere} {il preventivo|la fattura|le foto} <C.di>",
    "[<RIEMPI>]{hai|c'è} {il preventivo|la fattura} <C.di>?",
    "[<RIEMPI>]{il DURC|la visura camerale|la polizza|il contratto|il certificato} [<C.di>]",
  ],
  invio_documento: [
    "[<RIEMPI>]{manda|invia|spedisci|inoltra|gira|mandagli|inviagli|giragli} {il preventivo|la fattura|il pdf del preventivo|il documento} <C.a>",
    "[<RIEMPI>]{manda|invia|spedisci} {il preventivo|la fattura} <C.a> {su whatsapp|per whatsapp|per mail|per email|via mail|con whatsapp|}",
    "[<RIEMPI>]{manda|invia} <C.a> {il preventivo|la fattura} {del|della} <LAVORO>",
    "[<RIEMPI>]{mandalo|invialo|giralo|mandala|inviala} <C.a> [su whatsapp]",
    "[<RIEMPI>]{mandagli|inviagli|mandale} {la fattura|il preventivo} {su whatsapp|per mail|}",
  ],
  messaggio: [
    "[<RIEMPI>]{scrivi|scrivigli|scrivile|manda un messaggio|manda un whatsapp|messaggio|whatsapp} <C.a> {che|:} <MSG>",
    "[<RIEMPI>]{dì|di'|di|dici|dite} <C.a> che <MSG>",
    "[<RIEMPI>]{avvisa|informa|fai sapere a} <C.nudo> che <MSG>",
    "[<RIEMPI>]{rispondi|rispondigli|rispondile} <C.a> che <MSG>",
    "[<RIEMPI>]{chiedi|domanda|chiedigli} <C.a> se {può pagare l'acconto|ha trovato le piastrelle|va bene sabato|mi manda le misure|è a casa domani}",
    "[<RIEMPI>]{manda|mandagli} un {messaggio|whatsapp|sms} <C.a> {per confermare|per spostare a <GIORNO>|per ricordare il saldo|per dire che <MSG>}",
    "[<RIEMPI>]{scrivi|manda un messaggio} <C.a>",
    "[<RIEMPI>]{fai sapere|fagli sapere|falle sapere} <C.a> che <MSG>",
    "[<RIEMPI>]{mi mandi|mandi|puoi mandare|potresti mandare} un {messaggio|whatsapp} <C.a> che <MSG>[?]",
  ],
  email: [
    "[<RIEMPI>]{manda|invia|scrivi} {una mail|una email|una e-mail|un'email} <C.a> {con|per} {il preventivo|le misure|il riepilogo|il cronoprogramma|il verbale|il bilancio|le foto|la convocazione}",
    "[<RIEMPI>]{mail|email} <C.a> {con|per} {il preventivo|le misure|il riepilogo|le foto|il verbale|la dichiarazione di conformità}",
    "[<RIEMPI>]{scrivi|rispondi} {per mail|per email|via mail|per posta elettronica} <C.a> che <MSG>",
    "[<RIEMPI>]{manda|invia} {una mail|una email} <C.a>",
  ],
  chiamata: [
    "[<RIEMPI>]{chiama|chiamami|telefona a|telefonami|fai il numero di|componi il numero di|fammi parlare con|passami|richiama|fai partire una chiamata a} <C.nudo>",
    "[<RIEMPI>]{telefona|fai una telefonata|fai una chiamata} <C.a>",
    "[<RIEMPI>]{chiamata|telefonata} <C.a> {adesso|subito|ora|}",
    "{puoi|potresti|mi puoi} {telefonare|chiamare} <C.a>[?]",
    "{mi chiami|chiamami|mi fai chiamare} <C.nudo>[?]",
  ],
  cliente: [
    "{<C.nudo>|<C.nudo>|<C.nudo>?|apri <C.nudo>|scheda <C.di>|il cliente <C.nudo>|fammi vedere <C.nudo>}",
    "[<RIEMPI>]{nuovo cliente|aggiungi|aggiungi cliente|aggiungi il cliente|salva|salvami il numero di|inserisci|registra|crea il cliente|metti nei clienti} <NUOVO> {<TEL>|telefono <TEL>|numero <TEL>|<TEL> <LAVORO>}",
    "[<RIEMPI>]{nuovo cliente|aggiungi ai clienti|crea il cliente|nuovo contatto} <NUOVO>",
    "[<RIEMPI>]{aggiungi|salva|aggiungi il cliente|metti} <NUOVO>",
    "[<RIEMPI>]{aggiungi|salva} {<NUOVO>|<C.nudo>} [nei clienti]",
    "[<RIEMPI>]{aggiungi|salva|nuovo contatto|aggiungi il contatto} {<NUOVO>|Idraulica <NUOVO>|Edil <NUOVO>|Ferramenta <NUOVO>} {fornitore|idraulico|elettricista|muratore|commercialista|geometra|imbianchino|cliente} <TEL>",
  ],
  dati: [
    "[<RIEMPI>]{cosa|che cosa|che} {ho|devo fare|c'è in programma|ho in agenda} <GIORNO>[?]",
    "[<RIEMPI>]{che lavori|che impegni|che appuntamenti|quanti appuntamenti} ho <GIORNO>[?]",
    "[<RIEMPI>]{cosa ho|che impegni ho|com'è} {la prossima settimana|questa settimana|la settimana}[?]",
    "[<RIEMPI>]{sono libero|ho tempo|sono occupato|ho qualcosa} <GIORNO>[?]",
    "[<RIEMPI>]quanto {mi deve|deve ancora|mi deve ancora} <C.nudo>[?]",
    "[<RIEMPI>]{chi mi deve|chi non ha pagato|chi deve ancora pagare|chi è in ritardo con i pagamenti|chi mi deve ancora dei soldi|quanti soldi devo incassare}[?]",
    "[<RIEMPI>]quanto ho {incassato|fatturato|guadagnato} {questo mese|quest'anno|a settembre|la settimana scorsa|oggi|il mese scorso}[?]",
    "[<RIEMPI>]{quanti preventivi|quante fatture} ho {fatto|mandato} {questo mese|quest'anno|}[?]",
    "[<RIEMPI>]{quanti clienti ho|quanti cantieri ho aperti|quante urgenze ho|quanta iva devo pagare}[?]",
    "[<RIEMPI>]quando {devo vedere|vedo|ho appuntamento con|passo da} <C.nudo>[?]",
    "[<RIEMPI>]{dimmi|fammi vedere|mostrami} {i miei impegni|l'agenda|il programma} di <GIORNO>",
    "{che ho|cos'ho|che c'è} <GIORNO>[?]",
    "<GIORNO> {cosa c'è|che ho|cosa devo fare}[?]",
    "{chi è moroso|chi sono i morosi|chi non paga}[?]",
    "quanto devo {prendere ancora|ancora prendere|incassare} <C.da>[?]",
  ],
  domanda: [
    "[<RIEMPI>]<DOMANDA>[?]",
    "[<RIEMPI>]{scusa|senti|dimmi|una domanda} <DOMANDA>[?]",
    "{mi sento un po' giù|sono stanco|che giornata|non so cosa fare|come stai|che fai|chi sei}",
  ],
  incasso: [
    "[<RIEMPI>]<C.nudo> {ha pagato|mi ha pagato|ha saldato|mi ha dato|ha versato|mi ha fatto il bonifico di} <SOLDI>[ {in contanti|con bonifico|con assegno}]",
    "[<RIEMPI>]{ho incassato|ho preso|ho ricevuto|incassati|ricevuti} <SOLDI> <C.da>",
    "[<RIEMPI>]{è arrivato|mi è arrivato|arrivato} il bonifico <C.di> [di] [<SOLDI>]",
    "[<RIEMPI>]<C.nudo> {mi ha pagato|ha pagato|ha saldato} {la fattura|il preventivo|l'acconto|il saldo|la rata} [<SOLDI>]",
    "[<RIEMPI>]{segna|registra} {che|} <C.nudo> ha {pagato|saldato} [<SOLDI>]",
    "[<RIEMPI>]{pagati|incassati} <SOLDI> {in contanti|con bonifico} <C.da>",
    "[<RIEMPI>]{mi sono arrivati|sono arrivati|ho ricevuto} i soldi <C.di>[,] [<SOLDI>]",
    "[<RIEMPI>]<C.nudo> mi ha {girato|mandato|fatto} {<SOLDI>|il bonifico}",
    "[<RIEMPI>]{pagata|saldata} la fattura <C.di>[,] <SOLDI>",
  ],
  foto: [
    "[<RIEMPI>]{fai|fammi|scatta|scattami|prendi} {una foto|la foto|delle foto|foto} {al quadro|al contatore|al tetto|al massetto|al muro|alla crepa|alla caldaia|al boiler|al cantiere|al lavoro finito|alla vetrina|alla siepe|all'ascensore|al portone|al pavimento|allo scarico|al collettore|alla facciata}",
    "[<RIEMPI>]{fotografa|fotografami} {il quadro|la crepa|il contatore|il lavoro|il cantiere}",
    "[<RIEMPI>]{foto al quadro|foto alla crepa|foto al contatore|foto al tetto|foto alla caldaia|foto al lavoro} <C.di>",
    "[<RIEMPI>]{fai una foto|scatta} e {crea il cliente|aggiungi il cliente} <NUOVO>",
    "foto {massetto|contatore|caldaia|quadro|crepa|tetto|muro|scarico|boiler|vetrina|siepe}",
  ],
  cartella: [
    "[<RIEMPI>]{crea|creami|fai|apri|aggiungi|nuova} {la cartella|una cartella|cartella} <CARTELLA>",
    "[<RIEMPI>]{metti|segna|scrivi|aggiungi} {in|nella} {cartella|} <CARTELLA> {che|:} <NOTA>",
    "[<RIEMPI>]{nella cartella|in} <CARTELLA> {metti|segna} {di chiamare <C.nudo>|che il prezzo è salito|<COSA>}",
  ],
  urgenza: [
    "[<RIEMPI>]{urgente|urgenza|emergenza|è urgente|corri} {<C.da>|<C.a>} {perde il tubo|è saltata la corrente|allagamento|caldaia in blocco|non c'è acqua calda|è crollato il controsoffitto|infiltrazione dal tetto|l'ascensore è bloccato|cortocircuito}",
    "[<RIEMPI>]{urgente|urgenza|emergenza} {perdita|allagamento|blackout|guasto|infiltrazione|crollo} {<C.da>|<C.a>}",
    "[<RIEMPI>]{urgente|è urgente} <C.nudo> {non ha corrente|non ha acqua|ha il tetto che perde|ha la caldaia in blocco|è senza riscaldamento}",
  ],
  sal: [
    "[<RIEMPI>]{sal|SAL|stato avanzamento lavori|stato di avanzamento} {al|del} {20|30|40|50|60|70|80|90}{%| per cento| percento} {per <C.nudo>|<C.di>}",
    "[<RIEMPI>]{fammi|fai|segna|nuovo} {il SAL|il sal|lo stato di avanzamento} <C.di> [al {30|50|70}%]",
  ],
  dico: [
    "[<RIEMPI>]{fammi|fai|prepara|compila} {la dico|la DiCo|la dichiarazione di conformità} {per <C.nudo>|<C.di>|dell'impianto <C.di>}",
    "[<RIEMPI>]{dico|dichiarazione di conformità} {per <C.nudo>|impianto <C.di>}",
    "dico <NUOVO>",
  ],
  assemblea: [
    "[<RIEMPI>]{convoca|segna|fissa|organizza|metti} {l'assemblea|un'assemblea|l'assemblea straordinaria|l'assemblea ordinaria} {del condominio|condominio|di} <COND> {per|} <GIORNO> <ORA> [per {il bilancio|il rifacimento del tetto|l'ascensore|la facciata}]",
    "[<RIEMPI>]assemblea {straordinaria|ordinaria|} {condominio|} <COND> <GIORNO> <ORA>",
    "{convoca|convocare} {straordinaria|ordinaria} <COND> <GIORNO> <ORA> [per {il bilancio|la piscina|il tetto}]",
  ],
  saluto: ["{ciao|ciao eon|buongiorno|buonasera|salve|ehi eon|grazie|grazie mille|ok grazie|perfetto grazie|ciao!|buongiorno eon|tutto bene?|ok|va bene grazie}"],
};

/* ---------- L'espansione ---------- */
function espandi(t, ctx) {
  // i pezzi del vocabolario
  t = t.replace(/<(\w+)(?:\.(\w+))?>/g, (_, k, forma) => {
    if (k === "C") { const c = ctx.c || (ctx.c = cliente()); return c[forma || "nudo"]; }
    if (k === "QUANDO") return quando();
    if (k === "ORA") return ora();
    if (k === "GIORNO") return uno(GIORNI);
    if (k === "LAVORO") return LAVORO();
    if (k === "SOLDI") return soldi();
    if (k === "SOLDI_PAROLE") return soldiParole();
    if (k === "COSA") return uno(COSE);
    if (k === "MSG") return uno(MSG);
    if (k === "NOTA") return espandi(uno(NOTE), { c: cliente() });
    if (k === "DOMANDA") return espandi(uno(DOMANDE), {});
    if (k === "RIEMPI") return uno(["allora ", "senti ", "eon ", "ok ", "ascolta ", "dunque ", "eh ", "allora praticamente ", "senti un po' ", "scusa ", "ehm ", "ciao eon ", "allora ascolta "]);
    if (k === "TEL") return uno(["333 1234567", "347 9988776", "339 4455661", "3481122334", "0187 123456", "010 234567", "345 6677889", "348 22 33 445"]);
    if (k === "NUOVO") return uno(NOMI_P) + " " + uno(COGNOMI);
    if (k === "CARTELLA") return uno(["Fornitori", "Materiali", "Idee", "Scadenze", "Personale", "Cantiere via Roma", "Noleggi", "Garanzie", "Verbali", "Contratti", "Sicurezza", "Polizze"]);
    if (k === "COND") return uno(CONDOMINI);
    return k;
  });
  // [x] e {a|b}: dall'interno verso l'esterno
  for (let giri = 0; giri < 20 && /[{[]/.test(t); giri++) {
    t = t.replace(/\{([^{}\[\]]*)\}/g, (_, x) => uno(x.split("|")));
    t = t.replace(/\[([^{}\[\]]*)\]/g, (_, x) => (caso() < 0.5 ? x : ""));
  }
  return t.replace(/\s+([,?:])/g, "$1").replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim();
}

/* Errori di dettatura come nella realtà (minuscole, senza accenti, parole storpiate) */
function sporca(t) {
  let x = t;
  if (caso() < 0.5) x = x.toLowerCase();
  if (caso() < 0.35) x = x.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (caso() < 0.5) x = x.replace(/[.,;!?]|:(?!\d)/g, ""); // "14:15" resta
  if (caso() < 0.2) {
    const parole = x.split(" ");
    const i = Math.floor(caso() * parole.length);
    const w = parole[i];
    if (w && w.length > 4 && !/\d/.test(w)) { const j = 1 + Math.floor(caso() * (w.length - 2)); parole[i] = caso() < 0.5 ? w.slice(0, j) + w.slice(j + 1) : w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2); }
    x = parole.join(" ");
  }
  return x.replace(/\s+/g, " ").trim();
}

export function generaFrasario(perIntento = 900) {
  const esempi = [], viste = new Set(), clienti = new Set();
  for (const [intento, regole] of Object.entries(G)) {
    let fatte = 0, tentativi = 0;
    while (fatte < perIntento && tentativi < perIntento * 15) {
      tentativi++;
      const ctx = {};
      const t = sporca(espandi(uno(regole), ctx));
      if (!t || viste.has(t)) continue;
      viste.add(t);
      if (ctx.c) clienti.add(ctx.c.nudo.replace(/^(?:il|la|l'|lo) /, "").replace(/^l'/, ""));
      esempi.push({ frase: t, intento });
      fatte++;
    }
  }
  return { esempi, clienti: [...clienti] };
}

// Da riga di comando: stampa qualche esempio per controllare a occhio
if (process.argv[1] && process.argv[1].endsWith("frasario.mjs")) {
  const { esempi } = generaFrasario(Number(process.argv[2] || 5));
  esempi.forEach((e) => console.log(e.intento.padEnd(20), e.frase));
}
