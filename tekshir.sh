#!/bin/bash
cd /root/donate-app || exit 1

echo "=========== ILOVA ==========="
curl -sL "https://minatoh.uz/?v=$(date +%s)" -o /tmp/i.html
echo "hajm       : $(wc -c < /tmp/i.html)"

python3 - <<'PY' 2>/dev/null
import re
s = open('/tmp/i.html', encoding='utf-8', errors='ignore').read()
p = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', s, re.S)
open('/tmp/i.js', 'w', encoding='utf-8').write(p[-1] if p else '')
PY

if node --check /tmp/i.js >/dev/null 2>&1; then
  echo "sintaksis  : TOZA"
else
  echo "sintaksis  : XATO  <-- ilova ishlamaydi!"
fi

for w in mlbb-bag-x hamkor-ex-em2 "function renderChat" DICT.ja promoGlow toastOk; do
  printf "%-11s: %s\n" "$w" "$(grep -c "$w" /tmp/i.html)"
done

echo
echo "=========== SERVER ==========="
echo "VPS hajm   : $(wc -c < server.js)"
curl -fsSL "https://raw.githubusercontent.com/davletovfaxriddin5-gif/donate-app/main/vps/server.js?v=$(date +%s)" -o /tmp/g.js
echo "GitHub hajm: $(wc -c < /tmp/g.js)"
if cmp -s server.js /tmp/g.js; then
  echo "holat      : bir xil"
else
  echo "holat      : FARQ BOR  <-- VPS ga ko'chirish kerak"
fi
node --check server.js >/dev/null 2>&1 && echo "sintaksis  : TOZA" || echo "sintaksis  : XATO"
pm2 pid minatoh-api >/dev/null 2>&1 && echo "pm2        : online" || echo "pm2        : TO'XTAGAN"

echo
echo "=========== TA'MINOTCHI ==========="
K=$(grep '^FZR_API_KEY=' .env | cut -d= -f2-)
BODY='{"category_id":"mobile_legends","fields":{"player_id":"1284647747","zone_id":"15219"}}'
R=$(curl -s --max-time 12 -X POST https://api.fzr.cards/api/v2/topups/validate-id -H "X-API-Key: $K" -H "Content-Type: application/json" -d "$BODY")
if echo "$R" | grep -q '"ok":true'; then
  echo "FazerCards : ishlayapti"
else
  echo "FazerCards : MUAMMO BOR"
  echo "javob      : ${R:-bo_sh}"
fi
