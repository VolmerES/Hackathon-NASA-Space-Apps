"""Compare the azimuth and elevation of the Sun and the Earth that the web gives with NASA JPL Horizons.

For each CSV in this folder (one per landing site, written by web/scripts/export_angles.ts with the
same code the web runs), it asks Horizons for the same hours, seen from that point of the Moon,
and prints the largest difference.

Horizons settings (the same you can set by hand at https://ssd.jpl.nasa.gov/horizons/app.html):
  Ephemeris type  Observer table
  Target          Sun (10) / Earth (399)
  Observer        coord@301: a point on the Moon, geodetic, longitude east, latitude, 0 km
  Quantities      4 (apparent azimuth and elevation), angles in degrees
  Time step       1 hour, UTC

No packages needed (only the Python standard library). Needs internet access.
usage: python comparar_con_horizons.py
"""
import csv
import glob
import os
import re
import urllib.parse
import urllib.request

API = 'https://ssd.jpl.nasa.gov/api/horizons.api'


def horizons(target, lat, lon, start, stop):
    params = {
        'format': 'text', 'COMMAND': f"'{target}'", 'CENTER': "'coord@301'", 'COORD_TYPE': "'GEODETIC'",
        'SITE_COORD': f"'{lon % 360:.4f},{lat:.4f},0'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'",
        'START_TIME': f"'{start}'", 'STOP_TIME': f"'{stop}'", 'STEP_SIZE': "'1 h'", 'QUANTITIES': "'4'",
        'ANG_FORMAT': "'DEG'", 'CSV_FORMAT': "'YES'", 'EXTRA_PREC': "'YES'",
    }
    url = API + '?' + urllib.parse.urlencode(params)
    text = urllib.request.urlopen(url, timeout=180).read().decode('utf-8')
    body = text.split('$$SOE')[1].split('$$EOE')[0]
    out = []
    for line in body.strip().splitlines():
        f = [x.strip() for x in line.split(',')]
        out.append((float(f[3]), float(f[4])))  # azimuth, elevation
    return out, url


def azdiff(a, b):
    return abs((a - b + 180) % 360 - 180)


here = os.path.dirname(os.path.abspath(__file__))
print('site       hours   Sun az   Sun el   Earth az  Earth el   (largest difference, degrees)')
for path in sorted(glob.glob(os.path.join(here, '*.csv'))):
    lines = open(path, encoding='utf-8').read().splitlines()
    m = re.search(r'\((\w+)\) lat (-?[\d.]+) lon (-?[\d.]+)', lines[0])
    code, lat, lon = m.group(1), float(m.group(2)), float(m.group(3))
    rows = list(csv.DictReader(lines[1:]))
    start = rows[0]['time_utc'].replace('T', ' ').rstrip('Z')
    stop = rows[-1]['time_utc'].replace('T', ' ').rstrip('Z')
    sun, url_sun = horizons('10', lat, lon, start, stop)
    earth, url_earth = horizons('399', lat, lon, start, stop)
    assert len(sun) == len(rows) == len(earth), (code, len(sun), len(rows))
    d = [0.0] * 4
    for r, s, e in zip(rows, sun, earth):
        d[0] = max(d[0], azdiff(float(r['sun_az_deg']), s[0]))
        d[1] = max(d[1], abs(float(r['sun_el_deg']) - s[1]))
        d[2] = max(d[2], azdiff(float(r['earth_az_deg']), e[0]))
        d[3] = max(d[3], abs(float(r['earth_el_deg']) - e[1]))
    print(f'{code:10s} {len(rows):5d}  ' + '  '.join(f'{x:7.4f}' for x in d))
    print(f'  Sun query:   {url_sun}')
    print(f'  Earth query: {url_earth}')
