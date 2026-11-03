"""Ключ фуксии для новых спрайтов и снятие розовой кромки со старых."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

SRC = Path("/opt/cursor/artifacts/assets")
ROOT = Path("/workspace/art")

NEW = {
    "n_bandit_u.jpg": ("bodies", "n_bandit_u.webp", 640),
    "n_nomad_u.jpg": ("bodies", "n_nomad_u.webp", 640),
    "n_elem.jpg": ("bodies", "n_elem.webp", 640),
    "n_elem_u.jpg": ("bodies", "n_elem_u.webp", 640),
    "n_mage.jpg": ("bodies", "n_mage.webp", 640),
    "el_air.jpg": ("bodies", "el_air.webp", 640),
    "el_fire.jpg": ("bodies", "el_fire.webp", 640),
    "el_water.jpg": ("bodies", "el_water.webp", 640),
    "el_earth.jpg": ("bodies", "el_earth.webp", 640),
    "ballista.jpg": ("bodies", "ballista.webp", 480),
    "tower.jpg": ("bodies", "tower.webp", 640),
    "hall.jpg": ("sprites", "hall.webp", 440),
    "market.jpg": ("sprites", "market.webp", 420),
    "smith.jpg": ("sprites", "smith.webp", 420),
    "silo.jpg": ("sprites", "silo.webp", 420),
    "dw-low.jpg": ("sprites", "dw-low.webp", 400),
    "dw-mid.jpg": ("sprites", "dw-mid.webp", 400),
    "dw-high.jpg": ("sprites", "dw-high.webp", 460),
    "grail.jpg": ("sprites", "grail.webp", 420),
}


def chroma(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.float32)
    h, w = rgb.shape[:2]
    edge = np.concatenate([
        rgb[:10, :, :].reshape(-1, 3),
        rgb[-10:, :, :].reshape(-1, 3),
        rgb[:, :10, :].reshape(-1, 3),
        rgb[:, -10:, :].reshape(-1, 3),
    ])
    med = np.median(edge, axis=0)
    dist = np.sqrt(((rgb - med) ** 2).sum(axis=2))
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mag = (r > 175) & (b > 130) & (g < 130) & (r > g + 35) & (b > g + 15)
    bg = (dist < 62) | mag
    arr[:, :, 3] = np.where(bg, 0, 255)
    out = Image.fromarray(arr)
    return defringe(out)


def defringe(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    arr = np.array(im)
    for _ in range(2):
        a = arr[:, :, 3]
        rgb = arr[:, :, :3].astype(np.int16)
        r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        hole = Image.fromarray(np.where(a < 20, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
        near = np.array(hole) > 0
        pink = (r > 155) & (b > 105) & (g < 135) & ((r - g) > 35) & (b > g)
        hard = (r > 200) & (b > 165) & (g < 120)
        kill = (pink & near) | hard
        arr[:, :, 3] = np.where(kill, 0, a)
        # Снимаем фуксиевый оттенок с кромки, не вырезая красный лак.
        spill = near & (r > 140) & ((r - g) > 30) & (b > g + 20) & (arr[:, :, 3] > 0)
        b2 = np.minimum(b, g + 12)
        arr[:, :, 2] = np.where(spill, b2, arr[:, :, 2])
    # Обрезаем пустые поля.
    a = arr[:, :, 3]
    ys, xs = np.where(a > 12)
    if len(xs) == 0:
        return Image.fromarray(arr)
    pad = 4
    x0, x1 = max(0, xs.min() - pad), min(arr.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(arr.shape[0], ys.max() + pad + 1)
    return Image.fromarray(arr[y0:y1, x0:x1])


def fit_height(im, h):
    w = max(1, int(im.width * (h / im.height)))
    return im.resize((w, h), Image.Resampling.LANCZOS)


def save(im, path, h):
    path.parent.mkdir(parents=True, exist_ok=True)
    fit_height(im, h).save(path, "WEBP", quality=78, method=4)


def main():
    made = 0
    for src, (folder, name, h) in NEW.items():
        p = SRC / src
        if not p.exists():
            print("missing", src)
            continue
        save(chroma(Image.open(p)), ROOT / folder / name, h)
        made += 1
        print("keyed", name)
    n = 0
    for folder in ("bodies", "ride", "sprites"):
        for p in (ROOT / folder).glob("*.webp"):
            if p.name in {v[1] for v in NEW.values()}:
                continue
            im = defringe(Image.open(p))
            im.save(p, "WEBP", quality=78, method=4)
            n += 1
    print("new", made, "defringed", n)


if __name__ == "__main__":
    main()
