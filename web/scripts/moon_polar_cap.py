"""South polar cap textures for the 3D Moon, without the pole distortion of equirectangular maps.

Reprojects the NASA SVS CGI Moon Kit maps (https://svs.gsfc.nasa.gov/4720/) to an azimuthal
equidistant grid centred on the south pole, out to CAP_DEG of colatitude:
  polar_color.jpg   albedo from the LROC colour map, softened so the LOLA relief does the shading
  polar_normal.jpg  tangent-space normals from the LOLA elevation (ldem_16_uint.tif, 16 px/deg)
  polar_height.png  the same LOLA elevation as a height map, to raise the mesh itself

Grid convention (must match MoonScene.tsx): pixel (u, v) in [0,1], v up;
  X = (u - 0.5) * 2 * CAP, Y = (v - 0.5) * 2 * CAP   (degrees)
  colatitude = hypot(X, Y), longitude = atan2(X, Y)

usage: python -P moon_polar_cap.py <dir with the two .tif> <out_dir>
"""
import sys
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image

CAP = 25.0  # degrees of colatitude covered by the cap
N = 2048
R = 1737400.0

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

u = (np.arange(N) + 0.5) / N
v = 1.0 - (np.arange(N) + 0.5) / N  # image row 0 is the top (v = 1)
X = (u[None, :] - 0.5) * 2 * CAP
Y = (v[:, None] - 0.5) * 2 * CAP
colat = np.hypot(X, Y)
lon = np.degrees(np.arctan2(X, Y))
lat = -90.0 + colat


def sample(img: np.ndarray, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Bilinear sample of an equirectangular map (row 0 = 90N, col 0 = 180W), wrapping in longitude."""
    H, W = img.shape[:2]
    fy = (90.0 - lat) / 180.0 * H - 0.5
    fx = (lon + 180.0) / 360.0 * W - 0.5
    y0 = np.clip(np.floor(fy).astype(int), 0, H - 2)
    x0 = np.floor(fx).astype(int)
    ty = np.clip(fy - y0, 0, 1)
    tx = fx - x0
    x0 %= W
    x1 = (x0 + 1) % W
    if img.ndim == 3:
        ty, tx = ty[..., None], tx[..., None]
    a = img[y0, x0] * (1 - tx) + img[y0, x1] * tx
    b = img[y0 + 1, x0] * (1 - tx) + img[y0 + 1, x1] * tx
    return a * (1 - ty) + b * ty


# Relief: LOLA, metres relative to 1737.4 km.
dem = tifffile.imread(src / 'ldem_16_uint.tif').astype(np.float32) * 0.5 - 10000.0
h = sample(dem, lat, lon)
px = 2 * CAP / N * np.pi / 180 * R  # metres per pixel
dhdu = np.gradient(h, axis=1) / px
dhdv = -np.gradient(h, axis=0) / px  # rows grow downwards, v grows upwards
exaggerate = 2.5
nx, ny, nz = -dhdu * exaggerate, -dhdv * exaggerate, np.ones_like(h)
inv = 1 / np.sqrt(nx * nx + ny * ny + nz * nz)
normal = (np.stack([nx * inv, ny * inv, nz * inv], -1) * 0.5 + 0.5) * 255
Image.fromarray(normal.clip(0, 255).astype(np.uint8), 'RGB').save(out / 'polar_normal.jpg', quality=90, optimize=True)

# Height for the mesh (displacement), 8 bits: 0 = lowest point in the cap, 1 = highest. It fades
# to 0 over the last 5 degrees so the cap meets the smooth globe without a step. The scale the
# app needs (HEIGHT_RANGE_M in MoonScene.tsx) is printed below.
inside = colat <= CAP
lo, hi = np.percentile(h[inside], 0.2), np.percentile(h[inside], 99.8)
h01 = np.clip((h - lo) / (hi - lo), 0, 1) * np.clip((CAP - colat) / 5.0, 0, 1)
Image.fromarray((h01 * 255).round().astype(np.uint8), 'L').resize((1024, 1024), Image.LANCZOS).save(out / 'polar_height.png', optimize=True)
print('height range for polar_height.png (m):', float(lo), float(hi))

# Albedo: the colour map near the pole is a low-resolution fill, so keep only its broad tone and
# let the real relief carry the detail.
col = tifffile.imread(src / 'lroc_color_16bit_srgb_4k.tif')[..., :3].astype(np.float32) / 65535.0
c = sample(col, lat, lon)
lum = c.mean(-1, keepdims=True)
tone = 0.62 + 0.38 * (lum - lum.mean()) / (lum.std() + 1e-6) * 0.18
rgb = np.clip(np.concatenate([tone * 0.985, tone * 0.975, tone * 0.955], -1), 0, 1) * 255
Image.fromarray(rgb.astype(np.uint8), 'RGB').save(out / 'polar_color.jpg', quality=88, optimize=True)

for f in ('polar_color.jpg', 'polar_normal.jpg', 'polar_height.png'):
    print(f, round((out / f).stat().st_size / 1e6, 2), 'MB')
print('relief range in cap (m):', float(h.min()), float(h.max()))
