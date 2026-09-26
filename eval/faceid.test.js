/* Accesso con Face ID, dall'inizio alla fine (27/09/2026). Chrome ha un
   "Face ID virtuale" (autenticatore WebAuthn di prova): crea chiavi e firme
   vere. Le richieste dell'app vanno al VERO codice del server (api/index.js),
   con Supabase Auth e database finti.
   1. accesso con la password → EON propone "Entra con Face ID la prossima volta?"
   2. "Attiva Face ID" → la chiave pubblica finisce nel database
   3. esco e riapro: EON va dritto su "Accedi", con "Entra con Face ID"
   4. tocco → la firma del telefono viene verificata → sono dentro, senza password
   Più: Impostazioni → Face ID (attivo / disattiva), e con la rete lenta
   all'apertura si entra lo stesso con il profilo salvato sul telefono.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/faceid.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8995;
const ORIGINE = `http://localhost:${PORT}`;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

/* ---- Il server vero, con Supabase finto ---- */
process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";
process.env.PASSKEY_ORIGINI = ORIGINE;
const UTENTE = { id: "11111111-1111-4111-8111-111111111111", email: "andrea@esempio.it" };
const passkeys = [];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const h = init.headers || {};
  if (u.pathname === "/auth/v1/user") return (h.Authorization || "") === "Bearer tok" || (h.Authorization || "") === "Bearer acc-nuovo" ? json(UTENTE) : json({ msg: "no" }, 401);
  if (u.pathname.startsWith("/auth/v1/admin/users/")) return json({ id: UTENTE.id, email: UTENTE.email });
  if (u.pathname === "/auth/v1/admin/generate_link") return json({ hashed_token: "hash" });
  if (u.pathname === "/auth/v1/verify") return json({ access_token: "acc-nuovo", refresh_token: "ref-nuovo" });
  if (u.pathname === "/rest/v1/passkeys") {
    const metodo = init.method || "GET";
    const filtri = [...u.searchParams.entries()].filter(([k]) => !["select", "limit", "order"].includes(k));
    const va = (r) => filtri.every(([k, v]) => v.startsWith("eq.") ? String(r[k]) === decodeURIComponent(v.slice(3)) : true);
    if (metodo === "GET") return json(passkeys.filter(va));
    if (metodo === "POST") { passkeys.push({ id: "pk" + passkeys.length, contatore: 0, ...JSON.parse(init.body) }); return json([], 201); }
    if (metodo === "PATCH") { passkeys.filter(va).forEach((r) => Object.assign(r, JSON.parse(init.body))); return json([]); }
    if (metodo === "DELETE") { for (let i = passkeys.length - 1; i >= 0; i--) if (va(passkeys[i])) passkeys.splice(i, 1); return json([]); }
  }
  if (u.pathname.startsWith("/rest/v1/")) return json([]);
  throw new Error("fetch non prevista: " + url);
};

async function main() {
  const { default: handler } = await import(path.join(ROOT, "api", "index.js"));
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    // Face ID virtuale
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });

    // Supabase finto nel browser: la sessione sopravvive al ricaricamento (come quella vera)
    await page.addInitScript(() => {
      const leggi = () => { try { return JSON.parse(localStorage.getItem("__sessione") || "null"); } catch (e) { return null; } };
      window.__profiloLento = localStorage.getItem("__profiloLento") === "1";
      const catena = (tabella) => { const q = {
        select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q,
        update: () => ({ eq: async () => ({ error: null }) }),
        single: async () => (tabella === "profiles" && !window.__profiloLento ? { data: { id: "11111111-1111-4111-8111-111111111111", full_name: "Andrea Gianardi", business_name: "", profession: "edile" }, error: null } : { data: null, error: { message: "rete lenta" } }),
        then: (ok) => ok({ data: [], error: null }) }; return q; };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), auth: {
        getSession: async () => ({ data: { session: leggi() } }),
        onAuthStateChange: () => ({}),
        signInWithPassword: async () => { const s = { access_token: "tok", refresh_token: "r", user: { id: "11111111-1111-4111-8111-111111111111", email: "andrea@esempio.it" } }; localStorage.setItem("__sessione", JSON.stringify(s)); return { data: { session: s, user: s.user }, error: null }; },
        setSession: async ({ access_token, refresh_token }) => { const s = { access_token, refresh_token, user: { id: "11111111-1111-4111-8111-111111111111", email: "andrea@esempio.it" } }; localStorage.setItem("__sessione", JSON.stringify(s)); localStorage.setItem("__setSession", access_token); return { data: { session: s }, error: null }; },
        signOut: async () => { localStorage.removeItem("__sessione"); return { error: null }; },
      } }) };
    });
    // Le richieste dell'app vanno al VERO handler del server
    const azioni = [];
    await page.route("https://eonbeckend.vercel.app/api?action=*", async (route) => {
      const rq = route.request();
      const url = new URL(rq.url());
      azioni.push(url.searchParams.get("action"));
      const headers = { origin: ORIGINE, "user-agent": "Test", "x-forwarded-for": "9.9.9.9" };
      if (rq.headers().authorization) headers.authorization = rq.headers().authorization;
      const req = { method: rq.method(), url: url.pathname + url.search, headers, body: rq.postData() ? JSON.parse(rq.postData()) : (rq.method() === "POST" ? {} : undefined) };
      let uscita = "", stato = 0;
      await handler(req, { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; stato = this.statusCode; } });
      route.fulfill({ status: stato || 200, contentType: "application/json", body: uscita || "{}" });
    });
    await page.goto(`${ORIGINE}/index.html`, { waitUntil: "networkidle" });

    /* 1 — accesso con la password */
    await page.click("#obVaiAccedi");
    await page.waitForTimeout(300);
    verifica("schermata Accedi: c'è \"Entra con Face ID\" (il telefono lo supporta)", await page.isVisible("#obFaceIdBtn"));
    await page.fill("#obEmail", "andrea@esempio.it");
    await page.fill("#obPassword", "password-giusta");
    await page.click("#obFinishBtn");
    await page.waitForTimeout(1500);
    const proposta = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, aperta: document.getElementById("risorsaOverlay").style.display === "flex" }));
    verifica("dopo la password: \"Entra con Face ID\" la prossima volta?", proposta.aperta && proposta.titolo === "Entra con Face ID", JSON.stringify(proposta));

    /* 2 — attivo Face ID */
    await page.click("#faceIdSi");
    await page.waitForTimeout(1000);
    verifica("Attiva Face ID: chiave vera salvata nel database, per Andrea", passkeys.length === 1 && passkeys[0].user_id === UTENTE.id && passkeys[0].alg === -7 && passkeys[0].public_key.length > 50, JSON.stringify(passkeys.map((p) => ({ u: p.user_id, alg: p.alg }))));
    verifica("e avviso \"Face ID attivo\"", /Face ID attivo/.test(await page.textContent("#aiToastContainer")));

    /* Impostazioni → Face ID attivo */
    await page.evaluate(() => navigateTo("impostazioni"));
    await page.waitForTimeout(300);
    verifica("Impostazioni: voce Face ID \"Attivo su questo telefono\"", (await page.isVisible("#impVoceFaceId")) && (await page.textContent("#impFaceIdSotto")) === "Attivo su questo telefono");

    /* 3 — esco e riapro */
    await page.evaluate(() => { localStorage.removeItem("__sessione"); });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    verifica("riaperta senza accesso: dritto su \"Accedi\" con \"Entra con Face ID\"", (await page.isVisible("#obStep2")) && (await page.isVisible("#obFaceIdBtn")));

    /* 4 — entro con Face ID */
    azioni.length = 0;
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}), page.click("#obFaceIdBtn")]);
    await page.waitForTimeout(1200);
    const dentro = await page.evaluate(() => ({ sessione: localStorage.getItem("__setSession"), onboarding: document.getElementById("onboardingScreen").classList.contains("hidden") }));
    verifica("Face ID: firma verificata dal server vero, sessione aperta, sono dentro", azioni.includes("passkey_accedi") && dentro.sessione === "acc-nuovo" && dentro.onboarding, JSON.stringify({ azioni, dentro }));
    verifica("ultimo uso della chiave registrato", !!passkeys[0].ultimo_uso);

    /* Rete lenta all'apertura: accesso valido ma profilo non arrivato → si entra lo stesso */
    await page.evaluate(() => localStorage.setItem("__profiloLento", "1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    verifica("rete lenta all'apertura: entra lo stesso con il profilo salvato (niente schermata di accesso)", await page.evaluate(() => document.getElementById("onboardingScreen").classList.contains("hidden") && /Andrea/.test(document.getElementById("homeSaluto") ? document.getElementById("homeSaluto").textContent : "Andrea")));
    await page.evaluate(() => localStorage.removeItem("__profiloLento"));

    /* Impostazioni → Disattiva */
    await page.evaluate(() => { navigateTo("impostazioni"); document.getElementById("impVoceFaceId").click(); });
    await page.waitForTimeout(300);
    await page.click("#impFaceIdDisattiva");
    await page.waitForTimeout(600);
    verifica("Disattiva Face ID: chiavi tolte dal database e dal telefono", passkeys.length === 0 && (await page.evaluate(() => localStorage.getItem("eon-passkey"))) === null);

    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
