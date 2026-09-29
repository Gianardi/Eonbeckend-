/* Scorri a sinistra per eliminare, in TUTTI gli elenchi (30/09/2026, Andrea:
   "il tester non la vede. Io la voglio in tutte le funzioni").
   - la prima volta la prima riga "accenna" lo scorrimento (una sola volta);
   - impegni (Oggi), clienti, entrate, pagamenti, documenti dell'impresa,
     assemblee, scheda cliente (impegni e appunti), urgenze: trascinando
     compare "Elimina", un tocco manda nel Cestino (deleted_at) e sparisce
     dall'elenco; "Annulla" lo rimette.
   Browser vero con tocco, Supabase finto.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/scorri-ovunque.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9029;
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
    await page.addInitScript(preparaPagina);
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      await applyProfession("edile", true);
      const domani = new Date(); domani.setDate(domani.getDate() + 1);
      clients.length = 0;
      clients.push({ id: "c1", name: "Mario Rossi", status: "attivo", value: 0, desc: "Bagno", archived: false }, { id: "c2", name: "Anna Bianchi", status: "attivo", value: 0, desc: "Tetto", archived: false });
      tasks.length = 0;
      tasks.push(mappaImpegno({ id: "t1", title: "Sopralluogo Mario Rossi", type: "appuntamento", scheduled_at: domani.toISOString().slice(0, 10) + "T09:00:00", time: "Domani, 09:00", status: "todo", owner_type: "user" }));
      tasks.push(mappaImpegno({ id: "t2", title: "Comprare silicone", type: "commissione", scheduled_at: domani.toISOString().slice(0, 10) + "T11:00:00", time: "Domani, 11:00", status: "todo", owner_type: "user" }));
      tasks.push({ ...mappaImpegno({ id: "t3", title: "Perdita da Anna Bianchi", type: "urgenza", scheduled_at: new Date().toISOString(), time: "Oggi", status: "todo", owner_type: "user" }), urgente: true });
      incomes.length = 0; incomes.push({ id: "i1", client: "Mario Rossi", clientId: "c1", amount: 1200, status: "attesa", desc: "Acconto", due: "2026-10-10" });
      payments.length = 0; payments.push({ id: "p1", supplier: "Edil Forniture", amount: 300, status: "dapagare", desc: "Cemento", due: "2026-10-05" });
      cantiereDocumenti.length = 0; cantiereDocumenti.push({ id: "d1", nome: "DURC 2026", url: "https://example.com/durc.pdf" });
      cantiereAppunti.length = 0; cantiereAppunti.push({ id: "a1", testo: "Rossi vuole le piastrelle chiare", created: new Date().toISOString(), clientId: "c1", daFare: false, fattoIl: null });
      try { localStorage.removeItem("eon-scorri-accennato"); } catch (e) {}
      scorriAccennato = false;
    });

    const trascina = async (loc) => {
      await loc.evaluate((el) => el.scrollIntoView({ block: "center" })); // mai sotto la barra in basso
      await page.waitForTimeout(150);
      const box = await loc.boundingBox();
      const x = box.x + box.width - 30, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(x - (130 * i) / 8, y);
      await page.mouse.up();
      await page.waitForTimeout(300);
    };
    const pulisci = () => page.evaluate(() => { document.getElementById("aiToastContainer").innerHTML = ""; window.__db.length = 0; });
    const cestinato = (tabella, id) => page.evaluate(([t, i]) => window.__db.some((x) => x.tabella === t && x.op === "update" && x.v === i && x.valori.deleted_at), [tabella, id]);
    const elimina = async (contenitore, testo) => {
      const riga = page.locator(contenitore + " .scorri-wrap", { hasText: testo }).first();
      await trascina(riga.locator(".scorri-contenuto"));
      const b = riga.locator(".scorri-elimina");
      const w = ((await b.boundingBox()) || { width: 0 }).width;
      if (w > 60) await b.click();
      await page.waitForTimeout(350);
      return w;
    };

    // 1. L'accenno della prima volta: sui Clienti la prima riga si sposta da sola e torna
    await page.evaluate(() => { navigateTo("clienti"); renderClientArchive(); });
    let visto = 0;
    for (let k = 0; k < 20; k++) { await page.waitForTimeout(100); const w = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll("#clientArchiveList .scorri-elimina")].map((b) => b.getBoundingClientRect().width))); if (w > 40 && visto <= 40 && process.env.SCREEN_DIR) await page.screenshot({ path: path.join(process.env.SCREEN_DIR, "scorri-accenno.png") }); visto = Math.max(visto, w); }
    await page.waitForTimeout(900);
    const dopo = await page.evaluate(() => [...document.querySelectorAll("#clientArchiveList .scorri-elimina")].map((b) => b.getBoundingClientRect().width));
    const segnato = await page.evaluate(() => localStorage.getItem("eon-scorri-accennato"));
    verifica("la prima volta la riga accenna lo scorrimento (si vede «Elimina») e poi torna chiusa", visto > 30 && dopo.every((w) => w === 0) && segnato === "1", JSON.stringify({ visto, dopo, segnato }));

    // 2. Clienti: scorri → Elimina → nel Cestino, con Annulla che lo rimette
    await pulisci();
    const wc = await elimina("#clientArchiveList", "Anna Bianchi");
    let nomi = await page.evaluate(() => [...document.querySelectorAll("#clientArchiveList .row-name")].map((x) => x.textContent));
    verifica("Clienti: scorrendo compare «Elimina»; un tocco e il cliente va nel Cestino", wc > 60 && !nomi.includes("Anna Bianchi") && await cestinato("clients", "c2"), JSON.stringify({ wc, nomi }));
    await page.locator("#aiToastContainer .ai-toast-yes").first().click();
    await page.waitForTimeout(400);
    nomi = await page.evaluate(() => [...document.querySelectorAll("#clientArchiveList .row-name")].map((x) => x.textContent));
    const ripristinato = await page.evaluate(() => window.__db.some((x) => x.tabella === "clients" && x.v === "c2" && x.valori.deleted_at === null));
    verifica("Clienti: «Annulla» lo rimette (anche nel database)", nomi.includes("Anna Bianchi") && ripristinato, JSON.stringify(nomi));

    // 3. Impegni (Oggi)
    await page.evaluate(() => { navigateTo("oggi"); renderTasks(); });
    await pulisci();
    const wt = await elimina("#taskListUser", "Comprare silicone");
    const titoli = await page.evaluate(() => [...document.querySelectorAll("#taskListUser .module-title")].map((x) => x.textContent));
    verifica("Impegni: scorri e elimina «Comprare silicone» (nel Cestino)", wt > 60 && !titoli.includes("Comprare silicone") && await cestinato("tasks", "t2"), JSON.stringify({ wt, titoli }));

    // 4. Entrate e pagamenti
    await page.evaluate(() => { navigateTo("entrate"); renderIncomes(); });
    await pulisci();
    const wi = await elimina("#incomeList", "Mario Rossi");
    verifica("Entrate: scorri e elimina (nel Cestino)", wi > 60 && await page.evaluate(() => !incomes.length) && await cestinato("incomes", "i1"), String(wi));
    await page.evaluate(() => { navigateTo("pagamenti"); renderPayments(); });
    await pulisci();
    const wp = await elimina("#paymentsList", "Edil Forniture");
    verifica("Pagamenti: scorri e elimina (nel Cestino)", wp > 60 && await page.evaluate(() => !payments.length) && await cestinato("payments", "p1"), String(wp));

    // 5. Documenti dell'impresa
    await page.evaluate(() => { navigateTo("documenti-impresa"); renderCantiereDocumenti(); });
    await pulisci();
    const wd = await elimina("#cantiereDocumentiLista", "DURC 2026");
    verifica("Documenti dell'impresa: scorri e elimina (nel Cestino)", wd > 60 && await page.evaluate(() => !cantiereDocumenti.length) && await cestinato("cantiere_documenti", "d1"), String(wd));

    // 6. Scheda cliente: appunti e impegni
    await page.evaluate(() => { navigateTo("home"); mostraSchedaCliente(clients.find((c) => c.id === "c1")); });
    await page.waitForTimeout(400);
    await pulisci();
    const wa = await elimina("#risorsaCorpo", "piastrelle chiare");
    verifica("Scheda cliente: l'appunto si elimina scorrendo (nel Cestino)", wa > 60 && await page.evaluate(() => !cantiereAppunti.length) && await cestinato("cantiere_appunti", "a1"), String(wa));
    await pulisci();
    const wim = await elimina("#risorsaCorpo", "Sopralluogo Mario Rossi");
    verifica("Scheda cliente: l'impegno si elimina scorrendo (nel Cestino)", wim > 60 && await page.evaluate(() => !tasks.some((t) => t.id === "t1")) && await cestinato("tasks", "t1"), String(wim));
    await page.evaluate(() => chiudiRisorsaCard());

    // 7. Urgenze
    await page.evaluate(() => apriUrgenze());
    await page.waitForTimeout(300);
    await pulisci();
    const wu = await elimina("#risorsaCorpo", "Perdita da Anna Bianchi");
    verifica("Urgenze: scorri e elimina (nel Cestino)", wu > 60 && await cestinato("tasks", "t3"), String(wu));
    await page.evaluate(() => chiudiRisorsaCard());

    // 8. Assemblee (amministratore)
    await page.evaluate(async () => {
      await applyProfession("amministratore", true);
      assemblee.length = 0; assemblee.push({ id: "as1", condominio: "Condominio Le Rose", tipo: "ordinaria", stato: "da_convocare", quando: null });
      navigateTo("assemblee"); renderAssemblee();
    });
    await pulisci();
    const was = await elimina("#assembleeList", "Condominio Le Rose");
    verifica("Assemblee: scorri e elimina (nel Cestino)", was > 60 && await page.evaluate(() => !assemblee.length) && await cestinato("assemblee", "as1"), String(was));

    // L'accenno c'è stato una volta sola
    verifica("l'accenno non si ripete (segnato sul telefono)", await page.evaluate(() => scorriAccennato === true && localStorage.getItem("eon-scorri-accennato") === "1"));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
