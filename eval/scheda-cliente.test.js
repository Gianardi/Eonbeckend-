/* Test della scheda del cliente (26/09/2026, Gianardi: "dico il nome di un
   cliente e deve aprirmi subito la card, e da lì fare tutto").
   Il nome da solo apre la scheda senza AI, da Home e da Clienti; una
   frase con altro dentro, o un nome di più clienti, va all'AI come prima.
   Nella scheda: chiama/WhatsApp/email/messaggio, foto con la fotocamera,
   appunti del cliente salvati senza AI, domande a EON su quel cliente.
   Un cliente creato dall'AI apre la sua scheda (con Foto in evidenza se
   la frase parlava di una foto). Supabase e AI finti.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/scheda-cliente.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8987;
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
      window.__scritture = [];
      const catena = (tabella) => {
        const q = {
          update: (patch) => ({ eq: async (col, val) => { window.__scritture.push({ tabella, tipo: "update", patch, id: val }); return { error: null }; } }),
          insert: (riga) => ({ select: () => ({ single: async () => { window.__scritture.push({ tabella, tipo: "insert", riga }); return { data: { id: tabella + "-nuova-" + window.__scritture.length, created_at: new Date().toISOString(), ...riga }, error: null }; } }) }),
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q,
          single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://file.test/" + p } }) }) },
        auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) },
      }) };
    });
    let rispostaAI = { testo: "Ok.", azioni: [] };
    const richiesteAI = [];
    await page.route("https://eonbeckend.vercel.app/api?action=assistant", (route) => {
      richiesteAI.push(JSON.parse(route.request().postData()).messaggio);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rispostaAI) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });

    const prepara = () => page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      loadUserDataFromDB = async () => {};
      loadChatsFromDB = async () => {};
      window.__scritture.length = 0;
      clients.length = 0;
      clients.push(
        { id: "c1", name: "Rita Ambrosini", status: "attivo", value: 4200, desc: "Rifacimento bagno", last: "", phone: "333 123 4567", email: "rita@esempio.it", archived: false },
        { id: "c2", name: "Steve Robs", status: "attivo", value: 0, desc: "", last: "", phone: "", email: "", archived: false },
        { id: "c3", name: "Mario Rossi", status: "attivo", value: 0, desc: "", last: "", phone: "", archived: false },
        { id: "c4", name: "Luca Rossi", status: "attivo", value: 0, desc: "", last: "", phone: "", archived: false },
      );
      cantiereAppunti.length = 0;
      cantiereAppunti.push({ id: "a1", testo: "Chiavi dal portinaio", created: new Date().toISOString(), clientId: "c1" }, { id: "a2", testo: "Appunto generico", created: new Date().toISOString(), clientId: null });
      chiudiRisorsaCard();
      navigateTo("home");
    });
    const scrivi = async (campo, invia, testo) => { await page.fill(campo, testo); await page.click(invia); await page.waitForTimeout(350); };
    const schedaAperta = () => page.evaluate(() => document.getElementById("risorsaOverlay").style.display === "flex" && !!document.querySelector("#risorsaCorpo .scheda-cliente") ? document.getElementById("risorsaTitolo").textContent : null);

    /* ---- Il nome apre la scheda, senza AI ---- */
    await prepara();
    richiesteAI.length = 0;
    await scrivi("#homeHeroCampo", "#homeHeroSend", "Rita Ambrosini");
    verifica("Home: \"Rita Ambrosini\" apre subito la sua scheda, senza AI", (await schedaAperta()) === "Rita Ambrosini" && richiesteAI.length === 0, JSON.stringify({ t: await schedaAperta(), ai: richiesteAI.length }));
    const contenuto = await page.evaluate(() => ({
      tel: document.querySelector('[data-contatto="Chiama"]').getAttribute("href"),
      wa: document.querySelector('[data-contatto="WhatsApp"]').getAttribute("href"),
      mail: document.querySelector('[data-contatto="Email"]').getAttribute("href"),
      lavoro: document.querySelector(".sc-lavoro").textContent,
      appunti: [...document.querySelectorAll(".sc-riga-testo")].map((e) => e.textContent),
    }));
    verifica("contatti pronti: chiama, WhatsApp, email", contenuto.tel === "tel:+393331234567" && contenuto.wa === "https://wa.me/393331234567" && contenuto.mail === "mailto:rita@esempio.it", JSON.stringify(contenuto));
    verifica("stato lavori e appunti SOLO di questo cliente", contenuto.lavoro === "Rifacimento bagno" && contenuto.appunti.includes("Chiavi dal portinaio") && !contenuto.appunti.includes("Appunto generico"), JSON.stringify(contenuto));

    await prepara();
    richiesteAI.length = 0;
    await page.evaluate(() => navigateTo("clienti"));
    await scrivi("#clientiHeroCampo", "#clientiHeroSend", "Steve Robs");
    verifica("Clienti: \"Steve Robs\" apre la scheda (niente più \"esiste già in anagrafica\")", (await schedaAperta()) === "Steve Robs" && richiesteAI.length === 0);
    await prepara();
    await scrivi("#homeHeroCampo", "#homeHeroSend", "apri ambrosini");
    verifica("\"apri ambrosini\" (solo cognome) apre la scheda", (await schedaAperta()) === "Rita Ambrosini");

    /* ---- Quando NON deve aprirla ---- */
    await prepara();
    richiesteAI.length = 0;
    await scrivi("#homeHeroCampo", "#homeHeroSend", "Rita Ambrosini domani alle 9 sopralluogo");
    verifica("con altro nella frase (orario, lavoro) decide l'AI", !(await schedaAperta()) && richiesteAI.length === 1);
    await prepara();
    richiesteAI.length = 0;
    await scrivi("#homeHeroCampo", "#homeHeroSend", "Rossi");
    verifica("\"Rossi\" con due clienti Rossi: niente scelta a caso, decide l'AI", !(await schedaAperta()) && richiesteAI.length === 1);

    /* ---- Dalla lista clienti ---- */
    await prepara();
    await page.evaluate(() => { navigateTo("clienti"); renderClientArchive(); });
    await page.evaluate(() => [...document.querySelectorAll("#clientArchiveList .client-archive-card, .client-archive-card")].find((c) => c.textContent.includes("Rita Ambrosini")).querySelector(".row-name").click());
    verifica("tocco sulla card in Clienti: si apre la scheda", (await schedaAperta()) === "Rita Ambrosini");

    /* ---- Azioni nella scheda ---- */
    await prepara();
    await scrivi("#homeHeroCampo", "#homeHeroSend", "Steve Robs");
    await page.click('[data-contatto="Chiama"]');
    verifica("senza telefono, \"Chiama\" apre la scheda di modifica sul telefono", await page.evaluate(() => document.activeElement && document.activeElement.dataset.field === "phone" || !!document.querySelector('#sheetBody [data-field="phone"]')));
    await page.evaluate(() => closeSheet && closeSheet());

    await prepara();
    await scrivi("#homeHeroCampo", "#homeHeroSend", "Rita Ambrosini");
    const [scelta] = await Promise.all([page.waitForEvent("filechooser", { timeout: 2000 }).catch(() => null), page.click('.sc-azione[data-azione="foto"]')]);
    verifica("\"Scatta foto\" apre la fotocamera (input con capture)", !!scelta && (await page.getAttribute("#schedaClienteFotoInput", "capture")) === "environment");
    if (scelta) await scelta.setFiles({ name: "cantiere.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
    await page.waitForTimeout(400);
    const fotoCollegata = await page.evaluate(() => window.__scritture.some((s) => s.tabella === "cantiere_foto" && s.tipo === "update" && s.patch.client_id === "c1"));
    verifica("la foto scattata finisce nel cliente giusto", fotoCollegata, JSON.stringify(await page.evaluate(() => window.__scritture)));

    await prepara();
    richiesteAI.length = 0;
    await scrivi("#homeHeroCampo", "#homeHeroSend", "Rita Ambrosini");
    await page.click('.sc-azione[data-azione="appunto"]');
    await page.fill("#schedaClienteCampo", "Portare il silicone bianco");
    await page.press("#schedaClienteCampo", "Enter");
    await page.waitForTimeout(300);
    const appunto = await page.evaluate(() => ({ s: window.__scritture.find((x) => x.tabella === "cantiere_appunti"), righe: [...document.querySelectorAll(".sc-riga-testo")].map((e) => e.textContent) }));
    verifica("Appunto: salvato col cliente, senza AI, e compare nella scheda", appunto.s && appunto.s.riga.client_id === "c1" && appunto.s.riga.testo === "Portare il silicone bianco" && appunto.righe.includes("Portare il silicone bianco") && richiesteAI.length === 0, JSON.stringify(appunto));

    await prepara();
    richiesteAI.length = 0;
    rispostaAI = { testo: "", azioni: [{ tool: "crea_impegno", esito: { id: "t9", titolo: "Sopralluogo Ambrosini", tipo: "da_fare", quando_visualizzato: "domani 9:00" } }] };
    await scrivi("#homeHeroCampo", "#homeHeroSend", "Rita Ambrosini");
    await page.fill("#schedaClienteCampo", "domani alle 9 sopralluogo");
    await page.press("#schedaClienteCampo", "Enter");
    await page.waitForTimeout(500);
    const eon = await page.evaluate(() => [...document.querySelectorAll(".scheda-bolla.eon")].map((b) => b.textContent));
    verifica("Chiedi a EON: la richiesta parte col nome del cliente e la risposta resta nella scheda", richiesteAI.length === 1 && /Rita Ambrosini/.test(richiesteAI[0]) && eon.some((t) => /Ok, segnato domani ore 09:00/.test(t)) && (await schedaAperta()) === "Rita Ambrosini", JSON.stringify({ richiesteAI, eon }));

    /* ---- Cliente creato dall'AI ---- */
    await prepara();
    rispostaAI = { testo: "", azioni: [{ tool: "crea_cliente", esito: { id: "c-nuovo", nome: "Pinco Gianardi" } }] };
    await page.evaluate(() => { dbSelectById = async () => ({ id: "c-nuovo", name: "Pinco Gianardi", status: "attivo", value: 0, description: "", phone: "" }); });
    await scrivi("#homeHeroCampo", "#homeHeroSend", "fammi la foto al cantiere e crea il cliente pinco gianardi");
    await page.waitForTimeout(300);
    const creato = await page.evaluate(() => ({ t: document.getElementById("risorsaTitolo").textContent, foto: !!document.querySelector('.sc-azione[data-azione="foto"].evidenziata'), bolla: (document.querySelector(".scheda-bolla.eon") || {}).textContent }));
    verifica("\"fammi la foto... e crea il cliente\": si apre la sua scheda con Foto in evidenza", creato.t === "Pinco Gianardi" && creato.foto && /Scatta foto/.test(creato.bolla || ""), JSON.stringify(creato));

    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
