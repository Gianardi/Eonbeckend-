/* Il generatore di frasi per allenare il modello di EON (29/09/2026).
   Come parla un artigiano che detta al telefono: tanti modi di dire la
   stessa cosa, parole dei 5 mestieri, giorni/ore/importi/nomi scritti in
   modi diversi, riempitivi ("allora", "senti", "praticamente"), errori di
   dettatura (lettere perse o scambiate, niente punteggiatura).
   Ogni frase ha il suo INTENTO (cosa vuole: calendario, preventivo,
   messaggio…). I pezzi (chi, quando, quanto) li legge il lettore: il
   modello decide solo il cassetto.
   NON contiene le frasi vere di Andrea né quelle nuove per mestiere: quelle
   servono a misurarlo (eval/dati/), mai ad allenarlo.
   Uso: node eval/modello/genera-frasi.mjs [uscita.json] [quante-per-intento] */

import fs from "node:fs";

let seme = 20260929;
const caso = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
const uno = (a) => a[Math.floor(caso() * a.length)];
const forse = (p, x) => (caso() < p ? x : "");

/* ---------- Il vocabolario ---------- */
const NOMI = ["Rossi", "Mario Rossi", "Bianchi", "Luca Bianchi", "Ferraro", "Gino Ferraro", "Conti", "Paola Conti", "Santini", "Marco Santini",
  "Russo", "Elena Russo", "Galli", "Maria Galli", "Fontana", "Sandro Fontana", "Moretti", "Luca Moretti", "Bruni", "Franco Bruni",
  "Ricci", "Silvia Ricci", "Leone", "Andrea Leone", "Marino", "Giulia Marino", "Greco", "Fabio Greco", "Colombo", "Sara Colombo",
  "Esposito", "Romano", "Gallo", "Costa", "Giordano", "Mancini", "Lombardi", "Barbieri", "Rinaldi", "Caruso", "Ferrari", "Villa",
  "la signora Rota", "il signor Neri", "il dottor Pini", "l'avvocato Sala", "l'ingegner Monti", "il geometra Testa",
  "Bar Sport", "Bar Centrale", "Hotel Bellavista", "Pizzeria da Mario", "Officina Tosi", "Studio Rossi", "Palestra Fit", "Impresa Bedini", "Ditta Splendor",
  "condominio Aurora", "condominio Il Faro", "condominio via Verdi", "condominio Le Querce", "condominio Parco Sole", "il condominio Il Glicine"];
const LAVORI = {
  edile: ["rifacimento bagno", "getto del solaio", "massetto", "demolizione tramezzi", "cappotto termico", "rifacimento tetto", "posa piastrelle", "intonaco", "tinteggiatura", "ponteggio", "impermeabilizzazione terrazzo", "ristrutturazione cucina", "rasatura pareti", "cartongesso", "sostituzione coppi", "crepa sul muro", "scavo fondazioni", "muretto di recinzione"],
  idraulico: ["sostituzione caldaia", "caldaia in blocco", "perdita sotto il lavello", "revisione caldaia", "scarico intasato", "sostituzione miscelatore", "boiler", "autoclave", "radiatori", "valvole termostatiche", "piatto doccia", "analisi fumi", "tubo rotto", "allagamento cantina", "addolcitore", "pompa di calore", "scaldabagno"],
  elettricista: ["quadro elettrico", "salvavita che salta", "punti luce", "prese", "messa a terra", "fotovoltaico", "colonnina di ricarica", "videocitofono", "differenziale", "impianto elettrico", "faretti led", "cavi e canaline", "interruttori", "illuminazione giardino", "allarme"],
  amministratore: ["assemblea", "manutenzione ascensore", "pulizia scale", "rifacimento facciata", "infiltrazione dal tetto", "solleciti ai morosi", "bilancio consuntivo", "rata condominiale", "preventivo tetto", "verbale", "millesimi", "polizza del fabbricato", "caldaia centralizzata", "potatura del verde"],
  artigiano: ["sito web", "logo", "volantini", "consegna", "catering", "allestimento vetrina", "servizio fotografico", "grafica social", "menu nuovo", "biglietti da visita", "riparazione", "installazione", "corso", "stampa"],
};
const TUTTI_LAVORI = Object.values(LAVORI).flat();
const QUANDO = ["domani alle 9", "domani mattina alle 8", "domattina alle 7 e mezza", "oggi alle 15", "stasera alle 7", "oggi pomeriggio alle 4", "giovedì alle 10", "venerdì mattina alle 9",
  "lunedì alle 14", "lunedì prossimo alle 11", "martedì alle 8:30", "mercoledì alle 17", "sabato alle 9", "il 12 ottobre alle 10", "il 3 novembre alle 16", "il 20/10 alle 18",
  "dopodomani alle 11", "domani verso le 10", "fra un'ora", "tra mezz'ora", "tra due ore", "domani alle 18:30", "giovedì 15 alle 21", "alle 11", "alle 3 del pomeriggio", "ore 9", "domani ore 14"];
const GIORNO = ["domani", "oggi", "giovedì", "venerdì", "lunedì prossimo", "sabato", "dopodomani", "la settimana prossima", "il 12 ottobre", "martedì", "entro venerdì"];
const IMPORTI = ["500", "1.200", "300 euro", "2.000 euro", "€ 850", "1500", "3.000", "12mila", "25.000", "450 euro", "90 euro", "6.800", "milleduecento", "ottocento euro", "150 più iva", "2.400 iva inclusa", "30.000"];
const RIEMPITIVI = ["", "", "", "", "allora ", "senti ", "eon ", "ok ", "ascolta ", "dunque ", "eh ", "allora eon ", "ciao eon ", "senti un po' ", "scusa "];
const CHIUSURE = ["", "", "", "", " grazie", " per favore", " ok", " dai", " grazie mille", " subito"];
const CORTESIA = ["", "", "", "mi ", "mi puoi ", "puoi ", "potresti ", "per favore ", "me lo ", "riesci a "];

function riempi(t) {
  return t.replace(/\{(\w+)\}/g, (_, k) => {
    if (k === "nome") return uno(NOMI);
    if (k === "lavoro") return uno(TUTTI_LAVORI);
    if (k === "quando") return uno(QUANDO);
    if (k === "giorno") return uno(GIORNO);
    if (k === "importo") return uno(IMPORTI);
    if (k === "tel") return uno(["333 1234567", "347 9988776", "339 4455661", "3481122334", "0187 123456", "010 234567", "345 6677889"]);
    if (k === "doc") return uno(["preventivo", "fattura", "preventivo", "fattura", "preventivi", "fatture"]);
    if (k === "cartella") return uno(["Fornitori", "Lerici", "Casa al mare", "Idee", "Scadenze", "Personale", "Cantiere via Roma"]);
    if (k === "ora") return uno(["alle 11", "alle 16", "alle 9 e mezza", "alle 18", "a domani alle 10", "a giovedì alle 15", "a lunedì", "alle 14:30", "a venerdì mattina"]);
    return k;
  });
}
/* Errori di dettatura e di battitura, come nella realtà */
function sporca(t) {
  let x = t;
  if (caso() < 0.5) x = x.toLowerCase();
  if (caso() < 0.35) x = x.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (caso() < 0.5) x = x.replace(/[.,;:!?]/g, "");
  if (caso() < 0.25) {
    const parole = x.split(" ");
    const i = Math.floor(caso() * parole.length);
    const w = parole[i];
    if (w && w.length > 4 && !/\d/.test(w)) {
      const j = 1 + Math.floor(caso() * (w.length - 2));
      const r = caso();
      parole[i] = r < 0.33 ? w.slice(0, j) + w.slice(j + 1) : r < 0.66 ? w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2) : w.slice(0, j) + w[j] + w.slice(j);
    }
    x = parole.join(" ");
  }
  return x.replace(/\s+/g, " ").trim();
}

/* ---------- Gli intenti e i loro modi di dire ---------- */
const INTENTI = {
  calendario: [
    "{quando} verifica impianto da {nome}", "{quando} collaudo impianto {nome}", "{giorno} devo trovare un sostituto per il muratore",
    "{quando} sopralluogo da {nome}", "segna {quando} appuntamento con {nome}", "{quando} {lavoro} da {nome}", "{cortesia}segnami {quando} {lavoro} per {nome}",
    "metti in agenda {quando} {nome}", "fissa {quando} con {nome} per {lavoro}", "{quando} devo essere da {nome}", "{quando} passo da {nome} per il {lavoro}",
    "{quando} riunione in cantiere", "{quando} chiamare {nome}", "{quando} dentista", "{quando} dal commercialista", "{quando} vado in banca",
    "ho appuntamento {quando} con {nome}", "c'è da andare da {nome} {quando}", "{nome} {quando}", "{quando} consegna materiale da {nome}", "appuntamento {nome} {quando}",
    "ricordami {quando} di chiamare {nome}", "{giorno} devo passare da {nome}", "{giorno} ritirare il materiale dal fornitore", "{giorno} mandare la raccomandata a {nome}",
    "{quando} arriva il camion del calcestruzzo", "{quando} viene il tecnico per la caldaia", "{quando} revisione {lavoro} da {nome}", "segna per {giorno} {lavoro} {nome}",
    "{quando} {nome}. poi {quando} {lavoro}", "{quando} colazione con {nome} poi {quando} in cantiere", "domani devo vedere {nome} {ora}", "{quando} incontro con {nome} per il preventivo",
    "prenota {quando} {lavoro} per {nome}", "{quando} ho il meccanico", "{quando} prova collaudo da {nome}", "{quando} assemblea da {nome}",
  ],
  mente: [
    "libretto impianto da aggiornare per {nome}", "ho finito l'impianto di {nome}, manca solo la dico", "impianto di {nome} da controllare", "ricordarsi il libretto della caldaia di {nome}", "l'impianto di {nome} è vecchio, proporre il rifacimento",
    "ho finito il bagno di {nome}, tutto a posto", "ho finito il {lavoro} da {nome}", "fatto il {lavoro} da {nome}, manca solo il collaudo", "tutto a posto da {nome}", "verbale dell'assemblea di {nome}: approvato il bilancio", "verbale: si è deciso di rifare la facciata", "il muratore oggi non è venuto", "{nome} ha detto che ci pensa", "ho visto il cantiere di {nome}, è messo male", "il cliente {nome} è soddisfatto", "finito il {lavoro}, domani consegna",
    "devo comprare {lavoro}", "ricordami di comprare il silicone", "comprare nastro e viti", "chiamare il vetraio", "devo richiamare {nome}", "ordinare 20 sacchi di cemento",
    "idea: fare le foto dei lavori per il sito", "il furgone fa un rumore strano", "il prezzo del rame è salito", "{nome} vuole anche {lavoro}", "{nome} mi ha detto che paga a fine mese",
    "per {nome} portare la scala", "da ricordare: la chiave della cantina è dal portiere", "segnati che {nome} preferisce la mattina", "appunta che il codice del cancello è 4412",
    "nota: {lavoro} da {nome} va rifatto", "controllare l'assicurazione del furgone", "rinnovare il DURC", "pagare la bolletta", "prendere le misure della finestra di {nome}",
    "mi sono ricordato che {nome} ha il cane", "il muratore domani non viene", "pensare a un nuovo listino", "cercare un aiutante per l'estate", "{nome} è un cliente difficile, chiedere acconto",
    "scrivi negli appunti che {lavoro} costa di più", "mettilo nella mente: rivedere i prezzi", "da fare: {lavoro} per {nome}", "cose da comprare: tasselli, silicone, guanti",
    "il fornitore nuovo fa sconti sul cartongesso", "devo sentire {nome} per il saldo", "segnati di chiedere a {nome} le foto del prima", "ricorda che {nome} ha pagato metà",
    "segnami che devo richiamare {nome} per il saldo", "segna che devo ordinare {lavoro}", "prendi nota che devo passare da {nome}",
  ],
  documento: [
    "crea preventivo da {importo} per {lavoro} e mandalo a {nome}", "fai la fattura a {nome} di {importo} e mandagliela", "preventivo {importo} per {lavoro} e invialo a {nome}", "preventivo per l'impianto di {nome} {importo}",
    "{cortesia}fai un {doc} a {nome} per {lavoro} da {importo}", "{doc} per {nome} {lavoro} {importo}", "fammi il {doc} di {nome} {importo} per {lavoro}", "prepara {doc} {nome} {lavoro}",
    "crea {doc} per {nome} di {importo}", "nuovo {doc} a {nome} per {lavoro}", "devo fare il {doc} a {nome}", "{doc} {nome} {importo}", "emetti fattura a {nome} di {importo} per {lavoro}",
    "fai preventivo {lavoro} {importo} per {nome} iva al 10%", "preventivo per {nome}: {lavoro} 800 euro, {lavoro} 30 mq a 45 euro, manodopera 1200", "fattura a {nome} per {lavoro} {importo} più iva",
    "{nome} vuole un preventivo per {lavoro}, fammelo da {importo}", "scrivi il preventivo per {nome}", "compila la fattura di {nome} per {lavoro}", "fattura {importo} {nome}",
    "preventivo {lavoro} {nome}", "mi prepari il preventivo per il {lavoro} di {nome}", "fai fattura d'acconto a {nome} {importo}", "preventivo per {nome} demolizione 600 € piastrelle 18 mq a 40 € tinteggiatura 400 €",
  ],
  cerca_documento: [
    "DURC {nome}", "durc", "visura camerale", "foto dell'impianto di {nome}", "foto del quadro di {nome}", "mi serve la dico di {nome}", "le foto dell'impianto",
    "mi mandi il {doc} di {nome}?", "mi mandi il preventivo della {nome}", "mandami la fattura della {nome}", "mi giri il {doc} di {nome}?", "mi fai avere il {doc} di {nome}",
    "mandami il {doc} di {nome}", "mi serve il {doc} di {nome}", "fammi vedere le foto di {nome}", "dove è il {doc} di {nome}", "trova la fattura di {nome}", "mostrami i preventivi di {nome}",
    "apri il {doc} di {nome}", "mi dai la foto del {lavoro} di {nome}", "foto cantiere {nome}", "le foto del {lavoro}", "mi serve il DURC", "dammi la visura", "fammi vedere la polizza",
    "recupera il documento di {nome}", "voglio vedere il {doc} che ho fatto a {nome}", "cerca il contratto di {nome}", "mi mandi le foto dell'hotel", "hai il preventivo di {nome}?",
  ],
  invio_documento: [
    "manda il {doc} a {nome}", "invia il preventivo a {nome}", "mandalo a {nome}", "spedisci la fattura a {nome}", "invia la fattura di {nome} per email", "manda il preventivo di {nome} su whatsapp",
    "giralo a {nome}", "manda a {nome} il preventivo del {lavoro}", "inviagli la fattura", "manda il pdf del preventivo a {nome}",
  ],
  calendario_modifica: [
    "sposta {nome} {ora}", "sposta l'appuntamento con {nome} {ora}", "cancella l'appuntamento con {nome}", "annulla il sopralluogo di {giorno}", "rimanda {nome} a lunedì",
    "mi sposti l'incontro con {nome} {ora}", "mi cancelli appuntamento {nome}", "disdici {nome} di {giorno}", "togli dal calendario {nome}", "anticipa {nome} alle 8",
    "posticipa la riunione {ora}", "annulla gli appuntamenti di {giorno}", "sposta il {lavoro} di {nome} {ora}", "elimina l'impegno con {nome}", "no, {nome} spostalo {ora}",
    "cancella tutto il calendario di {giorno}", "rinvia il sopralluogo da {nome} a giovedì", "cambia l'orario di {nome} {ora}",
    // giro 5 (29/09/2026): l'impegno detto prima del verbo, e il perché in coda
    "l'appuntamento con {nome} lo sposti {ora}", "il sopralluogo di {nome} fallo slittare {ora}", "la verifica di {nome} spostala a {giorno}", "l'incontro con {nome} rimandalo a {giorno}",
    "cancella il {lavoro} da {nome} che è saltato", "togli l'appuntamento con {nome}, piove", "il sopralluogo da {nome} cancellalo", "fai slittare {nome} {ora}",
  ],
  messaggio: [
    "di' a {nome} che ci vediamo {quando}", "di a {nome} che arrivo {quando}", "scrivi a {nome} che {quando} ci sono", "dì a {nome} che passo {quando} per l'impianto",
    "scrivi alla signora {nome} che l'assemblea è rinviata", "scrivi al signor {nome} che passo domani", "manda un messaggio alla signora {nome}", "avvisa la signora {nome} che il lavoro è finito", "scrivi all'amministratore che la caldaia è pronta", "di' al geometra {nome} che i disegni sono arrivati",
    "scrivi a {nome} che arrivo {ora}", "di' a {nome} che domani non posso", "manda un messaggio a {nome}", "avvisa {nome} che il materiale è arrivato", "scrivi a {nome} che passo nel pomeriggio",
    "manda un whatsapp a {nome} che è tutto pronto", "dì a {nome} di lasciare aperto il cancello", "messaggio a {nome}: ci vediamo domani", "fai sapere a {nome} che la caldaia è pronta",
    "rispondi a {nome} che va bene", "scrivigli che ritardo di mezz'ora", "manda sms a {nome}", "scrivi a {nome} se va bene {quando}", "chiedi a {nome} se può pagare l'acconto",
  ],
  email: [
    "manda una mail a {nome}", "scrivi una email a {nome} con il riepilogo", "manda una e-mail a {nome} chiedendo le misure", "mail a {nome} per il preventivo", "invia una mail a {nome}",
    "scrivi a {nome} per email che il lavoro è finito", "manda una mail al fornitore per l'ordine", "rispondi per mail a {nome}",
  ],
  chiamata: ["chiama {nome}", "telefona a {nome}", "chiamami {nome}", "fai partire una chiamata a {nome}", "richiama {nome}", "chiama il {nome}", "fammi chiamare {nome}", "telefonata a {nome} adesso"],
  cliente: [
    "{nome}", "{nome}", "apri {nome}", "scheda di {nome}", "il cliente {nome}", "fammi vedere {nome}", "{nome}?",
    "aggiungi {nome} {tel}", "nuovo cliente {nome} {tel}", "nuovo cliente {nome} {tel} {lavoro}", "aggiungi cliente {nome}", "inserisci {nome} tra i clienti", "{nome} {tel} {lavoro}",
    "salva il numero di {nome} {tel}", "crea il cliente {nome}", "aggiungi ai clienti {nome}", "cliente nuovo: {nome}, telefono {tel}", "metti {nome} nei clienti", "registra {nome} come cliente",
  ],
  dati: [
    "clienti che devono pagare?", "clienti che non hanno pagato", "chi deve pagare?", "quanti soldi devo incassare?",
    "poi giornata libera?", "sono libero dopo pranzo?", "giornata libera domani?", "ho tempo giovedì?", "sono occupato {giorno}?", "com'è la mia settimana?", "quanti preventivi ho fatto questo mese?",
    "cosa ho da fare {giorno}?", "che impegni ho {giorno}?", "quanto mi deve {nome}?", "chi mi deve ancora pagare?", "quanto ho incassato questo mese?", "quanti cantieri ho aperti?",
    "sono libero {quando}?", "cosa c'è in agenda {giorno}?", "quando devo vedere {nome}?", "quanti clienti ho?", "quanto ho fatturato quest'anno?", "che programma ho {giorno}?",
    "ho impegni sabato?", "chi non ha pagato?", "quanta iva devo pagare?", "quante urgenze ho?", "cosa c'è nella cartella {cartella}?", "quanto ho incassato da {nome}?",
    "fammi vedere l'agenda di {giorno}", "dimmi i miei impegni di {giorno}", "mi dici cosa ho {giorno}?", "guarda se ho qualcosa {giorno}",
    "che lavori ho {giorno}?", "cosa ho la prossima settimana?", "cosa ho questa settimana", "cosa devo fare {giorno}", "quante fatture ho fatto quest'anno?", "quanti preventivi ho mandato?",
  ],
  domanda: [
    "ogni quanto va fatta la verifica dell'impianto di terra?", "come si fa la messa a terra di un impianto?", "che potenza serve per un impianto fotovoltaico?", "quanto costa rifare un impianto elettrico?", "serve la dico per cambiare una presa?",
    "devo rifare un pavimento, da dove inizio?", "cosa mi consigli di fare domani?", "quanto può valere la mia ditta?", "incasso 5.000 al mese e spendo 3.000, quanto guadagno?", "ho 2 operai a 1500 euro, quanto devo fatturare?", "serve la maggioranza per cambiare l'amministratore?", "da dove parto per un bagno nuovo?", "secondo te conviene comprare il furgone?", "come si fa a calcolare il ricarico?", "è meglio la partita iva forfettaria?", "quali documenti servono per aprire un cantiere?", "come si sistema una caldaia che va in blocco?", "cosa devo controllare prima di un getto?", "che assicurazione serve per un elettricista?",
    "come posso trovare nuovi clienti?", "quanto costa il cemento?", "cos'è il DURC?", "ogni quanto va fatta la revisione della caldaia?", "che sezione di cavo serve per un forno?",
    "come si calcolano i millesimi?", "perché la caldaia perde pressione?", "conviene il cappotto da 10 cm?", "come faccio ad aumentare il guadagno?", "che differenza c'è tra intonaco e rasatura?",
    "serve la SCIA per rifare il bagno?", "quanto devo mettere da parte per le tasse?", "mi consigli come organizzare la settimana?", "che ne pensi del nuovo listino?", "come si fa un preventivo fatto bene?",
    "che fai?", "chi sei?", "come stai?", "che palle non so cosa fare", "sono stanco oggi", "mi spieghi il superbonus?", "qual è il prezzo medio al metro per una tinteggiatura?",
    "devo chiedere l'autorizzazione al condominio per il ponteggio?", "come mi comporto con un cliente che non paga?",
    "che pressione deve avere la caldaia", "che colla uso per il gres", "che spessore deve avere il massetto", "che cavo serve per il forno", "quale tassello va bene per il cartongesso",
  ],
  incasso: [
    "{nome} ha pagato {importo}", "{nome} mi ha pagato l'acconto di {importo}", "ho incassato {importo} da {nome}", "segna che {nome} ha saldato", "ricevuto bonifico da {nome} di {importo}",
    "{nome} ha pagato", "incassati {importo} da {nome}", "{nome} mi ha dato {importo} in contanti", "pagato {nome} {importo}", "ho sostituito il {lavoro}, {importo} pagati in contanti",
    "{nome} ha fatto il bonifico", "la signora ha pagato la rata di {importo}",
    "{nome} mi ha pagato la fattura {importo}", "{nome} ha saldato il preventivo", "{nome} ha pagato la fattura", "mi ha pagato la fattura {nome}, {importo}",
  ],
  foto: [
    "fai la foto a cantiere", "fai la foto al cantiere", "foto all'impianto di {nome}", "scatta una foto all'impianto",
    "fai una foto", "scatta foto", "fammi la foto al {lavoro}", "fai foto a pavimenti", "fotografa la crepa", "fai una foto al quadro di {nome}", "scattami una foto del cantiere",
    "fai la foto al contatore", "fai delle foto al lavoro finito", "foto al {lavoro} di {nome}", "prendi una foto del tetto", "fai foto e crea il cliente {nome}",
  ],
  cartella: [
    "metti in cartella {cartella} sentire {nome} per il materiale", "segna in cartella {cartella} chiamare {nome}", "nella cartella {cartella} metti che il prezzo è salito",
    "metti in cartella {cartella} {lavoro}", "segna nella cartella {cartella} che il prezzo è salito", "aggiungi cartella {cartella}", "crea la cartella {cartella}", "nella cartella {cartella}: chiamare il fornitore",
    "scrivi in {cartella} che {nome} richiama", "nuova cartella {cartella}", "metti nella cartella {cartella} la nota per {nome}",
  ],
  urgenza: [
    "urgente {lavoro} da {nome}", "urgenza {lavoro} da {nome}", "urgente perdita d'acqua da {nome}", "emergenza: salta la corrente da {nome}", "corri da {nome}, {lavoro} urgente",
    "urgente allagamento da {nome}", "chiamata urgente da {nome} per {lavoro}", "è un'urgenza, {nome} ha {lavoro}",
  ],
  sal: ["fammi il SAL di {nome}", "SAL al 40% per {nome}", "stato avanzamento lavori {nome} al 60 per cento", "sal numero 2 del cantiere {nome}", "segna il sal al 30% di {nome}", "nuovo sal {nome} 50%"],
  dico: ["fammi la dichiarazione di conformità per {nome}", "dico per l'impianto di {nome}", "prepara la dico di {nome}", "dichiarazione di conformità impianto {nome}", "compila la DiCo per {nome}"],
  assemblea: [
    "convoca l'assemblea del {nome} {quando}", "assemblea straordinaria {nome} {quando}", "segna assemblea ordinaria {nome} {quando}", "assemblea condominio {nome} {quando} per il bilancio",
    "fissa l'assemblea del {nome} {quando}", "nuova assemblea {nome} {quando}",
  ],
  saluto: ["ciao", "buongiorno", "buonasera", "ciao eon", "grazie", "grazie mille", "ok grazie", "buongiorno eon", "salve", "ehi eon", "tutto bene?"],
};

/* ---------- La generazione ---------- */
const fuori = process.argv[2] || "eval/modello/frasi-allenamento.json";
const quante = Number(process.argv[3] || 700);
const esempi = [];
const viste = new Set();
for (const [intento, schemi] of Object.entries(INTENTI)) {
  let fatte = 0, tentativi = 0;
  const obiettivo = Math.min(quante, schemi.length * 60);
  while (fatte < obiettivo && tentativi < obiettivo * 20) {
    tentativi++;
    let t = riempi(uno(schemi).replace("{cortesia}", uno(CORTESIA)));
    if (intento !== "saluto") t = uno(RIEMPITIVI) + t + uno(CHIUSURE);
    t = sporca(t);
    if (viste.has(t)) continue;
    viste.add(t);
    esempi.push({ frase: t, intento });
    fatte++;
  }
}
// I nomi usati come clienti (senza "la signora", "il dottor"…): servono al lettore per metterli da parte
const clienti = [...new Set(NOMI.map((n) => n.replace(/^(?:la signora|il signor|il dottor|l'avvocato|l'ingegner|il geometra|il|la)\s+/i, "").replace(/^condominio\s+/i, "Condominio ")))];
fs.writeFileSync(fuori, JSON.stringify({ clienti, esempi }));
const conta = {};
esempi.forEach((e) => { conta[e.intento] = (conta[e.intento] || 0) + 1; });
console.log(`${esempi.length} frasi → ${fuori}`);
console.log(JSON.stringify(conta));
