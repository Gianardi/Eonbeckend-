/* Incasso da chi non è in rubrica (giro 19, 1/10/2026): prima EON diceva "aggiungilo e poi
   riprova"; ora chiede una volta "Lo aggiungo e segno l'incasso?" e con un tocco fa tutto.
   Browser vero, Supabase finto. Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/incasso-fuori-rubrica-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9026;
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

    const scrivi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; window.__db.length = 0; });
      await page.fill("#homeHeroCampo", frase);
      await page.evaluate(() => document.getElementById("homeHeroSend").click());
      await page.waitForTimeout(600);
    };
    // 1) Chi ha pagato non è in rubrica: un tocco per aggiungerlo e segnare l'incasso
    await scrivi("Pedemonte ha pagato 60 euro");
    const card = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, corpo: document.getElementById("risorsaCorpo").innerText }));
    verifica("\"Pedemonte ha pagato 60 euro\" (non in rubrica): chiede se aggiungerlo, con l'importo", /Pedemonte/.test(card.titolo) && /non è tra i tuoi clienti/.test(card.corpo) && /60/.test(card.corpo) && /Sì, aggiungi Pedemonte/.test(card.corpo), JSON.stringify(card));
    await page.evaluate(() => [...document.querySelectorAll("#risorsaCorpo .scheda-scelta")].find((b) => /Sì, aggiungi/.test(b.textContent)).click());
    await page.waitForTimeout(600);
    const cl = await scritte("insert", "clients"), inc = await scritte("insert", "incomes");
    verifica("un tocco: cliente aggiunto e incasso di 60 € segnato", cl.length === 1 && /Pedemonte/.test(cl[0].riga.name) && inc.length === 1 && Number(inc[0].riga.amount) === 60, JSON.stringify({ cl, inc }));
    // 2) "No": non si scrive niente
    await scrivi("la signora Moser mi ha dato 250 euro contanti");
    await page.evaluate(() => [...document.querySelectorAll("#risorsaCorpo .scheda-scelta")].find((b) => b.textContent === "No").click());
    await page.waitForTimeout(300);
    verifica("\"No\": niente cliente né incasso", (await scritte("insert", "clients")).length === 0 && (await scritte("insert", "incomes")).length === 0);
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
