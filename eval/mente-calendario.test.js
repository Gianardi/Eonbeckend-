/* La Mente, le cartelle per tutti e il calendario vivo (28/09/2026), nel
   browser vero con Supabase finto. Andrea:
   - "ogni cosa che dico deve segnarla negli appunti, salvo le funzioni di
     EON" → "Devo chiamare Fini Alessio", "controllare PAC totali" vanno
     nella Mente col codice, senza AI;
   - "aggiungi cartella EON" crea la cartella (non un cliente), per tutti i
     mestieri; "aggiungi in EON queste foto" salva le foto nella cartella;
   - "alle 19:08 mi mostra gli appuntamenti dalle 8: non ha senso" → la Home
     mostra solo quello che deve ancora succedere, poi domani.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/mente-calendario.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9004;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

async function apri(browser, ora) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errori = [];
  page.on("pageerror", (e) => errori.push(e.message));
  if (ora) await page.clock.install({ time: ora });
  await page.addInitScript(() => {
    window.__scritture = [];
    const catena = (tabella) => {
      const q = {
        select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
        update: (patch) => ({ eq: async (c, v) => { window.__scritture.push({ tipo: "update", tabella, id: v, patch }); return { error: null }; } }),
        insert: (riga) => {
          window.__scritture.push({ tipo: "insert", tabella, riga });
          const r = { id: tabella + window.__scritture.length, created_at: new Date().toISOString(), ...riga };
          return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) };
        },
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        then: (ok) => ok({ data: [], error: null }),
      };
      return q;
    };
    window.supabase = { createClient: () => ({
      from: catena,
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://file.test/" + p } }) }) },
      auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) },
    }) };
  });
  let ai = 0;
  await page.route("**/api?action=assistant", (route) => { ai++; route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }); });
  await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.getElementById("onboardingScreen").style.display = "none";
    currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
    loadUserDataFromDB = async () => {};
    descriviFoto = () => {};
  });
  return { page, errori, ai: () => ai };
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const { page, errori, ai } = await apri(browser);
    const scrivi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; window.__scritture.length = 0; });
      const prima = ai();
      await page.fill("#homeHeroCampo", frase);
      await page.click("#homeHeroSend", { force: true });
      await page.waitForTimeout(250);
      return page.evaluate((usata) => ({
        ai: usata,
        appunti: window.__scritture.filter((w) => w.tipo === "insert" && w.tabella === "cantiere_appunti").map((w) => [w.riga.testo, !!w.riga.da_fare]),
        cartelle: window.__scritture.filter((w) => w.tipo === "insert" && w.tabella === "cartelle").map((w) => w.riga.nome),
        clienti: window.__scritture.filter((w) => w.tipo === "insert" && w.tabella === "clients").length,
        avviso: document.getElementById("aiToastContainer").innerText.replace(/\s+/g, " ").trim(),
      }), ai() - prima);
    };
    await page.evaluate(async () => { await applyProfession("edile", true); cantiereAppunti.length = 0; renderCantiereAppunti(); });

    /* ---- Tutto nella Mente ---- */
    const pensieri = [
      ["Devo chiamare Fini Alessio", "Chiamare Fini Alessio", true],
      ["controllare assicurazioni infortunio", "Controllare assicurazioni infortunio", true],
      ["controllare PAC totali", "Controllare PAC totali", true],
      ["il furgone fa un rumore strano", "Il furgone fa un rumore strano", false],
    ];
    const sbagliati = [];
    for (const [frase, testo, daFare] of pensieri) {
      const r = await scrivi(frase);
      if (r.ai !== 0 || r.appunti.length !== 1 || r.appunti[0][0] !== testo || r.appunti[0][1] !== daFare || !/^In Mente/.test(r.avviso)) sbagliati.push(frase + " → " + JSON.stringify(r));
    }
    verifica("pensieri nella Mente col codice (\"Devo chiamare Fini Alessio\" → da fare; \"il furgone fa un rumore strano\" → nota), senza AI", sbagliati.length === 0, sbagliati.join(" | "));

    const nonPensieri = [];
    for (const frase of ["fammi un preventivo per Rossi di 300 euro", "devo chiamare Fini domani alle 10", "e quelle di ieri", "mi aiuti con il capitolato"]) {
      const r = await scrivi(frase);
      if (r.appunti.length) nonPensieri.push(frase + " → " + JSON.stringify(r.appunti));
    }
    verifica("comandi, impegni con l'ora, seguiti di discorso e richieste NON finiscono nella Mente", nonPensieri.length === 0, nonPensieri.join(" | "));

    const mente = await page.evaluate(() => {
      navigateTo("home");
      const tasto = document.querySelector("#homeAppuntiBtn b").textContent;
      provaNavigazioneDiretta("apri la mente");
      return { tasto, titolo: document.getElementById("risorsaTitolo").textContent, campo: document.getElementById("apCampo").placeholder };
    });
    verifica("il tasto si chiama \"Mente\" e \"apri la mente\" apre la card", mente.tasto === "Mente" && mente.titolo === "Mente" && mente.campo === "Cosa hai in testa?", JSON.stringify(mente));

    /* ---- Cartelle per tutti ---- */
    const cartella = await scrivi("aggiungi cartella EON");
    const inHome = await page.evaluate(() => ({ nomi: [...document.querySelectorAll("#cartelleGriglia .cartella b")].map((b) => b.textContent), carteMestiere: getComputedStyle(document.getElementById("homeCarteMestiere")).display !== "none" }));
    verifica("edile: \"aggiungi cartella EON\" crea la cartella EON (nessun cliente, nessuna AI), sotto le card del mestiere", cartella.ai === 0 && cartella.clienti === 0 && cartella.cartelle.join() === "EON" && inHome.nomi.join() === "EON" && inHome.carteMestiere, JSON.stringify({ cartella, inHome }));
    const nota = await scrivi("segna in EON di rinnovare il dominio");
    verifica("\"segna in EON di rinnovare il dominio\" → da fare nella cartella", nota.ai === 0 && nota.appunti.length === 1 && nota.appunti[0][0] === "Rinnovare il dominio", JSON.stringify(nota));

    /* ---- Foto nella cartella ---- */
    await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); window.__scritture.length = 0; window.__scatti = 0; document.getElementById("fotoRapidaInput").click = () => { window.__scatti++; }; });
    await page.fill("#homeHeroCampo", "aggiungi in EON queste foto");
    await page.click("#homeHeroSend", { force: true });
    await page.waitForTimeout(150);
    const scatto = await page.evaluate(() => ({ scatti: window.__scatti, cartella: fotoRapidaDaSalvare && fotoRapidaDaSalvare.cartellaId, id: cartelle[0].id }));
    await page.setInputFiles("#fotoRapidaInput", { name: "tetto.png", mimeType: "image/png", buffer: PNG });
    await page.waitForTimeout(500);
    const foto = await page.evaluate(() => ({
      scritta: window.__scritture.filter((w) => w.tipo === "insert" && w.tabella === "cantiere_foto").map((w) => w.riga.cartella_id),
      titolo: document.getElementById("risorsaTitolo").textContent,
      miniature: document.querySelectorAll("#apFoto img").length,
      sotto: document.querySelector("#cartelleGriglia .cartella small").textContent,
      id: cartelle[0].id,
    }));
    verifica("\"aggiungi in EON queste foto\": fotocamera, foto salvata nella cartella, la cartella si riapre con la miniatura", scatto.scatti === 1 && scatto.cartella === scatto.id && foto.scritta.length === 1 && foto.scritta[0] === foto.id && foto.titolo === "EON" && foto.miniature === 1 && /1 foto/.test(foto.sotto), JSON.stringify({ scatto, foto }));
    const tasto = await page.evaluate(() => { window.__scatti = 0; document.querySelector('.ap-azioni button[data-az="foto"]').click(); return window.__scatti; });
    verifica("nella cartella c'è \"Aggiungi foto\"", tasto === 1, String(tasto));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
    await page.close();

    /* ---- Calendario vivo, alle 19:08 ---- */
    const oggi = new Date(); const alle = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 19, 8);
    const sera = await apri(browser, alle);
    const conDomani = await sera.page.evaluate(async () => {
      await applyProfession("edile", true);
      chats.length = 0; // niente appuntamenti dei dati di esempio
      tasks.length = 0;
      tasks.push({ id: "t1", title: "Sopralluogo Rossi", status: "todo", time: "Oggi, 08:00" }, { id: "t2", title: "Chiamare Bianchi", status: "todo", time: "Oggi, 11:30" }, { id: "t3", title: "Getto solaio Verdi", status: "todo", time: "Domani, 07:30" });
      renderCalendar(); navigateTo("home");
      const r = {
        titolo: document.querySelector("#homeHeroOggiBox .home-box-testa b").textContent,
        righe: [...document.querySelectorAll("#homeHeroOggiLista .home-hero-oggi-riga")].map((x) => x.textContent.replace(/\s+/g, " ").trim()),
        riga: (document.querySelector("#homeHeroOggiLista .home-oggi-finito") || {}).textContent,
        pillola: document.getElementById("homeOggiConta").textContent,
      };
      navigateTo("calendario");
      r.passati = (document.querySelector(".cal-passati-riga") || {}).textContent;
      r.passatiChiusi = document.querySelector(".cal-passati-lista").hidden;
      r.finito = (document.querySelector(".cal-finito") || {}).textContent;
      navigateTo("home");
      return r;
    });
    verifica("alle 19:08, impegni finiti alle 8 e alle 11:30: la Home dice \"Per oggi hai finito\" e mostra domani", conDomani.titolo === "Domani" && conDomani.riga === "Per oggi hai finito." && conDomani.righe.length === 1 && /07:30\s*Getto solaio Verdi/.test(conDomani.righe[0]) && conDomani.pillola === "Domani 1 impegno", JSON.stringify(conDomani));
    verifica("in Calendario i passati di oggi sono in una riga chiusa, con la frase di fine giornata", conDomani.passati === "2 già passati oggi" && conDomani.passatiChiusi && /Per oggi hai finito/.test(conDomani.finito || ""), JSON.stringify(conDomani));
    const conStasera = await sera.page.evaluate(() => {
      tasks.push({ id: "t4", title: "Cena con Giulia", status: "todo", time: "Oggi, 20:30" });
      renderCalendar();
      return {
        titolo: document.querySelector("#homeHeroOggiBox .home-box-testa b").textContent,
        righe: [...document.querySelectorAll("#homeHeroOggiLista .home-hero-oggi-riga")].map((x) => x.textContent.replace(/\s+/g, " ").trim()),
        riga: (document.querySelector("#homeHeroOggiLista .home-oggi-finito") || {}).textContent,
        pillola: document.getElementById("homeOggiConta").textContent,
      };
    });
    verifica("con un impegno ancora stasera: solo quello, e \"2 già passati oggi\"", conStasera.titolo === "Oggi" && conStasera.righe.length === 1 && /20:30\s*Cena con Giulia/.test(conStasera.righe[0]) && conStasera.riga === "2 già passati oggi" && conStasera.pillola === "1 impegno", JSON.stringify(conStasera));
    const libero = await sera.page.evaluate(() => {
      tasks.length = 0; renderCalendar();
      return { titolo: document.querySelector("#homeHeroOggiBox .home-box-testa b").textContent, testo: document.getElementById("homeHeroOggiLista").textContent, pillola: document.getElementById("homeOggiConta").textContent };
    });
    verifica("serata libera e niente domani: \"stacca la testa\"", libero.titolo === "Oggi" && /Stacca la testa/.test(libero.testo) && libero.pillola === "Nessun impegno", JSON.stringify(libero));
    verifica("calendario: nessun errore nella pagina", sera.errori.length === 0, JSON.stringify(sera.errori));
    await sera.page.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
