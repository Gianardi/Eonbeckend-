/* Le frasi VERE di Andrea nell'app vera (29/09/2026, Andrea: "bisogna
   trovare assolutamente il modo affinché EON riesca a capire tutto").
   Come fanno le grandi app: non frasi inventate, ma quelle dette davvero
   (136 dal registro, 3-29/09, nomi dei clienti cambiati: eval/dati/frasi-vere-andrea.json),
   ognuna con cosa deve succedere. Ogni frase passa dall'app VERA e dal server
   VERO (database e AI finti). Per ognuna:
     - giusta: è successa la cosa attesa, senza AI (o con l'AI se è un consiglio);
     - all'AI: il codice non l'ha capita e l'ha passata all'AI (con il credito
       finito = "non riesco");
     - sbagliata: il codice ha fatto una cosa diversa da quella attesa.
   Stampa i tre numeri e l'elenco. Uso:
   NODE_PATH=/opt/node22/lib/node_modules node eval/frasi-vere-app.test.js [--elenco] [--minimo=N] */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const path = require("path");
const fs = require("fs");

const PORT = 9024;
const ROOT = path.resolve(__dirname, "..");
const ELENCO = process.argv.includes("--elenco");
const MINIMO = Number((process.argv.find((a) => a.startsWith("--minimo=")) || "").split("=")[1] || 0);
const DATI = JSON.parse(fs.readFileSync(path.join(__dirname, "dati", "frasi-vere-andrea.json"), "utf8"));

/* ---------- Il server vero, con database e AI finti ---------- */
process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";
const UTENTE = { id: "11111111-1111-4111-8111-111111111111" };
let tabelle = {};
let chiamateAI = 0;
function vale(r, k, v) {
  if (v === "is.null") return r[k] == null;
  if (v === "not.is.null") return r[k] != null;
  if (v.startsWith("eq.")) return String(r[k]) === v.slice(3);
  if (v.startsWith("neq.")) return String(r[k]) !== v.slice(4);
  if (v.startsWith("gte.")) return String(r[k]) >= v.slice(4);
  if (v.startsWith("gt.")) return String(r[k]) > v.slice(3);
  if (v.startsWith("lte.")) return String(r[k]) <= v.slice(4);
  if (v.startsWith("lt.")) return String(r[k]) < v.slice(3);
  if (v.startsWith("ilike.")) return String(r[k] || "").toLowerCase().includes(v.slice(6).replace(/\*/g, "").toLowerCase());
  if (v.startsWith("in.(")) return v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(r[k]));
  return true;
}
function risposta(o, s = 200) { return new Response(o == null ? "" : JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } }); }
function postgrest(url, init) {
  const u = new URL(url);
  const percorso = u.pathname.replace("/rest/v1/", "");
  if (percorso.startsWith("rpc/")) return risposta(percorso === "rpc/ai_check_rate_limit" ? true : null);
  const righe = tabelle[percorso] || (tabelle[percorso] = []);
  const params = [...u.searchParams.entries()].filter(([k]) => !["select", "limit", "order", "or", "on_conflict"].includes(k));
  const scelte = righe.filter((r) => params.every(([k, v]) => vale(r, k, v)));
  const metodo = (init && init.method) || "GET";
  if (metodo === "GET") return risposta(scelte);
  if (metodo === "POST") {
    const corpo = JSON.parse(init.body);
    const nuove = (Array.isArray(corpo) ? corpo : [corpo]).map((c) => ({ id: randomUUID(), created_at: new Date().toISOString(), deleted_at: null, owner_id: UTENTE.id, ...c }));
    righe.push(...nuove);
    return risposta(nuove, 201);
  }
  if (metodo === "PATCH") { const c = JSON.parse(init.body); scelte.forEach((r) => Object.assign(r, c)); return risposta(scelte); }
  if (metodo === "DELETE") { tabelle[percorso] = righe.filter((r) => !scelte.includes(r)); return risposta([]); }
  return risposta([]);
}
const fetchVero = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const s = String(url);
  if (s.startsWith("https://api.anthropic.com/")) {
    chiamateAI++;
    const corpo = JSON.parse(init.body);
    return risposta({ id: "msg", type: "message", role: "assistant", model: corpo.model, usage: { input_tokens: 5, output_tokens: 2 }, content: [{ type: "text", text: "Ok." }], stop_reason: "end_turn" });
  }
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/user")) return risposta(UTENTE);
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/")) return postgrest(s, init);
  return fetchVero(url, init);
};


const conta = () => ({
  tasks: (tabelle.tasks || []).filter((t) => !t.deleted_at).length,
  tasksJson: JSON.stringify((tabelle.tasks || []).map((t) => [t.id, t.scheduled_at, t.deleted_at, t.status])),
  doc: (tabelle.messages || []).filter((m) => m.event_type === "doc").length,
  appt: (tabelle.messages || []).filter((m) => m.event_type === "appt").length,
  testo: (tabelle.messages || []).filter((m) => !m.event_type || m.event_type === "text").length,
  clients: (tabelle.clients || []).length,
  appunti: (tabelle.cantiere_appunti || []).length,
  cartelle: (tabelle.cartelle || []).length,
});

async function main() {
  const { default: handler } = await import("../api/index.js");
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  const risultati = { giusta: [], ai: [], sbagliata: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(() => {
      window.__scritture = []; window.__aperti = []; window.__fotoScatta = 0;
      window.open = (u) => { window.__aperti.push(String(u || "")); return { document: { write() {}, close() {} }, close() {} }; };
      const clickVero = HTMLElement.prototype.click;
      HTMLElement.prototype.click = function () {
        if (this.tagName === "A" && /^(?:tel:|mailto:|sms:|https:\/\/wa\.me)/.test(this.getAttribute("href") || "")) { window.__aperti.push(this.getAttribute("href")); return; }
        if (this.tagName === "INPUT" && this.type === "file") { window.__fotoScatta++; return; }
        return clickVero.call(this);
      };
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: (patch) => ({ eq: async () => { window.__scritture.push({ tabella, patch }); return { error: null }; } }), delete: () => ({ eq: async () => ({ error: null }) }), upsert: async () => ({ error: null }),
          insert: (riga) => { window.__scritture.push({ tabella, riga }); const r = { id: "n" + window.__scritture.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
    });
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api?action=assistant", async (route) => {
      const req = { method: "POST", url: "/api?action=assistant", headers: { authorization: "Bearer t" }, body: JSON.parse(route.request().postData() || "{}") };
      let uscita = "", stato = 200;
      const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
      try { await handler(req, res); stato = res.statusCode || 200; } catch (e) { stato = 500; uscita = JSON.stringify({ error: e.message }); }
      route.fulfill({ status: stato, contentType: "application/json", body: uscita || "{}" });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    const clienti = DATI.clienti.map((name, i) => ({ id: randomUUID(), owner_id: UTENTE.id, name, phone: "33300000" + String(i).padStart(2, "0"), email: name.split(" ")[0].toLowerCase() + "@example.com", status: "attivo", value: 1000, deleted_at: null }));
    tabelle = { clients: clienti.map((c) => ({ ...c })), profiles: [{ id: UTENTE.id, profession: "edile" }], conversations: [], messages: [], tasks: [], incomes: [], cartelle: [{ id: randomUUID(), owner_id: UTENTE.id, nome: "Lerici", deleted_at: null }], cantiere_appunti: [], cantiere_foto: [], ai_request_log: [], ai_audit_log: [], ai_runs: [], eon_admin: [], app_errori: [] };
    // Qualche impegno già in calendario, da spostare o cancellare
    const domani = new Date(); domani.setDate(domani.getDate() + 1);
    const giorno = (d, h) => { const x = new Date(d); return x.toISOString().slice(0, 10) + "T" + h + ":00"; };
    tabelle.tasks.push(
      { id: randomUUID(), owner_id: UTENTE.id, title: "Sopralluogo Hunter", type: "appuntamento", scheduled_at: giorno(domani, "09:00"), time: "Domani, 09:00", status: "todo", deleted_at: null, client_id: clienti.find((c) => c.name === "Hunter").id },
      { id: randomUUID(), owner_id: UTENTE.id, title: "Appuntamento Belle", type: "appuntamento", scheduled_at: giorno(domani, "15:00"), time: "Domani, 15:00", status: "todo", deleted_at: null, client_id: clienti.find((c) => c.name === "Belle").id },
      { id: randomUUID(), owner_id: UTENTE.id, title: "Incontro con il dottore Rigoni", type: "appuntamento", scheduled_at: giorno(domani, "16:00"), time: "Domani, 16:00", status: "todo", deleted_at: null, client_id: clienti.find((c) => c.name === "Rigoni").id },
    );
    await page.evaluate(async ([clienti, tasksIniziali]) => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "11111111-1111-4111-8111-111111111111", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      await applyProfession("edile", true);
      clients.length = 0; clienti.forEach((c) => clients.push({ id: c.id, name: c.name, phone: c.phone, email: c.email, status: "attivo", value: 1000, desc: "", archived: false }));
      cartelle.length = 0; cartelle.push({ id: "k1", nome: "Lerici" }); renderCartelle();
      tasks.length = 0; tasksIniziali.forEach((t) => tasks.push(mappaImpegno({ ...t, owner_type: "user" })));
      incomes.length = 0; clienti.slice(0, 5).forEach((c, i) => incomes.push({ id: "i" + i, client: c.name, clientId: c.id, amount: 1500, status: "attesa", desc: "Lavoro" }));
      try { localStorage.setItem("eon-promemoria-proposto", "1"); } catch (e) {}
      apriLinkEsterno = (u) => window.__aperti.push(String(u));
    }, [clienti, tabelle.tasks]);

    for (const [frase, atteso] of DATI.frasi) {
      const ai0 = chiamateAI, prima = conta();
      const st = await page.evaluate(async (frase) => {
        chiudiRisorsaCard(); navigateTo("home");
        document.getElementById("aiToastContainer").innerHTML = "";
        document.querySelectorAll(".ai-landing-overlay").forEach((o) => { o.style.display = "none"; });
        window.__scritture.length = 0; window.__aperti.length = 0; window.__fotoScatta = 0;
        const paginaPrima = paginaAttuale;
        try { await eonInviaHome(frase); } catch (e) { return { errore: e.message }; }
        await new Promise((r) => setTimeout(r, 60));
        // Una conferma del codice ("Sposto…?", "Annulla 1 impegno"): si tocca Sì, come farebbe l'utente
        const si = [...document.querySelectorAll("#risorsaCorpo .scheda-scelta")].find((b) => /^Sì, sposta$/.test(b.textContent)) || document.getElementById("annullaConferma");
        let confermato = "";
        if (si && !si.disabled) { confermato = document.getElementById("risorsaCorpo").textContent.replace(/\s+/g, " ").slice(0, 100); si.click(); await new Promise((r) => setTimeout(r, 250)); }
        const landing = [...document.querySelectorAll(".ai-landing-overlay")].filter((o) => o.style.display !== "none" && o.offsetParent !== null).map((o) => o.textContent.replace(/\s+/g, " ").trim()).join(" ");
        return {
          card: (document.getElementById("risorsaOverlay").style.display === "flex" ? document.getElementById("risorsaTitolo").textContent + " | " + document.getElementById("risorsaCorpo").textContent.replace(/\s+/g, " ").slice(0, 140) : "") + (confermato ? " [confermato: " + confermato + "]" : ""),
          schedaCliente: !!document.querySelector("#risorsaCorpo .scheda-cliente"),
          toast: document.getElementById("aiToastContainer").textContent.replace(/\s+/g, " ").trim().slice(0, 140),
          landing: landing.slice(0, 140),
          scritture: window.__scritture.map((s) => s.tabella),
          aperti: window.__aperti.slice(), foto: window.__fotoScatta,
          pagina: paginaAttuale, cambiata: paginaAttuale !== paginaPrima,
        };
      }, frase);
      const dopo = conta();
      st.scritture = st.scritture || []; st.aperti = st.aperti || []; st.card = st.card || ""; st.toast = st.toast || ""; st.landing = st.landing || "";
      const ai = chiamateAI > ai0;
      const vis = (st.card || "") + " " + st.toast + " " + st.landing;
      const scritto = (t) => st.scritture.includes(t);
      const fatto = {
        calendario: dopo.tasks > prima.tasks || dopo.appt > prima.appt || scritto("tasks"),
        calendario_modifica: dopo.tasksJson !== prima.tasksJson || scritto("tasks"),
        conferma: /\?|conferm|sicur|cestino|svuot|annull/i.test(vis),
        documento: dopo.doc > prima.doc || /preventivo|fattura/i.test(st.card),
        risorsa: !!st.card || st.cambiata,
        foto: /foto/i.test(vis) || /foto/.test(st.pagina),
        foto_scatta: st.foto > 0,
        mente: dopo.appunti > prima.appunti || scritto("cantiere_appunti"),
        cliente: dopo.clients > prima.clients || scritto("clients") || st.schedaCliente,
        messaggio: dopo.testo > prima.testo || st.aperti.some((u) => /wa\.me|sms:/.test(u)) || /messaggio|scriv|whatsapp/i.test(vis),
        email: st.aperti.some((u) => /^mailto:/.test(u)) || /e-?mail/i.test(vis),
        chiamata: st.aperti.some((u) => /^tel:/.test(u)) || /chiam/i.test(vis),
        dati: !!(st.card || st.toast || st.landing),
        pagina: st.cambiata || !!st.card,
        cartella: dopo.cartelle > prima.cartelle || scritto("cartelle"),
        cartello: /cartello/i.test(st.pagina) || /cartello/i.test(vis),
        invio: !!st.card || st.aperti.length > 0,
        risposta: !!(st.card || st.toast || st.landing),
        ai: ai,
      };
      const scrittoQualcosa = dopo.tasks > prima.tasks || dopo.doc > prima.doc || dopo.appunti > prima.appunti || dopo.clients > prima.clients || st.scritture.length > 0;
      let esito;
      if (st.errore) esito = "sbagliata";
      else if (atteso === "ai") esito = scrittoQualcosa ? "sbagliata" : "giusta";
      else if (fatto[atteso] && !ai) esito = "giusta";
      else if (!ai && !scrittoQualcosa && /Ho trovato \d+ clienti|Quale |Intendi |Per quale cliente/.test(st.card)) esito = "giusta"; // chiede quale: giusto
      else if (ai && !scrittoQualcosa) esito = "ai";
      else esito = "sbagliata";
      risultati[esito].push(`«${frase}» atteso ${atteso}${ai ? " [AI]" : ""} — ${JSON.stringify({ card: st.card.slice(0, 70), toast: st.toast.slice(0, 60), landing: st.landing.slice(0, 50), scritture: st.scritture, pagina: st.cambiata ? st.pagina : undefined, errore: st.errore })}`);
    }
    const tot = DATI.frasi.length;
    const pc = (n) => Math.round((n / tot) * 100);
    console.log(`Frasi vere di Andrea nell'app: ${tot}`);
    console.log(`  giuste: ${risultati.giusta.length} (${pc(risultati.giusta.length)}%) · passate all'AI: ${risultati.ai.length} (${pc(risultati.ai.length)}%) · sbagliate: ${risultati.sbagliata.length} (${pc(risultati.sbagliata.length)}%)`);
    if (ELENCO) {
      console.log("\nSBAGLIATE:"); risultati.sbagliata.forEach((x) => console.log("  " + x));
      console.log("\nALL'AI:"); risultati.ai.forEach((x) => console.log("  " + x));
    } else risultati.sbagliata.slice(0, 10).forEach((x) => console.log("  FAIL " + x));
    if (errori.length) console.log("Errori nella pagina:", JSON.stringify(errori.slice(0, 5)));
    process.exitCode = risultati.giusta.length >= MINIMO && !errori.length ? 0 : 1;
  } finally {
    await browser.close();
    server.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
