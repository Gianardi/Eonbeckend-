/* I dati per il modello neurale di EON (30/09/2026).
   ALLENAMENTO: le frasi della "maestra" (eval/neurale/maestra/*.json: scrittori
   AI con personaggi diversi, scritte a mano), il frasario, il generatore e il
   simulatore. ESAME: tutte le frasi etichettate dei giri alla cieca, le frasi
   vere di Andrea, la prova finale — MAI in allenamento (tolte anche se uguali).
   Scrive eval/neurale/dati/{allenamento,esame}.jsonl con la frase già in "segni".
   Uso: node eval/neurale/prepara.mjs */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const L = require(path.join(RADICE, "lettore.js"));
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "eon-neurale-"));
const OUT = path.join(RADICE, "eval/neurale/dati");
fs.mkdirSync(OUT, { recursive: true });

const INTENTI = ["assemblea", "calendario", "calendario_modifica", "cartella", "cerca_documento", "chiamata", "cliente", "dati", "dico", "documento", "domanda", "email", "foto", "incasso", "invio_documento", "mente", "messaggio", "sal", "saluto", "urgenza"];
const DA_CATEGORIA = { calendario: "calendario", calendario_modifica: "calendario_modifica", documento: "documento", risorsa: "cerca_documento", foto: "cerca_documento", foto_scatta: "foto",
  mente: "mente", cliente: "cliente", messaggio: "messaggio", email: "email", chiamata: "chiamata", dati: "dati", cartella: "cartella", invio: "invio_documento", ai: "domanda",
  incasso: "incasso", urgenza: "urgenza", sal: "sal", dico: "dico", assemblea: "assemblea", risposta: "saluto" };
const DA_AZIONE = { documento: "documento", messaggio: "messaggio", whatsapp: "messaggio", impegno: "calendario", da_fare: "calendario", dati: "dati", email: "email", mente: "mente", chiama: "chiamata", nota_cartella: "cartella", incasso: "incasso", doc_impresa: "cerca_documento", domanda: "domanda", modifica: "calendario_modifica", cliente: "cliente", invio_documento: "invio_documento" };
const leggiJson = (f) => JSON.parse(fs.readFileSync(path.join(RADICE, f), "utf8"));

/* ---------- L'esame ---------- */
const esame = [];
const aggiungiEsame = (insieme, frase, intento) => { if (INTENTI.includes(intento)) esame.push({ insieme, frase, intento }); };
const vere = leggiJson("eval/dati/frasi-vere-andrea.json");
vere.frasi.forEach(([f, c]) => aggiungiEsame("frasi vere di Andrea", f, DA_CATEGORIA[c]));
const nuove = leggiJson("eval/dati/frasi-nuove-mestieri.json");
Object.values(nuove.mestieri).forEach((m) => m.frasi.forEach(([f, c]) => aggiungiEsame("frasi nuove per mestiere", f, DA_CATEGORIA[c])));
leggiJson("eval/dati/frasi-prova-modello.json").frasi.forEach(([f, i]) => aggiungiEsame("prova finale", f, i));
for (const g of ["frasi-prova-cieca.json", "frasi-giro5.json", "frasi-giro6.json", "frasi-giro7.json", "frasi-giro8.json", "frasi-giro9.json", "frasi-giro10.json", "frasi-giro11.json", "frasi-giro12.json", "frasi-giro13.json", "frasi-giro14.json"])
  Object.values(leggiJson("eval/dati/" + g).mestieri).forEach((m) => m.frasi.forEach(([f, c]) => aggiungiEsame("giri alla cieca 5-14", f, DA_CATEGORIA[c])));
Object.values(leggiJson("eval/dati/frasi-giro15.json").mestieri).forEach((m) => m.frasi.forEach(([f, c]) => aggiungiEsame("giro 15 (5 scrittori)", f, DA_CATEGORIA[c])));
if (fs.existsSync(path.join(RADICE, "eval/dati/frasi-giro16.json"))) Object.values(leggiJson("eval/dati/frasi-giro16.json").mestieri).forEach((m) => m.frasi.forEach(([f, c]) => aggiungiEsame("giro 16 (ESAME, 5 scrittori nuovi)", f, DA_CATEGORIA[c])));
if (fs.existsSync(path.join(RADICE, "eval/dati/frasi-giro17.json"))) Object.values(leggiJson("eval/dati/frasi-giro17.json").mestieri).forEach((m) => m.frasi.forEach(([f, c]) => aggiungiEsame("giro 17 (ESAME FINALE, scrittori nuovi)", f, DA_CATEGORIA[c])));
if (fs.existsSync(path.join(RADICE, "eval/dati/frasi-giro18.json"))) Object.values(leggiJson("eval/dati/frasi-giro18.json").mestieri).forEach((m) => m.frasi.forEach(([f, c]) => aggiungiEsame("giro 18 (5 scrittori nuovi)", f, DA_CATEGORIA[c])));
if (fs.existsSync(path.join(RADICE, "eval/dati/frasi-giro19.json"))) Object.values(leggiJson("eval/dati/frasi-giro19.json").mestieri).forEach((m) => m.frasi.forEach(([f, c]) => aggiungiEsame("giro 19 (ESAME ALLA CIECA, 5 scrittori nuovi)", f, DA_CATEGORIA[c])));
const nell_esame = new Set(esame.map((x) => L.norm(x.frase)));

/* ---------- L'allenamento ---------- */
const allena = [];
const aggiungi = (fonte, frase, intento, file) => { if (INTENTI.includes(intento) && frase && !nell_esame.has(L.norm(frase))) allena.push(file ? { fonte, frase, intento, file } : { fonte, frase, intento }); };
const dirMaestra = path.join(RADICE, "eval/neurale/maestra");
if (fs.existsSync(dirMaestra)) for (const f of fs.readdirSync(dirMaestra).filter((x) => x.endsWith(".json")).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dirMaestra, f), "utf8"));
  (d.frasi || []).forEach(([fr, c]) => aggiungi("maestra", fr, c, "maestra/" + f));
}
// le frasi "al confine" (coppie simili con etichette diverse, sulle confusioni del modello)
const dirConfini = path.join(RADICE, "eval/neurale/confini");
if (fs.existsSync(dirConfini)) for (const f of fs.readdirSync(dirConfini).filter((x) => x.endsWith(".json")).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dirConfini, f), "utf8"));
  (d.frasi || []).forEach(([fr, c]) => aggiungi("confini", fr, c, "confini/" + f));
}
// le riscritture: le stesse richieste in 14 stili (telegrafico, dialetti, dettatura sporca...)
const dirParafrasi = path.join(RADICE, "eval/neurale/parafrasi");
if (fs.existsSync(dirParafrasi)) for (const f of fs.readdirSync(dirParafrasi).filter((x) => x.endsWith(".json")).sort()) {
  try { (JSON.parse(fs.readFileSync(path.join(dirParafrasi, f), "utf8")).frasi || []).forEach(([fr, c]) => aggiungi("parafrasi", fr, c, "parafrasi/" + f)); } catch { console.error("file rotto:", f); }
}
execFileSync("node", [path.join(RADICE, "eval/modello/genera-frasi.mjs"), path.join(TMP, "gen.json"), "700"], { stdio: "ignore" });
leggiJson(path.relative(RADICE, path.join(TMP, "gen.json"))).esempi.forEach((e) => aggiungi("generatore", e.frase, e.intento));
const { generaFrasario } = await import(path.join(RADICE, "eval/modello/frasario.mjs"));
generaFrasario(Number(process.env.FRASARIO || 900)).esempi.forEach((e) => aggiungi("frasario", e.frase, e.intento));
execFileSync("node", [path.join(RADICE, "eval/simulatore.test.mjs")], { stdio: "ignore", env: { ...process.env, ESPORTA_FRASI: path.join(TMP, "sim.json") } });
const perDoc = [];
JSON.parse(fs.readFileSync(path.join(TMP, "sim.json"), "utf8")).forEach((e) => {
  if (typeof e.azione !== "string" || e.gruppo === "frasi vere di Andrea") return;
  const i = DA_AZIONE[e.azione]; if (!i) return;
  if (i === "documento") perDoc.push(e.frase); else aggiungi("simulatore", e.frase, i);
});
for (let i = 0; i < perDoc.length; i += 8) aggiungi("simulatore", perDoc[i], "documento");

const scrivi = (nome, righe) => fs.writeFileSync(path.join(OUT, nome), righe.map((x) => JSON.stringify({ ...x, segni: L.segni(x.frase), y: INTENTI.indexOf(x.intento) })).join("\n") + "\n");
scrivi("allenamento.jsonl", allena);
scrivi("esame.jsonl", esame);
fs.writeFileSync(path.join(OUT, "intenti.json"), JSON.stringify(INTENTI));
const conta = (a, k) => a.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {});
console.log("allenamento", allena.length, JSON.stringify(conta(allena, "fonte")));
console.log("esame", esame.length, JSON.stringify(conta(esame, "insieme")));
