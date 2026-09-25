/* Test del rinnovo della sessione (25/09/2026). Bug reale: dopo circa
   un'ora l'app mandava al backend il "pass" di accesso scaduto e l'AI
   rispondeva "Sessione non valida o scaduta (token is expired)" — perché
   currentSession veniva impostata solo al login/all'avvio. Qui si carica
   la vera index.html con una libreria Supabase finta e si controlla quale
   token parte davvero verso il backend.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/sessione.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8968;
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
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.__sessione = { access_token: "vecchio-scaduto" };
      window.__getSessionRompe = false;
      window.supabase = {
        createClient: () => ({
          from: () => ({}),
          auth: {
            onAuthStateChange: (cb) => { window.__cambioSessione = cb; return { data: { subscription: { unsubscribe() {} } } }; },
            getSession: async () => {
              if (window.__getSessionRompe) throw new Error("rete assente");
              return { data: { session: window.__sessione } };
            },
          },
        }),
      };
    });
    const tokenInviati = [];
    await page.route("https://eonbeckend.vercel.app/**", (route) => {
      tokenInviati.push(route.request().headers()["authorization"]);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stato: "concluso", testo: "ok", azioni: [] }) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });

    // Situazione del bug: l'app ha in memoria il pass del login, Supabase l'ha già rinnovato.
    await page.evaluate(async () => {
      currentSession = { access_token: "vecchio-scaduto" };
      window.__sessione = { access_token: "rinnovato" };
      await chiediAssistente("prova");
    });
    verifica("al backend parte il pass rinnovato, non quello del login", tokenInviati.at(-1) === "Bearer rinnovato", tokenInviati.at(-1));

    // Supabase avvisa di un rinnovo: l'app lo segue.
    const dopoAvviso = await page.evaluate(() => { window.__cambioSessione("TOKEN_REFRESHED", { access_token: "terzo" }); return currentSession.access_token; });
    verifica("un rinnovo avvisato da Supabase aggiorna subito la sessione", dopoAvviso === "terzo", dopoAvviso);

    // Senza rete per chiedere la sessione: si usa quella che c'è, niente blocchi.
    await page.evaluate(async () => { window.__getSessionRompe = true; await chiediAssistente("prova"); });
    verifica("se Supabase non risponde, si prova con la sessione che c'è", tokenInviati.at(-1) === "Bearer terzo", tokenInviati.at(-1));

    // Uscita dall'account: niente pass vecchio in giro.
    const dopoUscita = await page.evaluate(() => { window.__cambioSessione("SIGNED_OUT", null); return currentSession; });
    verifica("dopo l'uscita dall'account la sessione è vuota", dopoUscita === null);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} verifiche FALLITE.` : "\nTutte le verifiche passate.");
  if (fallimenti) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
