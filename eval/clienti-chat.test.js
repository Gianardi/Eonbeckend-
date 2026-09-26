/* Test "un cliente, una chat" (25/09/2026): cliente e chat sono la
   stessa persona. Archiviarlo, cestinarlo, rinominarlo o crearlo da una
   parte vale anche dall'altra; archiviare chiede conferma; il nome si
   confronta senza badare alle maiuscole; niente "null" sulle schede.
   Più: Messaggi nel Menu, Cresci in "Lavori in corso", e la foto che
   non crea più un cliente da una nota ("Da cambiare").
   Carica la vera index.html con Supabase e AI finti.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/clienti-chat.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8979;
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
    await page.addInitScript(() => {
      window.__scritture = [];
      const catena = (tabella) => {
        const q = {
          update: (patch) => ({ eq: async (col, val) => { window.__scritture.push({ tabella, tipo: "update", patch, id: val }); return { error: null }; } }),
          insert: (riga) => ({ select: () => ({ single: async () => { const r = { id: tabella + "-nuova-" + window.__scritture.length, created_at: new Date().toISOString(), ...riga }; window.__scritture.push({ tabella, tipo: "insert", riga }); return { data: r, error: null }; } }) }),
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q,
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "https://file.test/x.jpg" } }) }) },
        auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) },
      }) };
    });
    let rispostaAI = null;
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
      window.__scritture.length = 0;
      clients.length = 0;
      clients.push(
        { id: "c-rossi", name: "Mario Rossi", status: "attivo", value: 0, desc: "", last: "", phone: "", archived: false },
        { id: "c-marti", name: "Martina ceradelli", status: "attivo", value: 0, desc: "", last: "", phone: "", archived: true },
        { id: "c-dini", name: "Dini", status: "attivo", value: 0, desc: "", last: "", phone: "", archived: false },
      );
      chats.length = 0;
      const chat = (id, name) => ({ id, name, isClient: true, isProspect: false, archived: false, unread: 0, messages: [], toSeeToday: false, toCallToday: false, color: "#888" });
      chats.push(chat("v-rossi", "Mario Rossi"), chat("v-marti", "Martina Ceradelli"), chat("v-dini", "Dini"));
      activeChatIndex = null;
      chatFilter = null;
      renderClientArchive(); renderChatList();
    });
    const nomiInChat = (filtro) => page.evaluate((f) => { chatFilter = f; renderChatList(); return [...document.querySelectorAll("#chatList .chat-item-name, #chatList .chat-name")].map((e) => e.textContent.trim()); }, filtro);
    const scritture = () => page.evaluate(() => window.__scritture.slice());

    /* ---- Menu e Cresci ---- */
    await prepara();
    const menu = await page.evaluate(() => {
      navigateTo("gestisci-azienda");
      const card = document.getElementById("menuMessaggi");
      const primo = document.querySelector("#page-gestisci-azienda .azienda-list .azienda-link-card");
      card.click();
      return { primo: primo && primo.id, chatAperta: document.getElementById("page-chat").classList.contains("visible") };
    });
    verifica("Menu: \"Messaggi\" è la prima voce e apre le chat", menu.primo === "menuMessaggi" && menu.chatAperta, JSON.stringify(menu));
    const voci = await page.evaluate(() => {
      navigateTo("gestisci-azienda");
      const titoli = (sel) => [...document.querySelectorAll(sel + " .azienda-link-card .module-title")].map((e) => e.textContent.trim());
      const menu = titoli("#page-gestisci-azienda > .azienda-list");
      document.getElementById("menuImpostazioni").click();
      return { menu, impostazioni: titoli("#page-impostazioni > .azienda-list"), aperta: document.getElementById("page-impostazioni").classList.contains("visible") };
    });
    verifica("Menu pulito: senza \"EON AI\" e \"Cambia professione\", con Impostazioni in fondo", !voci.menu.includes("EON AI") && !voci.menu.includes("Cambia professione") && voci.menu.at(-1) === "Impostazioni", JSON.stringify(voci.menu));
    verifica("Impostazioni: Account, Profilo, Sicurezza, Aiuto, Esci, Elimina account", voci.aperta && JSON.stringify(voci.impostazioni) === '["Account","Profilo","Sicurezza","Aiuto","Esci","Elimina account"]', JSON.stringify(voci));
    const registro = await page.evaluate(() => { document.querySelector('#page-impostazioni [data-page="ai-request-log"]').click(); const indietro = document.querySelector("#page-ai-request-log .back-link"); indietro.click(); return document.querySelector(".page.visible").id; });
    verifica("dal Registro AI si torna alle Impostazioni", registro === "page-impostazioni", registro);

    const cresci = await page.evaluate(() => {
      navigateTo("cresci");
      const p = document.getElementById("page-cresci");
      const box = p.querySelector(".lavori-in-corso");
      const vistoBox = !!box && box.offsetParent !== null;
      const vecchioNascosto = document.getElementById("addOppBtn").offsetParent === null;
      navigateTo("home"); renderSummary();
      return {
        titolo: box && box.querySelector("h2").textContent,
        vistoBox, vecchioNascosto,
        homeVersoCresci: document.querySelectorAll('.summary-row[data-page="cresci"]').length,
      };
    });
    verifica("Cresci: mostra \"Lavori in corso\", il vecchio contenuto è nascosto", cresci.titolo === "Lavori in corso" && cresci.vistoBox && cresci.vecchioNascosto, JSON.stringify(cresci));
    verifica("Home: nessuna riga porta più a Cresci", cresci.homeVersoCresci === 0, JSON.stringify(cresci));

    /* ---- Archivio: una sola decisione per cliente e chat ---- */
    await prepara();
    const chatAttive = await nomiInChat(null);
    const chatArchivio = await nomiInChat("archivio");
    verifica("chat di un cliente archiviato (\"Martina Ceradelli\" / \"Martina ceradelli\"): solo in Archivio", !chatAttive.includes("Martina Ceradelli") && chatArchivio.includes("Martina Ceradelli"), JSON.stringify({ chatAttive, chatArchivio }));

    let domande = [];
    page.on("dialog", (d) => { domande.push(d.message()); (page.__risposta === false ? d.dismiss() : d.accept()); });
    const clickArchivia = (nome) => page.evaluate((n) => {
      navigateTo("clienti");
      const card = [...document.querySelectorAll(".client-archive-card")].find((c) => c.textContent.includes(n));
      card.querySelector(".client-archive-btn").click();
    }, nome);

    page.__risposta = false; domande = [];
    await clickArchivia("Mario Rossi");
    await page.waitForTimeout(150);
    verifica("archiviare chiede conferma; con \"Annulla\" non cambia niente", domande.length === 1 && /Archiviare "Mario Rossi"/.test(domande[0]) && (await scritture()).length === 0, JSON.stringify({ domande, s: await scritture() }));

    page.__risposta = true; domande = [];
    await clickArchivia("Mario Rossi");
    await page.waitForTimeout(150);
    let s = await scritture();
    verifica("archiviato il cliente: archiviata anche la sua chat", s.some((w) => w.tabella === "clients" && w.id === "c-rossi" && w.patch.is_archived === true) && s.some((w) => w.tabella === "conversations" && w.id === "v-rossi" && w.patch.is_archived === true), JSON.stringify(s));
    verifica("e la chat sparisce dalla lista (resta in Archivio)", !(await nomiInChat(null)).includes("Mario Rossi") && (await nomiInChat("archivio")).includes("Mario Rossi"));

    await prepara();
    await page.evaluate(() => { activeChatIndex = chats.findIndex((c) => c.id === "v-marti"); document.getElementById("chatArchiviaBtn").click(); });
    await page.waitForTimeout(150);
    s = await scritture();
    verifica("dalla chat \"togli dall'archivio\": torna attivo anche il cliente", s.some((w) => w.tabella === "clients" && w.id === "c-marti" && w.patch.is_archived === false) && s.some((w) => w.tabella === "conversations" && w.id === "v-marti" && w.patch.is_archived === false), JSON.stringify(s));

    /* ---- Cestino: insieme ---- */
    await prepara();
    domande = [];
    await page.evaluate(() => { activeChatIndex = chats.findIndex((c) => c.id === "v-dini"); document.getElementById("chatEliminaBtn").click(); });
    await page.waitForTimeout(150);
    s = await scritture();
    const cestinati = s.filter((w) => w.patch && w.patch.deleted_at).map((w) => w.tabella + ":" + w.id).sort();
    verifica("elimino la chat: nel cestino anche il cliente (e la domanda lo dice)", JSON.stringify(cestinati) === '["clients:c-dini","conversations:v-dini"]' && /insieme la chat e la scheda del cliente/.test(domande[0] || ""), JSON.stringify({ cestinati, domande }));
    verifica("Dini sparisce da clienti e da chat", await page.evaluate(() => !clients.some((c) => c.name === "Dini") && !chats.some((c) => c.name === "Dini")));

    await prepara();
    await page.evaluate(() => { openSheet("cliente", clients.find((c) => c.id === "c-rossi")); document.getElementById("sheetDeleteBtn").click(); });
    await page.waitForTimeout(150);
    s = await scritture();
    verifica("elimino il cliente dalla scheda: nel cestino anche la chat", JSON.stringify(s.filter((w) => w.patch && w.patch.deleted_at).map((w) => w.tabella + ":" + w.id).sort()) === '["clients:c-rossi","conversations:v-rossi"]', JSON.stringify(s));

    /* ---- Nome e cliente nuovo ---- */
    await prepara();
    await page.evaluate(() => {
      openSheet("cliente", clients.find((c) => c.id === "c-rossi"));
      document.querySelector('#sheetBody [data-field="name"]').value = "Mario Rossini";
      document.getElementById("sheetSaveBtn").click();
    });
    await page.waitForTimeout(200);
    s = await scritture();
    verifica("rinomino il cliente: la chat prende il nome nuovo", s.some((w) => w.tabella === "conversations" && w.id === "v-rossi" && w.patch.contact_name === "Mario Rossini") && (await page.evaluate(() => chats.find((c) => c.id === "v-rossi").name)) === "Mario Rossini", JSON.stringify(s));

    await prepara();
    await page.evaluate(() => {
      openSheet("cliente");
      document.querySelector('#sheetBody [data-field="name"]').value = "Anna Verdi";
      document.getElementById("sheetSaveBtn").click();
    });
    await page.waitForTimeout(300);
    s = await scritture();
    verifica("cliente nuovo: nasce anche la sua chat", s.some((w) => w.tipo === "insert" && w.tabella === "clients" && w.riga.name === "Anna Verdi") && s.some((w) => w.tipo === "insert" && w.tabella === "conversations" && w.riga.contact_name === "Anna Verdi"), JSON.stringify(s.map((w) => w.tabella + ":" + w.tipo)));
    verifica("e compare subito in Messaggi", (await nomiInChat(null)).includes("Anna Verdi"));

    await prepara();
    const nulle = await page.evaluate(() => { navigateTo("clienti"); renderClientArchive(); return document.getElementById("page-clienti").innerText.match(/null|undefined/g); });
    verifica("schede clienti: nessun \"null\"/\"undefined\"", !nulle, JSON.stringify(nulle));
    const card = await page.evaluate(() => {
      clients[0].desc = "Rifacimento bagno: piastrelle e sanitari"; clients[2].desc = "";
      renderClientArchive();
      const testo = document.getElementById("page-clienti").innerText;
      return { ultimo: /Ultimo contatto/.test(testo), pill: document.querySelectorAll(".client-archive-card .pill").length, lavoro: [...document.querySelectorAll(".client-archive-card .client-lavoro")].map((e) => e.textContent.trim()) };
    });
    verifica("card cliente: niente stato né \"Ultimo contatto\", solo il lavoro da fare", !card.ultimo && card.pill === 0 && card.lavoro.includes("Rifacimento bagno: piastrelle e sanitari") && card.lavoro.includes("+ Scrivi cosa c'è da fare"), JSON.stringify(card));

    /* ---- Foto: la nota non diventa un cliente ---- */
    const note = await page.evaluate(() => ({
      virgola: notaDopoIlNome("Rossi, porta da cambiare", "Rossi"),
      soloNome: notaDopoIlNome("Lavoro cliente Rossi Mario", "Mario Rossi"),
      dopo: notaDopoIlNome("Da cambiare per Rossi", "Rossi"),
      voce: notaDopoIlNome("rossi porta scorrevole da cambiare", "Mario Rossi"),
    }));
    verifica("nota separata dal nome (\"Rossi, porta da cambiare\" → \"Porta da cambiare\")", note.virgola === "Porta da cambiare" && note.soloNome === "" && note.dopo === "Da cambiare" && note.voce === "Porta scorrevole da cambiare", JSON.stringify(note));

    await prepara();
    const foto = { id: "f9", url: "https://file.test/9.jpg", created: new Date().toISOString(), clientId: null, nota: "", descrizione: "x" };
    await page.evaluate((f) => { cantiereFoto.length = 0; cantiereFoto.push(f); apriTagFotoCantiere(f); }, foto);
    rispostaAI = { stato: "concluso", testo: "A quale cliente si riferisce?", azioni: [] };
    await page.fill("#cantiereFotoTagCampo", "da cambiare e trovare modello uguale");
    await page.click("#cantiereFotoTagSend");
    await page.waitForFunction(() => /A quale cliente/.test(document.getElementById("cantiereFotoTagHint").textContent) && !document.getElementById("cantiereFotoTagSend").disabled, null, { timeout: 3000 });
    const senzaNome = await page.evaluate(() => ({ aperto: document.getElementById("cantiereFotoTagOverlay").style.display === "flex", scritture: window.__scritture.length }));
    verifica("foto con solo una nota: chiede a quale cliente, nessun cliente creato", senzaNome.aperto && senzaNome.scritture === 0, JSON.stringify(senzaNome));
    verifica("all'AI si dice di non creare un cliente da una nota", /NON chiamare nessuno strumento/.test(richiesteAI.at(-1) || ""));

    rispostaAI = { stato: "concluso", testo: "Fatto.", azioni: [{ tool: "trova_o_crea_cliente", esito: { id: "c-rossi", nome: "Mario Rossi", creato: false } }] };
    await page.fill("#cantiereFotoTagCampo", "Rossi, porta da cambiare");
    await page.click("#cantiereFotoTagSend");
    await page.waitForFunction(() => document.getElementById("cantiereFotoTagOverlay").style.display === "none", null, { timeout: 3000 });
    await page.waitForTimeout(150);
    const conNome = await page.evaluate(() => ({ foto: cantiereFoto[0], scheda: (document.querySelector(".scheda-foto-nota") || {}).textContent, scritture: window.__scritture.slice() }));
    verifica("\"Rossi, porta da cambiare\": foto a Rossi, nota \"Porta da cambiare\"", conNome.foto.clientId === "c-rossi" && conNome.foto.nota === "Porta da cambiare" && conNome.scheda === "Porta da cambiare", JSON.stringify(conNome));

    /* ---- Scorri a sinistra per eliminare ---- */
    const trascina = async (sel, dx, dy = 0) => {
      const r = await page.locator(sel).first().boundingBox();
      const x = r.x + r.width - 30, y = r.y + r.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
      await page.mouse.up();
      await page.waitForTimeout(250);
    };
    await prepara();
    await page.evaluate(() => { chiudiRisorsaCard(); document.getElementById("aiToastContainer").innerHTML = ""; navigateTo("chat"); chatFilter = null; renderChatList(); });
    const selDini = '#chatList .scorri-wrap:has(.chat-item-name:text-is("Dini")) .chat-item';
    await page.locator(selDini).first().scrollIntoViewIfNeeded();
    await trascina(selDini, -20);
    verifica("scorrimento corto: la riga torna al suo posto, niente si apre", await page.evaluate(() => [...document.querySelectorAll("#chatList .scorri-elimina")].every((b) => parseFloat(b.style.width || "0") === 0) && !document.getElementById("chatSlider").classList.contains("show-conv")));
    await trascina(selDini, -12, 80);
    verifica("scorrimento in verticale: è uno scroll, non apre Elimina", await page.evaluate(() => [...document.querySelectorAll("#chatList .scorri-elimina")].every((b) => parseFloat(b.style.width || "0") === 0)));
    await trascina(selDini, -120);
    const aperta = await page.evaluate(() => { const w = [...document.querySelectorAll("#chatList .scorri-wrap")].find((x) => x.textContent.includes("Dini")); const b = w.querySelector(".scorri-elimina"); return { larghezza: b.getBoundingClientRect().width, testo: b.textContent, chatAperta: document.getElementById("chatSlider").classList.contains("show-conv") }; });
    verifica("scorro la chat a sinistra: compare \"Elimina\" rosso, la chat non si apre", aperta.larghezza > 70 && aperta.testo === "Elimina" && !aperta.chatAperta, JSON.stringify(aperta));
    domande = [];
    await page.locator('#chatList .scorri-wrap:has(.chat-item-name:text-is("Dini")) .scorri-elimina').click();
    await page.waitForTimeout(200);
    s = await scritture();
    verifica("tocco Elimina: chat e cliente nel cestino, senza domande", JSON.stringify(s.filter((w) => w.patch && w.patch.deleted_at).map((w) => w.tabella + ":" + w.id).sort()) === '["clients:c-dini","conversations:v-dini"]' && domande.length === 0, JSON.stringify({ s, domande }));
    verifica("avviso \"Chat e cliente nel cestino\" con Annulla", await page.evaluate(() => /Chat e cliente nel cestino/.test(document.getElementById("aiToastContainer").textContent) && !(nomi => nomi.includes("Dini"))([...document.querySelectorAll("#chatList .chat-item-name")].map((e) => e.textContent))));
    await page.evaluate(() => [...document.querySelectorAll("#aiToastContainer .ai-toast-yes")].at(-1).click());
    await page.waitForTimeout(200);
    s = await scritture();
    verifica("Annulla: chat e cliente tornano", s.some((w) => w.tabella === "conversations" && w.id === "v-dini" && w.patch.deleted_at === null) && s.some((w) => w.tabella === "clients" && w.id === "c-dini" && w.patch.deleted_at === null) && (await nomiInChat(null)).includes("Dini") && (await page.evaluate(() => clients.some((c) => c.id === "c-dini"))), JSON.stringify(s));

    // Messaggio singolo
    await prepara();
    await page.evaluate(() => {
      document.getElementById("aiToastContainer").innerHTML = "";
      const ch = chats.find((c) => c.id === "v-rossi");
      ch.messages.push({ id: "m1", from: "them", text: "Buongiorno, quando passate?", time: "10:00" }, { id: "m2", from: "me", text: "Domani alle 9", time: "10:05" });
      navigateTo("chat"); activeChatIndex = chats.indexOf(ch); renderChatWindow();
      document.getElementById("chatSlider").classList.add("show-conv");
    });
    await page.waitForTimeout(400);
    const selMsg = '#chatMessages .scorri-wrap:has(.bubble:text("Domani alle 9")) .scorri-contenuto';
    await trascina(selMsg, -120);
    await page.locator('#chatMessages .scorri-wrap:has(.bubble:text("Domani alle 9")) .scorri-elimina').click();
    await page.waitForTimeout(200);
    const dopoMsg = await page.evaluate(() => ({ testi: [...document.querySelectorAll("#chatMessages .bubble")].map((b) => b.textContent), scritture: window.__scritture.slice(), x: document.querySelectorAll("#chatMessages .goal-del-mini").length }));
    verifica("scorro un messaggio e tocco Elimina: solo quel messaggio nel cestino", dopoMsg.testi.length === 1 && /quando passate/.test(dopoMsg.testi[0]) && dopoMsg.scritture.length === 1 && dopoMsg.scritture[0].tabella === "messages" && dopoMsg.scritture[0].id === "m2" && dopoMsg.scritture[0].patch.deleted_at, JSON.stringify(dopoMsg));
    verifica("i messaggi non hanno più la piccola X", dopoMsg.x === 0);
    await page.evaluate(() => [...document.querySelectorAll("#aiToastContainer .ai-toast-yes")].at(-1).click());
    await page.waitForTimeout(200);
    verifica("Annulla: il messaggio torna al suo posto", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("#chatMessages .bubble")].map((b) => b.textContent.replace(/\d\d:\d\d$/, "")))) === '["Buongiorno, quando passate?","Domani alle 9"]');
    await page.screenshot({ path: process.env.SCREEN || "/dev/null" }).catch(() => {});
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
