/* Le misure e le date dentro un preventivo non entrano nel conto (1/10/2026, giri 17-20).
   "vetrata 3 metri per 2 850 euro" contava 2 €, "4 finestre da 120 per 140 a 920" faceva 140
   finestre, "diametro 110", "da 1 pollice", "2 metri e 40", "intervento del 24 settembre",
   "3 cavalli", "250 A" diventavano voci. Restano le moltiplicazioni "6 metri x 25 euro al
   metro". E "8 tavoli a 450 e 32 sedie a 95" non sono 450,32 €.
   Uso: node eval/misure-preventivi.test.mjs */
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require(path.join(path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."), "lettore.js"));
let falliti = 0;
const verifica = (nome, ok, dettaglio = "") => { console.log(`  ${ok ? "OK  " : "FAIL"} ${nome}${!ok && dettaglio ? " — " + dettaglio : ""}`); if (!ok) falliti++; };
const ctx = { clienti: ["Ristorante Da Nando", "Maso Flaim", "Hotel Villa Giuggiolo", "Signora Pasquali", "Rossi"].map((name, i) => ({ id: "c" + i, name })), oggi: new Date("2026-09-29T10:00:00") };
const tot = (l) => (l && l.voci && l.voci.length ? l.voci.reduce((t, v) => t + (v.quantita || 1) * v.prezzo, 0) : l && l.importo);
L.usaDettagli([]);
for (const [f, atteso] of [
  ["fai preventivo a Nando vetrata 3 metri per 2 850 euro più montaggio 200", 1050],
  ["fattura Maso Flaim 4 finestre da 120 per 140 a 920 l'una", 3680],
  ["fammi un preventivo per la signora Pasquali muretto di recinzione di 15 metri alto 1 e 20 a 90 euro al metro", 1350],
  ["preventivo Rossi scarichi in pvc diametro 110, 14 metri a 22 euro, 4 curve a 9", 344],
  ["fattura Rossi intervento del 18 settembre sostituzione saracinesca da 1 pollice 65 euro e 3 ore a 42 euro", 191],
  ["preventivo Rossi armadio a muro 2 metri e 80 di larghezza 2400 tutto compreso", 2400],
  ["preventivo Rossi tettoia in legno 4 metri per 6 a corpo 7800", 7800],
  ["fattura Rossi pompa sommersa 3 cavalli con avviatore materiale 620 manodopera 280", 900],
  ["preventivo Rossi 8 tavoli a 450 e 32 sedie a 95", 6640],
  // da non toccare: moltiplicazioni e prezzi per unità
  ["fattura all'Hotel Villa Giuggiolo confezione tende 12 teli a 140 euro più binari 6 metri x 25 euro al metro", 1830],
  ["preventivo Rossi fotovoltaico 6 kw a 1.300 euro al kw", 7800],
  ["fattura Rossi 4 raccomandate a 6 euro e 50", 26],
]) {
  const l = L.leggiDocumento(f, ctx) || L.leggi(f, ctx);
  verifica(`«${f.slice(0, 70)}…» = ${atteso}`, l && Math.abs(tot(l) - atteso) < 0.01, JSON.stringify(l && (l.voci || l.importo)));
}
const v = L.leggiDocumento("fai preventivo a Nando vetrata 3 metri per 2 850 euro più montaggio 200", ctx);
verifica("la misura resta nella descrizione (\"3x2m\")", v && v.voci && /3x2m/.test(v.voci[0].descrizione), JSON.stringify(v && v.voci));
console.log(falliti ? `\n${falliti} controlli falliti` : "\nTutto ok");
process.exit(falliti ? 1 : 0);
