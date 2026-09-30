/* Il modello neurale non peggiora mai (30/09/2026, rete di sicurezza).
   Controlla il modello DA SOLO su tutte le frasi etichettate (giri 5-17):
   il totale non scende e nessuna serie perde più dell'1% rispetto a
   eval/neurale/soglie.json; peso e velocità dentro i limiti; il lettore lo usa.
   Uso: node eval/modello-neurale.test.mjs */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const L = require(path.join(RADICE, "lettore.js"));
const N = require(path.join(RADICE, "neurale.js"));
const SOGLIE = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/neurale/soglie.json"), "utf8"));
const FILE = process.env.MODELLO || path.join(RADICE, "modello-neurale.json"); // MODELLO=file per provare un modello nuovo prima di sostituirlo
const DA_CATEGORIA = { risorsa: "cerca_documento", foto: "cerca_documento", foto_scatta: "foto", invio: "invio_documento", ai: "domanda", risposta: "saluto" };
let falliti = 0;
const verifica = (nome, ok, dettaglio = "") => { console.log(`  ${ok ? "OK  " : "FAIL"} ${nome}${!ok && dettaglio ? " — " + dettaglio : ""}`); if (!ok) falliti++; };

const kb = fs.statSync(FILE).size / 1024;
verifica(`peso ${Math.round(kb)} KB (massimo ${SOGLIE.pesoMassimoKB})`, kb <= SOGLIE.pesoMassimoKB);
N.carica(JSON.parse(fs.readFileSync(FILE, "utf8")));
verifica("il modello si carica", N.pronto());
verifica("il lettore usa il neurale", L.usaNeurale(N) && L.neuraleAttivo());

let tot = 0, totMin = 0, frasi = 0, ms = 0;
for (const [f, minimo] of Object.entries(SOGLIE.serie)) {
  const d = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/dati", f), "utf8"));
  const gruppi = d.mestieri ? Object.values(d.mestieri) : [{ frasi: d.frasi }];
  let giuste = 0;
  for (const g of gruppi) for (const [frase, c] of g.frasi) {
    const t0 = performance.now();
    const r = N.classifica(L.segni(frase));
    ms += performance.now() - t0; frasi++;
    if (r && r.intento === (DA_CATEGORIA[c] || c)) giuste++;
  }
  tot += giuste; totMin += minimo;
  verifica(`${f}: ${giuste} giuste (soglia ${minimo}, tolleranza 1%)`, giuste >= Math.floor(minimo * 0.99));
}
verifica(`totale ${tot} giuste (non meno di ${totMin})`, tot >= totMin);
const medio = ms / frasi;
verifica(`${medio.toFixed(1)} ms a frase (massimo ${SOGLIE.msMassimiAFrase})`, medio <= SOGLIE.msMassimiAFrase);
console.log(falliti ? `\n${falliti} controlli falliti` : "\nTutto a posto");
process.exit(falliti ? 1 : 0);
