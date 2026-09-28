/* L'utente virtuale di EON (29/09/2026, idea di Andrea: "un utente
   virtuale che parla con EON in modo che traspaiano tutte le cose da
   mettere nel codice").

   Come le grandi app (Alexa, Snips): per ogni cassetto (fattura, messaggio,
   chiamata, cartella, domanda sui dati…) ci sono delle FRASI DI ESEMPIO con
   i pezzi da riempire; da ognuna il simulatore genera tante varianti come le
   scriverebbe un artigiano di fretta (maiuscole, "eon", "per favore",
   importi scritti in modi diversi, clienti diversi, giorni e ore) e
   controlla che il lettore (lettore.js) trovi il cassetto e i pezzi giusti.
   In più: le frasi vere di Andrea del 28/09 (che erano finite all'AI) e le
   frasi che NON devono essere prese per sbaglio.

   Stampa quante frasi capisce il codice e le prime che sbaglia.
   Uso: node eval/simulatore.test.mjs            (tutte)
        node eval/simulatore.test.mjs --elenco   (anche l'elenco degli errori) */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../lettore.js");

const OGGI = new Date("2026-09-29T10:00:00"); // un martedì
const CLIENTI = [
  { id: "c1", name: "Machi Alessia" }, { id: "c2", name: "Rita Ambrosini" }, { id: "c3", name: "Andrea Gianardi" },
  { id: "c4", name: "Biso Mattia" }, { id: "c5", name: "Alessio Machi" }, { id: "c6", name: "Mario Rossi" },
  { id: "c7", name: "Condominio Parco Verde" }, { id: "c8", name: "Luca Bianchi" }, { id: "c9", name: "Spruzzo" },
  { id: "c10", name: "Francesca Neri" }, { id: "c11", name: "Tommaso Greti" }, { id: "c12", name: "Edil Sud Srl" },
];
const CARTELLE = [{ id: "k1", nome: "Lerici" }, { id: "k2", nome: "Fornitori" }, { id: "k3", nome: "Casa al mare" }, { id: "k4", nome: "EON" }];
const CTX = { clienti: CLIENTI, cartelle: CARTELLE, oggi: OGGI };
const id = (nome) => CLIENTI.find((c) => c.name === nome).id;

let totale = 0, giuste = 0;
const sbagliate = [];
function prova(frase, atteso, gruppo) {
  totale++;
  let l;
  try { l = L.leggi(frase, CTX); } catch (e) { sbagliate.push({ gruppo, frase, motivo: "errore: " + e.message }); return; }
  const problemi = [];
  for (const [k, v] of Object.entries(atteso)) {
    let reale;
    if (k === "cliente") reale = l.cliente ? l.cliente.id : null;
    else if (k === "candidati") reale = (l.candidati || []).map((c) => c.id).sort().join(",");
    else if (k === "cartella") reale = l.cartella ? l.cartella.id : null;
    else if (k === "giorno") reale = l.quando && l.quando.giornoIso;
    else if (k === "ora") reale = l.quando && l.quando.ora;
    else if (k === "manca") reale = (l.manca || []).slice().sort().join(",");
    else if (k === "pezzi") reale = (l.pezzi || []).map((p) => p.azione).join(",");
    else reale = l[k];
    const ok = v instanceof RegExp ? v.test(String(reale == null ? "" : reale)) : reale === v;
    if (!ok) problemi.push(`${k}: atteso ${v instanceof RegExp ? v : JSON.stringify(v)}, letto ${JSON.stringify(reale)}`);
  }
  if (problemi.length) sbagliate.push({ gruppo, frase, motivo: problemi.join("; ") });
  else giuste++;
}

/* ---------- 1. Le frasi vere di Andrea (28/09, finite all'AI) ---------- */
const VERE = [
  ["Metti in cartella Lerici sentire overa per riportare materiale sportivo", { azione: "nota_cartella", cartella: "k1", nota: "Sentire overa per riportare materiale sportivo", daFare: true }],
  ["Domani ore 11 mazzi. Mandare raccomandata Brigida", { azione: "piu", pezzi: "impegno,da_fare" }],
  ["Mi serve preventivo Machi Alessia", { azione: "documento", modo: "cerca", cliente: "c1" }],
  ["Crea preventivo da 20.000 per ristrutturazione bagno e mandalo a Rita Ambrosini", { azione: "documento", modo: "crea", tipo: "preventivo", cliente: "c2", importo: 20000, lavoro: "Ristrutturazione bagno", invio: true, manca: "" }],
  ["Scrivi a Rita Ambrosini se va bene domani alle 18:00 in ufficio", { azione: "messaggio", cliente: "c2", messaggio: "Va bene domani alle 18:00 in ufficio?" }],
  ["Crea cartello fine lavori Machi alessia", { azione: "cartello", cliente: "c1" }],
  ["DURC machi Alessia", { azione: "doc_impresa", documento: "durc", cliente: "c1" }],
  ["Chiamare per panini", { azione: "mente", daFare: true }],
  ["Quanti soldi devo incassare ?", { azione: "dati", tema: "crediti" }],
  ["Fai fattura da 10.000 a Chilosi mariagrazie per progetto seconda casa in campagna", { azione: "documento", tipo: "fattura", clienteNuovo: "Chilosi Mariagrazie", importo: 10000, lavoro: "Progetto seconda casa in campagna", manca: "" }],
  ["Crea Fattura Chilosi Mario 2000", { azione: "documento", tipo: "fattura", clienteNuovo: "Chilosi Mario", importo: 2000, manca: "lavoro" }],
  ["Preventivo 1000 chilosi", { azione: "documento", tipo: "preventivo", importo: 1000, dubbio: "Chilosi" }],
  ["Clienti che devono pagare?", { azione: "dati", tema: "crediti" }],
  ["Chi non ha ancora pagato?", { azione: "dati", tema: "crediti" }],
  ["Quanto ho di IVA questo mese?", { azione: "dati", tema: "iva" }],
  ["Quanti cantieri attivi ho?", { azione: "dati", tema: "cantieri" }],
  ["Guarda se ho impegni sabato", { azione: "dati", tema: "agenda", giorno: "2026-10-03" }],
  ["Chiama Gianardi", { azione: "chiama", cliente: "c3" }],
  ["Manda e-mail a Gianardi chiedendo chiarimenti su ultimo report", { azione: "email", cliente: "c3", messaggio: "Ti chiedo chiarimenti sull'ultimo report." }],
  ["Manda messaggio a Gianardi chiedendo chiarimenti su ultimo report", { azione: "messaggio", cliente: "c3", messaggio: "Ti chiedo chiarimenti sull'ultimo report." }],
  ["Sono libero domani alle 10:00?", { azione: "dati", tema: "agenda", giorno: "2026-09-30", ora: "10:00" }],
  ["Devo chiamare fini alessio", { azione: "mente", daFare: true, cliente: null }],
  ["Controllare assicurazioni infortunio", { azione: "mente", daFare: true }],
  ["Controllare PAC totali", { azione: "mente", daFare: true }],
];
VERE.forEach(([f, a]) => prova(f, a, "frasi vere di Andrea"));

/* ---------- 2. Frasi che NON devono finire nel cassetto sbagliato ---------- */
const NON_SBAGLIARE = [
  ["Svuota il cestino", { azione: "comando" }],
  ["Sposta l'appuntamento di Rossi a giovedì", { azione: "modifica" }],
  ["Cancella l'appuntamento di domani", { azione: "modifica" }],
  ["Modifica la fattura di Rossi", { azione: /^(?:modifica|documento)$/ }],
  ["Cosa mi consigli per il bagno di Rossi?", { azione: "domanda" }],
  ["Come si fa la SCIA?", { azione: "domanda" }],
  ["Ricordami di pagare l'F24", { azione: "mente", daFare: true }],
  ["Domani alle 9 sopralluogo da Rossi", { azione: "impegno", giorno: "2026-09-30", ora: "09:00" }],
  ["Venerdì comprare il cemento", { azione: "da_fare", giorno: "2026-10-02", cosa: "Comprare il cemento" }],
  ["Idea: fare un sito per i clienti", { azione: "mente" }],
  ["Aggiungi Mario Bianchi 333 1234567", { azione: "comando" }],
  ["Fatture di Rossi", { azione: "documento", modo: "crea" }], // senza verbo: si chiede cosa (lavoro, importo) o si guardano quelle fatte
  ["Mandami il DURC", { azione: "doc_impresa", documento: "durc" }],
  ["Dammi la visura camerale", { azione: "doc_impresa" }],
  ["Chiama Rossi alle 10", { azione: "impegno", ora: "10:00" }],
  ["Devo chiamare Rossi domani", { azione: "da_fare", cliente: "c6", giorno: "2026-09-30" }],
  ["Quanto ho incassato a settembre?", { azione: "dati", tema: "incassi" }],
  ["Chi mi deve ancora dei soldi?", { azione: "dati", tema: "crediti" }],
  ["Quanti clienti ho?", { azione: "dati", tema: "clienti" }],
  ["Cosa ho da fare domani?", { azione: "dati", tema: "agenda", giorno: "2026-09-30" }],
  ["Ho appuntamenti giovedì pomeriggio?", { azione: "dati", tema: "agenda", giorno: "2026-10-01" }],
  ["Le urgenze?", { azione: "dati", tema: "urgenze" }],
  // Trovate dall'utente virtuale (29/09)
  ["ho finito il lavoro da Machi Alessia", { azione: /^(?:mente|comando)$/ }],
  ["messaggio a Rita: arrivo tra 10 minuti", { azione: "messaggio", cliente: "c2", messaggio: "Arrivo tra 10 minuti." }],
  ["whatsapp Rita arrivo", { azione: "whatsapp", cliente: "c2", messaggio: "Arrivo." }],
  ["manda il preventivo a Rita", { azione: "invio_documento" }],
  ["ehi eon fammi la fattura a rita 1200 euro per il cancello", { azione: "documento", cliente: "c2", importo: 1200, lavoro: "Cancello" }],
  ["preventivo rossi bagno 3500 iva inclusa", { azione: "documento", cliente: "c6", importo: 2868.85, lavoro: "Bagno" }],
  ["fattura", { azione: "documento", manca: "cliente,importo,lavoro" }],
  ["che tempo fa domani", { azione: "domanda" }],
  ["Rita mi ha detto che il bagno lo vuole blu", { azione: "mente", cliente: "c2" }],
  ["chiamata walter domani ore 9 per il preventivo", { azione: "impegno", ora: "09:00" }],
  ["mandare la fattura a Rossi venerdì", { azione: "da_fare", giorno: "2026-10-02" }],
  ["com'è la mia giornata domani, è pesante?", { azione: "domanda" }],
  ["aggiungi in EON queste foto", { azione: "comando" }],
  ["segna in EON di rinnovare il dominio", { azione: "nota_cartella", cartella: "k4", nota: "Rinnovare il dominio", daFare: true }],
  ["e quelle di ieri?", { azione: /^(?:seguito|domanda)$/ }],
  ["mi dai il permesso di costruire", { azione: "comando" }],
  ["mi puoi mandare il durc", { azione: "doc_impresa" }],
  ["Scrivi a Machi domani alle 10", { azione: "impegno", ora: "10:00" }], // promemoria per Andrea, deciso il 28/09
  // Incassi (29/09): pagamenti ricevuti, non quelli fatti da te
  ["Rita ha pagato 1.200", { azione: "incasso", cliente: "c2", importo: 1200 }],
  ["segna 500 euro pagati da Rita", { azione: "incasso", cliente: "c2", importo: 500 }],
  ["ho incassato 300 da Machi Alessia", { azione: "incasso", cliente: "c1", importo: 300 }],
  ["Bianchi mi ha dato 200 euro", { azione: "incasso", cliente: "c8", importo: 200 }],
  ["Rita ha pagato", { azione: "incasso", cliente: "c2", importo: null }],
  ["ho pagato il fornitore 300", { azione: /^(?:mente|comando)$/ }],
  ["devo pagare la bolletta", { azione: "mente", daFare: true }],
  // Le cartelle nelle domande
  ["cosa c'è in Fornitori?", { azione: "dati", tema: "cartella", cartella: "k2" }],
  ["aggiungi cartella EON", { azione: "comando" }], // "EON" qui è il nome della cartella, non un saluto
  ["cosa devo fare per Lerici?", { azione: "dati", tema: "cartella", cartella: "k1" }],
  ["scrivi a Rita Ambrosini che domani alle 10 arrivo", { azione: "messaggio", cliente: "c2", messaggio: "Domani alle 10 arrivo." }],
];
NON_SBAGLIARE.forEach(([f, a]) => prova(f, a, "da non sbagliare"));

/* ---------- 3. Varianti generate (l'utente virtuale) ---------- */
const CORTESIE = ["", "eon ", "Eon, ", "per favore ", "mi puoi ", "senti, ", "ok "];
const FINALI = ["", " grazie", " per favore", ".", "!"];
const IMPORTI = [["20.000", 20000], ["20000", 20000], ["20mila", 20000], ["€ 1.500", 1500], ["1500 euro", 1500], ["2.450,50", 2450.5], ["300", 300], ["80k", 80000]];
const LAVORI = ["rifacimento bagno", "porta blindata", "tinteggiatura soggiorno", "impianto elettrico cucina", "sostituzione caldaia", "progetto seconda casa in campagna"];
const NOTI = ["Machi Alessia", "Rita Ambrosini", "Tommaso Greti", "Francesca Neri", "Edil Sud Srl", "Luca Bianchi", "Spruzzo"];
const NUOVI = [["Chilosi Mariagrazie", "Chilosi Mariagrazie"], ["Marco Verdini", "Marco Verdini"], ["Paola Contini", "Paola Contini"]];
const scegli = (arr, i) => arr[i % arr.length];
const maiuscole = (f, i) => (i % 3 === 0 ? f.toLowerCase() : i % 3 === 1 ? f.charAt(0).toUpperCase() + f.slice(1) : f);
let k = 0;
function varia(frase) {
  const v = [];
  for (let i = 0; i < 3; i++, k++) v.push(maiuscole(scegli(CORTESIE, k) + frase + scegli(FINALI, k * 7 + i), k));
  return v;
}

// Documenti con cliente noto: tutte le forme
const FORME_DOC = [
  (t, c, imp, lav) => `fai ${t} da ${imp} a ${c} per ${lav}`,
  (t, c, imp, lav) => `crea ${t} ${c} ${lav} ${imp}`,
  (t, c, imp, lav) => `${t} per ${c} di ${imp} per ${lav}`,
  (t, c, imp, lav) => `mi fai un${t === "fattura" ? "a" : ""} ${t} per ${c}, ${lav}, ${imp}`,
  (t, c, imp, lav) => `prepara ${t === "fattura" ? "la" : "il"} ${t} di ${imp} per ${lav} a ${c}`,
  (t, c, imp, lav) => `${t} ${imp} ${c} per ${lav}`,
];
let n = 0;
for (const forma of FORME_DOC) for (const tipo of ["fattura", "preventivo"]) for (const cl of NOTI) for (let i = 0; i < IMPORTI.length; i++, n++) {
  const [impT, imp] = IMPORTI[i], lav = scegli(LAVORI, n + i);
  const frase = forma(tipo, cl, impT, lav);
  varia(frase).forEach((f) => prova(f, { azione: "documento", modo: "crea", tipo, cliente: id(cl), importo: imp, lavoro: new RegExp("^" + lav.replace(/\s+/g, "\\s+") + "$", "i"), manca: "" }, "documento, cliente noto"));
}
// Documenti con cliente nuovo
for (const [nomeDetto, nome] of NUOVI) for (const tipo of ["fattura", "preventivo"]) {
  const [impT, imp] = scegli(IMPORTI, n++);
  const lav = scegli(LAVORI, n);
  [`fai ${tipo} da ${impT} a ${nomeDetto} per ${lav}`, `${tipo} ${nomeDetto} ${impT} per ${lav}`, `crea ${tipo} per ${nomeDetto} di ${impT} per ${lav}`].forEach((f) =>
    varia(f).forEach((v) => prova(v, { azione: "documento", clienteNuovo: nome, importo: imp, lavoro: new RegExp("^" + lav + "$", "i"), manca: "" }, "documento, cliente nuovo")));
}
// Documenti con un pezzo mancante: il codice lo chiede
for (const cl of NOTI.slice(0, 4)) {
  prova(`fattura ${cl} 500`, { azione: "documento", cliente: id(cl), manca: "lavoro" }, "documento, manca un pezzo");
  prova(`preventivo ${cl} rifacimento bagno`, { azione: "documento", cliente: id(cl), manca: "importo" }, "documento, manca un pezzo");
  prova(`fai un preventivo a ${cl}`, { azione: "documento", cliente: id(cl), manca: "importo,lavoro" }, "documento, manca un pezzo");
}
prova("fattura da 300 per porta", { azione: "documento", manca: "cliente" }, "documento, manca un pezzo");

// Messaggi, email, WhatsApp, chiamate
const FORME_MSG = [
  (c, t) => [`scrivi a ${c} che ${t}`, "messaggio"],
  (c, t) => [`di a ${c} che ${t}`, "messaggio"],
  (c, t) => [`manda un messaggio a ${c} che ${t}`, "messaggio"],
  (c, t) => [`avvisa ${c} che ${t}`, "messaggio"],
  (c, t) => [`manda una mail a ${c} che ${t}`, "email"],
  (c, t) => [`manda un whatsapp a ${c} che ${t}`, "whatsapp"],
];
const TESTI = [["arrivo alle 10", "Arrivo alle 10."], ["domani non posso venire", "Domani non posso venire."], ["il materiale è arrivato", "Il materiale è arrivato."]];
for (const forma of FORME_MSG) for (const cl of NOTI) for (let i = 0; i < TESTI.length; i++) {
  const [t, atteso] = TESTI[i];
  const [f, azione] = forma(cl, t);
  varia(f).forEach((v) => prova(v, { azione, cliente: id(cl), messaggio: atteso }, "messaggi"));
}
for (const cl of NOTI) for (const v of ["chiama", "telefona a", "chiamami"]) prova(`${v} ${cl}`, { azione: "chiama", cliente: id(cl) }, "chiamate");
prova("chiama Machi", { azione: "chiama", candidati: "c1,c5" }, "chiamate");

// Note nelle cartelle
for (const c of CARTELLE) for (const forma of [(n, t) => `metti in cartella ${n} ${t}`, (n, t) => `segna nella cartella ${n} ${t}`, (n, t) => `${n}: ${t}`, (n, t) => `aggiungi in ${n} ${t}`]) {
  const t = "ritirare le piastrelle";
  prova(forma(c.nome, t), { azione: "nota_cartella", cartella: c.id, nota: "Ritirare le piastrelle", daFare: true }, "cartelle");
}

// Domande sui dati
const DOMANDE = [
  ["quanto devo ancora incassare?", "crediti"], ["chi mi deve dei soldi", "crediti"], ["chi deve ancora pagarmi?", "crediti"], ["ci sono fatture non pagate?", "crediti"],
  ["quanto ho incassato questo mese?", "incassi"], ["quanto ho guadagnato quest'anno?", "incassi"], ["quanto ho fatturato a settembre?", "incassi"],
  ["quanta iva ho questo mese?", "iva"], ["quanto devo di iva?", "iva"],
  ["quanti cantieri ho aperti?", "cantieri"], ["quali lavori in corso ho?", "cantieri"], ["quanti interventi attivi ho?", "cantieri"],
  ["ho impegni domani?", "agenda"], ["cosa ho da fare venerdì?", "agenda"], ["sono libero giovedì alle 15?", "agenda"], ["guarda se sabato sono libero", "agenda"], ["controlla se ho appuntamenti lunedì", "agenda"], ["che programma ho oggi?", "agenda"],
  ["quanti clienti ho?", "clienti"],
];
DOMANDE.forEach(([f, tema]) => varia(f).forEach((v) => prova(v, { azione: "dati", tema }, "domande sui dati")));

// Cose da fare e pensieri (Mente) e cose con il giorno (calendario)
const DA_FARE = ["comprare il silicone", "chiamare il commercialista", "ordinare le piastrelle", "portare la macchina dal meccanico", "pagare la bolletta"];
DA_FARE.forEach((t, i) => {
  prova("devo " + t, { azione: "mente", daFare: true }, "Mente");
  prova(t.charAt(0).toUpperCase() + t.slice(1), { azione: "mente", daFare: true }, "Mente");
  prova(scegli(["domani ", "venerdì ", "lunedì prossimo "], i) + t, { azione: "da_fare", cosa: new RegExp(t, "i") }, "da fare con il giorno");
  prova(t + " " + scegli(["domani", "venerdì", "il 15 ottobre"], i), { azione: "da_fare" }, "da fare con il giorno");
  prova(scegli(["domani alle 9 ", "venerdì ore 15 ", "alle 17:30 "], i) + t, { azione: "impegno" }, "calendario");
});
["idea per il sito: mettere le foto dei lavori", "il cliente di via Roma vuole il parquet chiaro", "prezzo del cemento salito del 10%"].forEach((f) => prova(f, { azione: "mente" }, "Mente"));

// Più comandi in una frase
prova("domani alle 9 Rossi, poi comprare il silicone", { azione: "piu", pezzi: "impegno,da_fare" }, "più comandi");
prova("venerdì alle 10 sopralluogo da Bianchi e ritirare le piastrelle", { azione: "piu", pezzi: "impegno,da_fare" }, "più comandi");

// Parole dei mestieri: il lavoro può essere qualunque cosa, il cassetto resta quello
const LAVORI_MESTIERI = {
  edile: ["getto del solaio", "massetto piano terra", "rifacimento tetto", "cappotto termico", "demolizione tramezzi"],
  idraulico: ["sostituzione caldaia", "riparazione perdita bagno", "spurgo scarico cucina", "installazione autoclave", "revisione caldaia"],
  elettricista: ["rifacimento quadro elettrico", "impianto fotovoltaico", "punti luce soggiorno", "messa a terra", "citofono nuovo"],
  amministratore: ["gestione ordinaria condominio", "assemblea straordinaria", "manutenzione ascensore", "pulizia scale", "rifacimento facciata"],
};
for (const [mestiere, lavori] of Object.entries(LAVORI_MESTIERI)) lavori.forEach((lav, i) => {
  const cl = scegli(NOTI, i + mestiere.length), [impT, imp] = scegli(IMPORTI, i + 3);
  [`fattura ${cl} ${impT} per ${lav}`, `fai preventivo a ${cl} per ${lav} da ${impT}`, `preventivo per ${cl} di ${impT} per ${lav}`].forEach((f) =>
    varia(f).forEach((v) => prova(v, { azione: "documento", cliente: id(cl), importo: imp, lavoro: new RegExp("^" + lav + "$", "i"), manca: "" }, "mestieri: " + mestiere)));
  prova(`devo comprare il materiale per ${lav}`, { azione: "mente", daFare: true }, "mestieri: " + mestiere);
  prova(`domani alle 8 ${lav} da ${cl}`, { azione: "impegno", giorno: "2026-09-30", ora: "08:00" }, "mestieri: " + mestiere);
});
// Giorni e ore scritti in tanti modi
const QUANDO = [["domani alle 9", "2026-09-30", "09:00"], ["domattina alle 8:30", "2026-09-30", "08:30"], ["giovedì ore 15", "2026-10-01", "15:00"], ["venerdì alle 3 del pomeriggio", "2026-10-02", "15:00"],
  ["lunedì prossimo alle 10", "2026-10-05", "10:00"], ["il 15 ottobre alle 11", "2026-10-15", "11:00"], ["il 20/10 alle 17", "2026-10-20", "17:00"], ["dopodomani alle 18 e mezza", "2026-10-01", "18:30"], ["oggi alle 17", "2026-09-29", "17:00"]];
QUANDO.forEach(([q, g, o]) => ["sopralluogo da Rossi", "chiamare il fornitore", "riunione in cantiere"].forEach((cosa) => {
  prova(`${q} ${cosa}`, { azione: "impegno", giorno: g, ora: o }, "giorni e ore");
  prova(`${cosa} ${q}`, { azione: "impegno", giorno: g, ora: o }, "giorni e ore");
}));

/* ---------- Risultato ---------- */
const perGruppo = {};
[...sbagliate].forEach((s) => { perGruppo[s.gruppo] = (perGruppo[s.gruppo] || 0) + 1; });
console.log(`\nUtente virtuale: ${totale} frasi, ${giuste} capite giuste dal codice (${Math.round(giuste / totale * 1000) / 10}%).`);
if (sbagliate.length) {
  console.log("Sbagliate per gruppo:", JSON.stringify(perGruppo));
  const elenco = process.argv.includes("--elenco") ? sbagliate : sbagliate.slice(0, 15);
  elenco.forEach((s) => console.log(`  FAIL [${s.gruppo}] «${s.frase}» — ${s.motivo}`));
}
// Le frasi vere di Andrea e quelle da non sbagliare: tutte giuste. Le varianti: almeno il 98%.
const vereSbagliate = sbagliate.filter((s) => s.gruppo === "frasi vere di Andrea" || s.gruppo === "da non sbagliare").length;
const ok = vereSbagliate === 0 && giuste / totale >= 0.98;
console.log(ok ? "\nTutto ok" : "\nNon basta: " + vereSbagliate + " frasi vere o da non sbagliare lette male");
process.exit(ok ? 0 : 1);
