/* Test di Impostazioni ed Esci (25/09/2026): account e professione (non
   modificabile), profilo, password, uscita che torna alla schermata
   iniziale; e "Hai già un account? Accedi" che non fa scegliere di nuovo
   la professione. Supabase finto.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/impostazioni.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8984;
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
    await page.addInitScript(() => {
      window.__chiamate = [];
      const uscito = () => sessionStorage.getItem("uscito") === "1";
      const sessione = { access_token: "t", user: { id: "u1", email: "andrea@esempio.it" } };
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, order: () => q, limit: () => q, in: () => q,
          eq: () => q,
          update: (patch) => ({ eq: async () => { window.__chiamate.push({ tabella, patch }); return { error: null }; } }),
          single: async () => ({ data: tabella === "profiles" && !uscito() ? { id: "u1", full_name: "Andrea Gianardi", business_name: "Gianardi Costruzioni", profession: "edile" } : null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        auth: {
          getSession: async () => ({ data: { session: uscito() ? null : sessione } }),
          onAuthStateChange: () => ({}),
          signOut: async () => { sessionStorage.setItem("uscito", "1"); window.__chiamate.push({ signOut: true }); return { error: null }; },
          updateUser: async (x) => { window.__chiamate.push({ updateUser: x }); return { error: null }; },
        },
      }) };
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const dentro = await page.evaluate(() => document.getElementById("onboardingScreen").classList.contains("hidden"));
    verifica("con la sessione aperta si entra direttamente", dentro);

    await page.evaluate(() => navigateTo("impostazioni"));
    const acc = await page.evaluate(() => ({
      nome: document.getElementById("impNome").textContent + " · " + document.getElementById("impAttivita").textContent, email: document.getElementById("impEmail").textContent,
      prof: document.getElementById("impProfessione").textContent, campoNome: document.getElementById("impCampoNome").value,
    }));
    verifica("account: nome, attività, email", acc.nome === "Andrea Gianardi · Gianardi Costruzioni" && acc.email === "andrea@esempio.it", JSON.stringify(acc));
    if (process.env.SCREEN_IMPOSTAZIONI) await page.screenshot({ path: process.env.SCREEN_IMPOSTAZIONI, fullPage: true });
    verifica("professione mostrata e non modificabile", acc.prof === "Edile" && !(await page.$("#page-impostazioni select, #cambiaProfessioneCard")), JSON.stringify(acc));

    await page.fill("#impCampoNome", "Andrea G.");
    await page.click("#impSalvaProfilo");
    await page.waitForTimeout(150);
    const salvato = await page.evaluate(() => ({ ult: window.__chiamate.at(-1), esito: document.getElementById("impEsitoProfilo").textContent }));
    verifica("modifica profilo: salvata nel profilo", salvato.ult.tabella === "profiles" && salvato.ult.patch.full_name === "Andrea G." && salvato.esito === "Salvato.", JSON.stringify(salvato));

    await page.fill("#impCampoPassword", "corta");
    await page.click("#impCambiaPassword");
    verifica("password troppo corta: spiegato, nessun cambio", /almeno 8/.test(await page.textContent("#impEsitoPassword")) && !(await page.evaluate(() => window.__chiamate.some((c) => c.updateUser))));
    await page.fill("#impCampoPassword", "unaPasswordLunga1");
    await page.click("#impCambiaPassword");
    await page.waitForTimeout(150);
    verifica("password valida: cambiata", (await page.evaluate(() => window.__chiamate.some((c) => c.updateUser && c.updateUser.password === "unaPasswordLunga1"))) && (await page.textContent("#impEsitoPassword")) === "Password cambiata.");

    // Esci
    let domanda = "";
    page.once("dialog", (d) => { domanda = d.message(); d.accept(); });
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.click("#impEsci")]);
    await page.waitForTimeout(300);
    const fuori = await page.evaluate(() => ({ onboarding: !document.getElementById("onboardingScreen").classList.contains("hidden"), passo0: document.getElementById("obStep0").classList.contains("visible") }));
    verifica("Esci: chiede conferma, chiude la sessione e torna alla schermata iniziale", /uscire/.test(domanda) && fuori.onboarding && fuori.passo0, JSON.stringify({ domanda, fuori }));

    // Hai già un account? Accedi
    await page.click("#obVaiAccedi");
    const accedi = await page.evaluate(() => ({ passo2: document.getElementById("obStep2").classList.contains("visible"), login: document.getElementById("obTabLogin").classList.contains("active"), nome: document.getElementById("obNameRow").style.display }));
    verifica("\"Hai già un account? Accedi\": dritto a email e password, senza scegliere la professione", accedi.passo2 && accedi.login && accedi.nome === "none", JSON.stringify(accedi));
    await page.click("#obBackBtn");
    verifica("Indietro torna alla prima schermata", await page.evaluate(() => document.getElementById("obStep0").classList.contains("visible")));
    await page.click("#obVaiAccedi");
    await page.click("#obTabSignup");
    verifica("da lì \"Crea account\": prima si sceglie il lavoro", await page.evaluate(() => document.getElementById("obStep0").classList.contains("visible") && !document.getElementById("obStep2").classList.contains("visible")));
    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
