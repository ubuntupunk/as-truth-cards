"""Diagnostic: hasFocus + default-activation probe.

Documents two facts important for interpreting the driver results:
1. In the BiDi automation channel document.hasFocus() can be false even on a
   focused window, and
2. BiDi *synthetic* Enter/Space do not trigger default button activation (not
   even for a plain injected <button onclick>), whereas real XTest keys do.

Also reports elementFromPoint at the hamburger toggle to demonstrate that a
missed synthetic pointer click is not an element underlap problem.

Usage: launch headless-or-headed BiDi Firefox first; then run this against it.
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
ENTER = "\uE007"
SPACE = "\uE00D"
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


async def key(b, val):
    await b.cmd("input.performActions", {"context": b.ctx, "actions": [
        {"type": "key", "id": "kb", "actions": [
            {"type": "keyDown", "value": val}, {"type": "keyUp", "value": val}]}]})
    await asyncio.sleep(0.25)


async def click(b, x, y):
    await b.cmd("input.performActions", {"context": b.ctx, "actions": [
        {"type": "pointer", "id": "m", "parameters": {"pointerType": "mouse"}, "actions": [
            {"type": "pointerMove", "x": int(x), "y": int(y), "duration": 0},
            {"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0}]}]})
    await asyncio.sleep(0.25)


def xtest_key(name):
    k = xd.keysym_to_keycode(XK.string_to_keysym(name))
    xtest.fake_input(xd, X.KeyPress, k)
    xd.sync()
    time.sleep(0.06)
    xtest.fake_input(xd, X.KeyRelease, k)
    xd.sync()
    time.sleep(0.2)


async def main():
    async with websockets.connect(f"ws://127.0.0.1:{PORT}/session") as ws:
        b = B(ws)
        await b.cmd("session.new", {"capabilities": {}})
        t = await b.cmd("browsingContext.getTree", {})
        b.ctx = str(t["contexts"][0]["context"])
        await b.cmd("browsingContext.navigate", {"context": b.ctx, "url": APP, "wait": "complete"})
        await asyncio.sleep(0.5)
        await b.cmd("browsingContext.setViewport", {"context": b.ctx, "viewport": {"width": 1024, "height": 900}})
        await asyncio.sleep(0.3)

        print("hasFocus:", await b.ev("document.hasFocus()"), "visibility:", await b.ev("document.visibilityState"))

        print("=== control: plain injected button + BiDi synthetic ENTER ===")
        await b.ev("""(() => { const btn=document.createElement('button'); btn.id='ctl-btn';
            btn.textContent='ctl'; btn.style.position='fixed'; btn.style.left='5px'; btn.style.top='5px';
            btn.onclick=()=>{window.__ctl=(window.__ctl||0)+1;}; document.body.appendChild(btn);
            btn.focus(); window.__ctl=0; return document.activeElement===btn; })()""")
        await key(b, ENTER)
        print("control activated by BiDi ENTER:", await b.ev("window.__ctl"))
        await b.ev("document.getElementById('ctl-btn').remove(); true")

        print("=== control: plain injected button + real XTest Return (if display-focused) ===")
        await b.ev("""(() => { const btn=document.createElement('button'); btn.id='ctl-btn2';
            btn.textContent='ctl2'; btn.style.position='fixed'; btn.style.left='5px'; btn.style.top='5px';
            btn.onclick=()=>{window.__ctl2=(window.__ctl2||0)+1;}; document.body.appendChild(btn);
            btn.focus(); window.__ctl2=0; return true; })()""")
        xtest_key("Return")
        print("control activated by XTest Return:", await b.ev("window.__ctl2"))
        await b.ev("document.getElementById('ctl-btn2').remove(); true")

        print("=== keydown delivery + activation on drawer trigger (BiDi synthetic keys) ===")
        await b.ev("""window.__clicks=[]; window.__keys=[];
            document.addEventListener('keydown', e => window.__keys.push('down:'+e.key), true);
            document.addEventListener('click', e => window.__clicks.push(e.target), true); true""")
        for name, val in [("ENTER", ENTER), ("SPACE", SPACE)]:
            await b.ev("document.querySelector('[data-testid=\"deck-open-browse\"]').focus(); window.__clicks=[]; window.__keys=[]; true")
            await key(b, val)
            opened = await b.ev("!!document.querySelector('[data-testid=\"deck-drawer-layer\"]')")
            clicks = await b.ev("window.__clicks") or []
            print(f"{name}: opened={opened} keys={await b.ev('window.__keys')} clicks={len(clicks)}")
            if opened:
                await b.ev("document.querySelector('[data-testid=\"deck-drawer-close\"]').click(); true")

        print("=== elementFromPoint at hamburger toggle (320) ===")
        await b.cmd("browsingContext.setViewport", {"context": b.ctx, "viewport": {"width": 320, "height": 568}})
        await asyncio.sleep(0.4)
        info = await b.ev("""(() => {
          const t=document.querySelector('[data-testid="nav-menu-toggle"]');
          const r=t.getBoundingClientRect();
          const cx=Math.round(r.x+r.width/2), cy=Math.round(r.y+r.height/2);
          const el=document.elementFromPoint(cx,cy);
          const chain=[]; let e=el; while(e&&chain.length<6){chain.push((e.getAttribute&&e.getAttribute('data-testid'))||e.tagName); e=e.parentElement;}
          return {toggleRect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
                  cx,cy, hit:(el&&el.tagName), hitIsToggle:(el===t||t.contains(el)), chain,
                  headerTransform:getComputedStyle(t.closest('header')).transform}; })()""")
        print(json.dumps(info, indent=2))


asyncio.run(main())