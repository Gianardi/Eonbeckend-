/* Test dell'account "come le app grandi" (25/09/2026): registrazione che
   parte vuota (niente dati finti) con il benvenuto, conferma email,
   password dimenticata, link per la nuova password, elimina account.
   Supabase finto; ogni scenario ricarica la pagina con uno stato diverso.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/account.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8986;
const ROOT = path.resolve(__dirname, "..");
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
    page.on("dialog", (d) => d.accept());
    await page.addInitScript(() => {
      const cfg = JSON.parse(sessionStorage.getItem("cfg") || "{}");
      window.__chiamate = [];
      const reg = (x) => { window.__chiamate.push(x); sessionStorage.setItem("chiamate", JSON.stringify(JSON.parse(sessionStorage.getItem("chiamate") || "[]").concat([x]))); };
      const sessione = { access_token: "t", user: { id: "u1", email: "nuovo@esempio.it" } };
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, order: () => q, limit: () => q, in: () => q, eq: () => q,
          update: (patch) => ({ eq: async () => { reg({ tabella, update: patch }); return { error: null }; } }),
          insert: (righe) => { reg({ tabella, insert: righe }); return { select: () => ({ single: async () => ({ data: {}, error: null }), then: (ok) => ok({ data: [], error: null }) }) }; },
          single: async () => ({ data: tabella === "profiles" && cfg.sessione ? { id: "u1", full_name: "Mario Bianchi", business_name: "", profession: "edile" } : null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      let ascoltatore = null;
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        auth: {
          getSession: async () => ({ data: { session: cfg.sessione ? sessione : null } }),
          onAuthStateChange: (cb) => { ascoltatore = cb; if (cfg.recupero) setTimeout(() => cb("PASSWORD_RECOVERY", sessione), 50); return {}; },
          signUp: async (x) => { reg({ signUp: x }); return { data: { user: { id: "u1" }, session: cfg.confermaEmail ? null : sessione }, error: null }; },
          signInWithPassword: async () => ({ data: { session: sessione, user: sessione.user }, error: null }),
          resend: async (x) => { reg({ resend: x }); return { error: null }; },
          resetPasswordForEmail: async (email, opz) => { reg({ reset: email, opz }); return { error: null }; },
          updateUser: async (x) => { reg({ updateUser: x }); return { error: null }; },
          signOut: async () => { reg({ signOut: true }); sessionStorage.setItem("cfg", "{}"); return { error: null }; },
        },
      }) };
    });
    const apri = async (cfg, hash = "") => {
      await page.goto(`http://localhost:${PORT}/index.html`);
      await page.evaluate((c) => { sessionStorage.setItem("cfg", JSON.stringify(c)); sessionStorage.setItem("chiamate", "[]"); }, cfg);
      await page.goto(`http://localhost:${PORT}/index.html?r=${Date.now()}${hash}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
    };
    const foto = async (nome, intera) => { if (process.env.SCREEN_DIR) { await page.waitForTimeout(400); await page.screenshot({ path: path.join(process.env.SCREEN_DIR, nome + ".png"), fullPage: !!intera }); } };
    const chiamate = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("chiamate") || "[]"));
    const registrati = async () => {
      await page.click('#obTypeCards .ob-card[data-type="professioni"]');
      await page.click("#obType0ContinueBtn");
      await page.click('#obProfessionCards .ob-card[data-profession="edile"]');
      await page.click("#obContinueBtn");
      await page.fill("#obName", "Mario Bianchi");
      await page.fill("#obBusinessName", "Bianchi Costruzioni");
      await page.fill("#obEmail", "nuovo@esempio.it");
    };

    await apri({});
    await foto("1-inizio");
    // 1. Registrazione: password corta rifiutata, poi account nuovo VUOTO + benvenuto
    await apri({});
    await registrati();
    await page.fill("#obPassword", "corta");
    await page.click("#obFinishBtn");
    verifica("password sotto gli 8 caratteri: spiegato, nessuna registrazione", /almeno 8/.test(await page.textContent("#obAuthError")) && !(await chiamate()).some((c) => c.signUp));
    await page.fill("#obPassword", "passwordLunga1");
    await page.click("#obFinishBtn");
    await page.waitForTimeout(500);
    const c1 = await chiamate();
    const su = c1.find((c) => c.signUp);
    verifica("registrazione con nome attività e professione nei dati dell'account", su && su.signUp.options.data.business_name === "Bianchi Costruzioni" && su.signUp.options.data.profession === "edile" && /index\.html$/.test(su.signUp.options.emailRedirectTo), JSON.stringify(su));
    const inserimenti = c1.filter((c) => c.insert).map((c) => c.tabella);
    verifica("account nuovo vuoto: nessun cliente, pagamento o impegno finto", inserimenti.length === 0, JSON.stringify(inserimenti));
    const benv = await page.evaluate(() => ({ dentro: document.getElementById("onboardingScreen").classList.contains("hidden"), titolo: document.getElementById("risorsaTitolo").textContent, aperta: document.getElementById("risorsaOverlay").style.display }));
    await foto("2-benvenuto");
    verifica("dentro subito, con la card \"Benvenuto in EON\"", benv.dentro && benv.titolo === "Benvenuto in EON" && benv.aperta === "flex", JSON.stringify(benv));

    // 2. Conferma email attiva: niente sessione → "Controlla la tua email", rimanda
    await apri({ confermaEmail: true });
    await registrati();
    await page.fill("#obPassword", "passwordLunga1");
    await page.click("#obFinishBtn");
    await page.waitForTimeout(300);
    const ce = await page.evaluate(() => ({ box: document.getElementById("obControllaEmail").style.display, email: document.getElementById("obControllaEmailIndirizzo").textContent, fuori: !document.getElementById("onboardingScreen").classList.contains("hidden") }));
    verifica("conferma email attiva: \"Controlla la tua email\" con l'indirizzo, si resta fuori", ce.box === "flex" && ce.email === "nuovo@esempio.it" && ce.fuori, JSON.stringify(ce));
    await foto("3-controlla-email");
    await page.click("#obRimandaEmail");
    await page.waitForTimeout(150);
    verifica("\"Rimandala\": email rimandata", (await chiamate()).some((c) => c.resend && c.resend.email === "nuovo@esempio.it") && /rimandata/.test(await page.textContent("#obRimandaEmail")));
    await page.click("#obHoConfermato");
    verifica("\"Ho confermato: accedi\" → modulo di accesso", await page.evaluate(() => document.getElementById("obTabLogin").classList.contains("active") && document.querySelector("#obStep2 .ob-form").style.display === ""));

    // 3. Password dimenticata
    await apri({});
    await page.click("#obVaiAccedi");
    verifica("in accesso c'è \"Password dimenticata?\"", await page.isVisible("#obPasswordDimenticata"));
    await page.click("#obPasswordDimenticata");
    verifica("senza email: chiede di scriverla", /Scrivi qui sopra la tua email/.test(await page.textContent("#obAuthInfo")));
    await page.fill("#obEmail", "andrea@esempio.it");
    await page.click("#obPasswordDimenticata");
    await page.waitForTimeout(150);
    await foto("4-password-dimenticata");
    const rs = (await chiamate()).find((c) => c.reset);
    verifica("con email: link mandato, messaggio che non rivela se l'account esiste", rs && rs.reset === "andrea@esempio.it" && /index\.html$/.test(rs.opz.redirectTo) && /Se c'è un account/.test(await page.textContent("#obAuthInfo")), JSON.stringify(rs));

    // 3b. Accesso da iPhone: campi riconosciuti per il portachiavi (Face ID), Invio = Accedi
    const campi = await page.evaluate(() => ({ form: !!document.getElementById("obEmail").closest("form"), email: document.getElementById("obEmail").autocomplete, pw: document.getElementById("obPassword").autocomplete }));
    verifica("login dentro un form vero, email = username e password = current-password (Face ID del portachiavi)", campi.form && campi.email === "username" && campi.pw === "current-password", JSON.stringify(campi));
    await page.fill("#obPassword", "passwordLunga1");
    await page.press("#obPassword", "Enter");
    await page.waitForTimeout(500);
    verifica("Invio sulla tastiera = Accedi", await page.evaluate(() => document.getElementById("onboardingScreen").classList.contains("hidden")));

    // 4. Dal link dell'email: scegli una nuova password
    await apri({ sessione: true, recupero: true }, "#access_token=x&type=recovery");
    await page.waitForFunction(() => document.getElementById("risorsaTitolo").textContent === "Scegli una nuova password" && document.getElementById("risorsaOverlay").style.display === "flex", null, { timeout: 3000 });
    await foto("5-nuova-password");
    await page.fill("#recPassword", "nuovaPassword9");
    await page.click("#recSalva");
    await page.waitForTimeout(150);
    verifica("link \"nuova password\": si sceglie e si salva", (await chiamate()).some((c) => c.updateUser && c.updateUser.password === "nuovaPassword9") && (await page.evaluate(() => document.getElementById("risorsaOverlay").style.display)) === "none");

    // 5. Elimina account
    await apri({ sessione: true });
    let richiestaElimina = null;
    await page.route("https://eonbeckend.vercel.app/api?action=elimina_account", (route) => { richiestaElimina = JSON.parse(route.request().postData()); route.fulfill({ status: 200, contentType: "application/json", body: '{"eliminato":true}' }); });
    await page.evaluate(() => navigateTo("impostazioni"));
    await foto("6-impostazioni", true);
    await page.click("#impVoceElimina");
    verifica("Elimina: il pulsante resta spento finché non scrivi ELIMINA", await page.isDisabled("#impEliminaAccount"));
    await page.fill("#impCampoElimina", "elimina");
    await foto("7-elimina");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.click("#impEliminaAccount")]);
    await page.waitForTimeout(300);
    const dopo = await page.evaluate(() => ({ fuori: !document.getElementById("onboardingScreen").classList.contains("hidden") }));
    verifica("eliminato: chiamato il server con la conferma, poi fuori alla schermata iniziale", richiestaElimina && richiestaElimina.conferma === "ELIMINA" && dopo.fuori, JSON.stringify({ richiestaElimina, dopo }));
    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
