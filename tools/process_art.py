"""Ключ фуксии, кадрирование тайлов, сжатие для мобильной PWA."""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

SRC = Path("/opt/cursor/artifacts/assets")
ROOT = Path("/workspace/art")

def chroma(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.float32)
    h, w = rgb.shape[:2]
    edge = np.concatenate([
        rgb[:8, :, :].reshape(-1, 3),
        rgb[-8:, :, :].reshape(-1, 3),
        rgb[:, :8, :].reshape(-1, 3),
        rgb[:, -8:, :].reshape(-1, 3),
    ])
    med = np.median(edge, axis=0)
    dist = np.sqrt(((rgb - med) ** 2).sum(axis=2))
    # Фон — розовая фуксия, сжатая JPEG. Не трогаем красный лак (у него мало синего).
    bg = (dist < 48) & (rgb[:, :, 1] < 80) & (rgb[:, :, 2] > 80) & (rgb[:, :, 0] > 150)
    mask = Image.fromarray(np.where(bg, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
    grown = np.array(mask) > 0
    pink = (rgb[:, :, 0] > 130) & (rgb[:, :, 2] > 70) & (rgb[:, :, 1] < 110)
    arr[:, :, 3] = np.where(bg | (grown & pink), 0, arr[:, :, 3])
    return Image.fromarray(arr)

def fit_height(im, h):
    w = max(1, int(im.width * (h / im.height)))
    return im.resize((w, h), Image.Resampling.LANCZOS)

def save_webp(im, path, h):
    path.parent.mkdir(parents=True, exist_ok=True)
    fit_height(im, h).save(path, "WEBP", quality=76, method=4)

def center_tile(im, frac=0.62):
    w, h = im.size
    cw, ch = int(w * frac), int(h * frac)
    x, y = (w - cw) // 2, (h - ch) // 2
    crop = im.crop((x, y, x + cw, y + ch)).convert("RGB")
    crop.thumbnail((340, 340), Image.Resampling.LANCZOS)
    return crop

def main():
    tiles = {
        "tile-grass.jpg": "grass.jpg",
        "tile-grass2.jpg": "grass2.jpg",
        "tile-snow.jpg": "snow.jpg",
        "tile-water.jpg": "water.jpg",
        "tile-rock.jpg": "rock.jpg",
        "tile-swamp.jpg": "swamp.jpg",
        "tile-sand.jpg": "sand.jpg",
        "tile-road.jpg": "road.jpg",
    }
    tdir = ROOT / "tiles"
    tdir.mkdir(parents=True, exist_ok=True)
    for src, dst in tiles.items():
        p = SRC / src
        if p.exists():
            center_tile(Image.open(p)).save(tdir / dst, "JPEG", quality=82, optimize=True)

    scenes = {
        "town-scarlet.jpg": ROOT / "towns" / "scarlet.jpg",
        "town-emerald.jpg": ROOT / "towns" / "emerald.jpg",
        "town-onyx.jpg": ROOT / "towns" / "onyx.jpg",
        "battle-meadow.jpg": ROOT / "battle" / "meadow.jpg",
        "battle-snow.jpg": ROOT / "battle" / "snow.jpg",
    }
    for src, dst in scenes.items():
        p = SRC / src
        if not p.exists():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(p).convert("RGB")
        im.thumbnail((1100, 620), Image.Resampling.LANCZOS)
        im.save(dst, "JPEG", quality=80, optimize=True)

    sprites = {
        "obj-tree.jpg": "tree.webp",
        "obj-mountain.jpg": "mountain.webp",
        "obj-chest.jpg": "chest.webp",
        "obj-gold.jpg": "gold.webp",
        "obj-mine.jpg": "mine.webp",
        "obj-shrine.jpg": "shrine.webp",
        "obj-castle-scarlet.jpg": "castle-scarlet.webp",
        "obj-castle-emerald.jpg": "castle-emerald.webp",
        "obj-castle-onyx.jpg": "castle-onyx.webp",
        "bld-tavern.jpg": "tavern.webp",
        "bld-mage.jpg": "mage.webp",
    }
    sdir = ROOT / "sprites"
    for src, dst in sprites.items():
        p = SRC / src
        if p.exists():
            save_webp(chroma(Image.open(p)), sdir / dst, 520)

    bdir = ROOT / "bodies"
    for p in SRC.glob("body-*.jpg"):
        stem = p.stem[len("body-"):].replace("-", "_")
        save_webp(chroma(Image.open(p)), bdir / f"{stem}.webp", 640)

    rdir = ROOT / "ride"
    for p in SRC.glob("ride-*.jpg"):
        stem = p.stem[len("ride-"):]
        save_webp(chroma(Image.open(p)), rdir / f"{stem}.webp", 720)

    n = len(list(bdir.glob("*.webp"))) + len(list(rdir.glob("*.webp"))) + len(list(sdir.glob("*.webp")))
    print("sprites+bodies+rides", n)

if __name__ == "__main__":
    main()
