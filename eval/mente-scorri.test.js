/* Mente (appunti): scorri a sinistra per cancellare (29/09/2026, Andrea).
   - trascinando la riga verso sinistra compare "Elimina" in rosso;
   - un tocco su "Elimina": l'appunto sparisce e va nel Cestino (deleted_at),
     con "Annulla" che lo rimette;
   - uno scorrimento in verticale non apre niente; spunta e modifica
     funzionano come prima.
   Browser vero, Supabase finto.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/mente-scorri.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9021;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

function preparaPagina() {
  window.__db = [];
  const catena = (tabella) => {
    const q = {
      select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
      update: (valori) => ({ eq: async (c, v) => { window.__db.push({ tabella, op: "update", valori, v }); return { error: null }; } }),
      delete: () => ({ eq: async (c, v) => { window.__db.push({ tabella, op: "delete", v }); return { error: null }; } }),
      upsert: async () => ({ error: null }),
      insert: (riga) => { const r = { id: "n" + window.__db.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }) }) }; },
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("eon-scorri-accennato", "1"); } catch (e) {} }); // niente accenno dello scorrimento: disturberebbe le misure
    await page.addInitScript(preparaPagina);
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      await applyProfession("edile", true);
      const ora = Date.now();
      cantiereAppunti.push(
        { id: "a1", testo: "Chiamare Pedro", created: new Date(ora - 3000).toISOString(), clientId: null, daFare: true, fattoIl: null },
        { id: "a2", testo: "Comprare silicone", created: new Date(ora - 2000).toISOString(), clientId: null, daFare: false, fattoIl: null },
        { id: "a3", testo: "Idea: listino nuovo", created: new Date(ora - 1000).toISOString(), clientId: null, daFare: false, fattoIl: null },
      );
      apriCardAppunti(null);
    });

    const righe = () => page.evaluate(() => [...document.querySelectorAll("#apLista .ap-testo")].map((x) => x.textContent));
    verifica("la Mente mostra i 3 appunti, ognuno scorrevole", (await righe()).length === 3 && (await page.locator("#apLista .scorri-wrap").count()) === 3, JSON.stringify(await righe()));

    // Trascina "Comprare silicone" verso sinistra
    const trascina = async (testo, dx, dy) => {
      const box = await page.locator("#apLista .ap-riga", { hasText: testo }).boundingBox();
      const x = box.x + box.width - 40, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
      await page.mouse.up();
      await page.waitForTimeout(300);
    };
    await trascina("Comprare silicone", 0, 40);
    const dopoVerticale = await page.evaluate(() => [...document.querySelectorAll("#apLista .scorri-elimina")].map((b) => b.getBoundingClientRect().width));
    verifica("uno scorrimento in verticale non apre \"Elimina\"", dopoVerticale.every((w) => w === 0), JSON.stringify(dopoVerticale));

    await trascina("Comprare silicone", -120, 0);
    const bottone = page.locator("#apLista .scorri-wrap", { hasText: "Comprare silicone" }).locator(".scorri-elimina");
    const larghezza = (await bottone.boundingBox()) || { width: 0 };
    verifica("scorrendo a sinistra compare \"Elimina\" in rosso", larghezza.width > 60 && /Elimina/.test(await bottone.innerText()), JSON.stringify(larghezza));

    await bottone.click();
    await page.waitForTimeout(300);
    let r = await righe();
    const cestino = await page.evaluate(() => window.__db.filter((x) => x.tabella === "cantiere_appunti" && x.op === "update" && x.v === "a2"));
    verifica("tocco su \"Elimina\": l'appunto sparisce dalla Mente", r.length === 2 && !r.includes("Comprare silicone"), JSON.stringify(r));
    verifica("va nel Cestino (non cancellato per sempre)", cestino.length === 1 && cestino[0].valori.deleted_at, JSON.stringify(cestino));
    const toast = await page.evaluate(() => document.getElementById("aiToastContainer").innerText.replace(/\s+/g, " "));
    verifica("avviso \"Appunto cancellato\" con \"Annulla\"", /Appunto cancellato/.test(toast) && /Annulla/.test(toast) && /Comprare silicone/.test(toast), toast);

    await page.locator("#aiToastContainer .ai-toast-yes").first().click();
    await page.waitForTimeout(300);
    r = await righe();
    const ripristino = await page.evaluate(() => window.__db.filter((x) => x.tabella === "cantiere_appunti" && x.op === "update" && x.v === "a2" && x.valori.deleted_at === null));
    verifica("\"Annulla\" lo rimette al suo posto (anche nel database)", r.includes("Comprare silicone") && ripristino.length === 1, JSON.stringify(r));

    // Le cose da fare si scorrono uguale; la spunta funziona ancora
    await page.evaluate(() => { document.getElementById("aiToastContainer").innerHTML = ""; });
    await page.locator("#apLista .ap-cerchio").first().click();
    await page.waitForTimeout(200);
    const fatto = await page.evaluate(() => cantiereAppunti.find((a) => a.id === "a1").fattoIl);
    verifica("la spunta del \"da fare\" funziona ancora", !!fatto);

    // Un tocco sul testo apre ancora la modifica
    await page.evaluate(() => { document.getElementById("aiToastContainer").innerHTML = ""; });
    await page.locator("#apLista .ap-testo", { hasText: "Idea: listino nuovo" }).click();
    await page.waitForTimeout(200);
    const titolo = await page.evaluate(() => document.getElementById("risorsaTitolo").textContent);
    verifica("un tocco sul testo apre ancora \"Modifica appunto\"", /Modifica appunto/.test(titolo), titolo);

    await page.evaluate(() => { chiudiRisorsaCard(); apriCardAppunti(null); });
    await page.screenshot({ path: path.join(process.env.SCREEN_DIR || "/tmp", "mente-scorri-chiusa.png") });
    await trascina("Idea: listino nuovo", -120, 0);
    await page.screenshot({ path: path.join(process.env.SCREEN_DIR || "/tmp", "mente-scorri.png") });
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
