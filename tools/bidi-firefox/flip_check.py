"""Real-browser verification of the deck card flip (issue #9 follow-up 3).

Drives the same headed-Firefox setup as `driver.py` (XTest real keys + BiDi)
and verifies the two-faced card against SPEC §7.4:

- front (Cover) is visible and `data-flipped="false"`; back face is inert.
- a real `Enter` on `Read front & back` flips to the Claim face: stage flips,
  back face becomes interactive, front face becomes inert.
- `Read analysis` moves to the Analysis face inside the back.
- `Back to front` flips back to the Cover.
- a pointer click path also flips (SPEC: no interaction depends on keyboard).
- under `prefers-reduced-motion: reduce` the faces swap statefully with no
  transform (computed `transform: none`) and the inactive face is hidden.

After screenshots are written to `docs/issue-9/screenshots/` for the
before/after pair: front cover and flipped back at desktop and mobile widths.

Usage: served app on :3001, then
    tools/bidi-firefox/run.sh tools/bidi-firefox/flip_check.py
with `REPORT=/path/flip_report.json` (default /tmp/bidi_flip_report.json).
"""

import asyncio
import base64
import json
import os
import subprocess
import sys
import time
from typing import Any

import websockets
from Xlib import X, XK, display
from Xlib.ext import xtest

PROFILE = os.path.expanduser(os.environ.get("BIDI_PROFILE", "~/.bidi-prof"))
PORT = json.load(open(f"{PROFILE}/WebDriverBiDiServer.json"))["ws_port"]
APP = os.environ.get("APP_URL", "http://localhost:3001/")
REPORT = os.environ.get("REPORT", "/tmp/bidi_flip_report.json")
SHOTS = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "docs",
    "issue-9",
    "screenshots",
)
HERE = os.path.dirname(os.path.abspath(__file__))

report: dict[str, object] = {
    "app": APP,
    "input": "XTest (real X11 key/pointer events) + WebDriver BiDi assertions",
}
xd = display.Display(os.environ.get("DISPLAY", ":0"))

SELECTORS = {
    "flip": '[data-testid="flip-card"]',
    "backToFront": '[data-testid="back-to-front"]',
    "readAnalysis": '[data-testid="read-analysis"]',
    "card": '[data-testid="featured-card"]',
    "stage": '[data-testid="card-flip-stage"]',
    "front": '[data-testid="card-face-front"]',
    "back": '[data-testid="card-face-back"]',
}

STATE = (
    "(() => {"
    f" const a=document.querySelector('{SELECTORS['card']}');"
    f" const s=document.querySelector('{SELECTORS['stage']}');"
    f" const f=document.querySelector('{SELECTORS['front']}');"
    f" const b=document.querySelector('{SELECTORS['back']}');"
    " const cs=e=>e?getComputedStyle(e):null;"
    " const ae=document.activeElement;"
    " return {"
    "  stage:a?a.getAttribute('data-stage'):null,"
    "  flipped:s?s.getAttribute('data-flipped'):null,"
    "  transform:cs(s)&&cs(s).transform,"
    "  frontInert:!!(f&&f.hasAttribute('inert')),"
    "  backInert:!!(b&&b.hasAttribute('inert')),"
    "  frontHidden:(cs(f)&&cs(f).visibility)==='hidden',"
    "  backHidden:(cs(b)&&cs(b).visibility)==='hidden',"
    "  activeTestid:ae?ae.getAttribute('data-testid'):null,"
    "  href:location.href,"
    "  supports3d:CSS.supports('transform-style','preserve-3d')"
    " }; })()"
)


def refocus() -> None:
    subprocess.run(
        [
            sys.executable,
            os.path.join(HERE, "activate_window.py"),
            "-d",
            os.environ.get("DISPLAY", ":0"),
            "-p",
            PROFILE,
        ],
        capture_output=True,
    )
    time.sleep(0.5)


class B:
    def __init__(self, ws):
        self.ws = ws
        self.mid = 0
        self.ctx = ""

    async def cmd(self, method, params=None):
        self.mid += 1
        m = {"id": self.mid, "method": method}
        if params is not None:
            m["params"] = params
        await self.ws.send(json.dumps(m))
        while True:
            d = json.loads(await asyncio.wait_for(self.ws.recv(), timeout=30))
            if d.get("id") == self.mid:
                if "error" in d:
                    raise RuntimeError(f"{method}: {d.get('message')}")
                return d.get("result", {})

    async def ev(self, expr) -> Any:
        r = await self.cmd("script.evaluate", {"target": {"context": self.ctx}, "expression": expr,
                                               "awaitPromise": True, "resultOwnership": "root"})
        return unwrap(r.get("result", {}))


def unwrap(v) -> Any:
    t = v.get("type")
    if t in ("null", "undefined"):
        return None
    if t in ("string", "number", "boolean"):
        return v["value"]
    if t == "array":
        return [unwrap(x) for x in v["value"]]
    if t == "object":
        return {k: unwrap(x) for k, x in v["value"]}
    return v


def tap(name, shift=False):
    s = xd.keysym_to_keycode(XK.XK_Shift_L)
    k = xd.keysym_to_keycode(XK.string_to_keysym(name))
    if shift:
        xtest.fake_input(xd, X.KeyPress, s)
    xtest.fake_input(xd, X.KeyPress, k)
    xd.sync()
    time.sleep(0.06)
    xtest.fake_input(xd, X.KeyRelease, k)
    if shift:
        xtest.fake_input(xd, X.KeyRelease, s)
    xd.sync()
    time.sleep(0.25)


async def click(b, x, y):
    await b.cmd("input.performActions", {"context": b.ctx, "actions": [
        {"type": "pointer", "id": "m", "parameters": {"pointerType": "mouse"}, "actions": [
            {"type": "pointerMove", "x": int(x), "y": int(y), "duration": 0},
            {"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0}]}]})
    await asyncio.sleep(0.25)


async def click_sel(b, sel):
    r = await b.ev(f"(() => {{ const e=document.querySelector({json.dumps(sel)}); if(!e) return null;"
                   " e.scrollIntoView({block:'center'});"
                   f" const r=e.getBoundingClientRect(); return {{x:r.x+r.width/2, y:r.y+r.height/2}}; }})()")
    if not r:
        return False
    await click(b, r["x"], r["y"])
    return True


async def enter_on(b, sel):
    """Focus `sel` with the window active, then a real XTest `Enter`.

    Returns a probe dict; sends no key when the element cannot be focused, so a
    failed focus can never fire `Enter` at whatever happens to be focused.
    """
    refocus()
    probe = await b.ev(
        f"(() => {{ const e=document.querySelector({json.dumps(sel)});"
        " if(!e) return {found:false};"
        " const before=document.activeElement;"
        " e.focus(); const ae=document.activeElement;"
        " return {found:true, hasFocus:document.hasFocus(),"
        "  tag:e.tagName, disabled:!!e.disabled,"
        "  ok: ae===e, aeTag: ae?ae.tagName:null,"
        "  aeTestid: ae?ae.getAttribute('data-testid'):null,"
        "  beforeTag: before?before.tagName:null}; })()"
    )
    if not probe or not probe.get("ok"):
        return probe or {"found": False}
    # Tap immediately: any delay lets the window lose content keyboard focus,
    # after which Enter is misrouted (driver.py does the same).
    tap("Return")
    probe["sentKey"] = True
    return probe


async def tap_sel(b, sel):
    """Reliable pointer path: real BiDi click on `sel`."""
    refocus()
    return await click_sel(b, sel)


async def prime_keyboard_focus(b):
    """Move Gecko's keyboard focus from the chrome into the page content.

    XTest key events are only delivered to the content once it holds window
    keyboard focus; a pointer click on static content plus a couple of Tabs
    establishes it (the committed driver.py does the same before its key steps).
    The page is scrolled to the top first so the click lands on the cover band
    rather than whatever a previous step scrolled under the point.
    """
    await b.ev("window.scrollTo(0, 0); true")
    await asyncio.sleep(0.2)
    await click(b, 520, 320)
    for _ in range(3):
        tap("Tab")


async def wait_card(b):
    for _ in range(60):
        if await b.ev(f"!!document.querySelector('{SELECTORS['card']}')"):
            return True
        await asyncio.sleep(0.5)
    return False


async def shot(b, name, w, h=900):
    await b.cmd("browsingContext.setViewport", {"context": b.ctx, "viewport": {"width": w, "height": h}})
    await asyncio.sleep(0.4)
    r = await b.cmd("browsingContext.captureScreenshot", {
        "context": b.ctx,
        "origin": "document",
        "format": {"type": "image/png"},
    })
    data = r.get("data", "")
    path = os.path.join(SHOTS, name)
    open(path, "wb").write(base64.b64decode(data))
    return path


async def main():
    async with websockets.connect(f"ws://127.0.0.1:{PORT}/session") as ws:
        b = B(ws)
        await b.cmd("session.new", {"capabilities": {}})
        t = await b.cmd("browsingContext.getTree", {})
        b.ctx = str(t["contexts"][0]["context"])
        await b.cmd("browsingContext.navigate", {"context": b.ctx, "url": APP, "wait": "complete"})
        await asyncio.sleep(1.0)
        report["ua"] = await b.ev("navigator.userAgent")
        report["supports3d"] = await b.ev("CSS.supports('transform-style','preserve-3d')")

        if not await wait_card(b):
            report["error"] = "featured card never appeared"
            json.dump(report, open(REPORT, "w"), indent=2)
            return

        refocus()
        checks: dict[str, object] = {}

        # 1. Cover: front visible, back inert.
        s = await b.ev(STATE) or {}
        checks["cover"] = {
            "pass": s.get("stage") == "cover" and s.get("flipped") == "false"
                    and not s.get("frontInert") and s.get("backInert"),
            "state": s,
        }

        # 2. Pointer click on `Read front & back` flips to the Claim face.
        clicked = await tap_sel(b, SELECTORS["flip"])
        s = await b.ev(STATE) or {}
        checks["click_flips_to_claim"] = {
            "pass": bool(clicked) and s.get("stage") == "claim" and s.get("flipped") == "true"
                    and s.get("frontInert") and not s.get("backInert"),
            "state": s,
        }

        # 3. Click on `Read analysis` moves to the Analysis face.
        await tap_sel(b, SELECTORS["readAnalysis"])
        s = await b.ev(STATE) or {}
        checks["click_opens_analysis"] = {
            "pass": s.get("stage") == "analysis" and s.get("flipped") == "true",
            "state": s,
        }

        # 4. `Back to front` flips back to the Cover.
        await tap_sel(b, SELECTORS["backToFront"])
        s = await b.ev(STATE) or {}
        checks["click_flips_back"] = {
            "pass": s.get("stage") == "cover" and s.get("flipped") == "false"
                    and not s.get("frontInert") and s.get("backInert"),
            "state": s,
        }

        # 5. Keyboard: a real `Enter` on the focused flip affordance flips too,
        #    and focus moves to the card the reader transitioned within (SPEC §10).
        await prime_keyboard_focus(b)
        probe = await enter_on(b, SELECTORS["flip"])
        s = await b.ev(STATE) or {}
        checks["keyboard_enter_flips"] = {
            "pass": bool(probe.get("ok")) and probe.get("sentKey")
                    and s.get("stage") == "claim" and s.get("flipped") == "true"
                    and s.get("activeTestid") == "featured-card",
            "focus": probe,
            "state": s,
        }

        # 6. Reduced-motion: stateful swap, no transform, inactive face hidden.
        #    Firefox 157 exposes no BiDi media emulation here, so this path is
        #    only asserted when the browser already reports the setting (run
        #    with `ui.prefersReducedMotion=1` in the profile's user.js).
        reduce = await b.ev("matchMedia('(prefers-reduced-motion: reduce)').matches")
        report["prefersReducedMotion"] = reduce
        if reduce:
            await tap_sel(b, SELECTORS["backToFront"])
            await tap_sel(b, SELECTORS["flip"])
            s = await b.ev(STATE) or {}
            checks["reduced_motion_swap"] = {
                "pass": s.get("stage") == "claim" and s.get("flipped") == "true"
                        and s.get("transform") == "none" and s.get("frontHidden") and not s.get("backHidden"),
                "state": s,
            }
        else:
            checks["reduced_motion_swap"] = {
                "pass": None,
                "note": "skipped: set ui.prefersReducedMotion=1 and rerun for the fallback evidence",
            }

        # Screenshots (before/after pair vs docs/issue-9/screenshots/decks-*.png).
        shots: dict[str, str] = {}
        await tap_sel(b, SELECTORS["backToFront"])
        await asyncio.sleep(0.35)
        shots["desktop_front"] = await shot(b, "decks-1024px-front.png", 1024)
        await tap_sel(b, SELECTORS["flip"])
        await asyncio.sleep(0.35)
        shots["desktop_claim"] = await shot(b, "decks-1024px-flip-claim.png", 1024)
        await tap_sel(b, SELECTORS["readAnalysis"])
        await asyncio.sleep(0.35)
        shots["desktop_analysis"] = await shot(b, "decks-1024px-flip-analysis.png", 1024)
        await tap_sel(b, SELECTORS["backToFront"])
        await asyncio.sleep(0.35)
        shots["mobile_front"] = await shot(b, "decks-375px-front.png", 375)
        await tap_sel(b, SELECTORS["flip"])
        await asyncio.sleep(0.35)
        shots["mobile_claim"] = await shot(b, "decks-375px-flip-claim.png", 375)

        # Reduced-motion capture for the fallback evidence, when active.
        if reduce:
            shots["desktop_claim_reduced_motion"] = await shot(
                b, "decks-1024px-flip-claim-reduced-motion.png", 1024)

        report["checks"] = checks
        report["screenshots"] = shots
    json.dump(report, open(REPORT, "w"), indent=2)
    print(json.dumps(report, indent=2)[:10000])


if __name__ == "__main__":
    asyncio.run(main())