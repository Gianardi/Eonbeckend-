/* Test dell'aggiornamento automatico dell'app (25/09/2026): quando si
   torna su EON e index.html sul server è cambiata, la pagina si ricarica
   da sola — ma mai con del testo scritto a metà. Carica la vera
   index.html da un server locale e simula una nuova versione cambiando la
   data del file (il server risponde con Last-Modified, come Vercel con
   ETag).

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/aggiornamento.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 8969;
const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "index.html");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

async function main() {
  const originale = fs.statSync(FILE);
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => { window.supabase = { createClient: () => ({ from: () => ({}), auth: {} }) }; });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => firmaVersione !== null, null, { timeout: 5000 });
    await page.evaluate(() => { window.__ricariche = 0; ricaricaApp = () => { window.__ricariche++; }; });

    const torna = () => page.evaluate(async () => {
      ultimoControlloVersione = 0;
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 500));
      return window.__ricariche;
    });

    verifica("stessa versione: nessuna ricarica", (await torna()) === 0);

    // Nuova versione sul server (data del file cambiata).
    const futuro = new Date(Date.now() + 3600 * 1000);
    fs.utimesSync(FILE, futuro, futuro);

    // Con del testo scritto a metà nel campo della Home: si aspetta.
    const campo = await page.evaluate(() => {
      const c = [...document.querySelectorAll("textarea, input[type=text], input:not([type])")].find((x) => x.offsetParent !== null);
      if (c) c.value = "mi appunti compr";
      return !!c;
    });
    verifica("(c'è un campo di testo visibile per la prova)", campo);
    verifica("nuova versione ma testo a metà: NON ricarica", (await torna()) === 0);

    await page.evaluate(() => { document.querySelectorAll("textarea, input[type=text], input:not([type])").forEach((c) => { c.value = ""; }); });
    verifica("nuova versione e campi vuoti: ricarica da sola", (await torna()) === 1);

    // Controllo al massimo ogni 30 secondi (niente raffiche di richieste).
    const raffica = await page.evaluate(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 300));
      return window.__ricariche;
    });
    verifica("un secondo ritorno subito dopo non rifà il controllo", raffica === 1, raffica);
  } finally {
    fs.utimesSync(FILE, originale.atime, originale.mtime);
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} verifiche FALLITE.` : "\nTutte le verifiche passate.");
  if (fallimenti) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
