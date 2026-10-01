/* Le regole corrette dagli errori del giro 20 (1/10/2026), senza browser:
   - importi: la correzione col prezzo per unità ("a 220 l'uno no a 250", "a 45 al metro
     anzi 42"), quella detta in fondo ("le telecamere non a 290 anzi 310"), "6 euro e
     cinquanta", "meno 50 di sconto", "il 2 per cento su 85.000", "sconto del 10 per cento";
   - orari: "venerdì nove e mezza" senza "alle";
   - spostare: "la riunione … di sabato" non sposta un impegno che non è né una riunione
     né di sabato (la riunione era già annullata);
   - incasso: "ricordami di ricontrollare SE ha pagato" è un promemoria.
   Uso: node eval/giro20-regole.test.mjs */
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const L = require(path.join(RADICE, "lettore.js"));
const N = require(path.join(RADICE, "neurale.js"));
let falliti = 0;
const verifica = (nome, ok, dettaglio = "") => { console.log(`  ${ok ? "OK  " : "FAIL"} ${nome}${!ok && dettaglio ? " — " + dettaglio : ""}`); if (!ok) falliti++; };

const clienti = ["Condominio Torre Marina", "Condominio Parco dei Gelsomini", "Condominio Palazzo Bellaria", "Condominio Via dei Mandorli 14", "Condominio Viale delle Ginestre 48", "Bar Sirenella", "Mario Rossi"].map((name, i) => ({ id: "c" + i, name }));
const ctx = { clienti, oggi: new Date("2026-09-29T10:00:00") };
const tot = (l) => (l && l.voci && l.voci.length ? l.voci.reduce((t, v) => t + (v.quantita || 1) * v.prezzo, 0) : l && l.importo);
const IMPORTI = [
  ["preventivo per Palazzo Bellaria potatura alberi del cortile 4 alberi a 220 l'uno no a 250 più trasporto 120", 1120],
  ["preventivo Torre Marina videosorveglianza 8 telecamere a 290 più registratore 650 più installazione 1.200 ah le telecamere non a 290 anzi 310", 4330],
  ["fattura Viale delle Ginestre 48 compenso straordinario lavori facciata il 2 per cento su 85.000 di lavori", 1700],
  ["fattura per via dei Mandorli 14 compenso trimestrale 1.050 meno 50 di sconto come avevamo concordato", 1000],
  ["fattura Palazzo Bellaria solo dell'acconto del 50 per cento sul compenso straordinario lavori tetto che è 3.000", 1500],
  ["fattura Torre Marina compenso ordinario 950 più pratica sinistro 250 più 4 raccomandate a 6 euro e cinquanta", 1226],
  ["preventivo Parco dei Gelsomini impermeabilizzazione terrazzo 320 metri quadri a 45 al metro anzi 42 più smaltimento guaina vecchia 1.800", 15240],
  ["preventivo Rossi bagno 5.000 euro sconto 10 per cento", 4500],
  ["preventivo per Rossi rifacimento tetto 120 metri a 65 euro più grondaie 1800 e fagli lo sconto del 10 per cento", 8640],
  // da non toccare: la percentuale in nota, l'IVA, una correzione normale
  ["fattura Rossi divano 1200, in nota metti che il 50% è già stato pagato", 1200],
  ["fattura Rossi 800 per la riparazione, e in nota scrivi IVA al 10 per cento", 800],
  ["preventivo Rossi imbiancatura 1.500 cioè no 1.400", 1400],
];
const modelli = JSON.parse(fs.readFileSync(path.join(RADICE, "modello-dettagli.json"), "utf8")).modelli.map((m) => { const x = N.crea(); return x.carica(m) ? x : null; }).filter(Boolean);
for (const [nome, lista] of [["regole", []], ["regole + modello", modelli]]) {
  L.usaDettagli(lista);
  for (const [f, atteso] of IMPORTI) {
    const l = L.leggiDocumento(f, ctx);
    verifica(`${nome}: «${f.slice(0, 60)}…» = ${atteso}`, l && Math.abs(tot(l) - atteso) < 0.01, JSON.stringify(l && l.voci));
  }
}
L.usaDettagli([]);

const ora = (t) => { const q = L.trovaQuando(L.parole(L.pulisci(t).testo), ctx.oggi); return q.giornoIso + " " + q.ora; };
verifica("\"venerdì nove e mezza ritiro\" = venerdì 9:30", ora("venerdì nove e mezza ritiro del DURC") === "2026-10-02 09:30", ora("venerdì nove e mezza ritiro del DURC"));
verifica("\"giovedì tre e tre quarti\" = 15:45", ora("giovedì tre e tre quarti") === "2026-10-01 15:45", ora("giovedì tre e tre quarti"));
verifica("\"Brambati venerdì 8 e mezza revisione\" come prima", ora("Brambati venerdì 8 e mezza revisione") === "2026-10-02 08:30");

const lista = [
  { id: 0, titolo: "Ricordami di rinnovare la polizza RC del Rione Azzurro", chi: "", iso: "2026-10-31T09:00:00" },
  { id: 1, titolo: "Riunione consiglieri Supercondominio Rione Azzurro", chi: "", iso: "2026-10-03T10:00:00" },
];
const frase = "la riunione consiglieri Rione Azzurro di sabato portala alle 10 e mezza no alle 11";
let x = L.leggiModificaImpegno(frase, lista, ctx.oggi);
verifica("la riunione di sabato: sposta la riunione", x.tipo === "sposta" && x.impegni.length === 1 && x.impegni[0].id === 1, JSON.stringify(x.impegni));
x = L.leggiModificaImpegno(frase, [lista[0]], ctx.oggi);
verifica("riunione già annullata: NON propone di spostare la polizza", !x.impegni.length, JSON.stringify(x.impegni));
x = L.leggiModificaImpegno("rimanda il Tomasin di domani a giovedì", [{ id: 0, titolo: "Ricordami di ordinare i pannelli per il Tomasin", chi: "", iso: "2026-10-02T09:00:00" }], ctx.oggi);
verifica("\"il Tomasin di domani\": non propone un impegno del Tomasin di venerdì", !x.impegni.length, JSON.stringify(x.impegni));
x = L.leggiModificaImpegno("la polizza del Rione Azzurro spostala a lunedì", lista, ctx.oggi);
verifica("\"la polizza … spostala\": la polizza", x.impegni.length === 1 && x.impegni[0].id === 0);

const az = (t) => (L.leggi(t, ctx) || {}).azione;
verifica("\"ricordami … se il Bar Sirenella ha pagato\": non è un incasso", az("ricordami fra una settimana di ricontrollare se il Bar Sirenella ha pagato la quota della tenda") !== "incasso");
verifica("\"Rossi ha pagato 500\": incasso come prima", az("Rossi ha pagato 500") === "incasso");
verifica("\"segnati che Rossi ha pagato 300\": incasso come prima", az("segnati che Rossi ha pagato 300") === "incasso");

console.log(falliti ? `\n${falliti} controlli falliti` : "\nTutto ok");
process.exit(falliti ? 1 : 0);
