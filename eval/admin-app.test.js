/* Avviso automatico degli errori ed EON Admin (27/09/2026), lato app:
   - un errore dell'app parte da solo verso il server (una volta sola per
     errore; gli errori di rete no);
   - all'amministratore compare "EON Admin" nel Menu, col numero di errori
     nuovi e un avviso; agli altri no;
   - admin.html mostra numeri, grafico, errori e utenti; "Segna come visti";
     pagina riservata e "entra prima in EON".
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/admin-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8994;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

const oggi = new Date();
const giorni = Array.from({ length: 14 }, (_, i) => { const d = new Date(oggi); d.setDate(d.getDate() - 13 + i); return { giorno: d.toISOString().slice(0, 10), richieste: [3, 0, 5, 12, 8, 0, 0, 4, 22, 9, 15, 31, 18, 7][i], costo_usd: 0.01 * i, errori: i === 13 ? 2 : 0 }; });
const RIEPILOGO = {
  generato: oggi.toISOString(),
  errori_visti_fino: new Date(Date.now() - 3600000).toISOString(),
  totali: { utenti: 2, attivi_7g: 2, richieste_oggi: 7, richieste_7g: 131, costo_mese_usd: 0.141, senza_ai_pct: 38, durata_media_ms: 7881, errori_nuovi: 1 },
  giorni,
  errori: [
    { id: 2, ultima_volta: oggi.toISOString(), created_at: oggi.toISOString(), conteggio: 3, origine: "app", messaggio: "TypeError: Cannot read properties of undefined (reading 'time')", dettaglio: "at renderChatList (index.html:8350)", pagina: "chat", email: "gianardiadvisor@icloud.com", dispositivo: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" },
    { id: 1, ultima_volta: new Date(Date.now() - 2 * 86400000).toISOString(), created_at: new Date(Date.now() - 2 * 86400000).toISOString(), conteggio: 1, origine: "server", messaggio: "Database: 502", dettaglio: null, pagina: "api:assistant", email: null, dispositivo: null },
  ],
  errori_ai: [{ created_at: oggi.toISOString(), messaggio: "AI non raggiunta", modello: "claude-haiku-4-5", email: "gianardiadvisor@icloud.com" }],
  utenti: [
    { id: "a", email: "gianardiadvisor@icloud.com", full_name: "Andrea Gianardi", business_name: "Gianardi Costruzioni", profession: "edile", created_at: "2026-07-31T19:18:43Z", ultima_richiesta: oggi.toISOString(), clienti: 12, richieste_30g: 139, costo_mese_usd: 0.141, spazio_mb: 38.2 },
    { id: "b", email: "simone@esempio.it", full_name: "", business_name: "", profession: "avvocato", created_at: "2026-08-27T08:35:44Z", ultima_richiesta: null, last_sign_in_at: "2026-08-31T20:51:52Z", clienti: 1, richieste_30g: 0, costo_mese_usd: 0, spazio_mb: 0 },
  ],
};

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    /* ---------- L'app: segnalazione errori e voce del Menu ---------- */
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [], segnalati = [];
    let stato = { admin: false };
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(() => {
      window.__segnalaErroriInLocale = true;
      const catena = () => { const q = { select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, update: () => ({ eq: async () => ({ error: null }) }), single: async () => ({ data: null, error: null }), then: (ok) => ok({ data: [], error: null }) }; return q; };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
    });
    await page.route("https://eonbeckend.vercel.app/api?action=errore_app", (route) => { segnalati.push({ corpo: JSON.parse(route.request().postData()), auth: route.request().headers().authorization }); route.fulfill({ status: 200, contentType: "application/json", body: "{\"ok\":true}" }); });
    await page.route("https://eonbeckend.vercel.app/api?action=admin_stato", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stato) }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.getElementById("onboardingScreen").style.display = "none"; currentSession = { access_token: "tok", user: { id: "u1" } }; });

    segnalati.length = 0;
    await page.evaluate(() => { setTimeout(() => { throw new Error("Prova: qualcosa si è rotto"); }, 0); setTimeout(() => { throw new Error("Prova: qualcosa si è rotto"); }, 10); });
    await page.waitForTimeout(400);
    verifica("un errore dell'app parte da solo verso il server, una volta sola", segnalati.length === 1 && /Prova: qualcosa si è rotto/.test(segnalati[0].corpo.messaggio) && segnalati[0].auth === "Bearer tok", JSON.stringify(segnalati));
    await page.evaluate(() => { console.error("Errore aggiornamento tasks:", "permission denied"); console.error(new TypeError("Failed to fetch")); });
    await page.waitForTimeout(300);
    verifica("console.error di un problema vero: segnalato; errore di rete: no", segnalati.length === 2 && /Errore aggiornamento tasks: permission denied/.test(segnalati[1].corpo.messaggio), JSON.stringify(segnalati.map((s) => s.corpo.messaggio)));

    // Utente normale: niente voce Admin
    await page.evaluate(() => { adminControllato = false; ricordaProfilo({ full_name: "Mario" }, "mario@esempio.it"); });
    await page.waitForTimeout(300);
    verifica("utente normale: niente \"EON Admin\" nel Menu", await page.evaluate(() => document.getElementById("menuAdmin").hidden));
    // Amministratore con 2 errori nuovi
    stato = { admin: true, errori_nuovi: 2 };
    await page.evaluate(() => { adminControllato = false; document.getElementById("aiToastContainer").innerHTML = ""; ricordaProfilo({ full_name: "Andrea Gianardi" }, "gianardiadvisor@icloud.com"); navigateTo("gestisci-azienda"); });
    await page.waitForTimeout(300);
    const menu = await page.evaluate(() => ({ visibile: !document.getElementById("menuAdmin").hidden && document.getElementById("menuAdmin").offsetHeight > 0, badge: document.getElementById("menuAdminBadge").hidden ? "" : document.getElementById("menuAdminBadge").textContent, link: document.getElementById("menuAdmin").getAttribute("href"), toast: document.getElementById("aiToastContainer").textContent }));
    verifica("Andrea: \"EON Admin\" nel Menu con il numero 2", menu.visibile && menu.badge === "2" && menu.link === "/admin.html", JSON.stringify(menu));
    verifica("e l'avviso \"2 errori nuovi in EON\"", /2 errori nuovi in EON/.test(menu.toast), menu.toast);
    await page.screenshot({ path: path.join("/tmp/claude-0/-home-user-Eonbeckend-/a214508f-fe40-53a1-9997-31bf11910511/scratchpad/shots", "menu-admin.png") }).catch(() => {});
    verifica("nessun errore nella pagina dell'app (a parte quelli di prova)", errori.every((e) => /Prova:/.test(e)), JSON.stringify(errori));

    /* ---------- admin.html ---------- */
    const apriAdmin = async (sessione, risposta) => {
      const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const chiamate = [];
      await p.addInitScript((s) => { window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: s } }) } }) }; }, sessione);
      await p.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
      await p.route("https://eonbeckend.vercel.app/api?action=*", (route) => {
        const azione = new URL(route.request().url()).searchParams.get("action");
        chiamate.push({ azione, auth: route.request().headers().authorization });
        if (azione === "admin_errori_visti") return route.fulfill({ status: 200, contentType: "application/json", body: "{\"ok\":true}" });
        route.fulfill({ status: risposta.status || 200, contentType: "application/json", body: JSON.stringify(risposta.corpo || {}) });
      });
      const errP = [];
      p.on("pageerror", (e) => errP.push(e.message));
      await p.goto(`http://localhost:${PORT}/admin.html`, { waitUntil: "networkidle" });
      await p.waitForTimeout(300);
      return { p, chiamate, errP };
    };

    let a = await apriAdmin(null, {});
    verifica("admin.html senza login: \"Entra prima in EON\"", /Entra prima in EON/.test(await a.p.textContent("#contenuto")) && a.chiamate.length === 0);
    await a.p.close();

    a = await apriAdmin({ access_token: "tok" }, { status: 403, corpo: { error: "Pagina riservata" } });
    verifica("admin.html per chi non è admin: \"Pagina riservata\", nessun dato", /Pagina riservata/.test(await a.p.textContent("#contenuto")));
    await a.p.close();

    a = await apriAdmin({ access_token: "tok" }, { corpo: RIEPILOGO });
    const vista = await a.p.evaluate(() => ({
      tiles: [...document.querySelectorAll(".tile")].map((t) => t.querySelector(".num").textContent + " " + t.querySelector(".lab").textContent),
      allarme: document.querySelector(".tile.allarme .lab") && document.querySelector(".tile.allarme .lab").textContent,
      barre: document.querySelectorAll(".barra").length,
      nuovi: document.querySelectorAll(".pill.nuovo").length,
      errori: [...document.querySelectorAll(".sezione:nth-of-type(2) .voce-titolo")].map((e) => e.textContent),
      utenti: [...document.querySelectorAll(".utente-nome")].map((e) => e.textContent),
      testo: document.getElementById("contenuto").textContent,
    }));
    verifica("numeri in alto: errori nuovi (in rosso), utenti, richieste, costo, senza AI, attesa", vista.tiles.length === 6 && vista.allarme === "Errori nuovi" && vista.tiles.includes("131 Utenti") === false && vista.tiles.some((t) => /^\$0,14 Costo AI/.test(t)) && vista.tiles.some((t) => /^38% Richieste senza AI/.test(t)) && vista.tiles.some((t) => /^7,9 s Attesa/.test(t)), JSON.stringify(vista.tiles));
    verifica("grafico con 14 giorni", vista.barre === 14, String(vista.barre));
    verifica("errori: il nuovo segnato NUOVO, il ripetuto con ×3, il vecchio no", vista.nuovi === 1 && /×3/.test(vista.testo) && /Database: 502/.test(vista.testo), JSON.stringify(vista.errori));
    verifica("errori dell'AI: l'errore e il modello, mai la frase dell'utente", /AI non raggiunta/.test(vista.testo) && /claude-haiku-4-5/.test(vista.testo));
    verifica("utenti: nome o email, clienti, spazio", JSON.stringify(vista.utenti) === '["Andrea Gianardi","simone@esempio.it"]' && /38,2 MB/.test(vista.testo), JSON.stringify(vista.utenti));
    await a.p.click(".barra:nth-child(12)");
    const sugg = await a.p.textContent("#suggerimento");
    verifica("tocco su una barra: giorno, richieste, costo, errori", /31 richieste/.test(sugg) && /\$/.test(sugg), sugg);
    await a.p.screenshot({ path: path.join("/tmp/claude-0/-home-user-Eonbeckend-/a214508f-fe40-53a1-9997-31bf11910511/scratchpad/shots", "admin.png"), fullPage: true }).catch(() => {});
    await a.p.click("#visti");
    await a.p.waitForTimeout(300);
    verifica("\"Segna come visti\" avvisa il server e ricarica", a.chiamate.some((c) => c.azione === "admin_errori_visti" && c.auth === "Bearer tok") && a.chiamate.filter((c) => c.azione === "admin_riepilogo").length === 2, JSON.stringify(a.chiamate));
    verifica("nessun errore in admin.html", a.errP.length === 0, JSON.stringify(a.errP));
    await a.p.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
