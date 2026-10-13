#!/usr/bin/env python3
"""Generates iOS PWA launch images (apple-touch-startup-image) in public/splash/.

iOS shows a white screen while an installed web app starts unless a launch image matching the
exact device resolution exists. Run once after changing the icon:  python3 scripts/generate-splash.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BG = (7, 10, 18)  # #070A12 — same as the app background

# (css width, css height, pixel ratio) for current and recent iPhones, portrait
DEVICES = [
    (440, 956, 3),  # 16/17 Pro Max
    (402, 874, 3),  # 16/17 Pro, 17
    (420, 912, 3),  # Air
    (430, 932, 3),  # 14/15 Pro Max, 15/16 Plus
    (393, 852, 3),  # 14 Pro, 15, 15 Pro, 16
    (428, 926, 3),  # 12/13 Pro Max, 14 Plus
    (390, 844, 3),  # 12, 13, 14, 12/13 Pro
    (375, 812, 3),  # X, XS, 11 Pro, 12/13 mini
    (414, 896, 3),  # XS Max, 11 Pro Max
    (414, 896, 2),  # XR, 11
    (375, 667, 2),  # SE 2/3, 8
]


def main() -> None:
    icon = Image.open(ROOT / "public" / "pwa-512x512.png").convert("RGBA")
    out_dir = ROOT / "public" / "splash"
    out_dir.mkdir(parents=True, exist_ok=True)
    links = []
    for w, h, r in DEVICES:
        pw, ph = w * r, h * r
        img = Image.new("RGB", (pw, ph), BG)
        size = int(pw * 0.30)
        ic = icon.resize((size, size), Image.LANCZOS)
        img.paste(ic, ((pw - size) // 2, int(ph * 0.42) - size // 2), ic)
        name = f"launch-{pw}x{ph}.png"
        img.save(out_dir / name, optimize=True)
        links.append(
            f'<link rel="apple-touch-startup-image" href="/splash/{name}" '
            f'media="(device-width: {w}px) and (device-height: {h}px) and '
            f'(-webkit-device-pixel-ratio: {r}) and (orientation: portrait)" />'
        )
    print("\n".join(links))


if __name__ == "__main__":
    main()
