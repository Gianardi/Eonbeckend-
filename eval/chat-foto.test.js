/* Chat con il cliente (27/09/2026, Gianardi: "è molto lento nell'invio
   foto… non mi torna per chi è… tutto compresso così che non si vede
   bene"). Nel browser vero, con Supabase finto:
   - in una chat lunga i messaggi non si schiacciano (ognuno alto quanto
     il suo testo);
   - la foto parte ridotta (qualche centinaio di KB, non 3-5 MB) e nella
     chat si vede subito la copia già sul telefono;
   - una foto mandata non fa partire l'analisi della chat;
   - una risposta arrivata ad app in secondo piano si recupera alla
     riapertura, e EON la legge una volta sola;
   - come WhatsApp: quello che il server ha già fatto (il cliente ha appena
     scritto) l'app lo mostra una volta, subito o alla riapertura;
   - l'avviso di uno spostamento non ripete il nome del cliente.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/chat-foto.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8992;
const ROOT = path.resolve(__dirname, "..");
const PUB = "https://finto.supabase.co/storage/v1/object/public/eon-files/";
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
    const analisi = [];
    await page.route("https://eonbeckend.vercel.app/api?action=analizza_messaggio", (route) => { analisi.push(JSON.parse(route.request().postData() || "{}")); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ azioni: [] }) }); });
    await page.addInitScript(() => { try { localStorage.setItem("eon-scorri-accennato", "1"); } catch (e) {} }); // niente accenno dello scorrimento: disturberebbe le misure
    await page.addInitScript((PUB) => {
      window.__caricati = []; window.__inseriti = [];
      const catena = (tabella) => {
        const q = {
          update: () => ({ eq: async () => ({ error: null }) }),
          insert: (riga) => {
            window.__inseriti.push({ tabella, riga });
            const salvato = { id: "db" + window.__inseriti.length, created_at: new Date().toISOString(), event_type: null, ...riga };
            return { then: (ok) => ok({ error: null }), select: () => ({ single: async () => ({ data: salvato, error: null }) }) };
          },
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q,
          gt: (col, val) => { window.__dopo = val; return q; },
          then: (ok) => ok({ data: tabella === "messages" ? (window.__persi || []) : [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on(ev, filtro, cb) { window.__tempoReale = cb; return this; }, subscribe() { return this; } }),
        storage: { from: () => ({
          upload: async (percorso, file, opz) => { window.__caricati.push({ percorso, peso: file.size, tipo: opz.contentType }); return { error: null }; },
          getPublicUrl: (p) => ({ data: { publicUrl: PUB + p } }),
        }) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) },
      }) };
    }, PUB);
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });

    /* Una chat lunga, come quella con Rita */
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      const frasi = ["Buongiorno Rita, domani passo per le misure", "Perfetto, a che ora?", "Verso le 10, se per lei va bene. Porto anche i campioni delle piastrelle così sceglie con calma il colore del bagno", "Va benissimo", "Ecco il preventivo per i lavori di casa", "Grazie, lo guardo stasera con mio marito e le faccio sapere"];
      const messaggi = [];
      for (let i = 0; i < 36; i++) messaggi.push({ id: "t" + i, from: i % 2 ? "them" : "me", text: frasi[i % frasi.length], time: "10:" + String(i).padStart(2, "0"), createdAt: new Date(Date.now() - (40 - i) * 60000).toISOString() });
      clients.length = 0;
      clients.push({ id: "c-rita", name: "Rita Ambrosini", status: "attivo", value: 0, desc: "Ristrutturazione", phone: "333 1234567", email: "", archived: false });
      chats.length = 0;
      chats.push({ id: "33333333-3333-4333-8333-333333333333", name: "Rita Ambrosini", isClient: true, isProspect: false, archived: false, unread: 0, messages: messaggi, toSeeToday: false, toCallToday: false });
      navigateTo("chat");
      activeChatIndex = 0;
      renderChatList();
      renderChatWindow();
      document.getElementById("chatSlider").classList.add("show-conv");
    });
    await page.waitForTimeout(300);
    const altezze = await page.evaluate(() => [...document.querySelectorAll("#page-chat .scorri-wrap")].map((w) => {
      const b = w.querySelector(".bubble") || w.firstElementChild;
      return { wrap: w.getBoundingClientRect().height, dentro: w.querySelector(".scorri-contenuto").scrollHeight };
    }));
    const schiacciati = altezze.filter((a) => a.wrap + 1 < a.dentro);
    verifica("chat lunga (36 messaggi): nessun messaggio schiacciato", altezze.length >= 36 && schiacciati.length === 0, JSON.stringify({ n: altezze.length, schiacciati: schiacciati.slice(0, 3) }));
    await page.screenshot({ path: path.join(require("os").tmpdir(), "eon-chat-lunga.png") });

    /* La foto: ridotta prima di partire, e subito visibile */
    const esito = await page.evaluate(async () => {
      currentSession = { access_token: "t", user: { id: "u1" } };
      subscribeToMessages();
      const c = document.createElement("canvas"); c.width = 4032; c.height = 3024;
      const x = c.getContext("2d");
      for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${i * 37 % 360},70%,${30 + i % 50}%)`; x.fillRect((i * 97) % 4032, (i * 61) % 3024, 90, 70); }
      const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.95));
      const file = new File([blob], "IMG_1234.jpeg", { type: "image/jpeg" });
      await inviaAllegato(file);
      return { originale: file.size, caricati: window.__caricati, inseriti: window.__inseriti.map((i) => i.riga) };
    });
    const up = esito.caricati[0] || {};
    verifica("la foto parte ridotta (JPEG, molto più leggera dell'originale)", up.tipo === "image/jpeg" && up.peso < esito.originale / 3 && up.peso < 900 * 1024, JSON.stringify({ originale: esito.originale, up }));
    const riga = esito.inseriti[0] || {};
    verifica("nella chat il messaggio con la foto (senza testo, per Rita)", riga.conversation_id === "33333333-3333-4333-8333-333333333333" && riga.body === "" && /\.jpg$/.test(riga.file_name) && riga.file_url.startsWith("https://finto.supabase.co/storage/v1/object/public/eon-files/u1/"), JSON.stringify(riga));

    /* Arriva il messaggio (tempo reale): la foto si vede subito, e niente analisi */
    await page.evaluate((riga) => { window.__tempoReale && window.__tempoReale({ new: { id: "foto1", sender: "me", event_type: null, created_at: new Date().toISOString(), ...riga } }); }, riga);
    await page.waitForTimeout(300);
    const src = await page.evaluate(() => { const i = [...document.querySelectorAll("#page-chat img")].pop(); return i ? i.getAttribute("src") : null; });
    verifica("la foto appare subito nella chat, dalla copia già sul telefono", !!src && src.startsWith("blob:"), String(src));
    verifica("una foto mandata non fa partire l'analisi della chat", analisi.length === 0, String(analisi.length));
    await page.evaluate(() => { const m = document.querySelector("#page-chat .chat-messages"); if (m) m.scrollTop = m.scrollHeight; });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(require("os").tmpdir(), "eon-chat-foto.png") });

    /* Un messaggio con del testo, invece, sì */
    await page.evaluate(() => { window.__tempoReale({ new: { id: "txt1", conversation_id: "33333333-3333-4333-8333-333333333333", sender: "them", event_type: null, body: "Va bene giovedì", created_at: new Date().toISOString() } }); });
    await page.waitForTimeout(300);
    verifica("un messaggio con testo fa partire l'analisi, come prima", analisi.length === 1, String(analisi.length));

    /* L'"Ok" di Rita arriva mentre l'app è in secondo piano (tempo reale
       perso): alla riapertura si recupera, si vede e EON lo legge */
    await page.evaluate(() => {
      window.__persi = [{ id: "ok1", conversation_id: "33333333-3333-4333-8333-333333333333", sender: "them", event_type: null, body: "Ok", created_at: new Date(Date.now() + 1000).toISOString() }];
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => window.__vis || "visible" });
      window.__vis = "hidden"; document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(3300);
    const primaDellaRiapertura = analisi.length;
    await page.evaluate(() => { window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(500);
    const dopo = await page.evaluate(() => ({ testi: chats[0].messages.slice(-1).map((m) => m.text), segnato: chats[0].ultimoAnalizzato }));
    const nuove = analisi.slice(primaDellaRiapertura);
    verifica("riaperta l'app: l'\"Ok\" arrivato nel frattempo compare nella chat", dopo.testi[0] === "Ok", JSON.stringify(dopo));
    verifica("…e EON lo legge (una volta, come recupero)", nuove.length === 1 && nuove[0].recupero === true && nuove[0].conversation_id === "33333333-3333-4333-8333-333333333333" && dopo.segnato === "ok1", JSON.stringify(nuove));
    await page.evaluate(() => { window.__persi = []; return analizzaRisposteArretrate(); });
    await page.waitForTimeout(200);
    verifica("già letto: alla riapertura successiva non si rilegge", analisi.length === primaDellaRiapertura + 1, String(analisi.length));

    /* Come WhatsApp: l'"Ok" l'ha già letto il server (il cliente ha appena
       scritto). L'app aspetta un attimo e mostra cosa è stato fatto, una
       volta sola; e alla riapertura mostra quello successo ad app chiusa. */
    const esitoServer = await page.evaluate(async () => {
      const visti = [];
      const toastVero = showAIToast;
      showAIToast = (t, testo) => visti.push(t + " | " + testo);
      loadUserDataFromDB = async () => {}; loadChatsFromDB = async () => {};
      const fetchVero = window.fetch;
      let giri = 0;
      window.fetch = async () => { giri++; return new Response(JSON.stringify(giri === 1 ? { azioni: [], in_corso: true, messaggio_id: "ok2" } : { messaggio_id: "ok2", gia_letto: true, azioni: [{ tool: "crea_impegno", esito: { titolo: "Incontro", quando_visualizzato: "mar 29 set, 14:30" } }] }), { status: 200 }); };
      await analyzeMessage({ id: "ok2" }, chats[0]);
      await new Promise((r) => setTimeout(r, 2900));
      const dopoServer = visti.slice(), giriPrimaVolta = giri;
      await analyzeMessage({ id: "ok2" }, chats[0]); // arriva di nuovo (tempo reale + riapertura)
      await new Promise((r) => setTimeout(r, 100));
      const dopoDoppione = visti.length;
      // Riapertura: l'ultimo messaggio l'ha già letto il server mentre l'app era chiusa
      window.fetch = async () => { throw new Error("non deve chiamare il server"); };
      chats[0].messages.push({ id: "ok3", from: "them", text: "Va bene", createdAt: new Date().toISOString() });
      chats[0].ultimoAnalizzato = "ok3";
      chats[0].ultimoEsito = { messaggio_id: "ok3", azioni: [{ tool: "crea_impegno", esito: { titolo: "Sopralluogo", quando_visualizzato: "gio 1 ott, 9:00" } }] };
      await analizzaRisposteArretrate();
      const dopoRiapertura = visti.slice(dopoDoppione);
      await analizzaRisposteArretrate();
      const dopoSecondaRiapertura = visti.length - dopoDoppione;
      window.fetch = fetchVero; showAIToast = toastVero;
      return { giri: giriPrimaVolta, dopoServer, dopoDoppione, dopoRiapertura, dopoSecondaRiapertura };
    });
    verifica("letto dal server: l'app aspetta un attimo e avvisa \"Appuntamento confermato\"", esitoServer.giri === 2 && esitoServer.dopoServer.length === 1 && esitoServer.dopoServer[0].startsWith("Appuntamento confermato | Incontro con Rita Ambrosini"), JSON.stringify(esitoServer));
    verifica("…una volta sola, anche se il messaggio arriva di nuovo", esitoServer.dopoDoppione === 1, JSON.stringify(esitoServer));
    verifica("riaperta l'app: mostra quello che il server ha fatto mentre era chiusa, una volta", esitoServer.dopoRiapertura.length === 1 && esitoServer.dopoRiapertura[0].includes("Sopralluogo con Rita Ambrosini") && esitoServer.dopoSecondaRiapertura === 1, JSON.stringify(esitoServer));

    /* L'avviso dello spostamento: il nome una volta sola */
    const toast = await page.evaluate(async () => {
      const visti = [];
      showAIToast = (t, testo) => visti.push(t + " | " + testo);
      loadUserDataFromDB = async () => {}; loadChatsFromDB = async () => {};
      const fetchVero = window.fetch;
      window.fetch = async () => new Response(JSON.stringify({ azioni: [{ tool: "sposta_impegno", esito: { titolo: "Appuntamento con Rita Ambrosini", quando_visualizzato: "gio 1 ott, 10:00" } }, { tool: "crea_impegno", esito: { titolo: "Sopralluogo", quando_visualizzato: "ven 2 ott, 9:00" } }] }), { status: 200 });
      await analyzeMessage({ id: "x" }, chats[0]);
      window.fetch = fetchVero;
      return visti;
    });
    verifica("avviso: \"Appuntamento spostato\", il nome del cliente una volta sola", toast.length === 2 && toast[0].startsWith("Appuntamento spostato | Appuntamento con Rita Ambrosini: ora è gio 1 ott, 10:00") && (toast[0].match(/Rita Ambrosini/g) || []).length === 1, JSON.stringify(toast));
    verifica("…e se il titolo non ha il nome, lo aggiunge", toast[1] && toast[1].includes("Sopralluogo con Rita Ambrosini"), JSON.stringify(toast));
    /* "Quando invio il messaggio la chat rimane alta" (Andrea): il messaggio
       compare subito e la chat resta in fondo, anche con foto che si
       caricano dopo (quelle di Rita). */
    await page.route("https://foto.prova/**", async (route) => {
      await new Promise((r) => setTimeout(r, 700)); // foto lenta
      route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#8ab"/></svg>' });
    });
    const fondo = await page.evaluate(async () => {
      const chat = chats[0];
      chat.messages = [];
      for (let i = 0; i < 14; i++) chat.messages.push({ id: "t" + i, from: i % 2 ? "them" : "me", text: "Messaggio numero " + i + " per le piastrelle del bagno", time: "10:" + String(10 + i), createdAt: new Date(Date.now() - (40 - i) * 60000).toISOString() });
      for (let i = 0; i < 4; i++) chat.messages.push({ id: "f" + i, from: "me", text: "", fileUrl: "https://foto.prova/f" + i + ".svg", fileName: "foto.jpg", fileType: "image/jpeg", time: "10:3" + i, createdAt: new Date(Date.now() - (20 - i) * 60000).toISOString() });
      activeChatIndex = 0;
      renderChatWindow();
      document.getElementById("chatSlider").classList.add("show-conv");
      await new Promise((r) => setTimeout(r, 1800)); // le foto arrivano
      const el = document.querySelector("#page-chat .chat-messages");
      const dopoFoto = el.scrollHeight - el.clientHeight - el.scrollTop;
      // Andrea scrive e invia
      document.getElementById("chatInput").value = "Arrivo alle 10";
      const t0 = performance.now();
      document.getElementById("chatSendBtn").click();
      await new Promise((r) => setTimeout(r, 60));
      const ultimo = [...el.querySelectorAll(".bubble")].pop();
      const subito = ultimo ? ultimo.textContent : "";
      await new Promise((r) => setTimeout(r, 1500));
      return { dopoFoto, subito, ms: Math.round(performance.now() - t0), dopoInvio: el.scrollHeight - el.clientHeight - el.scrollTop, scorre: el.scrollHeight > el.clientHeight };
    });
    verifica("chat con foto che arrivano dopo: resta in fondo, sull'ultimo messaggio", fondo.scorre && fondo.dopoFoto <= 2, JSON.stringify(fondo));
    verifica("messaggio inviato: compare subito, senza aspettare il server", fondo.subito.startsWith("Arrivo alle 10"), JSON.stringify(fondo));
    verifica("…e la chat va in fondo, sul messaggio appena inviato", fondo.dopoInvio <= 2, JSON.stringify(fondo));
    await page.screenshot({ path: require("path").join(require("os").tmpdir(), "eon-chat-invio.png") });

    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
