/* Test del formato dei documenti (25/09/2026): la finestra "Come vuoi le
   tue fatture?", la galleria dei 4 modelli di EON, la proposta del
   modello a partire dalla foto di una fattura dell'utente (colore e
   disposizione letti dal server), il salvataggio (modello + colore, senza
   sovrascrivere i dati già salvati) e il PDF che usa formato e
   intestazione. Carica la vera index.html con Supabase e server finti.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/formato.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8974;
const ROOT = path.resolve(__dirname, "..");
// PNG 1x1 valido, per il campo "foto"
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
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
    await page.addInitScript(() => {
      window.__salvati = [];
      window.supabase = {
        createClient: () => ({
          from: (tabella) => ({ upsert: async (riga) => { window.__salvati.push({ tabella, riga }); return { error: null }; } }),
          auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) },
        }),
      };
    });
    let rispostaFoto = { nome_azienda: "Bianchi Costruzioni", indirizzo: "Via Roma 1, Milano", piva: "IT01234567890", telefono: null, email: null, modello: "elegante", colore: "#123456" };
    await page.route("https://eonbeckend.vercel.app/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rispostaFoto) }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      aziendaIntestazione = null;
      localStorage.removeItem("eon_documenti_onboarding_fatto");
    });

    // 1. La finestra al primo accesso a Documenti
    const finestra = await page.evaluate(() => {
      navigateTo("cantiere-documenti");
      const ov = document.getElementById("onboardingDocumentiOverlay");
      return { aperta: ov.style.display === "flex", testo: ov.textContent.replace(/\s+/g, " ") };
    });
    verifica("al primo accesso a Documenti si apre la finestra del formato", finestra.aperta);
    verifica("testo chiaro: foto di una tua fattura, oppure un modello di EON", /Come vuoi le tue fatture\?/.test(finestra.testo) && /Fai una foto a una tua fattura/.test(finestra.testo) && /Scegli un modello di EON/.test(finestra.testo), finestra.testo);

    // 2. Galleria dei modelli
    const galleria = await page.evaluate(() => {
      document.getElementById("onboardingDocEonBtn").click();
      return {
        finestraChiusa: document.getElementById("onboardingDocumentiOverlay").style.display === "none",
        titolo: document.getElementById("risorsaTitolo").textContent,
        modelli: [...document.querySelectorAll(".galleria-modello")].map((c) => c.querySelector(".galleria-nome").textContent),
        anteprime: [...document.querySelectorAll(".galleria-modello .invoice-preview")].map((p) => p.className),
      };
    });
    verifica("\"Scegli un modello di EON\" apre la galleria", galleria.finestraChiusa && galleria.titolo === "Scegli il modello", JSON.stringify(galleria));
    verifica("4 modelli con la loro anteprima: Classico, Moderno, Essenziale, Elegante", JSON.stringify(galleria.modelli) === JSON.stringify(["Classico", "Moderno", "Essenziale", "Elegante"]) && galleria.anteprime.every((c, i) => c.includes("modello-" + ["classico", "moderno", "essenziale", "elegante"][i])), JSON.stringify(galleria));

    // 3. Scelta e salvataggio
    const scelta = await page.evaluate(async () => {
      document.querySelector('.galleria-modello[data-modello="moderno"]').click();
      const titolo = document.getElementById("risorsaTitolo").textContent;
      const grande = document.querySelector("#risorsaCorpo .invoice-preview").className;
      [...document.querySelectorAll("#risorsaCorpo button")].find((b) => b.textContent === "Usa questo modello").click();
      await new Promise((r) => setTimeout(r, 200));
      const dopo = costruisciAnteprimaDocumento({ tipo: "fattura", numero: "8/2026", data: "", cliente: "X", voci: [], imponibile: 0, iva: 0, totale: 0 });
      return { titolo, grande, salvati: window.__salvati.slice(), memoria: aziendaIntestazione, chiusa: document.getElementById("risorsaOverlay").style.display === "none", anteprimaDopo: dopo.className, coloreDopo: dopo.style.getPropertyValue("--doc-acc"), fatto: localStorage.getItem("eon_documenti_onboarding_fatto") };
    });
    verifica("tocco su Moderno: anteprima grande del modello", scelta.titolo === "Modello Moderno" && /modello-moderno/.test(scelta.grande), JSON.stringify(scelta));
    verifica("\"Usa questo modello\" salva modello e colore", scelta.salvati.length === 1 && scelta.salvati[0].tabella === "azienda_intestazione" && scelta.salvati[0].riga.modello === "moderno" && scelta.salvati[0].riga.colore === "#0F766E", JSON.stringify(scelta.salvati));
    verifica("da ora fatture e preventivi escono con quel modello", /modello-moderno/.test(scelta.anteprimaDopo) && scelta.coloreDopo === "#0F766E" && scelta.chiusa, JSON.stringify(scelta));
    verifica("la finestra del primo accesso non torna più", scelta.fatto === "1");

    // 4. Dalla foto di una fattura: proposta del modello più vicino con i suoi colori
    await page.evaluate(() => { window.__salvati.length = 0; aziendaIntestazione = { nome_azienda: "Nome Già Salvato", indirizzo: "", piva: "", telefono: "", email: "", logo_url: null, modello: "moderno", colore: "#0F766E" }; navigateTo("carta-intestata"); });
    await page.setInputFiles("#formatoFotoInput", { name: "fattura.png", mimeType: "image/png", buffer: PNG });
    await page.waitForFunction(() => document.getElementById("risorsaTitolo").textContent === "Il tuo formato", null, { timeout: 5000 });
    const proposta = await page.evaluate(() => {
      const ant = document.querySelector("#risorsaCorpo .invoice-preview");
      return { classe: ant.className, colore: ant.style.getPropertyValue("--doc-acc"), testo: ant.textContent };
    });
    verifica("dalla foto: proposto il modello più vicino (Elegante) con il colore della fattura", /modello-elegante/.test(proposta.classe) && proposta.colore === "#123456", JSON.stringify(proposta));
    verifica("la proposta mostra i dati letti (indirizzo, P.IVA) e il nome già salvato", /Nome Già Salvato/.test(proposta.testo) && /Via Roma 1, Milano/.test(proposta.testo) && /P\.IVA IT01234567890/.test(proposta.testo), proposta.testo);

    const altri = await page.evaluate(() => {
      [...document.querySelectorAll("#risorsaCorpo button")].find((b) => /altro modello/.test(b.textContent)).click();
      return {
        consigliato: [...document.querySelectorAll(".galleria-modello")].filter((c) => c.querySelector(".galleria-nota")).map((c) => c.dataset.modello),
        colori: [...document.querySelectorAll(".galleria-modello .invoice-preview")].map((p) => p.style.getPropertyValue("--doc-acc")),
      };
    });
    verifica("\"prova un altro modello\": tutti con i colori della fattura, Elegante indicato come il più simile", JSON.stringify(altri.consigliato) === '["elegante"]' && altri.colori.every((c) => c === "#123456"), JSON.stringify(altri));

    const salvataggio = await page.evaluate(async () => {
      document.querySelector('.galleria-modello[data-modello="classico"]').click();
      [...document.querySelectorAll("#risorsaCorpo button")].find((b) => b.textContent === "Usa questo modello").click();
      await new Promise((r) => setTimeout(r, 200));
      return window.__salvati.slice();
    });
    verifica("scelto Classico con il colore della foto: salvati modello e colore", salvataggio.length === 1 && salvataggio[0].riga.modello === "classico" && salvataggio[0].riga.colore === "#123456", JSON.stringify(salvataggio));
    verifica("...e anche i dati letti dalla foto nei campi vuoti", salvataggio[0] && salvataggio[0].riga.indirizzo === "Via Roma 1, Milano" && !("nome_azienda" in salvataggio[0].riga), JSON.stringify(salvataggio));

    // "Va bene, usa questo" dalla proposta: dati letti solo nei campi vuoti
    await page.evaluate(() => { window.__salvati.length = 0; aziendaIntestazione = { nome_azienda: "Nome Già Salvato", indirizzo: "", piva: "", telefono: "", email: "", logo_url: null, modello: "moderno", colore: "#0F766E" }; });
    await page.setInputFiles("#formatoFotoInput", { name: "fattura.png", mimeType: "image/png", buffer: PNG });
    await page.waitForFunction(() => document.getElementById("risorsaTitolo").textContent === "Il tuo formato", null, { timeout: 5000 });
    const conferma = await page.evaluate(async () => {
      [...document.querySelectorAll("#risorsaCorpo button")].find((b) => b.textContent === "Va bene, usa questo").click();
      await new Promise((r) => setTimeout(r, 200));
      return { riga: window.__salvati[0] && window.__salvati[0].riga, memoria: aziendaIntestazione, formatoTesto: document.getElementById("formatoAttualeTesto").textContent };
    });
    verifica("\"Va bene\": salva Elegante, colore, indirizzo e P.IVA letti", conferma.riga && conferma.riga.modello === "elegante" && conferma.riga.colore === "#123456" && conferma.riga.indirizzo === "Via Roma 1, Milano" && conferma.riga.piva === "IT01234567890", JSON.stringify(conferma.riga));
    verifica("il nome già salvato NON viene sovrascritto da quello letto nella foto", conferma.riga && !("nome_azienda" in conferma.riga) && conferma.memoria.nome_azienda === "Nome Già Salvato", JSON.stringify(conferma));
    verifica("la Carta intestata mostra il modello attuale", /Elegante/.test(conferma.formatoTesto), conferma.formatoTesto);

    // 5. PDF con formato e intestazione, testo mai come HTML
    const pdf = await page.evaluate(() => {
      let scritto = "";
      window.open = () => ({ document: { write: (h) => { scritto = h; }, close() {} } });
      apriPdfDocumento({ tipo: "fattura", numero: "8/2026", data: "25/09/2026", cliente: "<script>alert(1)</script>Rossi", professionista: "Marco", voci: [{ desc: "Porte <b>", qta: 1, prezzo: 100 }], imponibile: 100, aliquota: 22, iva: 22, totale: 122, condizioni: "30 giorni", note: "" });
      return scritto;
    });
    verifica("PDF: colore e stile del modello scelto", /--acc:#123456/.test(pdf) && /3px double var\(--acc\)/.test(pdf), pdf.slice(0, 200));
    verifica("PDF: intestazione dell'azienda (non più E·O·N)", /Nome Già Salvato/.test(pdf) && /Via Roma 1, Milano/.test(pdf) && !/E·O·N/.test(pdf));
    verifica("PDF: testo di clienti/voci mai interpretato come HTML", !/<script>alert/.test(pdf) && /&lt;script&gt;/.test(pdf) && /Porte &lt;b&gt;/.test(pdf));

    // 6. Foto illeggibile: messaggio chiaro, niente salvato
    rispostaFoto = null;
    await page.unroute("https://eonbeckend.vercel.app/**");
    await page.route("https://eonbeckend.vercel.app/**", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Non sono riuscita a leggere i dati dalla foto" }) }));
    await page.evaluate(() => { window.__salvati.length = 0; chiudiRisorsaCard(); });
    await page.setInputFiles("#formatoFotoInput", { name: "fattura.png", mimeType: "image/png", buffer: PNG });
    await page.waitForTimeout(800);
    const errore = await page.evaluate(() => ({ salvati: window.__salvati.length, landing: document.body.innerText.includes("Non sono riuscita a leggerla") }));
    verifica("foto illeggibile: lo dice e non salva niente", errore.salvati === 0 && errore.landing, JSON.stringify(errore));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} verifiche FALLITE.` : "\nTutte le verifiche passate.");
  if (fallimenti) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
