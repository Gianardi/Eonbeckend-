/* Test della nota sulle foto (25/09/2026): scheda della foto (invio,
   foto grande, nota, barra per scrivere o dettare), salvataggio scritto e
   dettato, segno nella galleria, nota proposta subito dopo lo scatto, e
   ricerca a voce per nota ("la foto della crepa di Rossi"). Carica la
   vera index.html con Supabase e riconoscimento vocale finti.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/foto.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8978;
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
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
    await page.addInitScript(() => {
      window.__aggiornamenti = [];
      window.__inseriti = [];
      window.__dettato = "da sistemare prima della pittura";
      const catena = (tabella) => ({
        update: (patch) => ({ eq: async (col, val) => { window.__aggiornamenti.push({ tabella, patch, id: val }); return { error: null }; } }),
        insert: (riga) => ({ select: () => ({ single: async () => { const r = { id: "nuova-" + window.__inseriti.length, created_at: new Date().toISOString(), ...riga }; window.__inseriti.push({ tabella, riga }); return { data: r, error: null }; } }) }),
      });
      window.supabase = { createClient: () => ({
        from: catena,
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (percorso) => ({ data: { publicUrl: "https://file.test/" + percorso } }) }) },
        auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) },
      }) };
      // Microfono finto: "detta" window.__dettato
      window.SpeechRecognition = window.webkitSpeechRecognition = function () {
        const r = this;
        r.start = () => setTimeout(() => { r.onstart && r.onstart(); r.onresult && r.onresult({ results: [[{ transcript: window.__dettato }]] }); r.onend && r.onend(); }, 10);
      };
    });
    const descrizioniChieste = [];
    await page.route("https://eonbeckend.vercel.app/api?action=descrivi_foto", (route) => {
      const id = JSON.parse(route.request().postData()).foto_id;
      descrizioniChieste.push(id);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ descrizione: id === "f2" ? "Parete piastrellata del bagno" : "Porta scorrevole in vetro satinato" }) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      clients.length = 0;
      clients.push({ id: "r", name: "Rossi", phone: "3331234567" }, { id: "b", name: "Bianchi" });
      cantiereFoto.length = 0;
      cantiereFoto.push(
        { id: "f1", url: "https://file.test/1.jpg", created: "2026-09-25T10:00:00Z", clientId: "r", nota: "Crepa sul muro della cucina" },
        { id: "f2", url: "https://file.test/2.jpg", created: "2026-09-25T11:00:00Z", clientId: "r", nota: "" },
        { id: "f3", url: "https://file.test/3.jpg", created: "2026-09-24T09:00:00Z", clientId: "b", nota: "Contatore del gas in cantina" },
      );
      navigateTo("cantiere-foto");
    });

    const galleria = await page.evaluate(() => ({
      segni: [...document.querySelectorAll("#cantiereFotoGrid .cantiere-foto-item")].map((i) => !!i.querySelector(".cantiere-foto-nota-segno")),
    }));
    verifica("in galleria le foto con una nota hanno il loro segno (2 su 3)", galleria.segni.filter(Boolean).length === 2, JSON.stringify(galleria));

    // Tocco sulla foto senza nota di Rossi
    const scheda = await page.evaluate(() => {
      [...document.querySelectorAll("#cantiereFotoGrid .cantiere-foto-item img")].find((i) => i.src.endsWith("/2.jpg")).click();
      return {
        titolo: document.getElementById("risorsaTitolo").textContent,
        invio: [...document.querySelectorAll("#risorsaCorpo .scheda-invio-btn")].map((b) => b.textContent.trim()),
        foto: !!document.querySelector("#risorsaCorpo .scheda-foto-img"),
        nota: document.querySelector(".scheda-foto-nota").textContent,
        barra: !!document.querySelector("#risorsaPiede textarea") && !!document.querySelector("#risorsaPiede .scheda-mic"),
      };
    });
    verifica("tocco su una foto: si apre la sua scheda", scheda.titolo === "Foto — Rossi" && scheda.foto, JSON.stringify(scheda));
    verifica("in alto l'invio: WhatsApp, Email, EON", JSON.stringify(scheda.invio) === '["WhatsApp","Email","EON"]', JSON.stringify(scheda.invio));
    verifica("senza nota: invita a scriverla o dettarla, con la barra in fondo", /Nessuna nota/.test(scheda.nota) && scheda.barra, JSON.stringify(scheda));
    await page.waitForFunction(() => /EON: Parete piastrellata/.test((document.querySelector(".scheda-foto-descrizione") || {}).textContent || ""), null, { timeout: 3000 });
    verifica("foto senza descrizione: EON la guarda e la scrive sotto la nota (\"EON: …\")", descrizioniChieste.includes("f2") && (await page.evaluate(() => cantiereFoto.find((f) => f.id === "f2").descrizione)) === "Parete piastrellata del bagno", JSON.stringify(descrizioniChieste));

    // Nota scritta a mano
    await page.fill("#risorsaPiede textarea", "Piastrelle da cambiare in bagno");
    await page.press("#risorsaPiede textarea", "Enter");
    await page.waitForFunction(() => document.querySelector(".scheda-foto-nota").textContent === "Piastrelle da cambiare in bagno", null, { timeout: 3000 });
    const scritta = await page.evaluate(() => ({ agg: window.__aggiornamenti.slice(), memoria: cantiereFoto.find((f) => f.id === "f2").nota, aperta: document.getElementById("risorsaOverlay").style.display === "flex" }));
    verifica("nota scritta: salvata sulla foto giusta", scritta.agg.length === 1 && scritta.agg[0].tabella === "cantiere_foto" && scritta.agg[0].id === "f2" && scritta.agg[0].patch.nota === "Piastrelle da cambiare in bagno", JSON.stringify(scritta.agg));
    verifica("la nota si vede subito e la scheda resta aperta", scritta.memoria === "Piastrelle da cambiare in bagno" && scritta.aperta, JSON.stringify(scritta));

    // Nota dettata: si aggiunge in coda e si salva subito
    await page.click("#risorsaPiede .scheda-mic");
    await page.waitForFunction(() => /prima della pittura/.test(document.querySelector(".scheda-foto-nota").textContent), null, { timeout: 3000 });
    const dettata = await page.evaluate(() => window.__aggiornamenti.at(-1));
    verifica("nota dettata: aggiunta a quella già scritta e salvata subito", dettata.patch.nota === "Piastrelle da cambiare in bagno da sistemare prima della pittura", JSON.stringify(dettata));

    // Correzione: tocco sulla nota → nel campo, si riscrive, si salva al posto della vecchia
    await page.click(".scheda-foto-nota");
    const nelCampo = await page.inputValue("#risorsaPiede textarea");
    await page.fill("#risorsaPiede textarea", "Piastrelle del bagno da cambiare");
    await page.press("#risorsaPiede textarea", "Enter");
    await page.waitForFunction(() => document.querySelector(".scheda-foto-nota").textContent === "Piastrelle del bagno da cambiare", null, { timeout: 3000 });
    verifica("tocco sulla nota: passa nel campo, e la correzione la sostituisce", nelCampo === "Piastrelle da cambiare in bagno da sistemare prima della pittura" && (await page.evaluate(() => window.__aggiornamenti.at(-1).patch.nota)) === "Piastrelle del bagno da cambiare", nelCampo);
    const aVuoto = await page.evaluate(async () => { const n = window.__aggiornamenti.length; document.querySelector("#risorsaPiede .scheda-invia").click(); await new Promise((r) => setTimeout(r, 200)); return { salvataggi: window.__aggiornamenti.length - n, nota: document.querySelector(".scheda-foto-nota").textContent }; });
    verifica("invio a campo vuoto: la nota NON si cancella", aVuoto.salvataggi === 0 && aVuoto.nota === "Piastrelle del bagno da cambiare", JSON.stringify(aVuoto));

    // Ricerca a voce per nota
    const cerca = await page.evaluate(() => {
      const prova = (frase) => { chiudiRisorsaCard(); const ok = provaRisorsaImmediata(frase); return ok ? { titolo: document.getElementById("risorsaTitolo").textContent, nota: (document.querySelector(".scheda-foto-nota") || {}).textContent || null, voci: document.querySelectorAll("#risorsaCorpo .risorsa-voce").length } : false; };
      return {
        crepaRossi: prova("mostrami la foto della crepa di rossi"),
        contatore: prova("la foto del contatore"),
        fotoRossi: prova("foto rossi"),
        senzaCorrispondenza: prova("foto rossi tetto"),
        nienteDiNiente: prova("la foto del cancello"),
      };
    });
    verifica("\"mostrami la foto della crepa di Rossi\": si apre proprio quella foto", cerca.crepaRossi && cerca.crepaRossi.titolo === "Foto — Rossi" && /Crepa/.test(cerca.crepaRossi.nota), JSON.stringify(cerca.crepaRossi));
    verifica("\"la foto del contatore\" (senza cliente): trovata dalla nota, con il cliente giusto", cerca.contatore && cerca.contatore.titolo === "Foto — Bianchi" && /Contatore/.test(cerca.contatore.nota), JSON.stringify(cerca.contatore));
    verifica("\"foto rossi\": tutte le foto di Rossi, con le note", cerca.fotoRossi && cerca.fotoRossi.voci === 2, JSON.stringify(cerca.fotoRossi));
    verifica("\"foto rossi tetto\" (nessuna nota col tetto): comunque le foto di Rossi", cerca.senzaCorrispondenza && cerca.senzaCorrispondenza.voci === 2, JSON.stringify(cerca.senzaCorrispondenza));
    verifica("\"la foto del cancello\" (niente): decide l'AI", cerca.nienteDiNiente === false);

    const perDescrizione = await page.evaluate(() => { chiudiRisorsaCard(); const ok = provaRisorsaImmediata("mostrami la foto della parete di rossi"); return ok ? document.getElementById("risorsaTitolo").textContent : false; });
    verifica("\"la foto della parete di Rossi\": trovata dalla descrizione di EON (la nota non dice \"parete\")", perDescrizione === "Foto — Rossi", JSON.stringify(perDescrizione));

    // Foto scattata dal "+" di un cliente: subito la proposta di nota
    await page.evaluate(() => { chiudiRisorsaCard(); clienteIdPerProssimaFoto = "b"; });
    await page.setInputFiles("#cantiereFotoInput", { name: "nuova.jpg", mimeType: "image/png", buffer: PNG });
    await page.waitForFunction(() => document.getElementById("risorsaTitolo").textContent === "Foto — Bianchi" && document.getElementById("risorsaOverlay").style.display === "flex", null, { timeout: 3000 });
    const dopoScatto = await page.evaluate(() => document.querySelector(".scheda-foto-nota").textContent);
    verifica("appena scattata: \"Vuoi aggiungere una nota a questa foto?\"", /Vuoi aggiungere una nota/.test(dopoScatto), dopoScatto);
    verifica("appena caricata: EON ne chiede subito la descrizione", descrizioniChieste.some((id) => /^nuova-/.test(id)), JSON.stringify(descrizioniChieste));

    // Invio WhatsApp con nota e link
    const wa = await page.evaluate(() => { let url = null; window.open = (u) => { url = u; }; chiudiRisorsaCard(); mostraSchedaFoto(cantiereFoto.find((f) => f.id === "f1"), "Rossi"); document.querySelector('.scheda-invio-btn[data-canale="WhatsApp"]').click(); return url; });
    verifica("WhatsApp: al numero del cliente con la nota e il link della foto", wa && wa.startsWith("https://wa.me/393331234567?text=") && /Crepa/.test(decodeURIComponent(wa)) && /1\.jpg/.test(decodeURIComponent(wa)), wa);

    // Appunti: il tasto per la foto, la nota nella sua scheda, la foto tra gli appunti
    await page.evaluate(() => { chiudiRisorsaCard(); cantiereAppunti.length = 0; cantiereAppunti.push({ id: "a1", testo: "Comprare silicone", created: "2026-09-25T09:00:00Z" }); navigateTo("cantiere-appunti"); renderCantiereAppunti(); });
    verifica("Appunti: c'è il tasto \"Scatta una foto con appunto\"", await page.evaluate(() => /Scatta una foto con appunto/.test(document.getElementById("cantiereAppuntiFotoBtn").textContent)));
    const tagAperti = await page.evaluate(() => document.getElementById("cantiereFotoTagOverlay").style.display);
    await page.setInputFiles("#cantiereAppuntiFotoInput", { name: "vetro.jpg", mimeType: "image/png", buffer: PNG });
    await page.waitForFunction(() => document.getElementById("risorsaOverlay").style.display === "flex" && /Vuoi aggiungere una nota/.test((document.querySelector(".scheda-foto-nota") || {}).textContent || ""), null, { timeout: 3000 });
    const dopoScattoAppunti = await page.evaluate(() => ({ url: cantiereFoto.at(-1).url, tag: document.getElementById("cantiereFotoTagOverlay").style.display, righe: document.querySelectorAll("#cantiereAppuntiLista .cantiere-appunto").length }));
    verifica("foto da Appunti: salvata tra gli appunti, si apre subito la scheda per la nota (niente \"a quale cliente?\")", /\/cantiere\/appunti\//.test(dopoScattoAppunti.url) && dopoScattoAppunti.tag === tagAperti && dopoScattoAppunti.righe === 2, JSON.stringify(dopoScattoAppunti));
    await page.fill("#risorsaPiede textarea", "Da cambiare e trovare modello uguale");
    await page.press("#risorsaPiede textarea", "Enter");
    await page.waitForFunction(() => /Da cambiare e trovare modello uguale/.test(document.getElementById("cantiereAppuntiLista").innerText), null, { timeout: 3000 });
    const lista = await page.evaluate(() => ({ prima: document.querySelector("#cantiereAppuntiLista .cantiere-appunto").innerText, conta: document.getElementById("cantiereAppuntiCount").textContent, foto: !!document.querySelector("#cantiereAppuntiLista .cantiere-appunto-foto") }));
    verifica("la nota scritta compare subito nell'elenco, con la miniatura, in cima", /Da cambiare e trovare modello uguale/.test(lista.prima) && lista.foto && lista.conta === "2", JSON.stringify(lista));
    await page.evaluate(() => chiudiRisorsaCard());
    await page.click("#cantiereAppuntiLista .cantiere-appunto-foto");
    verifica("tocco sulla miniatura: si riapre la scheda della foto", await page.evaluate(() => document.getElementById("risorsaOverlay").style.display === "flex" && document.querySelector(".scheda-foto-nota").textContent === "Da cambiare e trovare modello uguale"));
    verifica("la foto resta anche nella galleria Foto", await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("cantiere-foto"); renderCantiereFoto(); return [...document.querySelectorAll("#cantiereFotoGrid img")].some((i) => /\/cantiere\/appunti\//.test(i.src)); }));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} verifiche FALLITE.` : "\nTutte le verifiche passate.");
  if (fallimenti) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
