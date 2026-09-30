# Etichette sospette: frasi che il modello, senza averle mai viste, mette con
# sicurezza in un altro cassetto (stile "confident learning").
import json, glob, collections, sys
import os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dati")
INT = json.load(open(D + "/intenti.json"))
righe = [json.loads(r) for f in sorted(glob.glob(D + "/piega-*.jsonl")) for r in open(f)]
# soglia per cassetto: la sicurezza media quando l'etichetta è quella
media = collections.defaultdict(list)
for x in righe: media[x["atteso"]].append(x["p"][INT.index(x["atteso"])])
soglia = {k: sum(v) / len(v) for k, v in media.items()}
sosp = []
for x in righe:
    j = max(range(len(INT)), key=lambda i: x["p"][i])
    if INT[j] != x["atteso"] and x["p"][j] >= soglia[INT[j]] and x["p"][INT.index(x["atteso"])] < 0.1:
        sosp.append({**x, "letto": INT[j], "pl": x["p"][j]})
print(len(righe), "frasi giudicate,", len(sosp), "sospette")
print(collections.Counter(x["fonte"] for x in sosp))
print(collections.Counter((x["atteso"], x["letto"]) for x in sosp).most_common(25))
json.dump([{"frase": x["frase"], "fonte": x["fonte"], "file": x.get("file"), "atteso": x["atteso"], "letto": x["letto"], "p": round(x["pl"], 3)} for x in sorted(sosp, key=lambda x: -x["pl"])],
          open(sys.argv[1] if len(sys.argv) > 1 else D + "/sospette.json", "w"), ensure_ascii=False, indent=0)
