/* Test del meteo lato server (26/09/2026) — SENZA rete: esegue il vero
   handler di api/index.js con OpenStreetMap e MET Norway simulati, nel
   formato vero delle loro risposte.

   Controlla: luogo → coordinate → previsioni del giorno giusto (oggi,
   domani) nel fuso italiano; minima/massima, pioggia, vento, cielo in
   italiano; User-Agent sempre presente (MET lo richiede); luogo che non
   esiste e giorno troppo lontano spiegati; lo strumento "meteo" c'è
   anche per l'AI.

   Uso:  node eval/meteo.test.mjs */

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

const U = process.env.SUPABASE_URL;
const chiamate = [];
const fmt = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const ora = (d) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hour12: false }).format(d)) % 24;

// Previsioni finte: oggi sereno 14-24 °C; domani pioggia dalle 10 alle 16 (1,5 mm/ora), vento fino a 10 m/s
function serieFinta() {
  const inizio = new Date(); inizio.setUTCMinutes(0, 0, 0);
  const domani = fmt(new Date(Date.now() + 86400000));
  const serie = [];
  for (let i = 0; i < 60; i++) {
    const t = new Date(inizio.getTime() + i * 3600000);
    const h = ora(t), eDomani = fmt(t) === domani;
    const piove = eDomani && h >= 10 && h <= 16;
    serie.push({ time: t.toISOString(), data: {
      instant: { details: { air_temperature: 14 + 10 * Math.sin(Math.max(0, (h - 6)) / 16 * Math.PI) - (eDomani ? 3 : 0), wind_speed: eDomani ? (h === 13 ? 10 : 4) : 2 } },
      next_1_hours: { summary: { symbol_code: piove ? "rain" : (eDomani ? "cloudy" : "clearsky_day") }, details: { precipitation_amount: piove ? 1.5 : 0 } },
      next_6_hours: { summary: { symbol_code: piove ? "rain" : "clearsky_day" }, details: { precipitation_amount: piove ? 9 : 0 } },
    } });
  }
  return serie;
}

globalThis.fetch = async (url, init = {}) => {
  const s = String(url);
  chiamate.push({ url: s, ua: init.headers && init.headers["User-Agent"] });
  if (s.startsWith(U + "/auth/v1/user")) return new Response(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" }), { status: 200 });
  if (s.startsWith("https://nominatim.openstreetmap.org/search")) {
    const q = new URL(s).searchParams.get("q");
    if (/pisa/i.test(q)) return new Response(JSON.stringify([{ lat: "43.7166", lon: "10.4037", name: "Pisa", display_name: "Pisa, Toscana, Italia" }]), { status: 200 });
    return new Response("[]", { status: 200 });
  }
  if (s.startsWith("https://nominatim.openstreetmap.org/reverse")) return new Response(JSON.stringify({ address: { town: "Lerici", county: "La Spezia" } }), { status: 200 });
  if (s.startsWith("https://api.met.no/weatherapi/locationforecast/2.0/compact")) return new Response(JSON.stringify({ properties: { timeseries: serieFinta() } }), { status: 200 });
  throw new Error("fetch non prevista nel test: " + s);
};

const mod = await import("../api/index.js");
const handler = mod.default;
async function chiama(query) {
  const req = { method: "GET", url: "/api?action=meteo&" + query, headers: { authorization: "Bearer token-finto" } };
  let uscita = "";
  const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: uscita ? JSON.parse(uscita) : null };
}

let falliti = 0;
function verifica(descrizione, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${descrizione}${condizione || dettaglio === undefined ? "" : "  — " + dettaglio}`);
  if (!condizione) falliti++;
}

let r = await chiama("luogo=Pisa&giorno=oggi");
verifica("oggi a Pisa: sereno, minima e massima, niente pioggia", r.status === 200 && r.corpo.luogo === "Pisa" && r.corpo.cielo === "Sereno" && r.corpo.massima >= 22 && r.corpo.minima <= 16 && r.corpo.pioggia_mm === 0, JSON.stringify(r));
verifica("il giorno è quello italiano", r.corpo.giorno === fmt(new Date()), r.corpo.giorno);
const metChiamate = chiamate.filter((c) => /api\.met\.no|nominatim/.test(c.url));
verifica("coordinate di Pisa passate a MET, User-Agent sempre presente", metChiamate.some((c) => /lat=43\.7166&lon=10\.4037/.test(c.url)) && metChiamate.every((c) => /^EON\//.test(c.ua || "")), JSON.stringify(metChiamate));

r = await chiama("luogo=Pisa&giorno=domani");
verifica("domani: pioggia (7 ore × 1,5 mm), cielo \"Pioggia\", vento in km/h", r.status === 200 && r.corpo.cielo === "Pioggia" && r.corpo.categoria === "pioggia" && Math.abs(r.corpo.pioggia_mm - 10.5) < 0.01 && r.corpo.vento_max_kmh === 36, JSON.stringify(r.corpo));
verifica("domani: le ore della giornata (8, 11, 14, 17) con temperatura", Array.isArray(r.corpo.ore) && r.corpo.ore.map((o) => o.ora).join(",") === "08:00,11:00,14:00,17:00" && r.corpo.ore[1].cielo === "pioggia", JSON.stringify(r.corpo.ore));

chiamate.length = 0;
r = await chiama("lat=44.1&lon=9.82&giorno=oggi");
verifica("dalla posizione del telefono: previsioni lì, e il nome del paese nel titolo", r.status === 200 && r.corpo.luogo === "Lerici" && !chiamate.some((c) => /nominatim\.openstreetmap\.org\/search/.test(c.url)) && chiamate.some((c) => /lat=44\.1000&lon=9\.8200/.test(c.url)), JSON.stringify({ r, chiamate }));

r = await chiama("luogo=Paeseinesistente");
verifica("luogo che non esiste: spiegato", r.status === 404 && /Non trovo il luogo/.test(r.corpo.error), JSON.stringify(r));
const traDieci = fmt(new Date(Date.now() + 10 * 86400000));
r = await chiama("luogo=Pisa&giorno=" + traDieci);
verifica("giorno troppo lontano: spiegato", r.status === 404 && /9 giorni/.test(r.corpo.error), JSON.stringify(r));

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
