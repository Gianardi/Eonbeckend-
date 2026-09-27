/* Pacchetto del 27/09/2026 (richieste di Andrea dopo il controllo grafico),
   nel browser vero con Supabase finto:
   - Svuota cestino, con conferma nella card di EON;
   - "Portami lì": dal calendario e a voce ("portami da Rita"), EON chiede
     l'indirizzo se manca e lo ricorda;
   - Privacy e dati in Impostazioni, con "Scarica i miei dati";
   - Elettricista al posto di Avvocato;
   - Fatture e preventivi: tasti "Nuovo preventivo / Nuova fattura" e dettatura;
   - Clienti in un'unica lista con i filtri per stato; la scheda ha Portami lì
     e Archivia;
   - avvisi nello stile delle card; notifica del messaggio ricevuto con
     "Rispondi" dalla notifica;
   - intestazione unica con il tasto ← tondo;
   - caratteri ospitati da EON (niente Google Fonts).
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/pacchetto-27-09.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8993;
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
    const google = [];
    page.on("request", (r) => { if (/googleapis|gstatic/.test(r.url())) google.push(r.url()); });
    await page.addInitScript(() => {
      window.__scritture = []; window.__cestino = []; window.__tabelle = {};
      const catena = (tabella) => {
        const stato = { filtri: [] };
        const q = {
          select: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q, is: () => q,
          not: (col) => { stato.cestino = col === "deleted_at"; return q; },
          eq: (c, v) => { stato.filtri.push([c, v]); return q; },
          update: (patch) => ({ eq: async (c, v) => { window.__scritture.push({ tipo: "update", tabella, id: v, patch }); return { error: null }; } }),
          delete: () => ({ eq: async (c, v) => { window.__scritture.push({ tipo: "delete", tabella, id: v }); window.__cestino = window.__cestino.filter((x) => !(x.t === tabella && x.r.id === v)); return { error: null }; } }),
          insert: (riga) => {
            window.__scritture.push({ tipo: "insert", tabella, riga });
            const salvato = { id: "n" + window.__scritture.length, created_at: new Date().toISOString(), event_type: null, ...riga };
            return { then: (ok) => ok({ data: salvato, error: null }), select: () => ({ single: async () => ({ data: salvato, error: null }) }) };
          },
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
          then: (ok) => {
            let data = window.__tabelle[tabella] || [];
            if (stato.cestino) data = window.__cestino.filter((x) => x.t === tabella).map((x) => x.r);
            if (tabella === "messages" && stato.filtri.length) data = [];
            return ok({ data, error: null });
          },
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({}) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) },
      }) };
      window.__aperti = [];
      window.open = (u) => { window.__aperti.push(u); return {}; };
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.getElementById("onboardingScreen").style.display = "none"; });

    /* ---- Caratteri ospitati da EON ---- */
    const font = await page.evaluate(async () => { await document.fonts.ready; return { css: !!document.querySelector('link[href="/fonts/fonts.css"]'), manrope: document.fonts.check("800 20px Manrope"), inter: document.fonts.check("400 14px Inter") }; });
    verifica("caratteri da EON (/fonts), nessuna richiesta a Google", font.css && font.manrope && font.inter && google.length === 0, JSON.stringify({ font, google }));

    /* ---- Elettricista al posto di Avvocato ---- */
    const mestieri = await page.evaluate(() => [...document.querySelectorAll("#obProfessionCards .ob-card")].map((c) => c.dataset.profession));
    verifica("mestieri: edile, idraulico, elettricista, amministratore (niente avvocato)", JSON.stringify(mestieri) === '["edile","idraulico","elettricista","amministratore"]', JSON.stringify(mestieri));
    const elettr = await page.evaluate(() => ({ nome: NOMI_PROFESSIONE.elettricista, clienti: professionData.elettricista.clients.map((c) => c.name), sezione: professionData.elettricista.oppTileTitle }));
    verifica("Elettricista: dati d'esempio del mestiere", elettr.nome === "Elettricista" && elettr.clienti.includes("Capannone Rossi S.r.l.") && elettr.sezione === "Impianti", JSON.stringify(elettr));

    /* ---- Clienti: un'unica lista ---- */
    await page.evaluate(async () => {
      await applyProfession("edile", true);
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      clients.length = 0;
      clients.push(
        { id: "c1", name: "Rita Ambrosini", status: "attivo", value: 9800, desc: "Rifacimento bagno", phone: "333 1234567", email: "", address: "", archived: false },
        { id: "c2", name: "Bar Centrale", status: "trattativa", value: 15800, desc: "Dehors", phone: "", email: "", address: "Via Roma 10, Bergamo", archived: false },
        { id: "c3", name: "Sig. Ferrari", status: "inattivo", value: 0, desc: "", phone: "", email: "", address: "", archived: false },
        { id: "c4", name: "Vecchio Cliente", status: "attivo", value: 0, desc: "x", phone: "", email: "", address: "", archived: true },
      );
      navigateTo("clienti"); renderClientArchive();
    });
    let lista = await page.evaluate(() => ({
      sezioni: document.querySelectorAll("#page-clienti .card-panel").length,
      righe: [...document.querySelectorAll("#clientArchiveList .cl-riga .row-name")].map((e) => e.textContent),
      stati: [...document.querySelectorAll("#clientArchiveList .cl-stato")].map((e) => e.textContent),
      filtri: [...document.querySelectorAll("#clientiFiltri .cl-filtro")].map((e) => e.textContent.replace(/\s+/g, " ").trim()),
    }));
    verifica("Clienti: una sola lista (niente \"potenziali\" a parte), con lo stato su ogni riga", lista.sezioni === 0 && lista.righe.length === 3 && JSON.stringify(lista.stati) === '["In corso","Preventivo","Concluso"]', JSON.stringify(lista));
    verifica("filtri: Tutti 3, In corso 1, Preventivo 1, Conclusi 1, Archiviati 1", JSON.stringify(lista.filtri) === '["Tutti 3","In corso 1","Preventivo 1","Conclusi 1","Archiviati 1"]', JSON.stringify(lista.filtri));
    await page.click("#clientiFiltri .cl-filtro:nth-child(3)");
    lista = await page.evaluate(() => [...document.querySelectorAll("#clientArchiveList .row-name")].map((e) => e.textContent));
    verifica("filtro Preventivo: solo Bar Centrale", JSON.stringify(lista) === '["Bar Centrale"]', JSON.stringify(lista));
    await page.click("#clientiFiltri .cl-filtro:nth-child(1)");
    await page.fill("#clientSearchInput", "ambro");
    lista = await page.evaluate(() => [...document.querySelectorAll("#clientArchiveList .row-name")].map((e) => e.textContent));
    verifica("cerca \"ambro\": Rita Ambrosini", JSON.stringify(lista) === '["Rita Ambrosini"]', JSON.stringify(lista));
    await page.fill("#clientSearchInput", "");
    const nuovo = await page.evaluate(() => { document.getElementById("addClientBtn").click(); const campi = [...document.querySelectorAll("#sheetBody [data-field]")].map((e) => e.dataset.field); closeSheet(); return campi; });
    verifica("\"Nuovo cliente\": il modulo ha anche l'Indirizzo", nuovo.includes("address") && nuovo.includes("phone"), JSON.stringify(nuovo));

    /* ---- Scheda: Portami lì e Archivia ---- */
    await page.evaluate(() => [...document.querySelectorAll("#clientArchiveList .cl-riga")].find((r) => r.textContent.includes("Rita")).click());
    const scheda = await page.evaluate(() => ({ contatti: [...document.querySelectorAll(".sc-contatto")].map((e) => e.dataset.contatto), azioni: [...document.querySelectorAll(".sc-azione")].map((e) => e.dataset.azione) }));
    verifica("scheda cliente: Chiama, WhatsApp, Email, Messaggio, Portami lì + Link cliente e Archivia", JSON.stringify(scheda.contatti) === '["Chiama","WhatsApp","Email","Messaggio","Portami lì"]' && scheda.azioni.includes("link") && scheda.azioni.includes("archivia"), JSON.stringify(scheda));

    /* ---- Portami lì senza indirizzo: EON lo chiede e lo ricorda ---- */
    await page.evaluate(() => document.querySelector('[data-contatto="Portami lì"]').click());
    const domanda = await page.evaluate(() => { const b = [...document.querySelectorAll(".scheda-bolla")].pop(); return b ? b.textContent : ""; });
    verifica("senza indirizzo: EON chiede quale e dice che lo ricorda", /indirizzo di Rita Ambrosini/.test(domanda) && /ricordo/.test(domanda), domanda);
    await page.fill("#conversazioneCardCampo", "Via Garibaldi 5, Brescia");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const dopo = await page.evaluate(() => ({ aperti: window.__aperti.slice(), indirizzo: clients[0].address, scritture: window.__scritture.filter((w) => w.tabella === "clients") }));
    verifica("…apre le Mappe verso quell'indirizzo e lo salva sulla scheda", dopo.aperti.length === 1 && decodeURIComponent(dopo.aperti[0]).includes("Via Garibaldi 5, Brescia") && dopo.indirizzo === "Via Garibaldi 5, Brescia" && dopo.scritture.some((w) => w.patch && w.patch.address === "Via Garibaldi 5, Brescia"), JSON.stringify(dopo));

    /* ---- A voce: "portami da Bar Centrale" (indirizzo già noto) ---- */
    await page.evaluate(() => { chiudiRisorsaCard(); window.__aperti.length = 0; provaPercorso("portami da Bar Centrale"); });
    const link = await page.evaluate(() => { const a = document.querySelector(".percorso-meta"); return a ? a.getAttribute("href") : ""; });
    verifica("\"portami da Bar Centrale\": il percorso fino al suo indirizzo", decodeURIComponent(link).includes("Via Roma 10, Bergamo"), link);
    await page.evaluate(() => chiudiRisorsaCard());
    const bergamo = await page.evaluate(() => { const ok = provaPercorso("portami a Bergamo"); const a = document.querySelector(".percorso-meta"); const h = a ? a.getAttribute("href") : ""; chiudiRisorsaCard(); return { ok, h }; });
    verifica("\"portami a Bergamo\" resta un luogo (non un cliente)", bergamo.ok && /Bergamo/.test(decodeURIComponent(bergamo.h)) && !/Via Roma/.test(decodeURIComponent(bergamo.h)), JSON.stringify(bergamo));

    /* ---- Portami lì dal calendario ---- */
    const cal = await page.evaluate(() => {
      window.__aperti.length = 0;
      tasks.length = 0;
      chats.length = 0;
      chats.push({ id: "v2", name: "Bar Centrale", isClient: true, archived: false, unread: 0, messages: [{ id: "a1", from: "me", eventType: "appt", title: "Sopralluogo Bar Centrale", text: "domani, 10:00", createdAt: new Date().toISOString(), scheduledAt: new Date(Date.now() + 864e5).toISOString() }], toSeeToday: false, toCallToday: false });
      navigateTo("calendario"); renderCalendar();
      const b = document.querySelector("#calendarList .cal-portami");
      if (b) b.click();
      return { tasto: !!b, aperti: window.__aperti.slice() };
    });
    verifica("calendario: \"Portami lì\" sull'appuntamento del cliente apre le Mappe", cal.tasto && cal.aperti.length === 1 && decodeURIComponent(cal.aperti[0]).includes("Via Roma 10, Bergamo"), JSON.stringify(cal));

    /* ---- Intestazione unica ---- */
    const testa = await page.evaluate(() => {
      const r = {};
      navigateTo("clienti");
      navigateTo("calendario");
      r.cal = { indietro: !document.getElementById("topbarIndietro").hidden, riga: getComputedStyle(document.getElementById("calIndietro")).display };
      document.getElementById("topbarIndietro").click();
      r.dopo = document.querySelector(".page.visible").id;
      navigateTo("clienti");
      r.clienti = !document.getElementById("topbarIndietro").hidden;
      return r;
    });
    verifica("intestazione: tasto ← tondo in alto al posto della riga \"Indietro\", e torna alla pagina di prima", testa.cal.indietro && testa.cal.riga === "none" && testa.dopo === "page-clienti" && testa.clienti === false, JSON.stringify(testa));

    /* ---- Svuota cestino ---- */
    await page.evaluate(() => {
      window.__cestino = [
        { t: "clients", r: { id: "x1", name: "Cliente vecchio", deleted_at: "2026-09-20T10:00:00Z" } },
        { t: "tasks", r: { id: "x2", title: "Impegno vecchio", deleted_at: "2026-09-21T10:00:00Z" } },
      ];
      window.__scritture.length = 0;
      navigateTo("cestino");
    });
    await page.waitForTimeout(300);
    const svuota = await page.evaluate(() => ({ visibile: !document.getElementById("cestinoSvuotaBtn").hidden, righe: document.querySelectorAll("#cestinoList .azienda-link-card").length, titoloDoppio: !!document.querySelector("#page-cestino .card-header") }));
    verifica("cestino: tasto \"Svuota cestino\" (e niente titolo ripetuto)", svuota.visibile && svuota.righe === 2 && !svuota.titoloDoppio, JSON.stringify(svuota));
    await page.click("#cestinoSvuotaBtn");
    const conferma = await page.evaluate(() => { const t = [...document.querySelectorAll("#aiToastContainer .ai-toast.decisione")].pop(); return t ? t.textContent : ""; });
    verifica("chiede conferma nella card, con quanti elementi", /Svuotare il cestino/.test(conferma) && /2 elementi/.test(conferma), conferma);
    await page.evaluate(() => [...document.querySelectorAll("#aiToastContainer .ai-toast.decisione .ai-toast-yes")].pop().click());
    await page.waitForTimeout(300);
    const svuotato = await page.evaluate(() => ({ cancellati: window.__scritture.filter((w) => w.tipo === "delete").map((w) => w.tabella + ":" + w.id), vuoto: /vuoto/.test(document.getElementById("cestinoList").textContent), tasto: document.getElementById("cestinoSvuotaBtn").hidden }));
    verifica("svuotato: tutto eliminato per sempre, cestino vuoto", JSON.stringify(svuotato.cancellati.sort()) === '["clients:x1","tasks:x2"]' && svuotato.vuoto && svuotato.tasto, JSON.stringify(svuotato));

    /* ---- Privacy e dati ---- */
    const privacy = await page.evaluate(async () => {
      navigateTo("impostazioni");
      document.getElementById("impVocePrivacy").click();
      const voci = [...document.querySelectorAll(".imp-form .module-title")].map((e) => e.textContent);
      window.__tabelle = { clients: [{ id: "c1", name: "Rita Ambrosini" }], messages: [{ id: "m1", body: "Ciao" }] };
      let blob = null;
      const creaVero = URL.createObjectURL;
      URL.createObjectURL = (b) => { blob = b; return "blob:finto"; };
      HTMLAnchorElement.prototype.click = function () { window.__scaricato = this.download; };
      await scaricaIMieiDati();
      URL.createObjectURL = creaVero;
      const dati = JSON.parse(await blob.text());
      return { voci, file: window.__scaricato, clienti: dati.clients, messaggi: dati.messages, account: dati.account };
    });
    verifica("Impostazioni → Privacy e dati: informativa, termini, scarica i miei dati", JSON.stringify(privacy.voci) === '["Informativa privacy","Termini d\'uso","Scarica i miei dati"]', JSON.stringify(privacy.voci));
    verifica("\"Scarica i miei dati\": un file con clienti, messaggi e il resto", /^eon-i-miei-dati-\d{4}-\d\d-\d\d\.json$/.test(privacy.file) && privacy.clienti[0].name === "Rita Ambrosini" && privacy.messaggi[0].body === "Ciao" && privacy.account === "a@b.it", JSON.stringify(privacy));
    await page.evaluate(() => chiudiRisorsaCard());

    /* ---- Fatture e preventivi: nuovo documento ---- */
    const fp = await page.evaluate(async () => {
      navigateTo("fatture-preventivi");
      let inviato = null;
      document.getElementById("fpSend").addEventListener("click", () => { inviato = document.getElementById("fpCampo").value; }, { capture: true });
      document.getElementById("fpNuovoPreventivo").click();
      const domanda = [...document.querySelectorAll(".scheda-bolla")].pop().textContent;
      return { domanda, tasti: !!document.getElementById("fpNuovaFattura") && !!document.getElementById("fpMic"), get inviato() { return inviato; } };
    });
    verifica("\"Nuovo preventivo\": EON chiede per chi e cosa", /Per chi è il preventivo/.test(fp.domanda) && fp.tasti, JSON.stringify(fp));
    await page.evaluate(() => { window.__fpInviato = null; document.getElementById("fpSend").addEventListener("click", () => { window.__fpInviato = document.getElementById("fpCampo").value; }, { capture: true }); });
    await page.fill("#conversazioneCardCampo", "Rossi, rifacimento bagno, 3.000 euro");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const inviato = await page.evaluate(() => window.__fpInviato);
    verifica("…e lo manda a EON come \"Preventivo per Rossi, …\"", inviato === "Preventivo per Rossi, rifacimento bagno, 3.000 euro", String(inviato));

    /* ---- Avvisi nello stile delle card ---- */
    const avviso = await page.evaluate(() => {
      document.getElementById("aiToastContainer").innerHTML = "";
      showAIToast("Appuntamento confermato", "Incontro con Rita\nmar 29 set, 14:30");
      const t = document.querySelector("#aiToastContainer .ai-toast");
      const cs = getComputedStyle(t);
      const nav = document.querySelector(".tab-bar, .bottom-nav, nav");
      return { bordo: cs.borderTopWidth, raggio: cs.borderTopLeftRadius, sopraBarra: nav ? t.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top + 1 : true };
    });
    verifica("avviso di EON: bordo sottile come le card, sopra la barra in basso", avviso.bordo === "1px" && parseFloat(avviso.raggio) >= 20 && avviso.sopraBarra, JSON.stringify(avviso));

    /* ---- Messaggio ricevuto: notifica con Rispondi ---- */
    await page.evaluate(() => {
      document.getElementById("aiToastContainer").innerHTML = "";
      window.__scritture.length = 0;
      chats.length = 0;
      chats.push({ id: "v1", name: "Rita Ambrosini", isClient: true, archived: false, unread: 0, messages: [], toSeeToday: false, toCallToday: false });
      activeChatIndex = null;
      navigateTo("home");
      riceviMessaggio({ id: "r1", conversation_id: "v1", sender: "them", body: "Ok per martedì alle 14:30", event_type: null, created_at: new Date().toISOString() }, false);
    });
    const notifica = await page.evaluate(() => { const t = document.querySelector("#aiToastContainer .ai-toast.messaggio"); return t ? { testo: t.textContent.replace(/\s+/g, " "), tasti: [...t.querySelectorAll("button")].map((b) => b.textContent.trim()).filter(Boolean) } : null; });
    verifica("messaggio ricevuto: card con chi scrive, anteprima, Rispondi e Apri chat", notifica && /Rita Ambrosini/.test(notifica.testo) && /Ok per martedì/.test(notifica.testo) && JSON.stringify(notifica.tasti) === '["Rispondi","Apri chat"]', JSON.stringify(notifica));
    await page.click("#aiToastContainer .ai-toast.messaggio .ai-toast-yes");
    await page.fill("#aiToastContainer .ai-toast-risposta input", "Perfetto, a martedì!");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const risposta = await page.evaluate(() => ({ scritto: window.__scritture.filter((w) => w.tipo === "insert" && w.tabella === "messages").map((w) => w.riga), inChat: chats[0].messages.map((m) => m.text), notifica: !!document.querySelector("#aiToastContainer .ai-toast.messaggio") }));
    verifica("\"Rispondi\" dalla notifica: il messaggio parte a Rita ed è in chat", risposta.scritto.length === 1 && risposta.scritto[0].body === "Perfetto, a martedì!" && risposta.scritto[0].conversation_id === "v1" && risposta.inChat.includes("Perfetto, a martedì!") && !risposta.notifica, JSON.stringify(risposta));

    const inChatAperta = await page.evaluate(() => {
      document.getElementById("aiToastContainer").innerHTML = "";
      activeChatIndex = 0; navigateTo("chat"); renderChatWindow(); document.getElementById("chatSlider").classList.add("show-conv");
      riceviMessaggio({ id: "r2", conversation_id: "v1", sender: "them", body: "Grazie", event_type: null, created_at: new Date().toISOString() }, false);
      return document.querySelectorAll("#aiToastContainer .ai-toast.messaggio").length;
    });
    verifica("con la chat di Rita già aperta: nessuna notifica (il messaggio si vede lì)", inChatAperta === 0, String(inChatAperta));

    await page.screenshot({ path: path.join(require("os").tmpdir(), "eon-pacchetto.png") });
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
