/* Quante regole scritte a mano "capiscono" ancora le frasi (1/10/2026, Andrea: "il codice scritto
   a mano stile 2015-2018 non va bene, dobbiamo creare il modello neurale"). Si conta a ogni
   pacchetto: il numero deve scendere man mano che il modello neurale prende il loro posto.
   Conta le righe con un'espressione regolare (.test / .match / new RegExp / .replace(/…/)):
   - in lettore.js: tutte (il lettore serve solo a capire);
   - in index.html e api/index.js: solo dentro le funzioni che leggono le frasi
     (prova…, capisci…, leggi…, cerca…, rispondiSuiDati, gestisci…, lavoroDa…).
   Uso: node eval/regole-conta.mjs
   Con --controlla (nelle prove automatiche, 3/10/2026): fallisce se il numero supera il tetto
   in eval/dati/regole-tetto.json. Il tetto si abbassa a ogni pacchetto, mai si alza. */
import fs from "node:fs";
import path from "node:path";
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REGOLA = /\.test\(|\.match\(|new RegExp\(|\.replace\(\s*\//;
const LEGGONO = /^\s*(?:async\s+)?function\s+(prova\w*|capisci\w*|leggi\w*|cerca\w*|rispondiSuiDati|gestisci\w*|lavoroDa\w*|domandaDel\w*|clienteDa\w*|invioDal\w*|normalizza\w*)\s*\(/;
function dentroFunzioni(file) {
  const righe = fs.readFileSync(path.join(RADICE, file), "utf8").split("\n");
  let n = 0, prof = 0, dentro = false;
  for (const r of righe) {
    if (!dentro && LEGGONO.test(r)) { dentro = true; prof = 0; }
    if (dentro) {
      if (REGOLA.test(r)) n++;
      for (const ch of r) { if (ch === "{") prof++; else if (ch === "}") prof--; }
      if (prof <= 0 && r.includes("}")) dentro = false;
    }
  }
  return n;
}
const lettore = fs.readFileSync(path.join(RADICE, "lettore.js"), "utf8").split("\n").filter((r) => REGOLA.test(r)).length;
const app = dentroFunzioni("index.html"), server = dentroFunzioni("api/index.js");
console.log(`Regole a mano che capiscono le frasi: ${lettore + app + server}`);
console.log(`  lettore.js ${lettore} · app ${app} · server ${server}`);
const totale = lettore + app + server;
if (process.argv.includes("--controlla")) {
  const tetto = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/dati/regole-tetto.json"), "utf8")).massimo;
  if (totale > tetto) {
    console.error(`FAIL: ${totale} regole, più del tetto di ${tetto}. Una frase nuova da capire va insegnata al modello (frasi + riallenamento), non scritta come regola.`);
    process.exit(1);
  }
  console.log(`OK: ${totale} ≤ tetto ${tetto}` + (totale < tetto ? ` (abbassa il tetto a ${totale} in eval/dati/regole-tetto.json)` : ""));
}
