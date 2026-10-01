/* Domande sui propri dati dette chiare (1/10/2026, giri 16-20: andavano all'AI): l'ultima volta
   da un cliente, il suo numero, gli incassi della settimana, le fatture non pagate, il punto della
   settimana. Risponde il codice, con i dati veri; quello che EON non sa (contanti o bonifico) lo dice.
   Browser vero, Supabase finto. Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/domande-dati-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9038;
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
      window.__db = [];
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: (patch) => ({
            eq: async (c, v) => { window.__db.push({ tabella, op: "update", ids: [v], patch }); return { error: null }; },
            in: async (c, v) => { window.__db.push({ tabella, op: "update", ids: v, patch }); return { error: null }; },
          }),
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: (riga) => { window.__db.push({ tabella, op: "insert", riga }); const r = { id: tabella + window.__db.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://file.test/" + p } }) }) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
    });
    let chiamateServer = 0;
    await page.route("**/api?action=*", (route) => { if (new URL(route.request().url()).searchParams.get("action") === "assistant") chiamateServer++; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }); });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t"; descriviFoto = () => {};
      await applyProfession("edile", true);
      clients.length = 0;
      clients.push({ id: "c1", name: "Famiglia Tosi", phone: "", status: "attivo", value: 0, desc: "", archived: false });
      clients.push({ id: "c2", name: "Carrozzeria Merlo", phone: "333 1234567", status: "attivo", value: 0, desc: "", archived: false });
      const fa = (g) => { const d = new Date(); d.setDate(d.getDate() - g); return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }).replace(".", "") + ", 10:00"; };
      window.__fa = fa(6);
      tasks.length = 0;
      tasks.push({ id: "t1", title: "Sopralluogo tetto Tosi", owner: "user", status: "done", time: fa(6) });
      tasks.push({ id: "t2", title: "Misure Tosi", owner: "user", status: "done", time: fa(20) });
      incomes.length = 0;
      incomes.push({ id: "i1", client: "Famiglia Tosi", clientId: "c1", amount: 300, status: "incassato", desc: "Acconto", created: new Date().toISOString() });
      incomes.push({ id: "i2", client: "Carrozzeria Merlo", clientId: "c2", amount: 150, status: "incassato", desc: "Riparazione", created: new Date().toISOString() });
    });
    const scritte = (op, tab) => page.evaluate(([op, tab]) => window.__db.filter((x) => x.op === op && x.tabella === tab), [op, tab]);
    const toast = () => page.evaluate(() => document.getElementById("aiToastContainer").innerText);

    const scrivi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; document.querySelectorAll(".ai-landing-overlay").forEach((o) => { o.style.display = "none"; }); });
      await page.fill("#homeHeroCampo", frase);
      await page.evaluate(() => document.getElementById("homeHeroSend").click());
      await page.waitForTimeout(600);
    };
    const vista = () => page.evaluate(() => [document.getElementById("risorsaOverlay").style.display === "flex" ? document.getElementById("risorsaTitolo").textContent + " | " + document.getElementById("risorsaCorpo").innerText : "", ...[...document.querySelectorAll(".ai-landing-overlay")].filter((o) => o.style.display !== "none" && o.offsetParent !== null).map((o) => o.innerText)].join(" ").replace(/\s+/g, " "));
    const prova = async (frase, re, nome) => {
      const s0 = chiamateServer;
      await scrivi(frase);
      const v = await vista();
      verifica(nome + " (senza AI)", re.test(v) && chiamateServer === s0, JSON.stringify({ v: v.slice(0, 200), ai: chiamateServer - s0 }));
    };
    await prova("quand'è l'ultima volta che sono stato dai Tosi?", /L'ultima volta.*6 giorni fa.*Sopralluogo tetto Tosi/, "l'ultima volta dai Tosi: 6 giorni fa, il sopralluogo");
    await prova("quant'è che non vado dalla Bianchi", /Non trovo appuntamenti passati con Bianchi/, "mai stato dalla Bianchi: lo dice");
    await prova("il numero del Merlo della carrozzeria ce l'ho?", /333 1234567/, "il numero del Merlo: sì, ed è quello");
    await prova("il numero dei Tosi ce l'ho?", /Non ho il numero di Famiglia Tosi\. Me lo dici\? Lo salvo\./, "i Tosi senza numero: lo dice e lo chiede per salvarlo"); // 1/10/2026
    await prova("quanti soldi ho preso in contanti questa settimana", /Incassati.*450.*Contanti o bonifico/, "incassi della settimana (contanti: lo dice onesto)");
    await prova("fammi vedé le fatture non pagate", /Nessuno ti deve soldi|ti deve|Hai incassato tutto/i, "fatture non pagate: chi deve ancora");
    await prova("fammi il punto dei lavori di questa settimana", /settimana|Settimana/, "il punto della settimana");
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
