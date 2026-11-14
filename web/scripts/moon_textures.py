"""Convert NASA SVS CGI Moon Kit maps into light web textures.

Inputs (NASA's Scientific Visualization Studio, https://svs.gsfc.nasa.gov/4720/):
  lroc_color_16bit_srgb_4k.tif  4096x2048, 16-bit sRGB colour (LRO LROC, 2025 version)
  ldem_16_uint.tif              5760x2880, uint16 half-metres above 1727.4 km radius (LRO LOLA)
Outputs: colour JPGs and tangent-space normal maps (equirectangular, 2:1) at 4k and 2k.

usage: python -I moon_textures.py <in_dir> <out_dir>
"""
import sys
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

# Colour: 16-bit sRGB -> 8-bit.
col = tifffile.imread(src / 'lroc_color_16bit_srgb_4k.tif')
print('colour', col.shape, col.dtype, col.min(), col.max())
col8 = (col[..., :3].astype(np.float32) / 65535.0 * 255.0 + 0.5).clip(0, 255).astype(np.uint8)
img = Image.fromarray(col8, 'RGB')
img.save(out / 'moon_color_4k.jpg', quality=84, optimize=True, progressive=True)
img.resize((2048, 1024), Image.LANCZOS).save(out / 'moon_color_2k.jpg', quality=84, optimize=True, progressive=True)
img.resize((1024, 512), Image.LANCZOS).save(out / 'moon_color_1k.jpg', quality=85, optimize=True)  # phones

# Elevation: uint16 half-metres above a 1727.4 km sphere -> metres relative to 1737.4 km.
dem = tifffile.imread(src / "ldem_16_uint.tif").astype(np.float32) * 0.5 - 10000.0
print('dem', dem.shape, dem.min(), dem.max())
H, W = dem.shape
R = 1737400.0
lat = (90.0 - (np.arange(H) + 0.5) * 180.0 / H) * np.pi / 180.0
dlon = 2 * np.pi / W
dlat = np.pi / H


def normal_map(exaggerate: float) -> np.ndarray:
    # Slopes east (u) and north (v) in metres per metre; wrap in longitude.
    dx = (np.roll(dem, -1, axis=1) - np.roll(dem, 1, axis=1)) / (2 * R * dlon * np.maximum(np.cos(lat), 0.02))[:, None]
    dy = np.zeros_like(dem)
    dy[1:-1] = (dem[:-2] - dem[2:]) / (2 * R * dlat)  # row 0 is north
    nx, ny, nz = -dx * exaggerate, -dy * exaggerate, np.ones_like(dem)
    inv = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx * inv, ny * inv, nz * inv], axis=-1) * 0.5 + 0.5
    return (rgb * 255 + 0.5).clip(0, 255).astype(np.uint8)


nm = Image.fromarray(normal_map(4.0), 'RGB')
nm.resize((4096, 2048), Image.LANCZOS).save(out / 'moon_normal_4k.jpg', quality=90, optimize=True)
nm.resize((2048, 1024), Image.LANCZOS).save(out / 'moon_normal_2k.jpg', quality=90, optimize=True)
nm.resize((1024, 512), Image.LANCZOS).save(out / 'moon_normal_1k.jpg', quality=85, optimize=True)  # phones

for f in sorted(out.iterdir()):
    print(f.name, round(f.stat().st_size / 1e6, 2), 'MB')
