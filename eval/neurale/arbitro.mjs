/* Chi deve decidere il cassetto, le regole o il modello neurale? Per ogni frase
   dell'esame: l'azione delle regole (lettore) tradotta in cassetto, il cassetto
   del neurale e la sua sicurezza. Conta, per ogni soglia, quante frasi il
   neurale SALVA (regole sbagliate, neurale giusto) e quante ne ROVINA.
   Uso: node eval/neurale/arbitro.mjs file1.json file2.json … */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const L = require(path.join(RADICE, "lettore.js"));
const N = require(path.join(RADICE, "neurale.js"));
L.caricaModello(JSON.parse(fs.readFileSync(path.join(RADICE, "modello-eon.json"), "utf8")));
N.carica(JSON.parse(fs.readFileSync(path.join(RADICE, "modello-neurale.json"), "utf8")));
const DA_CATEGORIA = { calendario: "calendario", calendario_modifica: "calendario_modifica", documento: "documento", risorsa: "cerca_documento", foto: "cerca_documento", foto_scatta: "foto",
  mente: "mente", cliente: "cliente", messaggio: "messaggio", email: "email", chiamata: "chiamata", dati: "dati", cartella: "cartella", invio: "invio_documento", ai: "domanda",
  incasso: "incasso", urgenza: "urgenza", sal: "sal", dico: "dico", assemblea: "assemblea", risposta: "saluto" };
const DA_AZIONE = { documento: "documento", messaggio: "messaggio", whatsapp: "messaggio", impegno: "calendario", da_fare: "calendario", dati: "dati", email: "email", mente: "mente", chiama: "chiamata",
  nota_cartella: "cartella", nota_cartella_nuova: "cartella", cartella: "cartella", incasso: "incasso", doc_impresa: "cerca_documento", domanda: "domanda", modifica: "calendario_modifica", cliente: "cliente", apri_cliente: "cliente",
  invio_documento: "invio_documento", assemblea: "assemblea", urgenza: "urgenza", sal: "sal", dico: "dico" };
const righe = [];
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/dati", f), "utf8"));
  const mestieri = d.mestieri ? Object.values(d.mestieri) : [{ clienti: d.clienti || [], frasi: d.frasi }];
  for (const m of mestieri) {
    const ctx = { clienti: (m.clienti || []).map((name, i) => ({ id: "c" + i, name })), oggi: new Date("2026-09-29T10:00:00") };
    for (const [frase, c] of m.frasi) {
      const atteso = DA_CATEGORIA[c] || c;
      const l = L.leggi(frase, ctx);
      const regole = l && DA_AZIONE[l.azione] || null; // null = le regole non sanno (comando, seguito, piu…)
      const r = N.classifica(L.segni(frase));
      righe.push({ f, frase, atteso, regole, azione: l && l.azione, neurale: r.intento, p: r.p });
    }
  }
}
console.log(`frasi ${righe.length} · regole giuste ${righe.filter((x) => x.regole === x.atteso).length} · regole senza risposta ${righe.filter((x) => !x.regole).length} · neurale giusto ${righe.filter((x) => x.neurale === x.atteso).length}`);
for (const s of [0.6, 0.7, 0.8, 0.85, 0.9, 0.95]) {
  let salva = 0, rovina = 0, riempie = 0, riempieMale = 0;
  for (const x of righe) {
    if (x.p < s) continue;
    if (!x.regole) { if (x.neurale === x.atteso) riempie++; else riempieMale++; continue; }
    if (x.regole === x.neurale) continue;
    if (x.neurale === x.atteso) salva++; else if (x.regole === x.atteso) rovina++;
  }
  console.log(`soglia ${s}: quando le regole dicono altro → salva ${salva}, rovina ${rovina} · quando le regole non sanno → giusto ${riempie}, sbagliato ${riempieMale}`);
}
if (process.env.ELENCO) for (const x of righe.filter((x) => x.regole && x.regole !== x.neurale && x.p >= Number(process.env.ELENCO)))
  console.log(`${x.neurale === x.atteso ? "SALVA " : x.regole === x.atteso ? "ROVINA" : "tutti "} [${x.atteso}] regole=${x.regole}(${x.azione}) neurale=${x.neurale} ${x.p.toFixed(2)} «${x.frase.slice(0, 90)}»`);
