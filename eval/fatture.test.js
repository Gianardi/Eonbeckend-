/* Test della cartella vera "Fatture e preventivi" (25/09/2026): carica la
   vera index.html, mette in memoria alcune conversazioni con documenti
   (stesso formato di loadChatsFromDB) e controlla lista, ordine, filtri,
   totale fatturato, apertura dell'anteprima, aggiornamento dopo una
   correzione, comando a voce "apri le fatture" e che le vecchie pagine
   finte non siano più raggiungibili dal menu Documenti.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/fatture.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8970;
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
    await page.addInitScript(() => { window.supabase = { createClient: () => ({ from: () => ({}), auth: {} }) }; });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.getElementById("onboardingScreen").style.display = "none"; });

    // Documenti veri di prova, nello stesso formato di loadChatsFromDB.
    await page.evaluate(() => {
      const doc = (id, tipo, numero, cliente, totale, creato, desc) => ({
        id, from: "me", eventType: "doc", title: (tipo === "fattura" ? "Fattura" : "Preventivo") + " n. " + numero,
        docDati: { tipo, numero, anno: 2026, data: "25/09/2026", cliente, voci: [{ desc, qta: 1, prezzo: totale / 1.22 }], imponibile: totale / 1.22, aliquota: 22, iva: totale - totale / 1.22, totale },
        docTipo: tipo, docAnno: 2026, createdAt: creato, time: "oggi",
      });
      chats.length = 0;
      chats.push({ id: "c1", name: "Tommaso Greti", messages: [
        doc("d1", "fattura", "8/2026", "Tommaso Greti", 1830, "2026-09-25T08:08:28Z", "fognatura"),
        { id: "m-testo", from: "me", text: "ciao", time: "oggi" },
      ] });
      chats.push({ id: "c2", name: "Raspadori", messages: [
        doc("d2", "preventivo", "10/2026", "Raspadori", 3660, "2026-09-25T08:59:45Z", "pulizia scale"),
      ] });
      chats.push({ id: "c3", name: "Michele soda studio", messages: [
        doc("d3", "fattura", "7/2026", "Michele soda studio", 366, "2026-09-25T07:50:00Z", "pitturazione"),
        { id: "d4", from: "me", eventType: "doc", title: "Vecchio documento senza dati", time: "ieri" }, // riga senza JSON: esclusa
      ] });
    });

    // Dal menu Documenti: una sola voce vera, niente pagine finte.
    const hub = await page.evaluate(() => {
      navigateTo("cantiere-documenti");
      const pagine = [...document.querySelectorAll("#page-cantiere-documenti [data-page]")].map((b) => b.dataset.page);
      return pagine;
    });
    verifica("menu Documenti: c'è \"Fatture e preventivi\"", hub.includes("fatture-preventivi"), JSON.stringify(hub));
    verifica("menu Documenti: niente più le pagine finte Crea Fattura/Crea Preventivo", !hub.includes("crea-fattura") && !hub.includes("crea-preventivo"), JSON.stringify(hub));

    const lista = await page.evaluate(() => {
      document.querySelector('#page-cantiere-documenti [data-page="fatture-preventivi"]').click();
      const righe = [...document.querySelectorAll("#fpLista .doc-list-card")].map((r) => r.textContent.replace(/\s+/g, " ").trim());
      return { visibile: document.getElementById("page-fatture-preventivi").classList.contains("visible"), titolo: document.getElementById("pageTitle").textContent, righe, count: document.getElementById("fpCount").textContent, totale: document.getElementById("fpTotale").textContent };
    });
    verifica("la pagina si apre dal menu", lista.visibile && lista.titolo === "Fatture e preventivi", JSON.stringify(lista));
    verifica("3 documenti veri (esclusi messaggi normali e righe senza dati)", lista.count === "3" && lista.righe.length === 3, JSON.stringify(lista.righe));
    verifica("dal più recente: PV 10/2026, FT 8/2026, FT 7/2026", /PV 10\/2026/.test(lista.righe[0]) && /FT 8\/2026/.test(lista.righe[1]) && /FT 7\/2026/.test(lista.righe[2]), JSON.stringify(lista.righe));
    verifica("ogni riga ha cliente e totale", /Raspadori/.test(lista.righe[0]) && /€3\.660/.test(lista.righe[0]), lista.righe[0]);
    verifica("fatturato dell'anno = solo fatture (1830 + 366)", /Fatturato \d{4}: €2\.196/.test(lista.totale), lista.totale);

    const filtri = await page.evaluate(() => {
      document.querySelector('.fp-filtro[data-f="fattura"]').click();
      const fatture = document.querySelectorAll("#fpLista .doc-list-card").length;
      document.querySelector('.fp-filtro[data-f="preventivo"]').click();
      const preventivi = document.querySelectorAll("#fpLista .doc-list-card").length;
      const totalePreventivi = document.getElementById("fpTotale").textContent;
      document.querySelector('.fp-filtro[data-f="tutti"]').click();
      return { fatture, preventivi, totalePreventivi, tutti: document.querySelectorAll("#fpLista .doc-list-card").length };
    });
    verifica("filtro Fatture: 2", filtri.fatture === 2, filtri.fatture);
    verifica("filtro Preventivi: 1, senza la riga del fatturato", filtri.preventivi === 1 && filtri.totalePreventivi === "", JSON.stringify(filtri));
    verifica("filtro Tutti: 3", filtri.tutti === 3);

    const apertura = await page.evaluate(() => {
      document.querySelectorAll("#fpLista .doc-list-card")[1].click();
      const overlay = document.getElementById("risorsaOverlay");
      return { aperta: overlay.style.display === "flex", titolo: document.getElementById("risorsaTitolo").textContent, corpo: document.getElementById("risorsaCorpo").textContent, modifica: !!document.querySelector("#risorsaCorpo .risorsa-riga-btn") };
    });
    verifica("tocco su una riga: si apre il documento vero", apertura.aperta && apertura.titolo === "Fattura n. 8/2026" && /Tommaso Greti/.test(apertura.corpo) && /fognatura/.test(apertura.corpo), JSON.stringify(apertura));
    verifica("con il tasto Modifica a voce", apertura.modifica);

    const dopoCorrezione = await page.evaluate(() => {
      chiudiRisorsaCard();
      const d = { tipo: "fattura", numero: "8/2026", anno: 2026, data: "25/09/2026", cliente: "Tommaso Greti", voci: [{ desc: "fognatura", qta: 1, prezzo: 1000 }], imponibile: 1000, aliquota: 22, iva: 220, totale: 1220 };
      aggiornaDocumentoInMemoria("d1", d);
      return { riga: document.querySelectorAll("#fpLista .doc-list-card")[1].textContent, totale: document.getElementById("fpTotale").textContent };
    });
    verifica("dopo una correzione la lista mostra subito il totale nuovo", /€1\.220/.test(dopoCorrezione.riga) && /€1\.586/.test(dopoCorrezione.totale), JSON.stringify(dopoCorrezione));

    const voce = await page.evaluate(() => {
      navigateTo("home");
      const r1 = provaNavigazioneDiretta("apri le fatture");
      const f1 = filtroFatturePreventivi, n1 = document.querySelectorAll("#fpLista .doc-list-card").length;
      navigateTo("home");
      const r2 = provaNavigazioneDiretta("mostrami i preventivi");
      const f2 = filtroFatturePreventivi;
      navigateTo("home");
      const r3 = provaNavigazioneDiretta("apri fatture e preventivi");
      const f3 = filtroFatturePreventivi;
      navigateTo("home");
      const r4 = provaNavigazioneDiretta("mostrami il preventivo di Rossi"); // con un nome: resta all'AI
      return { r1, f1, n1, r2, f2, r3, f3, r4 };
    });
    verifica("a voce \"apri le fatture\" → cartella filtrata sulle fatture", voce.r1 && voce.f1 === "fattura" && voce.n1 === 2, JSON.stringify(voce));
    verifica("a voce \"mostrami i preventivi\" → filtrata sui preventivi", voce.r2 && voce.f2 === "preventivo", JSON.stringify(voce));
    verifica("a voce \"apri fatture e preventivi\" → tutti", voce.r3 && voce.f3 === "tutti", JSON.stringify(voce));
    verifica("\"mostrami il preventivo di Rossi\" NON è navigazione (resta all'AI)", voce.r4 === false);

    const vuoto = await page.evaluate(() => {
      chats.length = 0;
      filtroFatturePreventivi = "tutti";
      navigateTo("fatture-preventivi");
      return document.getElementById("fpLista").textContent;
    });
    verifica("senza documenti: spiega come crearli", /Chiedilo a EON/.test(vuoto), vuoto);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} verifiche FALLITE.` : "\nTutte le verifiche passate.");
  if (fallimenti) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
