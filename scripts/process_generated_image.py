"""Copy a generated PNG into the site's optimized 400px WebP asset path."""
from pathlib import Path
import shutil
import sys

from PIL import Image

source = Path(sys.argv[1])
target = Path(sys.argv[2])
target.parent.mkdir(parents=True, exist_ok=True)
with Image.open(source) as image:
    image = image.convert("RGB")
    image.thumbnail((400, 400), Image.Resampling.LANCZOS)
    image.save(target, "WEBP", quality=78, method=6)
source.unlink(missing_ok=True)
print(f"{target} {target.stat().st_size}")
