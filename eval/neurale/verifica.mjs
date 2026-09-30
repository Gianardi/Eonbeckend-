/* Il modello neurale nel telefono dà gli stessi risultati di PyTorch?
   Legge modello-neurale.json con neurale.js (il codice dell'app), rifà l'esame
   e lo confronta con eval/neurale/dati/esito-neurale.json (scritto da allena.py).
   Misura anche il tempo per frase e il peso del file.
   Uso: node eval/neurale/verifica.mjs */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const N = require(path.join(RADICE, "neurale.js"));
const L = require(path.join(RADICE, "lettore.js"));
const file = path.join(RADICE, "modello-neurale.json");
const t0 = Date.now();
N.carica(JSON.parse(fs.readFileSync(file, "utf8")));
const caricamento = Date.now() - t0;
const esito = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/neurale/dati/esito-neurale.json"), "utf8"));
let uguali = 0, giuste = 0, maxDiff = 0;
const t1 = Date.now();
for (const x of esito) {
  const r = N.classifica(L.segni(x.frase));
  if (r.intento === x.letto) uguali++;
  if (r.intento === x.atteso) giuste++;
  if (r.intento === x.letto) maxDiff = Math.max(maxDiff, Math.abs(r.p - x.p));
}
const perFrase = (Date.now() - t1) / esito.length;
const kb = fs.statSync(file).size / 1024;
console.log(`Stesso cassetto di PyTorch: ${uguali}/${esito.length} · giuste nel telefono: ${giuste}/${esito.length} (${Math.round(giuste / esito.length * 100)}%) · differenza massima di sicurezza ${maxDiff.toFixed(3)}`);
console.log(`Peso ${kb.toFixed(0)} KB · caricamento ${caricamento} ms · ${perFrase.toFixed(1)} ms per frase (compresi i segni)`);
process.exit(uguali >= esito.length * 0.995 ? 0 : 1);
