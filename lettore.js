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
  /* Il ripensamento detto a voce (giro 7, 29/09/2026): "domani alle 8 anzi
     alle 9", "giovedì anzi venerdì alle 10", "alle 8, no alle 8 e mezza":
     vale la seconda. Solo per ore e giorni (gli importi li legge il preventivo). */
  const ORA_DETTA = "(?:alle|le|ore|per\\s+le|verso\\s+le)\\s+[\\w:.]+(?:\\s+e\\s+(?:mezza|mezzo|un\\s+quarto|\\w+))?";
  const GIORNO_DETTO = "(?:oggi|domani|dopodomani|stasera|(?:luned|marted|mercoled|gioved|venerd)[iì]|sabato|domenica)";
  // "no aspetta, volevo dire…", "anzi no", "cioè", "intendevo" (giro 13)
  const RIPENSO = "(?:no\\s*,?\\s*)?(?:aspetta\\s*,?\\s*)?(?:anzi(?:\\s+no)?|no|scusa|cioe|cioè|meglio|volevo\\s+dire|intendevo|aspetta|facciamo|diciamo)";
  const RIPENSA_ORA = new RegExp(ORA_DETTA + "\\s*,?\\s+" + RIPENSO + "\\s*,?\\s+(?=(?:alle|le|ore|per\\s+le|verso\\s+le)\\s)", "gi");
  const RIPENSA_GIORNO = new RegExp("\\b" + GIORNO_DETTO + "(?:\\s+" + ORA_DETTA + ")?\\s*,?\\s+" + RIPENSO + "\\s*,?\\s+(?=" + GIORNO_DETTO + "(?![a-z]))", "gi");
  /* Le abbreviazioni da chat (giro 13, 30/09/2026): "app.to x domani ke nn
     posso", "prev. x Rossi 1,5k", "tel bar bianco", "msg", "cmq", "cash".
     Come la tastiera del telefono: la parola intera prima di leggere. */
  const MESI_RE = "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre";
  const ABBREVIAZIONI = [
    [/(?<!\d\s?)\bx\b(?!\s?\d)/gi, "per"],
    [/\bk[eè]\b/gi, "che"], [/\bnn\b/gi, "non"], [/\bcmq\b/gi, "comunque"], [/\bx\s?(?:k|ch)[eéè]\b/gi, "perché"],
    [/\bqlc(?:s|osa)?\b/gi, "qualcosa"], [/\bmsg\b/gi, "messaggio"], [/\btt\b/gi, "tutto"], [/\bcn\b/gi, "con"], [/\bsn\b/gi, "sono"],
    [/\bapp(?:\.to|\.|untam\.?)(?=\s|$)/gi, "appuntamento"], [/\bprev\.?(?=\s|$)/gi, "preventivo"], [/\bfatt\.?(?=\s|$)/gi, "fattura"], [/\bsopr\.?(?=\s)/gi, "sopralluogo"],
    [/\bcash\b/gi, "in contanti"], [/([!?])\1+/g, "$1"],
    [/(^|[\s,])(?:eh+|ehm+|uhm+|mh+|ehh+)(?=[\s,.!?]|$),?/gi, "$1"], // i versi della dettatura (giro 15)
    // giro 15: "dai/ohi/annamo, chiama…", "mettimi in linea con X", "chiamami un attimo X", "no non scrivere, chiamalo…"
    [/^\s*(?:dai|ohi|oh|ué|ue|uè|annamo|forza|su)\s*,?\s+(?=\S)/i, ""],
    [/^\s*mettimi\s+in\s+linea\s+con\s+/i, "chiama "],
    // "mo' dimmi un po' chi è che non ha pagato", "fammi un riepilogo di quanto ho incassato": sono domande
    [/^\s*mo'?\s+(?=\S)/i, ""],
    [/^\s*(?:dimmi|sai\s+dirmi|fammi\s+sapere)\s+(?:un\s+po'?\s+)?(?=(?:chi|cosa|quanto|quanti|quante|quali?|quando|dove|come|se)\b)/i, ""],
    [/^\s*(?:fammi|dammi|fai)\s+(?:un\s+)?(?:riepilogo|resoconto|riassunto|conto)\s+(?:di\s+)?(?=(?:quanto|quanti|quante|chi|cosa)\b)/i, ""],
    [/\bprende'/gi, "prendere"],
    [/^\s*chiamami\s+(?:un\s+attimo\s+|subito\s+)(?:sto\s+|questo\s+)?/i, "chiama "],
    [/^\s*(?:no\s*,?\s*)?non\s+scrivere\s*,?\s*chiamal[oa]\s+(?:direttamente\s+|subito\s+)?/i, "chiama "],
    [/^\s*(?:no\s*,?\s*)?(?:aspetta\s*,?\s*)?non\s+(?:su|per|via|con)\s+whatsapp\s*,\s*/i, ""],
    [/^[^,]{0,40}?\bno\s+(scrivi|chiama|manda|telefona)\s*,\s*(?=\1\b)/i, ""],
    [/(\d+(?:[.,]\d+)?)\s?k\b/gi, (m, n) => String(Math.round(parseFloat(n.replace(",", ".")) * 1000))],
    [/^tel\.?\s+(?:a\s+|ad\s+)?/i, "chiama "],
    [new RegExp("\\bprimo\\s+(?=" + MESI_RE + ")", "gi"), "1 "],
    /* Giro 15: "mille e due", "duemila e cinque" come si dice in cantiere =
       1.200, 2.500 (le centinaia). Non "mille e due cassetti". */
    [/\b(mille|(?:due|tre|quattro|cinque|sei|sette|otto|nove|dieci)mila)\s+e\s+(due|tre|quattro|cinque|sei|sette|otto|nove)\b(?=\s*(?:$|[,.;:!]|euro|€|di\s|per\s|e\s|più\s|piu\s|tutto|iva|in\s+contanti|cash))/gi,
      (m, mila, cento) => String((mila.toLowerCase() === "mille" ? 1000 : 1000 * ({ due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 })[mila.toLowerCase().replace(/mila$/, "")]) + 100 * ({ due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9 })[cento.toLowerCase()])],
  ];
  function espandiAbbreviazioni(t) { let x = String(t || ""); for (const [re, sost] of ABBREVIAZIONI) x = x.replace(re, sost); return x.replace(/\s+/g, " ").trim(); }
  /* Giro 15: la cifra corretta a metà ("imbiancatura 1.500 cioè no 1.400",
     "800 di manodopera, no aspetta 750", "2.400, anzi 2.200"): resta l'ultima */
  const CIFRA = "\\d[\\d.,]*(?:\\s*(?:euro|€))?";
  const RIPENSA_IMPORTO = new RegExp("\\b" + CIFRA + "(\\s+(?:di|per)\\s+[a-zàèéìòù']+(?:\\s+[a-zàèéìòù']+){0,2})?\\s*,?\\s+(?:no\\s*,?\\s*aspetta|cioè\\s+no|cioe\\s+no|anzi(?:\\s+no)?|no\\s+scusa|volevo\\s+dire)\\s*,?\\s+(" + CIFRA + ")", "gi");
  // "domenica no... lunedì 5 alle 9", "la settimana prossima... no aspetta, martedì 6 ottobre alle 10" (giro 15)
  const RIPENSA_PUNTINI = new RegExp("^[^.…]{0,40}?\\b(?:no\\s*)?(?:\\.{2,}|…)\\s*(?:no\\s*,?\\s*)?(?:aspetta\\s*,?\\s*)?(?=(?:" + GIORNO_DETTO + "|\\d{1,2}\\s+(?:" + "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre" + ")|(?:alle|le|ore)\\s))", "i");
  function togliRipensamenti(t) { return String(t || "").replace(RIPENSA_PUNTINI, "").replace(RIPENSA_ORA, "").replace(RIPENSA_GIORNO, "").replace(RIPENSA_IMPORTO, (m, descr, nuova) => nuova + (descr || "")); }
  function pulisci(testo) {
    let t = togliRipensamenti(espandiAbbreviazioni(String(testo || "").trim().replace(/\s+/g, " ")));
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

  const PAROLE_DOMANDA = /^(?:(?:ma\s+)?(?:io\s+)?a\s+che\s+ora\s+(?:ho|devo|c\s*ho|e|sono|vado|passo|arriva|viene)|ogni\s+quant[oi]|quanto|quanta|quanti|quante|chi|cosa|che\s+cosa|che\s+(?:programma|impegni|appuntamenti|lavori|cantieri|clienti|fatture|preventivi|ore|giorno|tempo)|che\s+differenza|che\s+\w+(?:\s+\w+){0,2}\s+(?:deve|devo|devono|serve|servono|bisogna|ci\s+vuole|ci\s+vogliono|conviene|va|vanno|si\s+usa|si\s+mette|uso|metto)|quale|quali|quando|dove|come|perche|c\s*e|ci\s+sono|mi\s+deve|mi\s+devono)\b/;

  /* ---------------- Quando ---------------- */
  const GIORNI = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  function isoGiorno(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  const ORE_PAROLE = { una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19, venti: 20, ventuno: 21, ventidue: 22, ventitre: 23, sete: 7, oto: 8, diese: 10, undese: 11 };
  const MINUTI_PAROLE = { cinque: 5, dieci: 10, quindici: 15, venti: 20, venticinque: 25, trenta: 30, trentacinque: 35, quaranta: 40, quarantacinque: 45, cinquanta: 50, cinquantacinque: 55 };
  /* Trova giorno e ora, e segna le parole usate */
  // i mesi detti in dialetto o scritti male (giro 18: "el 12 de otobre")
  const MESI_ALTRI = { genaio: "gennaio", febraio: "febbraio", setembre: "settembre", otobre: "ottobre", novembar: "novembre", dicembar: "dicembre" };
  const meseDi = (n) => MESI_ALTRI[n] || n;
  function trovaQuando(pp, oggiRif) {
    pp = pp.map((x) => (MESI_ALTRI[x.n] ? { ...x, n: MESI_ALTRI[x.n] } : x));
    const oggi = new Date(oggiRif || Date.now()); oggi.setHours(0, 0, 0, 0);
    const usate = new Set(), racconto = new Set();
    let giorno = null, ora = null, fascia = null;
    const piu = (n) => { const d = new Date(oggi); d.setDate(d.getDate() + n); return d; };
    for (let i = 0; i < pp.length; i++) {
      const n = pp[i].n;
      if (giorno) break;
      /* Date più lontane (giro 13): "fra una settimana", "tra 3 giorni", "fra due
         settimane", "tra un mese"; "a fine mese", "a fine settimana", "a fine
         giornata", "in giornata" */
      const NUM_P = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, dieci: 10, quindici: 15 };
      if (/^(?:fra|tra)$/.test(n) && pp[i + 1] && pp[i + 2] && /^(?:giorn[oi]|settiman[ae]|mes[ei])$/.test(pp[i + 2].n) && (NUM_P[pp[i + 1].n] || /^\d{1,2}$/.test(pp[i + 1].n))) {
        const k = NUM_P[pp[i + 1].n] || Number(pp[i + 1].n), u = pp[i + 2].n;
        if (/^mes/.test(u)) { const d = new Date(oggi); d.setMonth(d.getMonth() + k); giorno = d; } else giorno = piu(k * (/^settiman/.test(u) ? 7 : 1));
        usate.add(i); usate.add(i + 1); usate.add(i + 2);
        continue;
      }
      if (n === "fine" && pp[i + 1] && /^(?:mese|settimana|giornata)$/.test(pp[i + 1].n) && i > 0 && /^(?:a|entro|per)$/.test(pp[i - 1].n)) {
        const u = pp[i + 1].n;
        if (u === "mese") giorno = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);
        else if (u === "settimana") giorno = piu(Math.max(0, (5 - oggi.getDay() + 7) % 7));
        else { giorno = oggi; fascia = "sera"; }
        usate.add(i - 1); usate.add(i); usate.add(i + 1);
        continue;
      }
      if (n === "giornata" && i > 0 && pp[i - 1].n === "in") { giorno = oggi; usate.add(i - 1); usate.add(i); continue; }
      /* "stamattina mi ha chiamato Sala e ci vediamo giovedì alle 5": "stamattina" è quando
         l'ha saputo, il giorno dell'impegno è quello dopo (30/09) */
      if (/^(?:oggi|stamattina|stamani|stasera|ieri)$/.test(n) && pp.slice(i + 1, i + 5).some((x) => /^(?:ha|ho|hanno|sono|abbiamo)$/.test(x.n))
        && pp.slice(i + 1).some((x) => GIORNI.includes(x.n) || /^(?:domani|dopodomani|domattina)$/.test(x.n))) { racconto.add(i); continue; }
      if (n === "oggi" || n === "stamattina" || n === "stamani" || n === "stasera" || n === "stanotte") { giorno = oggi; usate.add(i); if (n !== "oggi") fascia = n; }
      else if (n === "domani" || n === "domattina") { giorno = piu(1); usate.add(i); if (n === "domattina") fascia = "mattina"; }
      else if (n === "dopodomani") { giorno = piu(2); usate.add(i); }
      else if (GIORNI.includes(n)) {
        /* "vuole i lavori solo di sabato", "ogni lunedì", "tutti i venerdì":
           un'abitudine, non un giorno da segnare (giro 6, 29/09/2026) */
        const prima1 = i > 0 ? pp[i - 1].n : "", prima2 = i > 1 ? pp[i - 2].n : "";
        if (prima1 === "ogni" || (prima1 === "i" && prima2 === "tutti") || (/^(?:di|il)$/.test(prima1) && /^(?:solo|sempre|mai|tranne|eccetto|anche|soltanto)$/.test(prima2))) continue;
        let diff = (GIORNI.indexOf(n) - oggi.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        usate.add(i);
        if (pp[i + 1] && /^prossim[oa]$/.test(pp[i + 1].n)) usate.add(i + 1);
        if (i > 0 && /^(?:il|di|per|questo|questa|prossimo|prossima)$/.test(pp[i - 1].n)) usate.add(i - 1);
        giorno = piu(diff);
        /* "lunedì della prossima settimana", "la settimana prossima giovedì" (giro 13):
           il giorno della settimana DOPO, non il primo che viene */
        const dopoTesto = pp.slice(i + 1, i + 4).map((x) => x.n).join(" ");
        const primaTesto = pp.slice(Math.max(0, i - 3), i).map((x) => x.n).join(" ");
        if (/^(?:della|la)\s+(?:prossima\s+settimana|settimana\s+prossima)/.test(dopoTesto) || /(?:prossima\s+settimana|settimana\s+prossima)$/.test(primaTesto)) {
          const lunProssimo = piu(((8 - oggi.getDay()) % 7) || 7);
          giorno = new Date(lunProssimo); giorno.setDate(giorno.getDate() + (GIORNI.indexOf(n) + 6) % 7);
          for (let k = i + 1; k <= i + 3 && pp[k] && /^(?:della|la|prossima|settimana)$/.test(pp[k].n); k++) usate.add(k);
          for (let k = i - 1; k >= i - 3 && k >= 0 && /^(?:la|prossima|settimana)$/.test(pp[k].n); k--) usate.add(k);
        }
        /* "giovedì 15": il 15 (questo mese o il prossimo), non il primo giovedì */
        // "lunedì dodici ottobre" (giro 18): il numero a parole, solo se c'è il mese dopo
        const num = pp[i + 1] && /^\d{1,2}$/.test(pp[i + 1].n) ? Number(pp[i + 1].n) : pp[i + 1] && ORE_PAROLE[pp[i + 1].n] && pp[i + 2] && MESI.includes(meseDi(pp[i + 2].n)) ? ORE_PAROLE[pp[i + 1].n] : 0;
        // "giovedì 8 e mezza": è l'ora, non il giorno 8 (30/09)
        const eMezza = pp[i + 2] && pp[i + 2].n === "e" && pp[i + 3] && /^(?:mezza|mezzo|un|quarto|trenta|quindici|dieci|venti|quaranta|quarantacinque)$/.test(pp[i + 3].n);
        if (num >= 1 && num <= 31 && !eMezza && !(pp[i + 2] && /^(?:euro|€|%|mila|ore|minuti|:)$/.test(pp[i + 2].n))) {
          let d = new Date(oggi.getFullYear(), oggi.getMonth(), num);
          if (d < oggi) d = new Date(oggi.getFullYear(), oggi.getMonth() + 1, num);
          const conMese = pp[i + 2] && MESI.includes(pp[i + 2].n);
          /* "Mazza caldaia giovedì 9" (giro 11): se il 9 del mese non cade di
             giovedì e non c'è un'altra ora, il 9 è l'ORA, non il giorno */
          const altraOra = pp.some((x, k) => k !== i + 1 && (/^(?:alle|ore|all)$/.test(x.n) || /^\d{1,2}:\d{2}$/.test(x.n)));
          if (!conMese && d.getDay() !== GIORNI.indexOf(n) && !altraOra && num >= 6 && num <= 21) { /* resta il giorno della settimana: l'ora la legge "oraNuda" */ }
          else if (d.getDate() === num) { giorno = d; usate.add(i + 1); if (conMese) { const dm = new Date(oggi.getFullYear(), MESI.indexOf(pp[i + 2].n), num); if (dm < oggi) dm.setFullYear(dm.getFullYear() + 1); giorno = dm; usate.add(i + 2); } }
        }
      } else if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(n) && !(i > 0 && /^(?:da|di|a|tubo|tubi|raccordo|raccordi|valvola|valvole|attacco|attacchi|filetto)$/.test(pp[i - 1].n)) && !(pp[i + 1] && /^(?:pollic\w*|mm|cm)$/.test(pp[i + 1].n))) {
        const [g, m, a] = n.split("/").map(Number);
        const d = new Date(a ? (a < 100 ? 2000 + a : a) : oggi.getFullYear(), m - 1, g);
        if (!a && d < oggi) d.setFullYear(d.getFullYear() + 1);
        if (d.getDate() === g) { giorno = d; usate.add(i); if (i > 0 && /^(?:il|per|entro)$/.test(pp[i - 1].n)) usate.add(i - 1); }
      } else if (/^\d{1,2}$/.test(n) && pp[i + 1] && (MESI.includes(pp[i + 1].n) || (/^(?:di|de)$/.test(pp[i + 1].n) && pp[i + 2] && MESI.includes(pp[i + 2].n)))) {
        const salto = MESI.includes(pp[i + 1].n) ? 1 : 2; // "12 ottobre", "12 de otobre"
        const d = new Date(oggi.getFullYear(), MESI.indexOf(pp[i + salto].n), Number(n));
        if (d < oggi) d.setFullYear(d.getFullYear() + 1);
        giorno = d; usate.add(i); usate.add(i + 1); usate.add(i + salto);
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
    // "domattina alle sei e mezza", "domani mattina alle 6", "presto alle 5": di mattina (giro 15)
    const diMattina = pp.some((x, k) => !racconto.has(k) && /^(?:domattina|stamattina|stamani|mattina|matina|mattino|mattinata|alba|presto)$/.test(x.n)) && !pp.some((x) => /^(?:pomeriggio|sera|stasera|serata|notte)$/.test(x.n));
    const diSera = pp.some((x) => /^(?:sera|stasera|serata|pomeriggio)$/.test(x.n)) && !pp.some((x) => /^(?:domattina|stamattina|mattina|mattino|mattinata)$/.test(x.n));
    /* Le ore da saltare (giro 18): quella corretta subito dopo ("alle sei e mezza, no aspetta alle
       sette", "alle quattro anzi facciamo alle cinque") e quella vecchia ("invece che alle due e
       mezza falla alle quattro", "a mezzogiorno e mezza invece che a mezzogiorno"). */
    const oraQui = (k) => k > 0 && pp[k] && (/^\d{1,2}(?:[:.]\d{2})?$/.test(pp[k].n) || ORE_PAROLE[pp[k].n] || pp[k].n === "mezzogiorno") && (pp[k].n === "mezzogiorno" || /^(?:alle|all|ore|le|h|a)$/.test(pp[k - 1].n)) && !(pp[k + 1] && /^(?:euro|€|mila|k|%|percento|metri|mq|pezzi|persone|operai|giorni|ore)$/.test(pp[k + 1].n));
    const vecchie = new Set();
    const segnaVecchia = (k) => { vecchie.add(k); usate.add(k); if (k > 0 && /^(?:alle|all|ore|le|h|a)$/.test(pp[k - 1].n)) usate.add(k - 1); if (pp[k + 1] && pp[k + 1].n === "e" && pp[k + 2] && (/^(?:mezza|mezzo|trenta|quarto|un|tre)$/.test(pp[k + 2].n) || MINUTI_PAROLE[pp[k + 2].n] || /^\d{1,2}$/.test(pp[k + 2].n))) { usate.add(k + 1); usate.add(k + 2); if (/^(?:un|tre)$/.test(pp[k + 2].n) && pp[k + 3]) usate.add(k + 3); } };
    for (let k = 1; k < pp.length; k++) {
      if (!oraQui(k)) continue;
      const prima = pp.slice(Math.max(0, k - 4), k).map((x) => x.n).join(" ");
      if (/\b(?:invece\s+(?:che|di|delle|dell)|anziche|al\s+posto\s+(?:delle|di))\s*(?:alle|all|a|le)?$/.test(prima)) { segnaVecchia(k); continue; }
      for (let q = k + 1; q < Math.min(pp.length, k + 15); q++) {
        if (!oraQui(q)) continue;
        const inMezzo = pp.slice(k + 1, q).map((x) => x.n).join(" ");
        if (/\b(?:no|anzi|cioe|aspetta|facciamo|meglio|scusa|correggo)\b/.test(inMezzo) && !/\b(?:poi|dopo)\b/.test(inMezzo)) segnaVecchia(k);
        break;
      }
    }
    // L'ora: "alle 11", "ore 11:30", "11:30", "alle 3 e mezza", "alle 15 in punto"
    for (let i = 0; i < pp.length && !ora; i++) {
      if (vecchie.has(i)) continue;
      // "a mezzogiorno" (giro 7)
      // ("verso mezzogiorno" = 12, 30/09)
      if (pp[i].n === "mezzogiorno" && !(i > 0 && /^(?:dopo|prima)$/.test(pp[i - 1].n))) { usate.add(i); if (i > 0 && /^(?:a|alle|verso)$/.test(pp[i - 1].n)) usate.add(i - 1); ora = "12:00"; if (pp[i + 1] && pp[i + 1].n === "e" && pp[i + 2] && /^(?:mezza|mezzo)$/.test(pp[i + 2].n)) { ora = "12:30"; usate.add(i + 1); usate.add(i + 2); } break; }
      // "per le 17", "verso le 9", "entro le 18": come "alle"
      // "verso l'una", "per l'una" (giro 15)
      const lUna = pp[i].n === "una" && i > 1 && pp[i - 1].n === "l" && /^(?:verso|per|entro|dopo|prima|alle)$/.test(pp[i - 2].n);
      const conMarca = i > 0 && (/^(?:alle|all|ore|dalle|verso|per|entro|h)$/.test(pp[i - 1].n) || (pp[i - 1].n === "le" && i > 1 && /^(?:per|verso|entro|dopo|fino|prima)$/.test(pp[i - 2].n)) || lUna);
      // l'ora detta a parole ("alle nove e un quarto", "alle sette e mezza"): giro 7, 29/09/2026
      // (solo dopo "alle/ore/dalle/per le": "preventivo per due bagni" non è un'ora)
      const marcaForte = i > 0 && (/^(?:alle|all|ore|dalle|h)$/.test(pp[i - 1].n) || pp[i - 1].n === "le") || lUna;
      const n = lUna ? "1" : conMarca && marcaForte && ORE_PAROLE[pp[i].n] ? String(ORE_PAROLE[pp[i].n]) : pp[i].n;
      const m = n.match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
      if (!m || (!conMarca && !m[2])) continue;
      let h = Number(m[1]), mi = Number(m[2] || 0);
      if (h > 23 || mi > 59) continue;
      if (conMarca && !m[2] && pp[i + 1] && MESI.includes(pp[i + 1].n)) continue; // "per 5 ottobre"
      if (conMarca && !m[2] && pp[i + 1] && /^(?:euro|€|mila|k|%|percento)$/.test(pp[i + 1].n)) continue;
      if (!m[2] && /^(?:per|entro)$/.test(pp[i - 1].n) && pp[i + 1] && UNITA.test(pp[i + 1].n)) continue;
      if (i > 1 && pp[i - 1].n === "per" && /^\d/.test(pp[i - 2].n)) continue; // "2 e 40 per 1 e 80": una misura (giro 15)
      if (i > 1 && pp[i - 1].n === "alle" && pp[i - 2].n === "fino") continue; // "rumore solo fino alle 11": non è un appuntamento // "per 3 giorni", "per 50 persone": non è un'ora ("alle 8 punti luce" sì)
      usate.add(i); if (conMarca) { usate.add(i - 1); if (pp[i - 1].n === "le" || lUna) usate.add(i - 2); }
      const hDetta = h; // "alle sette meno un quarto" di mattina resta di mattina
      let j = i + 1;
      if (pp[j] && pp[j].n === "e" && pp[j + 1] && pp[j + 1].n === "tre" && pp[j + 2] && pp[j + 2].n === "quarti") {
        mi = 45; usate.add(j); usate.add(j + 1); usate.add(j + 2); j += 3; // "alle nove e tre quarti" (giro 18)
      } else if (pp[j] && pp[j].n === "e" && pp[j + 1] && /^(?:mezza|mezzo|trenta|un|quarto)$/.test(pp[j + 1].n)) {
        mi = /^(?:un|quarto)$/.test(pp[j + 1].n) ? 15 : 30; usate.add(j); usate.add(j + 1); if (pp[j + 1].n === "un" && pp[j + 2] && pp[j + 2].n === "quarto") { usate.add(j + 2); j++; }
        j += 2;
      } else if (!m[2] && pp[j] && pp[j].n === "e" && pp[j + 1] && (MINUTI_PAROLE[pp[j + 1].n] || (/^\d{1,2}$/.test(pp[j + 1].n) && Number(pp[j + 1].n) > 0 && Number(pp[j + 1].n) < 60 && !(pp[j + 2] && /^(?:euro|€|%|mila|metri|mq|pezzi)$/.test(pp[j + 2].n))))) {
        // "alle 15 e 30", "alle otto e venti"
        mi = MINUTI_PAROLE[pp[j + 1].n] || Number(pp[j + 1].n); usate.add(j); usate.add(j + 1); j += 2;
      } else if (!m[2] && pp[j] && pp[j].n === "meno" && pp[j + 1] && (pp[j + 1].n === "un" && pp[j + 2] && pp[j + 2].n === "quarto" || MINUTI_PAROLE[pp[j + 1].n] || /^\d{1,2}$/.test(pp[j + 1].n))) {
        // "alle dieci meno un quarto" = 9:45
        const meno = pp[j + 1].n === "un" ? 15 : (MINUTI_PAROLE[pp[j + 1].n] || Number(pp[j + 1].n));
        if (meno > 0 && meno < 60) { h = h === 0 ? 23 : h - 1; mi = 60 - meno; usate.add(j); usate.add(j + 1); if (pp[j + 1].n === "un") { usate.add(j + 2); j++; } j += 2; }
      }
      if (pp[j] && /^(?:del|di)$/.test(pp[j].n) && pp[j + 1] && /^(?:pomeriggio|sera|mattina|mattino)$/.test(pp[j + 1].n)) {
        if (/pomeriggio|sera/.test(pp[j + 1].n) && h < 12) h += 12;
        usate.add(j); usate.add(j + 1);
      } else if (pp[j] && /^(?:in\s*punto|precise)$/.test(pp[j].n)) usate.add(j);
      else if (!m[2] && diSera && h >= 1 && h < 12) h += 12; // "domani sera alle 8" = 20
      else if (!m[2] && hDetta >= 1 && hDetta <= 6 && !diMattina) h += 12; // "alle 3" = 15; "alle 7" è di mattina (i cantieri partono alle 7); "domattina alle 6" = 6
      ora = String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
    }
    /* L'ora detta nuda subito dopo il giorno, stile telegramma (giro 11):
       "Esposito domani 8 getto", "Mazza caldaia giovedì 9", "Neri logo venerdì 11" */
    if (!ora && giorno) {
      for (let i = 1; i < pp.length; i++) {
        if (!/^\d{1,2}$/.test(pp[i].n) || usate.has(i) || !usate.has(i - 1)) continue;
        if (!/^(?:oggi|domani|dopodomani|domattina|stasera|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|prossimo|prossima)$/.test(pp[i - 1].n)) continue;
        if (pp[i + 1] && /^(?:euro|€|%|mila|metri|mq|pezzi|giorni|ore|minuti|persone|operai)$/.test(pp[i + 1].n) || (pp[i + 1] && MESI.includes(pp[i + 1].n))) continue;
        let h = Number(pp[i].n);
        if (h < 1 || h > 23) continue;
        if (h >= 1 && h <= 6 && !diMattina) h += 12;
        // "Brambati venerdì 8 e mezza revisione" (giro 15)
        let mi = 0;
        if (pp[i + 1] && pp[i + 1].n === "e" && pp[i + 2] && /^(?:mezza|mezzo|un|quarto)$/.test(pp[i + 2].n)) { mi = /^(?:un|quarto)$/.test(pp[i + 2].n) ? 15 : 30; usate.add(i + 1); usate.add(i + 2); if (pp[i + 2].n === "un" && pp[i + 3] && pp[i + 3].n === "quarto") usate.add(i + 3); }
        ora = String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0"); usate.add(i);
        break;
      }
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
      // "iva 10", "iva al 22": l'aliquota, non un importo (giro 8)
      const prima1 = i > 0 ? pp[i - 1].n : "", prima2 = i > 1 ? pp[i - 2].n : "";
      if (dopo !== "euro" && (prima1 === "iva" || prima1 === "aliquota" || (prima1 === "al" && /^(?:iva|aliquota|inclusa|compresa|incluso|compreso|esclusa|escluso)$/.test(prima2)))) continue;
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
    /* Giro 15: "tre docce a 280 l'una", "due colonnine da 22 kW a 2.300": un numero
       piccolo in lettere è la quantità se poco dopo c'è "a/da" + cifra.
       "via dei Mille", "Hotel Tre Stelle": col maiuscolo è un nome, non un numero. */
    const numero = (i) => {
      if (!libero(i)) return null;
      if (i > 0 && /^\p{Lu}\p{Ll}+$/u.test(pp[i].o) && numeroParola(pp[i].n) !== null) return null;
      const v = valoreDi(pp[i], pp[i + 1] && pp[i + 1].n, pp[i - 1] && pp[i - 1].n);
      if (v !== null || /^(?:un|uno|una)$/.test(pp[i].n)) return v;
      const w = numeroParola(pp[i].n);
      if (w === null || w > 10 || pp[i].sep) return null;
      for (let j = i + 1; j <= i + 4 && j + 1 < pp.length; j++) {
        if (/^(?:a|da)$/.test(pp[j].n) && /^\d/.test(pp[j + 1].n)) return w;
        if (pp[j].sep || /\d/.test(pp[j].n)) break;
      }
      return null;
    };
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
    const prezzoPrima = primoNumero >= 0 && pp.slice(0, primoNumero).every((x, k) => !libero(k) || VUOTE.has(x.n) || /^(?:allora|ci|mettiamo|metti|voce|sono|erano|fanno|mettici)$/.test(x.n)) && dopoPerDi(primoNumero);
    // Una quantità: "6 a 45", "25 punti luce a 55", "8 pezzi da 90" (un "a/da + numero" poco dopo, prima di un altro prezzo)
    const quantitaDavanti = (i) => {
      if (pp[i].sep) return false; // "centrale 900, sei sensori a 80": la virgola chiude il prezzo
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
      // giro 15: "4.800 euro, e aggiungi 250 per la gestione", "più 400 per la tenuta del registro"
      if (dopoPerDi(i) && i > 0 && /^(?:e|piu|poi|aggiungi|aggiungici|metti|mettici|anche|altri|altre|sono|erano|fanno)$/.test(pp[i - 1].n)) return true;
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
      let forzaPrezzo = false;
      if (/(?:^|\s)(?:totale|tot|complessivo|complessivi|totali|in tutto|tutto compreso|tutto)(?:\s+(?:di|del|della|e|sono|fa|fanno|viene))*$/.test(prima)) {
        if (voci.length) {
          totaleDetto = v * (pp[i + 1] && /^(?:mila|k)$/.test(pp[i + 1].n) ? 1000 : 1);
          corrente = [];
          while (pp[i + 1] && /^(?:mila|k|euro|eur|€)$/.test(pp[i + 1].n)) i++;
          continue;
        }
        // "24 bignè e una crostata, tutto 58 euro": nessuna voce prima = il prezzo di quello che ha detto
        while (corrente.length && /^(?:totale|tot|complessivo|complessivi|totali|in|tutto|compreso|di|del|della|e|sono|fa|fanno|viene)$/.test(corrente[corrente.length - 1].n)) corrente.pop();
        corrente.forEach((x) => { delete x.q; });
        forzaPrezzo = true;
      }
      if (!forzaPrezzo && !ePrezzo(i)) { corrente.push({ n: pp[i].n, o: pp[i].o, q: v, sep: pp[i].sep }); continue; }
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
        if (a === "tutto" && /^(?:compreso|incluso)$/.test(b)) { j += 2; continue; } // "1.650 tutto compreso più iva"
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
    // "4.800 euro, e aggiungi 250 per la gestione del portierato": l'ultima voce ha la descrizione dopo il prezzo
    if (descr.length > 1 && !descr[descr.length - 1] && coda && /^(?:per|di)$/.test((resto.find((x) => x.n) || {}).n || "")) descr[descr.length - 1] = coda;
    const lista = voci.map((v, k) => {
      let d = descr[k] || "";
      let prezzo = v.prezzo;
      if (/^sconto\b/i.test(senzaAccenti(d)) && prezzo > 0) prezzo = -prezzo;
      return { descrizione: maiuscola(d) || "Lavori", quantita: v.quantita, prezzo, ...(v.unita ? { unita: v.unita } : {}) };
    });
    return { voci: lista, aliquota, totaleDetto, titolo };
  }

  /* ---------------- Il modello di EON (29/09/2026) ----------------
     Un modello NOSTRO, piccolo, che gira dentro l'app: dalla frase decide il
     cassetto (calendario, preventivo, messaggio, incasso…) quando le regole
     non bastano. Come i modelli degli assistenti (Snips, fastText): legge le
     parole, le coppie di parole e i PEZZI di parola (così regge "prevendivo",
     "apuntamento"), con nomi, giorni, ore, importi e telefoni sostituiti da
     segnaposto (impara la forma della richiesta, non i nomi). Allenato su
     migliaia di frasi (eval/modello/allena.mjs), misurato su frasi vere mai
     viste. I pezzi (chi, quando, quanto) li legge sempre il lettore. */
  let MODELLO = null;
  function caricaModello(m) {
    if (!m || !Array.isArray(m.intenti) || !m.feat || !m.W) { MODELLO = null; return false; }
    const K = m.intenti.length;
    const raw = typeof m.W === "string" ? (typeof Buffer !== "undefined" ? Uint8Array.from(Buffer.from(m.W, "base64")) : Uint8Array.from(atob(m.W), (c) => c.charCodeAt(0))) : Uint8Array.from(m.W);
    const W = new Int8Array(raw.buffer, raw.byteOffset, raw.length);
    MODELLO = { intenti: m.intenti, K, feat: m.feat, W, scala: m.scala, b: m.b, versione: m.versione || "" };
    return true;
  }
  function caratteristiche(testoOriginale, ctx) {
    ctx = ctx || {};
    const p = pulisci(testoOriginale);
    const pp = parole(p.testo);
    const out = [];
    if (!pp.length) return out;
    const q = trovaQuando(pp, ctx.oggi);
    const segno = pp.map((x) => x.n);
    q.usate.forEach((i) => { segno[i] = "<tempo>"; });
    const cl = trovaCliente(pp, ctx.clienti, q.usate);
    if (cl.stato === "trovato" || cl.stato === "ambiguo" || cl.stato === "simile") (cl.usate || []).forEach((i) => { segno[i] = "<cl>"; });
    pp.forEach((x, i) => {
      if (segno[i].startsWith("<")) return;
      if (/^\+?\d[\d.\s]{7,}$/.test(x.o) || /^3\d{8,9}$/.test(x.n)) segno[i] = "<tel>";
      else if (/€/.test(x.o) || (pp[i + 1] && /^(?:euro|eur|mila|k)$/.test(pp[i + 1].n)) || /^\d{1,3}(?:\.\d{3})+$/.test(x.o) || /^\d+(?:k|mila)$/.test(x.n)) segno[i] = "<soldi>";
      else if (/\d/.test(x.n)) segno[i] = "<num>";
    });
    // segnaposto uguali di fila = uno solo
    const t = segno.filter((w, i) => !(w.startsWith("<") && segno[i - 1] === w));
    if (p.domanda) out.push("?");
    if (q.ora) out.push("#ora");
    if (q.giornoIso) out.push("#giorno");
    out.push("f:" + t[0]);
    if (t[1]) out.push("f2:" + t[0] + "_" + t[1]);
    t.forEach((w, i) => {
      out.push("w:" + w);
      if (i > 0) out.push("b:" + t[i - 1] + "_" + w);
      if (!w.startsWith("<") && w.length >= 3) {
        const x = "<" + w + ">";
        for (let n = 3; n <= 5; n++) for (let k = 0; k + n <= x.length; k++) out.push("c:" + x.slice(k, k + n));
      }
    });
    return out;
  }
  /* La frase come la vede il modello neurale (30/09/2026): parole normalizzate,
     con giorni/ore, soldi, telefoni e numeri al posto dei segnaposto. I nomi dei
     clienti restano parole (il modello impara che non contano): così è uguale in
     allenamento e nel telefono, anche senza sapere chi sono i clienti. */
  function segni(testoOriginale) {
    const p = pulisci(testoOriginale);
    const pp = parole(p.testo);
    if (!pp.length) return "";
    const q = trovaQuando(pp, new Date("2026-09-29T10:00:00"));
    const s = pp.map((x) => x.n);
    q.usate.forEach((i) => { s[i] = "<tempo>"; });
    pp.forEach((x, i) => {
      if (s[i].startsWith("<")) return;
      if (/^\+?\d[\d.\s]{7,}$/.test(x.o) || /^[03]\d{7,11}$/.test(x.n)) s[i] = "<tel>";
      else if (/€/.test(x.o) || (pp[i + 1] && /^(?:euro|eur|mila|k)$/.test(pp[i + 1].n)) || /^\d{1,3}(?:\.\d{3})+$/.test(x.o) || /^\d+(?:k|mila)$/.test(x.n)) s[i] = "<soldi>";
      else if (/\d/.test(x.n)) s[i] = "<num>";
    });
    const t = s.filter((w, i) => !(w.startsWith("<") && s[i - 1] === w));
    return (p.domanda ? "<dom> " : "") + t.join(" ");
  }
  /* Frasi vere per allenare i modelli, col consenso (30/09): prima di mandarle si tolgono i
     dati personali, la forma della frase resta (serve per imparare). Nomi dei clienti →
     "Cliente", nomi di persona → "Nome", dopo signor/dottor… → "Rossi", telefoni, email,
     IBAN, codici fiscali e partite IVA, indirizzi → segnaposto. */
  function anonimizza(testo, ctx) {
    let t = String(testo || "").replace(/\s+/g, " ").trim();
    t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "email@esempio.it")
      .replace(/\bIT\s?\d{2}\s?[A-Z](?:\s?[0-9A-Z]){22}\b/g, "IBAN")
      .replace(/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi, "CODICEFISCALE")
      .replace(/\b(?:p\.?\s?iva|partita\s+iva)\s*:?\s*\d{11}\b/gi, "partita iva 00000000000")
      .replace(/(?:\+?39[\s.]?)?(?:3\d{2}|0\d{1,3})[\s.]?\d{3}[\s.]?\d{3,4}\b|\b3\d{8,9}\b/g, "333 0000000")
      .replace(/\b(via|viale|piazza|piazzale|corso|vicolo|largo|strada|contrada|borgo|località)\s+((?:(?:de|dei|del|della|delle|degli|di|da|san|santa|dello|d'|\p{Lu}[\p{L}'’-]*)\s*){1,4})(\d+[a-z]?)?/giu, (m, via, nome, num) => via + " Roma" + (num ? " 1" : "") + " ");
    // i clienti dell'utente, parola per parola ("Condominio Via Gramsci 14" → "Cliente")
    const parole = new Set();
    (ctx && ctx.clienti || []).forEach((c) => tokenNome(c.name || "").forEach((w) => { if (w.length >= 3 && !VUOTE.has(w) && !/^(?:condominio|studio|bar|hotel|ristorante|trattoria|pizzeria|palestra|officina|ditta|srl|snc|spa|via|viale|piazza|corso|supercondominio|dentistico|impianti)$/.test(w)) parole.add(w); }));
    t = t.split(/(\s+)/).map((w) => {
      const n = norm(w.replace(/[^\p{L}'’]/gu, ""));
      if (!n) return w;
      const segno = w.match(/[^\p{L}'’]+$/u);
      if (parole.has(n)) return "Cliente" + (segno ? segno[0] : "");
      if (NOMI.has(n) && /^\p{Lu}/u.test(w)) return "Nome" + (segno ? segno[0] : "");
      return w;
    }).join("");
    // "il signor Brambilla", "l'avvocato Donati", "dalla Colombini": il cognome dopo il titolo
    t = t.replace(/\b(signor|signora|sig\.?|sig\.ra|dottor|dottore|dottoressa|dott\.?|ingegner|ingegnere|ing\.?|avvocato|avv\.?|geometra|geom\.?|architetto|arch\.?|ragionier|ragioniere|rag\.?|professor|professoressa|prof\.?)\s+(?!Nome\b|Cliente\b)\p{Lu}[\p{L}'’-]+/giu, "$1 Rossi");
    return t.replace(/\s+/g, " ").trim().slice(0, 600);
  }

  /* Passo 4 (30/09): il secondo modello neurale, quello dei DETTAGLI. Dice che ruolo ha
     ogni numero della frase; il conto lo fa il codice (componiImporti).
     Ingresso: una parola per volta, come la dice lui (solo le abbreviazioni sciolte, NON
     le correzioni: "a 12, eh no 15" deve vederle per imparare che 12 è annullato); i numeri
     diventano la loro "forma" (<n3> = tre cifre, <p2> = scritto in lettere, due cifre;
     <n2%> = una percentuale), così il modello impara dal contesto e non dalla cifra. */
  // MOLT: moltiplica la voce prima ("80 al mese per 12 mesi"); FIN: il prezzo finale detto
  // ("fagli un prezzo finale di 3.800", "facciamo tutto 950"): vale lui (passo 4, giro 18)
  const RUOLI_DETTAGLI = ["O", "QTA", "PRZ", "TOT", "ANN", "PERC", "BASE", "SCO", "SCOV", "MOLT", "FIN"];
  const NUMERI_DIALETTO = { du: 2, tri: 3, quattru: 4, cincu: 5 };
  function segniDettagli(testoOriginale) {
    // "mille e due al condominio": 1.200 anche davanti a "al/alla/a" (espandiAbbreviazioni lo fa solo a fine cifra)
    const t0 = String(testoOriginale || "").replace(/\b(mille|(?:due|tre|quattro|cinque|sei|sette|otto|nove|dieci)mila)\s+e\s+(due|tre|quattro|cinque|sei|sette|otto|nove)\b(?=\s+(?:al|alla|allo|ai|a|all['’]|agli|alle|per|di|da)\b)/gi,
      (m, mila, cento) => String((mila.toLowerCase() === "mille" ? 1000 : 1000 * numeroParola(mila.toLowerCase().replace(/mila$/, ""))) + 100 * numeroParola(cento.toLowerCase())));
    // "un'ora e mezza", "due ore e mezza": 1,5 e 2,5 ore (una quantità)
    const t1 = t0.replace(/\b(un['’]?\s*|una\s+|un\s+)?(\d+|due|tre|quattro|cinque|sei|sette|otto)?\s*(or[ae]|giornat[ae]|giorn[oi])\s+e\s+mezz[oa]\b/gi, (m, un, n, cosa) => {
      const v = n ? (Number(n) || numeroParola(n.toLowerCase())) : 1;
      return v ? String(v).replace(".", ",") + ",5 " + cosa : m;
    });
    const pp = parole(espandiAbbreviazioni(t1));
    const segni = [], valori = [];
    const grandezza = (v) => (v < 10 ? 1 : v < 100 ? 2 : v < 1000 ? 3 : v < 10000 ? 4 : 5);
    pp.forEach((x, i) => {
      const o = x.o.replace(/^€/, "").replace(/€$/, "");
      // "30 per cento": "cento" non è un numero, è il segno di percentuale
      const perCento = (j) => pp[j] && pp[j].n === "per" && pp[j + 1] && pp[j + 1].n === "cento";
      if (x.n === "cento" && i > 0 && pp[i - 1].n === "per" && i > 1 && valori[i - 2] != null) { segni.push("percento"); valori.push(null); return; }
      const perc = /%$/.test(x.o) || perCento(i + 1) || (pp[i + 1] && /^(?:percento|%)$/.test(pp[i + 1].n));
      let v = null, forma = null;
      if (/^\+?\d[\d.\s]{7,}$/.test(x.o) || /^[03]\d{7,11}$/.test(x.n)) { segni.push("<tel>"); valori.push(null); return; }
      if (/^\d{1,2}:\d{2}$/.test(o)) { segni.push("<ora>"); valori.push(null); return; }
      v = numeroItaliano(o.replace(/%$/, ""));
      if (v === null) { const k = x.n.match(/^(\d+(?:[.,]\d+)?)(k|mila)$/); if (k) v = Number(k[1].replace(",", ".")) * 1000; }
      if (v !== null) forma = "n";
      else if (x.n !== "mila") {
        const w = NUMERI_DIALETTO[x.n] || (/^(?:un|uno|una)$/.test(x.n) ? null : numeroParola(x.n));
        if (w) { v = w; forma = "p"; }
      }
      if (v !== null && pp[i + 1] && pp[i + 1].n === "mila") v *= 1000;
      if (v === null) { segni.push(x.n); valori.push(null); return; }
      segni.push("<" + forma + grandezza(v) + (perc ? "%" : "") + ">");
      valori.push(v);
    });
    return { parole: pp.map((x) => x.o), segni, valori };
  }
  /* Il conto dai ruoli: quantità × prezzo (la quantità più vicina prima del prezzo, o
     subito dopo: "150 l'una e ne mettiamo due"), i totali detti, l'acconto (percentuale
     di una base), lo sconto (in percentuale o in euro); i numeri annullati non contano */
  function componiImporti(valori, ruoli) {
    const righe = [], qta = [];
    let perc = null, base = null, sco = null, scov = 0, conScov = false, fin = null;
    const prossimaQta = (i) => { for (let j = i + 1; j < ruoli.length; j++) { if (ruoli[j] === "QTA" && valori[j] != null) return j; if (/^(?:PRZ|TOT)$/.test(ruoli[j])) return -1; } return -1; };
    const usate = new Set();
    for (let i = 0; i < ruoli.length; i++) {
      const r = ruoli[i], v = valori[i];
      if (v == null || r === "O" || r === "ANN") continue;
      if (r === "QTA") { if (!usate.has(i)) qta.push(i); }
      else if (r === "PRZ") {
        // "3 giorni x 3 operai a 250": le quantità dette prima si moltiplicano
        let q = qta.length ? qta.reduce((t, k) => t * valori[k], 1) : null;
        if (q == null) { const k = prossimaQta(i); if (k >= 0) { usate.add(k); q = valori[k]; } }
        righe.push({ quantita: q == null ? 1 : q, prezzo: v, i });
        qta.length = 0;
      } else if (r === "TOT") { righe.push({ quantita: 1, prezzo: v, i }); qta.length = 0; }
      else if (r === "MOLT") { if (righe.length) righe[righe.length - 1].quantita *= v; }
      else if (r === "PERC") perc = v;
      else if (r === "BASE") base = v;
      else if (r === "SCO") sco = v;
      else if (r === "SCOV") { scov += v; conScov = true; }
      else if (r === "FIN") fin = v;
    }
    if (perc != null && base != null) righe.push({ quantita: 1, prezzo: Math.round(base * perc) / 100, i: -1, acconto: { perc, base } });
    let totale = righe.reduce((s, x) => s + x.quantita * x.prezzo, 0);
    if (sco != null) totale = totale * (1 - sco / 100);
    if (conScov) totale -= scov;
    if (fin != null) totale = fin;
    return { righe, totale: Math.round(totale * 100) / 100, sconto: sco, scontoEuro: conScov ? scov : null, finale: fin };
  }
  /* Il modello neurale (30/09/2026): quando è caricato decide lui il cassetto;
     finché non c'è (primi istanti dopo l'apertura) decide il modello di parole */
  let NEURALE = null;
  function usaNeurale(n) { NEURALE = n && n.pronto && n.pronto() ? n : null; return !!NEURALE; }
  /* Il modello dei DETTAGLI (passo 4): uno o più modelli (la media dei loro voti).
     Finché non ci sono, gli importi li leggono solo le regole. */
  let DETTAGLI = [];
  function usaDettagli(lista) { DETTAGLI = (lista || []).filter((m) => m && m.pronto && m.pronto()); return DETTAGLI.length; }
  const SICURO_DETTAGLI = 0.98;
  function dettagliNeurali(testo) {
    if (!DETTAGLI.length) return null;
    const s = segniDettagli(testo);
    if (!s.valori.some((v) => v != null)) return null;
    const voti = DETTAGLI.map((m) => m.etichetta(s.segni));
    if (voti.some((v) => !v)) return null;
    const ruoli = [], sic = [];
    s.segni.forEach((w, j) => {
      if (s.valori[j] == null) { ruoli.push("O"); sic.push(1); return; }
      // la media per NOME del ruolo: un modello vecchio può averne meno (senza MOLT e FIN)
      const media = RUOLI_DETTAGLI.map((nome, k) => voti.reduce((t, v, m) => {
        const suoi = (DETTAGLI[m].ruoli && DETTAGLI[m].ruoli()) || RUOLI_DETTAGLI, q = suoi.indexOf(nome);
        return t + (v[j].pp ? (q >= 0 ? v[j].pp[q] : 0) : (k === 0 ? 1 : 0));
      }, 0) / voti.length);
      let k = 0; media.forEach((x, q) => { if (x > media[k]) k = q; });
      ruoli.push(RUOLI_DETTAGLI[k]); sic.push(media[k]);
    });
    return { ...componiImporti(s.valori, ruoli), ruoli, sicurezza: Math.min(...sic), segni: s };
  }
  /* Il conto delle regole e quello del modello: se sono diversi e il modello è sicurissimo
     (ogni numero ≥ 98%), vale il modello. Le descrizioni restano quelle delle regole
     (la voce con lo stesso prezzo) o le parole prima del prezzo. */
  function conDettagli(l, testo) {
    const d = dettagliNeurali(testo);
    if (!d || d.sicurezza < SICURO_DETTAGLI || !(d.totale > 0)) return l;
    // "…totale 9.000": un totale detto per controllo; le regole lo confrontano con le voci e avvisano
    if (l.totaleDetto != null) return l;
    // una percentuale che il modello lascia senza ruolo e non è l'IVA ("sconto del cinque per
    // cento", in lettere: non l'ha mai vista): non è sicuro, decidono le regole (giro 18)
    const percSenzaRuolo = d.segni.segni.some((w, i) => /%>$/.test(w) && d.ruoli[i] === "O" && !d.segni.segni.slice(Math.max(0, i - 3), i).some((x) => /^(?:iva|aliquota)$/.test(x)));
    if (percSenzaRuolo) return l;
    const regole = l.voci && l.voci.length ? l.voci.reduce((t, v) => t + (v.quantita || 1) * v.prezzo, 0) : l.importo;
    if (regole != null && Math.abs(regole - d.totale) < 0.005) return l;
    const parole = d.segni.parole;
    const senzaImporto = (l.manca || []).filter((x) => x !== "importo");
    // "Du telecamere", "Er montaggio": senza il numero e l'articolo davanti
    const pulita = (t) => { const x = String(t || "").replace(/^(?:(?:il|la|lo|l['’]|i|gli|le|er|'o|'a|un|una|uno|du['’]?)\s+|(?:l['’]))+/i, "").split(/\s+/).filter((w, k) => k > 0 || numeroParola(w) == null).join(" ").trim(); return x ? x.charAt(0).toUpperCase() + x.slice(1) : ""; };
    const descrizione = (riga, k) => {
      const uguale = (l.voci || []).find((v) => Math.abs(v.prezzo - riga.prezzo) < 0.005);
      if (uguale) return pulita(uguale.descrizione) || uguale.descrizione;
      if (riga.i < 0) return "Acconto";
      let a = riga.i - 1;
      const inizio = d.righe[k - 1] ? d.righe[k - 1].i + 1 : 0;
      const pp = [];
      for (; a >= inizio && pp.length < 6; a--) { if (d.segni.valori[a] != null) break; pp.unshift(parole[a]); }
      const t = pp.join(" ").replace(/^(?:(?:e|poi|più|piu|anche|ci|metti|mettici|aggiungi|di|per|il|la|lo|i|le|a|da|al|alla|un|una|allora|poi)\s+)+/i, "").replace(/\s+(?:a|da|di|per|euro|l'uno|l'una|metti)$/i, "").trim();
      return pulita(t) || l.lavoro || "Voce " + (k + 1);
    };
    // sconto o acconto: una voce sola col totale giusto (la descrizione dice perché)
    if (d.sconto != null || d.scontoEuro != null || d.righe.some((r) => r.acconto)) {
      const acc = (d.righe.find((r) => r.acconto) || {}).acconto;
      const euro = (v) => v.toLocaleString("it-IT") + " €";
      const lavoro = l.lavoro && l.lavoro.split(/\s+/).length >= 2 ? l.lavoro : (d.righe[0] && d.righe[0].i >= 0 ? descrizione(d.righe[0], 0) : "");
      const descr = acc ? "Acconto " + acc.perc + "% su " + euro(acc.base) + (lavoro ? " (" + lavoro + ")" : "")
        : (lavoro || "Lavoro") + " (sconto " + (d.sconto != null ? d.sconto + "%" : euro(d.scontoEuro)) + ")";
      return { ...l, voci: [{ descrizione: descr, quantita: 1, prezzo: d.totale }], importo: d.totale, manca: senzaImporto, dettagliNeurali: true };
    }
    const voci = d.righe.map((r, k) => ({ descrizione: descrizione(r, k), quantita: r.quantita, prezzo: r.prezzo }));
    if (voci.length === 1 && voci[0].quantita === 1) return { ...l, voci: undefined, importo: d.totale, manca: senzaImporto, dettagliNeurali: true };
    return { ...l, voci, importo: d.totale, manca: senzaImporto, dettagliNeurali: true };
  }
  function classifica(testo, ctx) {
    if (NEURALE) { const r = NEURALE.classifica(segni(testo)); if (r) return r; }
    if (!MODELLO) return null;
    const f = caratteristiche(testo, ctx);
    if (!f.length) return null;
    const { K, W, scala, b, feat } = MODELLO;
    const z = b.slice();
    const viste = new Set();
    f.forEach((x) => {
      const i = feat[x];
      if (i === undefined || viste.has(i)) return;
      viste.add(i);
      for (let k = 0; k < K; k++) z[k] += W[i * K + k] * scala[k];
    });
    const m = Math.max(...z);
    const e = z.map((v) => Math.exp(v - m));
    const s = e.reduce((a, c) => a + c, 0);
    const pr = e.map((v) => v / s);
    const ordine = pr.map((v, k) => k).sort((a, c) => pr[c] - pr[a]);
    return { intento: MODELLO.intenti[ordine[0]], p: pr[ordine[0]], secondo: MODELLO.intenti[ordine[1]], p2: pr[ordine[1]] };
  }

  /* ---------------- Modi di dire → forma normale (29/09/2026) ----------------
     Come i "sinonimi" degli assistenti: lo stesso significato detto in un
     altro modo diventa la forma che il codice conosce. Vale per tutta l'app
     (si applica all'inizio di ogni frase). */
  const PARAFRASI = [
    [/^(?:fai|fammi|componi|chiama)\s+(?:il|al)\s+numero\s+(?:di|del|della|dello|dei|delle)\s+/i, "chiama "],
    [/^(?:salva|salvami|segna|segnami|memorizza|registra|aggiungi)\s+(?:il|un)\s+(?:numero|telefono|cellulare|contatto)\s+(?:di|del|della|dello|nuovo\s+di)\s+/i, "aggiungi "],
    [/^(?:mettimi|fammi|mi\s+metti|imposta(?:mi)?)\s+(?:un\s+)?(?:promemoria|avviso|sveglia)\s+(?:per\s+)?/i, "segna per "],
    // "è arrivato il bonifico della Moretti 2.000 euro" → "Moretti ha pagato 2.000 euro"
    [/^(?:(?:e|è|é|mi\s+(?:e|è)|ho)\s+)?(?:arrivato|arrivata|entrato|entrata|ricevuto|ricevuta)\s+(?:il\s+|l\s*'\s*)?(?:bonifico|pagamento|saldo|acconto)\s+(?:di|del|della|dello|dal|dalla|dallo|da|dei|delle|dall\s*'\s*|dell\s*'\s*)\s*(.+?)(?:\s+(?:di\s+)?((?:€\s*)?\d[\d.,]*\s*(?:euro|€)?))?$/i, (x, chi, soldi) => chi + " ha pagato" + (soldi ? " " + soldi : "")],
    [/^(?:fammi\s+parlare|passami|mettimi\s+in\s+contatto|fammi\s+sentire)\s+con\s+/i, "chiama "],
    // giro 13: "non dimenticare di…" = ricordami di; "non scordarti che…" = ricordati che (una nota)
    [/^(?:non|nn)\s+(?:dimenticare|dimenticarti|scordare|scordarti)\s+di\s+/i, "ricordami di "],
    [/^(?:non|nn)\s+(?:dimenticare|dimenticarti|scordare|scordarti)\s+che\s+/i, "ricordati che "],
    [/^(?:non|nn)\s+(?:dimenticare|dimenticarti|scordare|scordarti)\s+(?=(?:il|la|lo|l|i|gli|le)\b)/i, "ricordami "],
    // giro 10 (30/09/2026)
    [/^(?:fai|fagli|falle|fate)\s+sapere\s+/i, "scrivi "],
    [/^(?:bisogna|bisognerebbe|c\s*'?\s*e\s+da|c'è\s+da|ci\s+sarebbe\s+da|occorre|dobbiamo|dovrei)\s+(?=\p{L}+(?:are|ere|ire)\b)/iu, "devo "],
    [/^(?:ho|abbiamo)\s+(?:preso|fissato|messo)\s+(?:un\s+|l\s*'\s*)?appuntamento\s+/i, "segna appuntamento "],
    [/^(?:mi\s+)?(?:sono\s+arrivati|ho\s+ricevuto|ho\s+preso|ho\s+incassato)\s+i\s+soldi\s+(?:di|del|della|dello|dei|delle|dal|dalla|dallo|da|dell\s*'\s*|dall\s*'\s*)\s*(.+?)(?:\s*,?\s+(?:di\s+|sono\s+)?((?:€\s*)?\d[\d.,]*\s*(?:euro|€)?))?$/i, (x, chi, soldi) => chi + " ha pagato" + (soldi ? " " + soldi : "")],
    // "Vitale ha disdetto, cancella la manutenzione": il motivo davanti non serve
    [/^[^,]{2,50}\b(?:ha|hanno)\s+(?:disdetto|annullato|rinviato|chiamato|avvisato|detto\s+che\s+non\s+può)[^,]*,\s*(?=(?:cancella|annulla|elimina|togli|sposta|rimanda|anticipa)\b)/i, ""],
    [/^dove\s+(?:ho\s+messo|è|e|sta|trovo|si\s+trova|ho\s+salvato)\s+(il|la|lo|l\s*'|i|le|gli)\s*/i, "mostrami $1 "],
    [/^(?:chiedi|chiedigli|chiedile|domanda)\s+(?:a|ad|al|alla|allo)\s+/i, "scrivi a "],
    [/^(?:spedisci|inoltra|giragli|girale|gira|inviagli|inviale)\s+/i, "manda "],
    [/^foto\s+(?:al|alla|allo|ai|agli|alle|a|all\s*')\s*/i, "fai foto al "],
    [/^(?:fammi|fai|prepara|preparami|crea|nuovo)?\s*(?:lo\s+|il\s+|uno\s+|un\s+)?stato\s+(?:di\s+)?avanzamento(?:\s+(?:dei\s+)?lavori)?\s*/i, "fai il SAL "],
    [/^(?:crea|creami|fai|fammi|apri)\s+(?:la\s+|una\s+)?(?:nuova\s+)?cartella\s+/i, "aggiungi cartella "],
    [/^(?:segnami|segna|scrivimi|annotami|annota|prendi\s+nota|metti\s+in\s+mente)\s+che\s+(?:devo|dobbiamo|bisogna|devi)\s+/i, "ricordami di "],
  ];
  /* Le richieste indirette diventano il comando (giro 10, 30/09/2026):
     "me lo segni? giovedì alle 10 riunione…", "…, me lo segni?", "puoi
     telefonare all'osteria?", "mandi un messaggio a X che…?", "mi ricordi
     di…?", "fai sapere a X che…", "bisogna comprare…", "ho preso
     appuntamento con X…", "mi sono arrivati i soldi di X, 1.500 euro". */
  function infinitoAlComando(w) {
    const x = String(w || "").toLowerCase();
    if (x === "fare") return "fai";
    if (/are$/.test(x) && IMPERATIVI_BASE.test(x.slice(0, -2))) return x.slice(0, -2);
    if (/(?:ere|ire)$/.test(x) && IMPERATIVI_BASE.test(x.slice(0, -3) + "i")) return x.slice(0, -3) + "i";
    return null;
  }
  const AGENDA_TU = "(?:me\\s+lo|me\\s+la|mi|ce\\s+lo)\\s+(?:segni|metti\\s+in\\s+agenda|metti\\s+in\\s+calendario|segni\\s+in\\s+agenda|scrivi\\s+in\\s+agenda|metti)";
  const RICHIESTA_PRIMA = new RegExp("^" + AGENDA_TU + "\\s*[?,:]?\\s+(?=\\S)", "i");
  const RICHIESTA_DOPO = new RegExp("\\s*[,.]?\\s*" + AGENDA_TU + "\\s*[?!.]*$", "i");
  function richiestaAlComando(x, conDomanda) {
    let t = x, comando = false;
    if (RICHIESTA_PRIMA.test(t)) { t = "segna " + t.replace(RICHIESTA_PRIMA, ""); comando = true; }
    else if (RICHIESTA_DOPO.test(t) && t.replace(RICHIESTA_DOPO, "").split(/\s+/).length >= 3) { t = "segna " + t.replace(RICHIESTA_DOPO, ""); comando = true; }
    // "puoi telefonare a…", "potresti segnare…", "mi fai il piacere di chiamare…"
    const c = t.match(/^(?:mi\s+)?(?:puoi|potresti|riesci\s+a|riusciresti\s+a|mi\s+fai\s+il\s+piacere\s+di)\s+(\p{L}+)\b/iu);
    if (c) { const v = infinitoAlComando(c[1]); if (v) { t = v + t.slice(c[0].length); comando = true; } }
    // "mandi un messaggio…?", "mi chiami Rossi?", "mi ricordi di…?"
    if (!comando) { const d = /^(?:mi\s+)?ricordi\s+di\b/i.test(t) ? t.replace(/^(?:mi\s+)?ricordi\s+di\b/i, "ricordami di") : comandoDaTu(t, !!conDomanda); if (d && d !== t) { t = d; comando = true; } }
    // "mi prepari la fattura…? riparazione 220 euro": diventato un comando, il "?" in mezzo non serve
    if (comando) t = t.replace(/\s*\?\s*/g, " ").trim();
    return { t, comando };
  }
  function parafrasi(testo) {
    let t = togliRipensamenti(espandiAbbreviazioni(String(testo || "").trim()));
    const fine = (t.match(/[?!.]+$/) || [""])[0];
    let x = t.slice(0, t.length - fine.length).trim();
    const r = richiestaAlComando(x, /\?/.test(fine));
    x = r.t;
    for (const [re, sost] of PARAFRASI) {
      if (re.test(x)) { x = x.replace(re, sost).replace(/\s+/g, " ").trim(); break; }
    }
    // "70 per cento" detto a voce = "70%" (giro 5, 29/09/2026)
    x = x.replace(/\b(\d+(?:[.,]\d+)?)\s+per\s*cento\b/gi, "$1%");
    if (x === t.slice(0, t.length - fine.length).trim()) return t;
    // "dove ho messo…?" diventa un comando: il "?" non serve più; e così ogni richiesta indiretta
    return /^mostrami\b/i.test(x) || r.comando || /^(?:ricordami|chiama|scrivi|segna|devo)\b/i.test(x) ? x : x + fine;
  }
  /* Il modello ha capito COSA vuoi, le regole non ci sono arrivate: la frase
     riscritta nella forma normale di quel cassetto, così le regole leggono
     i pezzi (chi, quando, quanto). null = non si sa riscrivere. */
  function riscrivi(intento, testoOriginale, ctx) {
    ctx = ctx || {};
    const t = pulisci(testoOriginale).testo;
    const pp = parole(t);
    if (!pp.length) return null;
    const cl = trovaCliente(pp, ctx.clienti, new Set(), { nomeSolo: true });
    const nome = cl.stato === "trovato" ? cl.cliente.name : null;
    const dopoNome = cl.stato === "trovato" ? pp.slice(Math.max(...cl.usate) + 1).map((x) => x.o).join(" ").replace(/^(?:che|di|:|,)\s*/i, "") : "";
    const daParola = (re) => { const i = pp.findIndex((x) => re.test(x.n)); return i >= 0 ? pp.slice(i).map((x) => x.o).join(" ") : null; };
    const importo = trovaImporto(pp, new Set())[0];
    /* Un nome che non è tra i clienti (giro 18): "ciama el Sergio", "wa a Didonna la lavatrice va",
       "preso 80 euro contanti dal signor Chiabrando". Il nome con la maiuscola subito dopo la parola
       che lo annuncia (saltando articoli e titoli); poi decide l'app (chiede chi è, o se aggiungerlo). */
    const nomeLibero = (annuncio) => {
      const i = pp.findIndex((x) => annuncio.test(x.n));
      if (i < 0) return null;
      let j = i + 1;
      while (j < pp.length && /^(?:el|il|la|lo|l|al|alla|allo|a|ai|col|con|cor|co|dal|dalla|dallo|da|signor|signore|signora|sig|dottor|dottore|dottoressa|dott|ing|ingegner|geom|geometra|ragionier|rag|avvocato|avv|grossista|fornitore|fabbro|idraulico|elettricista|muratore|imbianchino|amministratore|architetto|commercialista|ditta)$/.test(pp[j].n)) j++;
      const nomi = [];
      while (j < pp.length && nomi.length < 3 && /^\p{Lu}/u.test(pp[j].o)) nomi.push(pp[j++].o);
      return nomi.length ? { nome: nomi.join(" "), resto: pp.slice(j).map((x) => x.o).join(" ").replace(/^(?:che|di|:|,)\s*/i, "") } : null;
    };
    const libero = nome ? null
      : intento === "chiamata" ? nomeLibero(/^(?:chiama|chiamami|chiamare|chiamà|ciama|ciamar|ciamame|telefona|telefonare|telefonà|parla|parlà|parlare)$/)
      : intento === "messaggio" ? nomeLibero(/^(?:wa|whatsapp|whats|wapp|sms|messaggio|scrivi|scrivigli|scrivere)$/)
      : intento === "incasso" ? nomeLibero(/^(?:da|dal|dalla|dallo|dai)$/)
      : null;
    switch (intento) {
      case "chiamata": return nome ? "chiama " + nome : libero ? "chiama " + libero.nome : null;
      case "calendario": { const q = trovaQuando(pp, ctx.oggi); return (q.ora || q.giornoIso) && !/^(?:segna|segnami)\b/i.test(t) ? "segna " + t.replace(/^(?:me\s+lo|me\s+la|mi)\s+(?:metti|segni)\s+(?:in\s+agenda\s+)?/i, "") : null; }
      case "messaggio": return nome && dopoNome.length >= 3 ? "scrivi a " + nome + " che " + dopoNome : libero && libero.resto.length >= 3 ? "scrivi a " + libero.nome + " che " + libero.resto : null;
      case "email": return nome ? "manda una mail a " + nome + (dopoNome ? " " + dopoNome : "") : null;
      case "incasso": { const chi = nome || (libero && libero.nome); return chi && importo ? chi + " ha pagato " + importo.valore + " euro" : chi ? chi + " ha pagato" : null; }
      case "cerca_documento": { const d = daParola(/^(?:foto|fotografi[ae]|preventiv[oi]|fattur[ae]|document[oi]|durc|visura|polizza|contratt[oi]|dico)$/); return d ? "mostrami " + d : null; }
      case "invio_documento": { const d = daParola(/^(?:preventiv[oi]|fattur[ae]|documento|pdf)$/); return d ? "manda il " + d.replace(/^(?:il|la|lo|i|le)\s+/i, "") : null; }
      case "foto": { const i = pp.findIndex((x) => /^(?:foto|fotografi[ae]|fotografa)$/.test(x.n)); return "fai foto " + (i >= 0 ? pp.slice(i + 1).map((x) => x.o).join(" ") : "").trim(); }
      case "cliente": { const x = t.replace(/^(?:\p{L}+\s+){0,4}?(?:numero|telefono|cellulare|contatto|cliente)\s+(?:di|del|della|dello|nuovo)?\s*/iu, ""); return /\d{6,}|\d{3}\s?\d{6,7}/.test(x) || x.split(/\s+/).length <= 3 ? "aggiungi " + x : null; }
      case "urgenza": return /^urgent/i.test(t) ? null : "urgente " + t;
      case "dico": return nome ? "fammi la dico per " + nome : null;
      default: return null;
    }
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
      if (pp[i + 1] && UNITA.test(pp[i + 1].n) && !/^(?:mila|k)$/.test(pp[i + 1].n)) continue; // "a 30 giorni": non è un importo
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
    // Senza IVA: "togli l'IVA", "senza iva", "esente iva", "iva a zero"
    if (/\b(?:togli|toglimi|leva|levami|rimuovi|elimina)\s+(?:l\s+)?iva\b|\bsenza\s+(?:l\s+)?iva\b|\besente\s+iva\b|\biva\s+(?:a\s+)?(?:zero|0)\b/.test(nt) && !/\d{2,}/.test(nt)) {
      esito.aliquota = 0; esito.cosa = "iva";
      return esito;
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
      // "Da Nello" (Ristorante Da Nello): "nello" è anche una preposizione, ma col maiuscolo dopo "Da" è il nome (giro 15)
      const nomeMaiuscolo = VUOTE.has(w || "") && /^\p{Lu}/u.test(pp[i].o) && i > 0 && /^(?:da|di|del|dal)$/.test(pp[i - 1].n);
      if (!w || w.length < 3 || (VUOTE.has(w) && !nomeMaiuscolo) || PAROLE_COMANDO.has(w)) return;
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
  /* Il telefono in una frase (giro 15, 29/09/2026): anche a gruppi
     ("0187 55 12 34", "340 998 1122") o detto a parole ("tre tre nove
     cinque…"). 8-13 cifre che cominciano con 0 o 3 (dopo un +39). */
  const CIFRE_PAROLE = { zero: 0, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9 };
  function trovaTelefono(testo) {
    const t = String(testo || "").replace(/\b(?:(?:zero|uno|due|tre|quattro|cinque|sei|sette|otto|nove)\s+){7,12}(?:zero|uno|due|tre|quattro|cinque|sei|sette|otto|nove)\b/gi,
      (m) => m.toLowerCase().split(/\s+/).map((w) => CIFRE_PAROLE[w]).join(""));
    const re = /(?:\+\s?39[\s.]?)?\d+(?:[\s./-]\d+)*/g;
    let m;
    while ((m = re.exec(t))) {
      let cifre = m[0].replace(/\D/g, "");
      if (m[0].trim().startsWith("+")) cifre = cifre.replace(/^39/, "");
      if (cifre.length >= 8 && cifre.length <= 13 && /^[03]/.test(cifre)) return { testo: t, inizio: m.index, fine: m.index + m[0].length, cifre };
    }
    return null;
  }

  /* Un cliente nuovo detto come viene (giro 15): "nuovo cliente: Bar Sport,
     telefono 0341 552908", "salva la signora Rosa Esposito 3389876543",
     "c'ho una cliente nuova, Chiara Bellotti, 333 22 44 551, salvala",
     "aggiungi cliente Condominio I Glicini, amministratore Sergio Lotti, 02…".
     Il nome = le parole con la maiuscola di fila (con "di", "la", "Il"…
     in mezzo); se è tutto minuscolo, le parole dopo "cliente"/"aggiungi".
     Quello che resta dopo il nome (indirizzo, referente) è la nota. */
  const NON_NOME_NUOVO = new Set(("aggiungi aggiungilo aggiungila aggiungimi salva salvala salvalo salvami metti mettilo mettila mettimi registra registrala registralo inserisci " +
    "inseriscilo inseriscila nuovo nuova cliente clienti c c'e ce c'ho cho ho mi eon allora ok senti eh ehm be beh e ma poi un una il la lo le i gli signor signora sig sigra dottor dottoressa " +
    "dott ing ingegner avv avvocato geom geometra telefono tel numero cell cellulare cel via piazza corso viale rubrica anagrafica ditta come amministratore referente si chiama " +
    "ciao ecco guarda scusa per favore grazie tra fra ai nei in è venuta venuto oggi ieri stamattina mi hanno affidato palazzo").split(" "));
  const LEGA_NOME = new Set("di da del della dello dei degli delle la le il lo i gli d de".split(" "));
  /* ---------------- Spostare o annullare un impegno (passo 3, 30/09/2026) ----------------
     Che la frase chieda di spostare/annullare lo decide il modello neurale;
     qui si leggono solo i dettagli, senza indovinare le formulazioni:
     - i tempi detti, uno per pezzo di frase ("domani invece che alle 16 … alle
       cinque e mezza" = domani 16:00 [vecchio], 17:30 [nuovo]);
     - quale impegno: il più simile per parole (cliente, lavoro, posto) e per
       giorno/ora detti;
     - il nuovo quando: il giorno e l'ora detti DIVERSI da quelli che ha già
       (quello che resta uguale non si tocca: "sabato 10 ottobre sempre alle 10").
     impegni: [{ id, titolo, chi, iso: "2026-10-03T16:00:00" }]. */
  const INIZIO_TEMPO = /^(?:oggi|domani|dopodomani|stasera|stamattina|domattina|stanotte|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|alle|all|dalle|dall|ore|verso|mezzogiorno|mezzanotte|fra|tra|\d{1,2}(?::\d{2})?|\d{1,2}\/\d{1,2}|la|le|l)$/;
  const FERMA_TEMPO = /^(?:invece|anziche|non|ma|piuttosto|oppure|perche|che|cosi|dopo|prima|spostal\w*|sposta|mettil\w*|portal\w*|facciamol\w*|fall\w*|rimandal\w*|anticipal\w*|posticipal\w*|slitta|cambia|correggi)$/;
  const NEGA_TEMPO = /^(?:invece|anziche|non|posto)$/;
  const VERBO_CAMBIO = /^(?:spost\w*|sposti|anticip\w*|posticip\w*|rimand\w*|slitt\w*|mettil\w*|mettimel\w*|mettiam\w*|portal\w*|portamel\w*|portiam\w*|falla|fallo|falle|falli|facciam\w*|famo|famola|famolo|invece|anziche|cambi\w*|corregg\w*|diventare)$/;
  const TIPI_IMPEGNO = /^(?:sopralluog\w*|appuntament\w*|verific\w*|consegn\w*|manutenzion\w*|riunion\w*|collaud\w*|preventiv\w*|intervent\w*|lavor\w*|incontr\w*|visit\w*|montaggi\w*|install\w*|chiamat\w*|telefonat\w*|cantier\w*)$/;
  function tempiDetti(pp, oggi) {
    const out = [];
    for (let i = 0; i < pp.length; i++) {
      if (!INIZIO_TEMPO.test(pp[i].n)) continue;
      let j = i;
      // "domani dalle 4 alle 6": ogni tempo il suo pezzo
      const ferma = (w) => FERMA_TEMPO.test(w) || /^(?:dalle|dall)$/.test(w) || (/^(?:dalle|dall)$/.test(pp[i].n) && /^(?:alle|all|a)$/.test(w));
      while (j < pp.length && j - i < 7 && (j === i || !ferma(pp[j].n)) && !(j > i && pp[j - 1].sep)) j++;
      const q = trovaQuando(pp.slice(i, j), oggi);
      if (!q.giornoIso && !q.ora) continue;
      const usate = [...q.usate];
      if (!usate.length || Math.min(...usate) > 1) continue; // il tempo deve cominciare qui
      const fine = i + Math.max(...usate);
      // negato: "invece che alle 16", "non alle 7", "anziché sabato", "dalle 4 (alle 6)"
      let k = i - 1;
      while (k >= 0 && /^(?:alle|all|le|a|ore|che|piu|e|di)$/.test(pp[k].n) && i - k <= 3) k--;
      const negato = /^(?:dalle|dall)$/.test(pp[i].n) || (k >= 0 && i - k <= 3 && NEGA_TEMPO.test(pp[k].n));
      out.push({ i, giornoIso: q.giornoIso, ora: q.ora, negato });
      i = fine;
    }
    return out;
  }
  const ANNULLA_PAROLE = /\b(?:cancella\w*|annulla\w*|togli\w*|leva\w*|elimina\w*|disdett\w*|disdic\w*|salta|saltato|salta\w*)\b|\bnon\s+si\s+fa\s+piu\b|\bnon\s+(?:ci\s+)?(?:vado|andiamo|viene|vengono)\s+piu\b/;
  const NON_ANNULLA = /\bnon\s+(?:la|lo|le|li)?\s*(?:voglio\s+)?(?:cancell|annull|togli)\w*/;
  const PAROLE_NON_NOME = /^(?:sposta\w*|spostal\w*|mett\w*|port\w*|fac\w*|fall\w*|rimand\w*|anticip\w*|posticip\w*|slitt\w*|cambi\w*|corregg\w*|cancell\w*|annull\w*|togl\w*|lev\w*|elimin\w*|appuntamento|impegno|orario|ora|giorno|domani|oggi|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|mattina|pomeriggio|sera|alle|invece|anziche|dopo|prima|sempre|scritto|detto|chiamato|chiesto|puo|riesce|arriva|viene|ottobre|novembre|dicembre|settembre|mezza|mezzo|mezzogiorno|diventare|intendo|quello|quella|quelli|signora|signor|signore|dottor|dottore|non|piu|che|eh|ah|allora|cioe|ciao|poi|anche|solo|niente|tutto|fatto|fare)$/;
  function leggiModificaImpegno(testoOriginale, impegni, oggiRif) {
    const oggi = new Date(oggiRif || Date.now());
    const testo = pulisci(testoOriginale).testo;
    const pp = parole(testo);
    const n = pp.map((x) => x.n).join(" ");
    const tempi = tempiDetti(pp, oggi);
    const usateTempo = new Set();
    tempi.forEach((t) => { for (let k = t.i; k < t.i + 6 && k < pp.length; k++) if (INIZIO_TEMPO.test(pp[k].n) || /^\d/.test(pp[k].n) || numeroParola(pp[k].n) !== null) usateTempo.add(k); });
    const giornoDi = (iso) => String(iso || "").slice(0, 10), oraDi = (iso) => String(iso || "").slice(11, 16);
    // Per riconoscere l'impegno contano le parole e i tempi detti PRIMA del verbo che cambia
    // ("l'hotel di sabato | anticipalo alle 7 e mezza che devono liberare le camere": le 7 e
    // mezza sono l'orario nuovo, "le camere" il motivo). Col verbo in testa ("rimanda la
    // verifica di Brambilla a venerdì") le parole fino al motivo ("che…", "perché…").
    const iVerbo = pp.findIndex((x) => VERBO_CAMBIO.test(x.n));
    const iMotivo = pp.findIndex((x, k) => k > Math.max(0, iVerbo) && /^(?:che|perche|siccome|cosi|visto)$/.test(x.n));
    const [da, a] = iVerbo > 0 ? [0, iVerbo] : [0, iMotivo > 0 ? iMotivo : pp.length];
    const tempiRiconosci = iVerbo >= 0 && !ANNULLA_PAROLE.test(n) ? tempi.filter((t) => t.i < iVerbo) : tempi;
    // Le parole che dicono QUALE impegno (cliente, lavoro, posto)
    const piene = pp.filter((x, k) => k >= da && k < a && !usateTempo.has(k) && x.n.length >= 3 && !VUOTE.has(x.n) && !PAROLE_NON_NOME.test(x.n) && numeroParola(x.n) === null).map((x) => x.n);
    const punteggi = (impegni || []).map((imp) => {
      const suo = norm((imp.titolo || "") + " " + (imp.chi || "")).split(" ");
      const radice = (w) => w.slice(0, Math.max(4, w.length - 2));
      let p = 0;
      const peso = (w) => (TIPI_IMPEGNO.test(w) ? 1 : 3);
      piene.forEach((w) => { if (suo.includes(w)) p += peso(w); else if (w.length >= 5 && suo.some((x) => x.length >= 5 && x.slice(0, 6) === w.slice(0, 6))) p += peso(w) - 1; });
      // a parità: quello che ha meno parole in più ("Verifica Villa Flora" prima di "Verifica impianto Villa Flora")
      p += 0.01 * (piene.filter((w) => suo.includes(w)).length / Math.max(1, suo.length));
      const parole = p;
      tempiRiconosci.forEach((t) => {
        if (t.giornoIso && t.giornoIso === giornoDi(imp.iso)) p += 4; // il giorno detto pesa più di una parola
        if (t.ora && t.ora === oraDi(imp.iso)) p += 2;
      });
      return { imp, p, parole };
    }).filter((x) => x.parole > 0 || x.p >= 4).sort((a, b) => b.p - a.p);
    const migliori = [];
    punteggi.filter((x) => x.p === (punteggi[0] && punteggi[0].p)).forEach((x) => { if (!migliori.some((m) => m.titolo === x.imp.titolo && m.iso === x.imp.iso)) migliori.push(x.imp); });
    // Il nuovo quando: giorno e ora detti, non negati, diversi da quelli che ha
    const nuovoPer = (imp) => {
      const g0 = giornoDi(imp.iso), o0 = oraDi(imp.iso);
      let g = null, o = null;
      tempi.filter((t) => !t.negato).forEach((t) => {
        if (t.giornoIso && t.giornoIso !== g0) g = t.giornoIso;
        if (t.ora && t.ora !== o0) o = t.ora;
      });
      // "rimandalo alla settimana prossima", "di una settimana": stesso giorno, sette giorni dopo
      if (!g && /\b(?:(?:alla|la)\s+settimana\s+(?:prossima|dopo)|di\s+una\s+settimana)\b/.test(n)) {
        const d = new Date(g0 + "T12:00:00"); d.setDate(d.getDate() + 7); g = isoGiorno(d);
      }
      // "un'ora dopo", "mezz'ora prima", "anticipa di un'ora"
      const rel = n.match(/\b(?:(un|una|due|tre|mezz)\s*(?:ora|ore)|(\d+)\s*minuti)\s+(dopo|prima|piu\s+tardi|in\s+anticipo)\b|\b(anticip|posticip)\w*\s+di\s+(un|una|due|mezz)\s*(?:ora|ore)\b/);
      if (!o && rel) {
        const quanti = rel[2] ? Number(rel[2]) : ({ un: 60, una: 60, due: 120, tre: 180, mezz: 30 })[rel[1] || rel[5]];
        const verso = /prima|anticip/.test(rel[3] || rel[4]) ? -1 : 1;
        const [h, m] = o0.split(":").map(Number);
        const tot = h * 60 + m + verso * quanti;
        if (tot > 0 && tot < 24 * 60) o = String(Math.floor(tot / 60)).padStart(2, "0") + ":" + String(tot % 60).padStart(2, "0");
      }
      // un'ora piccola per un impegno del pomeriggio: "alle 5" = 17
      if (o && Number(o.slice(0, 2)) < 8 && Number(o0.slice(0, 2)) >= 12) o = String(Number(o.slice(0, 2)) + 12).padStart(2, "0") + o.slice(2);
      if (!g && !o) return null;
      return (g || g0) + "T" + (o || o0) + ":00";
    };
    const spostaDetto = migliori.length ? migliori.some((imp) => nuovoPer(imp)) : tempi.some((t) => !t.negato) && tempi.length >= 2;
    const annullaDetto = ANNULLA_PAROLE.test(n) && !NON_ANNULLA.test(n);
    const ordineAnnulla = /\b(?:cancella|cancellalo|cancellala|cancellami|annulla|annullalo|annullala|togli|toglilo|toglila|leva|levalo|levala|elimina|eliminalo|eliminala)\b/.test(n) && !NON_ANNULLA.test(n);
    const tipo = spostaDetto && !(ordineAnnulla && !/\b(?:spost|mett|port|rimand|anticip|posticip|slitt|fall|facciam)\w*/.test(n)) ? "sposta" : annullaDetto ? "annulla" : null;
    // Non è un impegno ("annulla la fattura di Rossi") o sono due comandi ("cancella X e segna Y"): non tocca a questo cassetto
    const altraCosa = /\b(?:fattur\w*|preventiv\w*|document\w*|ddt|foto|nota|note|appunt\w*|cartell\w*|messaggi\w*|mail|email|pagament\w*|incass\w*|acconto|bonifico|cliente)\b/.test(n) && !/\b(?:appuntament\w*|impegn\w*|sopralluog\w*|riunion\w*|incontr\w*)\b/.test(n) && !migliori.some((m) => piene.some((w) => TIPI_IMPEGNO.test(w) && norm(m.titolo).includes(w.slice(0, 5))));
    const dueComandi = /\b(?:e|poi|e\s+poi)\s+(?:segna\w*|metti\w*|chiama\w*|manda\w*|scrivi\w*|fai|fammi|aggiungi\w*|crea\w*|ricorda\w*)\b/.test(n);
    // Senza una parola che dica di cambiare ("Rita domani alle 9 sopralluogo") è un impegno nuovo, non uno spostamento
    const cambio = /\b(?:spost\w*|rimand\w*|anticip\w*|posticip\w*|slitt\w*|cambi\w*|corregg\w*|mettil\w*|mettimel\w*|portal\w*|portamel\w*|falla|fallo|falle|falli|facciam\w*|mettiam\w*|portiam\w*|famo|famola|famolo|invece|anziche|diventare|cancell\w*|annull\w*|togli\w*|levalo|levala|levali|elimin\w*|disdett\w*|disdic\w*|salta\w*|sposti|dopo|prima)\b|\bnon\s+(?:puo|riesce|viene|vengono|ce\s+la|si\s+fa|c\s+e|piu)\b/.test(n);
    // Senza un nome né un lavoro ("annulla gli appuntamenti di domani pomeriggio") decidono
    // le regole per giorno e fascia, che li prendono tutti insieme
    const soloTempo = !piene.some((w) => !TIPI_IMPEGNO.test(w));
    if (altraCosa || dueComandi || !cambio || soloTempo) return { tipo: null, impegni: [], nuovoPer, tempi, parole: piene, motivo: altraCosa ? "non è un impegno" : dueComandi ? "due comandi" : !cambio ? "nessun cambio detto" : "solo giorno e ora" };
    return { tipo, impegni: migliori, nuovoPer, tempi, parole: piene };
  }

  /* ---------------- Preventivo o fattura (passo 3, 30/09/2026) ----------------
     Il modello neurale ha deciso che la frase chiede un preventivo o una fattura.
     Qui si toglie solo quello che faceva sbagliare le regole, poi legge il
     lettore di sempre (voci, importi, cliente):
     - la parola storpiata dalla dettatura: "prevendivo", "prevetivo", "fatturami";
     - "per un nuovo cliente," che faceva creare il cliente e basta.
     Torna la lettura solo se è davvero un documento da fare o cercare. */
  function distanza(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function parolaDocumento(w) {
    const n = norm(w);
    if (/^(?:preventiv[oi]|fattur[ae])$/.test(n)) return null;
    if (/^fattur(?:ami|agli|ale|alo|ala|iamo|a)$/.test(n)) return "fattura a";
    if (n.length >= 8 && n.length <= 12 && /^pre/.test(n) && distanza(n, "preventivo") <= 2) return "preventivo";
    if (n.length >= 6 && n.length <= 9 && /^fat/.test(n) && distanza(n, "fattura") <= 2) return "fattura";
    return null;
  }
  function leggiDocumento(testoOriginale, ctx) {
    let t = String(testoOriginale || "").split(/(\s+)/).map((w) => { const x = parolaDocumento(w.replace(/[^\p{L}]/gu, "")); return x ? w.replace(/[\p{L}]+/u, x) : w; }).join("");
    t = t.replace(/\b(?:per\s+)?(?:un|una|il|la)?\s*(?:nuov[oa]\s+client[ei]|client[ei]\s+nuov[oa])\s*[,:]?\s*/i, (m) => (/^per\b/i.test(m) ? "per " : ""))
      .replace(/\bper\s+(?:il|la)\s+(signor|signora|sig\.?)\s+/i, "per $1 ");
    const l = leggi(t, ctx);
    if (!l || l.azione !== "documento") return null;
    // "per un cliente nuovo, rifacimento impianto…" senza nome: il nome si chiede, non si inventa
    const dopoNuovo = (String(testoOriginale).split(/client[ei]\s+nuov[oa]|nuov[oa]\s+client[ei]/i)[1] || "").replace(/^[\s,:]+/, "").split(/\s+/).slice(0, 3).join(" ");
    const nuovoSenzaNome = /\b(?:nuov[oa]\s+client[ei]|client[ei]\s+nuov[oa])\b/i.test(testoOriginale) && l.clienteNuovo
      && !/^(?:(?:il|la|lo)\s+)?(?:signor|signora|sig|ditta|condominio|studio|bar|hotel|ristorante|trattoria|pizzeria)\b|^(?:(?:il|la)\s+)?\p{Lu}/u.test(dopoNuovo);
    if (nuovoSenzaNome) return conDettagli({ ...l, lavoro: (l.clienteNuovo + " " + (l.lavoro || "")).trim(), clienteNuovo: null, manca: [...new Set([...(l.manca || []), "cliente"])], testoLetto: t }, testoOriginale);
    return conDettagli({ ...l, testoLetto: t }, testoOriginale);
  }

  /* ---------------- Domande sui propri dati (passo 3, 30/09/2026) ----------------
     Il modello neurale ha deciso che è una domanda sui TUOI dati (agenda, soldi,
     documenti). Qui si capisce solo il tema e di chi/quando si parla; risponde
     il codice di sempre (rispondiSuiDati). Nessun tema sicuro = null (decide chi
     viene dopo, al massimo l'AI). */
  function leggiDomandaDati(testoOriginale, ctx) {
    ctx = ctx || {};
    const p = pulisci(testoOriginale);
    const pp = parole(p.testo);
    const n = pp.map((x) => x.n).join(" ");
    const q = trovaQuando(pp, ctx.oggi);
    const cl = trovaCliente(pp, ctx.clienti || [], new Set(q.usate));
    const cliente = cl.stato === "trovato" ? cl.cliente : null;
    const quando = { giornoIso: q.giornoIso, etichetta: q.etichetta, ora: q.ora, fascia: q.fascia };
    let tema = null;
    if (/\b(?:preventiv[oi]|fattur[ae])\b/.test(n) && /\b(?:accettat\w*|rispost\w*|risposto|mandat[oi]|inviat[oi]|fatt[oa]|fatte|apert[oi]|firmat[oi])\b/.test(n)) tema = "documenti";
    else if (/\bnon\s+(?:mi\s+|m\s+)?(?:paga|pagano|ha\s+(?:ancora\s+)?pagato|hanno\s+(?:ancora\s+)?pagato|(?:ha|hanno)\s+(?:ancora\s+)?dato)\b|\bda\s+riscuotere\b|\briscuot\w*\b|\bmi\s+deve\w*\b/.test(n)) tema = "crediti";
    else if (/\b(?:quanto|cosa)\b.*\b(?:dato|versato|pagato|preso|saldato)\b|\b(?:ha|hanno)\s+(?:gia\s+)?(?:saldato|pagato)\b|\bacconto\b.*\b(?:dato|dat[oi]|versat[oi])\b|\b(?:riepilogo|riassunto|resoconto)\s+degli\s+incassi\b|\bquanto\s+ho\s+(?:preso|incassato)\b/.test(n)) tema = "incassi";
    else if (/\b(?:lavori|giri|appuntament\w*|impegn\w*|consegn\w*)\b.*\b(?:settimana|domani|oggi|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|mese)\b|\b(?:settimana|domani|oggi|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b.*\b(?:lavori|giri|appuntament\w*|impegn\w*)\b|\bc\s*ho\b|\bcom\s*e\s+messa\b|\b(?:riepilogo|punto|riassunto)\s+dei\s+lavori\b|\bquand\s*e\s+che\s+devo\b|\bin\s+agenda\b/.test(n)) tema = "agenda";
    else if (/\b(?:cosa|che)\s+(?:mi\s+)?(?:ero|avevo)\s+segnat\w*\b/.test(n) && cliente) tema = "note_cliente";
    if (!tema) tema = temaDomanda(n);
    return tema ? { azione: "dati", tema, cliente, quando, testo: p.testo, originale: String(testoOriginale || "").trim() } : null;
  }

  /* ---------------- SAL: stato avanzamento lavori (passo 3, 30/09/2026) ----------------
     Il modello ha deciso che la frase chiede un SAL; qui solo i dettagli: il cliente
     e a che punto sono i lavori ("siamo a metà", "al 40%", "all'80", "al cinquanta",
     "arrivati al 75%"), e un importo se detto in euro. */
  function leggiSal(testoOriginale, ctx) {
    ctx = ctx || {};
    const pp = parole(pulisci(testoOriginale).testo);
    const n = pp.map((x) => x.n).join(" ");
    let percentuale = null;
    if (/\b(?:a\s+meta|alla\s+meta|meta\s+dei\s+lavori|fatto\s+meta|fatta\s+meta|meta\s+lavori)\b/.test(n)) percentuale = 50;
    for (let i = 0; i < pp.length && percentuale === null; i++) {
      const v = /^\d{1,3}%?$/.test(pp[i].n) ? Number(pp[i].n.replace("%", "")) : numeroParola(pp[i].n);
      if (v === null || !(v > 0 && v <= 100)) continue;
      const dopo = pp[i + 1] && pp[i + 1].n, prima = i > 0 ? pp[i - 1].n : "";
      const perCento = /%$/.test(pp[i].o) || /%$/.test(pp[i].n) || /^(?:%|percento|per)$/.test(dopo || "");
      if (perCento || /^(?:al|all|a|arrivati|arrivato|siamo)$/.test(prima)) percentuale = v;
    }
    const importi = pp.map((x, i) => ({ i, v: /^\d[\d.]*$/.test(x.n) ? Number(x.n.replace(/\./g, "")) : null })).filter((x) => x.v !== null && pp[x.i + 1] && /^(?:euro|€)$/.test(pp[x.i + 1].n));
    const cl = trovaCliente(pp, ctx.clienti || [], new Set());
    return { percentuale, importo: importi.length === 1 ? importi[0].v : null, cliente: cl.stato === "trovato" ? cl.cliente : null };
  }

  /* ---------------- Mandare un documento già fatto (passo 3, 30/09/2026) ----------------
     Il modello ha deciso che la frase chiede di MANDARE un preventivo o una fattura; qui
     il tipo, il cliente (dovunque sia nella frase: "il preventivo della palestra mandalo
     al titolare", "spedisci al condominio…") e il mese se detto. Torna la frase nella
     forma che il codice d'invio conosce: "manda la fattura di settembre a Paola Castelli". */
  function leggiInvioDocumento(testoOriginale, ctx) {
    ctx = ctx || {};
    const pp = parole(pulisci(testoOriginale).testo);
    const n = pp.map((x) => x.n).join(" ");
    const tipo = /\bfattur/.test(n) ? "fattura" : /\bpreventiv/.test(n) ? "preventivo" : null;
    if (!tipo) return null;
    // "manda la fattura da 500 a Rossi": con un importo è un documento NUOVO, non un invio
    if (/\bda\s+\d|\d\s*(?:euro|€)|€/.test(n) || pp.some((x) => /^\d{3,}$/.test(x.n.replace(/\./g, "")) && !/^(?:n|numero)$/.test((pp[pp.indexOf(x) - 1] || {}).n || ""))) return null;
    const cl = trovaCliente(pp, ctx.clienti || [], new Set());
    if (cl.stato !== "trovato") return null;
    const mese = MESI.find((m) => new RegExp("\\b" + m + "\\b").test(n));
    const numero = (n.match(/\b(?:n|numero)\s+(\d+)\b/) || [])[1];
    const testo = "manda " + (tipo === "fattura" ? "la fattura" : "il preventivo") + (numero ? " numero " + numero : "") + (mese ? " di " + mese : "") + " a " + cl.cliente.name;
    return { tipo, cliente: cl.cliente, mese: mese || null, testo };
  }

  /* Passo 3 (30/09): il modello ha già detto "messaggio", "email" o "chiamata"; qui solo a
     chi e cosa. Il destinatario è quello subito dopo il verbo o il canale ("avvisa con un
     whatsapp il ragionier Pozzoli che…", "scrivi sul gruppo dei ragazzi…", "fammi parlare
     con l'amministratore Pozzoli"), non un cliente nominato nel testo ("pec all'avvocato
     Donati per la messa in mora di Esposito"). Una correzione prima del "che" ("scrivi al
     condominio... cioè all'amministratore…", "no aspetta, scrivi una mail al
     commercialista…") vale per quello che viene dopo. */
  function leggiDestinatario(testoOriginale, ctx, tipo) {
    ctx = ctx || {};
    const intero = String(testoOriginale || "").replace(/\s+/g, " ").trim();
    let t = intero;
    const iChe0 = t.search(/\bche\b/i);
    const testa0 = iChe0 >= 0 ? t.slice(0, iChe0) : t;
    // "chiama Rossi e poi manda un messaggio a Bianchi": due comandi, restano alle regole di prima
    if (/\b(?:e|poi|e\s+poi)\s+(?:segna|metti|chiama|manda|scrivi|fai|fammi|aggiungi|crea|ricorda)\p{L}*/iu.test(testa0)) return null;
    const corr = [...testa0.matchAll(/(?:\.{2,}|…|,)?\s*\b(?:cioè|cioe|anzi|no\s+aspetta|no\s+scusa|no\s+no)(?!\p{L})[\s,.]*/giu)].pop();
    if (corr) t = t.slice(corr.index + corr[0].length);
    const canale = tipo === "chiamata" ? "chiama" : /\b(?:pec|e-?mail|mail)\b/i.test(t) || tipo === "email" ? "email" : /\bwhats\s?app\b/i.test(t) ? "whatsapp" : "messaggio";
    const iChe = t.search(/\bche\b/i);
    let dest = iChe >= 0 ? t.slice(0, iChe) : t;
    let messaggio = iChe >= 0 ? t.slice(iChe).replace(/^che\s+/i, "").trim() : "";
    const verbi = [...dest.matchAll(/\b(?:manda\p{L}*|scriv\p{L}*|avvis\p{L}*|chiam\p{L}*|telefon\p{L}*|parlare\s+con|messagg\p{L}*|whats\s?app|e-?mail|mail|pec|sms)\b/giu)].pop();
    if (verbi) dest = dest.slice(verbi.index + verbi[0].length);
    else if (!corr) return null;
    const LEGA = /^(?:(?:sul\s+gruppo(?:\s+(?:dei|degli|delle|della|del|di))?|al|alla|allo|ai|agli|alle|a|ad|il|la|lo|i|gli|le|con|un|una|uno|di|mi|subito|direttamente|pure|anche)\s+|(?:all|l|dell|coll)['’]\s*)/i;
    let prima;
    do { prima = dest; dest = dest.trim().replace(LEGA, ""); } while (dest !== prima);
    // senza "che": il messaggio comincia dove finisce il nome ("ai ragazzi della squadra domani cantiere Miramonti ore 7")
    const stop = dest.search(/[,;:]|\.{2,}|…|\s(?:oggi|domani|dopodomani|stasera|stamattina|luned\p{L}*|marted\p{L}*|mercoled\p{L}*|gioved\p{L}*|venerd\p{L}*|sabato|domenica|alle|ore|per|perché|perche|se|quando|e\s+digli|e\s+dille|digli|dille|dicendo\p{L}*)\b/iu);
    let oggetto = "";
    if (stop >= 0) {
      const resto = dest.slice(stop).replace(/^[\s,;:.…]+/, "").replace(/^(?:e\s+)?(?:digli|dille|dicendo(?:gli|le)?)\s+(?:che\s+)?/i, "").trim();
      dest = dest.slice(0, stop);
      if (!messaggio) {
        // "pec all'avvocato Donati per la messa in mora di Esposito": "per …" è l'oggetto, il testo lo scrive lui
        if (/^per\s/i.test(resto)) oggetto = resto.replace(/^per\s+/i, "");
        else messaggio = resto;
      }
    }
    dest = dest.replace(/[.…!?]+$/, "").trim().split(/\s+/).slice(0, 5).join(" ");
    if (!dest || /^(?:lo|la|li|le|gli|mi|ti|ci|vi|ne)$/i.test(dest)) return null;
    // "manda un feedback: …", "manda la fattura a Rossi": non è una persona, restano ai loro percorsi
    if (/^(?:feedback|segnalazion|suggeriment|recension|promemoria|notific|report|backup|fattur|preventiv|document|foto|pdf|file|contratt|computo|cartell|posizione|dico|di\.co|sal\b|ricevut|bonifico|pagament)/i.test(dest)) return null;
    const cl = trovaCliente(parole(dest), ctx.clienti || [], new Set());
    return {
      azione: canale, testo: intero, originale: intero, nomeDetto: dest, messaggio: messaggio.replace(/[.!]+$/, ""), oggetto,
      cliente: cl.stato === "trovato" ? cl.cliente : null,
      candidati: cl.stato === "ambiguo" ? cl.candidati : null,
      clienteSimile: cl.stato === "simile" ? cl.cliente : null
    };
  }

  /* Passo 3 (30/09): il nome della cartella da creare, quando il modello ha detto "cartella":
     "nuova cartella: Sicurezza cantieri", "fai una cartella nuova che si chiama Hotel
     Belvedere lavori 2026", "crea una cartella per i lavori del tetto… chiamala Tetto Parco Verde" */
  function leggiCartella(testoOriginale) {
    const t = String(testoOriginale || "").replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
    if (!/\b(?:crea|creami|fai|fammi|aggiungi|aggiungimi|apri|aprimi|nuova)\b/i.test(t) || !/\bcartell[ae]\b/i.test(t)) return null;
    // "metti in cartella Scadenze pagare F24": una nota IN una cartella, non una cartella nuova
    if (/\b(?:in|nella|dentro\s+la|sulla)\s+cartella\b/i.test(t)) return null;
    let m = t.match(/\b(?:chiamala|chiamata|che\s+si\s+chiama|di\s+nome|col\s+nome|con\s+(?:il\s+)?nome)\s*:?\s+(.+)$/i)
      || t.match(/\bcartella(?:\s+nuova)?\s*:\s*(.+)$/i)
      || t.match(/\bcartella(?:\s+nuova)?\s+(?:per\s+(?:il|la|i|le|gli|lo)?\s*|di\s+|del\s+|della\s+)?(.+)$/i);
    if (!m) return null;
    const nome = m[1].replace(/^[«"'“]+|[»"'”]+$/g, "").trim();
    if (!nome || nome.split(/\s+/).length > 6) return null;
    return { nome };
  }

  /* Passo 3 (30/09): per quale cliente la dichiarazione di conformità, quando il modello ha
     detto "dico": "mi serve la di.co. per il condominio via gramsci, impianto citofonico",
     "la dico dell'hotel belvedere per le luci di emergenza, preparala…" */
  function leggiDico(testoOriginale, ctx) {
    ctx = ctx || {};
    const t = String(testoOriginale || "").replace(/\s+/g, " ").trim();
    const m = t.match(/\b(?:di\.?\s*co\.?|dico|dichiarazione\s+di\s+conformit[aà]|conformit[aà])(?=[\s,.]|$)\s*(.*)$/i);
    if (!m) return null;
    let resto = m[1].replace(/^(?:(?:per|del|della|dello|di|a|al|alla|da|dal|dell['’]|all['’])\s*)?(?:(?:l['’]\s*|il\s+|la\s+)?(?:impianto|lavoro|cliente)\s+)?(?:(?:del|della|dei|di|da|dal|per|dell['’])\s*)?/i, "");
    resto = resto.split(/[,;:]|\s(?:per|che|perch[eé]|preparala|fammela|falla)\b/i)[0].trim().replace(/^(?:il|la|lo|i|gli|le)\s+|^l['’]\s*/i, "").split(/\s+/).slice(0, 5).join(" ");
    const cl = resto ? trovaCliente(parole(resto), ctx.clienti || [], new Set()) : { stato: "nessuno" };
    return { cliente: cl.stato === "trovato" ? cl.cliente : null, nomeDetto: resto };
  }

  /* Passo 3 (30/09): l'assemblea, quando il modello ha detto "assemblea" ma la frase non
     comincia come il lettore se l'aspetta ("mettimi l'assemblea del Parco Verde…", "c'è da
     convocare n'altra volta l'assemblea dell'Aurora che la prima è andata deserta…"): il
     condominio è quello nominato dopo "assemblea" (prima del motivo), il motivo dopo "per" */
  function leggiAssemblea(testoOriginale, ctx) {
    ctx = ctx || {};
    const t = String(testoOriginale || "").replace(/\s+/g, " ").trim();
    const m = t.match(/\bassemble[ae]\b\s*(.*)$/i);
    if (!m) return null;
    const dopo = m[1];
    const quando = trovaQuando(parole(pulisci(t).testo), ctx.oggi || new Date());
    const testaNome = dopo.split(/[,;:]|\s(?:per|che|perch[eé]|il\s+\d|alle|oggi|domani|dopodomani|luned\p{L}*|marted\p{L}*|mercoled\p{L}*|gioved\p{L}*|venerd\p{L}*|sabato|domenica)\b/iu)[0];
    let cl = trovaCliente(parole(testaNome), ctx.clienti || [], new Set(), { nomeSolo: true });
    if (cl.stato !== "trovato") cl = trovaCliente(parole(dopo), ctx.clienti || [], new Set(), { nomeSolo: true });
    let condominio = cl.stato === "trovato" ? cl.cliente.name : "";
    if (!condominio) {
      const nome = testaNome.replace(/^(?:(?:del|della|dello|dei|di|al|alla|in|nel|nella|presso)\s+|(?:dell|all|nell)['’]\s*)/i, "").replace(/^condominio\s+/i, "").trim();
      if (nome && nome.split(/\s+/).length <= 4) condominio = "Condominio " + maiuscola(nome);
    }
    if (!condominio) return null;
    const mm = dopo.match(/\bper\s+(?!\d)(.+?)(?=\s+il\s+\d|\s+(?:oggi|domani|dopodomani|luned\p{L}*|marted\p{L}*|mercoled\p{L}*|gioved\p{L}*|venerd\p{L}*|sabato|domenica|alle)\b|[,;]|$)/iu);
    const motivo = mm ? maiuscola(mm[1].replace(/^(?:il|la|lo|i|gli|le)\s+|^l['’]\s*/i, "")) : "";
    return { azione: "assemblea", testo: t, originale: t, condominio, cliente: cl.stato === "trovato" ? cl.cliente : null, tipo: /straordinari/i.test(t) ? "straordinaria" : "ordinaria", motivo, quando };
  }

  function leggiNuovoCliente(testo) {
    const tel = trovaTelefono(testo);
    let t = tel ? tel.testo.slice(0, tel.inizio) + " ; " + tel.testo.slice(tel.fine) : String(testo || "");
    t = t.replace(/\b(?:il\s+)?(?:suo\s+)?(?:numero(?:\s+di\s+telefono)?|telefono|tel|cellulare|cell|cel)\.?(?:\s+(?:è|e'|:))?\s*(?=;)/gi, " ");
    const pezzi = t.split(/\s*[,;:()]\s*|\s+-\s+|\.\s+/).map((x) => x.trim()).filter(Boolean);
    const chiave = (w) => norm(w).replace(/\s+/g, "");
    let nome = null, dove = -1;
    // 1) le parole con la maiuscola, di fila
    for (let k = 0; k < pezzi.length && !nome; k++) {
      const w = pezzi[k].split(/\s+/);
      for (let i = 0; i < w.length && !nome; i++) {
        if (!/^\p{Lu}[\p{L}'’.-]*$/u.test(w[i]) || NON_NOME_NUOVO.has(chiave(w[i]))) continue;
        const run = [w[i]];
        for (let j = i + 1; j < w.length && run.length < 6; j++) {
          if (/^\p{Lu}[\p{L}'’.-]*$/u.test(w[j]) && !/^(?:telefono|tel|numero|cell|cellulare|salvala|salvalo|mettila|mettilo)$/i.test(w[j])) run.push(w[j]);
          else if (/^(?:Il|La|Le|Lo|I|Gli|Da|Di|Del|Della|Dei|De)$/.test(w[j]) || LEGA_NOME.has(w[j].toLowerCase()) && j + 1 < w.length && /^\p{Lu}/u.test(w[j + 1])) run.push(w[j]);
          else break;
        }
        while (run.length > 1 && LEGA_NOME.has(run[run.length - 1].toLowerCase())) run.pop();
        nome = run.join(" "); dove = k;
      }
    }
    // 2) tutto minuscolo: le parole dopo "cliente"/"aggiungi"/"salva" (fino a 4)
    if (!nome) {
      for (let k = 0; k < pezzi.length && !nome; k++) {
        const w = pezzi[k].split(/\s+/);
        const da = w.findIndex((x) => /^(?:cliente|aggiungi|salva|registra|inserisci|rubrica)$/i.test(x));
        if (da < 0 && k === 0) continue;
        const resto = w.slice(da + 1).filter((x, i, a) => !(i === 0 && NON_NOME_NUOVO.has(chiave(x))));
        while (resto.length && NON_NOME_NUOVO.has(chiave(resto[0]))) resto.shift();
        const run = [];
        for (const x of resto) { if (/\d/.test(x) || NON_NOME_NUOVO.has(chiave(x)) && !LEGA_NOME.has(x.toLowerCase())) break; run.push(x); if (run.length === 4) break; }
        while (run.length && LEGA_NOME.has(run[run.length - 1].toLowerCase())) run.pop();
        if (run.length) { nome = run.map((x) => LEGA_NOME.has(x.toLowerCase()) ? x.toLowerCase() : x.charAt(0).toUpperCase() + x.slice(1)).join(" "); dove = k; }
      }
    }
    if (!nome || nome.replace(/[^\p{L}]/gu, "").length < 3) return null;
    // la nota: indirizzo o referente detti dopo il nome
    const nota = pezzi.slice(dove + 1).filter((x) => /^(?:in\s+)?(?:via|piazza|corso|viale|amministratore|referente|riferimento)\b/i.test(x)).map((x) => x.replace(/^in\s+/i, "")).join(", ");
    return { nome, telefono: tel ? tel.cifre : "", nota: nota ? nota.charAt(0).toUpperCase() + nota.slice(1) : "" };
  }

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
      for (let j = i + 1; j < pp.length && usate.length < 3 && libero(j); j++) { usate.push(j); if (pp[j].sep) break; } // la virgola chiude il nome
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
    if (/\b(?:incassar\w*|pagar\w*|pagat\w*|pagament\w*|devono|quanto\s+(?:mi\s+|ci\s+|m\s+)?dev(?:e|ono)|(?:mi|ci)\s+dev(?:e|ono)|dev(?:e|ono)\s+(?:ancora|dare|pagare|saldare)|deb\w*|credit\w*|sospes\w*|scadut\w*|insolut\w*|da\s+prendere|prendere\s+ancora|ancora\s+da\s+prendere|devo\s+(?:ancora\s+)?prendere|moros\w*|mi\s+devono)\b/.test(n) && !/\bincassato\b/.test(n)) return "crediti";
    if (/\b(?:incassato|incassi|entrat[oaie]|guadagnat[oaie]|guadagno|fatturato|tirato\s+su|preso\s+di\s+acconto|acconti?\s+(?:ho|mi)\b)\b/.test(n)) return "incassi";
    // giro 15: "quali preventivi ho ancora aperti", "il preventivo più alto", "ho già fatto la fattura a…?"
    if (/\b(?:preventiv[oi]|fattur[ae])\s+(?:(?:sono|ho|abbiamo)\s+)?(?:ancora\s+)?(?:aperti|apert[oa]|in\s+attesa|da\s+accettare|non\s+accettat\w*)\b|\b(?:preventiv[oi]|fattur[ae])\s+piu\s+(?:alt[oa]|grande|car[oa])\b|^ho\s+(?:gia\s+)?fatto\s+(?:la|il)\s+(?:fattura|preventivo)\b|\bquanto\s+valgono\b.*\bpreventiv|\b(?:a\s+)?quanto\s+(?:era|e|viene|veniva|avevo\s+fatto)\s+(?:il|la)\s+(?:preventivo|fattura)\b/.test(n)) return "documenti";
    // "a che ora devo essere dal Gabbiano domani?", "c'ho qualcosa venerdì?", "a che ora è il getto di sabato?"
    if (/^(?:ma\s+)?(?:io\s+)?a\s+che\s+ora\b|\b(?:c\s*ho|ho)\s+qualcosa\b|\bsono\s+liber[oa]\b/.test(n)) return "agenda";
    if (/\b(?:cantier[ie]|interventi|impianti|condomini|lavori\s+(?:in\s+corso|aperti|attivi)|lavori\s+(?:ho|abbiamo)\s+(?:in\s+corso|aperti|attivi))\b/.test(n)) return "cantieri";
    // "quanti preventivi ho fatto questo mese?", "quante fatture ho fatto?" (giro 5)
    if (/^(?:quanti|quante)\s+(?:preventivi|fatture)\b|\b(?:preventivi|fatture)\s+(?:ho|abbiamo)\s+(?:fatto|fatte|mandato|mandate|emesso|emesse)\b/.test(n)) return "documenti";
    if (/\b(?:impegn[oi]|appuntament[oi]|programma|agenda|liber[oaie]|occupat[oa]|da\s+fare|calendario|giornata)\b/.test(n)) return "agenda";
    // "che lavori ho domani?", "cosa ho la prossima settimana?", "cosa devo fare dopodomani?"
    if (/^(?:cosa|che\s+cosa|che|che\s+lavori|che\s+impegni|che\s+giri)\s+(?:ho|abbiamo|devo\s+fare|dobbiamo\s+fare|faccio|facciamo)\b/.test(n)) return "agenda";
    if (/^(?:\w+\s+)?(?:cosa|che)\s+c\s*e\s*$/.test(n) || /^(?:domani|oggi|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\s+(?:cosa|che)\s+(?:c\s*e|ho)\b/.test(n)) return "agenda"; // "domani cosa c'è?"
    if (/^quando\s+(?:devo|dovrei|ho|vedo|incontro|vado|passo|sento|chiamo)\b|\bdevo\s+vedere\b/.test(n)) return "agenda";
    if (/\b(?:clienti)\b/.test(n)) return "clienti";
    if (/\b(?:urgenz[ae]|urgenti)\b/.test(n)) return "urgenze";
    return null;
  }

  /* ---------------- Più comandi ---------------- */
  const VERBI_COMANDO = "(?:cancella|annulla|elimina|segna|segnami|metti|fissa|vai|andare|passa|passare|sentire|senti|chiama|chiamare|richiama|telefona|telefonare|manda|mandare|inviare|invia|scrivi|scrivere|fai|fare|crea|prepara|compra|comprare|ritira|ritirare|porta|portare|ricordami|devo|appuntamento|sopralluogo|riunione|incontro|visita)";
  const ORE_A_PAROLE = "(?:una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti)";
  const SEPARA = new RegExp(`\\s*(?:[.;]\\s+|,?\\s+(?:e\\s+poi|poi|ah\\s+e|e\\s+anche|inoltre)\\s+|,\\s*(?=${VERBI_COMANDO}\\b)|\\s+e\\s+(?=${VERBI_COMANDO}\\b)|,?\\s+e\\s+(?=(?:alle|ore|dalle)\\s+(?:\\d|${ORE_A_PAROLE}\\b)))`, "i"); // "…alle 11 officina Tosi e alle 16 pizzeria" (giro 7), "…e alle undici dal Tosi" (giro 18)
  function dividi(testo) {
    /* Un elenco di impegni con le virgole (29/09/2026): "domani mattina sentire
       prospect, sentite clienti per aggiuntivi, Brigida alle 18 per…, 18:30
       Ferraresi e Albe" — con almeno due orari, ogni virgola separa */
    const t0 = String(testo || "").trim().replace(/[.!]+$/, "");
    const orari = (t0.match(/\b(?:alle|ore|all)\s+\d{1,2}(?:[:.]\d{2})?\b|\b\d{1,2}:\d{2}\b/gi) || []).length;
    if (orari >= 2 && /,/.test(t0) && !/\b(?:preventiv|fattur)/i.test(t0)) {
      const perVirgola = t0.split(/\s*[,;.]\s+|\s+(?:e\s+poi|poi)\s+|\s+e\s+(?=(?:alle|ore|dalle)\s+\d)/i).map((p) => p.trim()).filter((p) => p && !/^(?:e|poi)$/i.test(p));
      if (perVirgola.length >= 2 && perVirgola.length <= 6) return perVirgola;
    }
    let parti = t0.split(SEPARA)
      .map((p) => String(p || "").trim().replace(/^(?:ah|e|poi|ok|allora)[,\s]+/i, "").trim())
      .filter((p) => p && !/^(?:ah|oh|e|poi|ok|allora|anzi)$/i.test(p));
    /* "segnami venerdì alle 9, sopralluogo da Rizzo" (giro 13): un pezzo fatto solo
       di "segnami" e del quando non è un comando a sé, si riattacca al successivo */
    for (let k = 0; k < parti.length - 1; k++) {
      const pp = parole(parti[k]);
      const q = trovaQuando(pp, new Date());
      const resto = pp.filter((x, i) => !q.usate.has(i) && !/^(?:segna|segnami|metti|mettimi|fissa|fissami|prenota|per|il|la)$/.test(x.n));
      if (!resto.length && (q.ora || q.giornoIso)) {
        /* "giovedì alle 10 e poi alle 16 due sopralluoghi a Pinerolo" (giro 18): anche il pezzo
           dopo ha la sua ora, allora sono due impegni con la stessa cosa da fare */
        const pp2 = parole(parti[k + 1]), q2 = trovaQuando(pp2, new Date());
        const cosa = pp2.filter((x, i) => !q2.usate.has(i)).map((x) => x.o).join(" ").replace(/^(?:due|2|tre|3)\s+/i, "").trim();
        if (q.ora && q2.ora && cosa.split(/\s+/).length >= 2) { parti[k] = parti[k] + " " + cosa; continue; }
        parti.splice(k, 2, parti[k] + " " + parti[k + 1]); k--;
      }
    }
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
    // "ho sostituito il miscelatore, pagati in contanti": un fatto, non una domanda (ho + participio)
    const canaleInTesta = /^(?:whatsapp|sms|messaggio|mail|email|scrivi|scrivigli|scrivile|manda\s+(?:un|una)\s+(?:messaggio|whatsapp|sms|mail|email))\b/.test(n) && /\b(?:a|al|alla|ad|allo)\b/.test(n);
    const domanda = !canaleInTesta && (p.domanda || PAROLE_DOMANDA.test(n)) || (/^(?:ho|sono|hai|e)\b/.test(n) && !!temaDomanda(n) && !/^(?:ho|abbiamo)\s+(?:gia\s+)?\w+(?:ato|uto|ito|ata|uta|ita|ati|iti|ute)\b/.test(n) && !/^sono\s+(?:stato|stata|andato|andata|passato|passata)\b/.test(n));

    /* Un cliente nuovo (giro 15): "metti in rubrica…", "salva la signora X
       339…", "c'è un cliente nuovo, X, 0521…", "registra la ditta X come
       nuovo cliente", "…mettila tra i clienti". Nome, telefono e nota li
       legge leggiNuovoCliente; il cliente lo crea l'app. Prima delle
       domande: "c'è un cliente nuovo" non è una domanda. */
    const conVerboCliente = /\b(?:aggiung|inserisc|mett|salv|registr)\w*\b/.test(n);
    const cueCliente = /\b(?:nuov[oa]\s+cliente|cliente\s+nuov[oa]|in\s+rubrica|in\s+anagrafica|(?:signora|signore?)\s+nuov[oa])\b/.test(n)
      || conVerboCliente && /\b(?:come\s+(?:nuov[oa]\s+)?client[ei]|(?:tra|fra|ai|nei)\s+(?:miei\s+)?clienti|cliente)\b/.test(n)
      || /^(?:salva|salvami|registra|aggiungi|inserisci)$/.test(primo) && !!trovaTelefono(testo);
    if (cueCliente && !p.domanda && !q.ora && !/^(?:scrivi|manda|invia|chiama|telefona|di|dì|quant\w*|chi|cosa|che|quali?)$/.test(primo)) {
      const nc = leggiNuovoCliente(testo);
      if (nc) {
        const k = norm(nc.nome);
        const gia = (ctx.clienti || []).find((c) => { const x = norm(c.name || ""); return x === k || x.length > 4 && (x.includes(k) || k.includes(x)); });
        return { ...base, azione: "cliente", cliente: gia || null, telefono: !!nc.telefono, nuovoCliente: gia ? null : nc, quando };
      }
    }

    // "quando vado da Bortolin portare la scala lunga": un promemoria per quella volta, non una domanda (giro 15)
    if (/^quando\s+(?:vado|passo|torno|arrivo|vai)\s+(?:da|dal|dalla|dai|al|alla|in|a)\b/.test(n) && !p.domanda && !q.giornoIso) { const clQ = trovaCliente(pp, ctx.clienti, usate); return { ...base, azione: "mente", cosa: maiuscola(testo), cliente: clQ.stato === "trovato" ? clQ.cliente : null, quando }; }

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
    /* Giro 15: una preferenza o un'abitudine del cliente è una nota, anche con un'ora
       dentro ("la Benvenuti preferisce che la chiami dopo le sei di sera", "Pagnoni
       preferisce essere contattata solo su WhatsApp", "Tommasini paga solo con
       bonifico a fine mese"); così "quando vado da Bortolin portare la scala" e
       "segna che la pizzeria ha l'impianto vecchio" */
    const preferenza = /^(?:\S+\s+){0,5}(?:preferisc\w*|vuole\s+essere|vogliono\s+essere|va\s+(?:chiamat|contattat|sentit)\w*|paga(?:no)?\s+(?:solo|sempre)|ricev\w+\s+solo)\b/.test(n) && !p.domanda && !/^(?:chiama|telefona|scrivi|manda|invia|segna(?:mi)?\s+(?:un|l)\s*appuntamento)\b/.test(n);
    const segnaChe = /^(?:segna(?:ti|mi)?|annota(?:ti|mi)?|appunta(?:ti|mi)?|scriviti|nota)\s+che\b/.test(n) && !q.giornoIso && !q.ora && !/\b(?:pagat|saldat|incassat|versat|caparra|acconto|anticipo|bonifico|lasciato|dato)\w*/.test(n);
    if (preferenza || segnaChe) { const clP = trovaCliente(pp, ctx.clienti, usate); return { ...base, azione: "mente", cosa: maiuscola(testo), cliente: clP.stato === "trovato" ? clP.cliente : null, quando: { giornoIso: null, etichetta: null, ora: null, fascia: null } }; }
    // "Conti mi ha detto che paga a fine mese": quello che ha detto un cliente è una nota, anche con una data dentro
    if (!q.ora && !V.chiama.test(primo) && !V.manda.test(primo) && !V.messaggio.test(primo) && /^(?:eon\s+)?(?:\S+\s+){0,3}(?:mi|ci)\s+ha(?:nno)?\s+(?:detto|scritto|fatto\s+sapere|promesso)\s+che\b/.test(n)) { const clD = trovaCliente(pp, ctx.clienti, usate); return { ...base, azione: "mente", cosa: maiuscola(testo), cliente: clD.stato === "trovato" ? clD.cliente : null, quando }; }
    /* Un racconto al passato ("oggi sono stato dall'Esposito e il bagno è quasi
       finito", "stamattina ho parlato con Rossi…"): una nota, non una cosa da fare oggi (giro 11) */
    // "…sono stato da Pagano e m'ha dato 1200 in contanti": dentro il racconto c'è un incasso (giro 15)
    const soldiNelRacconto = /\b(?:mi|m)\s+ha(?:nno)?\s+(?:dato|pagato|saldato|lasciato)\s+(?:\d|mille|cento|un\s+acconto|il\s+saldo|l\s+acconto)/.test(n);
    if (!q.ora && !soldiNelRacconto && /^(?:(?:oggi|ieri|stamattina|stamani|stasera|prima|poco\s+fa)\s+)?(?:sono\s+(?:stato|stata|andato|andata|passato|passata)|siamo\s+(?:stati|andati|passati)|ho\s+(?:fatto|finito|visto|parlato|sentito|montato|sistemato|chiuso|consegnato|incontrato|controllato)|abbiamo\s+(?:fatto|finito|montato|consegnato|chiuso))\b/.test(n) && !/^(?:ho|abbiamo)\s+(?:fatto|finito)\s+(?:il|la|un|una)?\s*(?:preventiv|fattur)/.test(n)) { const clR = trovaCliente(pp, ctx.clienti, usate); return { ...base, azione: "mente", cosa: maiuscola(testo), cliente: clR.stato === "trovato" ? clR.cliente : null, quando }; }
    /* L'assemblea di condominio (amministratori, 29/09/2026): "convoca
       l'assemblea ordinaria del condominio Il Glicine per il 20 ottobre alle
       18", "assemblea straordinaria Parco Sole per il rifacimento del tetto
       giovedì 15 alle 21". Il condominio, il giorno e l'ora; il motivo, se c'è. */
    let iAss = pp.findIndex((x) => /^assemble[ae]$/.test(x.n));
    // "convoca straordinaria Sole Mare lunedì 9 novembre alle 18" (giro 11): la parola "assemblea" sottintesa
    if (iAss < 0 && /^(?:convoca|convocare)$/.test(primo) && pp[1] && /^(?:straordinari[ae]|ordinari[ae])$/.test(pp[1].n)) iAss = 1;
    /* Giro 15: "bisogna convocare i condòmini delle Magnolie in assemblea per…", "prepara la
       convocazione dell'assemblea del Parco dei Tigli", "vogliono un'assemblea urgente…,
       convocala per giovedì 15 alle 21": con "convoca/convocazione" l'assemblea è ovunque,
       e senza giorno e ora l'app li chiede */
    const convocaA = iAss >= 0 && pp.some((x) => /^(?:convoca\w*|convocazione|convocare)$/.test(x.n));
    const prefissoA = iAss >= 0 && iAss <= 3 && pp.slice(0, iAss).every((x) => /^(?:convoca|convocare|segna|segnami|fissa|fissare|metti|crea|nuova|l|un|una|la|devo|dobbiamo|bisogna|fare|organizza|organizzare|segnare)$/.test(x.n));
    if (iAss >= 0 && ((prefissoA && q.giornoIso && q.ora) || convocaA)) {
      const tipoA = ha(/^straordinari[ae]$/) ? "straordinaria" : "ordinaria";
      let cl = trovaCliente(pp, ctx.clienti, usate);
      /* "…assemblea, Magnolie, punto unico cambio della ditta delle pulizie": il motivo può
         nominare un altro cliente (la ditta); il condominio è quello prima del motivo (30/09) */
      if (cl.stato !== "trovato") {
        const fine = pp.findIndex((x, i) => i > iAss && /^(?:per|punto|ordine|odg|motivo|argomento)$/.test(x.n));
        if (fine > iAss) { const cl2 = trovaCliente(pp.slice(0, fine), ctx.clienti, usate); if (cl2.stato === "trovato") cl = cl2; }
      }
      let condominio = cl.stato === "trovato" ? cl.cliente.name : "";
      const liberi = pp.map((x, i) => i).filter((i) => i > iAss && !usate.has(i) && !(cl.stato === "trovato" && cl.usate.includes(i)) && !/^(?:straordinari[ae]|ordinari[ae])$/.test(pp[i].n));
      // il motivo: "per il rifacimento del tetto", "per approvare il bilancio"
      const iPer = liberi.findIndex((i) => pp[i].n === "per" && pp[i + 1] && !/^\d/.test(pp[i + 1].n));
      const motivoIdx = iPer >= 0 ? liberi.slice(iPer + 1) : [];
      const nomeIdx = (iPer >= 0 ? liberi.slice(0, iPer) : liberi).filter((i) => !/^(?:del|della|dello|al|alla|in|nel|nella|di|condominio|per|il|la|lo|presso|a)$/.test(pp[i].n) || (i > 0 && pp[i - 1].n === "condominio" && !VUOTE.has(pp[i].n)));
      if (!condominio && nomeIdx.length && nomeIdx.length <= 5) condominio = "Condominio " + nomeIdx.map((i) => pp[i].o).join(" ");
      let motivo = motivoIdx.map((i) => pp[i].o).join(" ").replace(/^(?:il|la|lo|l|i|gli|le)\s+/i, "");
      if (condominio) return { ...base, azione: "assemblea", condominio, cliente: cl.stato === "trovato" ? cl.cliente : null, tipo: tipoA, motivo: maiuscola(motivo), quando };
    }
    /* Solo il nome di un cliente ("Steve Rob", "Franco bi"): la sua scheda (29/09/2026) */
    if (pp.length <= 4 && !q.ora && !q.giornoIso) {
      const cl = trovaCliente(pp, ctx.clienti, usate);
      if (cl.stato === "trovato" || cl.stato === "simile") {
        const resto = pp.filter((x, i) => !cl.usate.includes(i) && !VUOTE.has(x.n) && !/^(?:cliente|scheda|apri|aprimi|mostra|mostrami|vedi)$/.test(x.n));
        if (resto.every((x) => x.n.length <= 2)) return { ...base, azione: "apri_cliente", cliente: cl.stato === "trovato" ? cl.cliente : null, clienteSimile: cl.stato === "simile" ? cl.cliente : null, quando };
      }
    }
    /* Uno sfogo o due chiacchiere ("che palle, non so cosa fare"): risponde, non si salva */
    // domande tecniche dette senza "?" (giro 15): "differenza tra differenziale di tipo A e AC", "il prato si può seminare a ottobre o è tardi"
    if (/^(?:ma\s+)?(?:in\s+generale|differenza\s+tra|che\s+differenza|un\s+cliente\s+mi\s+chiede\s+se|secondo\s+te|per\s+legge|e\s+vero\s+che)\b/.test(n) || /\bsi\s+puo\b.*\bo\s+(?:e\s+tardi|no|basta|si\s+puo\s+fare\s+e\s+basta|e\s+obbligatori\w*)\b/.test(n) || /\bda\s+cosa\s+(?:puo|potrebbe)\s+dipendere\b/.test(n)) return { ...base, azione: "domanda", domanda: true, quando: { giornoIso: null, etichetta: null, ora: null, fascia: null } };
    if (/^(?:(?:ciao|buongiorno|buonasera|ehi|ehila)\s+(?:eon\s+)?(?:come\s+(?:va|stai|andiamo)|tutto\s+(?:bene|ok))|come\s+(?:va|stai)\s+(?:eon|oggi)?)/.test(n) && pp.length <= 6) return { ...base, azione: "domanda", quando: { giornoIso: null, etichetta: null, ora: null, fascia: null } }; // "ciao EON come va oggi" (giro 15)
    if (/^(?:che\s+palle|uffa|che\s+noia|mi\s+annoio|sono\s+(?:stanc[oa]|giu|triste|nervos[oa]|stress\w*)|mi\s+sento\s+(?:un\s+po\s+)?(?:giu|stanc[oa]|male|solo|sola|triste|stress\w*)|che\s+giornata|non\s+so\s+(?:cosa|che)\s+fare|boh|mah|come\s+stai|che\s+fai|tutto\s+bene)\b/.test(n) && !q.ora) return { ...base, azione: "domanda", quando };

    /* Documento: fattura o preventivo */
    const iDoc = indice(/^(?:fattur[ae]|preventiv[oi])$/);
    /* "Chiamata Walter domani ore 9 per il preventivo" è un impegno che
       parla di un preventivo: con un giorno o un'ora, è un documento solo
       se la frase comincia da lì ("preventivo…", "fai la fattura…") */
    const docInTesta = iDoc >= 0 && (iDoc <= 1 || pp.slice(0, iDoc).every((x) => V.crea.test(x.n) || V.cerca.test(x.n) || VUOTE.has(x.n) || /^(?:mi|ci|serve|servono|nuov[oa]|devo|voglio|vorrei)$/.test(x.n)));
    /* "Devo chiedere tre preventivi per il tetto" (li chiedo io ai fornitori) e
       "manda una mail a X con il preventivo" (è una mail): non è un documento da fare */
    // (anche al singolare: "ricordami di chiedere il preventivo per le grondaie")
    const chiedoPreventivi = iDoc >= 0 && pp.slice(Math.max(0, iDoc - 4), iDoc).some((x) => /^(?:chiedere|richiedere|chiedi|richiedi|raccogliere|confrontare|farmi|farsi|aspetto|aspettare|ricevere|arrivati|arrivano|arrivato|sollecitare|sollecita)$/.test(x.n) || (/^(?:preventivi|fatture)$/.test(pp[iDoc].n) && /^(?:chiedere|richiedere)$/.test(x.n)));
    const iCanale = indice(/^(?:mail|email|e-mail|whatsapp|messaggio|sms)$/);
    const canalePrima = iDoc >= 0 && iCanale >= 0 && iCanale < iDoc;
    /* "l'amministratore vuole tre preventivi", "la Orsini vuole un preventivo anche
       per il bagno" (giro 8): una cosa da ricordare, non un documento da fare
       adesso — a meno che si dica di farlo o si dica quanto */
    const vuolePrima = iDoc >= 0 && pp.slice(Math.max(0, iDoc - 4), iDoc).some((x) => /^(?:vuole|vogliono|voleva|chiede|chiedono|chiesto|aspetta|aspettano|attende)$/.test(x.n)) && !pp.some((x) => /\d/.test(x.n)) && !pp.some((x) => V.crea.test(x.n) || /^(?:fammelo|fammela|preparalo|preparala|fallo|falla)$/.test(x.n));
    if (vuolePrima) return { ...base, azione: "mente", cosa: maiuscola(testo), quando };
    // "Anna mi ha pagato la fattura 180 euro": è un incasso, la fattura è già fatta
    const pagatoPrima = iDoc >= 0 && pp.slice(Math.max(0, iDoc - 4), iDoc).some((x) => /^(?:pagato|pagata|saldato|saldata|versato|onorato)$/.test(x.n));
    // "scrivi a Pagano che la fattura è pronta": il documento è nel testo del messaggio (giro 15)
    const iCheDoc = pp.findIndex((x) => x.n === "che");
    const docNelMessaggio = iDoc > 0 && iCheDoc > 0 && iCheDoc < iDoc && /^(?:scrivi|scrivigli|scrivile|messaggio|whatsapp|sms|mail|email|di|dì|avvisa|avvisalo|avvisala)$/.test(primo);
    if (iDoc >= 0 && !docNelMessaggio && !chiedoPreventivi && !canalePrima && !pagatoPrima && (docInTesta || (!q.ora && !q.giornoIso)) && !ha(/^(?:modifica|correggi|cambia|annulla|cancella|elimina|togli|sposta|rinomina|duplica|copia)$/)) {
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
      // "via Mazzini 18": il numero nel nome del cliente non è un importo (giro 10)
      const clPrima = trovaCliente(pp, ctx.clienti, new Set(usate));
      const nelNome = new Set(clPrima.stato === "trovato" ? clPrima.usate.filter((i) => /^\d+$/.test(pp[i].n)) : []);
      // "via Leopardi 7" senza "condominio": il 7 dopo il nome, se è nel nome del cliente
      if (clPrima.stato === "trovato") clPrima.usate.forEach((i) => { const k = i + 1; if (pp[k] && /^\d+$/.test(pp[k].n) && norm(clPrima.cliente.name).split(" ").includes(pp[k].n)) nelNome.add(k); });
      const importi = trovaImporto(pp, new Set([...usate, ...nelNome]));
      nelNome.forEach((i) => usate.add(i)); // fa parte del nome: nemmeno una voce del preventivo
      let importo = null;
      if (importi.length === 1) { importo = importi[0].valore; importi[0].usate.forEach((i) => usate.add(i)); }
      // IVA: "+ iva", "più iva", "iva esclusa" = come sempre; "iva inclusa/compresa" = da scorporare
      let ivaInclusa = false, aliquotaDetta = null;
      pp.forEach((x, i) => {
        if (x.n !== "iva") return;
        usate.add(i);
        if (i > 0 && /^(?:piu|\+|e)$/.test(pp[i - 1].n)) usate.add(i - 1);
        const dopo = pp[i + 1] && pp[i + 1].n;
        if (/^(?:inclusa|compresa|incluso|compreso)$/.test(dopo || "")) { ivaInclusa = true; usate.add(i + 1); }
        else if (/^(?:esclusa|escluso|esclusi)$/.test(dopo || "")) usate.add(i + 1);
        // "iva 10", "iva al 10%", "iva al 4 per cento": l'aliquota (giro 8)
        let k = i + 1;
        if (pp[k] && /^(?:inclusa|compresa|incluso|compreso|esclusa|escluso|esclusi)$/.test(pp[k].n)) k++;
        if (pp[k] && pp[k].n === "al") k++;
        const al = pp[k] && pp[k].n.match(/^(\d{1,2})%?$/);
        if (al && [0, 4, 5, 10, 22].includes(Number(al[1])) && !(pp[k + 1] && /^(?:euro|€)$/.test(pp[k + 1].n))) {
          aliquotaDetta = Number(al[1]);
          for (let j = i + 1; j <= k; j++) usate.add(j);
          if (pp[k + 1] && /^(?:%|percento)$/.test(pp[k + 1].n)) usate.add(k + 1);
          if (pp[k + 1] && pp[k + 1].n === "per" && pp[k + 2] && pp[k + 2].n === "cento") { usate.add(k + 1); usate.add(k + 2); } // "10 per cento"
        }
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
      const conVoci = lettura && (lettura.voci.length >= 2 || (lettura.voci.length === 1 && (lettura.voci[0].quantita !== 1 || importi.length !== 1)));
      if (conVoci) {
        const somma = Math.round(lettura.voci.reduce((t, v) => t + v.quantita * v.prezzo, 0) * 100) / 100;
        const manca = [];
        if (!cliente && !clienteNuovo && !clienteSimile && !candidati) manca.push("cliente");
        return {
          ...base, azione: "documento", modo: "crea", tipo, cliente, clienteNuovo, clienteSimile, candidati,
          voci: lettura.voci, importo: somma, ivaInclusa: false, aliquotaIva: lettura.aliquota || aliquotaDetta || (ha(/^iva$/) ? 22 : null),
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
      if (importo === null && !verbiCrea.length && pp.slice(0, iDoc).some((x) => V.manda.test(x.n) || /^(?:mandami|inviami|mandalo|invialo)$/.test(x.n))) return { ...base, azione: "invio_documento", tipo, cliente: cliente || null, quando };
      const manca = [];
      if (!cerca) {
        if (!cliente && !clienteNuovo) manca.push("cliente");
        if (!lavoro || dubbio) manca.push("lavoro");
        if (importo === null) manca.push("importo");
      }
      return {
        ...base, azione: "documento", modo: cerca ? "cerca" : "crea", tipo, cliente, clienteNuovo, clienteSimile, candidati,
        importo: importo !== null && ivaInclusa ? Math.round(importo / (1 + (aliquotaDetta !== null ? aliquotaDetta : 22) / 100) * 100) / 100 : importo, ivaInclusa, aliquotaIva: aliquotaDetta,
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
    // "Aggiungi Liverotti Barbi": aggiungi + nome e cognome con le maiuscole = un cliente nuovo (lo scrive il server)
    const nomeConMaiuscole = aggiungiInTesta && pp.length >= 3 && pp.length <= 4 && pp.slice(1).every((x) => /^\p{Lu}\p{Ll}+$/u.test(x.o)) && !pp.some((x) => /^(?:cartella|appunto|nota|foto|cliente|clienti)$/.test(x.n));
    if (nomeConMaiuscole && !q.ora && !q.giornoIso) return { ...base, azione: "cliente", cliente: null, telefono: false, quando };
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
    const ricevuto = /\b(?:pagat[oiae]|incassat[oiae]|saldat[oiae])\s+(?:in\s+contanti|con\s+(?:il\s+)?bonifico|con\s+(?:l\s+)?assegno|col\s+pos|subito|cash)\b|\b(?:ha|hanno)\s+(?:gia\s+)?(?:pagato|saldato|versato|fatto\s+il\s+bonifico|dato)\b|\b(?:pagat[oiae]|saldat[oiae]|incassat[oiae]|ricevut[oiae]|versat[oiae])\s+(?:da|dal|dalla)\b|^(?:ho|abbiamo)\s+(?:incassato|ricevuto|preso)\b|^(?:incassati|incassato|ricevuti|ricevuto)\b|\b(?:mi|m)\s+ha(?:nno)?\s+(?:pagato|dato|saldato)\b|\b(?:ha|hanno)\s+lasciato\s+(?:\d|un|una|mille|cento)[^,]{0,25}\b(?:caparra|acconto|anticipo|euro)\b/;
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
    /* "posta" è l'email solo come canale ("per posta", "posta elettronica"):
       non in "Hotel Posta" né in "cassetta della posta" (giro 7, 29/09/2026) */
    const iEmail = pp.findIndex((x, i) => /^(?:email|mail)$/.test(x.n) || (x.n === "posta" && ((pp[i + 1] && pp[i + 1].n === "elettronica") || (i > 0 && /^(?:per|via|tramite|con)$/.test(pp[i - 1].n)))));
    const iWa = indice(/^(?:whatsapp|wapp|whats)$/);
    const verboIniziale = V.manda.test(primo) || V.messaggio.test(primo) || V.chiama.test(primo) || primo === "di" && pp[1] && /^(?:a|ad|al|alla|all|allo|ai|agli|alle)$/.test(pp[1].n);
    const canaleIniziale = /^(?:messaggio|sms|email|mail|whatsapp)$/.test(primo);
    // "scrivi a Pagano che mi serve la foto del contatore": la foto è DENTRO il messaggio (dopo "che"), non da mandare (giro 15)
    const iChe = indice(/^(?:che|:)$/);
    const docNelTesto = iChe > 0 && indice(/^(?:fattur[ae]|preventiv[oi]|foto|link|durc|documento)$/) > iChe;
    if ((iEmail >= 0 || iWa >= 0 || canaleIniziale || V.messaggio.test(primo) || (primo === "di" && verboIniziale) || (V.manda.test(primo) && ha(/^(?:messaggio|messaggi|sms|email|mail|whatsapp)$/))) && !(indice(/^(?:fattur[ae]|preventiv[oi]|foto|link|durc|documento)$/) >= 0 && !docNelTesto && !(Math.max(iEmail, iWa, indice(/^(?:messaggio|messaggi|sms)$/)) >= 0 && Math.max(iEmail, iWa, indice(/^(?:messaggio|messaggi|sms)$/)) < indice(/^(?:fattur[ae]|preventiv[oi]|foto|link|durc|documento)$/)))) {
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
      // chi non è tra i clienti: il nome dopo "a/al" e poi il messaggio (giro 15)
      const fuori = cl.stato === "nessuno" ? nomeDopoASpan(pp, null) : null;
      const dopoNome = cl.usate.length ? Math.max(...cl.usate) + 1 : fuori ? fuori.fine + 1 : pp.length;
      const restoIdx = pp.map((_, i) => i).filter((i) => i >= dopoNome && !cl.usate.includes(i));
      if (fuori) while (restoIdx.length && /^(?:su|via|tramite|con|col|per)$/.test(pp[restoIdx[0]].n) && pp[restoIdx[1]] && /^(?:whatsapp|wapp|whats|sms|messaggio|email|mail|posta)$/.test(pp[restoIdx[1]].n)) restoIdx.splice(0, 2);
      /* "Scrivi a Machi domani alle 10": dopo il nome solo il quando = un
         promemoria per te (deciso il 28/09), non un messaggio da mandare */
      if (canale === "messaggio" && (q.ora || q.giornoIso) && restoIdx.length && restoIdx.every((i) => q.usate.has(i) || VUOTE.has(pp[i].n))) {
        return q.ora ? { ...base, azione: "impegno", quando } : { ...base, azione: "da_fare", cosa: maiuscola(testo), cliente: cl.stato === "trovato" ? cl.cliente : null, quando };
      }
      const testoMsg = preparaMessaggio(pp, restoIdx);
      return {
        ...base, azione: canale, cliente: cl.stato === "trovato" ? cl.cliente : null, clienteSimile: cl.stato === "simile" ? cl.cliente : null,
        candidati: cl.stato === "ambiguo" ? cl.candidati : null, nomeDetto: cl.stato === "nessuno" ? (fuori ? fuori.nome : nomeDopoA(pp, usate)) : null,
        messaggio: testoMsg, quando, manca: [cl.stato === "trovato" || cl.stato === "simile" || cl.stato === "ambiguo" ? null : "cliente", testoMsg ? null : "testo"].filter(Boolean),
      };
    }
    if (V.chiama.test(primo) && !q.ora && !q.giornoIso) {
      usate.add(0);
      const cl = trovaCliente(pp, ctx.clienti, usate, { nomeSolo: true });
      // "chiama la Pagnoni che non risponde ai messaggi", "telefona alla Benvenuti che le devo dire del pezzo": il perché non conta (giro 15)
      const iPerche = pp.findIndex((x, i) => i > 0 && /^(?:che|perche|cosi|siccome|visto)$/.test(x.n) && (cl.stato !== "nessuno" ? i > Math.max(...cl.usate) : i > 1));
      const resto = pp.filter((_, i) => i > 0 && (iPerche < 0 || i < iPerche) && !cl.usate.includes(i) && !VUOTE.has(pp[i].n) && !/^(?:un|attimo|subito|adesso|ora|direttamente|per|favore|sto|questo|quello)$/.test(pp[i].n));
      if (resto.length <= 2) {
        return { ...base, azione: "chiama", cliente: cl.stato === "trovato" ? cl.cliente : null, clienteSimile: cl.stato === "simile" ? cl.cliente : null,
          candidati: cl.stato === "ambiguo" ? cl.candidati : null, nomeDetto: cl.stato === "nessuno" ? nomeBello(pp.slice(1, iPerche < 0 ? pp.length : iPerche).filter((x) => !VUOTE.has(x.n)).map((x) => x.o).join(" ")) : null, quando };
      }
    }

    /* Una cartella che non c'è ancora: "metti nella cartella Fornitori che il
       prezzo del ferro è salito" → si chiede se crearla (29/09/2026) */
    const mNuova = testo.match(/^(?:metti|mettimi|segna|segnami|scrivi|scrivimi|aggiungi|annota|salva|appunta)\s+(?:nella|in|dentro\s+la)\s+cartella\s+([\p{L}\d'-]+(?:\s+[\p{L}\d'-]+)?)\s*[:,-]?\s+(?:che\s+|di\s+)?(.{3,})$/iu);
    if (mNuova && !trovaCartella(pp, ctx.cartelle, new Set())) {
      // il nome della cartella: una parola (due se la seconda ha la maiuscola)
      const [a, b] = mNuova[1].split(/\s+/);
      const nomeC = b && /^\p{Lu}/u.test(b) ? a + " " + b : a;
      const nota = (b && !/^\p{Lu}/u.test(b) ? b + " " : "") + mNuova[2];
      return { ...base, azione: "nota_cartella_nuova", nomeCartella: nomeBello(nomeC), nota: maiuscola(nota.replace(/^(?:che|di)\s+/i, "")), quando };
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
  /* Il nome di chi non è tra i clienti, dopo "a/al/alla": "scrivi al geometra Rovelli su
     whatsapp che…" = "Geometra Rovelli"; "messaggio al mio operaio Davide: domani…" =
     "Operaio Davide"; "sms a Tiziana Mancuso: ricordati…" = "Tiziana Mancuso" (giro 15).
     Si ferma a "che/su/con/per", ai due punti, a un giorno o a un numero. */
  function nomeDopoASpan(pp, usate) {
    for (let i = 0; i < pp.length; i++) {
      if (!/^(?:a|ad|al|alla|allo|all|ai|agli)$/.test(pp[i].n) || (usate && usate.has(i + 1))) continue;
      const nome = [];
      let j = i + 1;
      while (j < pp.length && /^(?:mio|mia|miei|mie|nostro|nostra|il|la|lo|l)$/.test(pp[j].n)) j++;
      for (; j < pp.length && nome.length < 3; j++) {
        if (/^(?:che|se|per|di|chiedendo|dicendo|e|su|con|via|tramite|col|grazie|ricordati|ricordagli|vi|ti|gli|le|mi|domani|oggi|dopodomani|stasera|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|quando|come|dove|perche|se)$/.test(pp[j].n) || /\d/.test(pp[j].n)) break;
        nome.push(j);
        if (pp[j].sep) break; // "Tiziana: grazie per…"
      }
      if (nome.length) return { nome: nomeBello(nome.map((k) => pp[k].o).join(" ")), idx: nome, fine: nome[nome.length - 1] };
    }
    return null;
  }
  function nomeDopoA(pp, usate) { const x = nomeDopoASpan(pp, usate); return x ? x.nome : null; }

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
    const t = espandiAbbreviazioni(String(testo || "").trim());
    const fine = (t.match(/[?!.]+$/) || [""])[0];
    let x = t.slice(0, t.length - fine.length).trim(), prima;
    do { prima = x; x = x.replace(/^(?:(?:ehi|hey|ok|okay|allora|dunque)\s*,?\s+)*(?:(?:senti|ascolta)\s*,\s*)?(?:eon\s*,?\s+)?(?:(?:per\s+favore|perfavore|per\s+cortesia|scusa)\s*,?\s+)?/i, "").replace(FINE_CORTESIA, "").trim(); } while (x !== prima && x);
    return x ? x + fine.replace(/[.!]+/, "") : t;
  }
  const EonLettore = { leggi, segni, anonimizza, segniDettagli, componiImporti, RUOLI_DETTAGLI, usaDettagli, dettagliNeurali, leggiModificaImpegno, leggiDocumento, leggiDomandaDati, leggiSal, leggiInvioDocumento, leggiDestinatario, leggiCartella, leggiDico, leggiAssemblea, tempiDetti, usaNeurale, neuraleAttivo: () => !!NEURALE, leggiNuovoCliente, trovaTelefono, trovaVoci, leggiModifica, caricaModello, caratteristiche, classifica, parafrasi, riscrivi, togliCortesie, leggiDidascalia, pulisci, parole, trovaQuando, trovaImporto, trovaCliente, trovaNomeNuovo, preparaMessaggio, temaDomanda, dividi, norm, NOMI };
  if (typeof module !== "undefined" && module.exports) module.exports = EonLettore;
  else root.EonLettore = EonLettore;
})(typeof window !== "undefined" ? window : globalThis);
