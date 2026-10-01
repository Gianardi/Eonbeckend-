"""Passo A (1/10/2026): il modello che legge TUTTA la frase. Un piccolo transformer con due uscite:
- il CASSETTO della frase (cosa chiede: impegno, fattura, messaggio…), come il modello di oggi;
- il RUOLO di ogni parola (CHI, GIO, ORA, NGIO, NORA, LAV, TESTO, CAN, DOC, NUM, TEL, MAIL, IND,
  AVANZ, CART; O = niente). Gli importi restano al modello dei dettagli.
Il codice poi normalizza quello che il modello ha trovato ("giovedì" → la data, il nome → il
cliente in rubrica): niente regole per capire.

Dati: le frasi segnate dagli scrittori (dati/scritte.jsonl: cassetto + ruoli) e le ~56 mila frasi
dei cassetti di oggi (eval/neurale/dati/allenamento.jsonl: solo il cassetto, i ruoli non contano).
Prova a parte: gli scrittori in TIENI_FUORI (mai in allenamento) e, per il cassetto, i giri 16-20.

Uso: python3 eval/neurale/lettura/allena.py [--salva]   (env: D, STRATI, FF, EPOCHE, SEME, TIENI_FUORI=s12)
"""
import json, math, os, random, sys, time, base64, re
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from tokenizers import Tokenizer, models, pre_tokenizers, trainers

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.abspath(os.path.join(QUI, "..", "..", ".."))
SALVA = "--salva" in sys.argv
SEME = int(os.environ.get("SEME", "7"))
random.seed(SEME); np.random.seed(SEME); torch.manual_seed(SEME)
torch.set_num_threads(int(os.environ.get("THREADS", "4")))

RUOLI = ["O", "CHI", "GIO", "ORA", "NGIO", "NORA", "LAV", "TESTO", "CAN", "DOC", "NUM", "TEL", "MAIL", "IND", "AVANZ", "CART"]
CASSETTI = ["calendario", "calendario_modifica", "mente", "documento", "cerca_documento", "invio_documento", "messaggio", "email", "chiamata", "cliente", "dati", "domanda", "incasso", "foto", "cartella", "urgenza", "sal", "dico", "assemblea", "saluto", "accettato", "sollecito"]
R = {r: i for i, r in enumerate(RUOLI)}; C = {c: i for i, c in enumerate(CASSETTI)}
leggi = lambda f: [json.loads(r) for r in open(f) if r.strip()]

# parole come in verifica.mjs (spazi e apostrofi), minuscole
def dividi(t): return [w for w in re.sub(r"([’'])", r"\1 ", str(t)).split() if w]
def norm(w): return w.lower().replace("’", "'")

scritte = leggi(os.path.join(QUI, "dati", "scritte.jsonl"))
FUORI = set(x for x in os.environ.get("TIENI_FUORI", "s12").split(",") if x)
fuori = lambda x: any(("/" + f + ".") in x["fonte"] for f in FUORI)
prova_ruoli = [x for x in scritte if fuori(x)]
segnate = [x for x in scritte if not fuori(x)]
solo_cassetto = [{"parole": dividi(x["frase"]), "intento": x["intento"]} for x in leggi(os.path.join(RADICE, "eval", "neurale", "dati", "allenamento.jsonl")) if x["intento"] in C]
# esame del cassetto: i giri 16-20 (frasi d'esame: solo per misurare)
DA_CAT = {"risorsa": "cerca_documento", "foto": "cerca_documento", "foto_scatta": "foto", "invio": "invio_documento", "ai": "domanda", "risposta": "saluto", "calendario": "calendario", "calendario_modifica": "calendario_modifica"}
esame = []
for g in (16, 17, 18, 19, 20):
    f = os.path.join(RADICE, "eval", "dati", "frasi-giro%d.json" % g)
    if not os.path.exists(f): continue
    j = json.load(open(f))
    for mest in (j.get("mestieri") or {}).values():
        for fr in mest.get("frasi", []):
            cat = DA_CAT.get(fr[1], fr[1])
            if cat in C: esame.append({"parole": dividi(fr[0]), "intento": cat})

# ---------- Vocabolario ----------
SPECIALI = ["[PAD]", "[UNK]", "[CLS]", "[MASK]"]
tok = Tokenizer(models.WordPiece(unk_token="[UNK]", max_input_chars_per_word=40))
tok.pre_tokenizer = pre_tokenizers.WhitespaceSplit()
trainer = trainers.WordPieceTrainer(vocab_size=int(os.environ.get("VOCAB", "8000")), min_frequency=2, special_tokens=SPECIALI, continuing_subword_prefix="##")
tok.train_from_iterator([" ".join(norm(w) for w in x["parole"]) for x in segnate + solo_cassetto], trainer)
VOC = tok.get_vocab(); V = len(VOC); MAXLEN = 64
cache = {}
def pezzi_parola(w):
    w = norm(w)
    if w not in cache: cache[w] = tok.encode(w).ids or [VOC["[UNK]"]]
    return cache[w]
def codifica(parole):
    ids, primi = [VOC["[CLS]"]], []
    for w in parole:
        p = pezzi_parola(w)
        if len(ids) + len(p) > MAXLEN: break
        primi.append(len(ids)); ids.extend(p)
    return ids, primi
def sporca(parole, ruoli):
    """dettatura: qualche parola persa o storpiata (mai una parola segnata intera)"""
    ps, rs = [], []
    for w, r in zip(parole, ruoli):
        x = random.random()
        if x < 0.03 and len(parole) > 4 and r == "O": continue
        if x < 0.08 and len(w) > 4:
            j = random.randrange(1, len(w) - 1)
            w = w[:j] + w[j + 1:] if random.random() < 0.5 else w[:j] + w[j + 1] + w[j] + w[j + 2:]
        ps.append(w); rs.append(r)
    return ps, rs

# ---------- Il modello ----------
D, STRATI, TESTE, FF = int(os.environ.get("D", "128")), int(os.environ.get("STRATI", "3")), 4, int(os.environ.get("FF", "256"))
class Strato(nn.Module):
    def __init__(s):
        super().__init__()
        s.qkv = nn.Linear(D, 3 * D); s.o = nn.Linear(D, D)
        s.ln1 = nn.LayerNorm(D); s.ln2 = nn.LayerNorm(D)
        s.f1 = nn.Linear(D, FF); s.f2 = nn.Linear(FF, D)
        s.drop = nn.Dropout(0.1)
    def forward(s, x, maschera):
        B, T, _ = x.shape
        h = s.ln1(x)
        q, k, v = s.qkv(h).view(B, T, 3, TESTE, D // TESTE).permute(2, 0, 3, 1, 4)
        att = (q @ k.transpose(-1, -2)) / math.sqrt(D // TESTE)
        att = att.masked_fill(~maschera[:, None, None, :], -1e9).softmax(-1)
        y = (att @ v).transpose(1, 2).reshape(B, T, D)
        x = x + s.drop(s.o(y))
        return x + s.drop(s.f2(F.gelu(s.f1(s.ln2(x)))))
class Modello(nn.Module):
    def __init__(s):
        super().__init__()
        s.emb = nn.Embedding(V, D); s.pos = nn.Embedding(MAXLEN, D)
        s.strati = nn.ModuleList([Strato() for _ in range(STRATI)])
        s.ln = nn.LayerNorm(D)
        s.out = nn.Linear(D, len(CASSETTI))   # il cassetto (media delle parole, come il modello di oggi)
        s.outR = nn.Linear(D, len(RUOLI))     # il ruolo di ogni parola
        s.drop = nn.Dropout(0.1)
    def forward(s, ids, maschera):
        x = s.drop(s.emb(ids) + s.pos(torch.arange(ids.shape[1])[None]))
        for st in s.strati: x = st(x, maschera)
        x = s.ln(x)
        m = maschera.float()[..., None]
        media = (x * m).sum(1) / m.sum(1)
        return s.out(media), s.outR(x)

def lotto(esempi, rumore):
    seq, pos, lab, cas = [], [], [], []
    for x in esempi:
        pr, rl = x["parole"], x.get("ruoli")
        if rumore: pr, rl = sporca(pr, rl or ["O"] * len(pr))
        ids, primi = codifica(pr)
        seq.append(ids); pos.append(primi); cas.append(C[x["intento"]])
        lab.append([R[r] for r in rl[:len(primi)]] if x.get("ruoli") else None)
    T = max(len(q) for q in seq)
    ids = torch.zeros(len(seq), T, dtype=torch.long)
    y = torch.full((len(seq), T), -100, dtype=torch.long)
    for i, (q, p, l) in enumerate(zip(seq, pos, lab)):
        ids[i, :len(q)] = torch.tensor(q)
        if l is not None:
            for j, k in enumerate(p): y[i, k] = l[j]
    return ids, ids != 0, y, torch.tensor(cas), pos

def predici(esempi):
    modello.eval(); out = []
    with torch.no_grad():
        for i in range(0, len(esempi), 256):
            b = esempi[i:i + 256]
            ids, m, _, _, pos = lotto(b, False)
            zc, zr = modello(ids, m)
            pc, pr = F.softmax(zc, -1), F.softmax(zr, -1)
            for k, x in enumerate(b):
                ruoli = [RUOLI[int(pr[k, pos[k][j]].argmax())] if j < len(pos[k]) else "O" for j in range(len(x["parole"]))]
                out.append({"intento": CASSETTI[int(pc[k].argmax())], "p": float(pc[k].max()), "ruoli": ruoli})
    return out
def pezzi_di(parole, ruoli):
    """i pezzi (ruolo, parole) di una frase: parole vicine con lo stesso ruolo = un pezzo"""
    out, prima = [], "O"
    for w, r in zip(parole, ruoli):
        if r != "O":
            if r == prima: out[-1][1].append(norm(w))
            else: out.append((r, [norm(w)]))
        prima = r
    return [(r, " ".join(p)) for r, p in out]
def misura(esempi, con_ruoli):
    pr = predici(esempi)
    cas = sum(p["intento"] == x["intento"] for x, p in zip(esempi, pr)) / max(1, len(esempi))
    if not con_ruoli: return cas, None, None
    giusti = tot_oro = tot_pred = 0; frasi = 0
    for x, p in zip(esempi, pr):
        oro, pred = set(pezzi_di(x["parole"], x["ruoli"])), set(pezzi_di(x["parole"], p["ruoli"]))
        giusti += len(oro & pred); tot_oro += len(oro); tot_pred += len(pred); frasi += oro == pred
    f1 = 2 * giusti / max(1, tot_oro + tot_pred)
    return cas, f1, frasi / max(1, len(esempi))

modello = Modello()
print(f"Frasi segnate {len(segnate)} (+ {len(prova_ruoli)} tenute fuori), solo cassetto {len(solo_cassetto)}, esame cassetti {len(esame)}; vocabolario {V}, parametri {sum(p.numel() for p in modello.parameters()):,}", flush=True)
conta = np.bincount([R[r] for x in segnate for r in x["ruoli"]], minlength=len(RUOLI)) + 1
pesi = torch.tensor(np.clip((conta.sum() / len(RUOLI)) / conta, 0.3, 2.0), dtype=torch.float)
BS, EPOCHE = 64, int(os.environ.get("EPOCHE", "10"))
RIPETI = int(os.environ.get("RIPETI", "4"))  # le frasi segnate sono poche: si ripetono a ogni epoca
passi = EPOCHE * math.ceil((len(solo_cassetto) + RIPETI * len(segnate)) / BS)
opt = torch.optim.AdamW(modello.parameters(), lr=2e-3, weight_decay=0.01)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=passi, pct_start=0.1)
t0 = time.time()
for ep in range(EPOCHE):
    modello.train(); dati = solo_cassetto + segnate * RIPETI; random.shuffle(dati); tot = 0
    for i in range(0, len(dati), BS):
        ids, m, y, c, _ = lotto(dati[i:i + BS], True)
        zc, zr = modello(ids, m)
        perdita = F.cross_entropy(zc, c)
        if (y != -100).any(): perdita = perdita + F.cross_entropy(zr.reshape(-1, len(RUOLI)), y.reshape(-1), weight=pesi, ignore_index=-100)
        opt.zero_grad(); perdita.backward(); nn.utils.clip_grad_norm_(modello.parameters(), 1.0); opt.step(); sched.step()
        tot += perdita.item()
    cf, f1, fi = misura(prova_ruoli, True) if prova_ruoli else (0, 0, 0)
    ce, _, _ = misura(esame, False) if esame else (0, None, None)
    print(f"epoca {ep + 1}: perdita {tot / math.ceil(len(dati) / BS):.4f} · scrittori tenuti fuori: cassetto {cf:.3f}, pezzi F1 {f1:.3f}, frasi intere {fi:.3f} · giri 16-20 cassetto {ce:.3f} · {time.time() - t0:.0f}s", flush=True)

if os.environ.get("ERRORI"):
    with open(os.environ["ERRORI"], "w") as f:
        for x, p in zip(prova_ruoli, predici(prova_ruoli)):
            if pezzi_di(x["parole"], x["ruoli"]) != pezzi_di(x["parole"], p["ruoli"]) or x["intento"] != p["intento"]:
                f.write(json.dumps({"frase": x["frase"], "intento": [x["intento"], p["intento"]], "oro": pezzi_di(x["parole"], x["ruoli"]), "letto": pezzi_di(x["parole"], p["ruoli"])}, ensure_ascii=False) + "\n")

if SALVA:
    sd = {k: v.detach().numpy() for k, v in modello.state_dict().items()}
    pz = {}
    for nome, a in sd.items():
        if a.ndim == 2:
            sc = np.maximum(np.abs(a).max(1, keepdims=True) / 127, 1e-8)
            q = np.clip(np.round(a / sc), -127, 127).astype(np.int8)
            pz[nome] = {"forma": list(a.shape), "q": base64.b64encode(q.tobytes()).decode(), "scala": [round(float(x), 8) for x in sc[:, 0]]}
        else:
            pz[nome] = {"forma": list(a.shape), "v": [round(float(x), 6) for x in a.ravel()]}
    vocab = sorted(VOC.items(), key=lambda kv: kv[1])
    out = {"versione": time.strftime("%Y-%m-%d"), "tipo": "transformer", "intenti": CASSETTI, "ruoli": RUOLI, "minuscolo": True,
           "D": D, "strati": STRATI, "teste": TESTE, "ff": FF, "maxlen": MAXLEN, "vocab": [w for w, _ in vocab], "pesi": pz}
    f = os.path.join(RADICE, os.environ.get("USCITA", "modello-lettura.json"))
    json.dump(out, open(f, "w"), separators=(",", ":"))
    print(f"Salvato {os.path.basename(f)} ({os.path.getsize(f) / 1024:.0f} KB)")
