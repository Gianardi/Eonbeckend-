# Accuratezza dell'insieme dei maestri (media delle probabilità) sulla palestra.
# Uso: python3 eval/neurale/insieme.py cartella-con-e1.json-e2.json…
import json, glob, collections
import os, sys
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dati")
INT = json.load(open(D + "/intenti.json"))
es = [json.loads(r) for r in open(D + "/esame.jsonl") if r.strip()]
P = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(sys.argv[1], "e*.json")))]
print(len(P), "maestri")
tot = collections.defaultdict(lambda: [0, 0])
for i, x in enumerate(es):
    if x["insieme"].startswith(("giro 16", "giro 17")): continue
    m = [sum(p[i][k] for p in P) / len(P) for k in range(len(INT))]
    tot[x["insieme"]][0] += INT[max(range(len(INT)), key=lambda k: m[k])] == x["intento"]; tot[x["insieme"]][1] += 1
for k, (g, n) in tot.items(): print(f"{k}: {g}/{n} ({100*g/n:.0f}%)")
