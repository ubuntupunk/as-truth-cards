import asyncio
import json
import os
import subprocess
import sys
import time

import websockets
from Xlib import X, XK, display
from Xlib.ext import xtest

PROFILE = os.path.expanduser(os.environ.get("BIDI_PROFILE", "~/.bidi-prof"))
PORT = json.load(open(f"{PROFILE}/WebDriverBiDiServer.json"))["ws_port"]
APP = os.environ.get("APP_URL", "http://localhost:3001/")
REPORT = os.environ.get("REPORT", "/tmp/bidi_report.json")
SEL = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
LAYER = '[data-testid="deck-drawer-layer"]'
HERE = os.path.dirname(os.path.abspath(__file__))

report: dict[str, object] = {"app": APP, "input": "XTest (real X11 key/pointer events) + WebDriver BiDi assertions"}
xd = display.Display(os.environ.get("DISPLAY", ":0"))


def refocus():
    """Re-assert EWMH window activation.

    The harness runs on a live desktop, so another window can take X input
    focus mid-run; Gecko suppresses key default-actions (Tab movement, Escape
    handling reads, button activation) while unfocused. Re-ACtivating avoids
    dropped/misrouted keys between phases.
    """
    subprocess.run(
        [
            sys.executable,
            os.path.join(HERE, "activate_window.py"),
            "-d", os.environ.get("DISPLAY", ":0"),
            "-p", PROFILE,
        ],
        capture_output=True,
    )
    time.sleep(0.5)


class B:
    def __init__(self, ws):
        self.ws = ws
        self.mid = 0
        self.ctx: str = ""

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

    async def ev(self, expr):
        r = await self.cmd("script.evaluate", {"target": {"context": self.ctx}, "expression": expr,
                                               "awaitPromise": True, "resultOwnership": "root"})
        return unwrap(r.get("result", {}))


def unwrap(v):
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


def kc(name):
    return xd.keysym_to_keycode(XK.string_to_keysym(name))


def tap(name, shift=False):
    s = xd.keysym_to_keycode(XK.XK_Shift_L)
    k = kc(name)
    if shift:
        xtest.fake_input(xd, X.KeyPress, s)
    xtest.fake_input(xd, X.KeyPress, k)
    xd.sync()
    time.sleep(0.06)
    xtest.fake_input(xd, X.KeyRelease, k)
    if shift:
        xtest.fake_input(xd, X.KeyRelease, s)
    xd.sync()
    time.sleep(0.22)


async def click(b, x, y):
    await b.cmd("input.performActions", {"context": b.ctx, "actions": [
        {"type": "pointer", "id": "m", "parameters": {"pointerType": "mouse"}, "actions": [
            {"type": "pointerMove", "x": int(x), "y": int(y), "duration": 0},
            {"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0}]}]})
    await asyncio.sleep(0.25)


async def click_sel(b, sel):
    r = await b.ev(f"(() => {{ const e=document.querySelector({json.dumps(sel)}); if(!e) return null;"
                   f" const r=e.getBoundingClientRect(); return {{x:r.x+r.width/2, y:r.y+r.height/2}}; }})()")
    if not r:
        return False
    await click(b, r["x"], r["y"])
    return True


ACTIVE = f"(() => {{ const a=document.activeElement; if(!a) return null; const L=document.querySelector('{LAYER}');" \
         f" return {{testid:a.getAttribute('data-testid'), tag:a.tagName, inLayer: !!(L && L.contains(a))}}; }})()"
FOCUS = f"(() => {{ const L=document.querySelector('{LAYER}'); if(!L) return null;" \
        f" return [...L.querySelectorAll('{SEL}')].filter(e=>e.getClientRects().length>0)" \
        f".map(e=>e.getAttribute('data-testid')||e.tagName); }})()"
INERT = "(() => { const q=s=>document.querySelector(s); return {" \
        "header: !!(q('header')&&q('header').hasAttribute('inert'))," \
        "footer: !!(q('footer')&&q('footer').hasAttribute('inert'))," \
        "workspace: !!(q('[data-testid=\"deck-workspace\"]')&&q('[data-testid=\"deck-workspace\"]').hasAttribute('inert')) }; })()"
OPEN = f"!!document.querySelector('{LAYER}')"


async def drawer_pass(b, trigger, label):
    res = {"trigger": trigger, "checks": {}}
    refocus()
    await b.ev(f"document.querySelector('[data-testid=\"{trigger}\"]').focus(); true")
    tap("Return")
    opened = await b.ev(OPEN)
    res["checks"]["keyboard_return_opens"] = {"pass": bool(opened)}
    if not opened:
        return res
    await asyncio.sleep(0.2)
    a = await b.ev(ACTIVE)
    res["checks"]["initial_focus_on_close"] = {"pass": a and a.get("testid") == "deck-drawer-close", "active": a}
    inr = await b.ev(INERT)
    res["checks"]["background_inert"] = {"pass": all(inr.values()), "inert": inr}
    order = await b.ev(FOCUS)
    res["focus_order"] = order
    tap("Tab", shift=True)
    a = await b.ev(ACTIVE)
    res["checks"]["shift_tab_wraps_to_last"] = {"pass": bool(a and a.get("inLayer") and order and a.get("testid") == order[-1]),
                                                "active": a, "expected_last": order[-1] if order else None}
    escaped = False
    seq = []
    retries = 0
    prev = None
    for _ in range(12):
        tap("Tab")
        a = await b.ev(ACTIVE)
        seq.append(a and a.get("testid"))
        if not (a and a.get("inLayer")):
            escaped = True
            break
        if a and a.get("testid") == prev:
            tap("Tab")
            retries += 1
        prev = a and a.get("testid")
    res["checks"]["tab_trap_12"] = {"pass": not escaped, "sequence": seq, "retries": retries}
    refocus()
    attempts = 0
    closed = False
    while not closed and attempts < 4:
        tap("Escape")
        attempts += 1
        closed = not await b.ev(OPEN)
    a = await b.ev(ACTIVE)
    res["checks"]["escape_closes_and_restores"] = {"pass": closed and a and a.get("testid") == trigger,
                                                   "active": a, "attempts": attempts}
    refocus()
    await b.ev(f"document.querySelector('[data-testid=\"{trigger}\"]').focus(); true")
    tap("Return")
    await asyncio.sleep(0.2)
    await click_sel(b, '[data-testid="deck-drawer-backdrop"]')
    closed = not await b.ev(OPEN)
    a = await b.ev(ACTIVE)
    res["checks"]["backdrop_closes_and_restores"] = {"pass": closed and a and a.get("testid") == trigger, "active": a}
    await b.ev(f"document.querySelector('[data-testid=\"{trigger}\"]').focus(); true")
    tap("Return")
    await asyncio.sleep(0.2)
    await b.ev("document.querySelector('[data-testid=\"deck-drawer-close\"]').focus(); true")
    tap("Return")
    closed = not await b.ev(OPEN)
    a = await b.ev(ACTIVE)
    res["checks"]["close_button_enter_restores"] = {"pass": closed and a and a.get("testid") == trigger, "active": a}
    return res


async def matrix(b):
    out = {}
    nav_hrefs = ["/", "/explore", "/graph", "/research", "/research/compose", "/sources"]
    for w in [320, 375, 768, 1024, 1280]:
        await b.cmd("browsingContext.setViewport", {"context": b.ctx, "viewport": {"width": w, "height": 900}})
        await asyncio.sleep(0.35)
        info = await b.ev("""(() => {
          const rect=e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};};
          const vis=e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&e.getClientRects().length>0;};
          const toggle=document.querySelector('[data-testid="nav-menu-toggle"]');
          const nav=document.querySelector('[data-testid="deck-open-browse"]');
          const links=[...document.querySelectorAll('header a[href]')].filter(vis).map(a=>a.getAttribute('href'));
          return {iw:innerWidth, hamburgerVisible: toggle?vis(toggle):false,
                  triggers: {browse: !!(nav&&vis(nav)), tray: (()=>{const t=document.querySelector('[data-testid="deck-open-tray"]');return !!(t&&vis(t));})()},
                  headerLinks: links}; })()""")
        entry = {"innerWidth": info["iw"], "hamburgerVisible": info["hamburgerVisible"],
                 "triggers": info["triggers"], "headerLinks": info["headerLinks"]}
        if w < 768:
            await click_sel(b, '[data-testid="nav-menu-toggle"]')
            await asyncio.sleep(0.2)
            menu = await b.ev("""(() => { const m=document.querySelector('#global-nav-menu'); if(!m) return null;
              const r=e=>{const x=e.getBoundingClientRect();return {x:Math.round(x.x),right:Math.round(x.right),w:Math.round(x.width)};};
              const links=[...m.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
              const anyOverflow=[...m.querySelectorAll('a[href]')].some(a=>r(a).right>innerWidth+1);
              return {links, anyOverflow, menuRect:(()=>{const g=m.getBoundingClientRect();return {x:Math.round(g.x),right:Math.round(g.right)};})()}; })()""")
            entry["menu"] = menu
            entry["menuHasAllPrimaryNav"] = bool(menu) and all(h in (menu["links"] or []) for h in nav_hrefs)
            await click_sel(b, '[data-testid="nav-menu-toggle"]')
        else:
            entry["headerHasAllPrimaryNav"] = all(h in info["headerLinks"] for h in nav_hrefs)
        out[str(w)] = entry
    return out


async def main():
    async with websockets.connect(f"ws://127.0.0.1:{PORT}/session") as ws:
        b = B(ws)
        await b.cmd("session.new", {"capabilities": {}})
        t = await b.cmd("browsingContext.getTree", {})
        b.ctx = str(t["contexts"][0]["context"])
        await b.cmd("browsingContext.navigate", {"context": b.ctx, "url": APP, "wait": "complete"})
        await asyncio.sleep(1.0)
        await b.cmd("browsingContext.setViewport", {"context": b.ctx, "viewport": {"width": 1024, "height": 900}})
        await asyncio.sleep(0.3)
        report["ua"] = await b.ev("navigator.userAgent")
        report["hasFocus"] = await b.ev("document.hasFocus()")
        await click(b, 520, 320)
        for _ in range(3):
            tap("Tab")
        report["browse"] = await drawer_pass(b, "deck-open-browse", "Browse categories")
        report["tray"] = await drawer_pass(b, "deck-open-tray", "Research tray")
        report["matrix"] = await matrix(b)
    json.dump(report, open(REPORT, "w"), indent=2)
    print(json.dumps(report, indent=2)[:6000])


asyncio.run(main())