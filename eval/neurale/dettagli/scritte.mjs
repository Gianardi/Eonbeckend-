/* Passo 4: le frasi scritte a mano (scritte/*.txt, "12{QTA} docce a 40{PRZ}") nel formato
   dell'allenamento. Controllo: ogni numero segnato deve essere un numero anche per il lettore.
   Uso: node scritte.mjs > scritte.jsonl */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const QUI = path.dirname(new URL(import.meta.url).pathname);
const L = require(path.join(QUI, "../../../lettore.js"));
let ok = 0, ko = 0;
for (const f of fs.readdirSync(path.join(QUI, "scritte")).filter((f) => f.endsWith(".txt")).sort()) {
  for (const riga of fs.readFileSync(path.join(QUI, "scritte", f), "utf8").split("\n")) {
    if (!riga.trim() || riga.startsWith("#")) continue;
    const segnati = [...riga.matchAll(/(\S+?)\{([A-Z]+)\}/g)].map((m) => m[2]);
    const testo = riga.replace(/\{[A-Z]+\}/g, "").trim();
    // i ruoli per numero, nell'ordine: un numero seguito da {R} prende R, gli altri O
    const ruoliNumeri = [];
    let prima = "";
    for (const w of riga.split(/\s+/)) {
      const m = w.match(/^(.*?)\{([A-Z]+)\}(.*)$/);
      const nuda = m ? m[1] + m[3] : w;
      // "per cento" è il segno di percentuale, non un numero
      const quanti = /^cento$/i.test(nuda) && /^per$/i.test(prima) ? 0 : L.segniDettagli(nuda).valori.filter((v) => v != null).length;
      prima = nuda;
      for (let k = 0; k < quanti; k++) ruoliNumeri.push(m && k === quanti - 1 ? m[2] : "O");
    }
    const s = L.segniDettagli(testo);
    const idx = s.valori.map((v, i) => [v, i]).filter(([v]) => v != null).map(([, i]) => i);
    if (idx.length !== ruoliNumeri.length || ruoliNumeri.filter((r) => r !== "O").length !== segnati.length) { ko++; process.stderr.write("SCARTATA: " + riga + "\n"); continue; }
    const ruoli = s.segni.map(() => "O");
    idx.forEach((i, k) => { ruoli[i] = ruoliNumeri[k]; });
    console.log(JSON.stringify({ testo, segni: s.segni, ruoli, totale: L.componiImporti(s.valori, ruoli).totale, fonte: "scritte-" + f }));
    ok++;
  }
}
process.stderr.write(`Frasi scritte: ${ok} · scartate: ${ko}\n`);
