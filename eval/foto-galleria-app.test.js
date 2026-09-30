/* Più foto insieme dalla galleria (30/09/2026, considerazioni del tester Simone):
   - nella scheda del cliente c'era solo "Scatta foto" (solo fotocamera): ora anche
     "Dalla galleria", con la scelta di tante foto insieme, salvate nella sua scheda;
   - nelle cartelle: "Scatta foto" e "Dalla galleria";
   - nella pagina Foto: più foto insieme, poi UNA domanda sola "a quale cliente?"
     per tutte (prima: una per una, ogni volta tornando in galleria).
   Browser vero, Supabase finto. Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/foto-galleria-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9024;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");
const foto = (n) => Array.from({ length: n }, (_, i) => ({ name: "foto" + i + ".png", mimeType: "image/png", buffer: PNG }));

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(() => {
      window.__db = [];
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: (patch) => ({
            eq: async (c, v) => { window.__db.push({ tabella, op: "update", ids: [v], patch }); return { error: null }; },
            in: async (c, v) => { window.__db.push({ tabella, op: "update", ids: v, patch }); return { error: null }; },
          }),
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: (riga) => { window.__db.push({ tabella, op: "insert", riga }); const r = { id: tabella + window.__db.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://file.test/" + p } }) }) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
    });
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t"; descriviFoto = () => {};
      await applyProfession("amministratore", true);
      clients.length = 0;
      clients.push({ id: "c1", name: "Condominio Viale Italia 171", phone: "", status: "attivo", value: 0, desc: "", archived: false });
      cartelle.push({ id: "k1", nome: "Sinistri", colore: null });
    });
    const scritte = (op, tab) => page.evaluate(([op, tab]) => window.__db.filter((x) => x.op === op && x.tabella === tab), [op, tab]);
    const toast = () => page.evaluate(() => document.getElementById("aiToastContainer").innerText);
    const pulisci = () => page.evaluate(() => { window.__db.length = 0; document.getElementById("aiToastContainer").innerHTML = ""; });

    // 1) Scheda del cliente: "Dalla galleria", 3 foto insieme
    await pulisci();
    await page.evaluate(() => mostraSchedaCliente(clients[0]));
    const tasti = await page.evaluate(() => [...document.querySelectorAll("#risorsaCorpo .sc-azione b")].map((b) => b.textContent));
    verifica("nella scheda del cliente ci sono \"Scatta foto\" e \"Galleria\"", tasti.includes("Scatta foto") && tasti.includes("Galleria"), JSON.stringify(tasti));
    const multipla = await page.evaluate(() => document.getElementById("galleriaFotoInput").multiple && !document.getElementById("galleriaFotoInput").hasAttribute("capture"));
    verifica("la galleria permette di scegliere più foto (e non apre solo la fotocamera)", multipla);
    await page.evaluate(() => document.querySelector('#risorsaCorpo .sc-azione[data-azione="galleria"]').click());
    await page.setInputFiles("#galleriaFotoInput", foto(3));
    await page.waitForTimeout(800);
    let ins = await scritte("insert", "cantiere_foto"), upd = await scritte("update", "cantiere_foto");
    verifica("3 foto caricate e tutte nella scheda del cliente", ins.length === 3 && upd.filter((u) => u.patch.client_id === "c1").length === 3, JSON.stringify({ ins: ins.length, upd }));
    verifica("un avviso solo: \"3 foto salvate\" col nome del cliente", /3 foto salvate/.test(await toast()) && /Viale Italia 171/.test(await toast()), await toast());

    // 2) Cartella: "Scatta foto" e "Dalla galleria", 2 foto insieme
    await pulisci();
    await page.evaluate(() => { chiudiRisorsaCard(); apriCardAppunti(cartelle.find((c) => c.id === "k1")); });
    const azioni = await page.evaluate(() => [...document.querySelectorAll(".ap-azioni button")].map((b) => b.textContent));
    verifica("nella cartella ci sono \"Scatta foto\" e \"Dalla galleria\"", azioni.includes("Scatta foto") && azioni.includes("Dalla galleria"), JSON.stringify(azioni));
    await page.evaluate(() => document.querySelector('.ap-azioni button[data-az="galleria"]').click());
    await page.setInputFiles("#galleriaFotoInput", foto(2));
    await page.waitForTimeout(700);
    ins = await scritte("insert", "cantiere_foto");
    verifica("2 foto nella cartella, la cartella si riapre", ins.length === 2 && ins.every((x) => x.riga.cartella_id === "k1") && /2 foto in Sinistri/.test(await toast()), JSON.stringify({ ins, t: await toast() }));

    // 3) Pagina Foto: 4 foto insieme, una domanda sola "a quale cliente?"
    await pulisci();
    await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("cantiere-foto"); });
    await page.setInputFiles("#cantiereFotoInput", foto(4));
    await page.waitForTimeout(900);
    const domanda = await page.evaluate(() => ({ aperta: document.getElementById("cantiereFotoTagOverlay").style.display === "flex", hint: document.getElementById("cantiereFotoTagHint").textContent }));
    verifica("pagina Foto: 4 foto caricate, UNA domanda per tutte", (await scritte("insert", "cantiere_foto")).length === 4 && domanda.aperta && /Le 4 foto/.test(domanda.hint), JSON.stringify(domanda));
    await page.fill("#cantiereFotoTagCampo", "viale Italia 171, sinistro Del Santo");
    await page.click("#cantiereFotoTagSend");
    await page.waitForTimeout(700);
    upd = await scritte("update", "cantiere_foto");
    const collegate = new Set(upd.filter((u) => u.patch.client_id === "c1").flatMap((u) => u.ids)).size;
    const note = await page.evaluate(() => cantiereFoto.filter((f) => f.clientId === "c1" && /sinistro Del Santo/i.test(f.nota || "")).length);
    verifica("una risposta sola collega tutte e 4 le foto al cliente, con la nota", collegate === 4 && note >= 4 && /4 foto collegate/.test(await toast()), JSON.stringify({ collegate, note, t: await toast() }));

    // 4) Una foto sola: come prima (domanda per quella foto)
    await pulisci();
    await page.setInputFiles("#cantiereFotoInput", foto(1));
    await page.waitForTimeout(600);
    const una = await page.evaluate(() => document.getElementById("cantiereFotoTagHint").textContent);
    verifica("una foto sola: come prima", /^A quale cliente/.test(una), una);
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
