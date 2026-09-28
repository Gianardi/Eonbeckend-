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
      return { o: pulita, n: norm(pulita).replace(/\s+/g, "") };
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
  const FINE_CORTESIA = /\s*,?\s*(?:per\s+favore|perfavore|per\s+cortesia|grazie(?:\s+mille)?|eon)\s*[.!]*$/i;
  /* "Guarda se ho impegni sabato" = domanda "ho impegni sabato?" */
  const INIZIO_DOMANDA = /^(?:(?:mi\s+)?(?:guardi|guarda|controlla|controlli|vedi|verifica|verifichi|dimmi|mi\s+dici|mi\s+sai\s+dire|sai|fammi\s+sapere)\s+(?:un\s+po\s+)?(?:se|quanto|quanti|quante|chi|cosa|quando|che)\b\s*)/i;

  function pulisci(testo) {
    let t = String(testo || "").trim().replace(/\s+/g, " ");
    let domanda = /\?/.test(t);
    t = t.replace(/[?!.]+$/, "").trim();
    let prima;
    // "mi puoi…", "potresti…": è una richiesta a EON, non una cosa da fare tua
    const richiesta = /^(?:(?:ehi|hey|ok|allora|senti|eon)\W+)*(?:(?:per\s+favore|perfavore)\W+)?(?:mi\s+)?(?:puoi|potresti|riesci\s+a|riusciresti\s+a)\b/i.test(t);
    do { prima = t; t = t.replace(INIZIO_CORTESIA, "").replace(FINE_CORTESIA, "").trim(); } while (t !== prima && t);
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
    if (/\b(?:clienti)\b/.test(n)) return "clienti";
    if (/\b(?:urgenz[ae]|urgenti)\b/.test(n)) return "urgenze";
    return null;
  }

  /* ---------------- Più comandi ---------------- */
  const VERBI_COMANDO = "(?:cancella|annulla|elimina|segna|segnami|metti|fissa|vai|andare|passa|passare|sentire|senti|chiama|chiamare|richiama|telefona|telefonare|manda|mandare|inviare|invia|scrivi|scrivere|fai|fare|crea|prepara|compra|comprare|ritira|ritirare|porta|portare|ricordami|devo|appuntamento|sopralluogo|riunione|incontro|visita)";
  const SEPARA = new RegExp(`\\s*(?:[.;]\\s+|,?\\s+(?:e\\s+poi|poi|ah\\s+e|e\\s+anche|inoltre)\\s+|,\\s*(?=${VERBI_COMANDO}\\b)|\\s+e\\s+(?=${VERBI_COMANDO}\\b))`, "i");
  function dividi(testo) {
    const parti = String(testo || "").trim().replace(/[.!]+$/, "").split(SEPARA)
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
      const giudizio = /\b(?:pesante|pesanti|leggera|tranquill[ao]|conviene|convien\w*|consigl\w*|secondo\s+te|meglio|peggio|perche|come\s+mai|dovrei|potrei|riesco|faccio\s+in\s+tempo|ce\s+la\s+faccio|organizz\w*|priorit\w*|spieg\w*|pensi|credi)\b/.test(n);
      if (tema && !giudizio) {
        const cl = trovaCliente(pp, ctx.clienti, usate);
        return { ...base, domanda: true, azione: "dati", tema, quando, cliente: cl.stato === "trovato" ? cl.cliente : null };
      }
      return { ...base, domanda: true, azione: "domanda", quando };
    }

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
      else if (cl.stato === "simile") { clienteSimile = cl.cliente; cl.usate.forEach((i) => usate.add(i)); }
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

  const EonLettore = { leggi, leggiDidascalia, pulisci, parole, trovaQuando, trovaImporto, trovaCliente, trovaNomeNuovo, preparaMessaggio, temaDomanda, dividi, norm, NOMI };
  if (typeof module !== "undefined" && module.exports) module.exports = EonLettore;
  else root.EonLettore = EonLettore;
})(typeof window !== "undefined" ? window : globalThis);
