/* Il modello neurale di EON nel telefono (30/09/2026).
   Un piccolo transformer (come quelli degli assistenti delle grandi aziende,
   in miniatura) che dalla frase capisce il "cassetto": appuntamento,
   preventivo, messaggio... Gira tutto nel telefono, senza internet, in pochi
   millisecondi. Pesi a 1 byte (modello-neurale.json), allenati con
   eval/neurale/allena.py; qui solo la lettura (niente librerie).
   La frase arriva già "in segni" (EonLettore.segni): parole normalizzate,
   <tempo> <soldi> <tel> <num> al posto di giorni/ore, cifre, telefoni. */
(function (root) {
  "use strict";
  let M = null;

  function base64InInt8(s) {
    const bin = typeof Buffer !== "undefined" ? Buffer.from(s, "base64") : Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    return new Int8Array(bin.buffer, bin.byteOffset, bin.length);
  }
  /* Una matrice [righe x colonne] a 1 byte con una scala per riga → Float32 */
  function matrice(p) {
    const [r, c] = p.forma, q = base64InInt8(p.q), m = new Float32Array(r * c);
    for (let i = 0; i < r; i++) { const s = p.scala[i]; for (let j = 0; j < c; j++) m[i * c + j] = q[i * c + j] * s; }
    return m;
  }
  function carica(json) {
    if (!json || json.tipo !== "transformer") { M = null; return false; }
    const P = json.pesi, D = json.D;
    const w = (n) => matrice(P[n]), v = (n) => Float32Array.from(P[n].v);
    const strati = [];
    for (let l = 0; l < json.strati; l++) {
      const s = "strati." + l + ".";
      strati.push({ qkv: w(s + "qkv.weight"), qkvB: v(s + "qkv.bias"), o: w(s + "o.weight"), oB: v(s + "o.bias"),
        ln1g: v(s + "ln1.weight"), ln1b: v(s + "ln1.bias"), ln2g: v(s + "ln2.weight"), ln2b: v(s + "ln2.bias"),
        f1: w(s + "f1.weight"), f1B: v(s + "f1.bias"), f2: w(s + "f2.weight"), f2B: v(s + "f2.bias") });
    }
    const vocab = new Map(json.vocab.map((t, i) => [t, i]));
    M = { D, H: json.teste, FF: json.ff, maxlen: json.maxlen, intenti: json.intenti, T: json.temperatura || 1, vocab,
      emb: w("emb.weight"), pos: w("pos.weight"), strati, lng: v("ln.weight"), lnb: v("ln.bias"), out: w("out.weight"), outB: v("out.bias"), versione: json.versione };
    return true;
  }

  /* WordPiece: per ogni parola il pezzo più lungo che c'è nel vocabolario, poi "##resto" */
  function pezzi(testo) {
    const ids = [M.vocab.get("[CLS]")], UNK = M.vocab.get("[UNK]");
    for (const parola of String(testo || "").split(/\s+/).filter(Boolean)) {
      if (M.vocab.has(parola)) { ids.push(M.vocab.get(parola)); continue; }
      if (parola.length > 40) { ids.push(UNK); continue; }
      const suoi = [];
      let inizio = 0, rotta = false;
      while (inizio < parola.length) {
        let fine = parola.length, trovato = -1;
        while (fine > inizio) {
          const pezzo = (inizio > 0 ? "##" : "") + parola.slice(inizio, fine);
          if (M.vocab.has(pezzo)) { trovato = M.vocab.get(pezzo); break; }
          fine--;
        }
        if (trovato < 0) { rotta = true; break; }
        suoi.push(trovato); inizio = fine;
      }
      if (rotta) ids.push(UNK); else ids.push(...suoi);
    }
    return ids.slice(0, M.maxlen);
  }

  // y[T x out] = x[T x in] · Wᵀ + b   (W come in PyTorch: [out x in])
  function lineare(x, T, inp, W, b, out) {
    const y = new Float32Array(T * out);
    for (let t = 0; t < T; t++) for (let o = 0; o < out; o++) {
      let s = b[o]; const wo = o * inp, xt = t * inp;
      for (let i = 0; i < inp; i++) s += x[xt + i] * W[wo + i];
      y[t * out + o] = s;
    }
    return y;
  }
  function normaStrato(x, T, D, g, b) {
    const y = new Float32Array(T * D);
    for (let t = 0; t < T; t++) {
      let m = 0; for (let i = 0; i < D; i++) m += x[t * D + i]; m /= D;
      let v = 0; for (let i = 0; i < D; i++) { const d = x[t * D + i] - m; v += d * d; } v /= D;
      const r = 1 / Math.sqrt(v + 1e-5);
      for (let i = 0; i < D; i++) y[t * D + i] = (x[t * D + i] - m) * r * g[i] + b[i];
    }
    return y;
  }
  // GELU esatta (come PyTorch): x·Φ(x), con erf approssimata (errore < 2e-7)
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  }
  const gelu = (x) => 0.5 * x * (1 + erf(x / Math.SQRT2));

  /* La probabilità di ogni cassetto per la frase (già in segni) */
  function probabilita(segni) {
    if (!M) return null;
    const ids = pezzi(segni), T = ids.length, D = M.D, H = M.H, dh = D / H;
    let x = new Float32Array(T * D);
    for (let t = 0; t < T; t++) for (let i = 0; i < D; i++) x[t * D + i] = M.emb[ids[t] * D + i] + M.pos[t * D + i];
    for (const s of M.strati) {
      const h = normaStrato(x, T, D, s.ln1g, s.ln1b);
      const qkv = lineare(h, T, D, s.qkv, s.qkvB, 3 * D);
      const y = new Float32Array(T * D);
      const sc = 1 / Math.sqrt(dh), att = new Float32Array(T);
      for (let hd = 0; hd < H; hd++) for (let t = 0; t < T; t++) {
        let m = -Infinity;
        for (let u = 0; u < T; u++) {
          let s2 = 0; for (let j = 0; j < dh; j++) s2 += qkv[t * 3 * D + hd * dh + j] * qkv[u * 3 * D + D + hd * dh + j];
          att[u] = s2 * sc; if (att[u] > m) m = att[u];
        }
        let tot = 0; for (let u = 0; u < T; u++) { att[u] = Math.exp(att[u] - m); tot += att[u]; }
        for (let j = 0; j < dh; j++) { let a = 0; for (let u = 0; u < T; u++) a += att[u] * qkv[u * 3 * D + 2 * D + hd * dh + j]; y[t * D + hd * dh + j] = a / tot; }
      }
      const o = lineare(y, T, D, s.o, s.oB, D);
      for (let i = 0; i < x.length; i++) x[i] += o[i];
      const h2 = normaStrato(x, T, D, s.ln2g, s.ln2b);
      const f = lineare(h2, T, D, s.f1, s.f1B, M.FF);
      for (let i = 0; i < f.length; i++) f[i] = gelu(f[i]);
      const f2 = lineare(f, T, M.FF, s.f2, s.f2B, D);
      for (let i = 0; i < x.length; i++) x[i] += f2[i];
    }
    const xn = normaStrato(x, T, D, M.lng, M.lnb);
    const media = new Float32Array(D);
    for (let t = 0; t < T; t++) for (let i = 0; i < D; i++) media[i] += xn[t * D + i] / T;
    const z = lineare(media, 1, D, M.out, M.outB, M.intenti.length);
    let m = -Infinity; for (const v of z) m = Math.max(m, v / M.T);
    let tot = 0; const p = Array.from(z, (v) => { const e = Math.exp(v / M.T - m); tot += e; return e; });
    return p.map((v) => v / tot);
  }
  /* Come EonLettore.classifica: { intento, p, secondo, p2 } */
  function classifica(segni) {
    const p = probabilita(segni);
    if (!p) return null;
    const ordine = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    return { intento: M.intenti[ordine[0][1]], p: ordine[0][0], secondo: M.intenti[ordine[1][1]], p2: ordine[1][0] };
  }

  const EonNeurale = { carica, classifica, probabilita, pezzi, pronto: () => !!M, versione: () => (M ? M.versione : null) };
  if (typeof module !== "undefined" && module.exports) module.exports = EonNeurale;
  else root.EonNeurale = EonNeurale;
})(typeof window !== "undefined" ? window : globalThis);
