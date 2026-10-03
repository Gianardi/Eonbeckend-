/* Misura il catalogo dell'app sull'esame cieco (eval/dati/frasi-app-cieco.json): quante frasi il
   modello legge come "app" con la sezione giusta, e con che sicurezza (come le soglie dell'app:
   cassetto ≥ 0,45 e sezione ≥ 0,6 → apre; cassetto ≥ 0,6 e sezione tra le prime 3 → offre i tasti).
   Uso: node eval/neurale/lettura/catalogo-cieco.mjs [modello.json] */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const lettore = require(path.join(RADICE, "lettore.js"));
const neurale = require(path.join(RADICE, "neurale.js"));
const file = process.argv[2] || path.join(RADICE, "modello-lettura.json");
const dati = JSON.parse(fs.readFileSync(file, "utf8"));
const lista = (Array.isArray(dati.modelli) ? dati.modelli : [dati]).map((x) => { const m = neurale.crea(); return m.carica(x) ? m : null; }).filter(Boolean);
lettore.usaLettura(lista);
const esame = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/dati/frasi-app-cieco.json"), "utf8")).frasi;
let apre = 0, tasti = 0, sbagliate = [];
for (const [frase, atteso] of esame) {
  const m = lettore.leggiConModello(frase, { clienti: [] });
  const sezioni = m && m.intento === "app" ? [{ tema: m.dest, p: m.pDest }, ...(m.altreDest || [])] : [];
  if (m && m.intento === "app" && m.p >= 0.45 && m.dest === atteso && m.pDest >= 0.6) apre++;
  else if (m && m.intento === "app" && m.p >= 0.6 && sezioni.some((s) => s.tema === atteso)) tasti++;
  else sbagliate.push(`${frase} → ${m ? m.intento + " " + m.p.toFixed(2) + (m.dest ? " " + m.dest + " " + m.pDest.toFixed(2) : "") : "niente"} (atteso ${atteso})`);
}
console.log(`Catalogo, esame cieco: ${esame.length} frasi · apre giusto ${apre} · offre la giusta tra i tasti ${tasti} · sbagliate ${sbagliate.length}`);
sbagliate.forEach((s) => console.log("  - " + s));
