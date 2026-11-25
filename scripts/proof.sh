#!/bin/bash
# Local proof: wrangler dev, three moves through /click with ismap coordinates, SVG saved after each step.
cd "$(dirname "$0")/.." || exit 1
PORT=${PORT:-8791}; D=$(mktemp -d); OUT=shots
CHROME="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell"
WRANGLER_SEND_METRICS=false perl -e 'alarm shift; exec @ARGV' 120 npx --yes wrangler@4.20.0 dev --port $PORT --persist-to "$D" >"$D/dev.log" 2>&1 &
click() { # square file rank -> ismap pixel
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" --retry 30 --retry-delay 1 --retry-connrefused "http://127.0.0.1:$PORT/click?$1,$2"; sleep 3.2; }
step() { curl -s "http://127.0.0.1:$PORT/canvas.svg" >"$OUT/step-$1.svg"; }
click 253 339; step 1; click 253 239; step 2
click 203 339; step 3; click 203 239; step 4
click 353 389; step 5; click 303 289; step 6
lsof -ti tcp:$PORT | xargs kill 2>/dev/null
for i in 1 2 3 4 5 6; do "$CHROME" --no-sandbox --screenshot="$OUT/step-$i.png" --window-size=800,440 "file://$PWD/$OUT/step-$i.svg" >/dev/null 2>&1; done
ls "$OUT"/step-*.png
