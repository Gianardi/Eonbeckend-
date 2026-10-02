/* Passo A: il modello che legge tutta la frase CONTRO le regole di oggi, sulle stesse frasi mai viste
   (gli scrittori tenuti fuori dall'allenamento). Si confronta il risultato che serve all'app, non le
   parole: il cliente trovato in rubrica e il giorno/ora normalizzati.
   Uso: node confronto.mjs [modello.json] (default modello-lettura.json)  env TIENI_FUORI=s11,s12 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const QUI = path.dirname(new URL(import.meta.url).pathname);
const RADICE = path.resolve(QUI, "../../..");
const L = require(path.join(RADICE, "lettore.js"));
const N = require(path.join(RADICE, "neurale.js"));
const file = process.argv[2] || path.join(RADICE, "modello-lettura.json");
const j = JSON.parse(fs.readFileSync(file, "utf8"));
const lista = (Array.isArray(j.modelli) ? j.modelli : [j]).map((x) => { const m = N.crea(); return m.carica(x) ? m : null; }).filter(Boolean);
if (!L.usaLettura(lista)) throw new Error("modello non caricato");
const FUORI = (process.env.TIENI_FUORI || "s11,s12").split(",");
const frasi = fs.readFileSync(path.join(QUI, "dati/scritte.jsonl"), "utf8").trim().split("\n").map((r) => JSON.parse(r)).filter((x) => FUORI.some((f) => x.fonte.includes("/" + f + ".")));
const oggi = new Date("2026-10-01T10:00:00");
const pezzi = (x, ruolo) => { const out = []; let prima = "O"; x.parole.forEach((w, i) => { const r = x.ruoli[i]; if (r === ruolo) { if (prima === ruolo) out[out.length - 1].push(w); else out.push([w]); } prima = r; }); return out.map((p) => p.join(" ").replace(/([’']) /g, "$1")); };
const quandoDi = (testo) => { if (!testo) return null; const q = L.trovaQuando(L.parole(L.pulisci(testo).testo), oggi); return (q.giornoIso || "-") + " " + (q.ora || "-"); };
const DISTRATTORI = ["Mario Rossi", "Bar Aurora", "Condominio Le Rose", "Giulia Bianchi", "Hotel Miramare", "Luca Ferrari", "Edil Sud", "Anna Verdi", "Pizzeria Stella", "Paolo Neri"];
const conta = { quando: { n: 0, modello: 0, regole: 0 }, chi: { n: 0, modello: 0, regole: 0 }, cassetto: { n: 0, modello: 0 } };
for (const x of frasi) {
  const chiOro = pezzi(x, "CHI");
  const clienti = [...chiOro, ...DISTRATTORI].map((name, i) => ({ id: "c" + i, name }));
  const ctx = { clienti, oggi };
  const mo = L.leggiConModello(x.frase, ctx);
  conta.cassetto.n++; conta.cassetto.modello += mo && mo.intento === x.intento ? 1 : 0;
  // quando: l'oro è il giorno e l'ora normalizzati dalle parole segnate dallo scrittore
  const g = [...pezzi(x, "GIO"), ...pezzi(x, "ORA")].join(" ");
  if (g) {
    const oro = quandoDi(g);
    conta.quando.n++;
    if (mo && mo.quando && (mo.quando.giornoIso || "-") + " " + (mo.quando.ora || "-") === oro) conta.quando.modello++;
    if (quandoDi(x.frase) === oro) conta.quando.regole++;
  }
  // chi: il primo nome segnato, cercato in rubrica
  if (chiOro.length) {
    conta.chi.n++;
    const atteso = clienti[0];
    const cm = mo && mo.chi.find((c) => c.cliente);
    if (cm && cm.cliente.id === atteso.id) conta.chi.modello++;
    const lr = L.leggi(x.frase, ctx);
    if (lr && lr.cliente && lr.cliente.id === atteso.id) conta.chi.regole++;
  }
}
const pc = (a, n) => (n ? Math.round((1000 * a) / n) / 10 + "%" : "-");
console.log(`Frasi mai viste (${FUORI.join(", ")}): ${frasi.length}`);
console.log(`  cassetto: modello ${pc(conta.cassetto.modello, conta.cassetto.n)}`);
console.log(`  quando (${conta.quando.n} frasi): modello ${pc(conta.quando.modello, conta.quando.n)} · regole ${pc(conta.quando.regole, conta.quando.n)}`);
console.log(`  chi, cliente giusto in rubrica (${conta.chi.n} frasi): modello ${pc(conta.chi.modello, conta.chi.n)} · regole ${pc(conta.chi.regole, conta.chi.n)}`);
