/* Test documenti dell'impresa e card (26/09/2026, Gianardi: "se chiedo il
   DURC deve darmelo cercandolo direttamente, come per fatture e
   preventivi; lo stesso per carta intestata e tutte le card" e "il
   caricamento dovrebbe essere immediato").
   Documento per nome → si apre senza AI; card per nome → si apre la
   pagina; nome che non corrisponde → decide l'AI. Il documento caricato
   compare subito in elenco; le foto si alleggeriscono prima di salire.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/documenti-impresa.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8988;
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
      window.__caricati = [];
      window.__sblocca = null; // il caricamento finto resta in attesa finché il test non lo sblocca
      const catena = (tabella) => {
        const q = {
          update: () => ({ eq: async () => ({ error: null }) }),
          insert: (riga) => ({ select: () => ({ single: async () => ({ data: { id: tabella + "-" + Math.random().toString(36).slice(2), created_at: new Date().toISOString(), ...riga }, error: null }) }) }),
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q,
          single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({
          upload: async (percorso, file) => { window.__caricati.push({ percorso, tipo: file.type, dimensione: file.size, originale: file.__originale || null }); if (window.__attendi) await new Promise((ok) => { window.__sblocca = ok; }); return { error: null }; },
          getPublicUrl: (p) => ({ data: { publicUrl: "https://file.test/" + p } }),
        }) },
        auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) },
      }) };
    });
    let richiesteAI = 0;
    await page.route("https://eonbeckend.vercel.app/api?action=assistant", (route) => { richiesteAI++; route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }); });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });

    const prepara = () => page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      loadUserDataFromDB = async () => {};
      cantiereDocumenti.length = 0;
      cantiereDocumenti.push(
        { id: "d1", url: "https://file.test/DURC_2026.pdf", nome: "DURC_2026.pdf", tipo: "application/pdf", created: "2026-09-01T10:00:00Z" },
        { id: "d2", url: "https://file.test/visura.pdf", nome: "Visura camerale.pdf", tipo: "application/pdf", created: "2026-09-02T10:00:00Z" },
        { id: "d3", url: "https://file.test/ass.jpg", nome: "Assicurazione RC.jpg", tipo: "image/jpeg", created: "2026-09-03T10:00:00Z" },
        { id: "d4", url: "https://file.test/ass2.pdf", nome: "Assicurazione furgone.pdf", tipo: "application/pdf", created: "2026-09-04T10:00:00Z" },
      );
      chiudiRisorsaCard();
      navigateTo("home");
    });
    const chiedi = async (testo) => { await page.fill("#homeHeroCampo", testo); await page.click("#homeHeroSend"); await page.waitForTimeout(300); };
    const stato = () => page.evaluate(() => ({ card: document.getElementById("risorsaOverlay").style.display === "flex" ? document.getElementById("risorsaTitolo").textContent : null, pagina: paginaAttuale, voci: [...document.querySelectorAll("#risorsaCorpo .risorsa-voce-titolo")].map((e) => e.textContent) }));

    await prepara(); richiesteAI = 0;
    await chiedi("Mi dai il DURC");
    let s = await stato();
    verifica("\"Mi dai il DURC\": si apre il documento, senza AI", s.card === "DURC 2026" && richiesteAI === 0, JSON.stringify(s));
    await prepara(); richiesteAI = 0;
    await chiedi("dammi la visura");
    s = await stato();
    verifica("\"dammi la visura\" → Visura camerale", s.card === "Visura camerale" && richiesteAI === 0, JSON.stringify(s));
    await prepara(); richiesteAI = 0;
    await chiedi("mi serve il documento dell'assicurazione");
    s = await stato();
    verifica("due assicurazioni: elenco con entrambe, senza AI", s.card === "Documenti" && s.voci.length === 2 && richiesteAI === 0, JSON.stringify(s));
    await prepara(); richiesteAI = 0;
    await chiedi("mi dai l'assicurazione del furgone");
    s = await stato();
    verifica("\"l'assicurazione del furgone\" → proprio quella", s.card === "Assicurazione furgone" && richiesteAI === 0, JSON.stringify(s));
    await prepara(); richiesteAI = 0;
    await chiedi("mi dai il permesso di costruire");
    s = await stato();
    verifica("documento che non c'è: decide l'AI come prima", s.card === "Mi dai il permesso di costruire" && richiesteAI === 1, JSON.stringify(s));
    await prepara(); richiesteAI = 0;
    await chiedi("fammi un documento per il DURC");
    verifica("una richiesta di FARE qualcosa non si intercetta", richiesteAI === 1);

    for (const [frase, pagina] of [["mi dai la carta intestata", "carta-intestata"], ["apri la lettera", "crea-lettera"], ["apri il cartello fine lavori", "crea-cartello"], ["mostrami gli appunti", "cantiere-appunti"], ["apri le foto", "cantiere-foto"], ["dammi i documenti dell'impresa", "documenti-impresa"]]) {
      await prepara(); richiesteAI = 0;
      await chiedi(frase);
      s = await stato();
      verifica(`"${frase}" apre la card giusta, senza AI`, s.pagina === pagina && richiesteAI === 0, JSON.stringify(s));
    }

    /* ---- Caricamento immediato ---- */
    await prepara();
    await page.evaluate(() => { navigateTo("documenti-impresa"); renderCantiereDocumenti(); window.__attendi = true; });
    await page.setInputFiles("#cantiereDocumentiInput", { name: "Certificato SOA.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 finto") });
    await page.waitForTimeout(150);
    const durante = await page.evaluate(() => [...document.querySelectorAll("#cantiereDocumentiLista .azienda-link-card")].map((c) => c.textContent.trim()));
    verifica("il documento compare subito in elenco, con \"Sto caricando…\"", durante.some((t) => /Certificato SOA\.pdf/.test(t) && /Sto caricando/.test(t)), JSON.stringify(durante));
    await page.evaluate(() => { window.__attendi = false; window.__sblocca && window.__sblocca(); });
    await page.waitForTimeout(250);
    const dopo = await page.evaluate(() => ({ righe: [...document.querySelectorAll("#cantiereDocumentiLista .azienda-link-card")].map((c) => c.textContent.trim()), doc: cantiereDocumenti.find((d) => d.nome === "Certificato SOA.pdf") }));
    verifica("a caricamento finito resta, con il suo link vero", dopo.doc && !dopo.doc.inCaricamento && /^https:\/\/file\.test\//.test(dopo.doc.url) && !dopo.righe.some((t) => /Sto caricando/.test(t)), JSON.stringify(dopo));

    /* ---- Foto più leggere ---- */
    const compressa = await page.evaluate(async () => {
      const c = document.createElement("canvas"); c.width = 3000; c.height = 2000;
      const ctx = c.getContext("2d"); const img = ctx.createImageData(3000, 2000);
      for (let i = 0; i < img.data.length; i += 4) { img.data[i] = (i * 7) % 255; img.data[i + 1] = (i * 13) % 255; img.data[i + 2] = Math.random() * 255; img.data[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
      const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.98));
      const file = new File([blob], "IMG_0001.jpeg", { type: "image/jpeg" });
      const piccola = await comprimiImmagine(file);
      const bmp = await createImageBitmap(piccola);
      const nonImmagine = new File(["abc"], "a.pdf", { type: "application/pdf" });
      return { prima: file.size, dopo: piccola.size, tipo: piccola.type, lato: Math.max(bmp.width, bmp.height), pdfUguale: (await comprimiImmagine(nonImmagine)) === nonImmagine };
    });
    verifica("foto grande: lato 2000 px, JPEG, molto più leggera", compressa.lato === 2000 && compressa.tipo === "image/jpeg" && compressa.dopo < compressa.prima / 2, JSON.stringify(compressa));
    verifica("un PDF non si tocca", compressa.pdfUguale);
    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
