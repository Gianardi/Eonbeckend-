/* Pacchetto del 27/09/2026 (richieste di Andrea dopo il controllo grafico),
   nel browser vero con Supabase finto:
   - Svuota cestino, con conferma nella card di EON;
   - "Portami lì": dal calendario e a voce ("portami da Rita"), EON chiede
     l'indirizzo se manca e lo ricorda;
   - Privacy e dati in Impostazioni, con "Scarica i miei dati";
   - Elettricista al posto di Avvocato;
   - Fatture e preventivi: un microfono e una casella (in Fatture si crea una
     fattura, in Preventivi un preventivo);
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
    await page.fill("#clientiHeroCampo", "ambro");
    lista = await page.evaluate(() => [...document.querySelectorAll("#clientArchiveList .row-name")].map((e) => e.textContent));
    verifica("la stessa casella cerca mentre scrivi: \"ambro\" → Rita Ambrosini", JSON.stringify(lista) === '["Rita Ambrosini"]', JSON.stringify(lista));
    await page.fill("#clientiHeroCampo", "");
    const nuovo = await page.evaluate(() => { openSheet("cliente", clients[0]); const campi = [...document.querySelectorAll("#sheetBody [data-field]")].map((e) => e.dataset.field); const voce = !!document.getElementById("dettatura"); closeSheet(); return { campi, voce }; });
    verifica("modifica cliente: c'è l'Indirizzo, e niente riquadro \"Raccontalo a EON AI\"", nuovo.campi.includes("address") && nuovo.campi.includes("phone") && !nuovo.voce, JSON.stringify(nuovo));
    const nuovoCliente = await page.evaluate(() => { document.getElementById("addClientBtn").click(); const b = [...document.querySelectorAll(".scheda-bolla")].pop(); const r = { domanda: b ? b.textContent : "", titolo: document.getElementById("risorsaTitolo").textContent, campo: !!document.getElementById("conversazioneCardCampo"), mic: !!document.querySelector(".scheda-composer .scheda-mic"), foglio: document.getElementById("sheetBody").children.length && document.querySelector(".sheet.open, .sheet-overlay.open") ? true : false }; return r; });
    verifica("\"Nuovo cliente\": la card di EON con microfono e una casella (niente modulo)", nuovoCliente.titolo === "Nuovo cliente" && /nome, telefono/.test(nuovoCliente.domanda) && nuovoCliente.campo && nuovoCliente.mic && !nuovoCliente.foglio, JSON.stringify(nuovoCliente));
    await page.evaluate(() => { window.__clientiInvio = null; document.getElementById("clientiHeroSend").addEventListener("click", () => { window.__clientiInvio = document.getElementById("clientiHeroCampo").value; }, { capture: true, once: true }); });
    await page.fill("#conversazioneCardCampo", "Mario Bianchi, 333 7654321, rifà il tetto");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    verifica("…e la frase va a EON, che crea la scheda", (await page.evaluate(() => window.__clientiInvio)) === "Mario Bianchi, 333 7654321, rifà il tetto", String(await page.evaluate(() => window.__clientiInvio)));
    await page.evaluate(() => { chiudiRisorsaCard(); clients.splice(0, clients.length, ...clients.filter((c) => c.name !== "Mario Bianchi")); navigateTo("clienti"); document.getElementById("clientiHeroCampo").value = ""; renderClientArchive(); });

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

    /* ---- Fatture e preventivi: un microfono e una casella ---- */
    const fp = await page.evaluate(() => {
      filtroFatturePreventivi = "fattura";
      navigateTo("fatture-preventivi");
      return {
        tastiGrandi: document.querySelectorAll("#fpNuovoPreventivo, #fpNuovaFattura, .fp-nuovo").length,
        mic: !!document.getElementById("fpMic"), campi: document.querySelectorAll("#page-fatture-preventivi textarea, #page-fatture-preventivi input[type=text], #page-fatture-preventivi input[type=search]").length,
        segnaposto: document.getElementById("fpCampo").placeholder,
        fattura: completaFraseDocumento("Rossi, bagno, 300 euro"),
        esplicito: completaFraseDocumento("preventivo per Bianchi 200"),
      };
    });
    verifica("Fatture: un microfono e una casella, niente tasti doppi", fp.tastiGrandi === 0 && fp.mic && fp.campi === 1 && /Nuova fattura/.test(fp.segnaposto), JSON.stringify(fp));
    verifica("in Fatture \"Rossi, bagno, 300 euro\" diventa una fattura", fp.fattura === "Fattura per Rossi, bagno, 300 euro" && fp.esplicito === "preventivo per Bianchi 200", JSON.stringify(fp));
    const pv = await page.evaluate(() => { filtroFatturePreventivi = "preventivo"; navigateTo("fatture-preventivi"); return { segnaposto: document.getElementById("fpCampo").placeholder, frase: completaFraseDocumento("per Rossi, tetto, 5.000") }; });
    verifica("in Preventivi diventa un preventivo", /Nuovo preventivo/.test(pv.segnaposto) && pv.frase === "Preventivo per Rossi, tetto, 5.000", JSON.stringify(pv));
    const clientiCampi = await page.evaluate(() => { navigateTo("clienti"); return { campi: document.querySelectorAll("#page-clienti textarea, #page-clienti input[type=text], #page-clienti input[type=search]").length, mic: document.querySelectorAll("#page-clienti .home-hero-mic").length }; });
    verifica("Clienti: un microfono e una casella (che fa anche da ricerca)", clientiCampi.campi === 1 && clientiCampi.mic === 1, JSON.stringify(clientiCampi));

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

    /* ---- Senza AI: solo il nome della pagina, chiama, scrivi a ---- */
    const senzaAI = await page.evaluate(() => {
      const r = {};
      for (const [frase, pagina] of [["Messaggi", "chat"], ["calendario", "calendario"], ["fatture", "fatture-preventivi"], ["Clienti", "clienti"], ["impostazioni", "impostazioni"]]) {
        navigateTo("home");
        r[frase] = provaNavigazioneDiretta(frase) && document.querySelector(".page.visible").id === "page-" + pagina;
      }
      navigateTo("home");
      r["messaggi di Rita (non solo il nome)"] = provaNavigazioneDiretta("messaggi di Rita") === false;
      return r;
    });
    verifica("solo il nome della pagina (\"Messaggi\", \"calendario\"…): si apre subito", Object.values(senzaAI).every(Boolean), JSON.stringify(senzaAI));

    /* ---- Il nome di una pagina funziona per TUTTE le pagine e da OGNI casella ---- */
    const tutteLePagine = await page.evaluate(() => {
      const casi = [["Chiamate", "chiamate"], ["chi devo chiamare", "chiamate"], ["Cestino", "cestino"], ["spazzatura", "cestino"],
        ["Impostazione", "impostazioni"], ["Profilo", "impostazioni"], ["Menu", "gestisci-azienda"], ["Compiti", "assegna-compiti"],
        ["Squadra", "assegna-compiti"], ["Registro", "ai-request-log"], ["Assemblee", "assemblee"], ["Cresci", "cresci"],
        ["messaggio", "chat"], ["Appuntamento", "calendario"], ["Preventivo", "fatture-preventivi"], ["Documenti", "cantiere-documenti"],
        ["Foto", "cantiere-foto"], ["Appunti", "cantiere-appunti"], ["Lettere", "crea-lettera"], ["Pagamenti", "pagamenti"],
        ["Entrate", "entrate"], ["Conti", "azienda"], ["Casa", "home"], ["apri le chiamate", "chiamate"], ["Chiamate per favore", "chiamate"]];
      const sbagliati = [];
      for (const [frase, pagina] of casi) {
        navigateTo("clienti");
        const ok = provaNavigazioneDiretta(frase) && document.querySelector(".page.visible").id === "page-" + pagina;
        if (!ok) sbagliati.push(frase + " → " + document.querySelector(".page.visible").id);
      }
      navigateTo("home");
      for (const frase of ["Chiama Rita", "Cestino di Rita", "appuntamento con Rita domani"]) if (provaNavigazioneDiretta(frase)) sbagliati.push("intercettato: " + frase);
      provaNavigazioneDiretta("Privacy");
      const privacy = document.getElementById("risorsaTitolo").textContent;
      chiudiRisorsaCard();
      return { sbagliati, privacy };
    });
    verifica("tutte le pagine per nome (Chiamate, Cestino, Impostazione, Menu, Compiti, Registro…) e \"Privacy\" apre la sua voce", tutteLePagine.sbagliati.length === 0 && tutteLePagine.privacy === "Privacy e dati", JSON.stringify(tutteLePagine));

    const pagina = () => page.evaluate(() => document.querySelector(".page.visible").id.replace("page-", ""));
    const nascondiGuide = () => page.evaluate(() => document.querySelectorAll(".ai-landing-overlay").forEach((o) => { o.style.display = "none"; }));
    const daCaselle = {};
    await page.evaluate(() => navigateTo("home"));
    await nascondiGuide();
    await page.fill("#homeHeroCampo", "Chiamate");
    await page.click("#homeHeroSend");
    daCaselle.home = (await pagina()) === "chiamate";
    await page.evaluate(() => { navigateTo("fatture-preventivi"); filtroFatturePreventivi = "fattura"; });
    await nascondiGuide();
    await page.fill("#fpCampo", "Cestino");
    await page.click("#fpSend");
    daCaselle.fatture = (await pagina()) === "cestino";
    await page.evaluate(() => navigateTo("cantiere-appunti"));
    await nascondiGuide();
    await page.fill("#cantiereAppuntiCampo", "Impostazione");
    await page.click("#cantiereAppuntiSend");
    daCaselle.appunti = (await pagina()) === "impostazioni";
    await page.evaluate(() => { navigateTo("clienti"); mostraSchedaCliente({ id: "c1", name: "Rita Ambrosini", status: "attivo", value: 0, desc: "", phone: "333 1234567", email: "", address: "", archived: false }); });
    await page.fill("#schedaClienteCampo", "Calendario");
    await page.keyboard.press("Enter");
    daCaselle.schedaCliente = (await pagina()) === "calendario" && (await page.evaluate(() => document.getElementById("risorsaOverlay").style.display === "none"));
    daCaselle.risposte = [];
    await page.evaluate(() => { navigateTo("home"); apriConversazioneCard("Metti Rita", "Lo segno in calendario o negli appunti?", (t) => window.__risposte.push(t)); });
    await page.evaluate(() => { window.__risposte = []; });
    await page.fill("#conversazioneCardCampo", "Calendario");
    await page.keyboard.press("Enter");
    daCaselle.parolaDellaDomanda = (await pagina()) === "home" && (await page.evaluate(() => window.__risposte.join())) === "Calendario";
    await page.evaluate(() => { chiudiRisorsaCard(); apriConversazioneCard("Metti Rita", "A che ora?", (t) => window.__risposte.push(t)); window.__risposte = []; });
    await page.fill("#conversazioneCardCampo", "Chiamate");
    await page.keyboard.press("Enter");
    daCaselle.cardConDomanda = (await pagina()) === "chiamate" && (await page.evaluate(() => window.__risposte.length === 0 && document.getElementById("risorsaOverlay").style.display === "none"));
    verifica("il nome della pagina funziona da ogni casella: Home, Fatture, Appunti, scheda cliente, card con domanda di EON (se la parola era nella domanda, è la risposta)", daCaselle.home && daCaselle.fatture && daCaselle.appunti && daCaselle.schedaCliente && daCaselle.parolaDellaDomanda && daCaselle.cardConDomanda, JSON.stringify(daCaselle));
    const comandi = await page.evaluate(async () => {
      clients.splice(0, clients.length,
        { id: "c1", name: "Rita Ambrosini", status: "attivo", value: 0, desc: "", phone: "333 1234567", email: "", address: "", archived: false },
        { id: "c5", name: "Mario Rossi", status: "attivo", value: 0, desc: "", phone: "", email: "", address: "", archived: false },
        { id: "c6", name: "Luca Rossi", status: "attivo", value: 0, desc: "", phone: "", email: "", address: "", archived: false });
      chats.splice(0, chats.length, { id: "v1", name: "Rita Ambrosini", isClient: true, archived: false, unread: 0, messages: [], toSeeToday: false, toCallToday: false });
      const r = {};
      r.chiamaVoce = provaComandiSemplici("chiama Rita", true) && /Chiama Rita Ambrosini/.test((document.querySelector(".percorso-meta") || {}).textContent || "") && /tel:\+?39?3331234567/.test((document.querySelector(".percorso-meta") || { getAttribute: () => "" }).getAttribute("href"));
      chiudiRisorsaCard();
      r.chiamaDueRossi = provaComandiSemplici("chiama Rossi", false) === false;
      r.chiamaSenzaNumero = provaComandiSemplici("chiama Mario Rossi", false) && /Numero mancante/.test(document.getElementById("aiToastContainer").textContent);
      chiudiRisorsaCard();
      const riconosciuto = provaComandiSemplici("scrivi a Rita Ambrosini", false);
      await new Promise((ok) => setTimeout(ok, 50)); // la chat si apre appena pronta
      r.scrivi = riconosciuto && document.querySelector(".page.visible").id === "page-chat" && document.getElementById("chatSlider").classList.contains("show-conv");
      navigateTo("home");
      r.scriviConMessaggio = provaComandiSemplici("scrivi a Rita che arrivo alle 10", false) === false;
      r.nuovoCliente = provaComandiSemplici("aggiungi cliente", false) && document.getElementById("risorsaTitolo").textContent === "Nuovo cliente";
      chiudiRisorsaCard();
      return r;
    });
    verifica("\"chiama Rita\" a voce: un tasto per chiamarla; \"chiama Rossi\" (due Rossi) decide l'AI; senza numero lo dice", comandi.chiamaVoce && comandi.chiamaDueRossi && comandi.chiamaSenzaNumero, JSON.stringify(comandi));
    verifica("\"scrivi a Rita Ambrosini\": la sua chat; con il messaggio dentro decide chi viene dopo; \"aggiungi cliente\": la card", comandi.scrivi && comandi.scriviConMessaggio && comandi.nuovoCliente, JSON.stringify(comandi));

    /* ---- Il logo: la O è solo il marchio ---- */
    const logo = await page.evaluate(() => { const o = document.getElementById("aiClockBtn"); return { tag: o.tagName, cliccabile: o.tagName === "BUTTON" }; });
    verifica("la \"O\" di EON è solo il marchio (niente funzione AI)", logo.tag === "SPAN" && !logo.cliccabile, JSON.stringify(logo));

    /* ---- Senza AI: fatto, incassi, chi mi deve, link, archivia, preventivi di ---- */
    await page.evaluate(() => {
      chiudiRisorsaCard(); navigateTo("home");
      document.getElementById("aiToastContainer").innerHTML = "";
      clients.splice(0, clients.length,
        { id: "c1", name: "Rita Ambrosini", status: "attivo", value: 0, desc: "", phone: "333 1234567", email: "", address: "", archived: false },
        { id: "c5", name: "Mario Rossi", status: "attivo", value: 0, desc: "", phone: "", email: "", address: "", archived: false });
      chats.splice(0, chats.length, { id: "v1", name: "Rita Ambrosini", isClient: true, archived: false, unread: 0, accessCode: "ABC123", messages: [], toSeeToday: false, toCallToday: false });
      tasks.splice(0, tasks.length,
        { id: "t1", title: "Sopralluogo Rita Ambrosini", owner: "user", status: "todo", time: "" },
        { id: "t2", title: "Chiamata Mario Rossi", owner: "user", status: "todo", time: "" },
        { id: "t3", title: "Chiamata fornitore", owner: "user", status: "todo", time: "" });
      const oggi = new Date(), iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      incomes.splice(0, incomes.length,
        { id: "i1", client: "Rita Ambrosini", desc: "Bagno", amount: 1200, due: iso(oggi), status: "incassato" },
        { id: "i2", client: "Rita Ambrosini", desc: "Cucina", amount: 300, due: iso(oggi), status: "attesa" },
        { id: "i3", client: "Mario Rossi", desc: "Tetto", amount: 2000, due: iso(new Date(oggi.getFullYear(), oggi.getMonth() - 1, 10)), status: "scaduto" });
      window.__scritture.length = 0; window.__aperti.length = 0;
    });
    const fatto = await page.evaluate(async () => {
      const r = {};
      r.unoSolo = provaComandiSemplici("ho finito il sopralluogo da Rita", false) && tasks[0].status === "done" && window.__scritture.some((w) => w.tabella === "tasks" && w.id === "t1" && w.patch.status === "done");
      document.querySelector("#aiToastContainer .ai-toast-yes").click();
      await new Promise((ok) => setTimeout(ok, 30));
      r.annulla = tasks[0].status === "todo";
      document.getElementById("aiToastContainer").innerHTML = "";
      r.scelta = provaComandiSemplici("segna fatto chiamata", false) && document.getElementById("risorsaTitolo").textContent === "Quale hai finito?" && document.querySelectorAll("#risorsaCorpo .fatto-scelta").length === 2;
      document.querySelectorAll("#risorsaCorpo .fatto-scelta")[1].click();
      r.sceltaFatta = tasks[2].status === "done" && tasks[1].status === "todo" && document.getElementById("risorsaOverlay").style.display === "none";
      r.nessunoAllAI = provaComandiSemplici("ho finito il cemento", false) === false && provaComandiSemplici("cosa ho fatto", false) === false;
      return r;
    });
    verifica("\"ho finito il sopralluogo da Rita\": segnato fatto, con Annulla; se sono due si sceglie; se non c'è decide l'AI", Object.values(fatto).every(Boolean), JSON.stringify(fatto));
    const soldi = await page.evaluate(() => {
      const r = {};
      const mese = provaLetturaLocale("quanto ho incassato questo mese");
      r.mese = mese && /1\.200/.test(mese.testo) && /300/.test(mese.testo) && document.querySelector(".page.visible").id === "page-azienda";
      const scorso = provaLetturaLocale("quanto ho incassato il mese scorso");
      r.scorso = scorso && /€0/.test(scorso.testo) && /2\.000/.test(scorso.testo);
      const chi = provaLetturaLocale("chi mi deve soldi?");
      r.chi = chi && chi.titolo === "Ti devono €2.300" && /Mario Rossi\*\* – €2\.000 \(scaduto\)/.test(chi.testo) && /Rita Ambrosini\*\* – €300/.test(chi.testo) && chi.testo.indexOf("Mario") < chi.testo.indexOf("Rita");
      const daRossi = provaLetturaLocale("quanto ho incassato da Rossi");
      r.daRossi = daRossi && daRossi.titolo === "Mario Rossi" && /Ti deve ancora €2\.000/.test(daRossi.testo);
      r.altroAllAI = provaLetturaLocale("quanto ho incassato con i bagni") === null;
      return r;
    });
    verifica("\"quanto ho incassato questo mese / il mese scorso / da Rossi\" e \"chi mi deve soldi\": dai conti, senza AI", Object.values(soldi).every(Boolean), JSON.stringify(soldi));
    const linkCliente = await page.evaluate(async () => {
      const r = {};
      r.riconosciuto = provaComandiSemplici("manda il link a Rita", false);
      await new Promise((ok) => setTimeout(ok, 50));
      r.card = document.getElementById("risorsaTitolo").textContent === "Link per Rita Ambrosini";
      document.querySelector('#risorsaCorpo .scheda-invio-btn[data-canale="WhatsApp"]').click();
      const url = decodeURIComponent(window.__aperti.pop() || "");
      r.whatsapp = url.startsWith("https://wa.me/393331234567?text=") && url.includes("/cliente.html?c=ABC123");
      chiudiRisorsaCard();
      r.nessunCliente = provaComandiSemplici("manda il link a Giovanni", false) === false;
      return r;
    });
    verifica("\"manda il link a Rita\": card con WhatsApp (messaggio e link pronti), Email e Copia", Object.values(linkCliente).every(Boolean), JSON.stringify(linkCliente));
    const archivia = await page.evaluate(async () => {
      const r = {};
      document.getElementById("aiToastContainer").innerHTML = "";
      r.chiede = provaComandiSemplici("archivia Rita", false) && /Archiviare "Rita Ambrosini"/.test(document.getElementById("aiToastContainer").textContent) && clients[0].archived === false;
      document.querySelector("#aiToastContainer .ai-toast-yes").click();
      await new Promise((ok) => setTimeout(ok, 50));
      r.archiviato = clients[0].archived === true;
      document.getElementById("aiToastContainer").innerHTML = "";
      r.giaArchiviato = provaComandiSemplici("archivia Rita", false) && /già in archivio/.test(document.getElementById("risorsaCorpo").textContent);
      chiudiRisorsaCard();
      r.riattiva = provaComandiSemplici("riattiva Rita", false) && /Riportare "Rita Ambrosini"/.test(document.getElementById("aiToastContainer").textContent);
      document.querySelector("#aiToastContainer .ai-toast-yes").click();
      await new Promise((ok) => setTimeout(ok, 50));
      r.riattivato = clients[0].archived === false;
      document.getElementById("aiToastContainer").innerHTML = "";
      r.preventiviDiRossi = provaRisorsaImmediata("preventivi di Rossi") && /Mario Rossi non ha ancora preventivi/.test(document.getElementById("risorsaCorpo").textContent);
      chiudiRisorsaCard();
      r.preventivoPerRossiAllAI = provaRisorsaImmediata("preventivo per Rossi") === false;
      return r;
    });
    verifica("\"archivia Rita\" / \"riattiva Rita\" con conferma; \"preventivi di Rossi\" risponde anche se non ce ne sono", Object.values(archivia).every(Boolean), JSON.stringify(archivia));

    /* ---- "Domani alle 15 sono libero?" e altre domande sul calendario, senza AI ---- */
    const libero = await page.evaluate(() => {
      chiudiRisorsaCard();
      tasks.splice(0, tasks.length,
        { id: "d1", title: "Sopralluogo Rita Ambrosini", owner: "user", status: "todo", time: "domani, 09:00" },
        { id: "d2", title: "Incontro UniCredit", owner: "user", status: "todo", time: "domani, 15:30" },
        { id: "d3", title: "Comprare silicone", owner: "user", status: "todo", time: "domani" });
      chats.forEach((c) => { c.messages = []; });
      const r = {};
      const d = (frase) => capisciDisponibilita(frase);
      const alle15 = d("Domani alle 15 sono libero?");
      r.alle15 = alle15 && alle15.titolo === "Sì, sei libero" && /Ma subito dopo: \*\*15:30\*\* – Incontro UniCredit/.test(alle15.testo) && /Senza orario: Comprare silicone/.test(alle15.testo);
      const alle9 = d("domani alle 9 sono libera?");
      r.alle9 = alle9 && alle9.titolo === "No, domani alle 09:00 hai un impegno" && /Sopralluogo Rita/.test(alle9.testo);
      const treMezza = d("domani alle 3 e mezza sono libero");
      r.treMezza = treMezza && /alle 15:30/.test(treMezza.titolo);
      const pomeriggio = d("domani pomeriggio ho qualcosa?");
      r.pomeriggio = pomeriggio && /^No, domani pomeriggio/.test(pomeriggio.titolo);
      const quando = d("quando sono libero domani?");
      r.quando = quando && /Dalle \*\*08:00\*\* alle \*\*09:00\*\*/.test(quando.testo) && /Dalle \*\*10:00\*\* alle \*\*15:30\*\*/.test(quando.testo) && /Dalle \*\*16:30\*\* in poi/.test(quando.testo);
      const stasera = d("stasera sono libero?");
      r.stasera = stasera && stasera.titolo === "Sì, sei libero";
      r.poiAllAI = d("Poi giornata libera?") === null;
      r.conNomeAllAI = d("domani alle 15 sono libero per Rossi?") === null;
      r.senzaParolaChiave = d("domani alle 15") === null;
      return r;
    });
    verifica("\"domani alle 15 sono libero?\" (e alle 9, alle 3 e mezza, pomeriggio, quando, stasera) dal calendario; con altre parole decide l'AI", Object.values(libero).every(Boolean), JSON.stringify(libero));
    const domandeCliente = await page.evaluate(() => {
      const r = {};
      const quando = capisciDomandaCliente("quando vado da Rita?");
      r.quando = quando && quando.titolo === "Rita Ambrosini" && /Domani alle 09:00\*\* – Sopralluogo/.test(quando.testo);
      const prossimo = capisciDomandaCliente("prossimo appuntamento");
      r.prossimo = prossimo && prossimo.titolo === "Sopralluogo Rita Ambrosini";
      const numero = capisciDomandaCliente("numero di Rita");
      r.numero = numero && /333 1234567/.test(numero.testo) && /chiama Rita/.test(numero.testo);
      const indirizzo = capisciDomandaCliente("dove abita Rossi");
      r.indirizzoMancante = indirizzo && /Non ho l'indirizzo di Mario Rossi/.test(indirizzo.testo);
      r.sconosciutoAllAI = capisciDomandaCliente("numero di Giovanni") === null;
      return r;
    });
    verifica("\"quando vado da Rita?\", \"prossimo appuntamento\", \"numero di Rita\", \"dove abita Rossi\": senza AI", Object.values(domandeCliente).every(Boolean), JSON.stringify(domandeCliente));

    /* ---- Memoria: le risposte del codice vanno a EON con la frase dopo ---- */
    await page.evaluate(() => { chiudiRisorsaCard(); memoriaLocale.length = 0; window.__sessionePrima = currentSession; currentSession = currentSession || { access_token: "t", user: { id: "u1" } }; navigateTo("home"); });
    let corpoAI = null;
    await page.route("**/api?action=assistant", (r) => { corpoAI = JSON.parse(r.request().postData() || "{}"); r.fulfill({ status: 200, contentType: "application/json", body: '{"stato":"concluso","testo":"Sì, dopo le 16:30 sei libero."}' }); });
    await nascondiGuide();
    await page.fill("#homeHeroCampo", "Domani alle 15 sono libero?");
    await page.click("#homeHeroSend");
    await page.waitForTimeout(100);
    await page.evaluate(() => chiudiRisorsaCard());
    await page.fill("#homeHeroCampo", "e dopo cosa mi conviene fare?");
    await page.click("#homeHeroSend");
    await page.waitForTimeout(400);
    const memoria = corpoAI && corpoAI.recentiLocali;
    verifica("la domanda a cui ha risposto il codice va a EON con la frase dopo (memoria della giornata)", Array.isArray(memoria) && memoria.length === 1 && memoria[0].domanda === "Domani alle 15 sono libero?" && /Sì, sei libero/.test(memoria[0].risposta) && !!memoria[0].quando, JSON.stringify(corpoAI));
    await page.unroute("**/api?action=assistant");
    await page.evaluate(() => { chiudiRisorsaCard(); currentSession = window.__sessionePrima; });

    /* ---- "Ricordami di chiamare Pedro": senza giorno né ora negli appunti da fare (28/09/2026) ---- */
    const daFare = await page.evaluate(() => {
      const r = {};
      r.senzaQuando = capisciDaFare("Ricordami di chiamare Pedro") === "Chiamare Pedro" && capisciDaFare("ricordati che devo comprare il silicone.") === "Comprare il silicone";
      r.conQuando = ["ricordami domani di chiamare Pedro", "ricordami alle 10 di chiamare Pedro", "ricordami stasera di chiamare Pedro", "ricordami la settimana prossima di chiamare Pedro", "ricordami più tardi di chiamare Pedro", "ricordami il 3 di pagare"].every((f) => capisciDaFare(f) === null);
      r.mappa = mappaAppunto({ id: "x", testo: "t", created_at: "2026-09-28", da_fare: true, fatto_il: null }).daFare === true;
      return r;
    });
    verifica("\"ricordami di…\" senza quando = da fare; con un giorno, un'ora o \"stasera/più tardi\" no (decide l'AI → calendario)", Object.values(daFare).every(Boolean), JSON.stringify(daFare));
    await page.evaluate(() => {
      chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = "";
      cantiereAppunti.splice(0, cantiereAppunti.length); tasks.splice(0, tasks.length); renderCantiereAppunti();
      window.__scritture.length = 0;
    });
    await nascondiGuide();
    await page.fill("#homeHeroCampo", "Ricordami di chiamare Pedro");
    await page.click("#homeHeroSend");
    await page.waitForTimeout(250);
    const salvatoDaFare = await page.evaluate(() => ({
      insert: window.__scritture.filter((w) => w.tipo === "insert").map((w) => ({ tabella: w.tabella, riga: w.riga })),
      box: !document.getElementById("homeHeroDaFareBox").hidden,
      lista: document.getElementById("homeHeroDaFareLista").textContent,
      toast: document.getElementById("aiToastContainer").textContent,
    }));
    verifica("detto in Home: salvato negli appunti come da fare (niente calendario), lista \"Da fare\" in Home", salvatoDaFare.insert.length === 1 && salvatoDaFare.insert[0].tabella === "cantiere_appunti" && salvatoDaFare.insert[0].riga.da_fare === true && salvatoDaFare.insert[0].riga.testo === "Chiamare Pedro" && salvatoDaFare.box && /Chiamare Pedro/.test(salvatoDaFare.lista) && /Da fare/.test(salvatoDaFare.toast), JSON.stringify(salvatoDaFare));
    await page.click("#homeHeroDaFareLista .home-hero-oggi-check");
    const spuntato = await page.evaluate(() => ({ update: window.__scritture.filter((w) => w.tipo === "update" && w.tabella === "cantiere_appunti").map((w) => w.patch), nascosto: document.getElementById("homeHeroDaFareBox").hidden }));
    verifica("spunta in Home: fatto (data salvata), la lista sparisce", spuntato.update.length === 1 && !!spuntato.update[0].fatto_il && spuntato.nascosto, JSON.stringify(spuntato));
    const conVoce = await page.evaluate(async () => {
      const r = {};
      document.getElementById("aiToastContainer").innerHTML = "";
      const a = cantiereAppunti[0]; rimettiAppuntoDaFare(a);
      r.ancoraDaFare = !document.getElementById("homeHeroDaFareBox").hidden;
      r.hoChiamato = provaComandiSemplici("ho chiamato Pedro", false) && !!a.fattoIl;
      rimettiAppuntoDaFare(a);
      r.hoFinito = provaComandiSemplici("ho finito di chiamare Pedro", false) && !!a.fattoIl;
      navigateTo("cantiere-appunti");
      r.spuntaNegliAppunti = !!document.querySelector("#cantiereAppuntiLista .cantiere-appunto.fatto .cantiere-appunto-check");
      r.conClienteAllAI = await provaDaFareImmediato("ricordami di chiamare Rita Ambrosini") === false;
      navigateTo("home");
      return r;
    });
    verifica("\"ho chiamato Pedro\" / \"ho finito di chiamare Pedro\" lo spuntano; negli Appunti c'è la spunta; con un cliente decide l'AI", Object.values(conVoce).every(Boolean), JSON.stringify(conVoce));

    /* ---- Modifica di un appunto nella card ---- */
    const appunto = await page.evaluate(() => {
      window.__scritture.length = 0;
      cantiereAppunti.splice(0, cantiereAppunti.length, { id: "ap1", testo: "Per la caldaia di Baudi portare la chiave", created: new Date().toISOString(), clientId: null });
      navigateTo("cantiere-appunti"); renderCantiereAppunti();
      const voce = document.querySelector(".cantiere-appunto-testo");
      voce.parentElement.click();
      const campo = document.getElementById("modificaAppuntoCampo");
      return { card: !!campo, testo: campo && campo.value, mic: !!document.querySelector(".scheda-composer .scheda-mic"), campoPagina: document.getElementById("cantiereAppuntiCampo").value };
    });
    verifica("tocco su un appunto: si apre la card con il testo, il microfono e Salva (la casella della pagina resta libera)", appunto.card && appunto.testo === "Per la caldaia di Baudi portare la chiave" && appunto.mic && appunto.campoPagina === "", JSON.stringify(appunto));
    await page.fill("#modificaAppuntoCampo", "Per la caldaia di Baudi portare chiave e sportello 12");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const salvato = await page.evaluate(() => ({ scritto: window.__scritture.filter((w) => w.tabella === "cantiere_appunti"), inLista: document.querySelector(".cantiere-appunto-testo").textContent, card: document.getElementById("risorsaOverlay").style.display !== "none" }));
    verifica("Salva: appunto aggiornato, card chiusa", salvato.scritto.length === 1 && salvato.scritto[0].id === "ap1" && salvato.scritto[0].patch.testo === "Per la caldaia di Baudi portare chiave e sportello 12" && salvato.inLista === "Per la caldaia di Baudi portare chiave e sportello 12" && !salvato.card, JSON.stringify(salvato));

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
