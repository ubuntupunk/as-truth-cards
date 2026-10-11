"""Diagnostic: app-button activation with real XTest keys.

Headerless/BiDi synthetic Enter/Space do not fire default button activation,
but real OS-level XTest keys do (once the window is focused and a short warm-up
is given). This probe demonstrates that on the app's own drawer trigger:
Enter, KP_Enter, and Space each open the drawer.

Usage: run.sh diagnostics/diag_activation.py (headed Firefox on a real display).
"""
import asyncio
import json
import os
import time

import websockets
from Xlib import X, XK, display
from Xlib.ext import xtest

PROFILE = os.path.expanduser(os.environ.get("BIDI_PROFILE", "~/.bidi-prof"))
PORT = json.load(open(f"{PROFILE}/WebDriverBiDiServer.json"))["ws_port"]
APP = os.environ.get("APP_URL", "http://localhost:3001/")
xd = display.Display(os.environ.get("DISPLAY", ":0"))


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


async def click(b, x, y):
    await b.cmd("input.performActions", {"context": b.ctx, "actions": [
        {"type": "pointer", "id": "m", "parameters": {"pointerType": "mouse"}, "actions": [
            {"type": "pointerMove", "x": int(x), "y": int(y), "duration": 0},
            {"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0}]}]})
    await asyncio.sleep(0.2)


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
    time.sleep(0.2)


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
        await click(b, 500, 300)
        await b.ev("window.__keys=[]; document.addEventListener('keydown', e=>window.__keys.push('d:'+e.key), true); true")
        print("hasFocus:", await b.ev("document.hasFocus()"), "href:", await b.ev("location.href"))

        for _ in range(3):
            tap("Tab")
        print("warmup keys:", await b.ev("window.__keys"))

        for name in ["Return", "KP_Enter", "space"]:
            await b.ev("document.querySelector('[data-testid=\"deck-open-browse\"]').focus(); window.__keys=[]; true")
            tap(name)
            opened = await b.ev("!!document.querySelector('[data-testid=\"deck-drawer-layer\"]')")
            print(f"{name}: opened={opened} keys={await b.ev('window.__keys')}")
            if opened:
                await b.ev("document.querySelector('[data-testid=\"deck-drawer-close\"]').click(); true")
                await asyncio.sleep(0.2)


asyncio.run(main())