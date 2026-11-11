#!/usr/bin/env python3
"""Draw the At-Turaif (ad-Diriyah) line-art skyline behind the home page.

    python3 visual/diriyah_skyline.py

Writes, next to this file:
  diriyah-left.svg  (300 x 400)  left margin: a watchtower, a house, palms
  diriyah-wide.svg  (600 x 400)  under the photo and on into the right margin:
                                 low houses and palms under the photo (so it
                                 never reaches the photo), then Salwa Palace
                                 between two watchtowers in the margin

The page shows both at the sidebar's scale, 260px per 300 drawing units; see
.skyline in styles.css. After regenerating, bump the ?v= on both SVG URLs in
styles.css and the styles.css?v= in index.html, or browsers keep the old
drawings for up to ten minutes.

Najdi cues used throughout: mud-brick walls that taper as they rise,
triangular crenellations along every roof line, rows of small triangular
vents, tall tapering watchtowers, Wadi Hanifa palms.
"""
from pathlib import Path

H, G = 400, 385            # canvas height and ground line
INK = "#800020"            # site crimson
BG = "#f5f5f5"             # page background; buildings are filled with it so
                           # whatever stands behind them is hidden

W = 300
out = []


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def poly(pts):
    out.append(f'<polygon points="{" ".join(f"{f(x)},{f(y)}" for x, y in pts)}" fill="{BG}"/>')


def path(d, extra=""):
    out.append(f'<path d="{d}" fill="none"{extra}/>')


def block(x0, x1, top, taper=0.04, bottom=G):
    """Tapering mud-brick mass. Returns the roof's x-extent."""
    inset = (x1 - x0) * taper
    poly([(x0, bottom), (x1, bottom), (x1 - inset, top), (x0 + inset, top)])
    return x0 + inset, x1 - inset


def crenels(x0, x1, y, s=9, gap=5):
    """Row of triangular merlons with flat gaps between them."""
    n = max(1, int((x1 - x0 + gap) // (s + gap)))
    pad = ((x1 - x0) - (n * s + (n - 1) * gap)) / 2
    x = x0 + pad
    d = f"M{f(x0)},{f(y)} L{f(x)},{f(y)}"
    for i in range(n):
        d += f" L{f(x + s / 2)},{f(y - s * 0.95)} L{f(x + s)},{f(y)}"
        x += s
        if i < n - 1:
            d += f" L{f(x + gap)},{f(y)}"
            x += gap
    d += f" L{f(x1)},{f(y)}"
    path(d)


def vents(x0, x1, y, s=6, step=14):
    """Row of small triangular vents, centred between x0 and x1."""
    n = max(1, int((x1 - x0) // step))
    start = x0 + ((x1 - x0) - (n - 1) * step) / 2
    for i in range(n):
        cx = start + i * step
        path(f"M{f(cx - s / 2)},{f(y)} L{f(cx)},{f(y - s)} L{f(cx + s / 2)},{f(y)} Z")


def door(cx, w=16, h=30, bottom=G):
    x = cx - w / 2
    path(f"M{f(x)},{f(bottom)} V{f(bottom - h)} H{f(x + w)} V{f(bottom)}")
    path(f"M{f(x + 2)},{f(bottom - h - 4)} L{f(cx)},{f(bottom - h - 12)} L{f(x + w - 2)},{f(bottom - h - 4)}")


def window(cx, y, w=7, h=11):
    path(f"M{f(cx - w / 2)},{f(y)} h{f(w)} v{f(h)} h{f(-w)} Z")


def tower(cx, h, wb=46, wt=26, bottom=G, bands=(0.25, 0.5, 0.75)):
    """Tapering watchtower: storey bands, an arrow slit per storey, vents up top."""
    top = bottom - h
    poly([(cx - wb / 2, bottom), (cx + wb / 2, bottom), (cx + wt / 2, top), (cx - wt / 2, top)])
    crenels(cx - wt / 2, cx + wt / 2, top, s=7, gap=3)
    for frac in bands:
        y = bottom - h * frac
        half = (wb + (wt - wb) * frac) / 2
        path(f"M{f(cx - half)},{f(y)} H{f(cx + half)}")
    edges = (0,) + tuple(bands) + (1,)
    for a, b in zip(edges, edges[1:]):
        y = bottom - h * (a + b) / 2
        path(f"M{f(cx)},{f(y - 9)} V{f(y + 3)}")
    vents(cx - wt / 2 + 2, cx + wt / 2 - 2, top + 14, s=5, step=9)


def palm(x, h, lean=0.0, bottom=G):
    tx, ty = x + lean * h, bottom - h
    path(f"M{f(x)},{f(bottom)} Q{f(x + lean * h * 0.2)},{f(bottom - h * 0.55)} {f(tx)},{f(ty)}")
    for k in range(1, 8):                        # trunk rings
        t = k / 8
        rx = x + (tx - x) * t ** 1.4
        ry = bottom - h * t
        path(f"M{f(rx - 2.5)},{f(ry)} h5")
    # fronds: arch up and out, then droop past the crown
    for dx, dy, cx, cy in [(-38, 16, -22, -18), (-30, 26, -12, -10), (-20, -14, -10, -24),
                           (-6, -26, -4, -26), (8, -24, 6, -28), (22, -12, 12, -24),
                           (32, 24, 14, -10), (40, 14, 24, -18)]:
        path(f"M{f(tx)},{f(ty)} Q{f(tx + cx)},{f(ty + cy)} {f(tx + dx)},{f(ty + dy)}")


def ground():
    """One firm line, with broken ones in front repeating every 300 units."""
    path(f"M0,{G} H{W}")
    for y, segs in [(G + 7, [(10, 130), (170, 290)]), (G + 13, [(50, 250)])]:
        for i in range(int(W / 300)):
            for a, b in segs:
                path(f"M{a + 300 * i},{y} H{b + 300 * i}", ' stroke-opacity=".6"')


def svg():
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" aria-hidden="true">'
            f'<g stroke="{INK}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" '
            f'opacity=".42">' + "".join(out) + "</g></svg>\n")


# ── scenes, drawn back to front ─────────────────────────────────────

def left():
    """Outer edge is x=0: watchtower and palms there, a house toward the text."""
    palm(250, 214, -0.1)
    rx0, rx1 = block(126, 282, G - 128, taper=0.04)
    crenels(rx0, rx1, G - 128)
    vents(rx0 + 6, rx1 - 6, G - 115)
    path(f"M{f(126 + 3)},{G - 64} H{f(282 - 3)}")
    door(244)
    for cx, y in [(156, G - 100), (178, G - 100), (156, G - 50), (204, G - 100)]:
        window(cx, y)
    tower(92, 318, wb=58, wt=30)
    palm(26, 190, 0.1)
    ground()


def wide():
    """x 0-300 sits under the photo and stays low; x 300-600 is the margin."""
    # under the photo: low
    palm(28, 132, 0.08)
    rx0, rx1 = block(14, 148, G - 96, taper=0.04)
    crenels(rx0, rx1, G - 96)
    vents(rx0 + 6, rx1 - 6, G - 83)
    door(52)
    for cx in (96, 118):
        window(cx, G - 62)
    rx0, rx1 = block(148, 232, G - 72, taper=0.04)
    crenels(rx0, rx1, G - 72)
    vents(rx0 + 6, rx1 - 6, G - 59)
    door(200)
    window(170, G - 50)
    block(232, 330, G - 40, taper=0.02)
    crenels(234, 328, G - 40, s=7, gap=4)
    palm(250, 140, -0.06)
    # margin: Salwa Palace (lower and upper mass) between two watchtowers
    rx0, rx1 = block(342, 540, G - 150, taper=0.03)
    crenels(rx0, rx1, G - 150)
    vents(rx0 + 8, rx1 - 8, G - 136, s=6, step=15)
    r0, r1 = block(372, 512, G - 236, taper=0.05, bottom=G - 150)
    crenels(r0, r1, G - 236)
    vents(r0 + 8, r1 - 8, G - 222, s=6, step=15)
    for cx in (402, 432, 474, 498):
        window(cx, G - 206)
    for cx in (402, 492):
        window(cx, G - 110, h=13)
    path(f"M{448 - 30},{G} V{G - 44} H{448 + 30} V{G}")    # gate recess
    door(448, w=24, h=40)
    tower(334, 262, wb=50, wt=26)
    tower(548, 330, wb=58, wt=32)
    palm(586, 196, -0.12)
    ground()


if __name__ == "__main__":
    here = Path(__file__).resolve().parent
    for name, width, scene in [("diriyah-left.svg", 300, left), ("diriyah-wide.svg", 600, wide)]:
        W, out = width, []
        scene()
        (here / name).write_text(svg())
        print("wrote", here / name)
