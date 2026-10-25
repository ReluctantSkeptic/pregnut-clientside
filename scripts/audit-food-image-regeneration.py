"""Validate every completed replacement recorded in the food image manifest."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / "docs/food-image-regeneration.json").read_text())
foods = [food for batch in manifest["batches"] for food in batch["foods"]]
catalog = json.loads((root / "src/resource/pregnut_fooddata.v1.json").read_text())["foods"]
assert len(foods) == len({food["id"] for food in foods}), "Duplicate food IDs"
assert {food["id"] for food in foods} == {food["id"] for food in catalog}, "Catalog coverage mismatch"
completed = [food for food in foods if food["status"] == "complete"]
for food in completed:
    path = root / manifest["assetDirectory"] / food["file"]
    with Image.open(path) as image:
        assert image.format == "WEBP" and image.size == (400, 400), path
        assert image.mode == "RGBA", path
        alpha = image.getchannel("A")
        bounds = alpha.getbbox()
        assert bounds and min(bounds[:2]) >= 24 and max(bounds[2:]) <= 376, path
    assert path.stat().st_size <= 100_000, f"Image exceeds 100kB: {path}"
    assert food.get("prompt") and food.get("generatedSource"), f"Missing provenance: {path}"
print(f"{len(completed)}/{len(foods)} complete; dimensions, alpha, margins, size and provenance validated")
