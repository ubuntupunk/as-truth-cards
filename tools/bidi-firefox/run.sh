#!/usr/bin/env bash
# Relaunch the headed BiDi Firefox on a real X display, activate its window via
# the EWMH _NET_ACTIVE_WINDOW client message, then run the driver script.
#
# Usage:  tools/bidi-firefox/run.sh tools/bidi-firefox/driver.py
#
# Environment overrides:
#   DISPLAY         X display to run Firefox on (default :0)
#   FIREFOX_BIN     path to the firefox binary (default snap Firefox)
#   BIDI_PROFILE    Firefox profile dir holding WebDriverBiDiServer.json (default ~/.bidi-prof)
#   PYTHON          python interpreter with websockets + python-xlib (default /tmp/venv/bin/python)
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
DISPLAY_NUM="${DISPLAY:-:0}"
BIN="${FIREFOX_BIN:-/snap/firefox/current/usr/lib/firefox/firefox}"
PROFILE="${BIDI_PROFILE:-$HOME/.bidi-prof}"
if [ -x /tmp/venv/bin/python ]; then
  PY="${PYTHON:-/tmp/venv/bin/python}"
else
  PY="${PYTHON:-python3}"
fi

# Kill any instance already using this profile (bracket trick avoids self-match).
BASE="$(basename "$PROFILE")"
FIRST="${BASE:0:1}"
REST="${BASE:1}"
pkill -f "[${FIRST}]${REST}" 2>/dev/null || true
sleep 2
rm -f "$PROFILE/WebDriverBiDiServer.json"

DISPLAY="$DISPLAY_NUM" setsid -f "$BIN" --no-remote --profile "$PROFILE" \
  --remote-debugging-port 0 about:blank >/tmp/bidi-ff-x0.log 2>&1 </dev/null

for _ in $(seq 1 45); do
  [ -f "$PROFILE/WebDriverBiDiServer.json" ] && break
  sleep 1
done
sleep 2

"$PY" "$HERE/activate_window.py" -d "$DISPLAY_NUM" -p "$PROFILE"
sleep 1
echo "ws_port=$(python3 -c "import json,sys;print(json.load(open('$PROFILE/WebDriverBiDiServer.json'))['ws_port'])")"

exec "$PY" "$1"