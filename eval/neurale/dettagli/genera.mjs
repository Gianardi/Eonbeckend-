/* Passo 4 (30/09/2026): le frasi per allenare il modello dei DETTAGLI.
   Ogni frase è un preventivo o una fattura detta a voce, con il ruolo di ogni numero
   (quantità, prezzo, totale, annullato, percentuale d'acconto, base, sconto) e il totale
   giusto calcolato qui. Ogni esempio è verificato: i numeri che il lettore trova devono
   essere quelli scritti, e il conto (componiImporti) deve dare il totale atteso; se no
   l'esempio si butta. I numeri che non sono soldi (indirizzi, misure, date, IVA al 22,
   telefoni) sono in tutte le frasi con ruolo O, perché il modello impari a lasciarli stare.

   Uso: node eval/neurale/dettagli/genera.mjs [quante=30000] [seme=1] > file.jsonl */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../../../lettore.js");

const QUANTE = Number(process.argv[2] || 30000);
let seme = Number(process.argv[3] || 1);
const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
const uno = (a) => a[Math.floor(caso() * a.length)];
const forse = (p) => caso() < p;
const tra = (a, b) => a + Math.floor(caso() * (b - a + 1));

/* ---------- I numeri detti in tanti modi ---------- */
const UNITA_P = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
const DIECI = ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const DECINE = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
function sotto100(n) {
  if (n < 10) return UNITA_P[n];
  if (n < 20) return DIECI[n - 10];
  const d = DECINE[Math.floor(n / 10)], u = n % 10;
  if (!u) return d;
  return (u === 1 || u === 8 ? d.slice(0, -1) : d) + UNITA_P[u];
}
function sotto1000(n) {
  const c = Math.floor(n / 100), r = n % 100;
  const cc = c === 0 ? "" : c === 1 ? "cento" : UNITA_P[c] + "cento";
  return cc + (r ? sotto100(r) : "");
}
function inLettere(n) {
  if (n === 0 || n >= 1000000 || n !== Math.floor(n)) return null;
  const m = Math.floor(n / 1000), r = n % 1000;
  const mm = m === 0 ? "" : m === 1 ? "mille" : sotto1000(m) + "mila";
  return mm + (r ? sotto1000(r) : "");
}
function conPunti(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
function soldi(v, stile) {
  // stile: come lo dice questo "utente" (più o meno coerente dentro la frase)
  const r = caso();
  const intero = v === Math.floor(v);
  let s;
  if (!intero) s = String(v.toFixed(2)).replace(".", ",");
  else if (stile === "lettere" && r < 0.6 && inLettere(v)) s = inLettere(v);
  else if (v >= 1000 && r < 0.55) s = conPunti(v);
  else if (v >= 1000 && v % 1000 === 0 && r < 0.62) s = (v / 1000) + "k";
  else if ((v === 1200 || v === 2500 || v === 1500 || v === 3200) && r < 0.68) s = { 1200: "mille e due", 2500: "duemila e cinque", 1500: "mille e cinque", 3200: "tremila e due" }[v];
  else s = String(v);
  const e = caso();
  if (/k$|mille e|mila e/.test(s)) return s + (e < 0.3 ? " euro" : "");
  return e < 0.35 ? s + " euro" : e < 0.42 ? "€" + s : e < 0.46 ? s + "€" : s;
}
function quanti(q) {
  if (q === 2 && forse(0.08)) return "du'";
  if (q <= 20 && forse(0.45)) return inLettere(q) || String(q);
  if (q <= 200 && q % 10 === 0 && forse(0.15)) return inLettere(q);
  return String(q);
}

/* ---------- Il mondo dei mestieri ---------- */
const COGNOMI = ["Rossi", "Bianchi", "Ferrari", "Esposito", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone", "Longo", "Gentile", "Zanella", "Zanon", "Cantoni", "Ingrassia", "Pellegatta", "Brambilla", "Terruzzi", "Fontanella", "Guidetti", "Scalzo", "Bertolin", "Colombini", "Piazzolla", "Castelli", "Marini", "Pagano", "Nuzzo", "Scapinelli"];
const VIE = ["Garibaldi", "Mazzini", "Roma", "dei Tigli", "Manzoni", "Gramsci", "Verdi", "Cavour", "delle Rose", "XX Settembre", "Dante", "Matteotti", "dei Mille", "Marconi"];
const INSEGNE = ["bar Centrale", "bar Aurora", "hotel Belvedere", "hotel Miramonti", "pizzeria Da Totò", "trattoria Da Nando", "ristorante Da Gino", "palestra FitZone", "studio Marini", "B&B La Conchiglia", "officina Bertolini", "farmacia Centrale", "panificio Rossi", "parrucchiera Anna"];
// nomi con un numero dentro: il numero NON è un importo
const NOMI_CON_NUMERO = [["Rosa dei Venti", "Venti", 20], ["via dei Mille", "Mille", 1000], ["Tre Pini", "Tre", 3], ["Quattro Stagioni", "Quattro", 4], ["Cinque Terre", "Cinque", 5], ["Sette Fontane", "Sette", 7], ["Due Torri", "Due", 2], ["Cento Fiori", "Cento", 100], ["Otto Marzo", "Otto", 8]];
function cliente() {
  const r = caso();
  if (r < 0.08) { const [nome, parola, v] = uno(NOMI_CON_NUMERO); const pre = uno(["il condominio ", "condominio ", "il residence ", "la pizzeria ", "il ", ""]); const [a, b] = nome.split(parola); return { t: pre + nome, parti: [{ t: pre + a }, { t: parola, v, r: "O" }, { t: b }], n: [] }; }
  if (r < 0.14) { const num = tra(1, 60); const t = uno(["Condominio Via ", "viale ", "il condominio di viale ", "corso ", "piazza "]) + uno(VIE) + " " + num; return { t, n: [num] }; }
  if (r < 0.3) return { t: uno(COGNOMI), n: [] };
  if (r < 0.45) return { t: uno(["la signora ", "il signor ", "il dottor ", "l'ingegner ", "la famiglia "]) + uno(COGNOMI), n: [] };
  if (r < 0.62) { const num = tra(1, 120); return { t: uno(["il condominio via ", "condominio via ", "il condominio di via ", "via "]) + uno(VIE) + " " + num, n: [num] }; }
  if (r < 0.8) return { t: uno(["il ", "l'", ""]) .replace(/^l'$/, "") + uno(INSEGNE), n: [] };
  if (r < 0.88) return { t: uno(["un cliente nuovo", "un cliente nuovo, " + uno(COGNOMI), "una signora nuova"]), n: [] };
  return { t: uno(["il condominio", "la palestra", "l'hotel", "il bar", "la scuola", "il comune"]), n: [] };
}
// [descrizione, unità (per quantità), prezzo tipico min, max, misura (numero O dentro la descrizione)]
const VOCI = {
  edile: [["demolizione", null, 300, 2500], ["massetto", "mq", 15, 40], ["intonaco", "mq", 12, 35], ["rasatura pareti", "mq", 8, 20], ["tinteggiatura", "mq", 6, 15], ["posa piastrelle", "mq", 25, 60], ["cartongesso", "mq", 25, 55], ["rifacimento bagno", null, 3000, 12000], ["impermeabilizzazione terrazzo", "mq", 30, 80], ["ponteggio", null, 800, 4000], ["smaltimento macerie", null, 150, 900], ["trasporto in discarica", null, 100, 600], ["manodopera", "ore", 25, 45], ["sanitari", null, 400, 1500], ["porte", "porte", 180, 600], ["cappotto termico", "mq", 50, 120], ["crepe", null, 200, 900]],
  idraulico: [["sostituzione caldaia", null, 1500, 4000], ["caldaia a condensazione 24 kW", null, 1600, 3500, 24], ["rubinetteria", null, 80, 450], ["tubi multistrato", "metri", 8, 25], ["colonna di scarico", null, 400, 2500], ["boiler 80 litri", null, 250, 600, 80], ["radiatori", "radiatori", 120, 350], ["valvole termostatiche", "pezzi", 30, 80], ["doccia filo pavimento", null, 900, 2500], ["piatto doccia", null, 200, 700], ["autoclave", null, 600, 2000], ["uscita di pronto intervento", null, 80, 250], ["disostruzione scarico", null, 90, 300], ["manodopera", "ore", 30, 50], ["contatore acqua", null, 100, 400]],
  elettricista: [["punti luce", "punti", 35, 90], ["prese", "prese", 30, 70], ["quadro elettrico", null, 350, 1800], ["canalina", "metri", 8, 20], ["plafoniere", "pezzi", 40, 150], ["impianto fotovoltaico 6 kW", null, 7000, 14000, 6], ["impianto fotovoltaico 3 kW", null, 4500, 8000, 3], ["colonnina di ricarica 22 kW", null, 1500, 3500, 22], ["citofono", null, 200, 900], ["antifurto", null, 900, 3500], ["luci di emergenza", "pezzi", 60, 180], ["rifacimento impianto appartamento di 80 metri", null, 3500, 8000, 80], ["certificazione", null, 150, 400], ["telecamere", "telecamere", 120, 300], ["cavo", "metri", 2, 6], ["manodopera", "ore", 28, 45]],
  artigiano: [["armadi da smontare e rimontare", "armadi", 80, 200], ["vetrata 3 metri per 2", null, 600, 1800, [3, 2]], ["specchio su misura 1 metro per 80", null, 150, 500, [1, 80]], ["zanzariere", "zanzariere", 60, 180], ["tapparelle", "tapparelle", 150, 400], ["serratura", null, 90, 350], ["montaggio cucina", null, 300, 1200], ["mensole", "mensole", 30, 120], ["cassetti", "cassetti", 40, 120], ["montaggio", null, 80, 400], ["massaggi", "massaggi", 40, 90], ["manicure", "manicure", 20, 45], ["taglio e piega", null, 25, 60], ["pulizie", "ore", 12, 25], ["tende", "tende", 50, 200], ["divano da rifoderare", null, 300, 900]],
  altro: [["riparazione pc", null, 50, 200], ["installazione stampante", null, 40, 120], ["cavo di rete", null, 10, 40], ["diagnosi centralina", null, 40, 120], ["sostituzione sensore", null, 60, 200], ["decoder", null, 60, 150], ["installazione parabola", null, 120, 300], ["uscita", null, 30, 80], ["smaltimento del vecchio", null, 20, 80], ["analisi dell'acqua", null, 30, 90], ["smaltimento di quella vecchia", null, 20, 80], ["un'ora di manodopera", null, 30, 60], ["collaudo", null, 80, 250], ["pratica", null, 100, 400], ["taglio", null, 15, 40], ["colore", null, 30, 70], ["trattamento", null, 20, 60], ["insegna luminosa", null, 600, 2500], ["logo", null, 150, 600]],
  amministratore: [["compenso amministrazione", null, 800, 4000], ["compenso terzo trimestre", null, 500, 2500], ["compenso secondo semestre", null, 1500, 5000], ["assemblee straordinarie", "assemblee", 100, 250], ["spese postali", null, 40, 200], ["fotocopie", null, 30, 200], ["bolli", null, 16, 64], ["gestione pratica", null, 150, 600], ["unità", "unità", 60, 180], ["rendiconto", null, 200, 900], ["registrazione contratto", null, 100, 300]],
};
// [nome al plurale, "a pezzo" detto come, prezzo min, max, misura opzionale "da N unità"]
const CONTABILI = {
  edile: [["finestre", "a finestra", 150, 600], ["porte", "a porta", 180, 600], ["stanze", "a stanza", 250, 900], ["camere", "a camera", 200, 700], ["gradini", "a gradino", 40, 150], ["davanzali", "l'uno", 60, 200], ["mesi di ponteggio", "al mese", 300, 1200], ["giornate", "a giornata", 150, 400]],
  idraulico: [["docce", "l'una", 250, 900], ["lavelli", "l'uno", 150, 450], ["miscelatori", "l'uno", 60, 200], ["boiler", "l'uno", 250, 1300, ["litri", [50, 80, 100, 200, 300]]], ["split", "ciascuno", 50, 700], ["radiatori", "a radiatore", 120, 350], ["valvole", "l'una", 20, 90], ["sanitari", "a pezzo", 100, 400], ["scaldabagni", "l'uno", 200, 700, ["litri", [50, 80, 100]]]],
  elettricista: [["prese", "a presa", 25, 70], ["punti luce", "a punto", 30, 90], ["plafoniere", "l'una", 40, 150], ["faretti", "l'uno", 30, 90], ["sensori", "l'uno", 40, 120], ["postazioni interne", "a postazione", 60, 150], ["colonnine", "l'una", 1200, 3000, ["kW", [7, 11, 22]]], ["telecamere", "l'una", 100, 300], ["lampade", "l'una", 30, 120], ["quadri", "a quadro", 300, 1200]],
  artigiano: [["persone", "a porzione", 3, 40], ["persone", "a persona", 10, 60], ["pantaloni", "l'uno", 8, 25], ["giacche", "l'una", 15, 40], ["vetri", "l'uno", 40, 150], ["sedie", "a sedia", 30, 120], ["armadi", "l'uno", 80, 250], ["mesi", "al mese", 100, 800], ["lezioni", "a lezione", 20, 60], ["tende", "a tenda", 40, 200], ["stanze", "a stanza", 150, 400]],
  altro: [["volantini", "l'uno", 0.1, 0.5], ["locandine", "l'una", 1, 5], ["sottobicchieri", "l'uno", 0.5, 1.5], ["metri quadri di prato", "al metro", 0.3, 1.5], ["olivi", "l'uno", 30, 60], ["pc nuovi", "l'uno", 500, 1200], ["copie", "a copia", 0.1, 0.5], ["porzioni", "a porzione", 3, 8]],
  amministratore: [["unità", "l'una", 60, 180], ["assemblee", "l'una", 100, 250], ["appartamenti", "ad appartamento", 60, 200], ["mesi", "al mese", 100, 400], ["attestazioni", "l'una", 30, 80], ["raccomandate", "l'una", 5, 12], ["verbali", "a verbale", 20, 80]],
};
const MESTIERI = Object.keys(VOCI);
const prezzoTra = (a, b) => { if (b < 5) return Math.round((a + caso() * (b - a)) * 20) / 20 || 0.1; const v = tra(a, b); return v > 1000 ? Math.round(v / 50) * 50 : v > 100 ? Math.round(v / 10) * 10 : v; };

/* ---------- Una frase ---------- */
const APERTURE = ["fai un preventivo", "preventivo", "fammi un preventivo", "prepara un preventivo", "devo fare un preventivo", "nuovo preventivo", "famme 'n preventivo", "fai preventivo", "fattura", "fai la fattura", "fammi la fattura", "fai fattura", "prepara la fattura", "emetti fattura", "devo fare la fattura", "fattura veloce"];
const RIEMPI = ["", "", "", "allora ", "senti ", "eon ", "allora senti ", "ok ", "dai "];
const PREP_CLIENTE = ["per", "a", "per", "al", "alla"];

function frase() {
  const mest = uno(MESTIERI);
  const pezzi = []; // {t: testo} oppure {t, v, r} (numero con ruolo)
  const num = (v, r, testo) => pezzi.push({ t: testo, v, r });
  const txt = (t) => pezzi.push({ t });
  const stile = forse(0.15) ? "lettere" : "cifre";
  let totale = 0;
  const cl = cliente();
  // "3 giorni x 3 operai a 250 al giorno a testa", "2 persone per 4 ore a 35 l'ora": le quantità si moltiplicano
  const doppia = () => {
    const [a, b, aPezzo, pmin, pmax] = uno([["giorni", "operai", "al giorno a testa", 150, 300], ["persone", "ore", "l'ora", 25, 45], ["operai", "giornate", "a giornata", 150, 280], ["ore", "persone", "l'ora", 25, 45], ["uscite", "tecnici", "a uscita", 50, 120]]);
    const q1 = tra(2, 6), q2 = tra(2, 8), p = prezzoTra(pmin, pmax);
    txt(uno(["manodopera", "lavoro", "", "poi"])); num(q1, "QTA", quanti(q1)); txt(a + " " + uno(["x", "per", "con"])); num(q2, "QTA", quanti(q2)); txt(b + " a"); num(p, "PRZ", soldi(p, stile)); txt(aPezzo);
    return q1 * q2 * p;
  };
  // misure che non sono soldi dentro la frase: "alto 1 e 20", "da 2 metri e 40", "7,4 kW", "spessore 12 centimetri"
  const numeroMisura = () => { const f = tra(0, 3);
    if (f === 0) { const a = tra(1, 2), b = uno([20, 40, 50, 60, 80]); txt("alto"); num(a, "O", String(a)); txt("e"); num(b, "O", String(b)); }
    else if (f === 1) { const a = tra(1, 3), b = uno([20, 40, 60, 70]); txt("da"); num(a, "O", String(a)); txt("metri e"); num(b, "O", String(b)); }
    else if (f === 2) { const v = uno([3.7, 7.4, 11, 22, 4.5]); txt("da"); num(v, "O", String(v).replace(".", ",")); txt("kW"); }
    else { const v = uno([8, 10, 12, 14]); txt("spessore"); num(v, "O", String(v)); txt("centimetri"); } };
  // "12 docce a 40 euro l'una", "tre mesi a 500 al mese", "due boiler da 300 litri a 1.150 l'uno"
  const contabile = (m) => {
    const [nome, aPezzo, pmin, pmax, misura] = uno(CONTABILI[m]);
    const q = nome === "persone" ? tra(10, 150) : tra(2, 30), p = prezzoTra(pmin, pmax);
    const corr = forse(0.08), p0 = corr ? prezzoTra(pmin, pmax) : null;
    const prezzo = () => { if (corr) { num(p0, "ANN", soldi(p0, stile)); txt(uno(["eh no", "anzi", "cioè no", "no aspetta"])); } num(p, "PRZ", soldi(p, stile)); };
    const conMisura = () => { if (misura) { const mv = uno(misura[1]); txt("da"); num(mv, "O", String(mv)); txt(misura[0]); } };
    const f = tra(0, 5);
    if (f <= 1) { num(q, "QTA", quanti(q)); txt(nome); conMisura(); txt(uno(["a", "da"])); prezzo(); if (forse(0.7)) txt(aPezzo); }
    else if (f === 2) { txt(nome.split(" ")[0] + ":"); num(q, "QTA", quanti(q)); txt(uno(["a", "da"])); prezzo(); if (forse(0.6)) txt(aPezzo); }
    else if (f === 3) { prezzo(); txt(aPezzo + " " + uno(["per", "e sono", "e ne metto", "per un totale di"])); num(q, "QTA", quanti(q)); txt(nome); }
    else if (f === 4) { txt(uno(["sostituzione di", "montaggio di", "fornitura di", "manutenzione di", "sono"])); num(q, "QTA", quanti(q)); txt(nome); conMisura(); txt(uno(["a", "da"])); prezzo(); if (forse(0.5)) txt(aPezzo); }
    else { num(q, "QTA", quanti(q)); txt(nome); txt(uno(["a", "da"])); prezzo(); txt(aPezzo); }
    return q * p;
  };
  const clientePrima = forse(0.7);
  txt(uno(RIEMPI) + uno(APERTURE));
  const mettiCliente = () => {
    const p = uno(PREP_CLIENTE);
    const prep = (/^(?:il|l'|la|lo)\b/.test(cl.t) ? { per: "per", a: "a", al: "per", alla: "per" }[p] : p === "al" || p === "alla" ? "a" : p) + " ";
    if (cl.parti) { pezzi.push({ t: prep + cl.parti[0].t }, cl.parti[1], cl.parti[2]); return; }
    txt(prep + cl.t); cl.n.forEach((n) => pezzi.splice(pezzi.length - 1, 1, ...spezzaNumeri(pezzi[pezzi.length - 1].t, [n])));
  };
  if (clientePrima) mettiCliente();
  if (forse(0.3)) txt(uno([":", ",", "allora", "dunque", "per", "per il lavoro di"]));

  const tipo = caso();
  const voci = VOCI[mest];
  if (tipo < 0.04) { const v = prezzoTra(1000, 30000); txt(uno(["per il primo acconto di", "acconto di", "per l'acconto di", "per il saldo di", "per i lavori di settembre sono", "per il secondo acconto,"])); num(v, "TOT", soldi(v, stile)); totale = v; }
  else if (tipo < 0.12) { // acconto: percentuale di una base
    const perc = uno([10, 20, 25, 30, 40, 50]), base = prezzoTra(2000, 40000);
    const forma = tra(0, 3);
    if (forma === 0) { txt("dell'acconto del"); num(perc, "PERC", perc + uno(["%", " per cento", " percento"])); txt("su"); num(base, "BASE", soldi(base, stile)); }
    else if (forma === 1) { txt("acconto"); num(perc, "PERC", perc + uno(["%", " per cento"])); txt(uno(["su un totale di", "di", "su"])); num(base, "BASE", soldi(base, stile)); }
    else if (forma === 2) { txt(uno(["il", "l'"]).replace("l'", "il")); num(perc, "PERC", perc + uno(["%", " per cento"])); txt("di"); num(base, "BASE", soldi(base, stile)); txt(uno(["di acconto", "come acconto", "di anticipo"])); }
    else { txt("per il primo acconto, il"); num(perc, "PERC", perc + uno(["%", " per cento"])); txt("dei"); num(base, "BASE", soldi(base, stile)); }
    totale = Math.round(base * perc) / 100;
  } else {
    const n = tipo < 0.5 ? 1 : tra(2, 4);
    const scelte = [...voci].sort(() => caso() - 0.5).slice(0, n);
    scelte.forEach((voce, k) => {
      const [descr, unita, pmin, pmax, misura] = voce;
      const sep = k === 0 ? "" : uno(["", ",", "poi", "e", "più", "e poi", "e anche", "ci metti anche", "aggiungi"]);
      if (sep) txt(sep);
      if (forse(0.35)) { totale += contabile(mest); return; }
      if (forse(0.07)) { totale += doppia(); return; }
      if (forse(0.06)) numeroMisura();
      const conDescrMisura = (d) => misura == null ? txt(d) : pezzi.push(...spezzaNumeri(d, Array.isArray(misura) ? misura : [misura]));
      if (unita && forse(0.55)) {
        let q = unita === "mq" || unita === "metri" ? tra(5, 120) : unita === "ore" ? tra(2, 40) : tra(2, 24);
        let p = prezzoTra(pmin, pmax);
        const corrPrezzo = forse(0.12), corrQta = !corrPrezzo && forse(0.05);
        const p0 = corrPrezzo ? prezzoTra(pmin, pmax) : null, q0 = corrQta ? q + tra(1, 5) : null;
        const forma = tra(0, 5);
        const unitaDetta = unita === descr.split(" ")[0] || unita === "unità" ? "" : " " + unita;
        const dettoQ = (qq, r) => num(qq, r, quanti(qq));
        const prezzoDetto = () => {
          if (corrPrezzo) { num(p0, "ANN", soldi(p0, stile)); txt(uno(["eh no", "anzi", "cioè no", "no aspetta", "no facciamo", ", no,", "anzi no"])); }
          num(p, "PRZ", soldi(p, stile));
        };
        if (forma === 0) { if (corrQta) { dettoQ(q0, "ANN"); txt(uno(["anzi", "no"])); } dettoQ(q, "QTA"); txt(unitaDetta.trim() ? unitaDetta.trim() + " di " + descr : descr); txt(uno(["a", "da"])); prezzoDetto(); if (forse(0.5)) txt(uno(["al " + (unita === "mq" ? "metro quadro" : unita === "metri" ? "metro" : unita === "ore" ? "ora" : "pezzo"), "l'uno", "l'una", "cadauno", "ciascuno"])); }
        else if (forma === 1) { conDescrMisura(descr); dettoQ(q, "QTA"); if (unitaDetta) txt(unitaDetta.trim()); txt(uno(["a", "da"])); prezzoDetto(); }
        else if (forma === 2) { conDescrMisura(descr); prezzoDetto(); txt(uno(["l'una", "l'uno", "cadauno", "al pezzo"]) + uno([" e ne mettiamo", ", ne servono", " e ne metto", " per"])); dettoQ(q, "QTA"); }
        else if (forma === 3) { dettoQ(q, "QTA"); conDescrMisura(descr); if (forse(0.5)) txt(uno(["da fare", "da montare", "nuovi", "nuove"])); txt(","); prezzoDetto(); txt(uno(["l'uno", "l'una", "cadauno", "ciascuno", "a pezzo"])); }
        else if (forma === 4) { txt(descr); dettoQ(q, "QTA"); txt("per"); prezzoDetto(); }
        else { dettoQ(q, "QTA"); if (unitaDetta) txt(unitaDetta.trim()); txt("di " + descr); txt(uno(["a", "da"])); prezzoDetto(); }
        totale += q * p;
      } else if (unita && forse(0.5)) {
        // "pacchetto 5 massaggi 300 euro", "due armadi da smontare 240 in tutto": la quantità c'è, il prezzo è a corpo
        const q = tra(2, 12), p = prezzoTra(pmin * q, pmax * q);
        if (forse(0.5)) txt(uno(["pacchetto", "per", "sono", ""]));
        num(q, "QTA", quanti(q)); txt(descr);
        txt(uno(["", "in tutto", "a corpo", "tutto compreso", "metti", "fanno"]));
        num(p, "TOT", soldi(p, stile));
        totale += p;
      } else {
        const p = prezzoTra(pmin, pmax);
        const corr = forse(0.14), p0 = corr ? prezzoTra(pmin, pmax) : null;
        const forma = tra(0, 4);
        const detto = () => {
          if (corr) {
            const f = tra(0, 2);
            if (f === 0 && forse(0.3)) { num(p0, "ANN", soldi(p0, stile)); txt("di " + descr.split(" ")[0] + uno([", no aspetta,", ", no scusa,", ", anzi", " cioè no"])); num(p, "TOT", soldi(p, stile)); }
            else if (f === 0) { num(p0, "ANN", soldi(p0, stile)); txt(uno(["eh no", "anzi", "cioè no", "no aspetta", "no facciamo", ", no,", "anzi no", "... no", "no scusa", ", no aspetta,", "cioè", "no no"])); num(p, "TOT", soldi(p, stile)); }
            else if (f === 1) { txt(uno(["c'eravamo detti", "avevamo detto", "gli avevo detto"])); num(p0, "ANN", soldi(p0, stile)); txt(uno(["ma gli faccio", "ma facciamo", "però metti", "ma metti"])); num(p, "TOT", soldi(p, stile)); }
            else { txt("metti"); num(p0, "ANN", soldi(p0, stile)); txt(uno(["anzi", "no", "anzi no"])); num(p, "TOT", soldi(p, stile)); }
          } else num(p, "TOT", soldi(p, stile));
        };
        if (forma === 0) { conDescrMisura(descr); detto(); }
        else if (forma === 1) { detto(); txt(uno(["di", "per", "per la", "per il"]) + " " + descr); if (misura != null) { pezzi.pop(); pezzi.push(...spezzaNumeri(uno(["di", "per"]) + " " + descr, Array.isArray(misura) ? misura : [misura])); } }
        else if (forma === 2) { conDescrMisura(descr); txt(uno(["metti", "sono", "fanno", "viene", "a corpo"])); detto(); }
        else if (forma === 3) { txt("per " + descr); if (misura != null) { pezzi.pop(); pezzi.push(...spezzaNumeri("per " + descr, Array.isArray(misura) ? misura : [misura])); } detto(); }
        else { conDescrMisura(descr); txt(":"); detto(); }
        totale += p;
      }
    });
    // una voce tolta a metà ("ci metti anche i 180 di bolli, no i bolli toglili")
    if (forse(0.06)) { const v = prezzoTra(30, 400), d = uno(["bolli", "trasporto", "smaltimento", "sopralluogo", "materiale"]); txt(uno(["ci metti anche i", "e poi"])); num(v, "ANN", soldi(v, stile)); txt("di " + d + uno([", no " + d + " toglilo", ", no i " + d + " toglili", ", anzi no, niente " + d])); }
    // un moltiplicatore dopo l'ultima voce: "al mese per 12 mesi", "per 3 settimane" (giro 18)
    if (forse(0.08)) { const [per, unita] = uno([["al mese per", "mesi"], ["per", "mesi"], ["a settimana per", "settimane"], ["all'anno per", "anni"], ["al giorno per", "giorni"]]); const m = unita === "anni" ? tra(2, 5) : tra(2, 12); txt(per); num(m, "MOLT", quanti(m)); txt(unita); totale *= m; }
    // lo sconto (in tanti modi, anche in lettere)
    if (forse(0.2)) {
      if (forse(0.55)) { const s = uno([5, 10, 15, 20, 3, 8]); txt(uno(["meno il", "con lo sconto del", "sconto", "fagli il", "togli il", "col", "levaci il", "sconto del", "applica il"])); num(s, "SCO", forse(0.3) ? inLettere(s) + " per cento" : s + uno(["%", " per cento", " percento"])); if (forse(0.5)) txt(uno(["di sconto", "sul totale", "per la quantità", "perché paga subito"])); totale = totale * (1 - s / 100); }
      else { const s = uno([20, 30, 40, 50, 90, 100, 150, 200]); if (s < totale) { txt(uno(["fagli", "togli", "sconto di", "meno", "fagli uno sconto di", "levaci", "togli pure", "meno"])); num(s, "SCOV", soldi(s, stile)); if (forse(0.5)) txt(uno(["di sconto", "euro di sconto", "che ho sbagliato il conto", "perché è un amico"])); totale -= s; } }
    }
    // l'acconto già dato da togliere: "meno l'acconto che mi hanno già dato di 4000" (giro 18)
    if (forse(0.07)) { const a = Math.round(totale * uno([0.2, 0.3, 0.4, 0.5]) / 50) * 50; if (a > 0 && a < totale) { const f = tra(0, 2);
      if (f === 0) { txt(uno(["meno l'acconto che mi hanno già dato di", "meno l'acconto di", "togli l'acconto già versato di", "meno i"])); num(a, "SCOV", soldi(a, stile)); if (forse(0.4)) txt("già versati"); }
      else if (f === 1) { txt(uno(["e mi hanno già dato", "però mi hanno già dato", "ma hanno già pagato"])); num(a, "SCOV", soldi(a, stile)); txt(uno(["di acconto", "in contanti", "di anticipo"])); }
      else { txt(uno(["tolto l'acconto di", "detratto l'anticipo di"])); num(a, "SCOV", soldi(a, stile)); }
      totale -= a; } }
    // il prezzo finale detto: vale lui (giro 18)
    if (forse(0.06)) { const fin = Math.max(50, Math.round(totale * uno([0.9, 0.93, 0.95, 0.97]) / 50) * 50); txt(uno(["però fagli un prezzo finale di", "facciamo tutto", "chiudiamo a", "arrotonda a", "in tutto fagli", "alla fine gli faccio", "fai prezzo finale"])); num(fin, "FIN", soldi(fin, stile)); totale = fin; }
  }
  if (!clientePrima) mettiCliente();
  if (forse(0.03)) txt(uno(["più... no basta così", "e basta", "tutto qui", "niente altro"]));
  // i numeri che non sono soldi
  if (forse(0.25)) txt(uno(["più iva", "iva esclusa", "più IVA", "iva compresa no, più iva", "senza iva"]));
  if (forse(0.15)) { const a = uno([22, 10, 4]); pezzi.push(...spezzaNumeri(uno(["iva al " + a, "iva " + a + "%", "con iva al " + a, "IVA al " + a + "%", "iva al " + a + " per cento", "aliquota " + a]), [a])); }
  if (forse(0.08)) { const g = uno([30, 60, 90]); pezzi.push(...spezzaNumeri("pagamento a " + g + " giorni", [g])); }
  if (forse(0.06)) { const d = tra(1, 28); pezzi.push(...spezzaNumeri("entro il " + d + " " + uno(["ottobre", "novembre", "dicembre"]), [d])); }
  if (forse(0.05)) { const o = tra(8, 18); pezzi.push(...spezzaNumeri("e mandamela entro le " + o, [o])); }
  if (forse(0.03)) txt("il numero è 333 " + tra(1000000, 9999999));
  if (forse(0.1)) txt(uno(["grazie", "perché è un amico", "che è un cliente buono", "e mandala subito", "così la firmo stasera"]));
  return { pezzi, totale: Math.round(totale * 100) / 100, mest };
}
/* "impianto fotovoltaico 6 kW" → il 6 è un numero con ruolo O */
function spezzaNumeri(testo, nums) {
  const out = []; let resto = testo;
  for (const n of nums) {
    const re = new RegExp("(^|\\s)" + n + "(?=[\\s%]|$)");
    const m = resto.match(re);
    if (!m) continue;
    const i = m.index + m[1].length;
    if (i > 0) out.push({ t: resto.slice(0, i).trim() });
    out.push({ t: String(n), v: n, r: "O" });
    resto = resto.slice(i + String(n).length);
  }
  if (resto.trim()) out.push({ t: resto.trim() });
  return out;
}

/* ---------- Verifica e scrittura ---------- */
let fatte = 0, buttate = 0;
const righe = [];
while (fatte < QUANTE) {
  const f = frase();
  const testo = f.pezzi.map((p) => p.t).filter(Boolean).join(" ").replace(/\s+([,:])/g, "$1").replace(/\s+/g, " ").trim()
    .replace(/\ba il\b/g, "al").replace(/\ba la\b/g, "alla").replace(/\ba l'/g, "all'").replace(/\bper per\b/g, "per").replace(/\bper il colonna\b/g, "per la colonna").replace(/\bi (materiale|trasporto|sopralluogo|smaltimento)\b/g, "il $1");
  const s = L.segniDettagli(testo);
  const attesi = f.pezzi.filter((p) => p.v != null);
  const trovati = s.valori.map((v, i) => [v, i]).filter(([v]) => v != null);
  // il telefono: il lettore lo vede come <tel>, non come numero
  if (trovati.length !== attesi.length || trovati.some(([v], k) => Math.abs(v - attesi[k].v) > 0.001)) { buttate++; continue; }
  const ruoli = s.segni.map(() => "O");
  trovati.forEach(([, i], k) => { ruoli[i] = attesi[k].r; });
  const c = L.componiImporti(s.valori, ruoli);
  if (Math.abs(c.totale - f.totale) > 0.01) { buttate++; continue; }
  righe.push(JSON.stringify({ testo, segni: s.segni, ruoli, totale: f.totale, mestiere: f.mest }));
  fatte++;
}
process.stdout.write(righe.join("\n") + "\n");
process.stderr.write(`Frasi: ${fatte} · buttate dalla verifica: ${buttate}\n`);
