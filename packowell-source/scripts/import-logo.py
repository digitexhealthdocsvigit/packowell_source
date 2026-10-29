#!/usr/bin/env python3
"""
Imports the supplied Packowell artwork into web-ready assets.

The source PNGs are opaque RGB with a baked background (the lockup on warm cream
#fdfbf5, the emblem on white #fefefe), so they cannot be dropped onto the cream
navbar or the ink footer without a visible rectangle. This script removes the
background to transparency, trims to the artwork, and emits optimised PNG/WebP at
the sizes the site actually renders.

Background removal is edge-seeded, not a global threshold: alpha is derived from
each pixel's distance to the measured background colour, then the colour is
un-premultiplied so antialiased edges do not carry a white halo onto dark or
tinted grounds. Interior whites (the counter of the "o", the gaps between the
ribbons) are kept as real holes, which is what the artwork intends.

The artwork itself is never redrawn — only trimmed, de-backgrounded and resized.

Run: python3 scripts/import-logo.py
Inputs: files/Packowell_Folded_Ribbon_Logo.png, files/Interlocking_Amber_Ribbon_Emblem.png
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORKSPACE = os.path.dirname(ROOT)
SRC_LOCKUP = os.path.join(WORKSPACE, "files", "Packowell_Folded_Ribbon_Logo.png")
SRC_MARK = os.path.join(WORKSPACE, "files", "Interlocking_Amber_Ribbon_Emblem.png")
OUT = os.path.join(ROOT, "public", "assets")

# distance band over which a pixel fades from background to artwork
T0, T1 = 8.0, 34.0


def background_colour(a: np.ndarray) -> np.ndarray:
    """Median of the 2px border: robust against a slightly noisy background."""
    edge = np.concatenate([
        a[:2].reshape(-1, 3), a[-2:].reshape(-1, 3),
        a[:, :2].reshape(-1, 3), a[:, -2:].reshape(-1, 3),
    ])
    return np.median(edge, axis=0)


def debackground(path: str) -> Image.Image:
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    bg = background_colour(a)

    dist = np.abs(a - bg).max(axis=2)
    alpha = np.clip((dist - T0) / (T1 - T0), 0.0, 1.0)

    # Un-premultiply: a pixel that is 40% artwork over white currently holds 60%
    # white. Recover the artwork colour so the edge does not glow on dark grounds.
    a_safe = np.clip(alpha, 1e-3, 1.0)[..., None]
    un = (a - bg[None, None, :] * (1.0 - a_safe)) / a_safe
    un = np.clip(un, 0, 255)
    rgb = np.where(alpha[..., None] > 0.004, un, 0.0)

    out = np.dstack([rgb, alpha * 255.0]).round().astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def trim(im: Image.Image, pad_ratio: float = 0.012) -> Image.Image:
    bbox = im.split()[-1].point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return im
    im = im.crop(bbox)
    pad = max(2, int(round(min(im.size) * pad_ratio)))
    canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    canvas.alpha_composite(im, (pad, pad))
    return canvas


def save(im: Image.Image, stem: str, widths: list[int]) -> None:
    for w in widths:
        if w > im.width:
            continue
        h = max(1, round(im.height * w / im.width))
        r = im.resize((w, h), Image.LANCZOS)
        suffix = "" if w == widths[0] else f"@{w}w"
        png = os.path.join(OUT, f"{stem}{suffix}.png")
        webp = os.path.join(OUT, f"{stem}{suffix}.webp")
        r.save(png, optimize=True)
        r.save(webp, quality=92, method=6)
        print(f"  {os.path.basename(png):34s} {r.width}x{r.height}  "
              f"{os.path.getsize(png)//1024} kB   "
              f"{os.path.basename(webp):30s} {os.path.getsize(webp)//1024} kB")


def favicon(mark: Image.Image, size: int, plate: str, radius_ratio: float, name: str) -> None:
    """The emblem on a light plate, so the charcoal ribbon survives a dark tab bar."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=plate)
    inner = int(size * 0.76)
    h = max(1, round(mark.height * inner / mark.width))
    m = mark.resize((inner, h), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - inner) // 2, (size - h) // 2))
    path = os.path.join(OUT, name)
    canvas.save(path, optimize=True)
    print(f"  {name:34s} {size}x{size}  {os.path.getsize(path)//1024} kB")


def main():
    for p in (SRC_LOCKUP, SRC_MARK):
        if not os.path.exists(p):
            sys.exit(f"missing source artwork: {p}")
    os.makedirs(OUT, exist_ok=True)

    print("lockup (mark + wordmark + tagline)")
    lockup = trim(debackground(SRC_LOCKUP))
    print(f"  trimmed: {lockup.width}x{lockup.height}  aspect {lockup.width/lockup.height:.4f}")
    save(lockup, "packowell-logo", [1400, 700, 420])

    print("emblem (mark only)")
    mark = trim(debackground(SRC_MARK))
    print(f"  trimmed: {mark.width}x{mark.height}  aspect {mark.width/mark.height:.4f}")
    save(mark, "packowell-mark", [512, 256])

    print("favicon / touch icons")
    favicon(mark, 512, "#ffffff", 0.18, "packowell-icon-512.png")
    favicon(mark, 180, "#ffffff", 0.18, "packowell-icon-180.png")
    favicon(mark, 64, "#ffffff", 0.18, "packowell-icon-64.png")

    # proof sheet: the transparent assets over cream and over ink
    print("\nwrote contact sheet for review: .tmp/logo-import-check.png")
    W, H = 1240, 620
    sheet = Image.new("RGBA", (W, H), (250, 248, 245, 255))
    ImageDraw.Draw(sheet).rectangle([0, H // 2, W, H], fill=(25, 22, 20, 255))
    lg = lockup.resize((640, round(lockup.height * 640 / lockup.width)), Image.LANCZOS)
    sheet.alpha_composite(lg, (48, (H // 4) - lg.height // 2))
    mk = mark.resize((150, round(mark.height * 150 / mark.width)), Image.LANCZOS)
    sheet.alpha_composite(mk, (48 + 640 + 60, (H // 4) - mk.height // 2))
    icon = Image.open(os.path.join(OUT, "packowell-icon-180.png")).resize((96, 96), Image.LANCZOS)
    sheet.alpha_composite(icon, (48 + 640 + 60 + 150 + 50, (H // 4) - 48))
    sheet.alpha_composite(lg, (48, (3 * H) // 4 - lg.height // 2))
    sheet.alpha_composite(mk, (48 + 640 + 60, (3 * H) // 4 - mk.height // 2))
    sheet.alpha_composite(icon, (48 + 640 + 60 + 150 + 50, (3 * H) // 4 - 48))
    sheet.save(os.path.join(ROOT, ".tmp", "logo-import-check.png"))


if __name__ == "__main__":
    main()
