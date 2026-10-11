"""Focus a Firefox window on a live X display via EWMH _NET_ACTIVE_WINDOW.

Without an actual window-manager activation, Gecko's default Enter/Space button
activation is suppressed even when key events reach the content document
(document.hasFocus() may also read false). This helper asks the WM to focus the
Firefox window that is running against the given profile, which resolves that.

Requires: python-xlib.
"""
import argparse
import re
import subprocess
import sys
import time

from Xlib import X, display, protocol


def get_pid(w, d):
    try:
        p = w.get_full_property(d.intern_atom("_NET_WM_PID"), X.AnyPropertyType)
        return p.value[0] if p else None
    except Exception:
        return None


def walk(root, depth=0, acc=None, maxdepth=6):
    if acc is None:
        acc = []
    try:
        children = root.query_tree().children
    except Exception:
        return acc
    for w in children:
        acc.append(w)
        if depth < maxdepth:
            walk(w, depth + 1, acc, maxdepth)
    return acc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-d", "--display", default=":0")
    ap.add_argument("-p", "--profile", default="~/.bidi-prof")
    args = ap.parse_args()

    profile = args.profile
    # Match only firefox processes (avoids matching this script's own argv,
    # which contains the profile path but never the words firefox/--profile).
    pattern = "firefox.*--profile.*" + re.escape(profile)
    pids = {int(x) for x in subprocess.check_output(["pgrep", "-f", pattern]).decode().split()}
    print("firefox pids:", sorted(pids))

    d = display.Display(args.display)
    root = d.screen().root
    target = None
    for w in walk(root):
        try:
            cls = w.get_wm_class()
        except Exception:
            cls = None
        if cls and "Navigator" in str(cls) and get_pid(w, d) in pids:
            target = w

    if not target:
        print("NO MATCHING FIREFOX WINDOW")
        sys.exit(1)
    print("target", hex(target.id), "pid", get_pid(target, d))

    data = [2, X.CurrentTime, 0, 0, 0]
    ev = protocol.event.ClientMessage(
        window=target, client_type=d.intern_atom("_NET_ACTIVE_WINDOW"), data=(32, data)
    )
    d.screen().root.send_event(ev, event_mask=X.SubstructureRedirectMask | X.SubstructureNotifyMask)
    d.sync()
    time.sleep(0.8)
    act = d.screen().root.get_full_property(d.intern_atom("_NET_ACTIVE_WINDOW"), X.AnyPropertyType)
    print("_NET_ACTIVE_WINDOW now:", hex(act.value[0]) if act else None)
    print("activation requested")


main()