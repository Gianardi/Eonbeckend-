/* Le cartelle nella Mente (30/09/2026, Andrea: "se uno crea appunti deve
   poterli raggruppare per cartelle, semplicemente").
   - in alto nella Mente: le cartelle con quanti appunti hanno e "+ Cartella";
   - "+ Cartella" → nome → la cartella nuova si apre, con "‹ Mente" per tornare;
   - toccando un appunto: "Cartella" con Mente / le cartelle / "+ Nuova";
     un tocco lo sposta (anche nel database), con "Annulla".
   Browser vero, Supabase finto.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/mente-cartelle.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9031;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

function preparaPagina() {
  window.__db = [];
  try { localStorage.setItem("eon-scorri-accennato", "1"); } catch (e) {}
  const catena = (tabella) => {
    const q = {
      select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
      update: (valori) => ({ eq: async (c, v) => { window.__db.push({ tabella, op: "update", valori, v }); return { error: null }; } }),
      delete: () => ({ eq: async () => ({ error: null }) }), upsert: async () => ({ error: null }),
      insert: (riga) => { const r = { id: "n" + window.__db.length, created_at: new Date().toISOString(), ...riga }; window.__db.push({ tabella, op: "insert", riga: r }); return { select: () => ({ single: async () => ({ data: r, error: null }) }) }; },
      maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
      then: (ok) => ok({ data: [], error: null }),
    };
    return q;
  };
  window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(preparaPagina);
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      await applyProfession("amministratore", true);
      cartelle.length = 0; cartelle.push({ id: "k1", nome: "Fornitori", icona: null });
      const ora = Date.now();
      cantiereAppunti.push(
        { id: "a1", testo: "Chiedere il DURC alla ditta", created: new Date(ora - 2000).toISOString(), clientId: null, daFare: false, fattoIl: null, cartellaId: null },
        { id: "a2", testo: "Listino nuovo dell'idraulico", created: new Date(ora - 1000).toISOString(), clientId: null, daFare: false, fattoIl: null, cartellaId: "k1" },
      );
      apriCardAppunti(null);
    });
    const stato = () => page.evaluate(() => ({
      titolo: document.getElementById("risorsaTitolo").textContent,
      chip: [...document.querySelectorAll("#apCartelle .cl-filtro")].map((b) => b.textContent),
      righe: [...document.querySelectorAll("#apLista .ap-testo")].map((x) => x.textContent),
      azioni: [...document.querySelectorAll(".ap-azioni button")].map((b) => b.textContent),
    }));

    let s = await stato();
    verifica("in alto nella Mente le cartelle con quanti appunti hanno, e «+ Cartella»", s.titolo === "Mente" && s.chip.join("|") === "Mente1|Fornitori1|+ Cartella" && s.righe.join() === "Chiedere il DURC alla ditta", JSON.stringify(s));
    await page.waitForTimeout(400); await page.screenshot({ path: path.join(process.env.SCREEN_DIR || "/tmp", "mente-cartelle.png") });

    // + Cartella → "Idee" → si apre la cartella nuova, con "‹ Mente"
    await page.locator("#apCartelle .cl-filtro", { hasText: "+ Cartella" }).click();
    await page.fill("#cartellaNome", "idee");
    await page.click("#cartellaNomeSalva");
    await page.waitForTimeout(300);
    s = await stato();
    const creata = await page.evaluate(() => window.__db.find((x) => x.tabella === "cartelle" && x.op === "insert"));
    verifica("«+ Cartella» → la cartella «Idee» nasce (anche nel database) e si apre", s.titolo === "Idee" && s.azioni[0] === "‹ Mente" && creata && creata.riga.nome === "Idee", JSON.stringify({ s, creata }));
    await page.locator(".ap-azioni button", { hasText: "‹ Mente" }).click();
    await page.waitForTimeout(200);
    s = await stato();
    verifica("«‹ Mente» torna alla Mente, e c'è anche «Idee»", s.titolo === "Mente" && s.chip.includes("Idee0"), JSON.stringify(s));

    // Tocco sull'appunto → Cartella → Idee
    await page.locator("#apLista .ap-testo", { hasText: "Chiedere il DURC" }).click();
    await page.waitForTimeout(200);
    const scelte = await page.evaluate(() => [...document.querySelectorAll("#apSposta .cl-filtro")].map((b) => b.textContent + (b.classList.contains("on") ? "*" : "")));
    verifica("toccando un appunto: «Cartella» con Mente (dove sta ora), le cartelle e «+ Nuova»", scelte.join("|") === "Mente*|Fornitori|Idee|+ Nuova", JSON.stringify(scelte));
    await page.waitForTimeout(400); await page.screenshot({ path: path.join(process.env.SCREEN_DIR || "/tmp", "mente-cartelle-sposta.png") });
    await page.locator("#apSposta .cl-filtro", { hasText: "Idee" }).click();
    await page.waitForTimeout(300);
    s = await stato();
    const spostato = await page.evaluate(() => ({ mem: cantiereAppunti.find((a) => a.id === "a1").cartellaId, db: window.__db.filter((x) => x.tabella === "cantiere_appunti" && x.v === "a1").map((x) => x.valori.cartella_id), toast: document.getElementById("aiToastContainer").innerText.replace(/\s+/g, " ") }));
    const idee = await page.evaluate(() => cartelle.find((c) => c.nome === "Idee").id);
    verifica("un tocco su «Idee»: l'appunto va nella cartella (anche nel database) e la cartella si apre", s.titolo === "Idee" && s.righe.includes("Chiedere il DURC alla ditta") && spostato.mem === idee && spostato.db.join() === idee && /In Idee/.test(spostato.toast), JSON.stringify({ s, spostato }));
    await page.locator("#aiToastContainer .ai-toast-yes").first().click();
    await page.waitForTimeout(300);
    const annullato = await page.evaluate(() => cantiereAppunti.find((a) => a.id === "a1").cartellaId);
    verifica("«Annulla» lo rimette nella Mente", annullato === null, String(annullato));

    // + Nuova dall'appunto: crea "Scadenze" e ci mette l'appunto
    await page.evaluate(() => { document.getElementById("aiToastContainer").innerHTML = ""; modificaAppuntoInCard(cantiereAppunti.find((a) => a.id === "a1")); });
    await page.locator("#apSposta .cl-filtro", { hasText: "+ Nuova" }).click();
    await page.fill("#cartellaNome", "Scadenze");
    await page.click("#cartellaNomeSalva");
    await page.waitForTimeout(400);
    s = await stato();
    const inScadenze = await page.evaluate(() => { const c = cartelle.find((x) => x.nome === "Scadenze"); return c && cantiereAppunti.find((a) => a.id === "a1").cartellaId === c.id; });
    verifica("«+ Nuova» dall'appunto: crea «Scadenze» e ci sposta l'appunto", inScadenze && s.titolo === "Scadenze" && s.righe.includes("Chiedere il DURC alla ditta"), JSON.stringify(s));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
