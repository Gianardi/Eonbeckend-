/* Test del Calendario rifatto (25/09/2026): tasto Indietro, settimana in
   alto, niente doppioni ("DA FARE"/"da fare", nome ripetuto sotto il
   titolo), elimina scorrendo a sinistra con Annulla.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/calendario.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8981;
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
          update: (patch) => ({ eq: async (col, val) => { window.__scritture.push({ tabella, patch, id: val }); return { error: null }; } }),
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) },
      }) };
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      const fra = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }).replace(".", ""); };
      chats.length = 0;
      clients.length = 0;
      clients.push({ id: "c1", name: "Giampiero Dini", phone: "333", status: "attivo", desc: "" });
      tasks.length = 0;
      tasks.push(
        { id: "t1", title: "Inviare fattura n. 3/2026 al cliente Fabbri", status: "todo", time: "Domani, 08:00" },
        { id: "t2", title: "Appuntamento con Dini", status: "todo", time: "Domani, 10:00", clienteCollegato: "Giampiero Dini" },
        { id: "t3", title: "Giampiero Dini", status: "todo", time: "Domani, 11:00", clienteCollegato: "Giampiero Dini" },
        { id: "t4", title: "Chiamata Valter", status: "todo", time: fra(3) + ", 10:00" },
        ...[8, 9, 10, 11, 12, 14].map((h) => ({ id: "v" + h, title: "Cantiere via Roma, giro " + h, status: "todo", time: fra(5) + ", " + h + ":00" })),
      );
      navigateTo("clienti");
      navigateTo("calendario");
      renderCalendar();
    });

    const vista = await page.evaluate(() => ({
      giorni: [...document.querySelectorAll("#calSettimana .cal-sett-giorno")].map((b) => ({ nome: b.querySelector(".cal-sett-nome").textContent, punti: b.querySelectorAll(".cal-sett-punti i").length, attivo: !b.disabled })),
      righe: [...document.querySelectorAll("#calendarList .cal-voce")].map((r) => ({ ora: r.querySelector(".cal-ora").textContent, titolo: r.querySelector(".cal-nome").textContent, meta: r.querySelector(".cal-meta").innerText.replace(/\s+/g, " ").trim() })),
      riepilogo: document.querySelector(".cal-riepilogo").innerText,
      domani: (document.querySelector(".cal-giorno .cal-giorno-nome") || {}).textContent,
    }));
    verifica("settimana in alto: 7 giorni, si parte da oggi", vista.giorni.length === 7 && vista.giorni[0].nome === "oggi", JSON.stringify(vista.giorni));
    verifica("domani ha 3 pallini ed è toccabile, i giorni vuoti no", vista.giorni[1].punti === 3 && vista.giorni[1].attivo && !vista.giorni[2].attivo, JSON.stringify(vista.giorni));
    verifica("ora su una riga (\"08:00\"), in ordine", JSON.stringify(vista.righe.slice(0, 5).map((r) => r.ora)) === '["08:00","10:00","11:00","10:00","08:00"]', JSON.stringify(vista.righe));
    verifica("niente \"da fare\" ripetuto sotto \"Da fare\"", vista.righe[0].meta === "Da fare", vista.righe[0].meta);
    verifica("niente nome ripetuto: \"Giampiero Dini\" non si riscrive sotto sé stesso", vista.righe[2].meta === "Da fare", vista.righe[2].meta);
    verifica("il nome del cliente sotto quando aggiunge qualcosa", /Giampiero Dini/.test(vista.righe[1].meta), vista.righe[1].meta);
    verifica("riepilogo: \"10 impegni in arrivo\"", vista.riepilogo === "10 impegni in arrivo", vista.riepilogo);

    // Tocco su un giorno della settimana: porta ai suoi impegni
    await page.evaluate(() => window.scrollTo(0, 0));
    const primaDelTocco = await page.evaluate(() => Math.round([...document.querySelectorAll(".cal-giorno")].at(-1).getBoundingClientRect().top));
    await page.click("#calSettimana .cal-sett-giorno:nth-child(6)");
    await page.waitForTimeout(800);
    const scorso = await page.evaluate(() => Math.round([...document.querySelectorAll(".cal-giorno")].at(-1).getBoundingClientRect().top));
    verifica("tocco su un giorno: la pagina va ai suoi impegni", scorso < primaDelTocco - 200 && scorso < 400, primaDelTocco + " → " + scorso);

    // Elimina scorrendo a sinistra, con Annulla
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await page.locator("#calendarList .cal-voce").first().boundingBox();
    const x = box.x + box.width - 30, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x - 15 * i, y);
    await page.mouse.up();
    await page.waitForTimeout(250);
    await page.locator("#calendarList .scorri-wrap").first().locator(".scorri-elimina").click();
    await page.waitForTimeout(200);
    const dopo = await page.evaluate(() => ({ titoli: [...document.querySelectorAll("#calendarList .cal-nome")].map((e) => e.textContent), scritture: window.__scritture.slice(), avviso: document.getElementById("aiToastContainer").textContent }));
    verifica("scorro e tocco Elimina: l'impegno va nel cestino, senza domande", !dopo.titoli.includes("Inviare fattura n. 3/2026 al cliente Fabbri") && dopo.scritture.length === 1 && dopo.scritture[0].tabella === "tasks" && dopo.scritture[0].id === "t1" && /Impegno nel cestino/.test(dopo.avviso), JSON.stringify(dopo));
    await page.evaluate(() => [...document.querySelectorAll("#aiToastContainer .ai-toast-yes")].at(-1).click());
    await page.waitForTimeout(200);
    const ripreso = await page.evaluate(() => ({ primo: document.querySelector("#calendarList .cal-nome").textContent, ultima: window.__scritture.at(-1) }));
    verifica("Annulla: l'impegno torna al suo posto", ripreso.primo === "Inviare fattura n. 3/2026 al cliente Fabbri" && ripreso.ultima.patch.deleted_at === null, JSON.stringify(ripreso));

    // Indietro: torna alla pagina di prima
    await page.click("#calIndietro");
    verifica("Indietro: torna dov'eri (Clienti)", await page.evaluate(() => paginaAttuale === "clienti" && document.getElementById("page-clienti").classList.contains("visible")));
    await page.evaluate(() => { navigateTo("calendario"); navigateTo("calendario"); });
    await page.click("#calIndietro");
    verifica("aperto due volte di fila: Indietro non resta sul Calendario", await page.evaluate(() => paginaAttuale !== "calendario"));
    const vuoto = await page.evaluate(() => { tasks.length = 0; chats.length = 0; navigateTo("calendario"); renderCalendar(); return { vuoto: !!document.querySelector("#calendarList .cal-vuoto"), giorni: document.querySelectorAll("#calSettimana .cal-sett-giorno:disabled").length, riepilogo: document.querySelector(".cal-riepilogo").innerText }; });
    verifica("nessun impegno: messaggio chiaro, settimana tutta vuota", vuoto.vuoto && vuoto.giorni === 7 && vuoto.riepilogo === "0 impegni in arrivo", JSON.stringify(vuoto));
    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
