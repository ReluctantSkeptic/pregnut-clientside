"""Optimize a generated food cutout while preserving transparency and source."""
from pathlib import Path
import sys
from PIL import Image

source, target = map(Path, sys.argv[1:3])
target.parent.mkdir(parents=True, exist_ok=True)
with Image.open(source) as image:
    image = image.convert("RGBA")
    if image.getchannel("A").getextrema()[0] == 255:
        raise ValueError("Expected a transparent cutout; source is fully opaque")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Source is entirely transparent")
    image = image.crop(bounds)
    image.thumbnail((352, 352), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (400, 400))
    canvas.paste(image, ((400 - image.width) // 2, (400 - image.height) // 2))
    canvas.save(target, "WEBP", quality=82, alpha_quality=100, method=6)
print(f"{target} {target.stat().st_size}")
