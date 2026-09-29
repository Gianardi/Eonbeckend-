/* Avviso "credito dell'AI finito" (29/09/2026): Andrea ha ricaricato ma
   l'avviso restava per 24 ore. Ora si spegne appena l'ultima richiesta
   all'AI va a buon fine. Prova la funzione del server con un finto
   registro delle richieste (solo errore e ora, mai i messaggi).
   Uso: node eval/credito-ricaricato.test.js */
const fs = require("fs");
const path = require("path");

const sorgente = fs.readFileSync(path.join(__dirname, "..", "api", "index.js"), "utf8");
const corpo = sorgente.match(/async function creditoAIFinito\(\) \{[\s\S]*?\n\}/)[0];
let fallimenti = 0;
function verifica(nome, ok, dettaglio) {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${nome}${ok || !dettaglio ? "" : " — " + dettaglio}`);
  if (!ok) fallimenti++;
}
// registro: dal più recente al più vecchio
function conRegistro(registro) {
  const servizio = async (percorso) => {
    if (/limit=1$/.test(percorso)) return registro.slice(0, 1);
    return registro.filter((r) => /credito/i.test(r.errore || ""));
  };
  return new Function("servizio", corpo + "; return creditoAIFinito;")(servizio);
}
const ERR = "Credito dell'AI esaurito: ricaricalo su console.anthropic.com (Plans & Billing), poi riprova";
const ora = (min) => new Date(Date.now() - min * 60000).toISOString();

(async () => {
  let r = await conRegistro([{ created_at: ora(1), errore: ERR }, { created_at: ora(5), errore: ERR }])();
  verifica("credito finito adesso: l'avviso c'è (con il conto)", r && r.volte === 2, JSON.stringify(r));
  r = await conRegistro([{ created_at: ora(1), errore: null }, { created_at: ora(60), errore: ERR }, { created_at: ora(90), errore: ERR }])();
  verifica("dopo la ricarica la prima risposta buona spegne l'avviso", r === null, JSON.stringify(r));
  r = await conRegistro([{ created_at: ora(1), errore: "Timeout" }, { created_at: ora(60), errore: ERR }])();
  verifica("un altro errore (non di credito) non accende l'avviso", r === null, JSON.stringify(r));
  r = await conRegistro([])();
  verifica("nessuna richiesta: nessun avviso", r === null, JSON.stringify(r));
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
})();
