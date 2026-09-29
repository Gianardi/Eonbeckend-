/* Allena il modello di EON (29/09/2026) e lo misura su frasi MAI VISTE.
   Dati di allenamento: il generatore (eval/modello/genera-frasi.mjs) + le
   frasi del simulatore (tranne le frasi vere di Andrea). Misura: le 136
   frasi vere di Andrea e le 143 frasi nuove per mestiere (eval/dati/), che
   non entrano MAI nell'allenamento.
   Modello: regressione logistica a più classi su parole, coppie di parole,
   pezzi di parola e segnaposto (lettore.caratteristiche). Pesi compressi a
   1 byte → modello-eon.json (lo carica l'app).
   Uso: node eval/modello/allena.mjs [--salva] */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../../lettore.js");
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "eon-modello-"));
const SALVA = process.argv.includes("--salva");
const OGGI = new Date("2026-09-29T10:00:00");

/* ---------- I dati ---------- */
execFileSync("node", [path.join(RADICE, "eval/modello/genera-frasi.mjs"), path.join(TMP, "gen.json"), "700"], { stdio: "ignore" });
const gen = JSON.parse(fs.readFileSync(path.join(TMP, "gen.json"), "utf8"));
execFileSync("node", [path.join(RADICE, "eval/simulatore.test.mjs")], { stdio: "ignore", env: { ...process.env, ESPORTA_FRASI: path.join(TMP, "sim.json") } });
const sim = JSON.parse(fs.readFileSync(path.join(TMP, "sim.json"), "utf8"));
const CLIENTI_SIM = ["Machi Alessia", "Rita Ambrosini", "Andrea Gianardi", "Biso Mattia", "Alessio Machi", "Mario Rossi", "Condominio Parco Verde", "Luca Bianchi", "Spruzzo", "Francesca Neri", "Tommaso Greti", "Edil Sud Srl"];
const DA_AZIONE = { documento: "documento", messaggio: "messaggio", whatsapp: "messaggio", impegno: "calendario", da_fare: "calendario", dati: "dati", email: "email", mente: "mente", chiama: "chiamata", nota_cartella: "cartella", incasso: "incasso", doc_impresa: "cerca_documento", domanda: "domanda", modifica: "calendario_modifica", cliente: "cliente", invio_documento: "invio_documento" };
const ctxDi = (nomi) => ({ clienti: nomi.map((name, i) => ({ id: "c" + i, name })), oggi: OGGI });
const ctxGen = ctxDi(gen.clienti), ctxSim = ctxDi(CLIENTI_SIM);
let allenamento = gen.esempi.map((e) => ({ frase: e.frase, intento: e.intento, ctx: ctxGen }));
/* Il frasario (30/09/2026): una grammatica per ogni azione, migliaia di modi di dire */
const { generaFrasario } = await import("./frasario.mjs");
const fr = generaFrasario(Number(process.env.FRASARIO || 900));
const ctxFr = ctxDi(fr.clienti);
if (process.env.FRASARIO !== "0") allenamento.push(...fr.esempi.map((e) => ({ frase: e.frase, intento: e.intento, ctx: ctxFr })));
const perDoc = [];
sim.forEach((e) => {
  if (typeof e.azione !== "string" || e.gruppo === "frasi vere di Andrea") return;
  const intento = DA_AZIONE[e.azione];
  if (!intento) return;
  const x = { frase: e.frase, intento, ctx: ctxSim };
  if (intento === "documento") perDoc.push(x); else allenamento.push(x);
});
// i preventivi del simulatore sono tanti e tutti simili: ne basta un campione
for (let i = 0; i < perDoc.length; i += 8) allenamento.push(perDoc[i]);

/* La misura: frasi vere e nuove, con la loro etichetta tradotta in intento */
const DA_CATEGORIA = { calendario: "calendario", calendario_modifica: "calendario_modifica", documento: "documento", risorsa: "cerca_documento", foto: "cerca_documento", foto_scatta: "foto",
  mente: "mente", cliente: "cliente", messaggio: "messaggio", email: "email", chiamata: "chiamata", dati: "dati", cartella: "cartella", invio: "invio_documento", ai: "domanda",
  incasso: "incasso", urgenza: "urgenza", sal: "sal", dico: "dico", assemblea: "assemblea" };
const vere = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/dati/frasi-vere-andrea.json"), "utf8"));
const nuove = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/dati/frasi-nuove-mestieri.json"), "utf8"));
const misura = {
  "frasi vere di Andrea": vere.frasi.filter(([, c]) => DA_CATEGORIA[c]).map(([frase, c]) => ({ frase, intento: DA_CATEGORIA[c], ctx: ctxDi(vere.clienti) })),
  "frasi nuove per mestiere": Object.values(nuove.mestieri).flatMap((m) => m.frasi.filter(([, c]) => DA_CATEGORIA[c]).map(([frase, c]) => ({ frase, intento: DA_CATEGORIA[c], ctx: ctxDi(m.clienti) }))),
};
const prova = JSON.parse(fs.readFileSync(path.join(RADICE, "eval/dati/frasi-prova-modello.json"), "utf8"));
misura["PROVA FINALE (mai usata per migliorare)"] = prova.frasi.map(([frase, intento]) => ({ frase, intento, ctx: ctxDi(prova.clienti) }));
/* I giri alla cieca (29/09/2026, 652 frasi + prova cieca 77): il modello non li vede mai in allenamento */
const giri = ["frasi-prova-cieca.json", "frasi-giro5.json", "frasi-giro6.json", "frasi-giro7.json", "frasi-giro8.json", "frasi-giro9.json", "frasi-giro10.json", "frasi-giro11.json", "frasi-giro12.json"].map((f) => JSON.parse(fs.readFileSync(path.join(RADICE, "eval/dati", f), "utf8")));
misura["GIRI ALLA CIECA (991 frasi)"] = giri.flatMap((g) => Object.values(g.mestieri).flatMap((m) => m.frasi.filter(([, c]) => DA_CATEGORIA[c] || c === "risposta").map(([frase, c]) => ({ frase, intento: DA_CATEGORIA[c] || "saluto", ctx: ctxDi(m.clienti) }))));
const tutteMisura = new Set(Object.values(misura).flat().map((x) => L.norm(x.frase)));
allenamento = allenamento.filter((x) => !tutteMisura.has(L.norm(x.frase))); // mai la stessa frase in allenamento e in misura

/* ---------- Le caratteristiche ---------- */
const INTENTI = [...new Set(allenamento.map((x) => x.intento))].sort();
const K = INTENTI.length;
const conta = new Map();
const righe = allenamento.map((x) => { const f = [...new Set(L.caratteristiche(x.frase, x.ctx))]; f.forEach((c) => conta.set(c, (conta.get(c) || 0) + 1)); return { f, y: INTENTI.indexOf(x.intento) }; });
const FEAT = new Map();
[...conta.entries()].filter(([, n]) => n >= 2).forEach(([c]) => FEAT.set(c, FEAT.size));
const F = FEAT.size;
const dati = righe.map((r) => ({ i: r.f.map((c) => FEAT.get(c)).filter((v) => v !== undefined), y: r.y }));
console.log(`Allenamento: ${dati.length} frasi, ${K} intenti, ${F} caratteristiche`);

/* ---------- L'allenamento (regressione logistica, discesa del gradiente) ---------- */
const W = new Float32Array(F * K), B = new Float32Array(K);
const pesoClasse = INTENTI.map((_, k) => { const n = dati.filter((d) => d.y === k).length; return Math.min(3, (dati.length / K) / Math.max(1, n)); });
let seme = 7;
const caso = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
const EPOCHE = 18, L2 = 2e-6;
const z = new Float32Array(K);
for (let ep = 0; ep < EPOCHE; ep++) {
  const lr = 0.35 * (1 - ep / EPOCHE) + 0.02;
  for (let j = dati.length - 1; j > 0; j--) { const r = Math.floor(caso() * (j + 1)); [dati[j], dati[r]] = [dati[r], dati[j]]; }
  for (const d of dati) {
    for (let k = 0; k < K; k++) { let s = B[k]; for (const i of d.i) s += W[i * K + k]; z[k] = s; }
    let m = -Infinity; for (let k = 0; k < K; k++) m = Math.max(m, z[k]);
    let tot = 0; for (let k = 0; k < K; k++) { z[k] = Math.exp(z[k] - m); tot += z[k]; }
    const pc = pesoClasse[d.y];
    for (let k = 0; k < K; k++) {
      const g = (z[k] / tot - (k === d.y ? 1 : 0)) * pc * lr;
      B[k] -= g;
      for (const i of d.i) { const w = i * K + k; W[w] -= g + L2 * W[w]; }
    }
  }
}

/* ---------- Compressione: 1 byte per peso, via le caratteristiche inutili ---------- */
const scala = INTENTI.map((_, k) => { let m = 0; for (let i = 0; i < F; i++) m = Math.max(m, Math.abs(W[i * K + k])); return m / 127 || 1; });
const tenute = [];
for (let i = 0; i < F; i++) { let m = 0; for (let k = 0; k < K; k++) m = Math.max(m, Math.abs(W[i * K + k]) / scala[k]); if (m >= 2) tenute.push(i); }
const nomi = [...FEAT.keys()];
const feat = {}, W8 = new Int8Array(tenute.length * K);
tenute.forEach((i, j) => { feat[nomi[i]] = j; for (let k = 0; k < K; k++) W8[j * K + k] = Math.max(-127, Math.min(127, Math.round(W[i * K + k] / scala[k]))); });
let modello = { versione: "2026-09-29", intenti: INTENTI, feat, W: Buffer.from(W8.buffer).toString("base64"), scala, b: Array.from(B) };
L.caricaModello(modello);
/* La sicurezza tarata sulle frasi vere (temperatura): sulle frasi generate il
   modello è troppo sicuro di sé; su quelle vere deve dire "non sono sicuro"
   quando sbaglia. Si usa la misura di sviluppo (frasi vere + nuove), MAI la prova finale. */
const sviluppo = [...misura["frasi vere di Andrea"], ...misura["frasi nuove per mestiere"]];
const logit = (x) => { const f = L.caratteristiche(x.frase, x.ctx); const zz = Array.from(B); const viste = new Set(); f.forEach((c) => { const j = feat[c]; if (j === undefined || viste.has(j)) return; viste.add(j); for (let k = 0; k < K; k++) zz[k] += W8[j * K + k] * scala[k]; }); return zz; };
const zs = sviluppo.map((x) => ({ z: logit(x), y: INTENTI.indexOf(x.intento) })).filter((x) => x.y >= 0);
let migliorT = 1, migliorNll = Infinity;
for (let T = 1; T <= 8; T += 0.25) {
  let nll = 0;
  zs.forEach(({ z, y }) => { const m = Math.max(...z); const e = z.map((v) => Math.exp((v - m) / T)); const s = e.reduce((a, c) => a + c, 0); nll -= Math.log(e[y] / s + 1e-9); });
  if (nll < migliorNll) { migliorNll = nll; migliorT = T; }
}
modello = { ...modello, scala: scala.map((v) => v / migliorT), b: Array.from(B).map((v) => v / migliorT), temperatura: migliorT };
L.caricaModello(modello);
console.log(`Sicurezza tarata: temperatura ${migliorT}`);
const kb = Math.round(JSON.stringify(modello).length / 1024);
console.log(`Modello: ${tenute.length} caratteristiche tenute, ${kb} KB`);

/* ---------- La misura, su frasi mai viste ---------- */
function misuraSet(nome, set) {
  let giuste = 0, sicure = 0, sicureGiuste = 0;
  const errori = [];
  set.forEach((x) => {
    const r = L.classifica(x.frase, x.ctx);
    if (!r) return;
    // "Metti in cartella Lerici…" è una nota (mente) dentro una cartella: vanno bene tutti e due
    const equivale = (a, b) => a === b || (["mente", "cartella"].includes(a) && ["mente", "cartella"].includes(b));
    if (equivale(r.intento, x.intento)) giuste++; else errori.push(`«${x.frase.slice(0, 70)}» atteso ${x.intento}, letto ${r.intento} (${Math.round(r.p * 100)}%)`);
    if (r.p >= 0.8) { sicure++; if (equivale(r.intento, x.intento)) sicureGiuste++; }
  });
  console.log(`\n${nome}: ${giuste}/${set.length} giuste (${Math.round(giuste / set.length * 100)}%) · quando è sicuro (≥80%): ${sicureGiuste}/${sicure} giuste (${sicure ? Math.round(sicureGiuste / sicure * 100) : 0}%)`);
  errori.slice(0, process.argv.includes("--elenco") ? 999 : 12).forEach((e) => console.log("  " + e));
  return giuste / set.length;
}
Object.entries(misura).forEach(([nome, set]) => misuraSet(nome, set));

/* Regole + modello insieme (come nell'app): prima le regole; se non sanno
   (Mente, "comando", seguito, niente) decide il modello, solo se è sicuro. */
const DA_LETTORE = { ...DA_AZIONE, apri_cliente: "cliente", assemblea: "assemblea", nota_cartella_nuova: "cartella", cestino: null, cartello: null, piu: "calendario", seguito: null, comando: null, dati: "dati" };
function insieme(nome, set, soglia) {
  let giuste = 0, soloRegole = 0;
  const errori = [];
  set.forEach((x) => {
    const l = L.leggi(x.frase, x.ctx);
    const daRegole = l && l.azione ? DA_LETTORE[l.azione] : null;
    const r = L.classifica(x.frase, x.ctx);
    const equivale = (a, b) => a === b || (["mente", "cartella"].includes(a) && ["mente", "cartella"].includes(b));
    if (daRegole && equivale(daRegole, x.intento)) soloRegole++;
    let finale = daRegole;
    if ((!daRegole || daRegole === "mente") && r && r.p >= soglia && r.intento !== "mente") finale = r.intento;
    if (!finale && r) finale = r.intento; // le regole non sanno: al posto dell'AI, il modello (o chiede)
    if (finale && equivale(finale, x.intento)) giuste++; else errori.push(`«${x.frase.slice(0, 60)}» atteso ${x.intento}: regole ${daRegole || "-"}, modello ${r ? r.intento + " " + Math.round(r.p * 100) + "%" : "-"}`);
  });
  console.log(`\n${nome} — solo regole: ${soloRegole}/${set.length} · regole + modello: ${giuste}/${set.length} (${Math.round(giuste / set.length * 100)}%)`);
  errori.slice(0, process.argv.includes("--elenco") ? 999 : 8).forEach((e) => console.log("  " + e));
}
Object.entries(misura).forEach(([nome, set]) => insieme(nome, set, 0.85));
if (SALVA) { fs.writeFileSync(path.join(RADICE, "modello-eon.json"), JSON.stringify(modello)); console.log("\nSalvato modello-eon.json"); }
fs.rmSync(TMP, { recursive: true, force: true });
