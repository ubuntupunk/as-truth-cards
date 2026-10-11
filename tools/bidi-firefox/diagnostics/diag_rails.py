"""Diagnostic: rails vs drawer triggers at xl+ viewports.

At >=1280px the deck workspace switches to the three-column xl layout and the
two drawer triggers are hidden (xl:hidden) because the browse/tray rails are
rendered permanently. This probe confirms the rails are actually visible and
populated at 1280/1440 so the affordances remain reachable.
"""
import asyncio
import json
import os

import websockets

PROFILE = os.path.expanduser(os.environ.get("BIDI_PROFILE", "~/.bidi-prof"))
PORT = json.load(open(f"{PROFILE}/WebDriverBiDiServer.json"))["ws_port"]
APP = os.environ.get("APP_URL", "http://localhost:3001/")


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


async def main():
    async with websockets.connect(f"ws://127.0.0.1:{PORT}/session") as ws:
        b = B(ws)
        await b.cmd("session.new", {"capabilities": {}})
        t = await b.cmd("browsingContext.getTree", {})
        b.ctx = str(t["contexts"][0]["context"])
        await b.cmd("browsingContext.navigate", {"context": b.ctx, "url": APP, "wait": "complete"})
        await asyncio.sleep(1.0)
        for w in [1280, 1440]:
            await b.cmd("browsingContext.setViewport", {"context": b.ctx, "viewport": {"width": w, "height": 900}})
            await asyncio.sleep(0.35)
            r = await b.ev("""(() => {
              const vis=e=>e&&e.getClientRects().length>0&&getComputedStyle(e).display!=='none';
              const grid=document.querySelector('[data-testid="deck-workspace"]');
              const cols=grid?getComputedStyle(grid).gridTemplateColumns:null;
              const cells=[...document.querySelectorAll('[data-testid="deck-workspace"] > div')];
              const browseLink=cells[0]&&cells[0].querySelector('a[href="/graph"]');
              const trayAdd=cells[2]&&cells[2].querySelector('[data-testid="research-tray-add"]');
              return {innerWidth:innerWidth, gridCols:cols,
                      browseRailVisible:vis(cells[0]), trayRailVisible:vis(cells[2]),
                      browseRailHasLink:vis(browseLink), trayRailHasAdd:vis(trayAdd)}; })()""")
            print(w, json.dumps(r))


asyncio.run(main())