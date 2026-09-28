/* L'utente virtuale, per OGNI professione (29/09/2026, Andrea: "le hai
   create per ogni singola professione?").

   Per edile, idraulico, elettricista, amministratore e "Altra attività":
   un artigiano finto con i SUOI clienti e le SUE parole scrive alla Home
   qualche centinaio di frasi (le cose di tutti i giorni + le funzioni del
   suo mestiere: SAL, urgenze, DiCo, assemblee, cartelle). Ogni frase passa
   dall'app VERA e, quando serve, dal server VERO (api/index.js) con il
   database e l'AI finti. Per ogni frase si controlla:
     - che l'AI non sia stata chiamata (tutto col codice);
     - che sia successo qualcosa di visibile (scritto, card, avviso, pagina);
     - per le funzioni del mestiere, che sia successa la cosa giusta.
   Stampa la percentuale col codice per ogni professione e le frasi sbagliate.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/utente-virtuale-mestieri.test.js [--elenco] */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const path = require("path");

const PORT = 9019;
const ROOT = path.resolve(__dirname, "..");
const ELENCO = process.argv.includes("--elenco");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

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

/* ---------- Gli artigiani finti ---------- */
const MESTIERI = {
  edile: {
    clienti: ["Mario Rossi", "Luca Bianchi", "Francesca Neri", "Edil Sud Srl"], cantieri: "cantieri",
    lavori: ["getto del solaio", "massetto piano terra", "rifacimento tetto", "cappotto termico"],
    proprie: [
      ["SAL 30% cantiere Rossi", { app: "sal" }], ["SAL 50% Bianchi 4.000 euro", { app: "sal" }], ["fai il SAL 20% per Neri", { app: "sal" }],
      ["crea cartello fine lavori Rossi", { pagina: "crea-cartello" }], ["cartello fine lavori Bianchi", { pagina: "crea-cartello" }],
      ["mandami il DURC", { effetto: true }], ["DURC Rossi", { effetto: true }],
    ],
  },
  idraulico: {
    clienti: ["Luca Bianchi", "Paolo Verdini", "Anna Ferri", "Condominio Le Rose"], cantieri: "interventi",
    lavori: ["sostituzione caldaia", "riparazione perdita bagno", "spurgo scarico cucina", "revisione caldaia"],
    proprie: [
      ["perdita urgente da Bianchi", { app: "tasks", urgente: true }], ["emergenza allagamento cantina Verdini alle 15", { app: "tasks", urgente: true }],
      ["urgente caldaia in blocco da Ferri", { app: "tasks", urgente: true }], ["c'è odore di gas da Bianchi", { card: /Odore di gas/ }],
      ["le urgenze", { card: /Urgenze/ }],
    ],
  },
  elettricista: {
    clienti: ["Anna Verdi", "Marco Galli", "Sara Conti", "Hotel Bellavista"], cantieri: "impianti",
    lavori: ["rifacimento quadro elettrico", "impianto fotovoltaico", "punti luce soggiorno", "messa a terra"],
    proprie: [
      ["fai la DiCo per l'impianto Verdi", { card: /Dichiarazione di conformità/ }], ["dichiarazione di conformità per Galli", { card: /Dichiarazione di conformità/ }],
      ["prepara la dico per Conti", { card: /Dichiarazione di conformità/ }], ["dichiarazioni di conformità", { card: /Dichiarazioni di conformità/ }],
    ],
  },
  amministratore: {
    clienti: ["Condominio Parco Verde", "Condominio Via Roma 12", "Residence Il Faro", "Supercondominio Aurora"], cantieri: "condomini",
    lavori: ["gestione ordinaria condominio", "manutenzione ascensore", "pulizia scale", "rifacimento facciata"],
    proprie: [
      ["assemblea in via Roma 12 giovedì alle 21", { server: "assemblee" }], ["assemblea straordinaria condominio Parco Verde domani ore 18", { server: "assemblee" }],
      ["nuova assemblea", { card: /Nuova assemblea/ }], ["le assemblee", { pagina: "assemblee" }],
    ],
  },
  artigiano: {
    clienti: ["Giulia Serra", "Bar Centrale", "Luca Monti", "Studio Ferrari"], cantieri: null, cartelle: ["Fornitori", "Scadenze", "Incassi", "Magazzino"],
    lavori: ["consegna merce", "riparazione vetrina", "fornitura sedie", "servizio catering"],
    proprie: [
      ["segna in Fornitori di chiamare la Peroni", { app: "cantiere_appunti", cartella: "Fornitori" }], ["metti in cartella Scadenze pagare F24 il 16", { app: "cantiere_appunti", cartella: "Scadenze" }],
      ["Magazzino: finiti i bicchieri", { app: "cantiere_appunti", cartella: "Magazzino" }], ["cosa c'è in Fornitori?", { card: /Fornitori/ }],
      ["crea una cartella Personale", { app: "cartelle" }],
    ],
  },
};
const IMPORTI = ["1.500", "300 euro", "2.000", "€ 800", "12mila"];
const TESTI = ["arrivo alle 10", "domani non posso venire", "il materiale è arrivato", "passo nel pomeriggio"];
const DA_FARE = ["comprare il silicone", "chiamare il commercialista", "ordinare il materiale", "pagare la bolletta"];
const PENSIERI = ["idea: mettere le foto dei lavori sul sito", "il furgone fa un rumore strano", "prezzo del rame salito del 10%"];
function frasiDi(k) {
  const m = MESTIERI[k];
  const [c1, c2, c3, c4] = m.clienti;
  const cognome = (c) => c.split(" ").slice(-1)[0];
  const f = [];
  m.lavori.forEach((lav, i) => {
    const cl = m.clienti[i % 4], imp = IMPORTI[i % IMPORTI.length];
    f.push([`fattura ${cl} ${imp} per ${lav}`, { server: "doc" }]);
    f.push([`fai preventivo a ${cl} per ${lav} da ${imp}`, { server: "doc" }]);
    f.push([`preventivo per ${cl} di ${imp} per ${lav}`, { server: "doc" }]);
    f.push([`domani alle ${8 + i} ${lav} da ${cognome(cl)}`, { effetto: true }]);
    f.push([`devo comprare il materiale per ${lav}`, { app: "cantiere_appunti" }]);
  });
  [c1, c2, c3, c4].forEach((cl, i) => {
    f.push([`chiama ${cl}`, { telefono: true }]); // scritto: apre subito il telefono (tel:), nessuna card
    f.push([`scrivi a ${cl} che ${TESTI[i % 3]}`, { server: "messages" }]);
    f.push([`fai un preventivo a ${cl}`, { card: /Per quale lavoro/ }]);
    f.push([`${cl} ha pagato ${IMPORTI[i % IMPORTI.length]}`, { avviso: /Incassato|Incasso/ }]);
    f.push([`fattura ${["Chilosi Mariagrazie", "Marco Tarelli", "Paola Contini", "Giorgio Salvini"][i]} ${IMPORTI[i]} per ${m.lavori[i]}`, { server: "doc" }]); // cliente nuovo
  });
  // Le stesse cose, con parole diverse
  [c1, c2, c3, c4].forEach((cl, i) => {
    f.push([`preventivo ${cognome(cl)} ${m.lavori[i]} ${IMPORTI[(i + 2) % IMPORTI.length]}`, { server: "doc" }]);
    f.push([`manda un messaggio a ${cl} che ${TESTI[(i + 1) % 4]}`, { server: "messages" }]);
    f.push([`ho incassato ${IMPORTI[(i + 1) % IMPORTI.length]} da ${cl}`, { avviso: /Incassato|Incasso/ }]);
    f.push([`${["venerdì alle 15", "lunedì ore 9", "dopodomani alle 11:30", "giovedì alle 18"][i]} ${m.lavori[(i + 1) % 4]} da ${cognome(cl)}`, { effetto: true }]);
    f.push([`${cognome(cl)} mi ha detto che ${["vuole anticipare i lavori", "il bagno lo vuole grigio", "paga a fine mese", "passa in ufficio"][i]}`, { effetto: true }]);
  });
  DA_FARE.forEach((t, i) => { f.push([`devo ${t}`, { app: "cantiere_appunti" }]); f.push([`${["domani", "venerdì", "lunedì"][i % 3]} ${t}`, { app: "tasks" }]); });
  PENSIERI.forEach((t) => f.push([t, { app: "cantiere_appunti" }]));
  ["quanto devo ancora incassare?", "chi non ha ancora pagato?", "quanto ho incassato questo mese?", "quanta iva ho questo mese?", "cosa ho da fare domani?", "sono libero giovedì alle 15?", "guarda se ho impegni sabato", "quanti clienti ho?"]
    .forEach((d) => f.push([d, { card: /./ }]));
  if (m.cantieri) f.push([`quanti ${m.cantieri} attivi ho?`, { card: /attiv/ }]);
  f.push(...m.proprie);
  // Ogni frase anche come la scriverebbe qualcuno di fretta
  // (una cartella già creata dalla frase di prima si riapre: lì basta che non usi l'AI e faccia qualcosa)
  const fretta = f.map(([t, e], i) => [[`eon ${t.toLowerCase()} grazie`, `per favore ${t}`, `${t.charAt(0).toUpperCase() + t.slice(1)}!`][i % 3], e.app === "cartelle" ? { effetto: true } : e]);
  return f.concat(fretta);
}

async function main() {
  const { default: handler } = await import("../api/index.js");
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  const riepilogo = [];
  try {
    for (const [mestiere, m] of Object.entries(MESTIERI)) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errori = [];
      page.on("pageerror", (e) => errori.push(e.message));
      await page.addInitScript(() => {
        window.__scritture = [];
        window.open = () => ({ document: { write() {}, close() {} }, close() {} });
        const catena = (tabella) => {
          const q = {
            select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
            update: () => ({ eq: async () => ({ error: null }) }), delete: () => ({ eq: async () => ({ error: null }) }),
            upsert: async () => ({ error: null }),
            insert: (riga) => { window.__scritture.push({ tabella, riga }); const r = { id: "n" + window.__scritture.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
            maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
            then: (ok) => ok({ data: [], error: null }),
          };
          return q;
        };
        window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
      });
      // Il server vero risponde all'app
      await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
      await page.route("**/api?action=assistant", async (route) => {
        const req = { method: "POST", url: "/api?action=assistant", headers: { authorization: "Bearer t" }, body: JSON.parse(route.request().postData() || "{}") };
        let uscita = "", stato = 200;
        const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
        try { await handler(req, res); stato = res.statusCode || 200; } catch (e) { stato = 500; uscita = JSON.stringify({ error: e.message }); }
        route.fulfill({ status: stato, contentType: "application/json", body: uscita || "{}" });
      });
      await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
      // Il suo mondo: i suoi clienti nel database del server e nell'app
      const clienti = m.clienti.map((name) => ({ id: randomUUID(), owner_id: UTENTE.id, name, phone: "333" + Math.floor(1000000 + Math.random() * 8999999), email: "", status: "attivo", value: 10000, deleted_at: null }));
      tabelle = { clients: clienti.map((c) => ({ ...c })), profiles: [{ id: UTENTE.id, profession: mestiere }], conversations: [], messages: [], tasks: [], incomes: [], assemblee: [], cartelle: [], cantiere_appunti: [], ai_request_log: [], ai_audit_log: [], ai_runs: [], eon_admin: [], app_errori: [] };
      await page.evaluate(async ([mestiere, clienti, cartelleNomi]) => {
        document.getElementById("onboardingScreen").style.display = "none";
        currentSession = { access_token: "t", user: { id: "11111111-1111-4111-8111-111111111111", email: "a@b.it" } };
        loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
        await applyProfession(mestiere, true);
        clients.length = 0; clienti.forEach((c) => clients.push({ id: c.id, name: c.name, phone: c.phone, email: c.email, status: "attivo", value: 10000, desc: "", archived: false, address: "Via Roma 1" }));
        cartelle.length = 0; (cartelleNomi || []).forEach((n, i) => cartelle.push({ id: "k" + i, nome: n })); renderCartelle();
        incomes.length = 0; clienti.forEach((c, i) => incomes.push({ id: "i" + i, client: c.name, clientId: c.id, amount: 1500, status: "attesa", desc: "Lavoro" }));
        try { localStorage.setItem("eon-promemoria-proposto", "1"); } catch (e) {}
      }, [mestiere, clienti, m.cartelle]);

      const frasi = frasiDi(mestiere);
      const sbagliate = [];
      let conCodice = 0;
      for (const [frase, atteso] of frasi) {
        const aiPrima = chiamateAI;
        const srvPrima = JSON.stringify({ d: (tabelle.messages || []).length, a: (tabelle.assemblee || []).length, t: (tabelle.tasks || []).length, c: (tabelle.cantiere_appunti || []).length });
        const st = await page.evaluate(async (frase) => {
          chiudiRisorsaCard(); navigateTo("home");
          document.getElementById("aiToastContainer").innerHTML = "";
          document.querySelectorAll(".ai-landing-overlay").forEach((o) => { o.style.display = "none"; });
          window.__scritture.length = 0;
          const paginaPrima = paginaAttuale;
          try { await eonInviaHome(frase); } catch (e) { return { errore: e.message }; }
          await new Promise((r) => setTimeout(r, 30));
          return {
            card: document.getElementById("risorsaOverlay").style.display === "flex" ? document.getElementById("risorsaTitolo").textContent + " | " + document.getElementById("risorsaCorpo").textContent.replace(/\s+/g, " ").slice(0, 120) : null,
            toast: document.getElementById("aiToastContainer").textContent.replace(/\s+/g, " ").trim().slice(0, 120),
            scritture: window.__scritture.map((s) => ({ tabella: s.tabella, riga: s.riga })),
            pagina: paginaAttuale, cambiata: paginaAttuale !== paginaPrima,
          };
        }, frase);
        const srvDopo = JSON.stringify({ d: (tabelle.messages || []).length, a: (tabelle.assemblee || []).length, t: (tabelle.tasks || []).length, c: (tabelle.cantiere_appunti || []).length });
        const usataAI = chiamateAI > aiPrima;
        const effetto = atteso.telefono || (!st.errore && (st.card || st.toast || st.scritture.length || st.cambiata || srvDopo !== srvPrima));
        const problemi = [];
        if (usataAI) problemi.push("ha usato l'AI");
        if (!effetto) problemi.push("non è successo niente");
        if (atteso.app && !st.scritture.some((s) => s.tabella === atteso.app && (!atteso.urgente || s.riga.urgente === true) && (!atteso.cartella || s.riga.cartella_id))) problemi.push("atteso scritto in " + atteso.app);
        if (atteso.card && !(st.card && atteso.card.test(st.card))) problemi.push("attesa card " + atteso.card);
        if (atteso.avviso && !atteso.avviso.test((st.card || "") + " " + st.toast)) problemi.push("atteso " + atteso.avviso);
        if (atteso.pagina && st.pagina !== atteso.pagina) problemi.push("attesa pagina " + atteso.pagina);
        if (atteso.server === "doc" && !(tabelle.messages || []).some((x) => x.event_type === "doc")) problemi.push("nessun documento sul server");
        if (atteso.server === "assemblee" && srvDopo === srvPrima) problemi.push("nessuna assemblea sul server");
        if (atteso.server === "messages" && srvDopo === srvPrima) problemi.push("nessun messaggio sul server");
        if (problemi.length) sbagliate.push(`«${frase}» — ${problemi.join(", ")} ${JSON.stringify(st).slice(0, 220)}`);
        else conCodice++;
      }
      const pct = Math.round(conCodice / frasi.length * 1000) / 10;
      riepilogo.push(`${mestiere}: ${conCodice}/${frasi.length} (${pct}%)`);
      verifica(`${mestiere}: ${frasi.length} frasi, ${conCodice} fatte bene col codice (${pct}%)`, sbagliate.length === 0, sbagliate.length + " sbagliate");
      (ELENCO ? sbagliate : sbagliate.slice(0, 6)).forEach((x) => console.log("      " + x));
      verifica(`${mestiere}: nessun errore nella pagina`, errori.length === 0, JSON.stringify(errori.slice(0, 3)));
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log("\nUtente virtuale per professione: " + riepilogo.join(" · "));
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
