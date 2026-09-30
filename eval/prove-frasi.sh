#!/usr/bin/env bash
# L'app intera sulle frasi etichettate dei giri 5-17 (rete di sicurezza, 30/09/2026).
# Ogni serie ha un minimo di frasi giuste (eval/dati/soglie-app.json, i numeri
# di oggi): se una modifica ne fa scendere anche una sola, la prova fallisce.
cd "$(dirname "$0")/.."
[ -z "$NODE_PATH" ] && [ -d /opt/node22/lib/node_modules/playwright ] && export NODE_PATH=/opt/node22/lib/node_modules
falliti=0
while IFS=' ' read -r file minimo; do
  out=$(FRASI="$file" PORTA=9070 timeout 1800 node eval/frasi-nuove-mestieri.test.js --elenco --minimo="$minimo" 2>&1); esito=$?
  riga=$(grep -m1 "giuste:" <<< "$out" | sed 's/^ *//')
  if [ $esito -eq 0 ]; then echo "PASS $file ($riga; minimo $minimo)"; else
    falliti=$((falliti + 1)); echo "FAIL $file ($riga; minimo $minimo)"
    awk '/^SBAGLIATE:/{s=1} /^ALL.AI:/{s=1} s&&/atteso/' <<< "$out" | head -15 | cut -c1-220 | sed 's/^/     /'
  fi
done < <(node -e 'const s=require("./eval/dati/soglie-app.json").serie; for (const [f,m] of Object.entries(s)) console.log(f, m)')
echo; echo "Serie sotto il minimo: $falliti"
[ $falliti -eq 0 ]
