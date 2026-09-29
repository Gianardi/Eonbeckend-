/* Il lettore unico di EON (29/09/2026).

   Andrea: "non possiamo dire per ogni cosa cosa deve fare EON… principio
   logico e non sistema IF". Come fanno Siri, Alexa, Google e gli assistenti
   aperti (Snips, Mycroft Adapt, Rasa): un solo lettore che in ogni frase
   trova i PEZZI (chi, quando, quanto, dove, cosa) e il CASSETTO (l'azione),
   con un vocabolario che si allarga — non una regola per ogni frase.

   Qui c'è solo la lettura: niente pagina, niente database. L'app
   (index.html) le passa i suoi dati (clienti, cartelle) e decide con le
   5 regole:
     1. c'è un giorno o un'ora                  → calendario
     2. azione chiara con tutti i pezzi         → la fa
     3. azione chiara ma manca un pezzo         → chiede solo quello
     4. domanda sui dati                        → risponde dai dati
     5. tutto il resto                          → Mente
   Così la stessa lettura si prova con migliaia di frasi in pochi secondi
   (eval/simulatore.test.mjs). Uso: EonLettore.leggi(testo, contesto). */
(function (root) {
  "use strict";

  /* ---------------- Parole ---------------- */
  function senzaAccenti(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function norm(t) {
    return senzaAccenti(String(t || "").toLowerCase()).replace(/\be-mail\b/g, "email").replace(/[’'`´]/g, " ")
      .replace(/[^a-z0-9€%:/.,\s-]/g, " ").replace(/(\d)[.,](?=\d)/g, "$1\u0001").replace(/[.,]/g, " ").replace(/\u0001/g, ".").replace(/\s+/g, " ").trim();
  }
  /* Parole con posizione: o = come scritta (senza punteggiatura ai bordi), n = normalizzata */
  function parole(testo) {
    return String(testo || "").replace(/[’'`´]/g, "' ").split(/\s+/).map((o) => {
      const pulita = o.replace(/^[^\p{L}\p{N}€]+|[^\p{L}\p{N}€%]+$/gu, "");
      // sep: finisce con una pausa scritta ("demolizione 600 €, piastrelle…")
      return { o: pulita, n: norm(pulita).replace(/\s+/g, ""), sep: /[,;:.]$/.test(o) };
    }).filter((p) => p.n);
  }
  const maiuscola = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const nomeBello = (s) => String(s || "").split(/\s+/).map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : maiuscola(w.toLowerCase()))).join(" ");

  /* Parole "vuote" (articoli, preposizioni, riempitivi) */
  const VUOTE = new Set("il lo la i gli le l un uno una un di da del dello della dei degli delle dal dallo dalla dai dagli dalle a ad al allo alla ai agli alle in nel nello nella nei negli nelle su sul sullo sulla sui sugli sulle con per tra fra e ed o che mi ti ci si me te ne".split(" "));
  const PREPOSIZIONI = new Set("di da del dello della dei degli delle dal dallo dalla a ad al allo alla ai agli alle in nel nella su sul sulla con per tra fra".split(" "));

  /* Nomi di persona più comuni in Italia: servono a riconoscere un cliente
     NUOVO ("finestre Luca Liverani", "fattura Chilosi Mario 2000") */
  const NOMI = new Set(("alessandro alessandra alessio alessia alberto alberta alfredo alice alda aldo amedeo andrea angela angelo anna annalisa antonella antonio antonia arianna armando arturo aurora barbara beatrice benedetta bruno bianca brigida camilla carla carlo carolina caterina cecilia chiara claudia claudio cristian cristina cristiano daniela daniele dario davide debora denis diego domenico donatella edoardo elena eleonora elisa elisabetta emanuele emanuela emma enrico enrica enzo erica ernesto eugenio fabio fabrizio fabiola federica federico filippo fiorella francesca francesco franco gabriele gabriella gaia giacomo giada gianluca gianluigi gianni giampiero giancarlo gianmarco gianfranco gino giorgia giorgio giovanna giovanni giulia giuliana giuliano giulio giuseppe giuseppina graziella gregorio guido ilaria irene italo ivan ivana jacopo laura lara lorenzo lorena luca lucia luciano luciana luigi luigia luisa manuel manuela marco marcello margherita maria mariagrazia marianna mariangela marina mario marisa marta martina massimo matteo mattia maurizio mauro michela michele mirco mirko monica nadia natale nicola nicoletta noemi omar orlando ottavio paola paolo pasquale patrizia patrizio pierluigi piero pietro pierpaolo raffaele raffaella renato renata riccardo rita roberta roberto rocco romano rosa rosanna rossella sabrina salvatore samuele sandra sandro sara sergio silvia silvio simona simone sofia stefania stefano teresa tiziana tiziano tommaso ugo umberto valentina valentino valeria valerio vanessa vincenzo vittoria vittorio walter")
    .split(" "));

  /* ---------------- Pulizia ---------------- */
  /* Cortesie e riempitivi ai bordi: "eon, per favore mi puoi fare…" = "fare…" */
  const INIZIO_CORTESIA = /^(?:(?:ehi|hey|ok|okay|allora|dunque|ascolta)\s*,?\s+)*(?:(?:senti|ascolta)\s*,\s*)?(?:eon\s*,?\s+)?(?:(?:per\s+favore|perfavore|per\s+cortesia|scusa)\s*,?\s+)?(?:(?:mi\s+)?(?:puoi|potresti|riesci\s+a|riusciresti\s+a|vorrei\s+che\s+tu)\s+)?/i;
  // "…, eon" solo con la virgola: "aggiungi cartella EON" è il nome della cartella
  const FINE_CORTESIA = /\s*,?\s*(?:per\s+favore|perfavore|per\s+cortesia|grazie(?:\s+mille)?)\s*[.!]*$|\s*,\s*eon\s*[.!]*$/i;
  /* "Guarda se ho impegni sabato" = domanda "ho impegni sabato?" */
  const INIZIO_DOMANDA = /^(?:(?:mi\s+)?(?:guardi|guarda|controlla|controlli|vedi|verifica|verifichi|dimmi|mi\s+dici|mi\s+sai\s+dire|sai|fammi\s+sapere)\s+(?:un\s+po\s+)?(?:se|quanto|quanti|quante|chi|cosa|quando|che)\b\s*)/i;

  /* Il verbo detto dando del tu diventa il comando (29/09/2026, frasi vere:
     "mi cancelli appuntamento Belle", "mi sposti l'incontro alle 17",
     "mandi e-mail a Rita…?", "mi crei preventivo…?"): come la
     lemmatizzazione degli assistenti, una regola per tutti i verbi in -are
     ("cancelli" → "cancella", "modifichi" → "modifica") e per il
     condizionale ("manderesti" → "manda"). */
  const IMPERATIVI_BASE = /^(?:cancella|sposta|rimanda|posticipa|anticipa|annulla|elimina|modifica|correggi|cambia|rinomina|archivia|manda|invia|crea|prepara|segna|chiama|richiama|telefona|mostra|trova|cerca|fissa|prenota|aggiorna|registra|salva|ricorda|appunta|annota|inserisci|aggiungi|metti|scrivi|fai|apri|togli|leggi|calcola|controlla|verifica|stampa|scarica|carica|condividi|compila|emetti|genera|programma|organizza|porta|passa|scatta|fotografa|svuota|recupera|ripristina|archivia|segnala|avvisa|ricordami)$/;
  function verboAlComando(w) {
    const x = w.toLowerCase();
    if (IMPERATIVI_BASE.test(x)) return x;
    if (x === "faresti" || x === "fareste") return "fai";
    if (/eresti$/.test(x)) { const r = x.replace(/eresti$/, "a"); if (IMPERATIVI_BASE.test(r)) return r; if (IMPERATIVI_BASE.test(r.replace(/a$/, "i"))) return r.replace(/a$/, "i"); }
    if (/(?:chi|ghi)$/.test(x)) { const r = x.replace(/hi$/, "a"); if (IMPERATIVI_BASE.test(r)) return r; }
    if (/i$/.test(x)) { const r = x.slice(0, -1) + "a"; if (IMPERATIVI_BASE.test(r)) return r; }
    return null;
  }
  function comandoDaTu(t, conDomanda) {
    const m = t.match(/^((?:(?:mi|ci)\s+)?)(\p{L}+)(\s|$)/iu);
    if (!m) return null;
    const verbo = verboAlComando(m[2]);
    if (!verbo || verbo === m[2].toLowerCase() && !m[1]) return null;
    // senza "mi/ci" davanti e senza "?", solo i verbi che non sono anche nomi ("cancelli da montare", "porti", "segni")
    if (!m[1] && !conDomanda && !/^(?:mandi|crei|prepari|sposti|annulli|elimini|modifichi|invii|chiami|fissi|prenoti|registri|aggiorni|manderesti|faresti|creeresti|prepareresti)$/i.test(m[2])) return null;
    if (/^(?:fai|faresti)$/i.test(m[2]) && /^\s*(?:vedere|sapere)\b/i.test(t.slice(m[0].length))) return null; // "mi fai vedere…?" è una domanda
    return verbo + m[3] + t.slice(m[0].length);
  }
  function pulisci(testo) {
    let t = String(testo || "").trim().replace(/\s+/g, " ");
    let domanda = /\?/.test(t);
    t = t.replace(/[?!.]+$/, "").trim();
    let prima;
    // "mi puoi…", "potresti…": è una richiesta a EON, non una cosa da fare tua
    let richiesta = /^(?:(?:ehi|hey|ok|allora|senti|eon)\W+)*(?:(?:per\s+favore|perfavore)\W+)?(?:mi\s+)?(?:puoi|potresti|riesci\s+a|riusciresti\s+a)\b/i.test(t);
    do { prima = t; t = t.replace(INIZIO_CORTESIA, "").replace(FINE_CORTESIA, "").trim(); } while (t !== prima && t);
    const comeComando = comandoDaTu(t, domanda);
    if (comeComando) { t = comeComando; richiesta = true; domanda = false; }
    const d = t.match(INIZIO_DOMANDA);
    if (d) {
      domanda = true;
      const parolaDomanda = d[0].trim().split(/\s+/).pop().toLowerCase();
      t = (parolaDomanda === "se" ? "" : parolaDomanda + " ") + t.slice(d[0].length);
    }
    return { testo: t.trim(), domanda, richiesta };
  }

  const PAROLE_DOMANDA = /^(?:quanto|quanta|quanti|quante|chi|cosa|che\s+cosa|che\s+(?:programma|impegni|appuntamenti|lavori|cantieri|clienti|fatture|preventivi|ore|giorno|tempo)|quale|quali|quando|dove|come|perche|c\s*e|ci\s+sono|mi\s+deve|mi\s+devono)\b/;

  /* ---------------- Quando ---------------- */
  const GIORNI = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  function isoGiorno(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  /* Trova giorno e ora, e segna le parole usate */
  function trovaQuando(pp, oggiRif) {
    const oggi = new Date(oggiRif || Date.now()); oggi.setHours(0, 0, 0, 0);
    const usate = new Set();
    let giorno = null, ora = null, fascia = null;
    const piu = (n) => { const d = new Date(oggi); d.setDate(d.getDate() + n); return d; };
    for (let i = 0; i < pp.length; i++) {
      const n = pp[i].n;
      if (giorno) break;
      if (n === "oggi" || n === "stamattina" || n === "stamani" || n === "stasera" || n === "stanotte") { giorno = oggi; usate.add(i); if (n !== "oggi") fascia = n; }
      else if (n === "domani" || n === "domattina") { giorno = piu(1); usate.add(i); if (n === "domattina") fascia = "mattina"; }
      else if (n === "dopodomani") { giorno = piu(2); usate.add(i); }
      else if (GIORNI.includes(n)) {
        let diff = (GIORNI.indexOf(n) - oggi.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        usate.add(i);
        if (pp[i + 1] && /^prossim[oa]$/.test(pp[i + 1].n)) usate.add(i + 1);
        if (i > 0 && /^(?:il|di|per|questo|questa|prossimo|prossima)$/.test(pp[i - 1].n)) usate.add(i - 1);
        giorno = piu(diff);
      } else if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(n)) {
        const [g, m, a] = n.split("/").map(Number);
        const d = new Date(a ? (a < 100 ? 2000 + a : a) : oggi.getFullYear(), m - 1, g);
        if (!a && d < oggi) d.setFullYear(d.getFullYear() + 1);
        if (d.getDate() === g) { giorno = d; usate.add(i); if (i > 0 && /^(?:il|per|entro)$/.test(pp[i - 1].n)) usate.add(i - 1); }
      } else if (/^\d{1,2}$/.test(n) && pp[i + 1] && MESI.includes(pp[i + 1].n)) {
        const d = new Date(oggi.getFullYear(), MESI.indexOf(pp[i + 1].n), Number(n));
        if (d < oggi) d.setFullYear(d.getFullYear() + 1);
        giorno = d; usate.add(i); usate.add(i + 1);
        if (i > 0 && /^(?:il|per|entro)$/.test(pp[i - 1].n)) usate.add(i - 1);
      }
    }
    /* Fra poco: "fra un'ora", "tra mezz'ora", "tra 2 ore", "fra 20 minuti",
       "tra un quarto d'ora" (29/09/2026, "Fra un ora incontro con Giulia") */
    for (let i = 0; i < pp.length - 1 && !ora; i++) {
      if (!/^(?:fra|tra)$/.test(pp[i].n)) continue;
      let j = i + 1, minuti = null;
      const a = pp[j] ? pp[j].n : "", b = pp[j + 1] ? pp[j + 1].n : "", c = pp[j + 2] ? pp[j + 2].n : "";
      const num = /^\d{1,3}$/.test(a) ? Number(a) : /^(?:un|una|uno)$/.test(a) ? 1 : /^due$/.test(a) ? 2 : /^tre$/.test(a) ? 3 : /^dieci$/.test(a) ? 10 : /^venti$/.test(a) ? 20 : /^trenta$/.test(a) ? 30 : /^quaranta$/.test(a) ? 40 : null;
      if (/^(?:mezzora|mezz)$/.test(a)) { minuti = 30; j += a === "mezz" && b === "ora" ? 2 : 1; }
      else if (a === "un" && b === "quarto") { minuti = 15; j += 2; if (pp[j] && pp[j].n === "d") j++; if (pp[j] && pp[j].n === "ora") j++; }
      else if (num !== null && /^(?:ora|ore|oretta|orette|h)$/.test(b)) { minuti = num * 60; j += 2; if (c === "e" && pp[j + 1] && /^(?:mezza|mezzo)$/.test(pp[j + 1].n)) { minuti += 30; j += 2; } }
      else if (num !== null && /^(?:minuti|minuto|min)$/.test(b)) { minuti = num; j += 2; }
      if (minuti === null || minuti > 24 * 60) continue;
      const adesso = new Date(oggiRif || Date.now());
      const t = new Date(adesso.getTime() + minuti * 60000);
      // arrotondato ai 5 minuti, come si segna un appuntamento
      t.setMinutes(Math.round(t.getMinutes() / 5) * 5, 0, 0);
      for (let k = i; k < j; k++) usate.add(k);
      if (!giorno) { const g = new Date(t); g.setHours(0, 0, 0, 0); giorno = g; }
      ora = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
    }
    // L'ora: "alle 11", "ore 11:30", "11:30", "alle 3 e mezza", "alle 15 in punto"
    for (let i = 0; i < pp.length && !ora; i++) {
      const n = pp[i].n;
      const conMarca = i > 0 && /^(?:alle|all|ore|dalle|verso|per|entro)$/.test(pp[i - 1].n);
      const m = n.match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
      if (!m || (!conMarca && !m[2])) continue;
      let h = Number(m[1]), mi = Number(m[2] || 0);
      if (h > 23 || mi > 59) continue;
      if (conMarca && !m[2] && pp[i + 1] && MESI.includes(pp[i + 1].n)) continue; // "per 5 ottobre"
      if (conMarca && !m[2] && pp[i + 1] && /^(?:euro|€|mila|k|%|percento)$/.test(pp[i + 1].n)) continue;
      if (!m[2] && /^(?:per|entro)$/.test(pp[i - 1].n) && pp[i + 1] && UNITA.test(pp[i + 1].n)) continue; // "per 3 giorni", "per 50 persone": non è un'ora ("alle 8 punti luce" sì)
      usate.add(i); if (conMarca) usate.add(i - 1);
      let j = i + 1;
      if (pp[j] && pp[j].n === "e" && pp[j + 1] && /^(?:mezza|mezzo|trenta|un|quarto)$/.test(pp[j + 1].n)) {
        mi = /^(?:un|quarto)$/.test(pp[j + 1].n) ? 15 : 30; usate.add(j); usate.add(j + 1); if (pp[j + 1].n === "un" && pp[j + 2] && pp[j + 2].n === "quarto") usate.add(j + 2);
        j += 2;
      }
      if (pp[j] && /^(?:del|di)$/.test(pp[j].n) && pp[j + 1] && /^(?:pomeriggio|sera|mattina|mattino)$/.test(pp[j + 1].n)) {
        if (/pomeriggio|sera/.test(pp[j + 1].n) && h < 12) h += 12;
        usate.add(j); usate.add(j + 1);
      } else if (pp[j] && /^(?:in\s*punto|precise)$/.test(pp[j].n)) usate.add(j);
      else if (!m[2] && h >= 1 && h <= 7) h += 12; // "alle 3" = 15
      ora = String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
    }
    for (let i = 0; i < pp.length; i++) if (/^(?:mattina|mattinata|pomeriggio|sera|serata)$/.test(pp[i].n) && (giorno || ora)) { fascia = fascia || pp[i].n; usate.add(i); if (i > 0 && /^(?:di|in|nel|nella|la|il)$/.test(pp[i - 1].n)) usate.add(i - 1); }
    if (!giorno && ora) giorno = null;
    return {
      giornoIso: giorno ? isoGiorno(giorno) : null,
      etichetta: giorno ? etichettaGiorno(giorno, oggi) : null,
      ora, fascia, usate,
    };
  }
  function etichettaGiorno(d, oggi) {
    const diff = Math.round((d - oggi) / 86400000);
    if (diff === 0) return "oggi";
    if (diff === 1) return "domani";
    if (diff === 2) return "dopodomani";
    const nome = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"][d.getDay()];
    return diff < 7 ? nome : nome + " " + d.getDate() + " " + MESI[d.getMonth()];
  }

  /* ---------------- Quanto ---------------- */
  function numeroItaliano(s) {
    let t = String(s || "").replace(/[€\s]/g, "");
    if (!/^\d[\d.,]*$/.test(t)) return null;
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(",", ".");
    else if (/^\d+\.\d{1,2}$/.test(t)) { /* 1250.50 */ }
    else if (/^\d{1,3}(?:,\d{3})+$/.test(t)) t = t.replace(/,/g, "");
    else if (!/^\d+$/.test(t)) return null;
    const v = Number(t);
    return Number.isFinite(v) ? v : null;
  }
  function trovaImporto(pp, giaUsate) {
    const trovati = [];
    for (let i = 0; i < pp.length; i++) {
      if (giaUsate.has(i)) continue;
      const o = pp[i].o.replace(/^€/, "").replace(/€$/, "");
      let v = numeroItaliano(o);
      if (v === null) { const k = pp[i].n.match(/^(\d+(?:[.,]\d+)?)(k|mila)$/); if (k) v = Number(k[1].replace(",", ".")) * 1000; }
      if (v === null) continue;
      const dopo = pp[i + 1] ? pp[i + 1].n : "";
      if (/^(?:%|percento)$/.test(dopo) || /%$/.test(pp[i].o)) continue;
      if (MESI.includes(dopo) || /^(?:ore|minuti|giorni|mesi|anni|pezzi|metri|mq|m2|volte)$/.test(dopo)) continue;
      const usate = [i];
      if (/^(?:mila|k)$/.test(dopo)) { v *= 1000; usate.push(i + 1); }
      const seguito = pp[usate[usate.length - 1] + 1];
      if (seguito && /^(?:euro|eur|€)$/.test(seguito.n)) usate.push(usate[usate.length - 1] + 1);
      if (i > 0 && /^(?:da|di|per|a|€|euro)$/.test(pp[i - 1].n) && !giaUsate.has(i - 1)) usate.unshift(i - 1);
      trovati.push({ valore: v, usate, euro: /€/.test(pp[i].o) || usate.some((u) => /^(?:euro|eur|€)$/.test(pp[u].n)) });
    }
    return trovati;
  }

  /* ---------------- Le voci di un preventivo ----------------
     (29/09/2026, Andrea: un preventivo dettato di un minuto, voce per voce,
     deve farlo il codice.) La dettatura del telefono di solito non mette la
     punteggiatura: "demolizione piastrelle 800 euro posa pavimento 30 metri
     quadri a 45 euro al metro quadro smaltimento 350 euro iva al 10%".
     Ogni PREZZO chiude una voce: la descrizione sono le parole prima; un
     numero seguito da un'unità ("30 mq", "25 punti luce", "16 ore") prima
     di un prezzo "a/da X" (o "X al metro", "l'uno", "cadauno") è la
     quantità. Poi: IVA ("iva al 10%"), sconto, totale detto (solo per
     controllo), prezzo prima della descrizione ("800 euro per la demolizione"). */
  const UNITA = /^(?:mq|m2|m²|mt|mtq|ml|mc|m3|metri|metro|cubi|quadri|quadrati|lineari|cm|mm|km|kw|kwh|kwp|kva|w|v|ah|btu|watt|volt|litri|litro|lt|kg|chili|chilo|quintali|tonnellate|ore|h|giorni|gg|settimane|mesi|anni|pezzi|pezzo|pz|punti|prese|pagine|persone|volte|rotoli|sacchi|confezioni|pollici|bar|gradi|posti|vani|stanze|camere|finestre|porte|porta|radiatori|termosifoni|faretti|lampade|moduli|pannelli|operai|uomini|notti|coperti|ospiti|sedute|lezioni|copie|cartelle|bancali|viaggi|interventi|uscite|visite|appartamenti|unita|alloggi|piani)$/;
  const PER_UNITA = /^(?:metro|metri|mq|m2|m²|ml|mt|pezzo|punto|presa|ora|giorno|mese|anno|persona|testa|kw|kwp|volta|litro|kg|uno|una|coperto|notte|pagina|modulo|pannello|appartamento|unita|operaio|uscita|intervento|visita|lezione|copia|piano|radiatore|finestra|porta|faretto|lampada|quintale)$/;
  const SEPARATORI = /^(?:poi|piu|inoltre|infine|dopo|ancora|voce|e|ed)$/;
  const PERCENTO = /^(?:%|percento)$/;
  const ALIQUOTE = [4, 5, 10, 22];
  /* Numeri in lettere, come li scrive a volte la dettatura: "ottocento",
     "milleduecento", "tremilacinquecento", "quarantacinque" */
  const PEZZI_NUMERO = [["milioni", "M"], ["milione", "M"], ["mila", "K"], ["mille", 1000], ["cento", "C"], ["cent", "C"],
    ["novanta", 90], ["novant", 90], ["ottanta", 80], ["ottant", 80], ["settanta", 70], ["settant", 70], ["sessanta", 60], ["sessant", 60],
    ["cinquanta", 50], ["cinquant", 50], ["quaranta", 40], ["quarant", 40], ["trenta", 30], ["trent", 30], ["venti", 20], ["vent", 20],
    ["diciannove", 19], ["diciotto", 18], ["diciassette", 17], ["sedici", 16], ["quindici", 15], ["quattordici", 14], ["tredici", 13], ["dodici", 12], ["undici", 11], ["dieci", 10],
    ["nove", 9], ["otto", 8], ["sette", 7], ["sei", 6], ["cinque", 5], ["quattro", 4], ["tre", 3], ["due", 2], ["uno", 1], ["una", 1], ["un", 1]];
  function numeroParola(w) {
    w = senzaAccenti(String(w || "").toLowerCase());
    if (!/^[a-z]{3,40}$/.test(w)) return null;
    let totale = 0, corrente = 0, pos = 0, pezzi = 0;
    while (pos < w.length) {
      const trovato = PEZZI_NUMERO.find(([p]) => w.startsWith(p, pos));
      if (!trovato) return null;
      const [p, val] = trovato;
      if (val === "C") corrente = (corrente || 1) * 100;
      else if (val === "K") { totale += (corrente || 1) * 1000; corrente = 0; }
      else if (val === "M") { totale += (corrente || 1) * 1000000; corrente = 0; }
      else if (val === 1000) totale += 1000;
      else corrente += val;
      pos += p.length; pezzi++;
    }
    const v = totale + corrente;
    return v > 0 ? v : null;
  }
  function valoreDi(tok, dopo, prima) {
    if (!tok) return null;
    let v = numeroItaliano(tok.o.replace(/^€/, "").replace(/[€%]$/, ""));
    if (v === null) { const k = tok.n.match(/^(\d+(?:[.,]\d+)?)(k|mila)$/); if (k) v = Number(k[1].replace(",", ".")) * 1000; }
    if (v === null && tok.n !== "mila") {
      const w = numeroParola(tok.n);
      // "un", "una", "sei", "tre": numeri solo se seguiti da euro o da un'unità, o dopo "a/da"
      if (w !== null && !/^(?:un|uno|una)$/.test(tok.n) && (w > 10 || (dopo && (/^(?:euro|eur|€)$/.test(dopo) || UNITA.test(dopo))) || (prima && /^(?:a|da)$/.test(prima)))) v = w;
    }
    return v;
  }
  function trovaVoci(pp, escludi) {
    const libero = (i) => i >= 0 && i < pp.length && !escludi.has(i);
    const numero = (i) => (libero(i) ? valoreDi(pp[i], pp[i + 1] && pp[i + 1].n, pp[i - 1] && pp[i - 1].n) : null);
    const conEuro = (i) => /€/.test(pp[i].o) || (pp[i + 1] && /^(?:euro|eur|€)$/.test(pp[i + 1].n)) || (pp[i + 1] && /^(?:mila|k)$/.test(pp[i + 1].n) && pp[i + 2] && /^(?:euro|eur|€)$/.test(pp[i + 2].n));
    const percento = (i) => /%$/.test(pp[i].o) || (pp[i + 1] && PERCENTO.test(pp[i + 1].n)) || (pp[i + 1] && pp[i + 1].n === "per" && pp[i + 2] && pp[i + 2].n === "cento");
    const vicinoIva = (i) => [1, 2, 3].some((d) => pp[i - d] && pp[i - d].n === "iva");
    let numeri = 0, euro = 0;
    pp.forEach((_, i) => { if (numero(i) !== null) { numeri++; if (conEuro(i)) euro++; } });
    if (numeri < 1) return null;
    const stileEuro = euro >= 2 || (euro === 1 && numeri <= 2);
    /* Prezzo prima della descrizione ("800 euro per la demolizione, 1.200 di
       sanitari"): il primo numero non ha parole davanti e dopo ha "per/di" */
    const dopoPerDi = (i) => { let j = i + 1; if (pp[j] && /^(?:mila|k)$/.test(pp[j].n)) j++; if (pp[j] && /^(?:euro|eur|€)$/.test(pp[j].n)) j++; return pp[j] && /^(?:per|di)$/.test(pp[j].n); };
    const primoNumero = pp.findIndex((_, i) => numero(i) !== null);
    const prezzoPrima = primoNumero >= 0 && pp.slice(0, primoNumero).every((x, k) => !libero(k) || VUOTE.has(x.n) || /^(?:allora|ci|mettiamo|metti|voce)$/.test(x.n)) && dopoPerDi(primoNumero);
    // Una quantità: "6 a 45", "25 punti luce a 55", "8 pezzi da 90" (un "a/da + numero" poco dopo, prima di un altro prezzo)
    const quantitaDavanti = (i) => {
      for (let j = i + 1; j <= i + 5 && j < pp.length; j++) {
        if (!libero(j)) return false;
        if (/^(?:a|da)$/.test(pp[j].n) && numero(j + 1) !== null && !percento(j + 1)) return true;
        if (numero(j) !== null || pp[j].sep) return false;
      }
      return false;
    };
    const ePrezzo = (i) => {
      const dopo = pp[i + 1] ? pp[i + 1].n : "";
      if (conEuro(i)) return true;
      if (percento(i)) return false;
      if (dopo && UNITA.test(dopo)) return false;
      if (quantitaDavanti(i)) return false;
      if (i > 0 && /^(?:a|da)$/.test(pp[i - 1].n)) return true;
      if (prezzoPrima && dopoPerDi(i)) return true;
      if (!stileEuro) return true;
      return !dopo || pp[i].sep || SEPARATORI.test(dopo) || /^(?:totale|sconto|iva)$/.test(dopo);
    };
    const voci = [];
    let aliquota = null, totaleDetto = null, corrente = [], ultimaSep = -1;
    let i = 0;
    const SPEC = /^(?:btu|kw|kwh|kwp|kva|w|watt|v|volt|ah|mm|cm|pollici|bar|gradi|litri|lt|x|mah|hp|cv)$/;
    const chiudi = (prezzo, unitario, fine, unitaPrezzo) => {
      // la quantità: l'ultimo numero (non prezzo) nella voce, se il prezzo è "a/da X" o "X al metro";
      // non una misura tecnica ("2 split da 12000 btu": sono 2), salvo "a 1.300 euro al kW"
      let quantita = 1, unita = null;
      let parti = corrente.slice();
      if (unitario) {
        const tecnica = (k) => parti[k + 1] && SPEC.test(parti[k + 1].n) && !(unitaPrezzo && parti[k + 1].n === unitaPrezzo);
        const nonTecniche = parti.some((t, k) => t.q !== undefined && !tecnica(k));
        for (let k = parti.length - 1; k >= 0; k--) {
          if (parti[k].q !== undefined && (!nonTecniche || !tecnica(k))) {
            quantita = parti[k].q;
            const u = parti[k + 1];
            const misura = u && /^(?:mq|mc|m2|m3|m²|mt|mtq|ml|metri|metro|cm|mm|ore|h|giorni|gg|settimane|mesi|anni|pezzi|pz|volte|persone|notti|kg|litri|lt|quintali|tonnellate)$/.test(u.n);
            parti.splice(k, misura ? 2 : 1);
            if (misura) {
              unita = u.n;
              const agg = parti[k] && parti[k].n;
              if (agg && /^(?:quadri|quadrati|lineari|quadro|quadrato|lineare|cubi|cubo)$/.test(agg)) { unita = /^quadr/.test(agg) ? "mq" : /^line/.test(agg) ? "ml" : "mc"; parti.splice(k, 1); }
              else if (/^(?:m2|m²|mtq)$/.test(unita)) unita = "mq";
              else if (/^(?:mt|metro)$/.test(unita)) unita = "metri";
              else if (/^(?:h)$/.test(unita)) unita = "ore";
              else if (/^(?:pz|pezzo)$/.test(unita)) unita = "pezzi";
              else if (/^(?:gg)$/.test(unita)) unita = "giorni";
              else if (/^(?:lt)$/.test(unita)) unita = "litri";
            }
            if (parti[k - 1] && /^(?:per|di|da)$/.test(parti[k - 1].n) && k - 1 === parti.length - 1) parti.splice(k - 1, 1);
            break;
          }
        }
      }
      voci.push({ parti, quantita, prezzo, unita, fine });
      corrente = [];
    };
    for (i = 0; i < pp.length; i++) {
      if (!libero(i)) { if (pp[i].sep && corrente.length) corrente.push({ n: "", o: "", sep: true }); continue; }
      const v = numero(i);
      if (v === null) { corrente.push({ n: pp[i].n, o: pp[i].o, sep: pp[i].sep }); continue; }
      // IVA: "iva al 10%", "iva 10 per cento", "iva al 22"
      if ((percento(i) || vicinoIva(i)) && vicinoIva(i) && ALIQUOTE.includes(v) && !conEuro(i)) {
        aliquota = v;
        while (corrente.length && /^(?:al|del|a|iva)$/.test(corrente[corrente.length - 1].n)) corrente.pop();
        if (pp[i + 1] && PERCENTO.test(pp[i + 1].n)) i++;
        else if (pp[i + 1] && pp[i + 1].n === "per" && pp[i + 2] && pp[i + 2].n === "cento") i += 2;
        continue;
      }
      if (percento(i)) { // "30% all'ordine", "2% sui lavori": non è una voce
        corrente = [];
        if (pp[i + 1] && PERCENTO.test(pp[i + 1].n)) i++;
        else if (pp[i + 1] && pp[i + 1].n === "per" && pp[i + 2] && pp[i + 2].n === "cento") i += 2;
        continue;
      }
      // Il totale detto alla fine: solo per controllo
      const prima = corrente.slice(-4).map((x) => x.n).join(" ");
      if (/(?:^|\s)(?:totale|tot|complessivo|complessivi|totali|in tutto|tutto compreso)(?:\s+(?:di|del|della|e|sono|fa|fanno|viene))*$/.test(prima)) {
        totaleDetto = v * (pp[i + 1] && /^(?:mila|k)$/.test(pp[i + 1].n) ? 1000 : 1);
        corrente = [];
        while (pp[i + 1] && /^(?:mila|k|euro|eur|€)$/.test(pp[i + 1].n)) i++;
        continue;
      }
      if (!ePrezzo(i)) { corrente.push({ n: pp[i].n, o: pp[i].o, q: v, sep: pp[i].sep }); continue; }
      // È un prezzo: si chiude la voce
      let prezzo = v;
      if (pp[i + 1] && pp[i + 1].n === "virgola" && /^\d{1,2}$/.test((pp[i + 2] || {}).n || "")) { prezzo = Number(v + "." + pp[i + 2].n); i += 2; }
      const unitarioPrima = i > 0 && /^(?:a|da)$/.test(pp[i - 1].n);
      if (unitarioPrima && corrente.length && /^(?:a|da)$/.test(corrente[corrente.length - 1].n)) corrente.pop();
      let j = i + 1;
      if (pp[j] && /^(?:mila|k)$/.test(pp[j].n)) { prezzo *= 1000; j++; }
      if (pp[j] && /^(?:euro|eur|€)$/.test(pp[j].n)) j++;
      // "8 euro e 50": i centesimi
      if (pp[j] && pp[j].n === "e" && /^\d{1,2}$/.test((pp[j + 1] || {}).n || "") && !(pp[j + 2] && (UNITA.test(pp[j + 2].n) || /^(?:euro|eur|€|a|da)$/.test(pp[j + 2].n)))) {
        prezzo = Math.round((prezzo + Number(pp[j + 1].n) / (pp[j + 1].n.length === 1 ? 10 : 100)) * 100) / 100; j += 2;
        if (pp[j] && /^(?:centesimi|cent)$/.test(pp[j].n)) j++;
      }
      let perUnita = false, unitaPrezzo = null;
      for (;;) {
        const a = pp[j] ? pp[j].n : "", b = pp[j + 1] ? pp[j + 1].n : "";
        if (/^(?:cadauno|cadauna|cad|cd|ciascuno|ciascuna|ognuno|ognuna)$/.test(a)) { perUnita = true; j++; continue; }
        if (/^(?:al|alla|allo|all|a|il|l|per|ogni|la)$/.test(a) && PER_UNITA.test(b)) {
          perUnita = true; unitaPrezzo = b; j += 2;
          if (pp[j] && /^(?:quadro|quadrato|quadri|quadrati|lineare|lineari)$/.test(pp[j].n)) j++;
          continue;
        }
        if (/^(?:a|al)$/.test(a) && b === "corpo") { j += 2; continue; }
        if (/^(?:circa|netti|totali|esclusa|escluso)$/.test(a)) { j++; continue; }
        break;
      }
      chiudi(prezzo, unitarioPrima || perUnita, j - 1, unitaPrezzo);
      i = j - 1;
    }
    const resto = corrente;
    if (!voci.length) return null;
    // Pulizia delle descrizioni
    const TESTA = /^(?:poi|e|ed|piu|inoltre|infine|dopo|ancora|voce|allora|ci|mettiamo|mettici|metti|aggiungi|aggiungiamo|aggiungici|abbiamo|la|il|lo|le|i|gli|l|un|una|uno|di|del|della|dello|dei|delle|che|sono|anche|quindi|dunque|c|e'|per|segue|seguono|pure|diciamo|tipo|ok|va|bene|numero|n|$)$/;
    const CODA = /^(?:che|sono|e|ed|di|a|da|per|costa|costano|costo|prezzo|viene|vengono|fa|fanno|circa|al|il|la|le|lo|i|gli|l|un|una|totale|tot|sui|sul|con|in|importo|diciamo|tipo|$)$/;
    const pulisciParti = (parti) => {
      let x = parti.filter((t) => t.n || t.sep);
      while (x.length && TESTA.test(x[0].n)) x.shift();
      while (x.length && CODA.test(x[x.length - 1].n)) x.pop();
      return x;
    };
    // Il titolo prima dei due punti o della virgola: "per la ristrutturazione della cucina: demolizione 600"
    let titolo = "";
    const p0 = voci[0].parti;
    const s0 = p0.map((t, k) => (t.sep ? k : -1)).filter((k) => k >= 0 && k < p0.length - 1).pop();
    if (s0 !== undefined) {
      const t = pulisciParti(p0.slice(0, s0 + 1)), d = pulisciParti(p0.slice(s0 + 1));
      if (t.length && d.length) { titolo = maiuscola(t.map((x) => x.o).filter(Boolean).join(" ")); voci[0].parti = p0.slice(s0 + 1); }
    }
    let descr = voci.map((v) => pulisciParti(v.parti).map((x) => x.o).filter(Boolean).join(" "));
    // Prezzo prima della descrizione: "800 euro per la demolizione 1.200 euro per i sanitari 600 per la manodopera"
    const coda = pulisciParti(resto).map((x) => x.o).filter(Boolean).join(" ");
    const iniziaConPer = (v) => { const t = v.parti.filter((x) => x.n); return t.length && /^(?:per|di)$/.test(t[0].n); };
    if (!descr[0] && coda && (voci.slice(1).every(iniziaConPer) && /^(?:per|di)$/.test((resto.find((x) => x.n) || {}).n || "") || descr.slice(1).every(Boolean))) {
      descr = descr.slice(1).concat([coda]);
    }
    const lista = voci.map((v, k) => {
      let d = descr[k] || "";
      let prezzo = v.prezzo;
      if (/^sconto\b/i.test(senzaAccenti(d)) && prezzo > 0) prezzo = -prezzo;
      return { descrizione: maiuscola(d) || "Lavori", quantita: v.quantita, prezzo, ...(v.unita ? { unita: v.unita } : {}) };
    });
    return { voci: lista, aliquota, totaleDetto, titolo };
  }

  /* ---------------- Correggere a voce un documento già fatto ----------------
     (29/09/2026, frasi vere di Andrea finite all'AI: "non 10000 ma 15000",
     "cambia e fai 12000", "metti 2500", "fammela da 57.000", "modificalo a 21
     mila", "5000 di bagno e 5000 manodopera", "dividi i 57.000 così: 27.000
     materiale e 30.000 manodopera", "metti la data al 27 settembre").
     attuali = { voci: [{descrizione, quantita, prezzo}], aliquota }.
     Torna { voci, aliquota, data, cosa } oppure null (allora decide l'AI). */
  function importiDi(pp) {
    const out = [];
    for (let i = 0; i < pp.length; i++) {
      let v = valoreDi(pp[i], pp[i + 1] && pp[i + 1].n, pp[i - 1] && pp[i - 1].n);
      if (v === null || /%$/.test(pp[i].o) || (pp[i + 1] && PERCENTO.test(pp[i + 1].n))) continue;
      if (pp[i + 1] && /^(?:mila|k)$/.test(pp[i + 1].n)) v *= 1000;
      out.push({ i, v });
    }
    return out;
  }
  const PAROLE_VUOTE_MODIFICA = /^(?:ma|ascolta|senti|allora|ok|no|anzi|scusa|cambia|cambiala|cambialo|modifica|modificala|modificalo|correggi|correggila|correggilo|fai|fammi|fammela|fammelo|falla|fallo|metti|mettila|mettilo|portala|portalo|porta|rifallo|rifalla|diventa|deve|essere|venire|a|da|di|in|e|il|la|lo|le|i|l|un|una|non|invece|per|piuttosto|totale|tot|imponibile|prezzo|importo|cifra|euro|eur|€|mila|k|iva|inclusa|compresa|esclusa|piu|più|tutto|tutta|voce|al|alla|sul|sulla)$/;
  function leggiModifica(testoOriginale, attuali) {
    if (!attuali || !Array.isArray(attuali.voci) || !attuali.voci.length) return null;
    let testo = pulisci(testoOriginale).testo;
    const aliquotaAttuale = Number(attuali.aliquota) || 22;
    const esito = { voci: attuali.voci.map((v) => ({ ...v })), aliquota: aliquotaAttuale, data: null, cosa: "" };
    // La data: "metti la data al 27 settembre", "data 27/09/2026"
    const nt = norm(testo);
    if (/\bdata\b/.test(nt)) {
      const pp = parole(testo);
      const q = trovaQuando(pp, attuali.oggi);
      let g = q.giornoIso;
      // una data del documento può essere anche nel passato
      const m = nt.match(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?\b/) || nt.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
      if (m) {
        const oggi = new Date(attuali.oggi || Date.now());
        const mese = isNaN(Number(m[2])) ? MESI.indexOf(m[2]) + 1 : Number(m[2]);
        const anno = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : oggi.getFullYear();
        g = anno + "-" + String(mese).padStart(2, "0") + "-" + String(Number(m[1])).padStart(2, "0");
      }
      if (g && /^\d{4}-\d{2}-\d{2}$/.test(g)) {
        const [a, mm, d] = g.split("-");
        esito.data = d + "/" + mm + "/" + a; esito.cosa = "data";
        return esito;
      }
      return null;
    }
    // L'IVA: "iva al 10%", "metti l'iva al 4"
    const iva = nt.match(/\biva\s+(?:al\s+|a\s+)?(4|5|10|22)\s*(?:%|percento|per\s+cento)?(?:\s|$)/);
    if (iva && !/\b(?:inclusa|compresa)\b/.test(nt)) {
      esito.aliquota = Number(iva[1]);
      testo = testo.replace(/\b(?:e\s+)?(?:l\s*'?\s*)?iva\s+(?:al\s+|a\s+)?(?:4|5|10|22)\s*(?:%|percento|per\s+cento)?/i, " ").trim();
      if (!/\d/.test(testo.replace(/\b(?:metti|mettila|mettilo|fai|falla|fallo)\b/gi, ""))) { esito.cosa = "iva"; return esito; }
    }
    // "dividi i 57.000 così: 27.000 materiale e 30.000 manodopera"
    testo = testo.replace(/^(?:ma\s+)?(?:dividi|dividilo|dividila|dividili|separa|separalo|suddividi|spezza|spezzalo|fai)\s+(?:(?:il|i|lo|la|le|gli)\s+)?[\d.,]+\s*(?:mila|euro|€)?\s*(?:cosi|così|in|tra|fra)?\s*:?\s*/i, "");
    const pp = parole(testo);
    const importi = importiDi(pp);
    if (!importi.length) {
      // "togli lo smaltimento", "elimina la voce trasporto"
      const t = nt.match(/^(?:togli|toglimi|elimina|leva|levami|rimuovi|cancella)\s+(?:(?:la|il|lo|le|i|gli|l)\s+)?(?:voce\s+)?(?:(?:la|il|lo|le|i|gli|l|del|della|dello)\s+)?(.{3,})$/);
      if (t) {
        const k = trovaVoceSimile(esito.voci, t[1]);
        if (k >= 0 && esito.voci.length > 1) { esito.voci.splice(k, 1); esito.cosa = "tolta"; return esito; }
      }
      return esito.aliquota !== aliquotaAttuale ? (esito.cosa = "iva", esito) : null;
    }
    // "non 10000 ma 15000", "da 10000 a 15000": vale l'ultimo
    if (importi.length === 2 && /\bnon\b.*\bma\b|\binvece\s+di\b|\bda\b.*\ba\b/.test(nt) && !trovaVoci(pp, new Set()).voci.some((v) => /[a-z]{4}/i.test(senzaAccenti(v.descrizione)) && !PAROLE_VUOTE_MODIFICA.test(norm(v.descrizione)))) {
      return nuovoTotale(esito, importi[1].v, nt);
    }
    // Più voci: le voci nuove sostituiscono tutte le vecchie
    const lettura = trovaVoci(pp, new Set());
    const utili = lettura ? lettura.voci.filter((v) => !/^(?:lavori)$/i.test(v.descrizione) || lettura.voci.length === 1) : [];
    if (lettura && lettura.voci.length >= 2 && lettura.voci.every((v) => parolePiene(v.descrizione).length)) {
      esito.voci = lettura.voci.map((v) => ({ descrizione: v.descrizione, quantita: v.quantita, prezzo: v.prezzo }));
      if (lettura.aliquota) esito.aliquota = lettura.aliquota;
      esito.cosa = "voci";
      return esito;
    }
    if (importi.length !== 1) return null;
    const valore = importi[0].v;
    // Con parole piene accanto all'importo: una voce da cambiare ("la manodopera 3000") o da aggiungere ("aggiungi smaltimento 300")
    const piene = parolePiene(pp.filter((_, k) => k !== importi[0].i).map((x) => x.o).join(" "));
    if (piene.length) {
      const aggiungi = /^(?:aggiungi|aggiungici|aggiungere|metti\s+anche|mettici\s+anche|mettici|inserisci|e\s+poi|poi|piu|più|anche)\b/.test(nt);
      const k = aggiungi ? -1 : trovaVoceSimile(esito.voci, piene.join(" "));
      if (k >= 0) { esito.voci[k].prezzo = Math.round(valore / (esito.voci[k].quantita || 1) * 100) / 100; esito.cosa = "voce"; return esito; }
      if (aggiungi && utili.length === 1) {
        esito.voci.push({ descrizione: utili[0].descrizione.replace(/^(?:Aggiungi|Aggiungici|Aggiungere|Inserisci|Mettici|Metti)\s+(?:anche\s+)?/i, "").replace(/^./, (c) => c.toUpperCase()), quantita: utili[0].quantita, prezzo: utili[0].prezzo });
        esito.cosa = "aggiunta";
        return esito;
      }
      return null;
    }
    return nuovoTotale(esito, valore, nt);
  }
  // Le parole che dicono qualcosa ("bagno", "manodopera"), non "fammela", "da", "euro"
  function parolePiene(t) { return norm(t).split(" ").filter((w) => w && w.length >= 3 && !PAROLE_VUOTE_MODIFICA.test(w) && !/^\d/.test(w) && numeroParola(w) === null); }
  function trovaVoceSimile(voci, t) {
    const cerca = parolePiene(t);
    if (!cerca.length) return -1;
    let migliore = -1, punti = 0;
    voci.forEach((v, k) => {
      const sue = parolePiene(v.descrizione);
      const p = cerca.filter((w) => sue.some((x) => x === w || (w.length >= 5 && x.length >= 5 && (x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))))).length;
      if (p > punti) { punti = p; migliore = k; }
    });
    return migliore;
  }
  // Un importo solo = il nuovo imponibile (o il totale con IVA se lo dice): una voce → quella; più voci → in proporzione
  function nuovoTotale(esito, valore, nt) {
    let imponibile = valore;
    if (/\b(?:iva\s+(?:inclusa|compresa)|ivato|ivata|compresa\s+iva|incluso\s+iva|totale\s+con\s+iva|con\s+l\s*iva)\b/.test(nt)) imponibile = Math.round(valore / (1 + esito.aliquota / 100) * 100) / 100;
    const prima = esito.voci.reduce((t, v) => t + v.quantita * v.prezzo, 0);
    if (esito.voci.length === 1) esito.voci[0].prezzo = Math.round(imponibile / (esito.voci[0].quantita || 1) * 100) / 100;
    else if (prima > 0) {
      const f = imponibile / prima;
      esito.voci.forEach((v) => { v.prezzo = Math.round(v.prezzo * f * 100) / 100; });
      // i centesimi che avanzano sull'ultima voce, così il totale torna preciso
      const dopo = esito.voci.reduce((t, v) => t + v.quantita * v.prezzo, 0);
      const ultima = esito.voci[esito.voci.length - 1];
      ultima.prezzo = Math.round((ultima.prezzo + (imponibile - dopo) / (ultima.quantita || 1)) * 100) / 100;
    } else return null;
    esito.cosa = "totale";
    return esito;
  }

  /* ---------------- Chi ---------------- */
  function distanza(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function tokenNome(nome) { return norm(nome).split(" ").filter((w) => w && !/^(?:sig|sigra|dott|ing|geom|arch|avv)$/.test(w)); }
  /* Il cliente nominato nella frase: il nome completo (in qualunque ordine),
     o una sola sua parola se nessun altro cliente la ha. Un nome scritto
     un po' diverso ("Macchi" per "Machi") = "simile": si chiede conferma. */
  function trovaCliente(pp, clienti, giaUsate, opzioni) {
    const liberi = pp.map((p, i) => (giaUsate.has(i) ? null : p.n));
    const attivi = (clienti || []).filter((c) => c && c.name);
    const pieni = [];
    attivi.forEach((c) => {
      const tk = tokenNome(c.name);
      if (!tk.length) return;
      for (let i = 0; i + tk.length <= liberi.length; i++) {
        const fin = liberi.slice(i, i + tk.length);
        if (fin.some((x) => !x)) continue;
        if ([...fin].sort().join(" ") === [...tk].sort().join(" ")) { pieni.push({ c, usate: tk.map((_, k) => i + k), n: tk.length }); break; }
      }
    });
    if (pieni.length) {
      const max = Math.max(...pieni.map((x) => x.n));
      const migliori = pieni.filter((x) => x.n === max);
      const unici = [...new Map(migliori.map((x) => [x.c.id, x])).values()];
      if (unici.length === 1) return { stato: "trovato", cliente: unici[0].c, usate: unici[0].usate };
      return { stato: "ambiguo", candidati: unici.map((x) => x.c), usate: unici[0].usate };
    }
    // Una parola sola del nome ("Machi", "Rita")
    const perParola = new Map();
    const parolaDiUnCliente = (w) => attivi.some((c) => tokenNome(c.name).includes(w));
    const sconosciuta = (j) => j >= 0 && j < liberi.length && liberi[j] && /^\p{L}{3,}$/u.test(liberi[j]) && !VUOTE.has(liberi[j]) && !PAROLE_COMANDO.has(liberi[j]) && !parolaDiUnCliente(liberi[j]);
    liberi.forEach((w, i) => {
      if (!w || w.length < 3 || VUOTE.has(w) || PAROLE_COMANDO.has(w)) return;
      /* Solo il nome di battesimo ("Mario") accanto a un cognome che non
         conosciamo ("Chilosi Mario", "Fini Alessio") è un'altra persona */
      if (NOMI.has(w) && !(opzioni && opzioni.nomeSolo) && (sconosciuta(i - 1) || sconosciuta(i + 1))) return;
      const chi = attivi.filter((c) => tokenNome(c.name).includes(w));
      if (chi.length) perParola.set(i, chi);
    });
    if (perParola.size) {
      // Due parole dello stesso cliente vicine valgono più di una
      const tutti = [...new Set([...perParola.values()].flat())];
      const conta = tutti.map((c) => ({ c, usate: [...perParola.entries()].filter(([, cs]) => cs.includes(c)).map(([i]) => i) }));
      const max = Math.max(...conta.map((x) => x.usate.length));
      const migliori = conta.filter((x) => x.usate.length === max);
      if (migliori.length === 1) return { stato: "trovato", cliente: migliori[0].c, usate: migliori[0].usate };
      const archiviatiNo = migliori.filter((x) => !x.c.archived);
      if (archiviatiNo.length === 1) return { stato: "trovato", cliente: archiviatiNo[0].c, usate: archiviatiNo[0].usate };
      return { stato: "ambiguo", candidati: migliori.map((x) => x.c), usate: migliori[0].usate };
    }
    // Scritto un po' diverso: una lettera in più, in meno o sbagliata (parole di 5+ lettere)
    const simili = [];
    liberi.forEach((w, i) => {
      if (!w || w.length < 5 || VUOTE.has(w) || PAROLE_COMANDO.has(w) || NOMI.has(w)) return;
      attivi.forEach((c) => { if (tokenNome(c.name).some((t) => t.length >= 5 && distanza(t, w) === 1)) simili.push({ c, i }); });
    });
    const unici = [...new Map(simili.map((x) => [x.c.id, x])).values()];
    if (unici.length === 1) return { stato: "simile", cliente: unici[0].c, usate: [unici[0].i] };
    return { stato: "nessuno", usate: [] };
  }

  /* Un nome di persona NUOVO nella frase: dopo "a", "per", "cliente",
     "casa", "sig."; oppure un nome proprio conosciuto ("Luca") con la
     parola accanto ("Liverani"). Restituisce le parole usate. */
  const MARCHE_NOME = /^(?:a|ad|al|alla|cliente|sig|signor|signore|signora|sigra|casa|famiglia|ditta|condominio|dott|ing|geom|arch)$/;
  function trovaNomeNuovo(pp, giaUsate, opzioni) {
    const libero = (i) => i >= 0 && i < pp.length && !giaUsate.has(i) && !VUOTE.has(pp[i].n) && !PAROLE_COMANDO.has(pp[i].n) && /^\p{L}[\p{L}'-]*$/u.test(pp[i].o);
    // 1) nome proprio conosciuto + la parola vicina (prima o dopo)
    for (let i = 0; i < pp.length; i++) {
      if (!libero(i) || !NOMI.has(pp[i].n)) continue;
      const dopo = libero(i + 1) && !NOMI.has(pp[i + 1].n) ? i + 1 : -1;
      const prima = libero(i - 1) && !NOMI.has(pp[i - 1].n) && !(opzioni && opzioni.nonPrima && opzioni.nonPrima.has(i - 1)) ? i - 1 : -1;
      if (dopo >= 0) return [i, dopo]; // "Luca Liverani"
      if (prima >= 0) return [prima, i]; // "Chilosi Mario"
      return [i];
    }
    // 2) dopo una marca ("a Chilosi Mariagrazie", "casa Cucinelli")
    for (let i = 0; i < pp.length - 1; i++) {
      if (giaUsate.has(i) || !MARCHE_NOME.test(pp[i].n)) continue;
      const usate = [];
      for (let j = i + 1; j < pp.length && usate.length < 3 && libero(j); j++) usate.push(j);
      if (usate.length) return usate;
    }
    return null;
  }

  /* "Giorgio Verdi" non è "Condominio Parco Verde" scritto male: un nome
     proprio accanto alla parola simile = un cliente nuovo */
  function nomeNuovoAccanto(pp, usate, usateSimile) {
    const nn = trovaNomeNuovo(pp, usate);
    return !!(nn && nn.some((i) => NOMI.has(pp[i].n)) && nn.some((i) => usateSimile.includes(i)));
  }

  /* ---------------- Cartelle ---------------- */
  function trovaCartella(pp, cartelle, giaUsate) {
    let migliore = null;
    (cartelle || []).forEach((c) => {
      const tk = norm(c.nome).split(" ").filter(Boolean);
      if (!tk.length) return;
      for (let i = 0; i + tk.length <= pp.length; i++) {
        if (tk.every((t, k) => !giaUsate.has(i + k) && pp[i + k].n === t)) {
          if (!migliore || tk.length > migliore.usate.length) migliore = { cartella: c, usate: tk.map((_, k) => i + k) };
          break;
        }
      }
    });
    return migliore;
  }

  /* ---------------- Vocabolario dei cassetti ---------------- */
  const V = {
    crea: /^(?:fai|fammi|fare|faccio|facciamo|faresti|crea|creami|crei|creare|creeresti|prepara|preparami|prepari|preparare|prepareresti|emetti|emettere|nuov[oa]|scrivi|scrivimi|compila|genera|devo\s+fare)$/,
    cerca: /^(?:dammi|mostra|mostrami|trova|trovami|cerca|cercami|apri|aprimi|vedi|rivedi|recupera|ritrova|serve|servono|servirebbe)$/,
    invio: /^(?:mandalo|mandala|mandaglielo|mandagliela|mandali|invialo|inviala|inviaglielo|inviagliela|spediscilo|spediscila|giralo|girala|mandarlo|inviarlo)$/,
    chiama: /^(?:chiama|chiamami|chiamalo|chiamala|telefona|telefonagli|telefonale|squilla|richiama)$/,
    messaggio: /^(?:scrivi|scrivile|scrivigli|scrivergli|scriverle|messaggia|avvisa|avvisalo|avvisala|avverti|rispondi|dici|digli|dille|dì|di')$/,
    manda: /^(?:manda|mandagli|mandale|invia|inviagli|inviale|spedisci)$/,
  };
  const PAROLE_COMANDO = new Set(("fai fammi fare crea creami prepara preparami emetti nuovo nuova scrivi scrivimi scrivile scrivigli dammi mostra mostrami trova trovami cerca apri vedi manda mandami mandagli mandale invia inviagli inviale chiama chiamami telefona messaggio messaggi email mail whatsapp fattura fatture preventivo preventivi cartella cartello segna segnami metti mettimi aggiungi annota salva appunta appuntami devo dovrei ricordami ricordati serve servono foto euro iva durc visura").split(" "));

  const IMPERATIVI = /^(?:svuota|ripristina|recupera|importa|esporta|attiva|disattiva|imposta|condividi|stampa|scarica|carica|invia|inviami|manda|mandami|apri|aprimi|mostra|mostrami|dammi|trova|trovami|cerca|cercami|leggi|leggimi|calcola|confronta|analizza|riassumi|riassumimi|spiegami|spiega|traduci|controlla|verifica|dimmi|aiutami|aggiungi|aggiungimi|crea|creami|fai|fammi|prepara|preparami|segna|segnami|metti|mettimi|registra|inserisci|annota|salva|scrivi|scrivimi|vai|portami|chiudi|esci|accedi|entra|ricarica|aggiorna|rispondi|mandalo|mandala|mandali|invialo|inviala|fallo|falla|chiamalo|chiamala|scrivilo|scrivila|segnalo|segnala|mettilo|mettila|spostalo|spostala|cancellalo|cancellala|toglilo|toglila|aprilo|aprila|leggilo|leggila|rifallo|rifalla|correggilo|correggila)$/;
  const DOC_IMPRESA = /^(?:durc|visura|camerale|dvr|pos|polizza|assicurazione|rct|rc|soa|f24|unilav|dico)$/;

  /* Temi delle domande sui dati: basta che ci sia la parola del tema */
  function temaDomanda(n) {
    if (/\biva\b/.test(n)) return "iva";
    if (/\b(?:incassar\w*|pagar\w*|pagat\w*|pagament\w*|devono|deve|deb\w*|credit\w*|sospes\w*|scadut\w*|insolut\w*|da\s+prendere|mi\s+devono)\b/.test(n) && !/\bincassato\b/.test(n)) return "crediti";
    if (/\b(?:incassato|incassi|entrat[oaie]|guadagnat[oaie]|guadagno|fatturato)\b/.test(n)) return "incassi";
    if (/\b(?:cantier[ie]|interventi|impianti|condomini|lavori\s+(?:in\s+corso|aperti|attivi))\b/.test(n)) return "cantieri";
    if (/\b(?:impegn[oi]|appuntament[oi]|programma|agenda|liber[oaie]|occupat[oa]|da\s+fare|calendario|giornata)\b/.test(n)) return "agenda";
    if (/^quando\s+(?:devo|dovrei|ho|vedo|incontro|vado|passo|sento|chiamo)\b|\bdevo\s+vedere\b/.test(n)) return "agenda";
    if (/\b(?:clienti)\b/.test(n)) return "clienti";
    if (/\b(?:urgenz[ae]|urgenti)\b/.test(n)) return "urgenze";
    return null;
  }

  /* ---------------- Più comandi ---------------- */
  const VERBI_COMANDO = "(?:cancella|annulla|elimina|segna|segnami|metti|fissa|vai|andare|passa|passare|sentire|senti|chiama|chiamare|richiama|telefona|telefonare|manda|mandare|inviare|invia|scrivi|scrivere|fai|fare|crea|prepara|compra|comprare|ritira|ritirare|porta|portare|ricordami|devo|appuntamento|sopralluogo|riunione|incontro|visita)";
  const SEPARA = new RegExp(`\\s*(?:[.;]\\s+|,?\\s+(?:e\\s+poi|poi|ah\\s+e|e\\s+anche|inoltre)\\s+|,\\s*(?=${VERBI_COMANDO}\\b)|\\s+e\\s+(?=${VERBI_COMANDO}\\b))`, "i");
  function dividi(testo) {
    /* Un elenco di impegni con le virgole (29/09/2026): "domani mattina sentire
       prospect, sentite clienti per aggiuntivi, Brigida alle 18 per…, 18:30
       Ferraresi e Albe" — con almeno due orari, ogni virgola separa */
    const t0 = String(testo || "").trim().replace(/[.!]+$/, "");
    const orari = (t0.match(/\b(?:alle|ore|all)\s+\d{1,2}(?:[:.]\d{2})?\b|\b\d{1,2}:\d{2}\b/gi) || []).length;
    if (orari >= 2 && /,/.test(t0) && !/\b(?:preventiv|fattur)/i.test(t0)) {
      const perVirgola = t0.split(/\s*[,;.]\s+|\s+(?:e\s+poi|poi)\s+/i).map((p) => p.trim()).filter((p) => p && !/^(?:e|poi)$/i.test(p));
      if (perVirgola.length >= 2 && perVirgola.length <= 6) return perVirgola;
    }
    const parti = t0.split(SEPARA)
      .map((p) => String(p || "").trim().replace(/^(?:ah|e|poi|ok|allora)[,\s]+/i, "").trim())
      .filter((p) => p && !/^(?:ah|oh|e|poi|ok|allora|anzi)$/i.test(p));
    return parti.length >= 2 && parti.length <= 5 ? parti : null;
  }

  /* ---------------- La lettura ---------------- */
  function leggi(testoOriginale, ctx) {
    ctx = ctx || {};
    const p = pulisci(testoOriginale);
    const testo = p.testo;
    const pp = parole(testo);
    const n = pp.map((x) => x.n).join(" ");
    const base = { originale: String(testoOriginale || "").trim(), testo, domanda: p.domanda };
    if (!pp.length) return { ...base, azione: null };
    const q = trovaQuando(pp, ctx.oggi);
    const usate = new Set(q.usate);
    const quando = { giornoIso: q.giornoIso, etichetta: q.etichetta, ora: q.ora, fascia: q.fascia };
    const ha = (re) => pp.some((x) => re.test(x.n));
    const indice = (re) => pp.findIndex((x) => re.test(x.n));
    const primo = pp[0].n;
    const domanda = p.domanda || PAROLE_DOMANDA.test(n) || (/^(?:ho|sono|hai|e)\b/.test(n) && !!temaDomanda(n) && !/^ho\s+(?:finito|fatto|chiamato|mandato|pagato|incassato|sentito|visto|parlato)\b/.test(n));

    /* Domanda sui dati (regola 4) */
    if (domanda) {
      const tema = temaDomanda(n);
      /* Una domanda che chiede un giudizio ("è pesante?", "conviene?",
         "cosa mi consigli?") non è solo un dato: la fa l'AI */
      /* ...e anche un consiglio ("come posso aumentare il guadagno?") o un
         calcolo con i numeri detti ("incasso 20.000… quanto guadagno?") */
      const numeriDetti = pp.filter((x, i) => !q.usate.has(i) && /\d/.test(x.n)).length;
      const giudizio = /\b(?:pesante|pesanti|leggera|tranquill[ao]|conviene|convien\w*|consigl\w*|secondo\s+te|meglio|peggio|perche|come\s+mai|dovrei|potrei|riesco|faccio\s+in\s+tempo|ce\s+la\s+faccio|organizz\w*|priorit\w*|spieg\w*|pensi|credi|come\s+(?:posso|faccio|potrei|si\s+fa|devo)|cosa\s+(?:posso|dovrei)|aumentar\w*|migliorar\w*|guadagnerei|calcol\w*|valere|vale)\b/.test(n) || numeriDetti >= 2;
      // la cartella solo se si chiede cosa c'è dentro ("cosa c'è in Lerici?"), non "quanto può valere EON?"
      let cartDom = trovaCartella(pp, ctx.cartelle, usate);
      if (cartDom && !(cartDom.usate[0] > 0 && /^(?:cartella|per|in|nella|nel|di|della|del|dentro|su|sulla|sul|da)$/.test(pp[cartDom.usate[0] - 1].n))) cartDom = null;
      if (cartDom && !giudizio && (!tema || tema === "agenda")) return { ...base, domanda: true, azione: "dati", tema: "cartella", cartella: cartDom.cartella, quando };
      if (tema && !giudizio) {
        const cl = trovaCliente(pp, ctx.clienti, usate);
        return { ...base, domanda: true, azione: "dati", tema, quando, cliente: cl.stato === "trovato" ? cl.cliente : null };
      }
      return { ...base, domanda: true, azione: "domanda", quando };
    }

    if (/^(?:svuota|svuotami|vuota|pulisci)\s+(?:il\s+)?cestino$/.test(n)) return { ...base, azione: "cestino", quando };
    /* Solo il nome di un cliente ("Steve Rob", "Franco bi"): la sua scheda (29/09/2026) */
    if (pp.length <= 4 && !q.ora && !q.giornoIso) {
      const cl = trovaCliente(pp, ctx.clienti, usate);
      if (cl.stato === "trovato" || cl.stato === "simile") {
        const resto = pp.filter((x, i) => !cl.usate.includes(i) && !VUOTE.has(x.n) && !/^(?:cliente|scheda|apri|aprimi|mostra|mostrami|vedi)$/.test(x.n));
        if (resto.every((x) => x.n.length <= 2)) return { ...base, azione: "apri_cliente", cliente: cl.stato === "trovato" ? cl.cliente : null, clienteSimile: cl.stato === "simile" ? cl.cliente : null, quando };
      }
    }
    /* Uno sfogo o due chiacchiere ("che palle, non so cosa fare"): risponde, non si salva */
    if (/^(?:che\s+palle|uffa|che\s+noia|mi\s+annoio|sono\s+stanc[oa]|che\s+giornata|non\s+so\s+(?:cosa|che)\s+fare|boh|mah|come\s+stai|che\s+fai|tutto\s+bene)\b/.test(n) && !q.ora && !q.giornoIso) return { ...base, azione: "domanda", quando };

    /* Documento: fattura o preventivo */
    const iDoc = indice(/^(?:fattur[ae]|preventiv[oi])$/);
    /* "Chiamata Walter domani ore 9 per il preventivo" è un impegno che
       parla di un preventivo: con un giorno o un'ora, è un documento solo
       se la frase comincia da lì ("preventivo…", "fai la fattura…") */
    const docInTesta = iDoc >= 0 && (iDoc <= 1 || pp.slice(0, iDoc).every((x) => V.crea.test(x.n) || V.cerca.test(x.n) || VUOTE.has(x.n) || /^(?:mi|ci|serve|servono|nuov[oa]|devo|voglio|vorrei)$/.test(x.n)));
    if (iDoc >= 0 && (docInTesta || (!q.ora && !q.giornoIso)) && !ha(/^(?:modifica|correggi|cambia|annulla|cancella|elimina|togli|sposta|rinomina|duplica|copia)$/)) {
      const tipo = /^fattur/.test(pp[iDoc].n) ? "fattura" : "preventivo";
      usate.add(iDoc);
      const verbiCrea = pp.map((x, i) => (V.crea.test(x.n) ? i : -1)).filter((i) => i >= 0 && i < iDoc + 2);
      const verbiCerca = pp.map((x, i) => (V.cerca.test(x.n) || (x.n === "serve" && i > 0 && pp[i - 1].n === "mi") ? i : -1)).filter((i) => i >= 0 && i < iDoc);
      verbiCrea.forEach((i) => usate.add(i)); verbiCerca.forEach((i) => { usate.add(i); if (i > 0 && pp[i - 1].n === "mi") usate.add(i - 1); });
      if (iDoc > 0 && /^(?:un|una|il|la|lo|nuov[oa])$/.test(pp[iDoc - 1].n)) usate.add(iDoc - 1);
      if (pp[0].n === "mi" || pp[0].n === "ci") usate.add(0);
      // "e mandalo a Rita Ambrosini"
      let invio = false;
      const iInvio = indice(V.invio);
      if (iInvio >= 0) {
        invio = true; usate.add(iInvio);
        if (iInvio > 0 && pp[iInvio - 1].n === "e") usate.add(iInvio - 1);
        if (pp[iInvio + 1] && /^(?:a|ad|al|alla|anche|subito)$/.test(pp[iInvio + 1].n)) usate.add(iInvio + 1);
      }
      const importi = trovaImporto(pp, usate);
      let importo = null;
      if (importi.length === 1) { importo = importi[0].valore; importi[0].usate.forEach((i) => usate.add(i)); }
      // IVA: "+ iva", "più iva", "iva esclusa" = come sempre; "iva inclusa/compresa" = da scorporare
      let ivaInclusa = false;
      pp.forEach((x, i) => {
        if (x.n !== "iva") return;
        usate.add(i);
        if (i > 0 && /^(?:piu|\+|e)$/.test(pp[i - 1].n)) usate.add(i - 1);
        const dopo = pp[i + 1] && pp[i + 1].n;
        if (/^(?:inclusa|compresa|incluso|compreso)$/.test(dopo || "")) { ivaInclusa = true; usate.add(i + 1); }
        else if (/^(?:esclusa|escluso|esclusi)$/.test(dopo || "")) usate.add(i + 1);
      });
      pp.forEach((x, i) => { if (/^\+$/.test(x.o)) usate.add(i); });
      const cl = trovaCliente(pp, ctx.clienti, usate);
      let cliente = null, clienteNuovo = null, clienteSimile = null, candidati = null;
      if (cl.stato === "trovato") { cliente = cl.cliente; cl.usate.forEach((i) => usate.add(i)); }
      else if (cl.stato === "simile" && !nomeNuovoAccanto(pp, usate, cl.usate)) { clienteSimile = cl.cliente; cl.usate.forEach((i) => usate.add(i)); }
      else if (cl.stato === "ambiguo") { candidati = cl.candidati; cl.usate.forEach((i) => usate.add(i)); }
      else {
        let nuovo = trovaNomeNuovo(pp, usate);
        if (!nuovo) {
          /* "fattura Chilosi Mariagrazie 20.000 per porta", "crea preventivo per
             Chilosi Mariagrazie di 20.000 per tinteggiatura": il primo pezzo
             subito dopo il documento è il nome, se dopo c'è anche il lavoro */
          const pezzi = [];
          let corrente = null;
          for (let i = 0; i < pp.length; i++) {
            if (usate.has(i) || /^(?:per|di|da|con|e)$/.test(pp[i].n) || /\d/.test(pp[i].n)) { if (corrente) pezzi.push(corrente); corrente = null; if (!usate.has(i) && pp[i].n === "per") corrente = { idx: [], dopoPer: true }; continue; }
            if (!corrente) corrente = { idx: [], dopoPer: false };
            if (!(corrente.idx.length === 0 && VUOTE.has(pp[i].n))) corrente.idx.push(i);
          }
          if (corrente) pezzi.push(corrente);
          const validi = pezzi.filter((x) => x.idx.length);
          const primo = validi[0];
          const vicino = primo && primo.idx[0] - iDoc <= 2 && pp.slice(iDoc + 1, primo.idx[0]).every((x) => /^(?:per|a|al|alla|x)$/.test(x.n));
          if (validi.length >= 2 && vicino && primo.idx.length <= 3 && primo.idx.every((i) => /^\p{L}[\p{L}'-]*$/u.test(pp[i].o))) nuovo = primo.idx;
        }
        if (nuovo) { clienteNuovo = nomeBello(nuovo.map((i) => pp[i].o).join(" ")); nuovo.forEach((i) => usate.add(i)); }
      }
      // Le parole attorno al nome ("a", "per", "cliente") non sono il lavoro
      [...usate].forEach((i) => {
        if (i > 0 && !usate.has(i - 1) && /^(?:a|ad|al|alla|allo|per|di|del|della|cliente|sig|signor|signora|x)$/.test(pp[i - 1].n)
          && (cl.usate.includes(i) || (clienteNuovo && nomeBello(pp[i].o) && clienteNuovo.toLowerCase().includes(pp[i].n)))) usate.add(i - 1);
      });
      /* Più voci (o una con quantità × prezzo): le legge trovaVoci */
      const escludiVoci = new Set([...usate].filter((i) => !q.usate.has(i) || /^(?:fattur[ae]|preventiv[oi])$/.test(pp[i].n)));
      importi.forEach((x) => { if (importi.length === 1) x.usate.forEach((i) => escludiVoci.delete(i)); });
      const lettura = trovaVoci(pp, escludiVoci);
      const conVoci = lettura && (lettura.voci.length >= 2 || (lettura.voci.length === 1 && (lettura.voci[0].quantita !== 1 || !importi.length)));
      if (conVoci) {
        const somma = Math.round(lettura.voci.reduce((t, v) => t + v.quantita * v.prezzo, 0) * 100) / 100;
        const manca = [];
        if (!cliente && !clienteNuovo && !clienteSimile && !candidati) manca.push("cliente");
        return {
          ...base, azione: "documento", modo: "crea", tipo, cliente, clienteNuovo, clienteSimile, candidati,
          voci: lettura.voci, importo: somma, ivaInclusa: false, aliquotaIva: lettura.aliquota || (ha(/^iva$/) ? 22 : null),
          totaleDetto: lettura.totaleDetto, lavoro: lettura.titolo || lettura.voci[0].descrizione, dubbio: null, invio, quando, manca,
        };
      }
      let lavoroIdx = pp.map((_, i) => i).filter((i) => !usate.has(i));
      while (lavoroIdx.length && (PREPOSIZIONI.has(pp[lavoroIdx[0]].n) || VUOTE.has(pp[lavoroIdx[0]].n) || /^(?:lavoro|lavori|voce)$/.test(pp[lavoroIdx[0]].n) && lavoroIdx.length === 1)) lavoroIdx.shift();
      while (lavoroIdx.length && (PREPOSIZIONI.has(pp[lavoroIdx[lavoroIdx.length - 1]].n) || VUOTE.has(pp[lavoroIdx[lavoroIdx.length - 1]].n))) lavoroIdx.pop();
      let lavoro = lavoroIdx.map((i) => pp[i].o).join(" ").trim();
      // Un'unica parola sconosciuta senza nome né lavoro: può essere il cliente o il lavoro → si chiede
      let dubbio = null;
      const introdottoDaPer = lavoroIdx.length && lavoroIdx[0] > 0 && pp[lavoroIdx[0] - 1].n === "per";
      if (!cliente && !clienteNuovo && !clienteSimile && !candidati && !introdottoDaPer && lavoroIdx.length >= 1 && lavoroIdx.length <= 2 && lavoroIdx.every((i) => /^\p{L}+$/u.test(pp[i].o))) {
        dubbio = nomeBello(lavoro);
      }
      if (lavoro && !/[a-z]{3}/i.test(senzaAccenti(lavoro))) lavoro = "";
      const cerca = verbiCerca.length > 0 && importo === null && !verbiCrea.length;
      if (importo === null && !verbiCrea.length && pp.slice(0, iDoc).some((x) => V.manda.test(x.n) || /^(?:mandami|inviami|mandalo|invialo)$/.test(x.n))) return { ...base, azione: "invio_documento", tipo, quando };
      const manca = [];
      if (!cerca) {
        if (!cliente && !clienteNuovo) manca.push("cliente");
        if (!lavoro || dubbio) manca.push("lavoro");
        if (importo === null) manca.push("importo");
      }
      return {
        ...base, azione: "documento", modo: cerca ? "cerca" : "crea", tipo, cliente, clienteNuovo, clienteSimile, candidati,
        importo: importo !== null && ivaInclusa ? Math.round(importo / 1.22 * 100) / 100 : importo, ivaInclusa,
        lavoro: dubbio ? "" : maiuscola(lavoro), dubbio, invio, quando, manca: dubbio ? manca.filter((x) => x !== "cliente") : manca,
      };
    }

    /* Un cliente da aggiungere (29/09/2026, frasi vere): un nome con un
       telefono ("Luca Ferrero 333 1234567 bagno"), "Mario Prova nuovo
       cliente", "Rita Ambrosini aggiungi clienti". Lo scrive il server. */
    const telefono = /(?:^|\s)(?:\+?39\s?)?(?:3\d{2}[\s.]?\d{3}[\s.]?\d{3,4}|3\d{8,9}|0\d{1,3}[\s.]?\d{5,8})(?:\s|$)/.test(testo);
    const paroleCliente = /\b(?:nuov[oa]\s+cliente|cliente\s+nuov[oa]|aggiung\w*\s+(?:ai\s+|tra\s+i\s+|nei\s+|alla\s+lista\s+(?:dei\s+)?)?clienti|(?:nei|tra\s+i|ai)\s+(?:miei\s+)?clienti)\b/.test(n);
    const aggiungiInTesta = /^(?:aggiungi|aggiungimi|inserisci|salva|registra|nuov[oa])$/.test(primo);
    const verboAltro = V.chiama.test(primo) || V.manda.test(primo) || V.messaggio.test(primo) || /^(?:scrivi|di|dì|chiama|telefona|manda|invia)$/.test(primo);
    if ((telefono || paroleCliente) && !q.ora && !domanda && !verboAltro) {
      const cl = trovaCliente(pp, ctx.clienti, usate);
      const nuovo = cl.stato !== "trovato" ? trovaNomeNuovo(pp, usate) : null;
      const usateNome = cl.stato === "trovato" ? cl.usate : nuovo || [];
      // col solo telefono: frase corta che comincia dal nome o da "aggiungi" (non "Rossi mi ha dato il numero del fornitore…")
      const corta = pp.filter((x) => !/\d/.test(x.n)).length <= 6 && (aggiungiInTesta || usateNome.includes(0) || usateNome.includes(1) && VUOTE.has(pp[0].n));
      if ((cl.stato === "trovato" || nuovo) && (paroleCliente || corta)) return { ...base, azione: "cliente", cliente: cl.stato === "trovato" ? cl.cliente : null, telefono, quando };
    }

    /* Un pagamento RICEVUTO: "Rita ha pagato 1.200", "segna 500 euro pagati
       da Rita", "ho incassato 300 da Bianchi" ("ho pagato il fornitore" è
       un pagamento tuo: non è questo) */
    const ricevuto = /\b(?:ha|hanno)\s+(?:gia\s+)?(?:pagato|saldato|versato|fatto\s+il\s+bonifico|dato)\b|\b(?:pagat[oiae]|saldat[oiae]|incassat[oiae]|ricevut[oiae]|versat[oiae])\s+(?:da|dal|dalla)\b|^(?:ho|abbiamo)\s+(?:incassato|ricevuto|preso)\b|^(?:incassati|incassato|ricevuti|ricevuto)\b|\bmi\s+ha\s+(?:pagato|dato|saldato)\b/;
    // "mi ha dato il numero del fornitore", "mi ha dato la chiave": non sono soldi
    const datoAltro = /\b(?:mi\s+ha|hanno)\s+dato\b/.test(n) && !/\b(?:mi\s+ha|hanno)\s+dato\s+(?:(?:i|gli|un|l|il|la)\s+)?(?:\d|soldi|acconto|anticipo|saldo|bonifico|contanti|assegno|euro|€)/.test(n);
    if (ricevuto.test(n) && !datoAltro && !/^(?:ho|abbiamo)\s+pagato\b/.test(n) && !q.ora) {
      pp.forEach((x, i) => { if (/^(?:ha|hanno|mi|ho|abbiamo|gia|pagato|pagati|pagata|pagate|saldato|saldata|versato|versati|incassato|incassati|ricevuto|ricevuti|preso|dato|fatto|il|bonifico|da|dal|dalla|segna|segnami|registra|che|euro|di|tutto|tutti|saldo)$/.test(x.n)) usate.add(i); });
      const importi = trovaImporto(pp, new Set());
      const importo = importi.length === 1 ? importi[0].valore : null;
      if (importi.length === 1) importi[0].usate.forEach((i) => usate.add(i));
      const cl = trovaCliente(pp, ctx.clienti, usate, { nomeSolo: true });
      return { ...base, azione: "incasso", importo, cliente: cl.stato === "trovato" ? cl.cliente : null, clienteSimile: cl.stato === "simile" ? cl.cliente : null,
        candidati: cl.stato === "ambiguo" ? cl.candidati : null, nomeDetto: cl.stato === "nessuno" ? (nomeDopoA(pp, new Set()) || null) : null, quando };
    }

    /* Più comandi in una frase: ognuno letto da solo */
    const pezzi = dividi(testo);
    if (pezzi) {
      const letti = pezzi.map((t) => leggi(t, ctx));
      // Il giorno detto nel primo pezzo vale anche per quelli dopo senza giorno ("domani ore 11 Mazzi. Mandare raccomandata")
      let giorno = null, etichetta = null;
      letti.forEach((l) => {
        if (l.quando && l.quando.giornoIso) { giorno = l.quando.giornoIso; etichetta = l.quando.etichetta; }
        else if (giorno && l.quando && (l.azione === "da_fare" || l.azione === "mente" || l.azione === "impegno")) { l.quando.giornoIso = giorno; l.quando.etichetta = etichetta; l.giornoEreditato = true; if (l.azione !== "impegno") l.azione = "da_fare"; }
      });
      return { ...base, azione: "piu", pezzi: letti };
    }

    /* Email, WhatsApp, messaggio, chiamata */
    const iEmail = indice(/^(?:email|mail|posta)$/);
    const iWa = indice(/^(?:whatsapp|wapp|whats)$/);
    const verboIniziale = V.manda.test(primo) || V.messaggio.test(primo) || V.chiama.test(primo) || primo === "di" && pp[1] && /^(?:a|ad|al|alla)$/.test(pp[1].n);
    const canaleIniziale = /^(?:messaggio|sms|email|mail|whatsapp)$/.test(primo);
    if ((iEmail >= 0 || iWa >= 0 || canaleIniziale || V.messaggio.test(primo) || (primo === "di" && verboIniziale) || (V.manda.test(primo) && ha(/^(?:messaggio|messaggi|sms|email|mail|whatsapp)$/))) && !ha(/^(?:fattur[ae]|preventiv[oi]|foto|link|durc|documento)$/)) {
      const canale = iEmail >= 0 ? "email" : iWa >= 0 ? "whatsapp" : "messaggio";
      // Le parole del comando
      for (let i = 0; i < pp.length; i++) {
        const x = pp[i].n;
        if (i <= 4 && (V.manda.test(x) || V.messaggio.test(x) || x === "di" && i === 0 || /^(?:un|una|messaggio|email|mail|posta|whatsapp|wapp|sms|nuovo|nuova)$/.test(x))) usate.add(i);
        else break;
      }
      const cl = trovaCliente(pp, ctx.clienti, usate, { nomeSolo: true });
      if (cl.stato !== "nessuno") cl.usate.forEach((i) => usate.add(i));
      const primaDelNome = cl.usate.length ? Math.min(...cl.usate) - 1 : -1;
      if (primaDelNome >= 0 && /^(?:a|ad|al|alla|allo|per|con)$/.test(pp[primaDelNome].n)) usate.add(primaDelNome);
      const dopoNome = cl.usate.length ? Math.max(...cl.usate) + 1 : pp.length;
      const restoIdx = pp.map((_, i) => i).filter((i) => i >= dopoNome && !cl.usate.includes(i));
      /* "Scrivi a Machi domani alle 10": dopo il nome solo il quando = un
         promemoria per te (deciso il 28/09), non un messaggio da mandare */
      if (canale === "messaggio" && (q.ora || q.giornoIso) && restoIdx.length && restoIdx.every((i) => q.usate.has(i) || VUOTE.has(pp[i].n))) {
        return q.ora ? { ...base, azione: "impegno", quando } : { ...base, azione: "da_fare", cosa: maiuscola(testo), cliente: cl.stato === "trovato" ? cl.cliente : null, quando };
      }
      const testoMsg = preparaMessaggio(pp, restoIdx);
      return {
        ...base, azione: canale, cliente: cl.stato === "trovato" ? cl.cliente : null, clienteSimile: cl.stato === "simile" ? cl.cliente : null,
        candidati: cl.stato === "ambiguo" ? cl.candidati : null, nomeDetto: cl.stato === "nessuno" ? nomeDopoA(pp, usate) : null,
        messaggio: testoMsg, quando, manca: [cl.stato === "trovato" || cl.stato === "simile" || cl.stato === "ambiguo" ? null : "cliente", testoMsg ? null : "testo"].filter(Boolean),
      };
    }
    if (V.chiama.test(primo) && !q.ora && !q.giornoIso) {
      usate.add(0);
      const cl = trovaCliente(pp, ctx.clienti, usate, { nomeSolo: true });
      const resto = pp.filter((_, i) => i > 0 && !cl.usate.includes(i) && !VUOTE.has(pp[i].n));
      if (resto.length <= 2) {
        return { ...base, azione: "chiama", cliente: cl.stato === "trovato" ? cl.cliente : null, clienteSimile: cl.stato === "simile" ? cl.cliente : null,
          candidati: cl.stato === "ambiguo" ? cl.candidati : null, nomeDetto: cl.stato === "nessuno" ? nomeBello(pp.slice(1).filter((x) => !VUOTE.has(x.n)).map((x) => x.o).join(" ")) : null, quando };
      }
    }

    /* Nota in una cartella: "metti in cartella Lerici sentire Overa…" */
    const cart = trovaCartella(pp, ctx.cartelle, usate);
    // "aggiungi in EON queste foto": è la fotocamera, non una nota (la fa chi viene dopo)
    const fotoNellaCartella = cart && /^(?:(?:queste|le|delle|una|la|qualche|un|uno|altre)\s+)?(?:foto|fotografi[ae])\b/.test(pp.slice(cart.usate[cart.usate.length - 1] + 1).map((x) => x.n).join(" "));
    if (cart && !fotoNellaCartella) {
      const iC = cart.usate[0];
      const primaParole = pp.slice(0, iC).map((x) => x.n);
      const conVerbo = primaParole.length <= 5 && primaParole.every((w) => /^(?:metti|mettimi|segna|segnami|scrivi|scrivimi|aggiungi|annota|annotami|salva|appunta|appuntami|in|nella|nel|dentro|sulla|su|alla|a|cartella|la|mi|nota|appunto)$/.test(w)) && primaParole.some((w) => /^(?:metti|mettimi|segna|segnami|scrivi|scrivimi|aggiungi|annota|annotami|salva|appunta|appuntami|cartella)$/.test(w));
      const dueP = iC === 0 && new RegExp("^\\s*" + cart.cartella.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:", "i").test(testo);
      if (conVerbo || dueP) {
        const resto = pp.slice(cart.usate[cart.usate.length - 1] + 1).map((x) => x.o).join(" ").replace(/^[:\-–,\s]+/, "").replace(/^(?:di|che)\s+/i, "").trim();
        if (resto.length >= 3) {
          const primaDelResto = norm(resto).split(" ")[0];
          const daFare = /^(?:devo|dovrei|bisogna|ricordarsi|ricordarmi)$/.test(primaDelResto) || (/^\p{L}+(?:are|ere|ire|arsi|ersi|irsi)$/u.test(primaDelResto) && !/^(?:essere|avere|stare|bere)$/.test(primaDelResto));
          return { ...base, azione: "nota_cartella", cartella: cart.cartella, nota: maiuscola(resto), daFare, quando };
        }
      }
    }

    /* Cartello di fine lavori */
    if (ha(/^cartello$/) && (V.crea.test(primo) || primo === "cartello")) {
      pp.forEach((x, i) => { if (/^(?:cartello|fine|lavori|lavoro|di|del|cantiere)$/.test(x.n) || V.crea.test(x.n) || VUOTE.has(x.n)) usate.add(i); });
      const cl = trovaCliente(pp, ctx.clienti, new Set());
      return { ...base, azione: "cartello", cliente: cl.stato === "trovato" ? cl.cliente : null, clienteSimile: cl.stato === "simile" ? cl.cliente : null };
    }

    /* Documento dell'impresa (DURC, visura…), anche con un cliente */
    const iImp = indice(DOC_IMPRESA);
    const verboMostra = /^(?:dammi|mandami|manda|mandalo|invia|inviami|mostra|mostrami|apri|aprimi|trova|trovami|cerca|serve|mi|dov|dove|il|la|lo|l|mandare|mandarmi|inviare|inviarmi|mostrare|mostrarmi|trovare|trovarmi|dare|darmi|dai)$/;
    if (iImp >= 0 && pp.length <= 8 && !q.ora && pp.slice(0, iImp).every((x) => verboMostra.test(x.n) || VUOTE.has(x.n))) {
      usate.add(iImp);
      const cl = trovaCliente(pp, ctx.clienti, usate);
      const invia = ha(/^(?:manda|mandalo|mandagli|mandale|invia|inviagli|inviale|inviare|mandare|spedisci|condividi)$/) || cl.stato === "trovato";
      return { ...base, azione: "doc_impresa", documento: pp[iImp].n, cliente: cl.stato === "trovato" ? cl.cliente : null, invia, quando };
    }

    /* Verbi che cambiano cose già fatte: li gestisce chi li sa fare (codice o AI) */
    if (/^(?:sposta|spostami|rimanda|posticipa|anticipa|cancella|cancellami|annulla|elimina|togli|modifica|correggi|cambia|rinomina|archivia|riattiva)$/.test(primo)) return { ...base, azione: "modifica", quando };

    /* Regola 1: un giorno o un'ora → calendario */
    if (q.ora) return { ...base, azione: "impegno", quando };
    if (q.giornoIso) {
      const cl = trovaCliente(pp, ctx.clienti, usate);
      const cosa = pp.filter((_, i) => !usate.has(i)).map((x) => x.o).join(" ").replace(/^(?:devo|dovrei|bisogna)\s+/i, "").trim();
      return { ...base, azione: "da_fare", cosa: maiuscola(cosa), cliente: cl.stato === "trovato" ? cl.cliente : null, quando };
    }

    /* Un ordine a EON che il codice qui non conosce ("svuota il cestino",
       "riassumi…"): lo fa chi lo sa fare. L'infinito invece ("controllare
       le assicurazioni") è una cosa da fare tua → Mente. */
    if (IMPERATIVI.test(primo) || p.richiesta || /^mi\s+(?:dai|daresti|mandi|manderesti|trovi|mostri|fai|faresti|prepari|apri|cerchi|leggi|dici|spieghi|passi|aiuti|serve|servono|servirebbe)\s+(?:il|la|lo|l|i|gli|le|un|una|uno|quel\w*|tutt\w*)?\s*(?:documento|documenti|file|pdf|foto|visura|durc|scheda|elenco|lista|numero|telefono|indirizzo|preventiv\w*|fattur\w*|permesso|certificat\w*|contratt\w*|polizza|assicurazione)\b|^mi\s+(?:dai|daresti|mandi|manderesti|trovi|mostri|fai\s+vedere|prepari|apri|cerchi|leggi|dici|spieghi|passi|aiuti)\b/.test(n)) return { ...base, azione: "comando", quando };

    /* Il seguito di un discorso ("e quelle di ieri?", "no, a Rossi"): lo capisce chi ha la memoria del discorso */
    if (/^(?:e|ed|anche|invece|pure|poi|allora|no|non|quell[aoie]|quest[aoie])$/.test(primo)) return { ...base, azione: "seguito", quando };
    // "Me la fai da 57.000", "fammela a 21 mila", "dimmelo": parla di quello appena detto
    if (/^(?:me\s+(?:la|lo|li|le|ne)|te\s+(?:la|lo)|fammel[aoie]|fammene|fall[aoie]|portal[aoie]|mettil[aoie]|cambial[aoie]|rifall[aoie]|dimmelo|dimmi|dillo|cioe|ossia|quindi|perche|ok\s+e)\b/.test(n)) return { ...base, azione: "seguito", quando };

    /* Regola 5: tutto il resto nella Mente (con il cliente, se c'è) */
    const cl = trovaCliente(pp, ctx.clienti, usate);
    const daFare = /^(?:devo|dovrei|dobbiamo|bisogna|serve|servono|mi\s+serve|ricordami|ricordarsi|ricordarmi)$/.test(primo) || /^\p{L}+(?:are|ere|ire|arsi|ersi|irsi)$/u.test(primo) && !/^(?:essere|avere|stare|ieri|sere|mare|pare|bere)$/.test(primo);
    const cosa = testo.replace(/^(?:devo|dovrei|dobbiamo|bisogna|ricordami\s+di|ricordarmi\s+di|ricordarsi\s+di)\s+/i, "").trim();
    return { ...base, azione: "mente", cosa: maiuscola(cosa), daFare, cliente: cl.stato === "trovato" ? cl.cliente : null, quando };
  }

  /* Il testo del messaggio, pronto da mandare: "se va bene domani alle 18"
     → "Va bene domani alle 18?"; "chiedendo chiarimenti su ultimo report"
     → "Ti chiedo chiarimenti sull'ultimo report." */
  function preparaMessaggio(pp, idx) {
    let t = idx.map((i) => pp[i].o).join(" ").trim();
    if (!t) return "";
    let domanda = false;
    t = t.replace(/^(?:che|dicendo(?:gli|le)?\s+che|di\s+dirgli\s+che|per\s+dirgli\s+che|per\s+dire\s+che)\s+/i, "");
    if (/^(?:se)\s+/i.test(t)) { t = t.replace(/^se\s+/i, ""); domanda = true; }
    if (/^(?:chiedendo(?:gli|le)?|per\s+chiedere(?:gli|le)?|chiedi(?:gli|le)?)\s+(?:se\s+)?/i.test(t)) {
      const conSe = /^(?:chiedendo(?:gli|le)?|per\s+chiedere(?:gli|le)?|chiedi(?:gli|le)?)\s+se\s+/i.test(t);
      t = t.replace(/^(?:chiedendo(?:gli|le)?|per\s+chiedere(?:gli|le)?|chiedi(?:gli|le)?)\s+(?:se\s+)?/i, "");
      if (conSe) domanda = true; else t = "ti chiedo " + t;
    }
    t = t.replace(/\bsu ultim([oa])\b/gi, "sull'ultim$1").replace(/\bdi ultim([oa])\b/gi, "dell'ultim$1").replace(/\bper ultim([oa])\b/gi, "per l'ultim$1");
    t = t.replace(/[.!?]+$/, "");
    return maiuscola(t) + (domanda ? "?" : ".");
  }
  /* "scrivi a Mario Bianchi che…" con un nome che non è in anagrafica */
  function nomeDopoA(pp, usate) {
    for (let i = 0; i < pp.length; i++) {
      if (!/^(?:a|ad|al|alla)$/.test(pp[i].n)) continue;
      const nome = [];
      for (let j = i + 1; j < pp.length && nome.length < 3; j++) {
        if (/^(?:che|se|per|di|chiedendo|dicendo|e)$/.test(pp[j].n) || /\d/.test(pp[j].n)) break;
        nome.push(pp[j].o);
      }
      if (nome.length) return nomeBello(nome.join(" "));
    }
    return null;
  }

  /* Didascalia di una foto appena scattata: "TV casa Machi" = cliente
     Machi, nota "TV casa"; "finestre Luca Liverani" = cliente NUOVO Luca
     Liverani, nota "Finestre"; solo una nota → a chi va chiesto. */
  function leggiDidascalia(testo, ctx) {
    ctx = ctx || {};
    const pp = parole(pulisci(testo).testo);
    if (!pp.length) return null;
    const usate = new Set();
    const cl = trovaCliente(pp, ctx.clienti, usate);
    let cliente = null, clienteNuovo = null, clienteSimile = null, candidati = null, idx = [];
    if (cl.stato === "trovato") { cliente = cl.cliente; idx = cl.usate; }
    else if (cl.stato === "simile") { clienteSimile = cl.cliente; idx = cl.usate; }
    else if (cl.stato === "ambiguo") { candidati = cl.candidati; idx = cl.usate; }
    else {
      const nuovo = trovaNomeNuovo(pp, usate);
      if (nuovo) { idx = nuovo; clienteNuovo = nomeBello(nuovo.map((i) => pp[i].o).join(" ")); }
    }
    const via = new Set(idx);
    // "casa Machi": "casa" resta nella nota ("TV casa"), le preposizioni attorno al nome no
    idx.forEach((i) => { if (i > 0 && /^(?:di|del|della|per|a|al|alla|cliente|sig|signor|signora)$/.test(pp[i - 1].n)) via.add(i - 1); });
    const nota = pp.filter((_, i) => !via.has(i)).map((x) => x.o).join(" ").replace(/^[,.;:\s-]+|[,.;:\s-]+$/g, "");
    return { cliente, clienteNuovo, clienteSimile, candidati, nota: nota.length >= 2 ? maiuscola(nota) : "" };
  }

  /* Solo le cortesie ai bordi ("eon …", "… grazie"), il resto com'è (anche il "?"): per tutte le funzioni dell'app */
  function togliCortesie(testo) {
    const t = String(testo || "").trim();
    const fine = (t.match(/[?!.]+$/) || [""])[0];
    let x = t.slice(0, t.length - fine.length).trim(), prima;
    do { prima = x; x = x.replace(/^(?:(?:ehi|hey|ok|okay|allora|dunque)\s*,?\s+)*(?:(?:senti|ascolta)\s*,\s*)?(?:eon\s*,?\s+)?(?:(?:per\s+favore|perfavore|per\s+cortesia|scusa)\s*,?\s+)?/i, "").replace(FINE_CORTESIA, "").trim(); } while (x !== prima && x);
    return x ? x + fine.replace(/[.!]+/, "") : t;
  }
  const EonLettore = { leggi, trovaVoci, leggiModifica, togliCortesie, leggiDidascalia, pulisci, parole, trovaQuando, trovaImporto, trovaCliente, trovaNomeNuovo, preparaMessaggio, temaDomanda, dividi, norm, NOMI };
  if (typeof module !== "undefined" && module.exports) module.exports = EonLettore;
  else root.EonLettore = EonLettore;
})(typeof window !== "undefined" ? window : globalThis);
