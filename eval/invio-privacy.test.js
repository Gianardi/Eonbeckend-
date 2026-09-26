/* "Invia il preventivo a Rossi" con un solo comando, e i testi della privacy
   (27/09/2026), nella vera index.html con Supabase finto:
   1. il documento giusto (l'ultimo del cliente o il numero detto), WhatsApp
      con numero e messaggio pronti, oppure la Mail con l'indirizzo; senza AI;
   2. "Crea account" chiede la casella Termini/Privacy e salva data e versione;
      chi c'era già vede una volta la card "Termini e privacy";
   3. le pagine /privacy e /termini ci sono e dicono le cose giuste.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/invio-privacy.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8994;
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
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const erroriPagina = [];
    page.on("pageerror", (e) => erroriPagina.push(e.message));
    const preparaFinti = () => {
      window.__chiamateAI = 0; window.__scritture = []; window.__aperti = [];
      const sessione = { access_token: "tok", user: { id: "u1", email: "andrea@esempio.it", user_metadata: {} } };
      const profilo = { id: "u1", full_name: "Andrea Gianardi", business_name: "", profession: "edile", termini_versione: localStorage.getItem("__terminiVersione") || null };
      const catena = (tabella) => { const q = {
        update: (patch) => ({ eq: async (k, id) => { window.__scritture.push({ tabella, patch, id }); return { error: null }; } }),
        insert: (r) => ({ select: () => { const p = Promise.resolve({ data: [r], error: null }); p.single = async () => ({ data: r, error: null }); return p; } }),
        select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, maybeSingle: async () => ({ data: null, error: null }),
        single: async () => (tabella === "profiles" ? { data: profilo, error: null } : { data: null, error: null }),
        then: (ok) => ok({ data: [], error: null }) }; return q; };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on(){ return this; }, subscribe(){ return this; } }), storage: { from: () => ({}) },
        auth: { getSession: async () => ({ data: { session: localStorage.getItem("__nessunaSessione") ? null : sessione } }), onAuthStateChange: () => ({}),
          signUp: async (dati) => { window.__signUp = dati; return { data: { session: sessione, user: sessione.user }, error: null }; } } }) };
      window.open = (url) => { window.__aperti.push(url); return {}; };
      const fetchVero = window.fetch;
      window.fetch = async (url, init) => {
        if (String(url).includes("action=assistant")) { window.__chiamateAI++; return new Response(JSON.stringify({ stato: "concluso", testo: "ok", azioni: [] }), { headers: { "content-type": "application/json" } }); }
        if (String(url).includes("/api?")) return new Response("{}", { headers: { "content-type": "application/json" } });
        return fetchVero(url, init);
      };
    };
    await page.addInitScript(preparaFinti);

    /* ===== 2b. Chi c'era già: la card "Termini e privacy", una volta ===== */
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const cardTermini = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, aperta: document.getElementById("risorsaOverlay").style.display === "flex", disabilitato: document.getElementById("terminiAccetto") && document.getElementById("terminiAccetto").disabled }));
    verifica("utente di prima, senza termini accettati: card \"Termini e privacy\", Accetto spento finché non spunta", cardTermini.aperta && cardTermini.titolo === "Termini e privacy" && cardTermini.disabilitato, JSON.stringify(cardTermini));
    await page.check("#terminiSpunta");
    await page.click("#terminiAccetto");
    await page.waitForTimeout(300);
    let sc = await page.evaluate(() => window.__scritture.filter((s) => s.tabella === "profiles"));
    verifica("Accetto: data e versione 1.0 salvate nel profilo", sc.length === 1 && sc[0].patch.termini_versione === "1.0" && /^\d{4}-\d\d-\d\dT/.test(sc[0].patch.termini_accettati_il), JSON.stringify(sc));
    await page.evaluate(() => localStorage.setItem("__terminiVersione", "1.0"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    verifica("riaperta con i termini già accettati: nessuna card", !(await page.evaluate(() => document.getElementById("risorsaOverlay").style.display === "flex" && document.getElementById("risorsaTitolo").textContent === "Termini e privacy")));

    /* ===== 1. Invia il documento ===== */
    await page.evaluate(() => {
      clients.length = 0;
      clients.push({ id: "c1", name: "Mario Rossi", status: "attivo", value: 0, archived: false, phone: "333 1234567", email: "mario@rossi.it" },
                   { id: "c2", name: "Sara Dini", status: "attivo", value: 0, archived: false, phone: "", email: "" });
      chats.length = 0;
      const doc = (id, tipo, numero, totale, cliente, voce) => ({ id, eventType: "doc", docTipo: tipo, docAnno: 2026, createdAt: "2026-09-2" + numero + "T10:00:00Z",
        docDati: { tipo, numero: numero + "/2026", anno: 2026, cliente, totale, imponibile: totale / 1.22, iva: totale - totale / 1.22, aliquota: 22, data: "2" + numero + "/09/2026", voci: [{ desc: voce, qta: 1, prezzo: totale / 1.22 }] } });
      chats.push({ name: "Mario Rossi", messages: [doc("p1", "preventivo", 1, 1220, "Mario Rossi", "Bagno"), doc("p2", "preventivo", 2, 610, "Mario Rossi", "Rubinetto"), doc("f2", "fattura", 2, 500, "Mario Rossi", "Caldaia")] });
      chats.push({ name: "Sara Dini", messages: [doc("p3", "preventivo", 3, 300, "Sara Dini", "Tinteggiatura")] });
      window.__mail = []; apriLinkEsterno = (u) => window.__mail.push(u);
    });
    const chiedi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); window.__aperti.length = 0; window.__mail.length = 0; });
      await page.fill("#homeHeroCampo", frase);
      await page.click("#homeHeroSend");
      await page.waitForTimeout(350);
    };
    const titolo = () => page.evaluate(() => document.getElementById("risorsaTitolo").textContent);

    await chiedi("Invia il preventivo a Mario Rossi");
    let aperti = await page.evaluate(() => window.__aperti.slice());
    verifica("\"Invia il preventivo a Mario Rossi\": WhatsApp con il suo numero e il preventivo più recente (n. 2)",
      aperti.length === 1 && aperti[0].startsWith("https://wa.me/393331234567?text=") && decodeURIComponent(aperti[0]).includes("il preventivo n. 2/2026") && (await titolo()) === "Preventivo 2/2026 · Mario Rossi",
      JSON.stringify({ aperti, t: await titolo() }));
    verifica("  la card dice cosa fare e offre gli altri modi (PDF, WhatsApp, Email, EON)", /tocca Invia/.test(await page.textContent("#risorsaCorpo")) && (await page.locator("#risorsaCorpo .scheda-invio-btn").count()) === 4);

    await chiedi("manda il preventivo 1 a Rossi");
    aperti = await page.evaluate(() => window.__aperti.slice());
    verifica("\"manda il preventivo 1 a Rossi\": il numero detto", aperti.length === 1 && decodeURIComponent(aperti[0]).includes("il preventivo n. 1/2026"), JSON.stringify(aperti));

    await chiedi("manda la fattura a Rossi per email");
    const mail = await page.evaluate(() => window.__mail.slice());
    verifica("\"manda la fattura a Rossi per email\": Mail con indirizzo, oggetto e testo pronti",
      mail.length === 1 && mail[0].startsWith("mailto:mario@rossi.it?subject=") && decodeURIComponent(mail[0]).includes("Fattura n. 2/2026") && decodeURIComponent(mail[0]).includes("la fattura n. 2/2026"),
      JSON.stringify(mail));

    await chiedi("invia a Sara Dini il preventivo su whatsapp");
    aperti = await page.evaluate(() => window.__aperti.slice());
    verifica("\"invia a Sara Dini il preventivo su whatsapp\" (senza numero): WhatsApp con il messaggio, il contatto lo sceglie lui",
      aperti.length === 1 && aperti[0].startsWith("https://wa.me/?text=") && /non ha il numero/.test(await page.textContent("#risorsaCorpo")), JSON.stringify(aperti));

    await chiedi("invia il preventivo a Sara Dini");
    const chat = await page.evaluate(() => ({ attiva: activeChatIndex !== null && chats[activeChatIndex] && chats[activeChatIndex].name, testo: (document.getElementById("chatInput") || {}).value }));
    verifica("cliente senza telefono né email: la chat EON con il messaggio pronto", chat.attiva === "Sara Dini" && /il preventivo n\. 3\/2026/.test(chat.testo || ""), JSON.stringify(chat));

    await chiedi("invia la fattura a Bianchi");
    verifica("documento che non c'è: lo dice, senza AI", /Non trovo una fattura per Bianchi/.test(await page.textContent("body")));

    await chiedi("manda la fattura da 500 a Rossi");
    verifica("\"manda la fattura da 500 a Rossi\" (un documento nuovo): non è un invio, va avanti come prima", (await page.evaluate(() => window.__aperti.length + window.__mail.length)) === 0);

    const aiInvio = await page.evaluate(() => window.__chiamateAI);

    /* ===== 2a. Crea account: la casella è obbligatoria ===== */
    const contesto2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const nuova = await contesto2.newPage();
    nuova.on("pageerror", (e) => erroriPagina.push(e.message));
    await nuova.addInitScript(() => { try { localStorage.setItem("__nessunaSessione", "1"); } catch (e) {} });
    await nuova.addInitScript(preparaFinti);
    await nuova.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await nuova.waitForTimeout(600);
    await nuova.click('#obTypeCards .ob-card[data-type="professioni"]');
    await nuova.click("#obType0ContinueBtn");
    await nuova.click('#obProfessionCards .ob-card[data-profession="edile"]');
    await nuova.click("#obContinueBtn");
    await nuova.waitForTimeout(200);
    verifica("\"Crea account\": c'è la casella con i link a Termini e Privacy", await nuova.isVisible("#obAccetto") && (await nuova.getAttribute("#obAccettoRow a[href='/termini']", "href")) === "/termini" && (await nuova.getAttribute("#obAccettoRow a[href='/privacy']", "href")) === "/privacy");
    await nuova.fill("#obName", "Luca Prova");
    await nuova.fill("#obEmail", "luca@prova.it");
    await nuova.fill("#obPassword", "password-lunga");
    await nuova.click("#obFinishBtn");
    await nuova.waitForTimeout(300);
    verifica("senza spunta: non crea l'account e spiega perché", !(await nuova.evaluate(() => window.__signUp)) && /spunta la casella/.test(await nuova.textContent("#obAuthError")));
    await nuova.check("#obAccetto");
    await nuova.click("#obFinishBtn");
    await nuova.waitForTimeout(800);
    const iscrizione = await nuova.evaluate(() => ({ meta: window.__signUp && window.__signUp.options.data, prof: window.__scritture.filter((s) => s.tabella === "profiles").map((s) => s.patch) }));
    verifica("con la spunta: account creato, versione e data dell'accettazione salvate (account e profilo)",
      iscrizione.meta && iscrizione.meta.termini_versione === "1.0" && iscrizione.prof.some((p) => p.termini_versione === "1.0" && p.termini_accettati_il), JSON.stringify(iscrizione));

    /* ===== 3. Le pagine ===== */
    const privacy = await (await fetch(`http://localhost:${PORT}/privacy.html`)).text();
    const termini = await (await fetch(`http://localhost:${PORT}/termini.html`)).text();
    verifica("privacy: titolare, fornitori veri (Supabase Londra, Anthropic, OpenAI), 12 mesi, sezione per i clienti",
      /Andrea Gianardi/.test(privacy) && /Supabase<\/td><td>[^<]*<\/td><td>Londra/.test(privacy) && /Anthropic/.test(privacy) && /OpenAI/.test(privacy) && /12 mesi/.test(privacy) && /id="clienti"/.test(privacy) && /id="fornitori"/.test(privacy));
    verifica("termini: accordo art. 28, niente fatturazione elettronica SdI, tasse = stima", /id="accordo"/.test(termini) && /art\. 28/.test(termini) && /non è un programma di fatturazione elettronica/.test(termini) && /stima/.test(termini));
    const cliente = await (await fetch(`http://localhost:${PORT}/cliente.html`)).text();
    verifica("pagina del cliente: riga sulla privacy con il link", /class="privacy-cliente"/.test(cliente) && /href="\/privacy#clienti"/.test(cliente));

    verifica("nessuna chiamata all'AI per gli invii", aiInvio <= 1, String(aiInvio)); // l'unica possibile: "fattura da 500", che non è un invio
    verifica("nessun errore nella pagina", erroriPagina.length === 0, JSON.stringify(erroriPagina));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
