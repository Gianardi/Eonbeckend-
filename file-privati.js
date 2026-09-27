/* File privati di EON (27/09/2026) — usato dall'app (index.html) e dalla
   pagina del cliente (cliente.html).

   Lo spazio file (bucket eon-files) è privato, come in Google Drive o
   Dropbox: l'indirizzo salvato negli archivi (…/object/public/eon-files/…)
   non apre più niente da solo. Qui ogni foto, video, vocale o documento
   mostrato nella pagina riceve un link che scade, chiesto al server
   (che controlla chi lo chiede). Un solo "guardiano" per tutta la pagina:
   qualsiasi <img>, <video>, <audio>, <source>, <a> con un file di EON viene
   sistemato da solo, senza toccare ogni punto dell'app.

   La pagina dice come chiedere i link: EonFile.imposta(async (urls, durata) =>
   ({ firmati: { url: linkFirmato }, scade_tra: secondi })). */
(function () {
  var FILE_EON = /\/storage\/v1\/object\/public\/eon-files\//;
  var ATTR = { IMG: "src", VIDEO: "src", AUDIO: "src", SOURCE: "src", A: "href", IFRAME: "src", EMBED: "src" };
  var cache = new Map();      // indirizzo salvato → { url, scade }
  var inAttesa = new Map();   // indirizzo salvato → [risolvi…]
  var timer = null;
  var chiedi = null;          // la funzione della pagina che chiede i link al server

  function eFile(u) { return typeof u === "string" && FILE_EON.test(u); }
  function pronto(u) { var f = cache.get(u); return f && f.scade > Date.now() + 60000 ? f.url : null; }

  async function mandaLotto() {
    timer = null;
    if (!chiedi) return; // la pagina non è ancora pronta: si parte quando chiama imposta()
    var lotto = new Map(inAttesa); inAttesa.clear();
    var urls = Array.from(lotto.keys());
    var firmati = {}, durata = 3600;
    if (chiedi && urls.length) {
      try { var r = await chiedi(urls, "app"); firmati = (r && r.firmati) || {}; durata = (r && r.scade_tra) || 3600; } catch (e) { /* rete assente: si riprova al prossimo giro */ }
    }
    lotto.forEach(function (attese, u) {
      var f = firmati[u];
      if (f) cache.set(u, { url: f, scade: Date.now() + durata * 1000 });
      attese.forEach(function (ok) { ok(f || null); });
    });
  }
  /* Il link che scade per un file (null se non si può avere) */
  function firma(u) {
    if (!eFile(u)) return Promise.resolve(u);
    var p = pronto(u);
    if (p) return Promise.resolve(p);
    return new Promise(function (ok) {
      if (!inAttesa.has(u)) inAttesa.set(u, []);
      inAttesa.get(u).push(ok);
      if (!timer) timer = setTimeout(mandaLotto, 25); // un solo viaggio al server per tutte le foto della pagina
    });
  }
  /* Link da mandare a qualcuno (WhatsApp, email): dura di più (7 giorni) */
  async function perCondividere(u) {
    if (!eFile(u) || !chiedi) return u;
    try { var r = await chiedi([u], "condivisione"); return (r && r.firmati && r.firmati[u]) || u; } catch (e) { return u; }
  }
  /* Apre un file in una scheda nuova: la finestra si apre subito (così vale
     il tocco dell'utente), l'indirizzo arriva appena firmato. */
  function apri(u) {
    if (!eFile(u)) { window.open(u, "_blank"); return; }
    var p = pronto(u);
    if (p) { window.open(p, "_blank"); return; }
    var w = window.open("", "_blank");
    firma(u).then(function (f) {
      if (!f) { if (w) w.close(); return; }
      if (w) w.location.href = f; else window.location.href = f;
    });
  }

  function sistema(el) {
    var attr = ATTR[el.tagName];
    if (!attr) return;
    var v = el.getAttribute(attr);
    if (!eFile(v)) return;
    el.setAttribute("data-file-eon", v);
    var p = pronto(v);
    if (p) { el.setAttribute(attr, p); return; }
    if (attr === "src") el.removeAttribute("src"); // niente richiesta all'indirizzo che non apre più
    firma(v).then(function (f) { if (f && el.getAttribute("data-file-eon") === v) el.setAttribute(attr, f); });
  }
  function scansiona(n) {
    if (!n || n.nodeType !== 1) return;
    if (ATTR[n.tagName]) sistema(n);
    if (n.querySelectorAll) n.querySelectorAll("img,video,audio,source,a,iframe,embed").forEach(sistema);
  }
  new MutationObserver(function (lista) {
    lista.forEach(function (m) {
      if (m.type === "attributes") sistema(m.target);
      else m.addedNodes.forEach(scansiona);
    });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "href"] });

  /* Un link <a> toccato prima che il suo indirizzo firmato sia arrivato:
     si apre con apri(), che aspetta il link giusto. */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[data-file-eon]") : null;
    if (!a || !eFile(a.getAttribute("href"))) return;
    e.preventDefault();
    apri(a.getAttribute("data-file-eon"));
  }, true);

  /* Un link dura un'ora: ogni 40 minuti si rinnovano quelli ancora in pagina */
  setInterval(function () {
    var el = document.querySelectorAll("[data-file-eon]");
    if (!el.length) return;
    cache.clear();
    el.forEach(function (e) {
      var v = e.getAttribute("data-file-eon"), attr = ATTR[e.tagName];
      firma(v).then(function (f) { if (f && e.getAttribute("data-file-eon") === v) e.setAttribute(attr, f); });
    });
  }, 40 * 60 * 1000);

  /* Un file appena caricato da questo telefono: finché la pagina è aperta
     si mostra la copia che è già qui (subito, senza aspettare il server) */
  function anteprima(u, locale) {
    if (eFile(u) && locale) cache.set(u, { url: locale, scade: Date.now() + 30 * 60 * 1000 });
  }

  window.EonFile = {
    anteprima: anteprima,
    imposta: function (fn) {
      chiedi = fn;
      scansiona(document.documentElement);
      if (inAttesa.size && !timer) timer = setTimeout(mandaLotto, 0);
    },
    firma: firma,
    perCondividere: perCondividere,
    apri: apri,
    eFile: eFile,
  };
})();
