/* Test della scheda del documento (25/09/2026): invio (PDF, WhatsApp,
   Email, EON) in alto, documento, conversazione con EON dentro la scheda
   e barra in fondo per scrivere/dettare la modifica. Carica la vera
   index.html; il backend dell'assistente è simulato e registra cosa gli
   arriva.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/scheda.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8976;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

const datiDoc = (totale, voci) => ({ tipo: "fattura", numero: "4/2026", anno: 2026, data: "25/09/2026", cliente: "Testolina",
  voci, imponibile: totale / 1.22, aliquota: 22, iva: totale - totale / 1.22, totale, condizioni: "30 giorni data fattura" });

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      window.supabase = { createClient: () => ({ from: () => ({}), auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) } }) };
    });
    const richieste = [];
    let risposte = [];
    await page.route("https://eonbeckend.vercel.app/**", (route) => {
      richieste.push(JSON.parse(route.request().postData() || "{}"));
      const r = risposte.shift() || { stato: "concluso", testo: "?", azioni: [] };
      route.fulfill({ status: r.__status || 200, contentType: "application/json", body: JSON.stringify(r) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate((d) => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      clients.length = 0;
      clients.push({ id: "t", name: "Testolina", phone: "333 1234567" });
      chats.length = 0;
      chats.push({ id: "c", name: "Testolina", messages: [{ id: "doc1", eventType: "doc", docDati: d, createdAt: "2026-09-25T10:00:00Z" }] });
      mostraAnteprimaDocumento(d, "doc1", "Testolina");
    }, datiDoc(122, [{ desc: "Prova", qta: 1, prezzo: 100 }]));

    const struttura = await page.evaluate(() => ({
      titolo: document.getElementById("risorsaTitolo").textContent,
      invio: [...document.querySelectorAll("#risorsaCorpo .scheda-invio-btn")].map((b) => b.textContent.trim()),
      documento: !!document.querySelector("#risorsaCorpo .scheda-anteprima .invoice-preview"),
      piedeVisibile: document.getElementById("risorsaPiede").style.display !== "none",
      campo: !!document.querySelector("#risorsaPiede textarea"),
      mic: !!document.querySelector("#risorsaPiede .scheda-mic"),
      inviaBtn: !!document.querySelector("#risorsaPiede .scheda-invia"),
      micSottoLaCard: !!document.querySelector("#risorsaCorpo .risorsa-mic-rapido"),
    }));
    verifica("scheda: titolo del documento", struttura.titolo === "Fattura n. 4/2026", struttura.titolo);
    verifica("in alto l'invio: PDF, WhatsApp, Email, EON", JSON.stringify(struttura.invio) === '["PDF","WhatsApp","Email","EON"]', JSON.stringify(struttura.invio));
    verifica("il documento vero, formattato", struttura.documento);
    verifica("in fondo, sempre visibile: campo per scrivere, microfono, invio", struttura.piedeVisibile && struttura.campo && struttura.mic && struttura.inviaBtn, JSON.stringify(struttura));
    verifica("niente più microfono piccolo sotto la card", !struttura.micSottoLaCard);

    // 1. Modifica scritta a mano, chiara: si applica subito
    risposte.push({ stato: "concluso", testo: "Fatto.", azioni: [{ tool: "modifica_preventivo_o_fattura", esito: { id: "doc1", dati: { ...{ tipo: "fattura", numero: "4/2026", anno: 2026, data: "25/09/2026", cliente: "Testolina", aliquota: 22, condizioni: "30 giorni data fattura" }, voci: [{ desc: "Prova", qta: 1, prezzo: 100 }, { desc: "Smaltimento", qta: 1, prezzo: 100 }], imponibile: 200, iva: 44, totale: 244 } } }] });
    await page.fill("#risorsaPiede textarea", "aggiungi 100 euro per smaltimento");
    await page.press("#risorsaPiede textarea", "Enter");
    await page.waitForFunction(() => /Totale €244/.test(document.getElementById("risorsaCorpo").textContent), null, { timeout: 5000 });
    const dopo1 = await page.evaluate(() => ({
      bolle: [...document.querySelectorAll(".scheda-bolla")].map((b) => b.className.replace("scheda-bolla ", "") + ": " + b.textContent),
      documento: document.querySelector(".scheda-anteprima").textContent,
      memoria: chats[0].messages[0].docDati.totale,
      campo: document.querySelector("#risorsaPiede textarea").value,
      aperta: document.getElementById("risorsaOverlay").style.display === "flex",
    }));
    verifica("la modifica parte con i dati attuali del documento (niente passaggi in più)", /Dati attuali del documento/.test(richieste[0].messaggio) && /"prezzo":100/.test(richieste[0].messaggio) && /aggiungi 100 euro per smaltimento/.test(richieste[0].messaggio) && /doc1/.test(richieste[0].messaggio), richieste[0].messaggio);
    verifica("regole nel messaggio: \"da 57.000\" = imponibile, una voce si cambia senza chiedere, risposta di una frase", /nuovo imponibile IVA esclusa/.test(richieste[0].messaggio) && /non chiedere, fallo/.test(richieste[0].messaggio) && /una sola frase breve/.test(richieste[0].messaggio));
    verifica("il documento si aggiorna lì davanti (nuova voce, nuovo totale)", /Smaltimento/.test(dopo1.documento) && dopo1.memoria === 244, JSON.stringify(dopo1));
    verifica("in chat: la mia richiesta e la risposta di EON", JSON.stringify(dopo1.bolle) === JSON.stringify(["me: aggiungi 100 euro per smaltimento", "eon: Fatto. Totale €244."]), JSON.stringify(dopo1.bolle));
    verifica("la scheda resta aperta e il campo si svuota", dopo1.aperta && dopo1.campo === "");

    // 2. EON chiede qualcosa: domanda nella scheda, risposta nello stesso filo
    risposte.push({ stato: "concluso", runId: "run-domanda", testo: "Quanto costa la seconda voce?", azioni: [] });
    await page.fill("#risorsaPiede textarea", "aggiungi la posa");
    await page.click("#risorsaPiede .scheda-invia");
    await page.waitForFunction(() => /Quanto costa la seconda voce\?/.test(document.querySelector(".scheda-chat").textContent), null, { timeout: 5000 });
    risposte.push({ stato: "concluso", testo: "Fatto.", azioni: [{ tool: "modifica_preventivo_o_fattura", esito: { id: "doc1", dati: { tipo: "fattura", numero: "4/2026", anno: 2026, data: "25/09/2026", cliente: "Testolina", aliquota: 22, voci: [{ desc: "Posa", qta: 1, prezzo: 300 }], imponibile: 300, iva: 66, totale: 366 } } }] });
    await page.fill("#risorsaPiede textarea", "300");
    await page.press("#risorsaPiede textarea", "Enter");
    await page.waitForFunction(() => /Totale €366/.test(document.getElementById("risorsaCorpo").textContent), null, { timeout: 5000 });
    verifica("la domanda di EON compare nella scheda, e la risposta \"300\" va nello stesso filo (runId)", richieste[2].runId === "run-domanda" && richieste[2].messaggio === "300", JSON.stringify(richieste[2]));
    verifica("dopo la risposta il documento è aggiornato", await page.evaluate(() => /Posa/.test(document.querySelector(".scheda-anteprima").textContent)));

    // 3. Conferma chiesta: Sì/No dentro la scheda (non più un avviso nascosto sotto)
    risposte.push({ stato: "in_attesa_conferma", runId: "run-conferma", domanda: "Confermi di cambiare il cliente in Rossi?" });
    risposte.push({ stato: "concluso", testo: "Fatto.", azioni: [] });
    await page.fill("#risorsaPiede textarea", "intestala a Rossi");
    await page.press("#risorsaPiede textarea", "Enter");
    await page.waitForSelector(".scheda-scelta.si", { timeout: 5000 });
    await page.click(".scheda-scelta.si");
    await page.waitForTimeout(400);
    verifica("conferma dentro la scheda con Sì/No, e il Sì arriva al server", richieste[4] && richieste[4].runId === "run-conferma" && richieste[4].conferma === true, JSON.stringify(richieste[4]));

    // 4. Errore del server: detto chiaramente nella chat
    risposte.push({ __status: 502, error: "Credito dell'AI esaurito" });
    await page.fill("#risorsaPiede textarea", "togli l'IVA");
    await page.press("#risorsaPiede textarea", "Enter");
    await page.waitForFunction(() => /Non ci sono riuscita/.test(document.querySelector(".scheda-chat").textContent), null, { timeout: 5000 });
    verifica("errore: lo dice nella chat, la scheda resta aperta", await page.evaluate(() => document.getElementById("risorsaOverlay").style.display === "flex"));

    // 5. Invio
    const invio = await page.evaluate(() => {
      const aperti = [];
      window.open = (url) => { aperti.push(url); return null; };
      let pdf = null; const pdfOriginale = apriPdfDocumento; apriPdfDocumento = (d) => { pdf = d; };
      let eon = null; inviaRisorsaEonInterna = (nome, testo) => { eon = { nome, testo }; };
      const btn = (n) => document.querySelector(`.scheda-invio-btn[data-canale="${n}"]`);
      btn("WhatsApp").click(); btn("PDF").click(); btn("EON").click();
      apriPdfDocumento = pdfOriginale;
      return { aperti, pdf: pdf && pdf.totale, eon, testo: testoInvioDocumento(chats[0].messages[0].docDati) };
    });
    verifica("WhatsApp: al numero del cliente (con +39) con il riepilogo già scritto", invio.aperti[0] && invio.aperti[0].startsWith("https://wa.me/393331234567?text=") && /fattura%20n.%204%2F2026/.test(invio.aperti[0]), invio.aperti[0]);
    verifica("PDF: apre il documento aggiornato", invio.pdf === 366, JSON.stringify(invio.pdf));
    verifica("EON: apre la chat del cliente con il messaggio pronto", invio.eon && invio.eon.nome === "Testolina" && /n\. 4\/2026/.test(invio.eon.testo), JSON.stringify(invio.eon));
    verifica("riepilogo da inviare: voci, IVA e totale del documento aggiornato", /- Posa: €300,00/.test(invio.testo) && /IVA 22% €66,00/.test(invio.testo) && /Totale €366,00/.test(invio.testo), invio.testo);

    // 6. Le altre schede (foto, elenchi) non hanno la barra in fondo
    const altra = await page.evaluate(() => { mostraRisorsaDocumenti([], "Testolina"); return document.getElementById("risorsaPiede").style.display; });
    verifica("un'altra scheda (elenco) non mostra la barra delle modifiche", altra === "none", altra);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} verifiche FALLITE.` : "\nTutte le verifiche passate.");
  if (fallimenti) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
