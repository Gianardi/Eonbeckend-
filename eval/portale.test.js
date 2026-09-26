/* Test della pagina cliente sicura (25/09/2026): la pagina non legge più
   nessuna tabella, passa solo dalle funzioni portale_apri / portale_messaggi
   / portale_scrivi col codice del link. Supabase finto.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/portale.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8985;
const ROOT = path.resolve(__dirname, "..");
const CODICE = "2ce25af4603c427485fddba2343b5f9d";
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
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "/* supabase finto nel test */" }));
    await page.addInitScript((codice) => {
      window.__rpc = [];
      window.__tabelle = [];
      window.__messaggi = [
        { id: "m1", sender: "me", body: "Buongiorno, domani passo alle 9", created_at: "2026-09-25T08:00:00Z" },
      ];
      window.supabase = { createClient: () => ({
        from: (t) => { window.__tabelle.push(t); throw new Error("la pagina cliente non deve leggere la tabella " + t); },
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://x.supabase.co/storage/v1/object/public/eon-files/" + p } }) }) },
        rpc: async (nome, arg) => {
          window.__rpc.push({ nome, arg });
          const giusto = arg.p_codice === codice;
          if (nome === "portale_apri") return { data: giusto ? { conversazione: { id: "c1", contact_name: "Mario Rossi" }, professionista: { full_name: "Andrea Gianardi", business_name: "Gianardi Costruzioni", profession: "edile" }, cliente: { name: "Mario Rossi", description: "Rifacimento bagno", status: "attivo" } } : null, error: null };
          if (nome === "portale_messaggi") return { data: giusto ? window.__messaggi.slice() : null, error: null };
          if (nome === "portale_scrivi") { const m = { id: "n" + window.__rpc.length, sender: "them", body: arg.p_body, created_at: new Date().toISOString() }; window.__messaggi.push(m); return { data: m, error: null }; }
          return { data: null, error: { message: "sconosciuta" } };
        },
        channel: () => { throw new Error("niente realtime sulle tabelle"); },
      }) };
    }, CODICE);

    // Link giusto
    await page.goto(`http://localhost:${PORT}/cliente.html?c=${CODICE}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const aperta = await page.evaluate(() => ({ pro: document.getElementById("proName").textContent, lavoro: document.getElementById("workTitle").textContent, desc: document.getElementById("workDesc").textContent, msg: document.getElementById("messages").innerText, tabelle: window.__tabelle.slice() }));
    verifica("link giusto: si apre con professionista e lavoro", aperta.pro === "Gianardi Costruzioni" && aperta.lavoro === "Mario Rossi" && aperta.desc === "Rifacimento bagno", JSON.stringify(aperta));
    verifica("i messaggi della conversazione si vedono", /domani passo alle 9/.test(aperta.msg), aperta.msg);
    verifica("nessuna tabella letta direttamente (solo le funzioni sicure)", aperta.tabelle.length === 0, JSON.stringify(aperta.tabelle));

    // Il cliente scrive
    await page.evaluate(() => document.getElementById("tabMessaggi").click());
    await page.fill("#msgInput", "Perfetto, vi aspetto");
    await page.click("#sendBtn");
    await page.waitForTimeout(200);
    const scritto = await page.evaluate(() => ({ ult: window.__rpc.filter((r) => r.nome === "portale_scrivi").at(-1), msg: document.getElementById("messages").innerText }));
    verifica("scrive col codice del link e il messaggio compare subito", scritto.ult && scritto.ult.arg.p_body === "Perfetto, vi aspetto" && /vi aspetto/.test(scritto.msg), JSON.stringify(scritto.ult));

    // Arriva un messaggio nuovo dal professionista: compare entro pochi secondi
    await page.evaluate(() => window.__messaggi.push({ id: "m9", sender: "me", body: "Ho spostato alle 10", created_at: new Date().toISOString() }));
    await page.waitForFunction(() => /spostato alle 10/.test(document.getElementById("messages").innerText), null, { timeout: 6000 });
    verifica("messaggio nuovo del professionista: arriva da solo in pochi secondi", true);
    const doppioni = await page.evaluate(() => (document.getElementById("messages").innerText.match(/vi aspetto/g) || []).length);
    verifica("nessun doppione del messaggio già mostrato", doppioni === 1, String(doppioni));

    // Link sbagliato
    await page.goto(`http://localhost:${PORT}/cliente.html?c=codicesbagliato123456789`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const gate = await page.evaluate(() => document.getElementById("gateText").textContent);
    verifica("link sbagliato: \"non è più valido\", nessun dato", /non è più valido/.test(gate), gate);
    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
