/* Preventivi lunghi dettati (29/09/2026, Andrea: il tester ha dettato un
   preventivo di un minuto, voce per voce, e EON è andato in tilt; "doveva
   farlo il codice, non l'AI… va esteso a tutti anche a frasi lunghe").

   Frasi come le scrive la dettatura del telefono: di solito SENZA
   punteggiatura, numeri in cifre, "euro" o "€", metri quadri, prezzi al
   metro o a corpo, IVA, sconti, totale detto alla fine. Per ognuna si
   controlla che il lettore (lettore.js) trovi: il cliente, OGNI voce
   (descrizione, quantità, prezzo), l'IVA e il totale.
   Uso: node eval/preventivi-lunghi.test.mjs [--elenco] */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../lettore.js");

const ELENCO = process.argv.includes("--elenco");
const OGGI = new Date("2026-09-29T10:00:00");
const CLIENTI = [
  { id: "c1", name: "Mario Rossi" }, { id: "c2", name: "Rita Ambrosini" }, { id: "c3", name: "Condominio Parco Verde" },
  { id: "c4", name: "Luca Bianchi" }, { id: "c5", name: "Francesca Neri" }, { id: "c6", name: "Bar Centrale" },
];
const CTX = { clienti: CLIENTI, cartelle: [], oggi: OGGI };

/* [frase, { cliente | clienteNuovo, voci: [[descrizione (regex), quantità, prezzo unitario], …], iva?, totale? }] */
const CASI = [
  /* ---------- Edile ---------- */
  ["preventivo per Mario Rossi rifacimento bagno demolizione piastrelle e sanitari 800 euro fornitura e posa pavimento 30 metri quadri a 45 euro al metro quadro rivestimento pareti 25 mq a 50 euro al mq smaltimento macerie 350 euro manodopera muratore 1200 euro iva al 10%",
    { cliente: "c1", voci: [[/demolizione piastrelle e sanitari/i, 1, 800], [/posa pavimento/i, 30, 45], [/rivestimento pareti/i, 25, 50], [/smaltimento macerie/i, 1, 350], [/manodopera muratore/i, 1, 1200]], iva: 10 }],
  ["Fai un preventivo a Luca Bianchi per la ristrutturazione della cucina: demolizione 600 €, rifacimento impianto elettrico 1.500 €, piastrelle 18 mq a 40 € al mq, tinteggiatura 400 €. Iva 10 per cento.",
    { cliente: "c4", voci: [[/demolizione/i, 1, 600], [/impianto elettrico/i, 1, 1500], [/piastrelle/i, 18, 40], [/tinteggiatura/i, 1, 400]], iva: 10 }],
  ["preventivo Condominio Parco Verde rifacimento facciata ponteggio 3.500 euro idrolavaggio facciata 1.200 euro ripristino intonaci ammalorati 80 metri quadri a 35 euro tinteggiatura con pittura silossanica 400 mq a 12 euro al metro totale 14.700 euro",
    { cliente: "c3", voci: [[/ponteggio/i, 1, 3500], [/idrolavaggio/i, 1, 1200], [/ripristino intonaci/i, 80, 35], [/tinteggiatura/i, 400, 12]], totale: 14700 }],
  ["preventivo per Francesca Neri cappotto termico 120 metri quadri a 65 euro al metro quadro poi il ponteggio 2800 poi le soglie delle finestre 8 pezzi da 90 euro l'una e poi lo smaltimento 300 euro",
    { cliente: "c5", voci: [[/cappotto termico/i, 120, 65], [/ponteggio/i, 1, 2800], [/soglie/i, 8, 90], [/smaltimento/i, 1, 300]] }],
  ["nuovo preventivo per Giorgio Verdi massetto 50 mq a 18 euro, pavimento in gres 50 mq a 38 euro, battiscopa 40 metri lineari a 9 euro, sconto 200 euro",
    { clienteNuovo: "Giorgio Verdi", voci: [[/massetto/i, 50, 18], [/pavimento in gres/i, 50, 38], [/battiscopa/i, 40, 9], [/sconto/i, 1, -200]] }],
  ["preventivo Rita Ambrosini tramezzo in cartongesso 12 mq a 55 euro controsoffitto 20 mq a 45 euro stuccatura e pittura 600 euro più iva",
    { cliente: "c2", voci: [[/tramezzo in cartongesso/i, 12, 55], [/controsoffitto/i, 20, 45], [/stuccatura e pittura/i, 1, 600]], iva: 22 }],
  ["preventivo per Mario Rossi manodopera 3 giorni a 280 euro al giorno materiale 450 euro trasporto 80 euro",
    { cliente: "c1", voci: [[/manodopera/i, 3, 280], [/materiale/i, 1, 450], [/trasporto/i, 1, 80]] }],
  ["allora eon fammi il preventivo per il signor Luca Bianchi allora ci mettiamo la demolizione del vecchio pavimento che sono 700 euro poi il massetto nuovo che sono 40 metri a 20 euro poi il pavimento in parquet 40 metri a 60 euro al metro e la manodopera per la posa 900 euro",
    { cliente: "c4", voci: [[/demolizione del vecchio pavimento/i, 1, 700], [/massetto nuovo/i, 40, 20], [/parquet/i, 40, 60], [/manodopera per la posa/i, 1, 900]] }],

  /* ---------- Idraulico ---------- */
  ["preventivo per Rita Ambrosini sostituzione caldaia fornitura caldaia a condensazione 24 kW 1.850 euro smontaggio vecchia caldaia e smaltimento 150 euro installazione e collegamenti 400 euro kit fumi 120 euro prima accensione 90 euro iva al 10 %",
    { cliente: "c2", voci: [[/caldaia a condensazione/i, 1, 1850], [/smontaggio vecchia caldaia/i, 1, 150], [/installazione e collegamenti/i, 1, 400], [/kit fumi/i, 1, 120], [/prima accensione/i, 1, 90]], iva: 10 }],
  ["preventivo Mario Rossi rifacimento impianto idraulico bagno tubazioni multistrato 250 euro scarichi 180 euro 4 punti acqua a 120 euro l'uno piatto doccia 80x120 380 euro miscelatori 2 pezzi a 95 euro manodopera 16 ore a 35 euro l'ora",
    { cliente: "c1", voci: [[/tubazioni multistrato/i, 1, 250], [/scarichi/i, 1, 180], [/punti acqua/i, 4, 120], [/piatto doccia 80x120/i, 1, 380], [/miscelatori/i, 2, 95], [/manodopera/i, 16, 35]] }],
  ["preventivo per Bar Centrale riparazione perdita sotto il lavello 80 euro sostituzione sifone 35 euro uscita 40 euro",
    { cliente: "c6", voci: [[/perdita sotto il lavello/i, 1, 80], [/sifone/i, 1, 35], [/uscita/i, 1, 40]] }],
  ["preventivo Francesca Neri 6 radiatori in alluminio a 110 euro cadauno valvole termostatiche 6 a 45 euro installazione 480 euro",
    { cliente: "c5", voci: [[/radiatori in alluminio/i, 6, 110], [/valvole termostatiche/i, 6, 45], [/installazione/i, 1, 480]] }],
  ["preventivo per Luca Bianchi scaldabagno elettrico 80 litri 260 euro montaggio 120 euro",
    { cliente: "c4", voci: [[/scaldabagno elettrico 80 litri/i, 1, 260], [/montaggio/i, 1, 120]] }],

  /* ---------- Elettricista ---------- */
  ["preventivo per Mario Rossi rifacimento impianto elettrico appartamento quadro elettrico con differenziale 450 euro 25 punti luce a 55 euro 30 prese a 45 euro l'una cavi e canaline 600 euro dichiarazione di conformità 150 euro",
    { cliente: "c1", voci: [[/quadro elettrico/i, 1, 450], [/punti luce/i, 25, 55], [/prese/i, 30, 45], [/cavi e canaline/i, 1, 600], [/dichiarazione di conformit/i, 1, 150]] }],
  ["preventivo Rita Ambrosini impianto fotovoltaico 6 kW 7.800 euro batteria di accumulo 10 kWh 4.500 euro pratiche enel e gse 350 euro iva al 10%",
    { cliente: "c2", voci: [[/fotovoltaico 6 kw/i, 1, 7800], [/batteria di accumulo 10 kwh/i, 1, 4500], [/pratiche enel e gse/i, 1, 350]], iva: 10 }],
  ["preventivo per Bar Centrale sostituzione salvavita 180 euro verifica messa a terra 120 euro 10 faretti led a 35 euro",
    { cliente: "c6", voci: [[/salvavita/i, 1, 180], [/messa a terra/i, 1, 120], [/faretti led/i, 10, 35]] }],
  ["preventivo Condominio Parco Verde videocitofono 12 postazioni interne a 180 euro pulsantiera esterna 650 euro cablaggio 900 euro manodopera 2 giorni a 320 euro",
    { cliente: "c3", voci: [[/postazioni interne/i, 12, 180], [/pulsantiera esterna/i, 1, 650], [/cablaggio/i, 1, 900], [/manodopera/i, 2, 320]] }],
  ["preventivo per Francesca Neri colonnina di ricarica auto 7,4 kW 1.290 euro linea dedicata 25 metri a 18 euro al metro installazione 350 euro",
    { cliente: "c5", voci: [[/colonnina di ricarica/i, 1, 1290], [/linea dedicata/i, 25, 18], [/installazione/i, 1, 350]] }],

  /* ---------- Amministratore ---------- */
  ["preventivo per Condominio Parco Verde pulizia scale mensile 12 mesi a 180 euro al mese sanificazione annuale 400 euro sostituzione lampade vano scala 250 euro",
    { cliente: "c3", voci: [[/pulizia scale/i, 12, 180], [/sanificazione annuale/i, 1, 400], [/lampade vano scala/i, 1, 250]] }],
  ["preventivo Condominio Parco Verde compenso amministrazione annuale 2.400 euro più iva spese postali 150 euro gestione straordinaria rifacimento tetto 2% sui lavori",
    { cliente: "c3", voci: [[/compenso amministrazione/i, 1, 2400], [/spese postali/i, 1, 150]] }],

  /* ---------- Altra attività ---------- */
  ["preventivo per Bar Centrale catering per 50 persone a 25 euro a persona allestimento 300 euro servizio camerieri 3 a 120 euro",
    { cliente: "c6", voci: [[/catering/i, 50, 25], [/allestimento/i, 1, 300], [/servizio camerieri/i, 3, 120]] }],
  ["preventivo Luca Bianchi sito web 5 pagine 1.200 euro logo 350 euro hosting annuale 90 euro",
    { cliente: "c4", voci: [[/sito web 5 pagine/i, 1, 1200], [/logo/i, 1, 350], [/hosting annuale/i, 1, 90]] }],
  ["fattura per Rita Ambrosini giardinaggio potatura siepi 250 euro taglio erba 4 volte a 60 euro smaltimento verde 80 euro",
    { cliente: "c2", voci: [[/potatura siepi/i, 1, 250], [/taglio erba/i, 4, 60], [/smaltimento verde/i, 1, 80]], tipo: "fattura" }],

  /* ---------- Prezzo prima della descrizione ---------- */
  ["preventivo per Mario Rossi 800 euro per la demolizione 1.200 euro per i sanitari 600 euro per la manodopera",
    { cliente: "c1", voci: [[/demolizione/i, 1, 800], [/sanitari/i, 1, 1200], [/manodopera/i, 1, 600]] }],

  /* ---------- Una voce sola: come prima ---------- */
  ["preventivo per Mario Rossi rifacimento bagno 5.000 euro", { cliente: "c1", importo: 5000, voci: null }],
  ["fattura Rita Ambrosini 1.200 per sostituzione caldaia", { cliente: "c2", importo: 1200, voci: null }],
  ["preventivo per Luca Bianchi posa pavimento 40 mq a 30 euro", { cliente: "c4", voci: [[/posa pavimento/i, 40, 30]] }],
];

/* Seconda prova (scritta DOPO il codice, per misurare al primo colpo): modi
   di dire diversi, numeri in lettere, "a corpo", "la prima voce…" */
const CASI_2 = [
  ["preventivo per Luca Bianchi la prima voce è la demolizione del bagno esistente a corpo 900 euro la seconda voce fornitura sanitari sospesi 1.100 euro la terza la posa dei sanitari 350 euro",
    { cliente: "c4", voci: [[/demolizione del bagno esistente/i, 1, 900], [/sanitari sospesi/i, 1, 1100], [/posa dei sanitari/i, 1, 350]] }],
  ["preventivo Mario Rossi ottocento euro di demolizione e milleduecento di sanitari",
    { cliente: "c1", voci: [[/demolizione/i, 1, 800], [/sanitari/i, 1, 1200]] }],
  ["preventivo per Rita Ambrosini imbiancatura appartamento 90 metri quadrati a 8 euro e 50 al metro quadrato più stucco e rasatura 350 euro",
    { cliente: "c2", voci: [[/imbiancatura appartamento/i, 90, 8.5], [/stucco e rasatura/i, 1, 350]] }],
  ["Preventivo Francesca Neri. Sostituzione finestre: 5 finestre in PVC a 650 € l'una, 1 portafinestra 980 €, smontaggio e smaltimento vecchi infissi 250 €. IVA agevolata 10%.",
    { cliente: "c5", voci: [[/finestre in pvc/i, 5, 650], [/portafinestra/i, 1, 980], [/smontaggio e smaltimento/i, 1, 250]], iva: 10 }],
  ["preventivo condominio parco verde manutenzione ascensore annuale 1800 euro revisione biennale 450 euro sostituzione funi 2.300",
    { cliente: "c3", voci: [[/manutenzione ascensore/i, 1, 1800], [/revisione biennale/i, 1, 450], [/sostituzione funi/i, 1, 2300]] }],
  ["preventivo Bar Centrale impianto di climatizzazione 2 split da 12000 btu a 890 euro l'uno installazione 400 euro gas e collaudo 150 euro",
    { cliente: "c6", voci: [[/split/i, 2, 890], [/installazione/i, 1, 400], [/gas e collaudo/i, 1, 150]] }],
  ["fammi un preventivo per Mario Rossi scavo 15 metri cubi a 40 euro al metro cubo getto calcestruzzo 12 metri cubi a 130 euro armatura 800 euro",
    { cliente: "c1", voci: [[/scavo/i, 15, 40], [/getto calcestruzzo/i, 12, 130], [/armatura/i, 1, 800]] }],
  ["preventivo Luca Bianchi rifacimento tetto rimozione tegole 100 mq a 12 euro guaina 100 mq a 18 euro tegole nuove 100 mq a 32 euro lattoneria 1.400 euro ponteggio 2.000 euro",
    { cliente: "c4", voci: [[/rimozione tegole/i, 100, 12], [/guaina/i, 100, 18], [/tegole nuove/i, 100, 32], [/lattoneria/i, 1, 1400], [/ponteggio/i, 1, 2000]] }],
  ["preventivo per Rita Ambrosini sostituzione quadro elettrico 520 euro più 4 interruttori magnetotermici da 38 euro più cablaggio 200 euro",
    { cliente: "c2", voci: [[/quadro elettrico/i, 1, 520], [/interruttori magnetotermici/i, 4, 38], [/cablaggio/i, 1, 200]] }],
  ["preventivo per Francesca Neri pulizia caldaia e analisi fumi 110 euro bollino 15 euro",
    { cliente: "c5", voci: [[/pulizia caldaia e analisi fumi/i, 1, 110], [/bollino/i, 1, 15]] }],
  ["preventivo Mario Rossi fornitura e posa di 3 porte interne a 420 euro cadauna maniglie 3 a 25 euro",
    { cliente: "c1", voci: [[/porte interne/i, 3, 420], [/maniglie/i, 3, 25]] }],
  ["preventivo per Bar Centrale tinteggiatura locale 1.500 euro compreso materiale verniciatura ringhiera 300 euro",
    { cliente: "c6", voci: [[/tinteggiatura locale/i, 1, 1500], [/verniciatura ringhiera/i, 1, 300]] }],
  ["preventivo per Luca Bianchi installazione antenna tv 180 euro e parabola 150 euro",
    { cliente: "c4", voci: [[/antenna tv/i, 1, 180], [/parabola/i, 1, 150]] }],
  ["preventivo condominio Parco Verde spurgo fognatura 650 euro videoispezione 280 euro disostruzione colonna 3 colonne a 190 euro",
    { cliente: "c3", voci: [[/spurgo fognatura/i, 1, 650], [/videoispezione/i, 1, 280], [/colonn/i, 3, 190]] }],
  ["preventivo Rita Ambrosini duemila euro per il ponteggio e tremilacinquecento per il rifacimento della facciata",
    { cliente: "c2", voci: [[/ponteggio/i, 1, 2000], [/facciata/i, 1, 3500]] }],
  ["preventivo per Mario Rossi massetto autolivellante 60 metri quadri a 16 euro e 50 posa parquet 60 mq a 28 euro battiscopa 45 metri lineari a 7 euro",
    { cliente: "c1", voci: [[/massetto autolivellante/i, 60, 16.5], [/posa parquet/i, 60, 28], [/battiscopa/i, 45, 7]] }],
  ["preventivo per Francesca Neri addolcitore 1.100 euro filtro 90 euro installazione 250 euro iva 22%",
    { cliente: "c5", voci: [[/addolcitore/i, 1, 1100], [/filtro/i, 1, 90], [/installazione/i, 1, 250]], iva: 22 }],
  ["preventivo per Luca Bianchi assistenza informatica 10 ore a 45 euro l'ora licenza antivirus 3 postazioni a 40 euro",
    { cliente: "c4", voci: [[/assistenza informatica/i, 10, 45], [/antivirus/i, 3, 40]] }],
  ["preventivo Bar Centrale pulizia straordinaria 380 euro vetri 120 euro",
    { cliente: "c6", voci: [[/pulizia straordinaria/i, 1, 380], [/vetri/i, 1, 120]] }],
  ["preventivo per Rita Ambrosini impermeabilizzazione terrazzo 40 mq a 55 euro al metro quadro massetto di pendenza 40 mq a 22 euro piastrelle da esterno 40 mq a 48 euro",
    { cliente: "c2", voci: [[/impermeabilizzazione terrazzo/i, 40, 55], [/massetto di pendenza/i, 40, 22], [/piastrelle da esterno/i, 40, 48]] }],
  ["preventivo Mario Rossi pompa di calore 8 kW 6.900 euro accumulo 300 litri 1.300 euro installazione e collegamenti idraulici ed elettrici 1.500 euro detrazione 65% iva 10%",
    { cliente: "c1", voci: [[/pompa di calore 8 kw/i, 1, 6900], [/accumulo 300 litri/i, 1, 1300], [/installazione e collegamenti/i, 1, 1500]], iva: 10 }],
  ["preventivo per Luca Bianchi montaggio cucina 450 euro allacciamento lavastoviglie e lavatrice 120 euro foratura top per piano cottura 60 euro",
    { cliente: "c4", voci: [[/montaggio cucina/i, 1, 450], [/allacciamento lavastoviglie e lavatrice/i, 1, 120], [/foratura top/i, 1, 60]] }],
  ["preventivo per Francesca Neri 12 ore di manodopera a 30 euro materiale elettrico 240 euro",
    { cliente: "c5", voci: [[/manodopera/i, 12, 30], [/materiale elettrico/i, 1, 240]] }],
  ["preventivo condominio Parco Verde assemblea straordinaria 300 euro redazione verbale 80 euro invio raccomandate 24 a 6 euro",
    { cliente: "c3", voci: [[/assemblea straordinaria/i, 1, 300], [/redazione verbale/i, 1, 80], [/raccomandate/i, 24, 6]] }],
  ["preventivo per Mario Rossi rifacimento bagno completo 7.500 euro chiavi in mano", { cliente: "c1", importo: 7500, voci: null }],
];

let totale = 0, giuste = 0;
const sbagliate = [];
const SECONDA = process.argv.includes("--seconda");
for (const [frase, atteso] of (SECONDA ? CASI_2 : CASI.concat(CASI_2))) {
  totale++;
  let l;
  try { l = L.leggi(frase, CTX); } catch (e) { sbagliate.push({ frase, motivo: "errore: " + e.message }); continue; }
  const p = [];
  if (l.azione !== "documento") p.push(`azione ${l.azione}`);
  if (atteso.tipo && l.tipo !== atteso.tipo) p.push(`tipo ${l.tipo}`);
  if (atteso.cliente && (!l.cliente || l.cliente.id !== atteso.cliente)) p.push(`cliente ${l.cliente ? l.cliente.id : l.clienteNuovo}`);
  if (atteso.clienteNuovo && l.clienteNuovo !== atteso.clienteNuovo) p.push(`cliente nuovo ${l.clienteNuovo}`);
  if (atteso.voci === null) {
    if (l.voci && l.voci.length > 1) p.push(`voci ${l.voci.length} (attesa 1)`);
    if (l.importo !== atteso.importo) p.push(`importo ${l.importo}`);
  } else {
    const v = l.voci || [];
    if (v.length !== atteso.voci.length) p.push(`voci ${v.length} invece di ${atteso.voci.length}: ${JSON.stringify(v.map((x) => [x.descrizione, x.quantita, x.prezzo]))}`);
    else atteso.voci.forEach(([re, q, pr], i) => {
      if (!re.test(v[i].descrizione) || v[i].quantita !== q || v[i].prezzo !== pr) p.push(`voce ${i + 1}: ${JSON.stringify([v[i].descrizione, v[i].quantita, v[i].prezzo])} attesa ${re} ${q}×${pr}`);
    });
    const somma = atteso.voci.reduce((t, [, q, pr]) => t + q * pr, 0);
    if (l.importo !== somma) p.push(`importo ${l.importo} invece di ${somma}`);
    if (l.manca && l.manca.length) p.push(`manca ${l.manca.join(",")}`);
  }
  if (atteso.iva && l.aliquotaIva !== atteso.iva) p.push(`iva ${l.aliquotaIva}`);
  if (atteso.totale && l.totaleDetto !== atteso.totale) p.push(`totale detto ${l.totaleDetto}`);
  if (p.length) sbagliate.push({ frase, motivo: p.join("; ") });
  else giuste++;
}

console.log(`Preventivi lunghi letti dal codice: ${giuste}/${totale}`);
sbagliate.slice(0, ELENCO ? 999 : 12).forEach((s) => console.log(`  FAIL «${s.frase.slice(0, 90)}…» — ${s.motivo}`));
process.exit(giuste === totale ? 0 : 1);
