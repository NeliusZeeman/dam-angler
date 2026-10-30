# The app icon (home screen, install): a largemouth bass leaping out of a
# dam at sunset, from the game's own fish picture.
#
#   python tools/make-icons.py
#
# Writes assets/icons/icon-192.png, icon-512.png, icon-maskable-512.png
# (fish kept inside Android's safe circle) and apple-touch-icon.png (180).

import math
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'icons')
S = 1024  # drawn big, scaled down


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def background():
    im = Image.new('RGB', (S, S))
    px = im.load()
    horizon = int(S * 0.6)
    for y in range(S):
        if y < horizon:
            c = lerp((24, 52, 88), (240, 160, 90), (y / horizon) ** 1.6)
        else:
            c = lerp((40, 70, 80), (8, 28, 40), (y - horizon) / (S - horizon))
        for x in range(S):
            px[x, y] = c
    d = ImageDraw.Draw(im, 'RGBA')
    # The sun on the horizon, and its glitter on the water.
    d.ellipse((S * 0.62, horizon - S * 0.13, S * 0.86, horizon + S * 0.11), fill=(255, 214, 140, 255))
    d.rectangle((0, horizon, S, S), fill=(18, 44, 56, 120))
    for i in range(9):
        y = horizon + 14 + i * 22
        w = S * (0.10 - i * 0.008)
        d.rectangle((S * 0.74 - w, y, S * 0.74 + w, y + 5), fill=(255, 210, 140, 150 - i * 14))
    # A far bank.
    d.polygon([(0, horizon), (0, horizon - S * 0.07), (S * 0.18, horizon - S * 0.1), (S * 0.4, horizon - S * 0.04), (S * 0.55, horizon)], fill=(20, 40, 36, 255))
    return im, horizon


def fish(scale):
    f = Image.open(os.path.join(ROOT, 'assets', 'fish', 'largemouth-bass.png')).convert('RGBA')
    f = f.crop(f.getbbox())
    w = int(S * scale)
    f = f.resize((w, int(f.height * w / f.width)), Image.LANCZOS)
    return f.rotate(24, resample=Image.BICUBIC, expand=True)


def icon(scale):
    im, horizon = background()
    f = fish(scale)
    x = (S - f.width) // 2
    y = int(horizon - f.height * 0.72)
    # Splash rings where it broke the surface, and a soft shadow.
    d = ImageDraw.Draw(im, 'RGBA')
    cx, cy = S // 2, horizon + int(S * 0.08)
    for r, a in ((0.34, 90), (0.25, 130), (0.16, 170)):
        d.ellipse((cx - S * r, cy - S * r * 0.22, cx + S * r, cy + S * r * 0.22), outline=(220, 240, 245, a), width=10)
    shadow = Image.new('RGBA', f.size, (0, 0, 0, 0))
    shadow.putalpha(f.getchannel('A').point(lambda v: v * 0.45))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    im.paste(shadow, (x + 14, y + 22), shadow)
    im.paste(f, (x, y), f)
    return im


os.makedirs(OUT, exist_ok=True)
full = icon(0.86)
full.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-512.png'), optimize=True)
full.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, 'icon-192.png'), optimize=True)
full.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'), optimize=True)
icon(0.62).resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-maskable-512.png'), optimize=True)
print('icons ->', os.path.normpath(OUT))
