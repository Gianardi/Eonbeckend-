/* Passo 4: il modello dei dettagli nel telefono (neurale.js, pesi a 1 byte) contro PyTorch,
   e il lettore dei preventivi completo (regole + modello) sulle frasi d'esame.
   Uso: node verifica.mjs modello1.json [modello2.json …] [--pytorch ruoli.jsonl] */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const N = require(path.join(RADICE, "neurale.js"));
const L = require(path.join(RADICE, "lettore.js"));
const args = process.argv.slice(2);
const iPy = args.indexOf("--pytorch");
const fPy = iPy >= 0 ? args[iPy + 1] : null;
const file = args.filter((a, i) => a !== "--pytorch" && i !== iPy + 1);
const t0 = Date.now();
const modelli = file.map((f) => { const m = N.crea(); if (!m.carica(JSON.parse(fs.readFileSync(f, "utf8")))) throw new Error("non carica " + f); return m; });
console.log(`${modelli.length} modelli caricati in ${Date.now() - t0} ms · peso ${file.map((f) => Math.round(fs.statSync(f).size / 1024) + " KB").join(" + ")}`);
const esame = fs.readFileSync(path.join(RADICE, "eval/neurale/dettagli/dati/esame.jsonl"), "utf8").trim().split("\n").map((x) => JSON.parse(x));

if (fPy) { // stessi ruoli di PyTorch (primo modello)?
  const py = fs.readFileSync(fPy, "utf8").trim().split("\n").map((x) => JSON.parse(x));
  let uguali = 0, numeri = 0;
  esame.forEach((x, i) => {
    const js = modelli[0].etichetta(x.segni);
    x.segni.forEach((s, j) => { if (x.valori[j] == null) return; numeri++; if (js[j].ruolo === py[i].ruoli[j]) uguali++; });
  });
  console.log(`Stesso ruolo di PyTorch: ${uguali}/${numeri} numeri`);
}

// il lettore completo: regole, poi il modello quando è sicurissimo
const perGiro = {};
let tempo = 0;
L.usaDettagli(modelli);
const dir = path.join(RADICE, "eval/dati");
for (const f of fs.readdirSync(dir).filter((f) => /^frasi-giro\d+\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const m of Object.values(d.mestieri || {})) {
    const ctx = { clienti: (m.clienti || []).map((name, i) => ({ id: "c" + i, name })), oggi: new Date("2026-09-29T10:00:00") };
    for (const r of m.frasi || []) {
      if (r[1] !== "documento" || r[2] == null) continue;
      const g = (perGiro[f] = perGiro[f] || { n: 0, prima: 0, dopo: 0, sistemate: [], rotte: [] });
      L.usaDettagli([]);
      const a = L.leggiDocumento(r[0], ctx) || L.leggi(r[0], ctx);
      L.usaDettagli(modelli);
      const t1 = performance.now();
      const b = L.leggiDocumento(r[0], ctx) || L.leggi(r[0], ctx);
      tempo += performance.now() - t1;
      const tot = (l) => (l && l.voci && l.voci.length ? l.voci.reduce((t, v) => t + (v.quantita || 1) * v.prezzo, 0) : l && l.importo);
      const ok = (l) => tot(l) != null && Math.abs(tot(l) - Number(r[2])) < 0.5;
      g.n++; g.prima += ok(a); g.dopo += ok(b);
      if (!ok(a) && ok(b)) g.sistemate.push(r[0].slice(0, 90));
      if (ok(a) && !ok(b)) g.rotte.push(r[0].slice(0, 90) + " → " + tot(b));
    }
  }
}
let P = 0, D = 0, n = 0;
for (const [f, g] of Object.entries(perGiro).sort()) { console.log(`${f.padEnd(22)} ${g.n} frasi · solo regole ${g.prima} · regole + modello ${g.dopo}`); P += g.prima; D += g.dopo; n += g.n; }
console.log(`TOTALE ${n} frasi · solo regole ${P} · regole + modello ${D} · ${(tempo / n).toFixed(1)} ms a frase`);
for (const g of Object.values(perGiro)) { g.sistemate.forEach((x) => console.log("  SISTEMATA " + x)); g.rotte.forEach((x) => console.log("  ROTTA     " + x)); }
