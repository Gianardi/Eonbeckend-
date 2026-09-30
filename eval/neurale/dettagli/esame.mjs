/* Passo 4: le frasi d'esame del modello dei dettagli = i preventivi e le fatture dei giri
   (frasi scritte da scrittori indipendenti) con l'importo atteso. MAI in allenamento.
   Uso:
     node esame.mjs prepara > esame.jsonl        le frasi, i segni e il conto delle regole di oggi
     node esame.mjs misura esame.jsonl ruoli.jsonl   confronta: regole di oggi vs modello */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const L = require(path.join(RADICE, "lettore.js"));

const [, , cosa, fEsame, fRuoli] = process.argv;
if (cosa === "prepara") {
  const dir = path.join(RADICE, "eval/dati");
  for (const f of fs.readdirSync(dir).filter((f) => /^frasi-giro\d+\.json$/.test(f))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const m of Object.values(d.mestieri || {})) {
      const ctx = { clienti: (m.clienti || []).map((name, i) => ({ id: "c" + i, name })), oggi: new Date("2026-09-29T10:00:00") };
      for (const r of m.frasi || []) {
        if (r[1] !== "documento" || r[2] == null) continue;
        const s = L.segniDettagli(r[0]);
        const l = L.leggiDocumento(r[0], ctx) || L.leggi(r[0], ctx);
        const regole = l && l.voci && l.voci.length ? l.voci.reduce((t, v) => t + (v.quantita || 1) * v.prezzo, 0) : (l && l.importo) || null;
        console.log(JSON.stringify({ insieme: f.replace(/^frasi-|\.json$/g, ""), testo: r[0], segni: s.segni, valori: s.valori, atteso: Number(r[2]), regole }));
      }
    }
  }
} else if (cosa === "misura") {
  const esame = fs.readFileSync(fEsame, "utf8").trim().split("\n").map((x) => JSON.parse(x));
  const ruoli = fs.readFileSync(fRuoli, "utf8").trim().split("\n").map((x) => JSON.parse(x));
  const per = {};
  const sbagli = [];
  esame.forEach((x, i) => {
    const c = L.componiImporti(x.valori, ruoli[i].ruoli);
    const g = (per[x.insieme] = per[x.insieme] || { n: 0, regole: 0, modello: 0, entrambi: 0 });
    g.n++;
    const okR = x.regole != null && Math.abs(x.regole - x.atteso) < 0.5, okM = Math.abs(c.totale - x.atteso) < 0.5;
    if (okR) g.regole++; if (okM) g.modello++; if (okR && okM) g.entrambi++;
    if (!okM) sbagli.push(`${x.insieme} atteso ${x.atteso} modello ${c.totale} regole ${x.regole} | ${x.testo.slice(0, 110)}\n      ${x.segni.map((s, k) => ruoli[i].ruoli[k] !== "O" ? s + "/" + ruoli[i].ruoli[k] : s).filter((s) => s.startsWith("<")).join(" ")}`);
  });
  let T = { n: 0, regole: 0, modello: 0, entrambi: 0 };
  for (const [k, g] of Object.entries(per).sort()) { console.log(`${k.padEnd(8)} ${g.n} frasi · regole ${g.regole} · modello ${g.modello} · entrambi ${g.entrambi}`); for (const q in T) T[q] += g[q]; }
  console.log(`TOTALE  ${T.n} frasi · regole ${T.regole} · modello ${T.modello} · entrambi ${T.entrambi}`);
  if (process.env.SBAGLI) console.log("\nSbagliate dal modello:\n  " + sbagli.join("\n  "));
}
