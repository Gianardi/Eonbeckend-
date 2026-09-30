/* Passo 4: frasi "d'argento" per il modello dei dettagli. I preventivi e le fatture già
   scritti per il primo modello (maestra, confini, parafrasi, frasario: parlato vero, NON i
   giri d'esame) etichettati in automatico dalle regole di oggi (trovaVoci). Si tiene solo
   quello che è senza dubbi: ogni numero trova una sola voce, e il conto dei ruoli dà lo
   stesso totale delle regole. Sconti e acconti restano al generatore.
   Uso: node argento.mjs > argento.jsonl */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const L = require(path.join(RADICE, "lettore.js"));

const righe = fs.readFileSync(path.join(RADICE, "eval/neurale/dati/allenamento.jsonl"), "utf8").trim().split("\n").map((x) => JSON.parse(x));
const ctx = { clienti: [], oggi: new Date("2026-09-29T10:00:00") };
let tenute = 0, scartate = 0;
for (const x of righe) {
  if (x.intento !== "documento") continue;
  if (/sconto|acconto|%|per\s*cento|percento|anticipo/i.test(x.frase)) { scartate++; continue; }
  const s = L.segniDettagli(x.frase);
  const l = L.leggiDocumento(x.frase, ctx) || L.leggi(x.frase, ctx);
  const voci = (l && l.voci && l.voci.length) ? l.voci : (l && l.importo != null ? [{ quantita: 1, prezzo: l.importo }] : []);
  const ruoli = s.segni.map(() => "O");
  // numeri nella frase ma le regole non ne hanno letto nessuno: non sappiamo, si scarta
  let dubbio = !voci.length && s.valori.some((v) => v != null);
  const prese = new Set();
  voci.forEach((v) => {
    const q = v.quantita || 1;
    const cerca = (val, esclusi) => s.valori.map((w, i) => [w, i]).filter(([w, i]) => w != null && Math.abs(w - val) < 0.001 && !prese.has(i) && !esclusi.includes(i)).map(([, i]) => i);
    const ip = cerca(v.prezzo, []);
    if (ip.length !== 1) { dubbio = true; return; }
    prese.add(ip[0]);
    if (q > 1) {
      const iq = cerca(q, []);
      if (iq.length !== 1) { dubbio = true; return; }
      prese.add(iq[0]); ruoli[iq[0]] = "QTA"; ruoli[ip[0]] = "PRZ";
    } else ruoli[ip[0]] = "TOT";
  });
  // un numero civico preso per un importo ("via Garibaldi 22 … 2.640" → 2.662): è un errore delle regole, si scarta
  const civico = ruoli.some((r, i) => r !== "O" && s.segni.slice(Math.max(0, i - 4), i).some((w) => /^(?:via|viale|corso|piazza|largo|vicolo|piazzale|civico|n)$/.test(w)) && !/^(?:euro|€)$/.test(s.segni[i + 1] || ""));
  if (civico) dubbio = true;
  const totRegole = voci.reduce((t, v) => t + (v.quantita || 1) * v.prezzo, 0);
  if (dubbio || Math.abs(L.componiImporti(s.valori, ruoli).totale - totRegole) > 0.01) { scartate++; continue; }
  console.log(JSON.stringify({ testo: x.frase, segni: s.segni, ruoli, totale: totRegole, fonte: "argento-" + x.fonte }));
  tenute++;
}
process.stderr.write(`Frasi d'argento: ${tenute} · scartate: ${scartate}\n`);
