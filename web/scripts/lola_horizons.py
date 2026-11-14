"""Terrain horizon profiles for each landing site, ray-traced on NASA LRO LOLA elevation.

For every azimuth (0..359.5 deg, every 0.5 deg, from local north clockwise, the same convention
as JPL Horizons) march outwards on the lunar sphere up to MAX_KM and keep the highest elevation
angle of the terrain, with the Moon's curvature taken into account exactly. Observer height: 2 m
(first vertical solar panels near the south pole, as in Wueller et al. 2026).

Input: ldem_16_uint.tif (NASA SVS CGI Moon Kit; LOLA, 16 px/deg, ~1.9 km per pixel). This is a
coarse first pass: terrain closer than a few km is under-resolved. The 5 m south-pole DEMs
(PGDA product 78) are the planned upgrade.

Writes web/public/data/horizons.json: { "<site>": [720 elevations in deg], ... , "_meta": {...} }

usage: python -P lola_horizons.py <dir with ldem_16_uint.tif> <out_file>
"""
import json
import sys
from pathlib import Path

import numpy as np
import tifffile

SITES = {
    'shackleton-rim': (-89.68, -162.7),
    'connecting-ridge': (-89.45, -137.3),
    'malapert-massif': (-86.04, 2.9),
    'nobile-rim-1': (-85.43, 37.3),
    'de-gerlache-rim': (-88.7, -68.6),
    'haworth': (-87.4, -5.0),
}
R = 1737400.0
OBS_H = 2.0
MAX_KM = 150.0

src, out = Path(sys.argv[1]), Path(sys.argv[2])
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


# Distances: fine near the site, coarser far away.
d = np.concatenate([np.arange(250, 5000, 250), np.arange(5000, 30000, 500), np.arange(30000, MAX_KM * 1000 + 1, 1000)]).astype(np.float64)
delta = d / R
az = np.arange(720) * 0.5
result = {}
for site, (lat0, lon0) in SITES.items():
    la0, lo0 = np.radians(lat0), np.radians(lon0)
    h0 = float(sample(np.array(lat0), np.array(lon0))) + OBS_H
    A = np.radians(az)[:, None]
    dl = delta[None, :]
    lat2 = np.arcsin(np.sin(la0) * np.cos(dl) + np.cos(la0) * np.sin(dl) * np.cos(A))
    lon2 = lo0 + np.arctan2(np.sin(A) * np.sin(dl) * np.cos(la0), np.cos(dl) - np.sin(la0) * np.sin(lat2))
    h2 = sample(np.degrees(lat2), np.degrees(lon2))
    x = (R + h2) * np.sin(dl)
    z = (R + h2) * np.cos(dl) - (R + h0)
    ang = np.degrees(np.arctan2(z, x)).max(axis=1)
    result[site] = [round(float(v), 3) for v in ang]
    print(f'{site:18s} h0={h0:8.0f} m  horizon min {ang.min():6.2f}  max {ang.max():6.2f}  mean {ang.mean():5.2f}')

result['_meta'] = {
    'source': 'NASA LRO LOLA via NASA SVS CGI Moon Kit (ldem_16_uint.tif, 16 px/deg)',
    'azimuth': '0..359.5 deg every 0.5 deg, from local north, clockwise',
    'observerHeightM': OBS_H,
    'maxDistanceKm': MAX_KM,
}
Path(out).parent.mkdir(parents=True, exist_ok=True)
Path(out).write_text(json.dumps(result, separators=(',', ':')), encoding='utf-8')
print('written', out)
