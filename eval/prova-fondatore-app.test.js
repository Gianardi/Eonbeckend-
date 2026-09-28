/* "Prova come…" e sezioni dei mestieri (28/09/2026), nel browser vero con
   Supabase finto. Andrea: "io con la mia email devo poter vedere tutto per
   le simulazioni; un cliente che si registra come edile vede solo le
   sezioni edile e nient'altro, come le grandi app".
   - cliente normale: niente "Prova come…", le sezioni degli altri mestieri
     (Assemblee, Cartello fine lavori) non si aprono né col tocco né a voce;
   - fondatore (il server risponde admin:true): "Prova come…" in
     Impostazioni, striscia "Modalità prova", l'AI riceve il mestiere di
     prova, "Torna al tuo account"; il profilo non si tocca mai.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/prova-fondatore-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9001;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

async function apri(browser, { admin, professione }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errori = [];
  page.on("pageerror", (e) => errori.push(e.message));
  await page.addInitScript((cfg) => {
    window.__scritture = [];
    const sessione = { access_token: "t", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "u1", email: "a@b.it" } };
    const catena = (tabella) => {
      const q = {
        select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
        update: (patch) => ({ eq: async () => { window.__scritture.push({ tabella, patch }); return { error: null }; } }),
        insert: (riga) => ({ select: () => ({ single: async () => ({ data: { id: "n1", ...riga }, error: null }), then: (ok) => ok({ data: [], error: null }) }) }),
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: tabella === "profiles" ? { id: "u1", full_name: "Andrea Gianardi", business_name: "", profession: cfg.professione, termini_versione: "1.0" } : null, error: null }),
        then: (ok) => ok({ data: [], error: null }),
      };
      return q;
    };
    window.supabase = { createClient: () => ({
      from: catena,
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      storage: { from: () => ({}) },
      auth: { getSession: async () => ({ data: { session: sessione } }), onAuthStateChange: () => ({}), refreshSession: async () => ({ data: { session: sessione } }) },
    }) };
  }, { professione });
  const assistente = [];
  await page.route("**/api?action=admin_stato", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(admin ? { admin: true, errori_nuovi: 0 } : { admin: false }) }));
  await page.route("**/api?action=assistant", (route) => { assistente.push(JSON.parse(route.request().postData() || "{}")); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }); });
  await page.route("**/api?action=uso_codice", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  return { page, errori, assistente };
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    /* ---- Cliente normale, registrato come edile ---- */
    const c = await apri(browser, { admin: false, professione: "edile" });
    const cliente = await c.page.evaluate(() => {
      const r = {};
      r.mestiere = currentProfession;
      navigateTo("impostazioni");
      r.voceProva = document.getElementById("impVoceProva").hidden && getComputedStyle(document.getElementById("impVoceProva")).display === "none";
      navigateTo("home");
      r.striscia = document.getElementById("provaBanner").hidden;
      navigateTo("assemblee"); r.assembleeTocco = paginaAttuale;
      navigateTo("home"); r.assembleeVoce = provaNavigazioneDiretta("apri le assemblee"); r.dopoVoce = paginaAttuale;
      navigateTo("home"); r.cartello = provaNavigazioneDiretta("apri il cartello fine lavori") && paginaAttuale === "crea-cartello";
      navigateTo("cantiere-documenti");
      r.cartelloVisibile = getComputedStyle(document.querySelector('#page-cantiere-documenti [data-page="crea-cartello"]')).display !== "none";
      navigateTo("home");
      return r;
    });
    verifica("cliente edile: nessuna voce \"Prova come…\" e nessuna striscia", cliente.mestiere === "edile" && cliente.voceProva && cliente.striscia, JSON.stringify(cliente));
    verifica("cliente edile: Assemblee (dell'amministratore) non si apre, né col tocco né a voce", cliente.assembleeTocco === "home" && !cliente.assembleeVoce && cliente.dopoVoce === "home", JSON.stringify(cliente));
    verifica("cliente edile: il suo Cartello fine lavori c'è e si apre", cliente.cartello && cliente.cartelloVisibile, JSON.stringify(cliente));
    const entraForzato = await c.page.evaluate(async () => { await entraInProva("idraulico"); return { mestiere: currentProfession, striscia: document.getElementById("provaBanner").hidden }; });
    verifica("cliente normale: anche chiamando la prova a mano non cambia niente", entraForzato.mestiere === "edile" && entraForzato.striscia, JSON.stringify(entraForzato));
    verifica("cliente normale: nessun errore nella pagina", c.errori.length === 0, JSON.stringify(c.errori));
    await c.page.close();

    /* ---- Cliente idraulico: niente cartello, niente assemblee ---- */
    const i = await apri(browser, { admin: false, professione: "idraulico" });
    const idraulico = await i.page.evaluate(() => {
      navigateTo("cantiere-documenti");
      const visibile = getComputedStyle(document.querySelector('#page-cantiere-documenti [data-page="crea-cartello"]')).display !== "none";
      navigateTo("crea-cartello");
      return { visibile, pagina: paginaAttuale, voce: provaNavigazioneDiretta("apri il cartello fine lavori") };
    });
    verifica("cliente idraulico: il Cartello fine lavori (dell'edile) non c'è e non si apre", !idraulico.visibile && idraulico.pagina === "home" && !idraulico.voce, JSON.stringify(idraulico));
    await i.page.close();

    /* ---- Fondatore ---- */
    const f = await apri(browser, { admin: true, professione: "artigiano" });
    const prima = await f.page.evaluate(() => { navigateTo("impostazioni"); const r = { mestiere: currentProfession, voce: !document.getElementById("impVoceProva").hidden && getComputedStyle(document.getElementById("impVoceProva")).display !== "none" }; navigateTo("home"); return r; });
    verifica("fondatore: in Impostazioni c'è \"Prova come…\"", prima.mestiere === "artigiano" && prima.voce, JSON.stringify(prima));
    await f.page.evaluate(() => navigateTo("impostazioni"));
    await f.page.click("#impVoceProva");
    const scelte = await f.page.evaluate(() => [...document.querySelectorAll("#provaComeCards .ob-card .ob-card-title")].map((t) => t.textContent));
    verifica("\"Prova come…\": Edile, Idraulico, Elettricista, Amministratore, Altra attività", scelte.join() === "Edile,Idraulico,Elettricista,Amministratore,Altra attività", scelte.join());
    await f.page.click('#provaComeCards .ob-card[data-profession="idraulico"]');
    await f.page.waitForTimeout(200);
    const inProva = await f.page.evaluate(() => ({
      mestiere: currentProfession, classe: document.body.classList.contains("mestiere-idraulico"),
      striscia: !document.getElementById("provaBanner").hidden && document.getElementById("provaBannerTesto").textContent,
      carta: document.querySelector("#homeCarteMestiere .cantiere-card-title").textContent,
      profilo: window.__scritture.filter((w) => w.tabella === "profiles").length,
    }));
    verifica("fondatore in prova come idraulico: app dell'idraulico + striscia \"Modalità prova: Idraulico\"", inProva.mestiere === "idraulico" && inProva.classe && inProva.striscia === "Modalità prova: Idraulico" && inProva.carta === "Interventi", JSON.stringify(inProva));
    verifica("in prova il profilo nel database non si tocca", inProva.profilo === 0, String(inProva.profilo));
    await f.page.evaluate(async () => { try { await chiediAssistente("come va il lavoro questo mese"); } catch (e) {} });
    verifica("in prova l'AI riceve il mestiere di prova", f.assistente.length > 0 && f.assistente[f.assistente.length - 1].prova_professione === "idraulico", JSON.stringify(f.assistente.map((a) => a.prova_professione)));
    const amm = await f.page.evaluate(async () => { await entraInProva("amministratore"); navigateTo("home"); return provaNavigazioneDiretta("apri le assemblee") && paginaAttuale === "assemblee"; });
    verifica("in prova come amministratore le Assemblee si aprono", amm);
    await f.page.click("#provaEsci");
    await f.page.waitForTimeout(200);
    const dopo = await f.page.evaluate(() => ({ mestiere: currentProfession, striscia: document.getElementById("provaBanner").hidden, cartelle: !document.getElementById("cartelleGriglia").hidden }));
    verifica("\"Torna al tuo account\": di nuovo Altra attività, striscia sparita", dopo.mestiere === "artigiano" && dopo.striscia && dopo.cartelle, JSON.stringify(dopo));
    f.assistente.length = 0;
    await f.page.evaluate(async () => { try { await chiediAssistente("come va il lavoro questo mese"); } catch (e) {} });
    verifica("fuori dalla prova l'AI non riceve nessun mestiere di prova", f.assistente.length > 0 && !("prova_professione" in f.assistente[0]), JSON.stringify(f.assistente[0] || {}));
    verifica("fondatore: nessun errore nella pagina", f.errori.length === 0, JSON.stringify(f.errori));
    await f.page.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
