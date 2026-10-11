# bidi-firefox — real-keyboard and viewport verification harness

Drives a **real, headed Firefox** on a real X display with **OS-level keyboard
input** (XTest) and **WebDriver BiDi** for navigation, viewports, pointer, and
DOM assertions. Used to verify drawer keyboard accessibility (Tab trapping,
Escape, focus restoration, inert background) and header/nav reachability at
320–1280px with genuine viewports — not code-level mocks and not iframe-emulated
measurements.

Originally built for the `as-truth-cards` issue #9 follow-up (real browser
Tab/Shift+Tab/Enter/Escape pass + responsive reachability matrix).

## Why not plain Selenium/BiDi synthetic keys?

BiDi *synthetic* `Enter`/`Space` key actions do **not** trigger default button
activation in the automation channel — even a plain injected `<button onclick>`
is not activated, and `document.hasFocus()` reads `false`. This is a property of
the automation channel, **not** an app defect. Real **XTest** X11 events are
indistinguishable from a physical keyboard and activate buttons correctly, which
is why this harness uses them. See `diagnostics/diag_hasfocus.py` to reproduce.

## Prerequisites

- Any X11 desktop session (e.g. `DISPLAY=:0`) — the harness launches Firefox
  headed so the window can receive real input focus.
- A Firefox binary. Defaults to the snap build:
  `/snap/firefox/current/usr/lib/firefox/firefox`. Override with
  `FIREFOX_BIN`.
- Python 3 with the wheel deps below.
- The app being tested running locally (default `http://localhost:3001/`,
  override with `APP_URL`).

## Setup

```bash
python3 -m venv /tmp/venv
/tmp/venv/bin/pip install -r tools/bidi-firefox/requirements.txt
```

## Usage

```bash
# 1. Serve the app (any valid build) on :3001
NODE_ENV=production npx tsx server/index.ts &

# 2. Run the driver (relaunches Firefox, activates its window, runs the checks)
tools/bidi-firefox/run.sh tools/bidi-firefox/driver.py
```

`run.sh`:
1. kills any Firefox using the profile,
2. launches a headed Firefox with `--remote-debugging-port 0` on the given
   display and profile (default `~/.bidi-prof`),
3. waits for `WebDriverBiDiServer.json` (the WS port),
4. focuses the Firefox window via EWMH `_NET_ACTIVE_WINDOW`
   (`activate_window.py`) so Gecko performs default button activation,
5. runs the driver.

Environment overrides: `DISPLAY`, `FIREFOX_BIN`, `BIDI_PROFILE`, `PYTHON`,
`APP_URL`, `REPORT`.

## What the driver verifies

For **each** drawer (`deck-open-browse`, `deck-open-tray`):

| Check | Method |
| --- | --- |
| Real `Enter` on the focused trigger opens the drawer | XTest Return |
| Initial focus lands on Close | BiDi `document.activeElement` |
| Background inert (header + footer + workspace) | DOM `inert` attribute |
| `Shift+Tab` wraps to the last control | XTest Shift+Tab |
| 12× `Tab` never escapes the layer | XTest Tab |
| `Escape` closes + restores focus to the trigger | XTest Escape |
| Backdrop click closes + restores focus | BiDi pointer |
| `Enter` on Close closes + restores focus | XTest Return |

Then a **reachability matrix** at real viewports 320 / 375 / 768 / 1024 / 1280:
hamburger visibility, all primary nav links present in the menu (no overflow:
link `right ≤ innerWidth`), desktop header links, and drawer-trigger visibility.
Note the 1280px case: the toolbar triggers are `xl:hidden` by design — the
browse/tray **rails** render permanently instead (`diagnostics/diag_rails.py`).

Results are printed and written as JSON (`REPORT`, default
`/tmp/bidi_report.json`).

## Files

| File | Purpose |
| --- | --- |
| `run.sh` | relaunch + focus + run a driver/diagnostic |
| `driver.py` | the main drawer-keyboard + viewport-matrix verification |
| `activate_window.py` | EWMH window activation (needs python-xlib) |
| `requirements.txt` | `websockets`, `python-xlib` |
| `diagnostics/diag_hasfocus.py` | reproduce the hasFocus/BiDi-activation quirks |
| `diagnostics/diag_activation.py` | app trigger open via Return/KP_Enter/Space |
| `diagnostics/diag_rails.py` | confirm xl rails visible/populated at 1280/1440 |

`driver.py` and the diagnostics read the WS port from
`WebDriverBiDiServer.json` inside the profile dir; each run must use a fresh
session (one session per browser — `run.sh` relaunches Firefox so the previous
session is discarded).