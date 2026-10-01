/* "Manda il preventivo a X" quando il preventivo non c'è ancora (1/10/2026, Gianardi:
   "si dovrebbe dire che bisogna fare il preventivo perché non l'abbiamo ancora fatto, e ti
   dà subito la possibilità di farlo"): EON lo dice e chiede "Lo facciamo adesso?"; con
   "Sì" parte il preventivo per quel cliente e quel lavoro, e chiede solo l'importo.
   Browser vero, Supabase finto, server finto (si guarda il comando che gli arriva).
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/documento-da-fare-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9039;
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
      const catena = () => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: () => ({ eq: async () => ({ error: null }), in: async () => ({ error: null }) }),
          delete: () => ({ eq: async () => ({ error: null }) }), upsert: async () => ({ error: null }),
          insert: (riga) => { const r = { id: "n" + Math.random(), created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
      window.__aperti = [];
      window.open = (u) => { window.__aperti.push(u); return {}; };
    });
    const richieste = [];
    await page.route("**/api?action=*", (route) => {
      const a = new URL(route.request().url()).searchParams.get("action");
      if (a === "assistant") richieste.push(JSON.parse(route.request().postData() || "{}"));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      await applyProfession("edile", true);
      clients.length = 0;
      clients.push({ id: "c1", name: "Condominio I Pini", phone: "", email: "amm@ipini.it", status: "attivo", value: 0, desc: "", archived: false });
      clients.push({ id: "c2", name: "Mario Rossi", phone: "3331234567", email: "", status: "attivo", value: 0, desc: "", archived: false });
      clients.push({ id: "c3", name: "Bar Aurora", phone: "", email: "", status: "attivo", value: 0, desc: "", archived: false });
      chats.length = 0;
      chats.push({ name: "Mario Rossi", messages: [{ id: "m1", eventType: "doc", createdAt: "2026-09-30T10:00:00Z", docDati: { tipo: "preventivo", numero: "3", anno: 2026, cliente: "Mario Rossi", totale: 1220, voci: [] } }] });
      try { localStorage.setItem("eon-promemoria-proposto", "1"); } catch (e) {}
    });

    const scrivi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; });
      await page.fill("#homeHeroCampo", frase);
      await page.evaluate(() => document.getElementById("homeHeroSend").click());
      await page.waitForTimeout(600);
    };
    const card = () => page.evaluate(() => ({ aperta: document.getElementById("risorsaOverlay").style.display === "flex", titolo: document.getElementById("risorsaTitolo").textContent, corpo: document.getElementById("risorsaCorpo").innerText }));
    const tocca = async (testo) => { await page.evaluate((t) => [...document.querySelectorAll("#risorsaCorpo .scheda-scelta")].find((b) => b.textContent === t).click(), testo); await page.waitForTimeout(400); };

    // 1) La frase di Andrea: il preventivo non c'è → lo dice e chiede se farlo
    let n0 = richieste.length;
    await scrivi("manda per mail al condominio i pini il preventivo del cornicione");
    let c = await card();
    verifica("dice che il preventivo non c'è ancora e chiede \"Lo facciamo adesso?\"", c.aperta && /non c'è ancora/.test(c.titolo) && /Il preventivo per Condominio I Pini \(cornicione\) non l'abbiamo ancora fatto\. Lo facciamo adesso\?/.test(c.corpo) && /Sì, facciamolo/.test(c.corpo) && /\bNo\b/.test(c.corpo), JSON.stringify(c));
    verifica("…senza AI e senza aprire la Mail", richieste.length === n0 && !(await page.evaluate(() => window.__aperti.length)));
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO }); // FOTO=file.png: com'è la card

    // 2) "Sì, facciamolo": chiede solo l'importo, poi il preventivo parte per quel cliente e quel lavoro
    await tocca("Sì, facciamolo");
    c = await card();
    verifica("\"Sì\": chiede solo l'importo", c.aperta && c.titolo === "Nuovo preventivo" && /Quanto\? \(IVA esclusa\)/.test(c.corpo), JSON.stringify(c));
    await page.fill("#domandaCodiceCampo", "1.800");
    await page.click("#domandaCodiceInvia");
    await page.waitForTimeout(800);
    const r = richieste[richieste.length - 1] || {};
    const cmd = r.comando || {};
    verifica("il preventivo parte: Condominio I Pini, cornicione, 1.800", richieste.length === n0 + 1 && cmd.azione === "documento" && cmd.tipo === "preventivo" && cmd.cliente_id === "c1" && /cornicione/i.test(cmd.lavoro || "") && cmd.importo === 1800, JSON.stringify(r).slice(0, 400));

    // 3) "No": si chiude e basta
    n0 = richieste.length;
    await scrivi("invia la fattura del montaggio al Bar Aurora");
    c = await card();
    verifica("fattura che non c'è: \"La fattura per Bar Aurora (montaggio) non l'abbiamo ancora fatta\"", c.aperta && /La fattura per Bar Aurora \(montaggio\) non l'abbiamo ancora fatta\. La facciamo adesso\?/.test(c.corpo), JSON.stringify(c));
    await tocca("No");
    c = await card();
    verifica("\"No\": la card si chiude, niente al server", !c.aperta && richieste.length === n0, JSON.stringify(c));

    // 4) Senza lavoro nella frase: "Sì" chiede prima il lavoro
    await scrivi("manda il preventivo al Bar Aurora");
    c = await card();
    verifica("senza lavoro: \"Il preventivo per Bar Aurora non l'abbiamo ancora fatto\"", c.aperta && /Il preventivo per Bar Aurora non l'abbiamo ancora fatto/.test(c.corpo), JSON.stringify(c));
    await tocca("Sì, facciamolo");
    c = await card();
    verifica("…\"Sì\": chiede per quale lavoro", /Per quale lavoro\?/.test(c.corpo), JSON.stringify(c));

    // 5) Da non toccare: il preventivo che c'è si manda come prima; il numero che non c'è
    await scrivi("invia il preventivo a Mario Rossi");
    c = await card();
    verifica("preventivo che c'è: WhatsApp aperto come prima", /Preventivo 3/.test(c.titolo) && (await page.evaluate(() => window.__aperti.some((u) => /wa\.me\/393331234567/.test(u)))), JSON.stringify(c));
    await scrivi("manda la fattura 7 a Mario Rossi");
    c = await card();
    verifica("fattura col numero che non c'è: \"Non trovo una fattura n. 7\" come prima", /Non trovo una fattura n\. 7/.test(c.corpo), JSON.stringify(c));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
