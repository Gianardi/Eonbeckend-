/* Confronto sullo STESSO esame: il modello di oggi (parole, modello-eon.json)
   e il modello neurale (modello-neurale.json), ognuno da solo, senza regole.
   Uso: node eval/neurale/confronta.mjs [file-dati.json ...] (default: giro 16) */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const L = require(path.join(RADICE, "lettore.js"));
const N = require(path.join(RADICE, "neurale.js"));
L.caricaModello(JSON.parse(fs.readFileSync(path.join(RADICE, "modello-eon.json"), "utf8")));
N.carica(JSON.parse(fs.readFileSync(process.env.NEURALE || path.join(RADICE, "modello-neurale.json"), "utf8")));
const DA_CATEGORIA = { calendario: "calendario", calendario_modifica: "calendario_modifica", documento: "documento", risorsa: "cerca_documento", foto: "cerca_documento", foto_scatta: "foto",
  mente: "mente", cliente: "cliente", messaggio: "messaggio", email: "email", chiamata: "chiamata", dati: "dati", cartella: "cartella", invio: "invio_documento", ai: "domanda",
  incasso: "incasso", urgenza: "urgenza", sal: "sal", dico: "dico", assemblea: "assemblea", risposta: "saluto" };
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["frasi-giro16.json"];
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/dati", f), "utf8"));
  const mestieri = d.mestieri ? Object.values(d.mestieri) : [{ clienti: d.clienti || [], frasi: d.frasi }];
  let n = 0, vecchio = 0, neurale = 0, vS = 0, vSg = 0, nS = 0, nSg = 0;
  const perIntento = {};
  for (const m of mestieri) {
    const ctx = { clienti: (m.clienti || []).map((name, i) => ({ id: "c" + i, name })), oggi: new Date("2026-09-29T10:00:00") };
    for (const [frase, c] of m.frasi) {
      const atteso = DA_CATEGORIA[c] || c; if (!atteso) continue;
      n++;
      const a = L.classifica(frase, ctx), b = N.classifica(L.segni(frase));
      const pi = (perIntento[atteso] = perIntento[atteso] || { n: 0, v: 0, r: 0 }); pi.n++;
      if (a && a.intento === atteso) { vecchio++; pi.v++; }
      if (b && b.intento === atteso) { neurale++; pi.r++; }
      if (a && a.p >= 0.8) { vS++; if (a.intento === atteso) vSg++; }
      if (b && b.p >= 0.8) { nS++; if (b.intento === atteso) nSg++; }
    }
  }
  const pc = (x, y) => Math.round((x / y) * 100) + "%";
  console.log(`${f}: ${n} frasi · modello di oggi ${vecchio} (${pc(vecchio, n)}; quando sicuro ${pc(vSg, vS)} su ${vS}) · NEURALE ${neurale} (${pc(neurale, n)}; quando sicuro ${pc(nSg, nS)} su ${nS})`);
  if (process.env.DETTAGLIO) Object.entries(perIntento).sort().forEach(([k, v]) => console.log(`   ${k.padEnd(20)} ${v.n} · oggi ${v.v} · neurale ${v.r}`));
}
