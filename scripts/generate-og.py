#!/usr/bin/env python3
"""
Renders the Open Graph / social share card into public/assets/packowell-og.png.

1200x630 (the size Facebook, LinkedIn and X all crop from), built from the real
logo assets so the card can never drift from the site's brand. Chromium renders
the layout, then the PNG is quantised to a 256-colour palette: the artwork is
flat ochre/cream/ink, so there is no visible banding but the file drops from
~160 kB to ~59 kB.

Run: python3 scripts/generate-og.py
Requires: chromium at /usr/bin/chromium, Pillow, and the Manrope instances
produced from the Manrope variable font.
"""

import os
import subprocess
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TMP = os.path.join(ROOT, ".tmp")
FONTS = os.path.join(TMP, "fonts")
OUT = os.path.join(ROOT, "public", "assets", "packowell-og.png")
CHROMIUM = "/usr/bin/chromium"
W, H = 1200, 630

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @font-face {{ font-family: ManropeX; src: url('./fonts/manrope-700.ttf') format('truetype'); font-weight: 700; }}
  @font-face {{ font-family: ManropeX; src: url('./fonts/manrope-500.ttf') format('truetype'); font-weight: 500; }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ width: {W}px; height: {H}px; }}
  body {{
    background: #faf8f5;
    font-family: ManropeX, system-ui, sans-serif;
    color: #191614;
    position: relative;
    overflow: hidden;
  }}
  .wash {{
    position: absolute;
    top: -260px;
    right: -220px;
    width: 720px;
    height: 720px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(217,160,74,0.20) 0%, rgba(217,160,74,0.06) 55%, rgba(217,160,74,0) 72%);
  }}
  .edge {{ position: absolute; left: 0; top: 0; width: 10px; height: 100%; background: #d9a04a; }}
  .frame {{
    position: absolute;
    inset: 0;
    padding: 62px 72px 54px 82px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }}
  /* align-self is required: a column flex container stretches its children, and a
     stretched img letterboxes the SVG inside the box instead of sitting left. */
  .logo {{ height: 74px; width: auto; align-self: flex-start; flex: none; }}
  .headline {{ margin-top: 66px; font-size: 64px; font-weight: 700; line-height: 1.09; letter-spacing: -0.022em; max-width: 900px; }}
  .headline em {{ font-style: normal; color: #b8791f; }}
  .sub {{ margin-top: 24px; font-size: 22px; font-weight: 500; line-height: 1.5; color: #4a423c; max-width: 820px; }}
  .rule {{ margin-top: auto; width: 100%; height: 2px; background: #e5ddd0; }}
  .foot {{ margin-top: 20px; width: 100%; display: flex; align-items: baseline; justify-content: space-between; font-size: 19px; font-weight: 500; color: #4a423c; }}
  .foot strong {{ color: #191614; font-weight: 700; }}
  .dot {{ color: #d9a04a; padding: 0 10px; }}
</style>
</head>
<body>
  <div class="wash"></div>
  <div class="edge"></div>
  <div class="frame">
    <img class="logo" src="../public/assets/packowell-logo.png" alt="Packowell">
    <div class="headline">Packaging, printing<br>and <em>retail displays</em></div>
    <div class="sub">Set the dimensions, watch the panels fold, export the dieline and send the specification for quotation.</div>
    <div class="rule"></div>
    <div class="foot">
      <span><strong>packowell.com</strong><span class="dot">·</span>Thane, Maharashtra, India</span>
      <span>+91 77159 12764</span>
    </div>
  </div>
</body>
</html>
"""


def ensure_fonts():
    src = os.path.join(FONTS, "manrope.ttf")
    if not os.path.exists(src):
        sys.exit("missing .tmp/fonts/manrope.ttf — the Manrope variable font is required for the headline")
    os.makedirs(FONTS, exist_ok=True)
    for weight in (700, 500):
        path = os.path.join(FONTS, f"manrope-{weight}.ttf")
        if not os.path.exists(path):
            var = TTFont(src)
            instantiateVariableFont(var, {"wght": weight}, updateFontNames=False).save(path)


def main():
    ensure_fonts()
    os.makedirs(TMP, exist_ok=True)
    html = os.path.join(TMP, "og.html")
    with open(html, "w") as f:
        f.write(TEMPLATE.format(W=W, H=H))

    subprocess.run(
        [
            CHROMIUM, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
            "--force-device-scale-factor=1", f"--window-size={W},{H}",
            f"--screenshot={OUT}", f"file://{html}",
        ],
        check=True,
        capture_output=True,
    )

    raw = os.path.getsize(OUT)
    im = Image.open(OUT).convert("RGB")
    if im.size != (W, H):
        sys.exit(f"unexpected size {im.size}, wanted {(W, H)}")
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(
        OUT, optimize=True
    )
    print(f"wrote packowell-og.png: {W}x{H}, {raw} -> {os.path.getsize(OUT)} bytes")


if __name__ == "__main__":
    main()
