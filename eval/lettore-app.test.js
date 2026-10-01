/* Il lettore unico nell'app vera (29/09/2026). Le frasi di Andrea del 28/09
   sera (finite tutte all'AI, che era senza credito) ora le fa il codice:
   cartelle, più comandi, fatture e preventivi anche per clienti nuovi (con
   le domande del codice se manca un pezzo), messaggi, email, chiamate con
   omonimi, cartello, DURC, domande sui dati, Mente; foto con didascalia;
   rete di sicurezza se l'AI non risponde; avviso "credito finito" al fondatore.
   Browser vero, Supabase finto, server finto (i comandi arrivano con "comando").
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/lettore-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9017;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(() => {
      window.__scritture = [];
      window.__aggiornamenti = [];
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: (patch) => ({ eq: async (_c, id) => { window.__aggiornamenti.push({ tabella, id, patch }); return { error: null }; } }),
          insert: (riga) => { window.__scritture.push({ tabella, riga }); const r = { id: "n" + window.__scritture.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({}) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) },
      }) };
    });
    /* Server finto: un "comando" lo esegue il codice; il resto va all'AI,
       che qui è ferma (credito finito), come il 28/09 sera */
    const richieste = [];
    let adminStato = { admin: false };
    await page.route("**/api?action=*", (route) => {
      const url = route.request().url();
      if (/action=admin_stato/.test(url)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminStato) });
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.route("**/api?action=assistant", (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      richieste.push(body);
      if (body.comando && body.comando.azione === "documento") {
        const esito = { id: "d1", titolo: body.comando.tipo === "fattura" ? "Fattura n. 1/2026" : "Preventivo n. 1/2026", cliente: body.comando.nuovo_cliente || "Rita Ambrosini", totale: body.comando.importo * 1.22,
          dati: { tipo: body.comando.tipo, numero: "1/2026", cliente: body.comando.nuovo_cliente || "Rita Ambrosini", voci: [{ desc: body.comando.lavoro, qta: 1, prezzo: body.comando.importo }], imponibile: body.comando.importo, iva: body.comando.importo * 0.22, totale: body.comando.importo * 1.22, aliquota: 22, data: "29/09/2026" } };
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stato: "concluso", testo: esito.titolo, azioni: [{ tool: "crea_preventivo_o_fattura", esito }] }) });
      }
      if (body.comando) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stato: "concluso", testo: "Scritto", azioni: [{ tool: "manda_messaggio", esito: { id: "m1", inviato_a: "Rita Ambrosini", testo: "Ciao Rita" } }] }) });
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Credito dell'AI esaurito: ricaricalo su console.anthropic.com (Plans & Billing), poi riprova" }) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {};
      tokenValido = async () => "t";
      await applyProfession("edile", true);
      clients.length = 0;
      [["c1", "Machi Alessia", "3331111111", "alessia@esempio.it"], ["c2", "Rita Ambrosini", "3332222222", ""], ["c3", "andrearinaldo Gianardi", "3333333333", "andrea@esempio.it"],
        ["c5", "Alessio Machi", "3335555555", ""], ["c6", "Andrea Gianardi", "3336666666", ""]]
        .forEach(([id, name, phone, email]) => clients.push({ id, name, phone, email, status: "attivo", value: 0, desc: "", archived: false, address: "Via Roma 1" }));
      cartelle.length = 0; cartelle.push({ id: "k1", nome: "Lerici" }); renderCartelle();
      incomes.length = 0; incomes.push({ id: "i1", client: "Machi Alessia", amount: 3000, status: "attesa" }, { id: "i2", client: "Rita Ambrosini", amount: 1200, status: "scaduto" });
      tasks.length = 0;
    });

    const pulisci = () => page.evaluate(() => {
      chiudiRisorsaCard(); navigateTo("home");
      document.getElementById("aiToastContainer").innerHTML = "";
      document.querySelectorAll(".ai-landing-overlay").forEach((o) => { o.style.display = "none"; });
      window.__scritture.length = 0;
    });
    const scrivi = async (frase) => {
      await pulisci();
      richieste.length = 0;
      await page.fill("#homeHeroCampo", frase);
      await page.evaluate(() => document.getElementById("homeHeroSend").click());
      await page.waitForTimeout(350);
    };
    const rispondi = async (t) => { await page.fill("#domandaCodiceCampo", t); await page.evaluate(() => document.getElementById("domandaCodiceInvia").click()); await page.waitForTimeout(350); };
    const tocca = async (t) => { await page.evaluate((t) => [...document.querySelectorAll("#risorsaOverlay .scheda-scelta")].find((b) => b.textContent.includes(t)).click(), t); await page.waitForTimeout(350); };
    const stato = () => page.evaluate(() => ({
      card: document.getElementById("risorsaOverlay").style.display === "flex" ? document.getElementById("risorsaTitolo").textContent + " | " + document.getElementById("risorsaCorpo").textContent.replace(/\s+/g, " ").trim() : null,
      toast: document.getElementById("aiToastContainer").textContent.replace(/\s+/g, " ").trim(),
      scritture: window.__scritture.map((s) => ({ tabella: s.tabella, riga: s.riga })),
      pagina: paginaAttuale,
    }));
    const soloAI = () => richieste.filter((r) => !r.comando).length;
    const comandi = () => richieste.filter((r) => r.comando).map((r) => r.comando);

    /* 1. Cartella */
    await scrivi("Metti in cartella Lerici sentire overa per riportare materiale sportivo");
    let s = await stato();
    verifica("\"Metti in cartella Lerici…\": nota da fare nella cartella, col codice", soloAI() === 0 && s.scritture.length === 1 && s.scritture[0].riga.cartella_id === "k1" && s.scritture[0].riga.da_fare === true && /In Lerici/.test(s.toast), JSON.stringify(s));

    /* 2. Più comandi: il pezzo senza ora nelle cose da fare di domani */
    await scrivi("Domani ore 11 mazzi. Mandare raccomandata Brigida");
    s = await stato();
    const domani = new Date(Date.now() + 86400000); const domaniIso = domani.getFullYear() + "-" + String(domani.getMonth() + 1).padStart(2, "0") + "-" + String(domani.getDate()).padStart(2, "0");
    const daFare = s.scritture.find((x) => x.tabella === "tasks");
    verifica("\"…Mandare raccomandata Brigida\" nelle cose da fare di domani (senza ora)", daFare && daFare.riga.title === "Mandare raccomandata Brigida" && daFare.riga.scheduled_at === domaniIso + "T00:00:00", JSON.stringify(s.scritture));
    verifica("\"Domani ore 11 mazzi\" va al percorso degli impegni (solo quel pezzo)", richieste.length >= 1 && /Domani ore 11 mazzi"/.test(richieste[0].messaggio || ""), JSON.stringify(richieste.map((r) => r.messaggio)));

    /* 3. Documenti */
    await scrivi("Crea preventivo da 20.000 per ristrutturazione bagno e mandalo a Rita Ambrosini");
    s = await stato();
    let c = comandi()[0] || {};
    verifica("preventivo per Rita: comando al server col codice (niente AI)", soloAI() === 0 && c.azione === "documento" && c.tipo === "preventivo" && c.cliente_id === "c2" && c.importo === 20000 && c.lavoro === "Ristrutturazione bagno", JSON.stringify(c));
    verifica("\"…e mandalo a Rita\": subito i tasti per mandarlo (PDF, WhatsApp, Email)", s.card && /Preventivo n\. 1\/2026 · Rita Ambrosini/.test(s.card) && /WhatsApp/.test(s.card), s.card);

    await scrivi("Fai fattura da 10.000 a Chilosi mariagrazie per progetto seconda casa in campagna");
    c = comandi()[0] || {};
    verifica("fattura per un cliente nuovo (Chilosi Mariagrazie): il codice la fa e crea il cliente", soloAI() === 0 && c.nuovo_cliente === "Chilosi Mariagrazie" && c.importo === 10000 && c.lavoro === "Progetto seconda casa in campagna", JSON.stringify(c));

    await scrivi("Crea Fattura Chilosi Mario 2000");
    s = await stato();
    verifica("\"Crea Fattura Chilosi Mario 2000\": manca il lavoro → il codice chiede solo quello", s.card && /Per quale lavoro\?/.test(s.card) && richieste.length === 0, s.card);
    await rispondi("rifacimento bagno");
    c = comandi()[0] || {};
    verifica("…risposta \"rifacimento bagno\" → fattura fatta dal codice per Chilosi Mario", c.nuovo_cliente === "Chilosi Mario" && c.lavoro === "Rifacimento bagno" && c.importo === 2000 && soloAI() === 0, JSON.stringify(c));

    await scrivi("Preventivo 1000 chilosi");
    s = await stato();
    verifica("\"Preventivo 1000 chilosi\": chiede se Chilosi è il cliente o il lavoro", s.card && /«Chilosi» è il cliente o il lavoro\?/.test(s.card), s.card);
    await tocca("è il cliente");
    await rispondi("tetto");
    c = comandi()[0] || {};
    verifica("…\"è il cliente\" + \"tetto\" → preventivo per il cliente nuovo Chilosi", c.nuovo_cliente === "Chilosi" && c.lavoro === "Tetto" && c.importo === 1000, JSON.stringify(c));

    await scrivi("Mi serve preventivo Machi Alessia");
    s = await stato();
    verifica("\"Mi serve preventivo Machi Alessia\" senza preventivi: ne prepara uno e chiede il lavoro", s.card && /Non trovo preventivi di Machi Alessia/.test(s.card) && /Per quale lavoro\?/.test(s.card), s.card);
    await rispondi("cucina"); await rispondi("30.000");
    c = comandi()[0] || {};
    verifica("…\"cucina\", \"30.000\" → preventivo per Machi Alessia", c.cliente_id === "c1" && c.lavoro === "Cucina" && c.importo === 30000, JSON.stringify(c));

    /* 4. Messaggi, email, chiamate */
    await scrivi("Scrivi a Rita Ambrosini se va bene domani alle 18:00 in ufficio");
    c = comandi()[0] || {};
    verifica("\"Scrivi a Rita… se va bene domani alle 18\": messaggio (domanda) col codice", soloAI() === 0 && c.azione === "messaggio" && c.cliente_id === "c2" && c.testo === "Va bene domani alle 18:00 in ufficio?", JSON.stringify(c));

    await scrivi("Chiama Gianardi");
    s = await stato();
    verifica("\"Chiama Gianardi\" con due Gianardi: \"Quale?\" con i due nomi", s.card && /Quale\?/.test(s.card) && /andrearinaldo Gianardi/.test(s.card) && /Andrea Gianardi/.test(s.card), s.card);
    await tocca("andrearinaldo");
    const tel = await page.evaluate(() => (document.querySelector("#risorsaCorpo a[href^='tel:']") || {}).href || "");
    verifica("…tocco il nome → tasto per chiamarlo", /tel:\+?39?3333333333|tel:3333333333/.test(tel), tel);

    await scrivi("Manda e-mail a Gianardi chiedendo chiarimenti su ultimo report");
    await tocca("andrearinaldo");
    const mail = await page.evaluate(() => (document.querySelector("#risorsaCorpo a[href^='mailto:']") || {}).href || "");
    verifica("email: pronta per andrea@esempio.it con \"chiarimenti sull'ultimo report\"", /^mailto:andrea%40esempio\.it\?subject=Chiarimenti%20sull%27ultimo%20report&body=Ciao%20andrearinaldo%2C%20ti%20chiedo%20chiarimenti%20sull%27ultimo%20report/.test(mail), mail);

    await scrivi("Manda messaggio a Gianardi chiedendo chiarimenti su ultimo report");
    await tocca("andrearinaldo");
    c = comandi()[0] || {};
    verifica("messaggio a Gianardi dopo la scelta: col codice", c.azione === "messaggio" && c.cliente_id === "c3" && c.testo === "Ti chiedo chiarimenti sull'ultimo report." && soloAI() === 0, JSON.stringify(c));

    /* 5. Cartello, DURC */
    await scrivi("Crea cartello fine lavori Machi alessia");
    s = await stato();
    const cartello = await page.evaluate(() => document.getElementById("cartelloClient").value);
    verifica("cartello fine lavori già compilato per Machi Alessia", s.pagina === "crea-cartello" && cartello === "Machi Alessia", JSON.stringify({ pagina: s.pagina, cartello }));

    await scrivi("DURC machi Alessia");
    s = await stato();
    // 1/10/2026: lo dice e propone di caricarlo subito ("Lo carichiamo adesso?")
    verifica("\"DURC machi Alessia\" senza DURC caricato: lo dice e propone di caricarlo", /Il DURC non è ancora caricato in EON\. Lo carichiamo adesso\?/.test(s.card || ""), JSON.stringify(s));

    /* 6. Domande sui dati */
    for (const [frase, atteso] of [["Quanti soldi devo incassare ?", /Ti devono €4\.200/], ["Chi non ha ancora pagato?", /Ti devono €4\.200/], ["Clienti che devono pagare?", /Ti devono/], ["Quanto ho di IVA questo mese?", /IVA di/], ["Quanti cantieri attivi ho?", /5 cantieri attivi/], ["Guarda se ho impegni sabato", /sabato|dopodomani|domani|oggi/i]]) {
      await scrivi(frase);
      s = await stato();
      verifica(`"${frase}" → risposta dai dati, col codice`, soloAI() === 0 && s.card && atteso.test(s.card), s.card);
    }

    /* 7. Mente, e il ripiego in due tempi */
    await scrivi("Chiamare per panini");
    s = await stato();
    verifica("\"Chiamare per panini\" → Mente, da fare (col codice)", soloAI() === 0 && s.scritture.length === 1 && s.scritture[0].tabella === "cantiere_appunti" && s.scritture[0].riga.da_fare === true && /Era una richiesta a EON/.test(s.toast), JSON.stringify(s));
    await page.evaluate(() => document.querySelector(".ai-toast-altro").click());
    await page.waitForTimeout(350);
    verifica("…\"Era una richiesta a EON\": toglie l'appunto e la chiede all'AI", richieste.length === 1 && !richieste[0].comando && (await page.evaluate(() => window.__aggiornamenti.some((a) => a.tabella === "cantiere_appunti" && a.patch.deleted_at))), JSON.stringify(richieste.map((r) => r.messaggio)));

    /* 8. Rete di sicurezza: l'AI è ferma */
    await scrivi("Esporta tutti i dati dei clienti"); // ("svuota il cestino" dal 29/09 lo fa il codice)
    s = await stato();
    verifica("un ordine a EON + AI ferma → \"Adesso non riesco a farlo\", niente appunto", s.card && /Adesso non riesco a farlo/.test(s.card) && !s.scritture.length, JSON.stringify(s));
    await scrivi("Domani alle 10 sopralluogo da Rossi per le tegole");
    s = await stato();
    verifica("una cosa da segnare che va al server + AI ferma → finisce nella Mente, lo dice", s.scritture.some((x) => x.tabella === "cantiere_appunti") && /Messo nella Mente/.test(s.toast) && /L'AI adesso è ferma/.test(s.toast), JSON.stringify(s));
    await scrivi("Secondo te conviene il cappotto termico o il sistema a secco?");
    s = await stato();
    verifica("una domanda + AI ferma → risposta chiara (non il silenzio), niente appunto", s.card && /l'AI di EON adesso è ferma/.test(s.card) && !s.scritture.length, JSON.stringify(s));

    /* 9. Foto con didascalia, col codice */
    const foto = async (didascalia) => {
      await pulisci();
      await page.evaluate(() => { cantiereFoto.push({ id: "f" + cantiereFoto.length, url: "https://esempio.it/f.jpg", clientId: null, nota: "", created: new Date().toISOString() }); apriTagFotoCantiere(cantiereFoto[cantiereFoto.length - 1]); window.__aggiornamenti.length = 0; });
      richieste.length = 0;
      await page.fill("#cantiereFotoTagCampo", didascalia);
      await page.evaluate(() => document.getElementById("cantiereFotoTagSend").click());
      await page.waitForTimeout(350);
      return page.evaluate(() => ({ foto: cantiereFoto[cantiereFoto.length - 1], hint: document.getElementById("cantiereFotoTagHint").textContent, scelte: [...document.querySelectorAll("#cantiereFotoTagScelte button")].map((b) => b.textContent), aperta: document.getElementById("cantiereFotoTagOverlay").style.display === "flex", toast: document.getElementById("aiToastContainer").textContent.replace(/\s+/g, " "), nuovi: window.__scritture.filter((s) => s.tabella === "clients").map((s) => s.riga.name) }));
    };
    let f = await foto("TV casa machi");
    verifica("foto \"TV casa machi\" con due Machi: \"Quale?\" con i due nomi (niente AI)", f.hint === "Quale?" && f.scelte.join() === "Machi Alessia,Alessio Machi" && richieste.length === 0, JSON.stringify(f));
    await page.evaluate(() => document.querySelector("#cantiereFotoTagScelte button").click());
    await page.waitForTimeout(300);
    f = await page.evaluate(() => ({ foto: cantiereFoto[cantiereFoto.length - 1], toast: document.getElementById("aiToastContainer").textContent.replace(/\s+/g, " ") }));
    verifica("…tocco Machi Alessia → foto nella sua scheda con la nota \"TV casa\"", f.foto.clientId === "c1" && f.foto.nota === "TV casa" && /Foto collegata/.test(f.toast), JSON.stringify(f));
    f = await foto("Tv casa cucinelli");
    verifica("foto \"Tv casa cucinelli\": cliente nuovo Cucinelli creato e foto collegata (niente AI)", f.nuovi.join() === "Cucinelli" && f.foto.clientId && f.foto.nota === "Tv casa" && /Cliente creato/.test(f.toast) && richieste.length === 0, JSON.stringify(f));
    f = await foto("Finestre Luca liverani");
    verifica("foto \"Finestre Luca liverani\": cliente nuovo Luca Liverani, nota \"Finestre\"", f.nuovi.join() === "Luca Liverani" && f.foto.nota === "Finestre", JSON.stringify(f));

    /* 10. Il fondatore vede subito che il credito è finito */
    adminStato = { admin: true, errori_nuovi: 0, ai_credito_finito: { volte: 36, ultima: new Date().toISOString() } };
    await pulisci();
    await page.evaluate(() => controllaAdminEon());
    await page.waitForTimeout(300);
    s = await stato();
    verifica("fondatore: avviso \"Credito dell'AI finito\" con cosa fare", /Credito dell'AI finito/.test(s.toast) && /console\.anthropic\.com/.test(s.toast), s.toast);

    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
