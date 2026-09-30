"""Passo 4 (30/09/2026): il modello dei DETTAGLI. Un piccolo transformer che, per ogni
parola della frase, dice che ruolo ha: O (niente), QTA (quantità), PRZ (prezzo a pezzo),
TOT (totale di una voce), ANN (numero annullato: "12, eh no 15"), PERC e BASE (l'acconto:
"il 30 per cento su 10.000"), SCO / SCOV (sconto in percentuale / in euro).
Il conto lo fa poi il codice (lettore.js, componiImporti): il modello non fa aritmetica.

Come la "token classification" dei modelli tipo BERT: vocabolario WordPiece, ogni parola
guarda tutta la frase; si legge il primo pezzo di ogni parola.

Dati: frasi del generatore (genera.mjs, verificate col conto) ± frasi degli scrittori.
Esame: i preventivi e le fatture dei giri (esame.mjs), MAI in allenamento.

Uso: python3 eval/neurale/dettagli/allena.py allenamento.jsonl [altri.jsonl] [--salva]
     RUOLI_OUT=file  scrive i ruoli letti sull'esame (per esame.mjs misura)
"""
import json, math, os, random, sys, time, base64
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from tokenizers import Tokenizer, models, pre_tokenizers, trainers

RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
QUI = os.path.dirname(os.path.abspath(__file__))
SALVA = "--salva" in sys.argv
FILE = [a for a in sys.argv[1:] if not a.startswith("--")]
SEME = int(os.environ.get("SEME", "7"))
random.seed(SEME); np.random.seed(SEME); torch.manual_seed(SEME)
torch.set_num_threads(int(os.environ.get("THREADS", "4")))

RUOLI = ["O", "QTA", "PRZ", "TOT", "ANN", "PERC", "BASE", "SCO", "SCOV"]
R = {r: i for i, r in enumerate(RUOLI)}
leggi = lambda f: [json.loads(r) for r in open(f) if r.strip()]
allena = [x for f in FILE for x in leggi(f)]
esame = leggi(os.path.join(QUI, "dati", "esame.jsonl"))

# ---------- Vocabolario (WordPiece) ----------
SPECIALI = ["[PAD]", "[UNK]", "[CLS]", "[MASK]"]
tok = Tokenizer(models.WordPiece(unk_token="[UNK]", max_input_chars_per_word=40))
tok.pre_tokenizer = pre_tokenizers.WhitespaceSplit()
trainer = trainers.WordPieceTrainer(vocab_size=int(os.environ.get("VOCAB", "3000")), min_frequency=2, special_tokens=SPECIALI, continuing_subword_prefix="##")
tok.train_from_iterator([" ".join(x["segni"]) for x in allena], trainer)
VOC = tok.get_vocab(); V = len(VOC)
MAXLEN = 96
cache = {}
def pezzi_parola(w):
    if w not in cache: cache[w] = tok.encode(w).ids or [VOC["[UNK]"]]
    return cache[w]
def codifica(segni):
    """ids dei pezzi e, per ogni parola, la posizione del suo primo pezzo"""
    ids, primi = [VOC["[CLS]"]], []
    for w in segni:
        p = pezzi_parola(w)
        if len(ids) + len(p) > MAXLEN: break
        primi.append(len(ids)); ids.extend(p)
    return ids, primi

def sporca(segni, ruoli):
    """dettatura: parole perse o storpiate (mai i numeri)"""
    out_s, out_r = [], []
    for w, r in zip(segni, ruoli):
        x = random.random()
        if w.startswith("<"): out_s.append(w); out_r.append(r); continue
        if x < 0.04 and len(segni) > 4: continue
        if x < 0.10 and len(w) > 4:
            j = random.randrange(1, len(w) - 1)
            w = w[:j] + w[j + 1:] if random.random() < 0.5 else w[:j] + w[j + 1] + w[j] + w[j + 2:]
        out_s.append(w); out_r.append(r)
    return out_s, out_r

# ---------- Il modello ----------
D, STRATI, TESTE, FF = int(os.environ.get("D", "96")), int(os.environ.get("STRATI", "2")), 4, int(os.environ.get("FF", "192"))
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
        x = x + s.drop(s.f2(F.gelu(s.f1(s.ln2(x)))))
        return x
class Modello(nn.Module):
    def __init__(s):
        super().__init__()
        s.emb = nn.Embedding(V, D); s.pos = nn.Embedding(MAXLEN, D)
        s.strati = nn.ModuleList([Strato() for _ in range(STRATI)])
        s.ln = nn.LayerNorm(D); s.out = nn.Linear(D, len(RUOLI))
        s.drop = nn.Dropout(0.1)
    def forward(s, ids, maschera):
        x = s.drop(s.emb(ids) + s.pos(torch.arange(ids.shape[1])[None]))
        for st in s.strati: x = st(x, maschera)
        return s.out(s.ln(x))  # un voto per ogni pezzo

def lotto(esempi, rumore):
    seq, pos, lab = [], [], []
    for x in esempi:
        sg, rl = (sporca(x["segni"], x["ruoli"]) if rumore else (x["segni"], x.get("ruoli") or ["O"] * len(x["segni"])))
        ids, primi = codifica(sg)
        seq.append(ids); pos.append(primi); lab.append([R[r] for r in rl[:len(primi)]])
    T = max(len(q) for q in seq)
    ids = torch.zeros(len(seq), T, dtype=torch.long)
    y = torch.full((len(seq), T), -100, dtype=torch.long)
    for i, (q, p, l) in enumerate(zip(seq, pos, lab)):
        ids[i, :len(q)] = torch.tensor(q)
        for j, k in enumerate(p): y[i, k] = l[j]
    return ids, ids != 0, y, pos

random.shuffle(allena)
val, tr = allena[:1000], allena[1000:]
modello = Modello()
print(f"Allenamento {len(tr)} frasi, vocabolario {V}, parametri {sum(p.numel() for p in modello.parameters()):,}", flush=True)
# i ruoli rari (ANN, SCO, BASE…) pesano di più; O pesa poco (è quasi tutto)
conta = np.bincount([R[r] for x in tr for r in x["ruoli"]], minlength=len(RUOLI)) + 1
pesi = torch.tensor(np.clip((conta.sum() / len(RUOLI)) / conta, float(os.environ.get("PESO_MIN", "0.3")), float(os.environ.get("PESO_MAX", "1.5"))), dtype=torch.float)
BS, EPOCHE = 64, int(os.environ.get("EPOCHE", "8"))
opt = torch.optim.AdamW(modello.parameters(), lr=2e-3, weight_decay=0.01)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=EPOCHE * math.ceil(len(tr) / BS), pct_start=0.1)

def predici(esempi):
    modello.eval(); out = []
    with torch.no_grad():
        for i in range(0, len(esempi), 256):
            b = esempi[i:i + 256]
            ids, m, _, pos = lotto(b, False)
            p = F.softmax(modello(ids, m), -1)
            for k, x in enumerate(b):
                ruoli, sic, tutte = [], [], []
                for j in range(len(x["segni"])):
                    if j < len(pos[k]):
                        pr = p[k, pos[k][j]]; r = int(pr.argmax())
                        # solo i numeri hanno un ruolo
                        if not x["segni"][j].startswith(("<n", "<p")): r = 0
                        ruoli.append(RUOLI[r]); sic.append(round(float(pr.max()), 3)); tutte.append([round(float(v), 4) for v in pr])
                    else: ruoli.append("O"); sic.append(1.0); tutte.append([1.0] + [0.0] * (len(RUOLI) - 1))
                out.append({"ruoli": ruoli, "p": sic, "pp": tutte})
    return out
def acc_numeri(esempi):
    pr = predici(esempi); g = n = 0; frasi = 0
    for x, q in zip(esempi, pr):
        ok = True
        for s, a, b in zip(x["segni"], x["ruoli"], q["ruoli"]):
            if s.startswith(("<n", "<p")): n += 1; g += a == b; ok &= a == b
        frasi += ok
    return g / max(1, n), frasi / max(1, len(esempi))

t0 = time.time()
for ep in range(EPOCHE):
    modello.train(); random.shuffle(tr); tot = 0
    for i in range(0, len(tr), BS):
        ids, m, y, _ = lotto(tr[i:i + BS], True)
        z = modello(ids, m)
        loss = F.cross_entropy(z.reshape(-1, len(RUOLI)), y.reshape(-1), weight=pesi, ignore_index=-100)
        opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(modello.parameters(), 1.0); opt.step(); sched.step()
        tot += loss.item() * len(ids)
    an, af = acc_numeri(val)
    print(f"epoca {ep + 1}: perdita {tot / len(tr):.4f} · da parte: numeri {an:.3f}, frasi intere {af:.3f} · {time.time() - t0:.0f}s", flush=True)

ruoli_esame = predici(esame)
if os.environ.get("RUOLI_OUT"):
    with open(os.environ["RUOLI_OUT"], "w") as f:
        for r in ruoli_esame: f.write(json.dumps(r) + "\n")
    print("Ruoli dell'esame in", os.environ["RUOLI_OUT"])

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
    out = {"versione": time.strftime("%Y-%m-%d"), "tipo": "etichettatore", "ruoli": RUOLI, "D": D, "strati": STRATI, "teste": TESTE, "ff": FF, "maxlen": MAXLEN,
           "vocab": [w for w, _ in vocab], "pesi": pz}
    f = os.path.join(RADICE, "modello-dettagli.json")
    json.dump(out, open(f, "w"), separators=(",", ":"))
    torch.save(modello.state_dict(), os.path.join(QUI, "dati", "modello.pt"))
    print(f"Salvato modello-dettagli.json ({os.path.getsize(f) / 1024:.0f} KB)")
