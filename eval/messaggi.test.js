/* Test del centro messaggi (26/09/2026): un solo elenco con EON,
   WhatsApp ed Email; cerca e filtri; archiviate in fondo; nella
   conversazione "Invia con" apre WhatsApp o Mail col testo già scritto e
   segna il messaggio col suo canale. Carica la vera index.html con
   Supabase finto.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/messaggi.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8990;
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
    const erroriPagina = [];
    page.on("pageerror", (e) => erroriPagina.push(e.message));
    await page.addInitScript(() => {
      window.__inseriti = [];
      const catena = (tabella) => {
        const q = {
          update: () => ({ eq: async () => ({ error: null }) }),
          insert: (riga) => {
            window.__inseriti.push({ tabella, riga });
            return { then: (ok) => ok({ error: null }), select: () => ({ single: async () => ({ data: { id: "n" + window.__inseriti.length, ...riga }, error: null }) }) };
          },
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q,
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on: function(){ return this; }, subscribe: function(){ return this; } }),
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "https://file.test/x.jpg" } }) }) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) },
      }) };
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });

    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      localStorage.removeItem("eon-canale-invio");
      window.__aperti = [];
      window.open = (url) => { window.__aperti.push(url); return null; };
      apriLinkEsterno = (url) => { window.__aperti.push(url); };
      const ora = Date.now(), ieri = ora - 86400000;
      clients.length = 0;
      clients.push(
        { id: "c-rita", name: "Rita Ambrosini", status: "attivo", value: 0, desc: "Rifacimento bagno", phone: "333 1234567", email: "rita@esempio.it", archived: false },
        { id: "c-dini", name: "Giampiero Dini", status: "attivo", value: 0, desc: "", phone: "", email: "", archived: false },
        { id: "c-conti", name: "Studio Conti", status: "attivo", value: 0, desc: "", phone: "", email: "", archived: false },
        { id: "c-vecchio", name: "Cliente Vecchio", status: "attivo", value: 0, desc: "", phone: "", email: "", archived: true },
      );
      chats.length = 0;
      const chat = (id, name, messages, unread) => ({ id, name, isClient: true, isProspect: false, archived: false, unread: unread || 0, messages, toSeeToday: false, toCallToday: false });
      chats.push(
        chat("v-dini", "Giampiero Dini", [{ from: "me", text: "Domani alle 10 sono da lei", time: "18:30", createdAt: new Date(ieri).toISOString() }]),
        chat("v-rita", "Rita Ambrosini", [{ from: "them", text: "Quando passate per le piastrelle?", time: "10:40", canale: "whatsapp", createdAt: new Date(ora - 60000).toISOString() }], 2),
        chat("v-conti", "Studio Conti", [{ from: "them", text: "Preventivo accettato, procediamo", time: "09:15", canale: "email", createdAt: new Date(ora - 3600000).toISOString() }]),
        chat("v-vecchio", "Cliente Vecchio", []),
      );
      activeChatIndex = null;
      chatFilter = null;
      navigateTo("chat");
      renderChatList();
    });

    const righe = () => page.evaluate(() => [...document.querySelectorAll("#chatList .chat-item")].map((r) => ({
      nome: r.querySelector(".chat-item-name").textContent,
      ora: r.querySelector(".chat-item-time").textContent,
      anteprima: r.querySelector(".chat-item-last").textContent,
      canale: (r.querySelector(".msg-canale") || {}).title || "",
      nonLetto: r.classList.contains("non-letto"),
    })));

    /* ---- Elenco ---- */
    let r = await righe();
    verifica("elenco in ordine di ultimo messaggio (Rita, Conti, Dini), archiviati fuori", JSON.stringify(r.map((x) => x.nome)) === '["Rita Ambrosini","Studio Conti","Giampiero Dini"]', JSON.stringify(r));
    verifica("pallino del canale sull'avatar (WhatsApp, Email, EON)", JSON.stringify(r.map((x) => x.canale)) === '["WhatsApp","Email","EON"]', JSON.stringify(r));
    verifica("messaggio mio: \"Tu: …\"; ieri: \"Ieri\"", r[2].anteprima === "Tu: Domani alle 10 sono da lei" && r[2].ora === "Ieri", JSON.stringify(r[2]));
    verifica("non letti in grassetto con il numero", r[0].nonLetto && !r[1].nonLetto && await page.evaluate(() => document.querySelector("#chatList .chat-unread").textContent === "2"));
    verifica("in fondo \"Archiviate · 1\"", await page.evaluate(() => !document.getElementById("chatArchiviateBtn").hidden && document.getElementById("chatArchiviateTesto").textContent === "Archiviate · 1"));

    await page.fill("#chatCerca", "piastrelle");
    r = await righe();
    verifica("cerca anche dentro i messaggi (\"piastrelle\" → Rita)", r.length === 1 && r[0].nome === "Rita Ambrosini", JSON.stringify(r));
    await page.fill("#chatCerca", "zzz");
    verifica("nessun risultato: lo dice", await page.evaluate(() => /Nessun risultato/.test(document.getElementById("chatList").textContent)));
    await page.fill("#chatCerca", "");

    await page.click('#chatCanali [data-canale="whatsapp"]');
    r = await righe();
    verifica("filtro WhatsApp: solo Rita, pulsante acceso", r.length === 1 && r[0].nome === "Rita Ambrosini" && await page.evaluate(() => document.querySelector('#chatCanali [data-canale="whatsapp"]').classList.contains("on")));
    await page.click('#chatCanali [data-canale="email"]');
    r = await righe();
    verifica("filtro Email: solo Studio Conti", r.length === 1 && r[0].nome === "Studio Conti", JSON.stringify(r));
    await page.click('#chatCanali [data-canale="tutti"]');

    await page.click("#chatArchiviateBtn");
    r = await righe();
    verifica("Archiviate: si vedono solo loro, e c'è \"Torna ai messaggi\"", r.length === 1 && r[0].nome === "Cliente Vecchio" && r[0].anteprima === "Nessun messaggio" && await page.evaluate(() => document.getElementById("chatArchiviateTesto").textContent === "Torna ai messaggi"), JSON.stringify(r));
    await page.click("#chatArchiviateBtn");
    verifica("Torna ai messaggi: di nuovo l'elenco normale", (await righe()).length === 3);

    /* ---- Matita: a chi scrivere ---- */
    await page.click("#chatNuovoBtn");
    const scegli = await page.evaluate(() => [...document.querySelectorAll("#risorsaCorpo .msg-scegli-riga")].map((b) => b.textContent.trim()));
    verifica("matita: elenco clienti (senza archiviati) + \"Nuovo cliente\"", JSON.stringify(scegli) === '["GDGiampiero Dini","RARita Ambrosini","SCStudio Conti"]' && await page.evaluate(() => !!document.querySelector("#risorsaCorpo .msg-scegli-nuovo")), JSON.stringify(scegli));
    await page.evaluate(() => chiudiRisorsaCard());

    /* ---- Conversazione ---- */
    await page.click('#chatList .chat-item:has(.chat-item-name:text-is("Rita Ambrosini"))');
    await page.waitForTimeout(350);
    const testa = await page.evaluate(() => ({
      aperta: document.getElementById("chatSlider").classList.contains("show-conv"),
      sotto: document.getElementById("chatWinStatus").textContent,
      chiama: document.getElementById("chatChiamaBtn").hidden ? "" : document.getElementById("chatChiamaBtn").getAttribute("href"),
      bolla: document.querySelector("#chatMessages .bubble").textContent,
      placeholder: document.getElementById("chatInput").placeholder,
    }));
    verifica("sotto il nome il lavoro (non \"offline\"), pulsante Chiama col numero", testa.aperta && testa.sotto === "Rifacimento bagno" && testa.chiama === "tel:+393331234567", JSON.stringify(testa));
    verifica("la bolla dice da dove arriva (\"WhatsApp · 10:40\")", /WhatsApp · 10:40$/.test(testa.bolla), testa.bolla);
    verifica("di base si scrive con EON", testa.placeholder === "Scrivi a Rita…" && await page.evaluate(() => document.querySelector('#chatInviaCon [data-canale="eon"]').classList.contains("on")));

    // Invia con WhatsApp
    await page.click('#chatInviaCon [data-canale="whatsapp"]');
    verifica("scelgo WhatsApp: pulsante verde e \"WhatsApp a Rita…\"", await page.evaluate(() => document.getElementById("chatSendBtn").classList.contains("via-whatsapp") && document.getElementById("chatInput").placeholder === "WhatsApp a Rita…"));
    await page.fill("#chatInput", "Passiamo lunedì alle 9");
    await page.click("#chatSendBtn");
    await page.waitForTimeout(150);
    let stato = await page.evaluate(() => ({ aperti: window.__aperti.slice(), inseriti: window.__inseriti.slice(), bolle: [...document.querySelectorAll("#chatMessages .bubble")].map((b) => b.className + "|" + b.textContent) }));
    verifica("WhatsApp si apre col testo già scritto", stato.aperti[0] === "https://wa.me/393331234567?text=" + encodeURIComponent("Passiamo lunedì alle 9"), JSON.stringify(stato.aperti));
    verifica("e il messaggio resta qui, segnato WhatsApp", stato.bolle.some((b) => /via-whatsapp/.test(b) && /Passiamo lunedì alle 9WhatsApp · /.test(b)), JSON.stringify(stato.bolle));

    // Invia con Email
    await page.click('#chatInviaCon [data-canale="email"]');
    await page.fill("#chatInput", "Le mando il preventivo");
    await page.click("#chatSendBtn");
    await page.waitForTimeout(150);
    stato = await page.evaluate(() => ({ aperti: window.__aperti.slice() }));
    verifica("Email: si apre la posta con destinatario, oggetto e testo", /^mailto:rita@esempio\.it\?subject=.+&body=Le%20mando%20il%20preventivo$/.test(stato.aperti[1] || ""), JSON.stringify(stato.aperti));

    // La scelta si ricorda per questa chat
    await page.click("#chatBackToList");
    await page.waitForTimeout(350);
    r = await righe();
    verifica("in elenco Rita ora ha l'ultimo messaggio via Email, \"Tu: …\"", r[0].nome === "Rita Ambrosini" && r[0].canale === "Email" && r[0].anteprima === "Tu: Le mando il preventivo", JSON.stringify(r[0]));
    await page.click('#chatList .chat-item:has(.chat-item-name:text-is("Rita Ambrosini"))');
    await page.waitForTimeout(350);
    verifica("riaprendo Rita, \"Invia con\" è ancora Email", await page.evaluate(() => document.querySelector('#chatInviaCon [data-canale="email"]').classList.contains("on")));

    // Manca il numero: nessun WhatsApp, si apre la scheda sul telefono
    await page.click("#chatBackToList");
    await page.waitForTimeout(350);
    await page.click('#chatList .chat-item:has(.chat-item-name:text-is("Giampiero Dini"))');
    await page.waitForTimeout(350);
    verifica("Dini: niente numero, niente pulsante Chiama; la scelta di Rita non vale per lui", await page.evaluate(() => document.getElementById("chatChiamaBtn").hidden && document.querySelector('#chatInviaCon [data-canale="eon"]').classList.contains("on")));
    await page.click('#chatInviaCon [data-canale="whatsapp"]');
    await page.fill("#chatInput", "Ciao");
    await page.click("#chatSendBtn");
    await page.waitForTimeout(200);
    stato = await page.evaluate(() => ({
      aperti: window.__aperti.length,
      avviso: document.getElementById("aiToastContainer").textContent,
      testo: document.getElementById("chatInput").value,
      scheda: !!document.querySelector('#sheetBody [data-field="phone"]'),
    }));
    verifica("senza numero: avviso \"Manca il numero\", testo non perso, scheda aperta", stato.aperti === 2 && /Manca il numero/.test(stato.avviso) && stato.testo === "Ciao" && stato.scheda, JSON.stringify(stato));
    await page.evaluate(() => { if(typeof closeSheet === "function") closeSheet(); });

    /* ---- Con il database: il canale viene salvato ---- */
    await page.evaluate(() => {
      currentSession = { access_token: "t", user: { id: "u1" } };
      window.__inseriti.length = 0;
      localStorage.removeItem("eon-canale-invio");
      activeChatIndex = chats.findIndex((c) => c.id === "v-rita");
      renderChatWindow();
    });
    await page.click('#chatInviaCon [data-canale="whatsapp"]');
    await page.fill("#chatInput", "Arrivo");
    await page.click("#chatSendBtn");
    await page.waitForTimeout(150);
    const ins = await page.evaluate(() => window.__inseriti.filter((x) => x.tabella === "messages").map((x) => x.riga));
    verifica("nel database il messaggio ha canale \"whatsapp\"", ins.length === 1 && ins[0].canale === "whatsapp" && ins[0].body === "Arrivo" && ins[0].sender === "me", JSON.stringify(ins));

    /* ---- Menu ⋯ ---- */
    await page.click("#chatAltroBtn");
    const menu = await page.evaluate(() => [...document.querySelectorAll("#risorsaCorpo .msg-menu-voce")].map((b) => b.textContent.trim()));
    verifica("⋯: Scheda del cliente, File, Archivia, Elimina", JSON.stringify(menu) === '["Scheda del cliente","File e documenti della chat","Archivia","Elimina"]', JSON.stringify(menu));

    verifica("nessun errore nella pagina", erroriPagina.length === 0, JSON.stringify(erroriPagina));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
