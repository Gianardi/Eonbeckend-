/* Tre richieste di Andrea (27/09/2026), nella vera index.html con Supabase finto:
   1. cancellare gli appunti a voce o scritto ("cancella l'ultimo appunto",
      "togli l'appunto della chiave", "annulla" subito dopo), con Annulla;
   2. scorrere per eliminare preventivi e fatture (la fattura porta con sé la
      sua entrata), con Annulla; la numerazione non riusa mai un numero;
   3. importare i clienti dalla rubrica (.vcf) o da Excel/CSV: elenco con le
      caselle, niente doppioni, telefono/email aggiunti a chi c'è già.
   Nessuna chiamata all'AI.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/appunti-documenti-import.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const zlib = require("zlib");

const PORT = 8998;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

/* Un .xlsx vero, minimo: zip con il foglio e le stringhe condivise */
function creaXlsx(righe) {
  const stringhe = [];
  const idx = (t) => { let i = stringhe.indexOf(t); if (i < 0) { stringhe.push(t); i = stringhe.length - 1; } return i; };
  const col = (n) => String.fromCharCode(65 + n);
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
    righe.map((r, i) => `<row r="${i + 1}">` + r.map((v, j) => v === "" ? "" : typeof v === "number" ? `<c r="${col(j)}${i + 1}"><v>${v}</v></c>` : `<c r="${col(j)}${i + 1}" t="s"><v>${idx(v)}</v></c>`).join("") + `</row>`).join("") +
    `</sheetData></worksheet>`;
  const ss = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` + stringhe.map((t) => `<si><t>${t}</t></si>`).join("") + `</sst>`;
  const file = [["xl/worksheets/sheet1.xml", sheet], ["xl/sharedStrings.xml", ss]];
  const locali = [], centrali = []; let offset = 0;
  for (const [nome, contenuto] of file) {
    const dati = Buffer.from(contenuto), compresso = zlib.deflateRawSync(dati), n = Buffer.from(nome), crc = zlib.crc32(dati);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(compresso.length, 18); lh.writeUInt32LE(dati.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(compresso.length, 20); ch.writeUInt32LE(dati.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    locali.push(lh, n, compresso); centrali.push(ch, n);
    offset += 30 + n.length + compresso.length;
  }
  const cd = Buffer.concat(centrali);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(file.length, 8); eocd.writeUInt16LE(file.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locali, cd, eocd]);
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
      window.__chiamateAI = 0;
      window.__scritture = [];
      const sessione = { access_token: "tok", user: { id: "u1", email: "andrea@esempio.it" } };
      let n = 0;
      const catena = (tabella) => { const q = {
        update: (patch) => ({ eq: async (k, id) => { window.__scritture.push({ tabella, patch, id }); return { error: null }; } }),
        insert: (righe) => { const lista = (Array.isArray(righe) ? righe : [righe]).map((r) => ({ id: tabella + "-" + (++n), created_at: new Date().toISOString(), ...r }));
          window.__scritture.push({ tabella, inserite: lista });
          return { select: () => { const p = Promise.resolve({ data: lista, error: null }); p.single = async () => ({ data: lista[0], error: null }); return p; } }; },
        delete: () => ({ eq: async (k, id) => { window.__scritture.push({ tabella, cancellata: id }); return { error: null }; } }),
        select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, maybeSingle: async () => ({ data: null, error: null }),
        single: async () => (tabella === "profiles" ? { data: { id: "u1", full_name: "Andrea Gianardi", business_name: "", profession: "edile" }, error: null } : { data: null, error: null }),
        then: (ok) => ok({ data: [], error: null }) }; return q; };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on(){ return this; }, subscribe(){ return this; } }), storage: { from: () => ({}) },
        auth: { getSession: async () => ({ data: { session: sessione } }), onAuthStateChange: () => ({}) } }) };
      const fetchVero = window.fetch;
      window.fetch = async (url, init) => {
        if (String(url).includes("action=assistant")) { window.__chiamateAI++; return new Response(JSON.stringify({ stato: "concluso", testo: "ok", azioni: [] }), { headers: { "content-type": "application/json" } }); }
        if (String(url).includes("/api?")) return new Response("{}", { headers: { "content-type": "application/json" } });
        return fetchVero(url, init);
      };
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const chiedi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; window.__scritture.length = 0; });
      await page.fill("#homeHeroCampo", frase);
      await page.click("#homeHeroSend");
      await page.waitForTimeout(350);
    };
    const annulla = async () => { await page.locator("#aiToastContainer button", { hasText: "Annulla" }).last().click(); await page.waitForTimeout(250); };

    /* ===== 1. Appunti ===== */
    await page.evaluate(() => {
      clients.length = 0; clients.push({ id: "baudi", name: "Baudi", status: "attivo", value: 0, archived: false });
      cantiereAppunti.length = 0;
      cantiereAppunti.push(
        { id: "a1", testo: "Comprare il silicone", created: "2026-09-20T10:00:00Z" },
        { id: "a2", testo: "Portare la chiave inglese", created: "2026-09-21T10:00:00Z" },
        { id: "a3", testo: "Sportello 12", created: "2026-09-22T10:00:00Z", clientId: "baudi" },
        { id: "a4", testo: "Chiamare il fornitore", created: "2026-09-23T10:00:00Z" },
      );
    });
    const ids = () => page.evaluate(() => cantiereAppunti.map((a) => a.id).sort().join(","));

    await chiedi("cancella l'ultimo appunto");
    let sc = await page.evaluate(() => window.__scritture.slice());
    verifica("\"cancella l'ultimo appunto\": via il più recente (nel Cestino)", (await ids()) === "a1,a2,a3" && sc.some((x) => x.tabella === "cantiere_appunti" && x.id === "a4" && x.patch.deleted_at), JSON.stringify({ ids: await ids(), sc }));
    await annulla();
    verifica("e Annulla lo rimette", (await ids()) === "a1,a2,a3,a4");

    await chiedi("togli l'appunto della chiave");
    verifica("\"togli l'appunto della chiave\": via solo quello", (await ids()) === "a1,a3,a4", await ids());
    await annulla();

    await chiedi("cancella gli appunti di Baudi");
    verifica("\"cancella gli appunti di Baudi\": quello legato al cliente Baudi", (await ids()) === "a1,a2,a4", await ids());
    await annulla();

    await chiedi("cancella tutti gli appunti");
    const card = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, righe: document.querySelectorAll(".annulla-riga").length }));
    verifica("\"cancella tutti gli appunti\": prima chiede, con l'elenco", card.titolo === "Quali appunti cancello?" && card.righe === 4 && (await ids()) === "a1,a2,a3,a4", JSON.stringify(card));
    await page.click("#cancellaAppuntiConferma");
    await page.waitForTimeout(250);
    verifica("confermato: tutti nel Cestino", (await ids()) === "", await ids());
    await annulla();
    verifica("Annulla: tornano tutti", (await ids()) === "a1,a2,a3,a4", await ids());

    await chiedi("segnami negli appunti comprare il nastro");
    const nuovo = await page.evaluate(() => cantiereAppunti.find((a) => a.testo === "Comprare il nastro"));
    await chiedi("annulla");
    verifica("\"annulla\" subito dopo un appunto: tolto proprio quello", nuovo && !(await page.evaluate((id) => cantiereAppunti.some((a) => a.id === id), nuovo.id)), JSON.stringify(nuovo));

    await chiedi("togli l'appunto delle piastrelle");
    verifica("appunto che non c'è: lo dice, non cancella niente", (await ids()) === "a1,a2,a3,a4" && /Non trovo appunti/.test(await page.textContent("body")));

    /* ===== 2. Preventivi e fatture: scorri per eliminare ===== */
    await page.evaluate(() => {
      chiudiRisorsaCard();
      chats.length = 0; incomes.length = 0;
      const doc = (id, tipo, numero, totale, voce) => ({ id, eventType: "doc", docTipo: tipo, docAnno: 2026, createdAt: "2026-09-2" + numero + "T10:00:00Z",
        docDati: { tipo, numero: numero + "/2026", anno: 2026, cliente: "Mario Rossi", totale, data: "2" + numero + "/09/2026", voci: [{ desc: voce, qta: 1, prezzo: totale }] } });
      chats.push({ name: "Mario Rossi", messages: [doc("f1", "fattura", 1, 500, "Bagno"), doc("f2", "fattura", 2, 800, "Cucina"), doc("f3", "fattura", 3, 300, "Tetto"), doc("p1", "preventivo", 1, 900, "Caldaia")] });
      incomes.push({ id: "e2", client: "Mario Rossi", desc: "Cucina", amount: 800, status: "attesa" }, { id: "e9", client: "Mario Rossi", desc: "Altro", amount: 800, status: "attesa" });
      filtroFatturePreventivi = "fattura";
      navigateTo("fatture-preventivi");
    });
    await page.waitForTimeout(250);
    const righeDoc = () => page.evaluate(() => [...document.querySelectorAll("#fpLista .doc-num")].map((e) => e.textContent).join(","));
    verifica("cartella Fatture: 3 fatture, ognuna scorrevole", (await righeDoc()) === "FT 3/2026,FT 2/2026,FT 1/2026" && (await page.locator("#fpLista .doc-scorri").count()) === 3, await righeDoc());
    const box = await page.locator("#fpLista .doc-scorri").nth(1).boundingBox();
    const x = box.x + box.width - 30, y = box.y + box.height / 2;
    await page.evaluate(() => { window.__scritture.length = 0; document.getElementById("aiToastContainer").innerHTML = ""; });
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x - 15 * i, y);
    await page.mouse.up();
    await page.waitForTimeout(250);
    await page.locator("#fpLista .doc-scorri").nth(1).locator(".scorri-elimina").click();
    await page.waitForTimeout(250);
    sc = await page.evaluate(() => window.__scritture.slice());
    const dopoDoc = await page.evaluate(() => ({ entrate: incomes.map((i) => i.id).join(","), avviso: document.getElementById("aiToastContainer").textContent }));
    verifica("scorro la fattura 2/2026 e tocco Elimina: nel Cestino con la sua entrata (non l'altra da €800)",
      (await righeDoc()) === "FT 3/2026,FT 1/2026" && sc.some((s) => s.tabella === "messages" && s.id === "f2") && sc.some((s) => s.tabella === "incomes" && s.id === "e2") && dopoDoc.entrate === "e9" && /Fattura eliminata/.test(dopoDoc.avviso),
      JSON.stringify({ righe: await righeDoc(), sc, dopoDoc }));
    const numero = await page.evaluate(() => prossimoNumero("fattura"));
    verifica("la prossima fattura è la 4/2026 (il numero 2 o 3 non si ripete)", numero === "4/2026", numero);
    await annulla();
    verifica("Annulla: fattura ed entrata tornano", (await righeDoc()) === "FT 3/2026,FT 2/2026,FT 1/2026" && (await page.evaluate(() => incomes.map((i) => i.id).sort().join(","))) === "e2,e9");

    /* ===== 3. Importa clienti ===== */
    await page.evaluate(() => {
      clients.length = 0;
      clients.push({ id: "c1", name: "Mario Rossi", status: "attivo", value: 0, archived: false, phone: "", email: "" });
      navigateTo("clienti");
    });
    await page.click("#importaClientiBtn");
    await page.waitForTimeout(200);
    verifica("\"Importa dalla rubrica o da Excel\": spiega dove trovare il file", /Esporta/.test(await page.textContent("#risorsaCorpo")) && (await page.isVisible("#importaScegliFile")));

    const vcf = [
      "BEGIN:VCARD", "VERSION:3.0", "N:Rossi;Mario;;;", "FN:Mario Rossi", "TEL;type=CELL:+39 333 1234567", "EMAIL;type=INTERNET:mario@rossi.it", "END:VCARD",
      "BEGIN:VCARD", "VERSION:3.0", "N:Podda;Michele;;;", "FN:Michele Podda", "TEL;type=HOME:0544 123456", "item1.TEL;type=CELL:347 7654321", "END:VCARD",
      "BEGIN:VCARD", "VERSION:2.1", "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Nicol=C3=B2;Luca;;;", "TEL;CELL:3201112223", "END:VCARD",
      "BEGIN:VCARD", "VERSION:3.0", "ORG:Idraulica Bianchi Srl", "TEL:0541 999888", "END:VCARD",
      "BEGIN:VCARD", "VERSION:3.0", "TEL:3339990000", "END:VCARD",
    ].join("\r\n");
    await page.setInputFiles("#importaClientiFile", { name: "contatti.vcf", mimeType: "text/vcard", buffer: Buffer.from(vcf) });
    await page.waitForTimeout(400);
    const elenco = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, righe: [...document.querySelectorAll(".importa-riga")].map((r) => [...r.querySelectorAll(".importa-testo b, .importa-testo span, .importa-gia")].map((e) => e.textContent).join(" ")), riepilogo: document.querySelector(".importa-riepilogo").textContent }));
    verifica("rubrica (.vcf): 4 contatti con nome (1 senza nome saltato), Mario Rossi \"Già cliente\"",
      elenco.titolo === "Importa clienti" && elenco.righe.length === 4 && elenco.righe.some((r) => /Mario Rossi.*Già cliente/.test(r)) && elenco.righe.some((r) => /Michele Podda 347 7654321/.test(r)) && elenco.righe.some((r) => /Luca Nicolò/.test(r)) && elenco.righe.some((r) => /Idraulica Bianchi Srl/.test(r)) && /1 senza nome/.test(elenco.riepilogo),
      JSON.stringify(elenco));
    // tolgo la spunta a Idraulica Bianchi (non è un cliente) e importo
    await page.locator(".importa-riga", { hasText: "Idraulica Bianchi" }).locator("input").uncheck();
    await page.evaluate(() => { window.__scritture.length = 0; });
    await page.click("#importaVai");
    await page.waitForTimeout(400);
    sc = await page.evaluate(() => window.__scritture.slice());
    const dopoImport = await page.evaluate(() => ({ clienti: clients.map((c) => [c.name, c.phone, c.email || "", c.status].join("|")), avviso: document.getElementById("aiToastContainer").textContent }));
    const inserite = (sc.find((s) => s.tabella === "clients" && s.inserite) || {}).inserite || [];
    verifica("importati Michele Podda e Luca Nicolò (non Idraulica Bianchi), senza chat in massa",
      inserite.map((r) => r.name).sort().join(",") === "Luca Nicolò,Michele Podda" && !sc.some((s) => s.tabella === "conversations") && dopoImport.clienti.includes("Michele Podda|347 7654321||inattivo"),
      JSON.stringify({ inserite, dopoImport }));
    verifica("Mario Rossi non raddoppia: gli si aggiungono telefono ed email",
      dopoImport.clienti.filter((c) => c.startsWith("Mario Rossi|")).length === 1 && sc.some((s) => s.tabella === "clients" && s.id === "c1" && s.patch.phone === "+39 333 1234567" && s.patch.email === "mario@rossi.it"),
      JSON.stringify(sc.filter((s) => s.id === "c1")));
    verifica("avviso finale: 2 nuovi, 1 aggiornato", /2 clienti nuovi · 1 aggiornato/.test(dopoImport.avviso), dopoImport.avviso);

    // CSV di Fatture in Cloud (punto e virgola, colonne "Denominazione", "Tel", "Email")
    const csv = "﻿Denominazione;Partita IVA;Tel;Email\r\nCondominio Aurora;01234567890;0544 111222;amministrazione@aurora.it\r\n\"Rossi, Verdi & C.\";;;info@rv.it\r\n";
    await page.evaluate(() => { chiudiRisorsaCard(); });
    await page.setInputFiles("#importaClientiFile", { name: "clienti.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.waitForTimeout(400);
    const righeCsv = await page.evaluate(() => [...document.querySelectorAll(".importa-riga")].map((r) => [...r.querySelectorAll(".importa-testo b, .importa-testo span, .importa-gia")].map((e) => e.textContent).join(" ")));
    verifica("Excel/CSV di Fatture in Cloud: colonne riconosciute (nome, telefono, email)", righeCsv.length === 2 && /Condominio Aurora 0544 111222 · amministrazione@aurora\.it/.test(righeCsv[0]) && /Rossi, Verdi & C\. info@rv\.it/.test(righeCsv[1]), JSON.stringify(righeCsv));

    // Excel vero (.xlsx) stile Google/Outlook: Nome + Cognome separati
    const xlsx = creaXlsx([["Nome", "Cognome", "Cellulare", "E-mail"], ["Sara", "Dini", 3331234567, "sara@dini.it"], ["Walter", "Neri", "", ""]]);
    await page.evaluate(() => { chiudiRisorsaCard(); });
    await page.setInputFiles("#importaClientiFile", { name: "clienti.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: xlsx });
    await page.waitForTimeout(500);
    const righeX = await page.evaluate(() => [...document.querySelectorAll(".importa-riga")].map((r) => [...r.querySelectorAll(".importa-testo b, .importa-testo span, .importa-gia")].map((e) => e.textContent).join(" ")));
    verifica("Excel (.xlsx): letto senza librerie, Nome + Cognome uniti", righeX.length === 2 && /Sara Dini 3331234567 · sara@dini\.it/.test(righeX[0]) && /Walter Neri Senza telefono né email/.test(righeX[1]), JSON.stringify(righeX));

    // A voce
    await chiedi("importa i clienti dalla rubrica");
    verifica("\"importa i clienti dalla rubrica\": si apre l'importazione", (await page.textContent("#risorsaTitolo")) === "Importa clienti" && (await page.isVisible("#importaScegliFile")));

    verifica("nessuna chiamata all'AI", (await page.evaluate(() => window.__chiamateAI)) === 0, String(await page.evaluate(() => window.__chiamateAI)));
    verifica("nessun errore nella pagina", erroriPagina.length === 0, JSON.stringify(erroriPagina));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
