/* Promemoria degli impegni, lato app (29/09/2026):
   - Impostazioni → Promemoria → "Attiva": permesso, "postino" (sw.js),
     iscrizione con la chiave pubblica di EON, salvata in push_iscrizioni;
   - "Disattiva" la toglie;
   - dopo il primo impegno segnato, una volta sola: "Vuoi un avviso prima?";
   - su iPhone senza EON nella schermata Home: spiega come fare.
   Browser vero, Supabase finto, notifiche del telefono finte.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/promemoria-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = 9020;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}
const VAPID = (fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/const VAPID_PUBBLICA = "([^"]+)"/) || [])[1];

function preparaPagina(conPush) {
  return (conPush) => {
    window.__db = [];
    const catena = (tabella) => {
      const q = {
        select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
        update: () => ({ eq: async () => ({ error: null }) }),
        delete: () => ({ eq: async (c, v) => { window.__db.push({ tabella, op: "delete", c, v }); return { error: null }; } }),
        upsert: async (riga, opz) => { window.__db.push({ tabella, op: "upsert", riga, opz }); return { error: null }; },
        insert: (riga) => { window.__db.push({ tabella, op: "insert", riga }); const r = { id: "n" + window.__db.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }) }) }; },
        maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
        then: (ok) => ok({ data: [], error: null }),
      };
      return q;
    };
    window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
    if (!conPush) { try { delete window.PushManager; } catch (e) {} window.PushManager = undefined; return; }
    // Il telefono finto: permesso, postino, iscrizione
    window.__push = { permessi: 0, registrati: [], chiave: null, disiscritto: false };
    let sub = null;
    const reg = {
      pushManager: {
        getSubscription: async () => sub,
        subscribe: async (o) => { window.__push.chiave = Array.from(new Uint8Array(o.applicationServerKey)); window.__push.visibile = o.userVisibleOnly;
          sub = { toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/telefono-1", keys: { p256dh: "BPubblicaDelTelefono", auth: "segretoAuth" } }), unsubscribe: async () => { window.__push.disiscritto = true; sub = null; return true; } };
          return sub; },
      },
    };
    window.PushManager = function () {};
    window.Notification = { permission: "default", requestPermission: async () => { window.__push.permessi++; window.Notification.permission = "granted"; return "granted"; } };
    Object.defineProperty(navigator, "serviceWorker", { value: { register: async (u) => { window.__push.registrati.push(u); return reg; }, ready: Promise.resolve(reg), getRegistration: async () => reg }, configurable: true });
  };
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    verifica("la chiave pubblica di EON è nell'app (65 byte, P-256)", VAPID && Buffer.from(VAPID, "base64url").length === 65 && Buffer.from(VAPID, "base64url")[0] === 4, VAPID);
    const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    verifica("il postino (sw.js) mostra la notifica e al tocco apre EON, senza toccare nient'altro", /addEventListener\("push"/.test(sw) && /showNotification/.test(sw) && /notificationclick/.test(sw) && !/addEventListener\("fetch"/.test(sw));

    /* Android / computer: le notifiche ci sono */
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(preparaPagina(true), true);
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api?action=assistant", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stato: "concluso", testo: "Fatto.", azioni: [{ tool: "crea_impegno", esito: { id: "t1", titolo: "Sopralluogo Rossi", tipo: "commissione", quando_visualizzato: "Domani, 09:00" } }] }) }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      try { localStorage.removeItem("eon-promemoria"); localStorage.removeItem("eon-promemoria-proposto"); } catch (e) {}
      await applyProfession("edile", true);
    });

    // Dopo il primo impegno: una volta sola, "vuoi un avviso prima?"
    const proposta = async () => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; });
      await page.fill("#homeHeroCampo", "domani alle 9 sopralluogo da Rossi");
      await page.evaluate(() => document.getElementById("homeHeroSend").click());
      await page.waitForTimeout(500);
      return page.evaluate(() => document.getElementById("aiToastContainer").innerText.replace(/\s+/g, " "));
    };
    let t = await proposta();
    verifica("primo impegno segnato → \"Vuoi un avviso prima?\" con Sì/No", /Segnato/.test(t) && /Vuoi un avviso prima\?/.test(t) && /Sì, avvisami/.test(t), t);
    t = await proposta();
    verifica("la seconda volta non lo chiede più", /Segnato/.test(t) && !/Vuoi un avviso prima/.test(t), t);

    // Impostazioni → Promemoria → Attiva
    await page.evaluate(() => { document.getElementById("aiToastContainer").innerHTML = ""; navigateTo("impostazioni"); });
    const voce = await page.evaluate(() => ({ c: !!document.getElementById("impVocePromemoria"), sotto: document.getElementById("impPromemoriaSotto").textContent }));
    verifica("in Impostazioni c'è \"Promemoria\" (un avviso 30 minuti prima)", voce.c && /30 minuti prima/.test(voce.sotto), JSON.stringify(voce));
    await page.click("#impVocePromemoria");
    await page.click("#impPromemoriaAccendi");
    await page.waitForTimeout(300);
    const dopo = await page.evaluate(() => ({ push: window.__push, db: window.__db.filter((x) => x.tabella === "push_iscrizioni"), esito: document.getElementById("impEsitoPromemoria").textContent, sotto: document.getElementById("impPromemoriaSotto").textContent }));
    const chiaveUsata = dopo.push.chiave ? Buffer.from(dopo.push.chiave).toString("base64url") : null;
    verifica("\"Attiva\": chiede il permesso e registra il postino /sw.js", dopo.push.permessi === 1 && dopo.push.registrati.includes("/sw.js"), JSON.stringify(dopo.push));
    verifica("si iscrive con la chiave pubblica di EON (notifiche sempre visibili)", chiaveUsata === VAPID && dopo.push.visibile === true, chiaveUsata);
    const up = dopo.db.find((x) => x.op === "upsert") || {};
    verifica("salva il telefono in push_iscrizioni (endpoint, chiavi, proprietario, senza doppioni)", up.riga && up.riga.endpoint === "https://fcm.googleapis.com/fcm/send/telefono-1" && up.riga.p256dh === "BPubblicaDelTelefono" && up.riga.auth === "segretoAuth" && up.riga.owner_id === "u1" && up.opz && up.opz.onConflict === "endpoint", JSON.stringify(up));
    verifica("dice che è fatto e la voce diventa \"Attivi\"", /30 minuti prima/.test(dopo.esito) && /^Attivi/.test(dopo.sotto), JSON.stringify(dopo));

    // Disattiva
    await page.evaluate(() => chiudiRisorsaCard());
    await page.click("#impVocePromemoria");
    await page.click("#impPromemoriaSpegni");
    await page.waitForTimeout(300);
    const spento = await page.evaluate(() => ({ dis: window.__push.disiscritto, del: window.__db.filter((x) => x.tabella === "push_iscrizioni" && x.op === "delete"), esito: document.getElementById("impEsitoPromemoria").textContent }));
    verifica("\"Disattiva\": toglie l'iscrizione dal telefono e dal database", spento.dis && spento.del.length === 1 && spento.del[0].v === "https://fcm.googleapis.com/fcm/send/telefono-1" && /disattivati/.test(spento.esito), JSON.stringify(spento));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
    await page.close();

    /* iPhone con EON aperta da Safari (non dalla schermata Home): niente notifiche, si spiega */
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
    const ip = await ctx.newPage();
    await ip.addInitScript(preparaPagina(false), false);
    await ip.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await ip.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await ip.evaluate(() => { document.getElementById("onboardingScreen").style.display = "none"; currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } }; navigateTo("impostazioni"); });
    await ip.click("#impVocePromemoria");
    const testo = await ip.evaluate(() => document.getElementById("risorsaCorpo").innerText);
    await ip.click("#impPromemoriaAccendi");
    await ip.waitForTimeout(200);
    const esitoIp = await ip.evaluate(() => document.getElementById("impEsitoPromemoria").textContent);
    verifica("iPhone da Safari: spiega di aggiungere EON alla schermata Home", /schermata Home/.test(testo) && /schermata Home/.test(esitoIp), testo + " | " + esitoIp);
    await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
