"""Real ground around each of the team's 5 sites, for the street view and the landing.

Source: NASA PGDA 78, "High-Resolution LOLA Topography for Lunar South Pole Sites" (Barker et al.
2021, doi:10.1016/j.pss.2020.105119): 5 m/pixel LOLA elevation maps, south polar stereographic,
MOON_ME (DE421), heights in metres. https://pgda.gsfc.nasa.gov/products/78

The GeoTIFFs are uncompressed with one row per strip, so only the rows around each site are
downloaded (HTTP range requests), not the whole 40-140 MB files.

Output, <data dir>/ground.bin plus ground.json:
  for each site, a square of N x N heights every STEP metres, centred on the site and aligned with
  local east (columns, west to east) and north (rows, south to north), as int16 decimetres relative
  to the height of the site. ground.json says where each site's block starts and what the slope is.

usage: python -I ground_patches.py <package sites.json> <data dir>
"""
import json
import math
import struct
import sys
import urllib.request
from pathlib import Path

import numpy as np

BASE = 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/'
# Which PGDA 78 map covers each site (checked against the map bounds).
MAP = {'MMA_K2023': 'Site23', 'HW09': 'Haworth', 'dGR205': 'SL2', 'MMO07': 'Site20v2', 'NR102': 'Site06'}
APP_ID = {'MMA_K2023': 'mma-k2023', 'HW09': 'hw09', 'dGR205': 'dgr205', 'MMO07': 'mmo07', 'NR102': 'nr102'}
R = 1737400.0
HALF_M = 450  # metres from the site to the edge of the square
STEP = 5.0
N = int(2 * HALF_M / STEP) + 1


def get(url, start=None, end=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'lunar-landing-data-script'})
    if start is not None:
        req.add_header('Range', f'bytes={start}-{end}')
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception:
            if attempt == 3:
                raise


def tiff_layout(head):
    e = '<' if head[:2] == b'II' else '>'
    assert struct.unpack(e + 'H', head[2:4])[0] == 42, 'classic TIFF expected'
    off = struct.unpack(e + 'I', head[4:8])[0]
    n = struct.unpack(e + 'H', head[off:off + 2])[0]
    size = {3: 2, 4: 4, 12: 8}
    fmt = {3: 'H', 4: 'I', 12: 'd'}
    t = {}
    for i in range(n):
        q = off + 2 + 12 * i
        tag, typ, cnt = struct.unpack(e + 'HHI', head[q:q + 8])
        if typ not in size:
            continue
        ln = size[typ] * cnt
        data = head[q + 8:q + 8 + ln] if ln <= 4 else head[struct.unpack(e + 'I', head[q + 8:q + 12])[0]:][:ln]
        t[tag] = struct.unpack(e + fmt[typ] * cnt, data)
    assert t[259][0] == 1 and t[278][0] == 1 and t[258][0] == 32 and t[339][0] == 3, 'uncompressed float32 rows expected'
    return dict(e=e, w=t[256][0], h=t[257][0], offsets=t[273], dx=t[33550][0], dy=t[33550][1], x0=t[33922][3], y0=t[33922][4])


def stereo(lat, lon):
    rho = 2 * R * math.tan(math.radians(90 + lat) / 2)
    return rho * math.sin(math.radians(lon)), rho * math.cos(math.radians(lon))


sites = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))['sites']
out = Path(sys.argv[2])
blocks = []
meta = {
    'source': 'NASA PGDA 78: LOLA 5 m/pixel elevation maps of south pole landing sites (Barker et al. 2021)',
    'n': N,
    'stepM': STEP,
    'units': 'int16 decimetres relative to the site; rows south to north, columns west to east',
    'sites': {},
}
for s in sites:
    name = MAP[s['id']]
    url = f'{BASE}{name}/{name}_final_adj_5mpp_surf.tif'
    L = tiff_layout(get(url, 0, 262143))
    xs, ys = stereo(s['lat'], s['lon_180'])
    col = (xs - L['x0']) / L['dx'] - 0.5
    row = (L['y0'] - ys) / L['dy'] - 0.5
    span = HALF_M / L['dx'] * 1.5 + 4  # the square, rotated, plus room for interpolation
    r0, r1 = int(row - span), int(row + span) + 1
    c0, c1 = int(col - span), int(col + span) + 1
    assert 0 <= r0 and r1 < L['h'] and 0 <= c0 and c1 < L['w'], (s['id'], 'too close to the edge of the map')
    raw = get(url, L['offsets'][r0], L['offsets'][r1] + 4 * L['w'] - 1)
    grid = np.frombuffer(raw, dtype=L['e'] + 'f4').reshape(r1 - r0 + 1, L['w'])[:, c0:c1 + 1].astype(np.float64)
    # Sample a square aligned with local east and north. Near the pole, north points away from it.
    lam = math.radians(s['lon_180'])
    north = np.array([math.sin(lam), math.cos(lam)])
    east = np.array([math.cos(lam), -math.sin(lam)])
    k = (np.arange(N) - (N - 1) / 2) * STEP
    de, dn = np.meshgrid(k, k)  # rows: south to north; columns: west to east
    X = xs + dn * north[0] + de * east[0]
    Y = ys + dn * north[1] + de * east[1]
    fc = (X - L['x0']) / L['dx'] - 0.5 - c0
    fr = (L['y0'] - Y) / L['dy'] - 0.5 - r0
    i0, j0 = np.floor(fr).astype(int), np.floor(fc).astype(int)
    tr, tc = fr - i0, fc - j0
    z = (grid[i0, j0] * (1 - tc) + grid[i0, j0 + 1] * tc) * (1 - tr) + (grid[i0 + 1, j0] * (1 - tc) + grid[i0 + 1, j0 + 1] * tc) * tr
    h0 = z[(N - 1) // 2, (N - 1) // 2]
    rel = np.round((z - h0) * 10)
    assert np.abs(rel).max() < 32767
    # Slope at the site: plane through the 5 x 5 points around it (25 m by 25 m).
    m = (N - 1) // 2
    w = z[m - 2:m + 3, m - 2:m + 3]
    gx = np.polyfit(k[m - 2:m + 3], w.mean(0), 1)[0]
    gy = np.polyfit(k[m - 2:m + 3], w.mean(1), 1)[0]
    slope = math.degrees(math.atan(math.hypot(gx, gy)))
    meta['sites'][APP_ID[s['id']]] = {'block': len(blocks), 'map': name, 'heightM': round(float(h0), 1), 'slopeDeg': round(slope, 1), 'gradE': round(float(gx), 4), 'gradN': round(float(gy), 4), 'reliefM': [round(float(z.min() - h0), 1), round(float(z.max() - h0), 1)]}
    blocks.append(rel.astype('<i2'))
    print(f"{s['id']:10s} map {name:9s} height {h0:8.1f} m (package {s.get('site_height_m', '-')}), slope {slope:4.1f} deg, relief {z.min() - h0:+.0f}..{z.max() - h0:+.0f} m")

(out / 'ground.bin').write_bytes(b''.join(b.tobytes() for b in blocks))
(out / 'ground.json').write_text(json.dumps(meta, separators=(',', ':')), encoding='utf-8')
print('written', round((out / 'ground.bin').stat().st_size / 1024), 'KB')
