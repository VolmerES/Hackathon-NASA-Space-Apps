"""Terrain horizons on a grid over the south polar cap, for the sunlight heat map of the 3D Moon.

Same method as the per-site horizons (lola_horizons.py): from every grid point, for every azimuth,
march outwards on the lunar sphere and keep the highest elevation angle of the terrain, with the
curvature of the Moon. Here the grid is coarse, so the map is indicative, not a site verdict:
  grid      N x N points, azimuthal equidistant, out to CAP degrees of colatitude
  azimuths  every 10 deg from local north, clockwise (the app interpolates between them)
  relief    ldem_16_uint.tif (NASA SVS CGI Moon Kit; LOLA, 16 px/deg, about 1.9 km per pixel)

Grid convention (the same as moon_polar_cap.py): pixel (u, v) in [0,1], v up;
  X = (u - 0.5) * 2 * CAP, Y = (v - 0.5) * 2 * CAP   (degrees)
  colatitude = hypot(X, Y), longitude = atan2(X, Y)

Writes light_horizons.png: an atlas of 6 x 6 tiles (azimuth 0, 10, ... 350, row by row), 8 bits:
  elevation in deg = value / 255 * RANGE + MIN

usage: python -P moon_light_horizons.py <dir with ldem_16_uint.tif> <out_dir>
"""
import sys
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image

CAP = 10.0
N = 256
AZ_STEP = 10
MIN, RANGE = -6.0, 24.0
R = 1737400.0
OBS_H = 2.0
MAX_KM = 250.0

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
dem = tifffile.imread(src / 'ldem_16_uint.tif').astype(np.float32) * 0.5 - 10000.0
H, W = dem.shape


def sample(lat, lon):
    fy = (90.0 - lat) / 180.0 * H - 0.5
    fx = ((lon + 180.0) % 360.0) / 360.0 * W - 0.5
    y0 = np.clip(np.floor(fy).astype(int), 0, H - 2)
    x0 = np.floor(fx).astype(int)
    ty = np.clip(fy - y0, 0, 1)
    tx = fx - x0
    x0 %= W
    x1 = (x0 + 1) % W
    a = dem[y0, x0] * (1 - tx) + dem[y0, x1] * tx
    b = dem[y0 + 1, x0] * (1 - tx) + dem[y0 + 1, x1] * tx
    return a * (1 - ty) + b * ty


u = (np.arange(N) + 0.5) / N
v = 1.0 - (np.arange(N) + 0.5) / N
X = (u[None, :] - 0.5) * 2 * CAP
Y = (v[:, None] - 0.5) * 2 * CAP
lat0 = (-90.0 + np.hypot(X, Y)).ravel()
lon0 = np.degrees(np.arctan2(X, Y)).ravel() + np.zeros(N * N)
la0, lo0 = np.radians(lat0), np.radians(lon0)
h0 = sample(lat0, lon0).astype(np.float64) + OBS_H

d = np.concatenate([np.arange(1000, 10000, 1000), np.arange(10000, 60000, 2000), np.arange(60000, MAX_KM * 1000 + 1, 5000)]).astype(np.float64)
tiles = []
for az in range(0, 360, AZ_STEP):
    A = np.radians(az)
    best = np.full(N * N, -90.0)
    for dist in d:
        dl = dist / R
        lat2 = np.arcsin(np.clip(np.sin(la0) * np.cos(dl) + np.cos(la0) * np.sin(dl) * np.cos(A), -1, 1))
        lon2 = lo0 + np.arctan2(np.sin(A) * np.sin(dl) * np.cos(la0), np.cos(dl) - np.sin(la0) * np.sin(lat2))
        h2 = sample(np.degrees(lat2), np.degrees(lon2))
        ang = np.degrees(np.arctan2((R + h2) * np.cos(dl) - (R + h0), (R + h2) * np.sin(dl)))
        np.maximum(best, ang, out=best)
    tiles.append(best.reshape(N, N))
    print(f'az {az:3d}  horizon min {best.min():6.2f}  max {best.max():6.2f}  mean {best.mean():5.2f}')

side = int(np.ceil(np.sqrt(len(tiles))))
atlas = np.zeros((side * N, side * N), np.uint8)
for i, t in enumerate(tiles):
    r, c = divmod(i, side)
    atlas[r * N:(r + 1) * N, c * N:(c + 1) * N] = np.clip(np.round((t - MIN) / RANGE * 255), 0, 255).astype(np.uint8)
Image.fromarray(atlas, 'L').save(out / 'light_horizons.png', optimize=True)
print('light_horizons.png', round((out / 'light_horizons.png').stat().st_size / 1e6, 2), 'MB', atlas.shape)
