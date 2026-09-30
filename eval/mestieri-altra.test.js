/* Mestieri, "Altra attività" e Home semplice (28/09/2026), nel browser vero
   con Supabase finto:
   - ogni mestiere ha il suo colore, la sua icona, il suo esempio e le sue card;
   - Home: riquadro "Oggi" con "Calendario →" e tasto "Appunti" che mostra la
     prima cosa da fare; il tasto apre la card degli appunti (cerchi da
     spuntare, note con la matita, microfono e casella in fondo);
   - "Altra attività": questionario da tre tocchi all'iscrizione (le risposte
     vanno nei dati dell'account), cartelle proposte, da creare, rinominare
     ed eliminare; "segna in Fornitori di chiamare la Peroni" va nella cartella;
   - su telefono e su computer.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/mestieri-altra.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8996;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

const finto = () => {
  window.__scritture = []; window.__tabelle = {};
  const catena = (tabella) => {
    const q = {
      select: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q, is: () => q, not: () => q, eq: () => q,
      update: (patch) => ({ eq: async (c, v) => { window.__scritture.push({ tipo: "update", tabella, id: v, patch }); return { error: null }; } }),
      insert: (riga) => {
        window.__scritture.push({ tipo: "insert", tabella, riga });
        const n = window.__scritture.length;
        const salva = (r, i) => ({ id: "n" + n + "_" + i, created_at: new Date().toISOString(), ...r });
        const salvato = Array.isArray(riga) ? riga.map(salva) : salva(riga, 0);
        return { then: (ok) => ok({ data: salvato, error: null }), select: () => ({ single: async () => ({ data: salvato, error: null }), then: (ok) => ok({ data: salvato, error: null }) }) };
      },
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      then: (ok) => ok({ data: window.__tabelle[tabella] || [], error: null }),
    };
    return q;
  };
  window.supabase = { createClient: () => ({
    from: catena,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({}) },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({}),
      signUp: async (x) => { window.__signUp = x; return { data: { user: { id: "u1" }, session: null }, error: null }; },
    },
  }) };
};

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(finto);
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });

    /* ---- Iscrizione "Altra attività": questionario ---- */
    const scelta = await page.evaluate(() => [...document.querySelectorAll("#obTypeCards .ob-card")].map((c) => c.textContent.replace(/\s+/g, " ").trim()));
    verifica("prima scelta: \"Artigiani\" e \"Altra attività\"", scelta.length === 2 && /Artigiani/.test(scelta[0]) && /Altra attività/.test(scelta[1]), JSON.stringify(scelta));
    await page.click("#obTypeCards .ob-card[data-type='generico']");
    await page.click("#obType0ContinueBtn");
    const q1 = await page.evaluate(() => ({ visibile: document.getElementById("obStepAttivita").classList.contains("visible"), bloccato: document.getElementById("obAttivitaContinua").disabled, domande: document.querySelectorAll("#obStepAttivita [data-domanda]").length }));
    verifica("\"Altra attività\" → tre domande, Continua spento finché non si risponde", q1.visibile && q1.bloccato && q1.domande === 3, JSON.stringify(q1));
    await page.click("[data-domanda='tipo'] [data-v='negozio']");
    await page.click("[data-domanda='tipo'] [data-v='bar']");
    await page.click("[data-domanda='modo'] [data-v='passaggio']");
    const ancoraSpento = await page.evaluate(() => document.getElementById("obAttivitaContinua").disabled);
    await page.click("[data-domanda='persone'] [data-v='2-5']");
    const q2 = await page.evaluate(() => ({ acceso: !document.getElementById("obAttivitaContinua").disabled, scelte: [...document.querySelectorAll("#obStepAttivita .ob-chip.on")].map((c) => c.dataset.v) }));
    verifica("una risposta per domanda (l'ultima tocca vince), Continua si accende alla terza", ancoraSpento && q2.acceso && q2.scelte.join() === "bar,passaggio,2-5", JSON.stringify(q2));
    await page.click("#obAttivitaContinua");
    await page.fill("#obName", "Luca Rossi");
    await page.fill("#obBusinessName", "Bar Centrale");
    await page.fill("#obEmail", "luca@esempio.it");
    await page.fill("#obPassword", "passwordLunga1");
    await page.check("#obAccetto");
    await page.click("#obFinishBtn");
    await page.waitForTimeout(400);
    const dati = await page.evaluate(() => window.__signUp && window.__signUp.options.data);
    verifica("iscrizione: professione \"artigiano\" e le tre risposte nei dati dell'account", dati && dati.profession === "artigiano" && dati.attivita_tipo === "bar" && dati.attivita_modo === "passaggio" && dati.attivita_persone === "2-5", JSON.stringify(dati));
    verifica("cartelle proposte: bar con personale → Fornitori, Personale, Scadenze, Incassi; da solo niente Personale",
      await page.evaluate(() => cartelleProposte("bar", "2-5").join() === "Fornitori,Personale,Scadenze,Incassi" && !cartelleProposte("bar", "solo").includes("Personale") && cartelleProposte("studio").join() === "Clienti,Pratiche,Scadenze,Incassi"));

    /* ---- Home dei mestieri ---- */
    await page.goto(`http://localhost:${PORT}/index.html?r=2`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      cantiereAppunti.splice(0, cantiereAppunti.length); tasks.splice(0, tasks.length);
      renderCantiereAppunti();
    });
    const mestieri = {};
    for (const k of ["edile", "idraulico", "elettricista", "amministratore"]) {
      mestieri[k] = await page.evaluate(async (k) => {
        await applyProfession(k, true); navigateTo("home");
        const acc = getComputedStyle(document.body).getPropertyValue("--acc").trim();
        return {
          classe: document.body.classList.contains("mestiere-" + k) && document.body.className.split(" ").filter((c) => c.startsWith("mestiere-")).length === 1,
          acc,
          chip: document.getElementById("brandAvatar").textContent.trim(),
          hint: document.getElementById("homeHeroHint").textContent,
          carte: [...document.querySelectorAll("#homeCarteMestiere > .cantiere-card .cantiere-card-title")].map((t) => t.textContent),
          seconda: document.getElementById("homeCartaMestiere").dataset.page,
          // 28/09: anche gli artigiani hanno le cartelle, sotto le 4 card: all'inizio solo "+ Nuova cartella"
          cartelleSoloNuova: !document.getElementById("cartelleGriglia").hidden && !!document.getElementById("cartellaNuova") && !document.querySelector("#cartelleGriglia .cartella"),
          carteVisibili: getComputedStyle(document.getElementById("homeCarteMestiere")).display !== "none",
        };
      }, k);
    }
    const colori = new Set(Object.values(mestieri).map((m) => m.acc));
    verifica("ogni mestiere ha un colore suo (4 diversi) e la sua classe", colori.size === 4 && Object.values(mestieri).every((m) => m.classe), JSON.stringify([...colori]));
    verifica("chip del mestiere in alto: Impresa edile / Idraulico / Elettricista / Amministratore",
      mestieri.edile.chip === "Impresa edile" && mestieri.idraulico.chip === "Idraulico" && mestieri.elettricista.chip === "Elettricista" && mestieri.amministratore.chip === "Amministratore", JSON.stringify(Object.values(mestieri).map((m) => m.chip)));
    verifica("card del mestiere: Cantieri+DURC, Interventi+Preventivi, Impianti+Certificazioni, Condomini+Assemblee",
      mestieri.edile.carte.join() === "Cantieri,DURC e documenti impresa,Documenti,Foto cantiere" && mestieri.edile.seconda === "documenti-impresa"
      && mestieri.idraulico.carte[0] === "Interventi" && mestieri.idraulico.seconda === "fatture-preventivi"
      && mestieri.elettricista.carte.join() === "Impianti,Preventivi e fatture,Certificazioni e documenti,Foto quadri"
      && mestieri.amministratore.carte[0] === "Condomini" && mestieri.amministratore.seconda === "assemblee", JSON.stringify(Object.fromEntries(Object.entries(mestieri).map(([k, m]) => [k, m.carte]))));
    verifica("esempio vocale del mestiere sotto il microfono; sotto le card solo «+ Nuova cartella»",
      /solaio/.test(mestieri.edile.hint) && /perdita/.test(mestieri.idraulico.hint) && /conformità/.test(mestieri.elettricista.hint) && /assemblea/.test(mestieri.amministratore.hint)
      && Object.values(mestieri).every((m) => m.cartelleSoloNuova && m.carteVisibili));

    /* ---- Stesse pagine, nomi del mestiere: titoli e voce ---- */
    const titoli = await page.evaluate(async () => {
      const r = {};
      const titolo = (pg) => { navigateTo(pg); return document.getElementById("pageTitle").textContent; };
      await applyProfession("idraulico", true);
      r.idraulico = [titolo("cantiere-cliente"), titolo("cantiere-foto"), titolo("cantiere-documenti")];
      await applyProfession("elettricista", true);
      r.elettricista = [titolo("cantiere-cliente"), titolo("cantiere-foto"), titolo("cantiere-documenti")];
      await applyProfession("amministratore", true);
      r.amministratore = [titolo("cantiere-cliente"), titolo("cantiere-foto")];
      await applyProfession("edile", true);
      r.edile = [titolo("cantiere-cliente"), titolo("documenti-impresa"), titolo("cantiere-foto")];
      navigateTo("home");
      document.querySelectorAll(".ai-landing-overlay").forEach((o) => { o.style.display = "none"; });
      return r;
    });
    verifica("la pagina aperta ha il nome della card del mestiere (stessa pagina di prima)",
      titoli.idraulico.join() === "Interventi,Foto impianti,Documenti" && titoli.elettricista.join() === "Impianti,Foto quadri,Certificazioni e documenti"
      && titoli.amministratore.join() === "Condomini,Foto" && titoli.edile.join() === "Cantieri,DURC e documenti impresa,Foto cantiere", JSON.stringify(titoli));
    const aVoce = await page.evaluate(() => {
      const r = {};
      for (const [frase, pagina] of [["apri i cantieri", "cantiere-cliente"], ["apri gli interventi", "cantiere-cliente"], ["mostrami gli impianti", "cantiere-cliente"], ["apri i condomini", "cantiere-cliente"], ["apri le certificazioni", "cantiere-documenti"], ["apri le foto dei quadri", "cantiere-foto"], ["apri durc e documenti", "documenti-impresa"]]) {
        navigateTo("home");
        r[frase] = provaNavigazioneDiretta(frase) && paginaAttuale === pagina;
      }
      navigateTo("home");
      r["fammi il durc per Rossi → AI"] = provaNavigazioneDiretta("fammi il durc per Rossi") === false;
      document.querySelectorAll(".ai-landing-overlay").forEach((o) => { o.style.display = "none"; });
      return r;
    });
    verifica("a voce i nomi nuovi aprono la pagina giusta senza AI (\"apri i condomini\", \"apri gli interventi\"…)", Object.values(aVoce).every(Boolean), JSON.stringify(aVoce));

    /* ---- Home: Oggi e tasto Appunti ---- */
    const home = await page.evaluate(async () => {
      await applyProfession("edile", true); navigateTo("home");
      const r = {};
      r.oggi = !!document.getElementById("homeHeroOggiBox") && document.getElementById("homeOggiCalendario").dataset.page === "calendario";
      r.vecchi = !document.getElementById("homeHeroDaFareBox") && !document.getElementById("homeHeroCal");
      renderDaFare();
      r.vuoto = document.getElementById("homeAppuntiSub").textContent;
      cantiereAppunti.push({ id: "a1", testo: "Chiamare Pedro", created: new Date().toISOString(), daFare: true, fattoIl: null },
        { id: "a2", testo: "Comprare il silicone", created: new Date(Date.now() - 6e5).toISOString(), daFare: true, fattoIl: null },
        { id: "a3", testo: "Misure bagno Bianchi", created: new Date(Date.now() - 864e5).toISOString(), daFare: false });
      renderCantiereAppunti();
      r.pieno = document.getElementById("homeAppuntiSub").textContent;
      return r;
    });
    verifica("Home: riquadro \"Oggi\" con \"Calendario →\"; spariti il vecchio riquadro \"Da fare\" e il tasto calendario", home.oggi && home.vecchi, JSON.stringify(home));
    verifica("tasto Mente: \"Svuota la testa: parla o scrivi\" se vuoto, poi \"Chiamare Pedro · e altre 1\"", home.vuoto === "Svuota la testa: parla o scrivi" && home.pieno === "Chiamare Pedro · e altre 1", JSON.stringify(home));
    await page.click("#homeOggiCalendario");
    const alCalendario = await page.evaluate(() => document.getElementById("page-calendario").classList.contains("visible"));
    verifica("\"Calendario →\" porta al calendario", alCalendario);
    await page.evaluate(() => navigateTo("home"));
    await page.click("#homeAppuntiBtn");
    const card = await page.evaluate(() => ({
      titolo: document.getElementById("risorsaTitolo").textContent,
      righe: [...document.querySelectorAll("#apLista .ap-riga")].map((r) => (r.querySelector(".ap-cerchio") ? "○ " : "✎ ") + r.querySelector(".ap-testo").textContent + (r.querySelector(".ap-quando") ? " [" + r.querySelector(".ap-quando").textContent + "]" : "")),
      mic: !!document.querySelector("#risorsaOverlay .scheda-mic"),
      campo: !!document.getElementById("apCampo"),
    }));
    verifica("card Appunti: prima le cose da fare col cerchio, poi le note con matita e giorno; microfono e casella in fondo",
      card.titolo === "Mente" && card.righe.join("|") === "○ Chiamare Pedro|○ Comprare il silicone|✎ Misure bagno Bianchi [ieri]" && card.mic && card.campo, JSON.stringify(card));
    await page.evaluate(() => { window.__scritture.length = 0; });
    await page.fill("#apCampo", "ricordami di ordinare il cemento");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await page.fill("#apCampo", "cancello Rossi codice 4412");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const aggiunti = await page.evaluate(() => ({
      ins: window.__scritture.filter((w) => w.tipo === "insert" && w.tabella === "cantiere_appunti").map((w) => [w.riga.testo, !!w.riga.da_fare, w.riga.cartella_id || null]),
      righe: [...document.querySelectorAll("#apLista .ap-testo")].map((t) => t.textContent),
      vuoto: document.getElementById("apCampo").value,
    }));
    verifica("scritto nella card: \"ricordami di…\" diventa da fare, il resto una nota; compaiono subito",
      JSON.stringify(aggiunti.ins) === JSON.stringify([["Ordinare il cemento", true, null], ["Cancello Rossi codice 4412", false, null]]) && aggiunti.righe.includes("Ordinare il cemento") && aggiunti.righe.includes("Cancello Rossi codice 4412") && aggiunti.vuoto === "", JSON.stringify(aggiunti));
    await page.click("#apLista > :first-child .ap-cerchio");
    await page.waitForTimeout(150);
    const spunta = await page.evaluate(() => ({
      patch: window.__scritture.filter((w) => w.tipo === "update" && w.tabella === "cantiere_appunti").map((w) => w.patch),
      sub: document.getElementById("homeAppuntiSub").textContent,
    }));
    verifica("cerchio nella card: fatto (data salvata), il tasto passa alla cosa successiva", spunta.patch.length === 1 && !!spunta.patch[0].fatto_il && !/Ordinare il cemento/.test(spunta.sub), JSON.stringify(spunta));
    await page.evaluate(() => chiudiRisorsaCard());

    /* ---- Altra attività: cartelle ---- */
    const altra = await page.evaluate(async () => {
      window.__scritture.length = 0;
      profiloUtente = { business_name: "Bar Centrale", full_name: "Luca", attivita_tipo: "bar", attivita_persone: "2-5" };
      await applyProfession("artigiano", true); navigateTo("home");
      await new Promise((r) => setTimeout(r, 200));
      return {
        classe: document.body.classList.contains("mestiere-artigiano"),
        chip: document.getElementById("brandAvatar").textContent.trim(),
        carteNascoste: getComputedStyle(document.getElementById("homeCarteMestiere")).display === "none",
        cartelle: [...document.querySelectorAll("#cartelleGriglia .cartella b")].map((b) => b.textContent),
        salvate: window.__scritture.filter((w) => w.tipo === "insert" && w.tabella === "cartelle").map((w) => w.riga.map((r) => r.nome + ":" + r.ordine)),
        nuova: !!document.getElementById("cartellaNuova"),
      };
    });
    verifica("Altra attività: al posto delle card dei mestieri le cartelle proposte dal questionario (salvate una volta)",
      altra.classe && altra.chip === "Bar Centrale" && altra.carteNascoste && altra.cartelle.join() === "Fornitori,Personale,Scadenze,Incassi" && altra.salvate.length === 1 && altra.salvate[0].join() === "Fornitori:0,Personale:1,Scadenze:2,Incassi:3" && altra.nuova, JSON.stringify(altra));
    const dueVolte = await page.evaluate(async () => { window.__scritture.length = 0; await applyProfession("artigiano", true); await new Promise((r) => setTimeout(r, 100)); return window.__scritture.filter((w) => w.tabella === "cartelle").length; });
    verifica("le cartelle proposte non si ricreano a ogni apertura", dueVolte === 0, String(dueVolte));

    await page.evaluate(() => { window.__scritture.length = 0; document.getElementById("aiToastContainer").innerHTML = ""; });
    const voce = await page.evaluate(async () => ({
      fatto: await provaAppuntoImmediato("segna in Fornitori di chiamare la Peroni"),
      nota: await provaAppuntoImmediato("metti nella cartella scadenze: affitto il 5"),
      altro: await provaAppuntoInCartella("segna in Magazzino le birre"),
    }));
    const inCartella = await page.evaluate(() => ({
      ins: window.__scritture.filter((w) => w.tipo === "insert" && w.tabella === "cantiere_appunti").map((w) => [w.riga.testo, !!w.riga.da_fare, w.riga.cartella_id]),
      sotto: [...document.querySelectorAll("#cartelleGriglia .cartella small")].map((s) => s.textContent),
      toast: document.getElementById("aiToastContainer").textContent,
      tasto: document.getElementById("homeAppuntiSub").textContent,
      ids: cartelle.map((c) => c.id),
    }));
    verifica("a voce \"segna in Fornitori di chiamare la Peroni\" → da fare in Fornitori; \"metti nella cartella scadenze: …\" → nota; cartella che non c'è → no",
      voce.fatto && voce.nota && !voce.altro && inCartella.ins.length === 2
      && inCartella.ins[0][0] === "Chiamare la Peroni" && inCartella.ins[0][1] && inCartella.ins[0][2] === inCartella.ids[0]
      && inCartella.ins[1][0] === "Affitto il 5" && !inCartella.ins[1][1] && inCartella.ins[1][2] === inCartella.ids[2]
      && inCartella.sotto[0] === "1 da fare" && inCartella.sotto[2] === "1 appunto" && /In Fornitori/.test(inCartella.toast), JSON.stringify({ voce, inCartella }));
    verifica("gli appunti delle cartelle non finiscono nel tasto Appunti della Home", !/Peroni|Affitto/.test(inCartella.tasto), inCartella.tasto);

    await page.click("#cartelleGriglia .cartella:first-child");
    const cartella = await page.evaluate(() => ({
      titolo: document.getElementById("risorsaTitolo").textContent,
      righe: [...document.querySelectorAll("#apLista .ap-testo")].map((t) => t.textContent),
      azioni: [...document.querySelectorAll(".ap-azioni button")].map((b) => b.textContent),
    }));
    verifica("una cartella si apre come la card Appunti, con solo i suoi appunti, «‹ Mente» (30/09) e Rinomina / Elimina",
      cartella.titolo === "Fornitori" && cartella.righe.join() === "Chiamare la Peroni" && cartella.azioni.join() === "‹ Mente,Scatta foto,Dalla galleria,Rinomina,Elimina cartella", JSON.stringify(cartella));
    await page.fill("#apCampo", "listino nuovo dal 1 ottobre");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const nellaCartella = await page.evaluate(() => { const w = window.__scritture.filter((x) => x.tipo === "insert").pop(); return { cartella: w.riga.cartella_id, id: cartelle[0].id }; });
    verifica("scritto dentro la cartella: resta nella cartella", nellaCartella.cartella === nellaCartella.id, JSON.stringify(nellaCartella));

    await page.click(".ap-azioni button[data-az='rinomina']");
    await page.fill("#cartellaNome", "fornitori e birre");
    await page.click("#cartellaNomeSalva");
    await page.waitForTimeout(150);
    const rinominata = await page.evaluate(() => ({ nome: document.querySelector("#cartelleGriglia .cartella b").textContent, patch: window.__scritture.filter((w) => w.tipo === "update" && w.tabella === "cartelle").map((w) => w.patch) }));
    verifica("Rinomina: nome nuovo (con la maiuscola) salvato", rinominata.nome === "Fornitori e birre" && rinominata.patch.some((p) => p.nome === "Fornitori e birre"), JSON.stringify(rinominata));

    await page.click("#cartellaNuova");
    await page.fill("#cartellaNome", "Idee");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const nuova = await page.evaluate(() => ({ nomi: [...document.querySelectorAll("#cartelleGriglia .cartella b")].map((b) => b.textContent), ins: window.__scritture.filter((w) => w.tipo === "insert" && w.tabella === "cartelle").map((w) => w.riga) }));
    verifica("+ Nuova cartella: creata e salvata in fondo", nuova.nomi[nuova.nomi.length - 1] === "Idee" && nuova.ins.length === 1 && nuova.ins[0].nome === "Idee" && nuova.ins[0].ordine === 4, JSON.stringify(nuova));

    await page.evaluate(() => { window.__scritture.length = 0; document.getElementById("aiToastContainer").innerHTML = ""; });
    await page.click("#cartelleGriglia .cartella:first-child");
    await page.click(".ap-azioni button[data-az='elimina']");
    await page.click("#aiToastContainer .ai-toast-yes");
    await page.waitForTimeout(200);
    const eliminata = await page.evaluate(() => ({
      nomi: [...document.querySelectorAll("#cartelleGriglia .cartella b")].map((b) => b.textContent),
      cartelle: window.__scritture.filter((w) => w.tabella === "cartelle").map((w) => Object.keys(w.patch).join()),
      appunti: window.__scritture.filter((w) => w.tabella === "cantiere_appunti").map((w) => w.patch.cartella_id),
      tasto: document.getElementById("homeAppuntiSub").textContent,
    }));
    verifica("Elimina cartella (con conferma): nel cestino, i suoi appunti tornano negli Appunti",
      !eliminata.nomi.includes("Fornitori e birre") && eliminata.cartelle.join() === "deleted_at" && eliminata.appunti.length === 2 && eliminata.appunti.every((v) => v === null) && /Chiamare la Peroni/.test(eliminata.tasto), JSON.stringify(eliminata));

    /* ---- Computer ---- */
    await page.setViewportSize({ width: 1366, height: 900 });
    const pc = await page.evaluate(async () => {
      chiudiRisorsaCard(); navigateTo("home");
      const griglia = document.getElementById("cartelleGriglia").getBoundingClientRect();
      const colonne = getComputedStyle(document.getElementById("cartelleGriglia")).gridTemplateColumns.split(" ").length;
      await applyProfession("idraulico", true);
      const carte = getComputedStyle(document.getElementById("homeCarteMestiere")).gridTemplateColumns.split(" ").length;
      const oggi = document.getElementById("homeHeroOggiBox").getBoundingClientRect();
      const appunti = document.getElementById("homeAppuntiBtn").getBoundingClientRect();
      return { larghezza: griglia.width, colonne, carte, oggiSopraAppunti: oggi.bottom <= appunti.top + 1, scroll: document.documentElement.scrollWidth <= window.innerWidth };
    });
    verifica("computer: cartelle e card su più colonne, \"Oggi\" sopra \"Appunti\", niente scorrimento di lato", pc.colonne >= 2 && pc.carte === 4 && pc.oggiSopraAppunti && pc.scroll, JSON.stringify(pc));

    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
