"""Cut the homepage food strip into one transparent WebP per food (with its soft
shadow) (the backdrop is flat cream, set in CSS).

Usage: python3 scripts/segment-home-gallery.py   (needs opencv-python-headless, numpy, pillow)
Reads  src/resource/home-food-gallery.webp
Writes src/resource/home-gallery/<slug>.webp and layout.json
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/resource/home-food-gallery.webp"
OUT = ROOT / "src/resource/home-gallery"
OUT.mkdir(parents=True, exist_ok=True)

im = np.array(Image.open(SRC).convert("RGB"))
f = im.astype(np.float32)
H, W, _ = im.shape
K = W / 2000  # boxes below are measured on a 2000px-wide preview

BG = np.array([242, 239, 231], np.float32)  # the strip's backdrop is a flat cream
diff = np.abs(f - BG).max(-1)
L = f.mean(-1)
rg = (f[..., 0] - f[..., 1]) / np.maximum(L, 1)
gb = (f[..., 1] - f[..., 2]) / np.maximum(L, 1)
shadow_tone = (L > 90) & (rg > 0.01) & (rg < 0.14) & (gb > 0.03) & (gb < 0.30)

# slug: (x0, x1, y0, y1) search box, or bowl circle (cx, cy, r) in preview px
BOXES = {
    "kale": (20, 280, 165, 490), "blueberries": (292, 472, 205, 445),
    "avocado": (480, 664, 178, 442), "salmon": (915, 1094, 176, 477),
    "sweet-potato": (1118, 1306, 176, 462), "broccoli": (1534, 1758, 193, 462),
}
BOWLS = {"lentils": (782, 312, 113), "eggs": (1421, 315, 107), "yogurt": (1869, 314, 109)}

def grabcut(box):
    x0, x1, y0, y1 = [int(v * K) for v in box]
    pad = 40
    X0, X1, Y0, Y1 = max(0, x0 - pad), min(W, x1 + pad), max(0, y0 - pad), min(H, y1 + pad)
    sub = np.ascontiguousarray(im[Y0:Y1, X0:X1][..., ::-1])
    d = diff[Y0:Y1, X0:X1]
    gm = np.full(d.shape, cv2.GC_BGD, np.uint8)
    r = (slice(y0 - Y0, y1 - Y0), slice(x0 - X0, x1 - X0))
    gm[r] = cv2.GC_PR_BGD
    inner = np.zeros(d.shape, bool); inner[r] = True
    gm[inner & (d > 30)] = cv2.GC_PR_FGD
    gm[inner & (d > 60)] = cv2.GC_FGD
    gm[d < 4] = cv2.GC_BGD
    cv2.grabCut(sub, gm, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    m = ((gm == cv2.GC_FGD) | (gm == cv2.GC_PR_FGD)).astype(np.uint8)
    full = np.zeros((H, W), np.uint8); full[Y0:Y1, X0:X1] = m
    return full

def clean(m):
    m = ((m > 0) & ~shadow_tone).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    m = (lab == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros_like(m); cv2.drawContours(out, cnts, -1, 1, -1)
    return (cv2.GaussianBlur(out.astype(np.float32), (0, 0), 2.5) > 0.5).astype(np.uint8)

def fit_bowl(cx, cy, r):
    g = cv2.GaussianBlur(f.mean(-1), (0, 0), 1.5)
    mag = np.hypot(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
    cx, cy, r = cx * K, cy * K, r * K
    th = np.linspace(0, 2 * np.pi, 360, endpoint=False)
    best = None
    for dx in range(-14, 15, 2):
        for dy in range(-14, 15, 2):
            for dr in range(-14, 15, 2):
                xs = np.clip((cx + dx + (r + dr) * np.cos(th)).astype(int), 0, W - 1)
                ys = np.clip((cy + dy + (r + dr) * np.sin(th)).astype(int), 0, H - 1)
                sc = mag[ys, xs].mean()
                if best is None or sc > best[0]:
                    best = (sc, cx + dx, cy + dy, r + dr)
    m = np.zeros((H, W), np.uint8)
    cv2.circle(m, (int(best[1]), int(best[2])), int(best[3]) + 3, 1, -1)
    return m

masks = {n: clean(grabcut(b)) for n, b in BOXES.items()}
masks.update({n: fit_bowl(*c) for n, c in BOWLS.items()})
union = np.zeros((H, W), np.uint8)
for m in masks.values():
    union |= m

SHADOW_RGB = np.array([88, 66, 40], np.float32)
PAD = 70  # room around each food for its baked shadow

def shifted(a, dx, dy):
    return np.roll(np.roll(a, dy, axis=0), dx, axis=1)

layout = {}
for name, m in masks.items():
    mf = m.astype(np.float32)
    soft = cv2.GaussianBlur(cv2.erode(m, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 1.0)
    # contact shadow (tight) + ambient shadow (wide, offset down and slightly right)
    sh = np.maximum(0.30 * cv2.GaussianBlur(shifted(mf, 3, 6), (0, 0), 5),
                    0.20 * cv2.GaussianBlur(shifted(mf, 8, 20), (0, 0), 16))
    alpha = soft + sh * (1 - soft)
    rgb = f * soft[..., None] + SHADOW_RGB * (1 - soft[..., None])
    ys, xs = np.where(m > 0)
    y0, y1 = max(0, ys.min() - PAD), min(H, ys.max() + PAD)
    x0, x1 = max(0, xs.min() - PAD), min(W, xs.max() + PAD)
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)[y0:y1, x0:x1]
    Image.fromarray(rgba).save(OUT / f"{name}.webp", quality=88, method=6, alpha_quality=90)
    layout[name] = {"left": round(x0 / W * 100, 3), "top": round(y0 / H * 100, 3),
                    "width": round((x1 - x0) / W * 100, 3), "height": round((y1 - y0) / H * 100, 3),
                    "px": [int(x1 - x0), int(y1 - y0)]}

(OUT / "layout.json").write_text(json.dumps(layout, indent=1) + "\n")
print(json.dumps(layout))
