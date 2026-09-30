/* File privati nell'app e nella pagina del cliente (27/09/2026), nel browser
   vero con Supabase e server finti:
   - ogni <img>/<video>/<audio>/<a> con un file di EON riceve il link a
     scadenza (un solo viaggio al server per tutta la pagina);
   - "Apri" un documento apre il link firmato; la foto mandata su WhatsApp ha
     un link di 7 giorni; il PDF del preventivo ha il logo con il link firmato;
   - la pagina del cliente chiede i link con il codice del suo link.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/file-privati-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8991;
const ROOT = path.resolve(__dirname, "..");
const PUB = "https://finto.supabase.co/storage/v1/object/public/eon-files/";
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}
const firma = (u, durata) => u.replace("/object/public/", "/object/sign/").replace(/\?.*$/, "") + "?token=" + (durata === "condivisione" ? "7g" : "1h");

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    /* ===== App ===== */
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    const richiesteFirma = [];
    await page.route("https://eonbeckend.vercel.app/api?action=firma_file", async (route) => {
      const b = JSON.parse(route.request().postData());
      richiesteFirma.push({ b, auth: route.request().headers().authorization });
      const firmati = {}; b.urls.forEach((u) => { firmati[u] = firma(u, b.durata); });
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ firmati, scade_tra: b.durata === "condivisione" ? 604800 : 3600 }) });
    });
    await page.route("https://finto.supabase.co/storage/**", (route) => route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") }));
    await page.addInitScript(() => {
      const sessione = { access_token: "tok", user: { id: "u1", email: "a@b.it" } };
      const catena = (t) => { const q = { update: () => ({ eq: async () => ({ error: null }) }), select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, maybeSingle: async () => ({ data: null, error: null }),
        single: async () => (t === "profiles" ? { data: { id: "u1", full_name: "Andrea Gianardi", business_name: "", profession: "edile", termini_versione: "1.0" }, error: null } : { data: null, error: null }), then: (ok) => ok({ data: [], error: null }) }; return q; };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on(){ return this; }, subscribe(){ return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: sessione } }), onAuthStateChange: () => ({}) } }) };
      window.__finestre = [];
      window.open = (u) => { const w = { url: u, location: { href: "" }, document: { scritto: "", write(h) { this.scritto += h; }, close() {} }, close() {} }; window.__finestre.push(w); return w; };
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);

    await page.evaluate((PUB) => {
      const wrap = document.createElement("div"); wrap.id = "provaFile"; document.body.appendChild(wrap);
      const img = document.createElement("img"); img.id = "f1"; img.src = PUB + "u1/cantiere/foto/bagno.jpg"; wrap.appendChild(img);
      wrap.insertAdjacentHTML("beforeend", `<img id="f2" src="${PUB}u1/foto2.jpg"><audio id="f3" src="${PUB}u1/vocali/v.webm"></audio><a id="f4" href="${PUB}u1/preventivo.pdf" target="_blank">pdf</a><img id="f5" src="https://altro.sito/logo.png">`);
    }, PUB);
    await page.waitForTimeout(300);
    const attr = await page.evaluate(() => ({ f1: document.getElementById("f1").getAttribute("src"), f2: document.getElementById("f2").getAttribute("src"), f3: document.getElementById("f3").getAttribute("src"), f4: document.getElementById("f4").getAttribute("href"), f5: document.getElementById("f5").getAttribute("src") }));
    verifica("foto, vocale e link del documento: link a scadenza (1 ora)", attr.f1 === firma(PUB + "u1/cantiere/foto/bagno.jpg") && attr.f2 === firma(PUB + "u1/foto2.jpg") && attr.f3 === firma(PUB + "u1/vocali/v.webm") && attr.f4 === firma(PUB + "u1/preventivo.pdf"), JSON.stringify(attr));
    verifica("un indirizzo che non è di EON non si tocca", attr.f5 === "https://altro.sito/logo.png", attr.f5);
    verifica("un solo viaggio al server per tutti i file della pagina, con l'accesso dell'utente", richiesteFirma.length === 1 && richiesteFirma[0].b.urls.length === 4 && richiesteFirma[0].auth === "Bearer tok", JSON.stringify(richiesteFirma));

    // La stessa foto di nuovo: niente nuovo viaggio (link già pronto)
    await page.evaluate((PUB) => { const i = document.createElement("img"); i.id = "f6"; i.src = PUB + "u1/cantiere/foto/bagno.jpg"; document.body.appendChild(i); }, PUB);
    await page.waitForTimeout(150);
    verifica("la stessa foto mostrata di nuovo: link già pronto, nessun nuovo viaggio", (await page.getAttribute("#f6", "src")) === firma(PUB + "u1/cantiere/foto/bagno.jpg") && richiesteFirma.length === 1);

    // Apri un documento
    await page.evaluate((PUB) => apriFile(PUB + "u1/altro-documento.pdf"), PUB);
    // aspetta il link firmato (non un tempo fisso: sui computer lenti arriva dopo)
    await page.waitForFunction(() => window.__finestre.length && window.__finestre[0].location.href, null, { timeout: 3000 }).catch(() => {});
    let fin = await page.evaluate(() => window.__finestre.map((w) => ({ url: w.url, href: w.location.href })));
    verifica("\"Apri\" un documento: finestra aperta subito, poi il link firmato", fin.length === 1 && fin[0].url === "" && fin[0].href === firma(PUB + "u1/altro-documento.pdf"), JSON.stringify(fin));

    // Foto mandata su WhatsApp: link di 7 giorni
    await page.evaluate((PUB) => {
      window.__finestre.length = 0;
      const riga = creaRigaInvioFoto({ url: PUB + "u1/cantiere/foto/bagno.jpg" }, null, () => "Il lavabo");
      document.body.appendChild(riga);
      riga.querySelector('[data-canale="WhatsApp"]').click();
    }, PUB);
    await page.waitForFunction(() => window.__finestre.length && window.__finestre[0].location.href, null, { timeout: 3000 }).catch(() => {});
    fin = await page.evaluate(() => window.__finestre.map((w) => w.location.href));
    verifica("foto mandata su WhatsApp: nel messaggio un link che vale 7 giorni", fin.length === 1 && decodeURIComponent(fin[0]).includes(firma(PUB + "u1/cantiere/foto/bagno.jpg", "condivisione")) && decodeURIComponent(fin[0]).includes("Il lavabo"), JSON.stringify(fin));

    // PDF del preventivo con il logo
    await page.evaluate((PUB) => {
      window.__finestre.length = 0;
      aziendaIntestazione = { nome_azienda: "Gianardi Costruzioni", logo_url: PUB + "u1/intestazione/logo.png?v=5" };
      apriPdfDocumento({ tipo: "preventivo", numero: "1/2026", anno: 2026, cliente: "Mario Rossi", data: "27/09/2026", voci: [{ desc: "Bagno", qta: 1, prezzo: 100 }], imponibile: 100, iva: 22, aliquota: 22, totale: 122 });
    }, PUB);
    await page.waitForTimeout(250);
    fin = await page.evaluate(() => window.__finestre.map((w) => w.document.scritto));
    verifica("PDF del preventivo: il logo con il link firmato", fin.length === 1 && fin[0].includes(firma(PUB + "u1/intestazione/logo.png")) && !fin[0].includes("/object/public/"), fin[0] && fin[0].slice(0, 200));
    verifica("app: nessun errore", errori.length === 0, JSON.stringify(errori));

    /* ===== Pagina del cliente ===== */
    const CODICE = "2ce25af4603c427485fddba2343b5f9d";
    const cli = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const erroriCli = [];
    cli.on("pageerror", (e) => erroriCli.push(e.message));
    const richiestePortale = [];
    await cli.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "/* supabase finto */" }));
    await cli.route("https://eonbeckend.vercel.app/api?action=portale_firma_file", async (route) => {
      const b = JSON.parse(route.request().postData());
      richiestePortale.push(b);
      const firmati = {}; if (b.codice === CODICE) b.urls.forEach((u) => { firmati[u] = firma(u); });
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ firmati, scade_tra: 3600 }) });
    });
    await cli.route("https://finto.supabase.co/storage/**", (route) => route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") }));
    await cli.addInitScript(([codice, PUB]) => {
      window.supabase = { createClient: () => ({
        from: () => { throw new Error("niente tabelle"); },
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: PUB + p } }) }) },
        rpc: async (nome, arg) => {
          const giusto = arg.p_codice === codice;
          if (nome === "portale_apri") return { data: giusto ? { conversazione: { id: "c1", contact_name: "Mario Rossi" }, professionista: { full_name: "Andrea Gianardi", business_name: "Gianardi Costruzioni", profession: "edile" }, cliente: { name: "Mario Rossi", description: "Bagno", status: "attivo" } } : null, error: null };
          if (nome === "portale_messaggi") return { data: giusto ? [{ id: "m1", sender: "me", body: "", file_url: PUB + "u1/cantiere/foto/bagno.jpg", file_name: "bagno.jpg", file_type: "image/jpeg", created_at: "2026-09-25T08:00:00Z" }] : null, error: null };
          return { data: null, error: null };
        },
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      }) };
    }, [CODICE, PUB]);
    await cli.goto(`http://localhost:${PORT}/cliente.html?c=${CODICE}`, { waitUntil: "networkidle" });
    await cli.evaluate(() => document.getElementById("tabMessaggi").click());
    await cli.waitForTimeout(400);
    const srcCli = await cli.evaluate(() => { const i = document.querySelector("#messages img"); return i ? i.getAttribute("src") : null; });
    verifica("pagina del cliente: la foto nella chat con il link firmato, chiesto con il codice del link", srcCli === firma(PUB + "u1/cantiere/foto/bagno.jpg") && richiestePortale.length >= 1 && richiestePortale[0].codice === CODICE, JSON.stringify({ srcCli, richiestePortale }));
    verifica("pagina del cliente: nessun errore", erroriCli.length === 0, JSON.stringify(erroriCli));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
