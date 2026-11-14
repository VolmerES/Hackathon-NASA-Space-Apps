"""Hourly Sun and Earth azimuth/elevation from each landing site, from NASA JPL Horizons.

Observer: a point on the Moon's surface (CENTER coord@301, geodetic lon/lat, 0 km), so the
angles are relative to the local horizon of the ideal sphere: terrain comes later, from LOLA.
Azimuth is measured from local north, clockwise (towards east). Ephemeris source: JPL DE441.

Writes web/public/data/ephem/<site>.json with
  { "start": ISO time, "stepH": 1, "sun": [[az, el], ...], "earth": [[az, el], ...] }
(angles rounded to 0.001 deg).

usage: python -P fetch_horizons.py <out_dir>
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

SITES = {
    'shackleton-rim': (-89.68, -162.7),
    'connecting-ridge': (-89.45, -137.3),
    'malapert-massif': (-86.04, 2.9),
    'nobile-rim-1': (-85.43, 37.3),
    'de-gerlache-rim': (-88.7, -68.6),
    'haworth': (-87.4, -5.0),
}
START = '2026-12-01 00:00'
STOP = '2028-02-01 00:00'
API = 'https://ssd.jpl.nasa.gov/api/horizons.api'


def query(target: str, lat: float, lon: float) -> list[list[float]]:
    east = lon % 360.0
    params = {
        'format': 'text',
        'COMMAND': f"'{target}'",
        'CENTER': "'coord@301'",
        'COORD_TYPE': "'GEODETIC'",
        'SITE_COORD': f"'{east:.4f},{lat:.4f},0'",
        'MAKE_EPHEM': "'YES'",
        'EPHEM_TYPE': "'OBSERVER'",
        'START_TIME': f"'{START}'",
        'STOP_TIME': f"'{STOP}'",
        'STEP_SIZE': "'1 h'",
        'QUANTITIES': "'4'",
        'ANG_FORMAT': "'DEG'",
        'CSV_FORMAT': "'YES'",
        'EXTRA_PREC': "'YES'",
    }
    url = API + '?' + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                text = r.read().decode('utf-8')
            break
        except Exception as e:  # network hiccup: wait and retry
            print('  retry', attempt + 1, e)
            time.sleep(5 * (attempt + 1))
    else:
        raise RuntimeError('Horizons did not answer')
    body = text.split('$$SOE')[1].split('$$EOE')[0]
    rows = []
    for line in body.strip().splitlines():
        parts = [p.strip() for p in line.split(',')]
        rows.append([round(float(parts[3]), 3), round(float(parts[4]), 3)])
    return rows


out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
for site, (lat, lon) in SITES.items():
    sun = query('10', lat, lon)
    earth = query('399', lat, lon)
    assert len(sun) == len(earth), (site, len(sun), len(earth))
    data = {'start': START.replace(' ', 'T') + ':00Z', 'stepH': 1, 'source': 'NASA JPL Horizons (DE441)', 'sun': sun, 'earth': earth}
    (out / f'{site}.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    print(site, len(sun), 'hours', 'sun el range', min(r[1] for r in sun), max(r[1] for r in sun))
