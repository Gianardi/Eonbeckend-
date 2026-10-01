/* Il modello dei dettagli non peggiora mai (passo 4, 30/09/2026, rete di sicurezza).
   Sui preventivi e le fatture dei giri 8-17 con l'importo atteso: il lettore con il modello
   (regole + modello quando è sicurissimo) non sbaglia NESSUNA frase che le regole da sole
   fanno giusta, e il totale delle giuste non scende sotto il minimo; peso e velocità.
   Uso: node eval/modello-dettagli.test.mjs   (MODELLO=file per provarne uno nuovo) */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const L = require(path.join(RADICE, "lettore.js"));
const N = require(path.join(RADICE, "neurale.js"));
const FILE = process.env.MODELLO || path.join(RADICE, "modello-dettagli.json");
const MINIMO = 565, PESO_MAX_KB = 2048, MS_MAX = 60;
let falliti = 0;
const verifica = (nome, ok, dettaglio = "") => { console.log(`  ${ok ? "OK  " : "FAIL"} ${nome}${!ok && dettaglio ? " — " + dettaglio : ""}`); if (!ok) falliti++; };

const kb = fs.statSync(FILE).size / 1024;
verifica(`peso ${Math.round(kb)} KB (massimo ${PESO_MAX_KB})`, kb <= PESO_MAX_KB);
const j = JSON.parse(fs.readFileSync(FILE, "utf8"));
const modelli = (j.modelli || []).map((m) => { const x = N.crea(); return x.carica(m) ? x : null; }).filter(Boolean);
verifica(`${modelli.length} modelli caricati`, modelli.length >= 1 && modelli.length === (j.modelli || []).length);

const tot = (l) => (l && l.voci && l.voci.length ? l.voci.reduce((t, v) => t + (v.quantita || 1) * v.prezzo, 0) : l && l.importo);
const giusto = (l, atteso) => tot(l) != null && Math.abs(tot(l) - atteso) < 0.5;
let n = 0, prima = 0, dopo = 0, ms = 0;
const rotte = [];
const dir = path.join(RADICE, "eval/dati");
for (const f of fs.readdirSync(dir).filter((f) => /^frasi-giro\d+\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const m of Object.values(d.mestieri || {})) {
    const ctx = { clienti: (m.clienti || []).map((name, i) => ({ id: "c" + i, name })), oggi: new Date("2026-09-29T10:00:00") };
    for (const [frase, c, atteso] of m.frasi || []) {
      if (c !== "documento" || atteso == null) continue;
      n++;
      L.usaDettagli([]);
      const a = L.leggiDocumento(frase, ctx) || L.leggi(frase, ctx);
      L.usaDettagli(modelli);
      const t0 = performance.now();
      const b = L.leggiDocumento(frase, ctx) || L.leggi(frase, ctx);
      ms += performance.now() - t0;
      const okA = giusto(a, Number(atteso)), okB = giusto(b, Number(atteso));
      prima += okA; dopo += okB;
      if (okA && !okB) rotte.push(`${f}: «${frase.slice(0, 80)}» → ${tot(b)} invece di ${atteso}`);
    }
  }
}
verifica(`${n} frasi con importo: regole da sole ${prima}, regole + modello ${dopo} (minimo ${MINIMO})`, dopo >= MINIMO);
verifica(`nessuna frase giusta per le regole diventa sbagliata col modello`, rotte.length === 0, rotte.join(" | "));
verifica(`${(ms / n).toFixed(1)} ms a frase (massimo ${MS_MAX})`, ms / n <= MS_MAX);
// senza modello il lettore torna alle regole
L.usaDettagli([]);
verifica("senza modello decidono le regole", L.dettagliNeurali("preventivo 10 prese a 30") === null);
console.log(falliti ? `\n${falliti} controlli falliti` : "\nTutto ok");
process.exit(falliti ? 1 : 0);
