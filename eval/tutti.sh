#!/usr/bin/env bash
# Tutte le prove di EON (rete di sicurezza, 30/09/2026). Esce con errore se
# anche una sola prova fallisce: così GitHub blocca il merge.
#   bash eval/tutti.sh            → tutte
#   PEZZO=2/3 bash eval/tutti.sh  → solo la seconda terza parte (per andare in parallelo)
cd "$(dirname "$0")/.."
[ -z "$NODE_PATH" ] && [ -d /opt/node22/lib/node_modules/playwright ] && export NODE_PATH=/opt/node22/lib/node_modules
IFS=/ read -r io quanti <<< "${PEZZO:-1/1}"
i=0; falliti=0; passati=0
for t in eval/*.test.js eval/*.test.mjs; do
  i=$((i + 1)); [ $(( (i - 1) % quanti + 1 )) -eq "$io" ] || continue
  inizio=$(date +%s)
  out=$(timeout 600 node "$t" 2>&1); esito=$?
  secondi=$(( $(date +%s) - inizio ))
  if [ $esito -eq 0 ] && ! grep -q "FAIL" <<< "$out"; then
    passati=$((passati + 1)); echo "PASS $t (${secondi}s)"
  else
    falliti=$((falliti + 1)); echo "FAIL $t (uscita $esito, ${secondi}s)"; grep -E "FAIL|Error|error" <<< "$out" | head -8 | sed 's/^/     /'
  fi
done
echo; echo "Prove passate: $passati · fallite: $falliti"
[ $falliti -eq 0 ]
