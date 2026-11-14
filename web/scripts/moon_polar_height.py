# Written with Claude Code (Claude Opus 5.5); reviewed by <name>
"""South polar cap height map for the cast shadows of the 3D Moon (MoonScene.tsx).

Same grid as moon_polar_cap.py (azimuthal equidistant around the south pole, out to CAP degrees of
colatitude), sampled from the NASA SVS CGI Moon Kit LOLA elevation (ldem_16_uint.tif, 16 px/deg,
https://svs.gsfc.nasa.gov/4720/). The browser ray-marches it towards the real Sun of the chosen hour.

Writes polar_height.bin: N x N little-endian float16, height in km relative to the 1737.4 km sphere.
Row 0 is the bottom of the grid (v = 0), as a WebGL DataTexture reads it:
  X = (u - 0.5) * 2 * CAP, Y = (v - 0.5) * 2 * CAP   (degrees)
  colatitude = hypot(X, Y), longitude = atan2(X, Y)

usage: python -I moon_polar_height.py <dir with ldem_16_uint.tif> <out_dir>
"""
import sys
from pathlib import Path

import numpy as np
import tifffile

CAP = 25.0  # degrees of colatitude, must match MoonScene.tsx
N = 1024  # ~1.5 km per pixel: about the resolution of ldem_16 (1.9 km per pixel of latitude)

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

u = (np.arange(N) + 0.5) / N
v = (np.arange(N) + 0.5) / N  # row 0 = v 0 (bottom), unlike an image file
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
    a = img[y0, x0] * (1 - tx) + img[y0, x1] * tx
    b = img[y0 + 1, x0] * (1 - tx) + img[y0 + 1, x1] * tx
    return a * (1 - ty) + b * ty


# LOLA: half-metres above 1727.4 km, i.e. metres relative to 1737.4 km after * 0.5 - 10000.
dem = tifffile.imread(src / 'ldem_16_uint.tif').astype(np.float32) * 0.5 - 10000.0
h_km = sample(dem, lat, lon) / 1000.0
h_km.astype('<f2').tofile(out / 'polar_height.bin')

print('polar_height.bin', round((out / 'polar_height.bin').stat().st_size / 1e6, 2), 'MB')
print('relief range in cap (km): %.3f to %.3f' % (h_km.min(), h_km.max()))
print('largest float16 rounding (m): %.2f' % (np.abs(h_km.astype(np.float16).astype(np.float32) - h_km).max() * 1000))
