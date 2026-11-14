"""Hourly sub-Earth and sub-solar points on the Moon, from NASA JPL Horizons (DE441).

One query (target Moon 301, observer Earth geocentre 500@399, quantities 14, 15, 20) gives, for
every hour: the sub-Earth point (libration included), the sub-solar point and the Earth-Moon
distance. From these the browser computes where the Sun and Earth are in the sky of ANY point
of the Moon (topocentric, with Earth's parallax). Validated against direct per-site Horizons
runs with --validate.

Writes web/public/data/subpoints.json:
  { "start", "stepH", "source", "rows": [[earthLon, earthLat, sunLon, sunLat, earthKm], ...] }

usage: python -P fetch_subpoints.py <out_file> [--validate <dir with per-site ephem json>]
"""
import json
import math
import sys
import urllib.parse
import urllib.request
from pathlib import Path

START = '2026-12-01 00:00'
STOP = '2028-02-01 00:00'
AU_KM = 149597870.7
R_MOON = 1737.4

params = {
    'format': 'text', 'COMMAND': "'301'", 'CENTER': "'500@399'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'",
    'START_TIME': f"'{START}'", 'STOP_TIME': f"'{STOP}'", 'STEP_SIZE': "'1 h'", 'QUANTITIES': "'14,15,20'",
    'ANG_FORMAT': "'DEG'", 'CSV_FORMAT': "'YES'", 'EXTRA_PREC': "'YES'",
}
url = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(params)
with urllib.request.urlopen(url, timeout=300) as r:
    text = r.read().decode('utf-8')
rows = []
for line in text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
    p = [x.strip() for x in line.split(',')]
    e_lon, e_lat, s_lon, s_lat, delta = float(p[3]), float(p[4]), float(p[5]), float(p[6]), float(p[7])
    rows.append([round(e_lon, 5), round(e_lat, 5), round(s_lon, 5), round(s_lat, 5), round(delta * AU_KM, 1)])
out = Path(sys.argv[1])
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({'start': START.replace(' ', 'T') + ':00Z', 'stepH': 1, 'source': 'NASA JPL Horizons (DE441): Moon seen from the Earth geocentre, quantities 14, 15, 20', 'rows': rows}, separators=(',', ':')), encoding='utf-8')
print('rows', len(rows))


def unit(lat, lon):
    la, lo = math.radians(lat), math.radians(lon)
    return (math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la))


def local(lat, lon, v):
    """Azimuth from north clockwise, elevation, of vector v seen from the site (lat, lon)."""
    la, lo = math.radians(lat), math.radians(lon)
    e = (-math.sin(lo), math.cos(lo), 0.0)
    n = (-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la))
    u = unit(lat, lon)
    ve, vn, vu = (sum(a * b for a, b in zip(v, x)) for x in (e, n, u))
    return math.degrees(math.atan2(ve, vn)) % 360.0, math.degrees(math.atan2(vu, math.hypot(ve, vn)))


def sky(lat, lon, row):
    e_lon, e_lat, s_lon, s_lat, km = row
    sun = local(lat, lon, unit(s_lat, s_lon))
    s = unit(lat, lon)
    eu = unit(e_lat, e_lon)
    earth = local(lat, lon, tuple(km * a - R_MOON * b for a, b in zip(eu, s)))
    return sun, earth


if '--validate' in sys.argv:
    d = Path(sys.argv[sys.argv.index('--validate') + 1])
    sites = {'shackleton-rim': (-89.68, -162.7), 'connecting-ridge': (-89.45, -137.3), 'malapert-massif': (-86.04, 2.9),
             'nobile-rim-1': (-85.43, 37.3), 'de-gerlache-rim': (-88.7, -68.6), 'haworth': (-87.4, -5.0)}
    worst = 0.0
    for site, (lat, lon) in sites.items():
        ref = json.loads((d / f'{site}.json').read_text())
        errs = []
        for i, row in enumerate(rows):
            (saz, sel), (eaz, eel) = sky(lat, lon, row)
            rs, re_ = ref['sun'][i], ref['earth'][i]
            daz = lambda a, b: abs((a - b + 180) % 360 - 180)
            # Azimuth error matters through its arc on the sky: scale by cos(elevation).
            errs.append(max(abs(sel - rs[1]), abs(eel - re_[1]), daz(saz, rs[0]) * math.cos(math.radians(sel)), daz(eaz, re_[0]) * math.cos(math.radians(eel))))
        errs.sort()
        worst = max(worst, errs[-1])
        print(f'{site:18s} max {errs[-1]:.4f} deg   99% {errs[int(len(errs) * 0.99)]:.4f} deg   median {errs[len(errs) // 2]:.4f} deg')
    print('WORST over all sites and hours:', round(worst, 4), 'deg')
