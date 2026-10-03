/* Passo A: più varietà alle frasi degli scrittori (2/10/2026). Per ogni frase segnata se ne fanno
   altre cambiando i pezzi: il nome (CHI) con migliaia di cognomi, nomi e ditte, il lavoro (LAV),
   il giorno e l'ora (GIO, ORA, NGIO, NORA), l'indirizzo, il telefono, la mail, la cartella, il numero.
   Le parole intorno restano quelle dello scrittore: il modello impara dal contesto, non dal nome.
   Sono DATI per l'allenamento, non regole dell'app.
   Uso: node varia.mjs [quante per frase=12] [seme=1] < dati/scritte.jsonl > dati/variate.jsonl
   (gli scrittori in TIENI_FUORI non si variano: restano la prova pulita) */
import fs from "node:fs";
const QUANTE = Number(process.argv[2] || 12);
let seme = Number(process.argv[3] || 1);
const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
const uno = (a) => a[Math.floor(caso() * a.length)];
const forse = (p) => caso() < p;
const tra = (a, b) => a + Math.floor(caso() * (b - a + 1));
const FUORI = (process.env.TIENI_FUORI || "s11,s12").split(",").filter(Boolean);

const COGNOMI = `Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De Luca Mancini Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone Longo Gentile Martinelli Vitale Lombardo Serra Coppola De Santis D'Angelo Marchetti Parisi Villa Conte Ferraro Ferri Fabbri Bianco Marini Grasso Valentini Messina Sala De Angelis Gatti Pellegrini Palumbo Sanna Farina Rizzi Monti Cattaneo Morelli Amato Silvestri Mazza Testa Grassi Pellegrino Carbone Giuliani Benedetti Barone Rossetti Caputo Montanari Guerra Palmieri Bernardi Martino Fiore De Rosa Ferretti Bellini Basile Riva Donati Piras Vitali Battaglia Sartori Neri Costantini Milani Pagano Ruggiero Sorrentino D'Amico Orlando Damico Negri Fumagalli Brambilla Pozzi Locatelli Pesenti Bonomi Zanetti Bergamaschi Vavassori Rota Carminati Cortinovis Zanon Zanella Bortolin Pavan Furlan Visentin Favaro Scarpa Trevisan Marcon Benetton Cossu Fois Melis Mura Pinna Porcu Deiana Dettori Satta Spanu Murgia Usai Loi Atzeni Puddu Lai Cocco Mele Contu Floris Esposito Gargiulo Cuomo Iovine Capasso Sepe Ascione Di Lorenzo Coppola Amoroso Russo Cannavacciuolo Lo Presti La Rosa Lombardo Scuderi Messina Calì Pappalardo Musumeci Grasso Puglisi Di Mauro Strano Tomasello Caruso Licciardello Bertolini Bassi Montagna Guidi Fabbri Ricci Bonetti Ghelfi Cavazzuti Ferrarini Bulgarelli Malagoli Tosi Morandi Barbieri Belletti Lanzi Nanni Gori Bartolini Innocenti Mazzoni Sacchetti Lapi Cecchi Baldi Bandini Pratesi Nesti Gelli Tinti Biagini Paoli Rocca Pastore Fiorentino Mazzola Cirillo D'Alessandro Di Stefano Cocozza Ruocco Marra Cozzolino Dalla Costa Dal Bosco Fabris Zago Pegoraro Tonon Bonaldo Gobbo Rigo Bettio Schiavon Cassol Brugnera Facchin Tomasin Scaglia Possa Machi Merlo Ambrosini Dini Galli Tosi Sartor Brusco Rizzardi Brunetti Lucchesi Fanelli Mancuso Gallina Valente Vinci Piazza Cavallo Fiorini Ruggeri Bassani Corradi Righi Benassi Golinelli Pagani Sironi Brivio Colombo Mauri Galbiati Crippa Cazzaniga Mariani Viganò Riva Ronchi Arosio Vergani`.split(" ");
const NOMI = `Mario Luca Marco Giuseppe Francesco Antonio Giovanni Paolo Andrea Roberto Stefano Alessandro Davide Simone Matteo Lorenzo Gabriele Federico Riccardo Daniele Fabio Massimo Claudio Sergio Bruno Enzo Gino Pino Tonino Carlo Franco Piero Walter Ivano Mauro Renato Silvio Aldo Elio Nicola Michele Vincenzo Salvatore Gennaro Ciro Rosario Maria Anna Giulia Francesca Sara Laura Chiara Elena Paola Alessandra Valentina Federica Silvia Martina Roberta Rita Tiziana Patrizia Daniela Monica Barbara Cristina Lucia Rosa Carla Franca Giuseppina Antonella Teresa Simona Elisa Marta Ilaria Giorgia Beatrice Veronica Manuela Graziella Loredana Concetta Assunta Nunzia Carmela`.split(" ");
const TITOLI = ["signor", "signora", "sig.", "sig.ra", "dottor", "dottoressa", "ingegner", "geometra", "architetto", "avvocato", "il geometra", "la signora", "il signor", "l'architetto", "il dottor", "la dottoressa", "zio", "zia"];
const DITTE_TIPI = ["Bar", "Hotel", "B&B", "Ristorante", "Pizzeria", "Trattoria", "Officina", "Farmacia", "Panificio", "Macelleria", "Studio", "Palestra", "Agriturismo", "Edil", "Termo", "Elettro", "Idraulica", "Vivai", "Cantina", "Ferramenta", "Carrozzeria", "Autofficina", "Gelateria", "Pasticceria", "Albergo", "Residence", "Villa", "Cascina", "Masseria", "Tenuta"];
const DITTE_NOMI = ["Aurora", "Sirenella", "Miramare", "Belvedere", "Le Rose", "Il Gabbiano", "Da Nando", "Al Ponte", "La Pergola", "Stella", "Sole", "Primavera", "Arcobaleno", "Bellavista", "Il Faro", "La Quercia", "Le Querce", "I Pini", "Gli Ulivi", "San Marco", "Del Corso", "Centrale", "Moderna", "Europa", "Italia", "Paradiso", "Riviera", "Dolce Vita", "Lu Pagghiaru", "Sa Tanca", "Badde Alva", "Zanola", "Fratelli Riva", "Tre Torri", "Il Mulino", "La Fornace", "Montebello", "Valverde", "Rio Bianco", "Colle Verde"];
const VIE = ["via Roma", "via Garibaldi", "via Mazzini", "via Verdi", "corso Italia", "via Dante", "viale Europa", "via Marconi", "piazza Libertà", "via dei Mille", "via Cavour", "via XX Settembre", "via Manzoni", "via Leopardi", "viale delle Ginestre", "via dei Mandorli", "via Sparano", "via Toledo", "corso Vittorio Emanuele", "via Pascoli", "via Carducci", "via Galilei", "via Volta", "via Matteotti", "via Gramsci", "via Kennedy", "via Fermi", "via San Francesco", "largo Augusto", "via Monte Grappa"];
const COND = ["Condominio", "condominio", "Supercondominio", "il condominio", "Residenza", "Palazzo"];
const CITTA = ["Bari", "Treviso", "Seriate", "Albino", "Modena", "Prato", "Sassari", "Catania", "Torino", "Genova", "Bergamo", "Lecce", "Monza", "Rho", "Carpi", "Empoli", "Olbia", "Acireale", "Chieri", "Rapallo"];
function chi() {
  const c = uno(COGNOMI), n = uno(NOMI), x = caso();
  if (x < 0.30) return c;
  if (x < 0.45) return n + " " + c;
  if (x < 0.52) return n;
  if (x < 0.62) return uno(TITOLI) + " " + c;
  if (x < 0.75) return uno(DITTE_TIPI) + " " + uno(DITTE_NOMI);
  if (x < 0.82) return uno(DITTE_TIPI) + " " + c;
  if (x < 0.92) return uno(COND) + " " + (forse(0.6) ? uno(VIE).replace(/^(?:via|viale|corso|piazza|largo) /, (m) => forse(0.5) ? m : "") + (forse(0.6) ? " " + tra(1, 120) : "") : uno(DITTE_NOMI));
  return uno(["la ditta", "l'impresa", "la famiglia", "i fratelli", "casa"]) + " " + c;
}
const LAVORI = `rifacimento bagno|sopralluogo|preventivo cucina|cambio caldaia|perdita lavandino|massetto|getto solaio|cappotto termico|tinteggiatura|cartongesso|controsoffitto|posa piastrelle|impianto elettrico|quadro elettrico|fotovoltaico|pompa di calore|climatizzatore|scarico intasato|boiler|messa a terra|citofono|videosorveglianza|cancello automatico|infissi|inferriate|tapparelle|grondaie|tetto|guaina|impermeabilizzazione terrazzo|potatura siepe|taglio prato|irrigazione|abbattimento pino|manutenzione caldaia|revisione estintori|pulizia scale|ascensore|facciata|ponteggio|demolizione|smaltimento macerie|muro di cinta|soletta|vespaio|fognatura|autospurgo|pavimento in legno|parquet|battiscopa|porta blindata|serratura|vetrata|box doccia|sanitari|rubinetteria|termosifoni|caldaia a condensazione|canna fumaria|stufa a pellet|domotica|luci giardino|antenna|cablaggio|presa fuori uso|salvavita|collaudo|verifica impianto|DiCo impianto|consegna materiale|ritiro piastrelle|scarico mattoni|ordine cemento|riunione cantiere|lavori facciata|lavori tetto|assemblea straordinaria|lettura contatori|derattizzazione|disinfestazione|pulizia grondaie|rotoli prato|concimazione|processionaria`.split("|");
const GIORNI = `oggi|domani|dopodomani|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|lunedì prossimo|martedì prossimo|giovedì prossimo|venerdì prossimo|la settimana prossima|fra tre giorni|tra due giorni|fra una settimana|il 3 ottobre|il 15 ottobre|il 20 ottobre|il 2 novembre|l'8 ottobre|il 12|il 27|stasera|stamattina|domattina|domani mattina|domani pomeriggio|giovedì mattina|venerdì pomeriggio|sabato mattina|lunedì 6|mercoledì 8|a fine mese|il primo novembre|fra dieci giorni|questo venerdì|questo sabato`.split("|");
const ORE = `alle 7|alle 8|alle 9|alle 10|alle 11|alle 12|alle 14|alle 15|alle 16|alle 17|alle 18|alle 7 e mezza|alle 8 e mezza|alle nove|alle nove e mezza|alle dieci|alle undici|alle tre|alle quattro e un quarto|alle 15:30|alle 9:45|verso le 9|verso le 3|per le 10|nel pomeriggio|in mattinata|di mattina|presto|alle 6 e mezza|a mezzogiorno|dopo pranzo|in serata|alle 21|alle 20:30|tra le 9 e le 10|sul tardi|alle otto meno un quarto`.split("|");
const CARTELLE = ["Fornitori", "Fatture fornitori", "Garanzie", "Cantiere Rossi", "Documenti ditta", "Certificati", "Preventivi vecchi", "Sicurezza", "Manuali", "Personale", "Auto", "Assicurazioni", "Condominio Le Rose", "Foto lavori", "Contratti"];
const tel = () => "3" + tra(20, 49) + " " + tra(100, 999) + " " + tra(1000, 9999);
const mail = (c) => (uno(NOMI) + "." + c.split(" ").pop()).toLowerCase().replace(/[^a-z.]/g, "") + "@" + uno(["gmail.com", "libero.it", "virgilio.it", "outlook.it", "pec.it"]);
const ind = () => uno(VIE) + " " + tra(1, 150) + (forse(0.4) ? " " + uno(CITTA) : "");
const minuscolo = (t) => (forse(0.25) ? t.toLowerCase() : t);
function nuovo(ruolo, vecchio) {
  switch (ruolo) {
    case "CHI": return minuscolo(chi());
    case "LAV": return uno(LAVORI);
    case "GIO": case "NGIO": return uno(GIORNI);
    case "ORA": case "NORA": return uno(ORE);
    case "IND": return ind();
    case "TEL": return tel();
    case "MAIL": return mail(uno(COGNOMI));
    case "CART": return uno(CARTELLE);
    case "NUM": return String(tra(1, 120));
    default: return null; // TESTO, DOC, CAN, AVANZ: restano quelli dello scrittore
  }
}
const dividi = (t) => String(t).replace(/([’'])/g, "$1 ").split(/\s+/).filter(Boolean);
const righe = fs.readFileSync(0, "utf8").trim().split("\n").map((r) => JSON.parse(r));
let n = 0;
for (const x of righe) {
  if (FUORI.some((f) => x.fonte.includes("/" + f + "."))) continue;
  // i pezzi della frase: [ruolo, parole]
  const pezzi = [];
  x.parole.forEach((w, i) => { const r = x.ruoli[i]; if (pezzi.length && pezzi[pezzi.length - 1][0] === r && r !== "O") pezzi[pezzi.length - 1][1].push(w); else pezzi.push([r, [w]]); });
  if (!pezzi.some(([r]) => nuovo(r) !== null)) {
    /* frasi senza pezzi da cambiare (le richieste di una sezione dell'app, 3/10/2026): varianti
       con un saluto o una cortesia davanti o dietro, come le direbbe la gente */
    if (x.intento !== "app") continue;
    const DAVANTI = ["", "", "EON ", "senti ", "ehi EON ", "scusa ", "per favore ", "mi ", "allora ", "ok ", "dai "];
    const DIETRO = ["", "", " per favore", " grazie", " dai", " subito", " please", " EON"];
    for (let k = 0; k < QUANTE; k++) {
      const d = DAVANTI[Math.floor(caso() * DAVANTI.length)], t = DIETRO[Math.floor(caso() * DIETRO.length)];
      const pd = dividi(d), pt = dividi(t);
      const parole = [...pd, ...x.parole, ...pt], ruoli = [...pd.map(() => "O"), ...x.ruoli, ...pt.map(() => "O")];
      n++;
      console.log(JSON.stringify({ fonte: x.fonte + "#v", frase: parole.join(" ").replace(/([’']) /g, "$1"), intento: x.intento, ...(x.tema ? { tema: x.tema } : {}), parole, ruoli }));
    }
    continue;
  }
  for (let k = 0; k < QUANTE; k++) {
    const parole = [], ruoli = [];
    for (const [r, pp] of pezzi) {
      const v = r !== "O" && forse(0.85) ? nuovo(r, pp) : null;
      const ww = v ? dividi(v) : pp;
      ww.forEach((w) => { parole.push(w); ruoli.push(r); });
    }
    n++;
    console.log(JSON.stringify({ fonte: x.fonte + "#v", frase: parole.join(" ").replace(/([’']) /g, "$1"), intento: x.intento, ...(x.tema ? { tema: x.tema } : {}), parole, ruoli }));
  }
}
console.error(`frasi variate: ${n}`);
