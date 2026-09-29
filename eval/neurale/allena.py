"""Il modello neurale di EON (30/09/2026): un piccolo transformer che capisce
cosa chiede la frase (il "cassetto": appuntamento, preventivo, messaggio...).

Come fanno le grandi aziende per i modelli sul telefono: un modello piccolo,
allenato da zero sulle frasi scritte dalla "maestra" (scrittori AI con
personaggi diversi) più il frasario, misurato su frasi che non ha MAI visto.

- Vocabolario: WordPiece (pezzi di parola, come BERT), imparato sulle frasi.
- Modello: embedding + posizione, 2 strati transformer, media, classificatore.
- Rumore in allenamento: lettere perse/scambiate, parole saltate (dettatura).
- Sicurezza tarata (temperatura) su una parte dell'allenamento tenuta da parte.
- Esporta i pesi a 1 byte (int8) in modello-neurale.json per il telefono.

Uso: python3 eval/neurale/allena.py [--salva]
"""
import json, math, os, random, sys, time, base64
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from tokenizers import Tokenizer, models, pre_tokenizers, trainers

RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATI = os.path.join(RADICE, "eval", "neurale", "dati")
SALVA = "--salva" in sys.argv
SEME = int(os.environ.get("SEME", "7"))
random.seed(SEME); np.random.seed(SEME); torch.manual_seed(SEME)
torch.set_num_threads(4)

INTENTI = json.load(open(os.path.join(DATI, "intenti.json")))
K = len(INTENTI)
leggi = lambda f: [json.loads(r) for r in open(os.path.join(DATI, f)) if r.strip()]
allena, esame = leggi("allenamento.jsonl"), leggi("esame.jsonl")
allena = [x for x in allena if x["segni"]]
# l'esame vero (giro 16/17) non si guarda mentre si scelgono le varianti: NASCONDI_ESAME=1
NASCONDI = os.environ.get("NASCONDI_ESAME") == "1"
palestra = [x for x in esame if not x["insieme"].startswith(("giro 16", "giro 17"))]

# la maestra pesa di più: frasi scritte a mano, più varie del frasario
PESO_FONTE = {"maestra": float(os.environ.get("PESO_MAESTRA", "3")), "frasario": 1.0, "generatore": 0.7, "simulatore": 1.0}

# ---------- Il vocabolario (WordPiece) ----------
SPECIALI = ["[PAD]", "[UNK]", "[CLS]", "<tempo>", "<soldi>", "<tel>", "<num>", "<dom>"]
tok = Tokenizer(models.WordPiece(unk_token="[UNK]", max_input_chars_per_word=40))
tok.pre_tokenizer = pre_tokenizers.WhitespaceSplit()
trainer = trainers.WordPieceTrainer(vocab_size=int(os.environ.get("VOCAB", "6000")), min_frequency=2, special_tokens=SPECIALI, continuing_subword_prefix="##")
tok.train_from_iterator([x["segni"] for x in allena], trainer)
VOC = tok.get_vocab()
V = len(VOC)
MAXLEN = 48
def codifica(s):
    ids = [VOC["[CLS]"]] + tok.encode(s).ids
    return ids[:MAXLEN]

# ---------- Il rumore della dettatura ----------
def sporca(s):
    parole = s.split()
    out = []
    for w in parole:
        r = random.random()
        if w.startswith("<"): out.append(w); continue
        if r < 0.04 and len(parole) > 3: continue                      # parola persa
        if r < 0.10 and len(w) > 4:                                     # lettera persa o scambiata
            j = random.randrange(1, len(w) - 1)
            w = w[:j] + w[j + 1:] if random.random() < 0.5 else w[:j] + w[j + 1] + w[j] + w[j + 2:]
        out.append(w)
    return " ".join(out) or s

# ---------- Il modello ----------
D, STRATI, TESTE, FF = int(os.environ.get("D", "128")), int(os.environ.get("STRATI", "2")), 4, int(os.environ.get("FF", "256"))
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
        s.ln = nn.LayerNorm(D); s.out = nn.Linear(D, K)
        s.drop = nn.Dropout(0.1)
    def forward(s, ids, maschera):
        x = s.drop(s.emb(ids) + s.pos(torch.arange(ids.shape[1])[None]))
        for st in s.strati: x = st(x, maschera)
        x = s.ln(x)
        m = maschera.unsqueeze(-1).float()
        media = (x * m).sum(1) / m.sum(1)
        return s.out(media)

def lotto(esempi, rumore):
    seq = [codifica(sporca(x["segni"]) if rumore else x["segni"]) for x in esempi]
    T = max(len(q) for q in seq)
    ids = torch.zeros(len(seq), T, dtype=torch.long)
    for i, q in enumerate(seq): ids[i, :len(q)] = torch.tensor(q)
    return ids, ids != 0

# una parte dell'allenamento da parte, per la temperatura e per fermarsi al momento giusto
random.shuffle(allena)
n_val = 1500
val, tr = allena[:n_val], allena[n_val:]
pesi_c = torch.tensor([min(3.0, (len(tr) / K) / max(1, sum(1 for x in tr if x["y"] == k))) for k in range(K)])
modello = Modello()
print(f"Allenamento {len(tr)} frasi (maestra {sum(1 for x in tr if x['fonte']=='maestra')}), vocabolario {V}, parametri {sum(p.numel() for p in modello.parameters()):,}")
EPOCHE = int(os.environ.get("EPOCHE", "12")); BS = 64
opt = torch.optim.AdamW(modello.parameters(), lr=2e-3, weight_decay=0.01)
passi = EPOCHE * math.ceil(len(tr) / BS)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=passi, pct_start=0.1)

def predici(esempi, T=1.0):
    modello.eval(); out = []
    with torch.no_grad():
        for i in range(0, len(esempi), 256):
            ids, m = lotto(esempi[i:i + 256], False)
            out.append(F.softmax(modello(ids, m) / T, -1))
    return torch.cat(out)
def accuratezza(esempi):
    p = predici(esempi); return (p.argmax(-1) == torch.tensor([x["y"] for x in esempi])).float().mean().item()

t0 = time.time()
for ep in range(EPOCHE):
    modello.train(); random.shuffle(tr); tot = 0
    for i in range(0, len(tr), BS):
        b = tr[i:i + BS]
        ids, m = lotto(b, True)
        y = torch.tensor([x["y"] for x in b])
        w = torch.tensor([PESO_FONTE.get(x["fonte"], 1.0) for x in b]) * pesi_c[y]
        loss = (F.cross_entropy(modello(ids, m), y, reduction="none", label_smoothing=0.05) * w).sum() / w.sum()
        opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(modello.parameters(), 1.0); opt.step(); sched.step()
        tot += loss.item() * len(b)
    print(f"epoca {ep + 1}: perdita {tot / len(tr):.3f} · da parte {accuratezza(val):.3f} · palestra {accuratezza(palestra):.3f} · {time.time() - t0:.0f}s", flush=True)

# ---------- Temperatura ----------
# Tarata sul giro 15 (la "palestra": frasi di scrittori indipendenti, mai in
# allenamento), NON sul giro 16 (l'esame) né sulle frasi inventate, dove il
# modello si crede troppo sicuro di sé.
modello.eval()
taratura = [x for x in esame if x["insieme"].startswith("giro 15")] or val
with torch.no_grad():
    zs = torch.cat([modello(*lotto(taratura[i:i + 256], False)) for i in range(0, len(taratura), 256)])
yv = torch.tensor([x["y"] for x in taratura])
Tbest, nbest = 1.0, 1e9
for T in np.arange(0.5, 4.01, 0.1):
    nll = F.cross_entropy(zs / T, yv).item()
    if nll < nbest: Tbest, nbest = float(T), nll

# ---------- L'esame ----------
p = predici(esame, Tbest)
pred = p.argmax(-1); conf = p.max(-1).values
ys = torch.tensor([x["y"] for x in esame])
print(f"\nTemperatura {Tbest:.1f}")
for ins in dict.fromkeys(x["insieme"] for x in esame):
    if NASCONDI and ins.startswith(("giro 16", "giro 17")): continue
    idx = [i for i, x in enumerate(esame) if x["insieme"] == ins]
    g = (pred[idx] == ys[idx]).float()
    sic = [i for i in idx if conf[i] >= 0.8]
    gs = (pred[sic] == ys[sic]).float().mean().item() if sic else 0
    print(f"{ins}: {int(g.sum())}/{len(idx)} giuste ({g.mean().item()*100:.0f}%) · quando è sicuro (≥80%): {sum(1 for i in sic if pred[i]==ys[i])}/{len(sic)} ({gs*100:.0f}%)")
json.dump([{"frase": x["frase"], "insieme": x["insieme"], "atteso": x["intento"], "letto": INTENTI[pred[i]], "p": round(conf[i].item(), 3)} for i, x in enumerate(esame)],
          open(os.path.join(DATI, "esito-neurale.json"), "w"), ensure_ascii=False, indent=0)

# ---------- Esportazione a 1 byte ----------
if SALVA:
    sd = {k: v.detach().numpy() for k, v in modello.state_dict().items()}
    pesi = {}
    for nome, a in sd.items():
        if a.ndim == 2:  # matrici: int8 con una scala per riga
            sc = np.maximum(np.abs(a).max(1, keepdims=True) / 127, 1e-8)
            q = np.clip(np.round(a / sc), -127, 127).astype(np.int8)
            pesi[nome] = {"forma": list(a.shape), "q": base64.b64encode(q.tobytes()).decode(), "scala": [round(float(x), 8) for x in sc[:, 0]]}
        else:
            pesi[nome] = {"forma": list(a.shape), "v": [round(float(x), 6) for x in a.ravel()]}
    vocab = sorted(VOC.items(), key=lambda kv: kv[1])
    out = {"versione": time.strftime("%Y-%m-%d"), "tipo": "transformer", "intenti": INTENTI, "D": D, "strati": STRATI, "teste": TESTE, "ff": FF, "maxlen": MAXLEN,
           "temperatura": Tbest, "vocab": [w for w, _ in vocab], "pesi": pesi}
    f = os.path.join(RADICE, "modello-neurale.json")
    json.dump(out, open(f, "w"), separators=(",", ":"))
    torch.save(modello.state_dict(), os.path.join(DATI, "modello.pt"))
    print(f"Salvato modello-neurale.json ({os.path.getsize(f) / 1024:.0f} KB)")
