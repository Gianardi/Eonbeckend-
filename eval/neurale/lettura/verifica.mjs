/* Controllo delle frasi segnate (passo A): legge i file degli scrittori (scritte/*.json), tiene solo
   le frasi segnate bene e le scrive nel formato dell'allenamento: { frase, intento, parole, ruoli }.
   Scartate: cassetto sconosciuto, ruolo sconosciuto, parentesi rotte o accavallate, frase vuota,
   doppioni. Uso: node verifica.mjs > dati/scritte.jsonl  (il riepilogo va su stderr) */
import fs from "node:fs";
import path from "node:path";
const QUI = path.dirname(new URL(import.meta.url).pathname);
export const RUOLI = ["O", "CHI", "GIO", "ORA", "NGIO", "NORA", "LAV", "TESTO", "CAN", "DOC", "NUM", "TEL", "MAIL", "IND", "AVANZ", "CART"];
export const CASSETTI = ["calendario", "calendario_modifica", "mente", "documento", "cerca_documento", "invio_documento", "messaggio", "email", "chiamata", "cliente", "dati", "domanda", "incasso", "foto", "cartella", "urgenza", "sal", "dico", "assemblea", "saluto", "accettato", "sollecito"];
// parole come le divide il modello: spazi e apostrofi ("l'ho" → "l'" "ho")
export const dividi = (t) => String(t).replace(/([’'])/g, "$1 ").split(/\s+/).filter(Boolean);
export function leggiSegnata(s) {
  const parole = [], ruoli = [];
  const re = /\[([^\[\]{}]+)\]\{([A-Z]+)\}|([^\[\]{}]+)/g;
  let m, letto = "";
  while ((m = re.exec(s))) {
    letto += m[0];
    if (m[1] !== undefined) {
      if (!RUOLI.includes(m[2]) || m[2] === "O") return null;
      const pp = dividi(m[1]); if (!pp.length) return null;
      pp.forEach((p) => { parole.push(p); ruoli.push(m[2]); });
    } else dividi(m[3]).forEach((p) => { parole.push(p); ruoli.push("O"); });
  }
  if (letto !== s || /[\[\]{}]/.test(s.replace(/\[[^\[\]{}]+\]\{[A-Z]+\}/g, ""))) return null;
  return parole.length ? { parole, ruoli } : null;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const dir = path.join(QUI, "scritte");
  const visti = new Set(); let ok = 0; const scarti = {};
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : []) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { scarti["file rotto " + f] = 1; continue; }
    for (const [segnata, intento] of j.frasi || []) {
      const perche = !CASSETTI.includes(intento) ? "cassetto" : null;
      const l = perche ? null : leggiSegnata(String(segnata || "").trim());
      if (!l) { const k = perche || "segni"; scarti[k] = (scarti[k] || 0) + 1; continue; }
      const frase = l.parole.join(" ").replace(/([’']) /g, "$1");
      const chiave = frase.toLowerCase();
      if (visti.has(chiave)) { scarti.doppioni = (scarti.doppioni || 0) + 1; continue; }
      visti.add(chiave); ok++;
      console.log(JSON.stringify({ fonte: "scritte/" + f, frase, intento, parole: l.parole, ruoli: l.ruoli }));
    }
  }
  console.error(`frasi tenute: ${ok} · scartate: ${JSON.stringify(scarti)}`);
}
