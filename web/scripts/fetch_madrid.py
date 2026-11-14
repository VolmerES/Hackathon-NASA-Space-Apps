"""Hourly elevation of the Moon above the horizon of NASA's Madrid Deep Space Communications
Complex (Robledo de Chavela), from NASA JPL Horizons.

Site: DSS-63, 40.431 N, 4.248 W, 0.834 km (geodetic, approximate; NAIF earthstns_itrf93_260814
has the exact position). Writes web/public/data/madrid.json { start, stepH, source, el: [...] }.

usage: python -P fetch_madrid.py <out_file>
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

START = '2026-12-01 00:00'
STOP = '2028-02-01 00:00'
params = {
    'format': 'text', 'COMMAND': "'301'", 'CENTER': "'coord@399'", 'COORD_TYPE': "'GEODETIC'",
    'SITE_COORD': "'355.752,40.431,0.834'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'",
    'START_TIME': f"'{START}'", 'STOP_TIME': f"'{STOP}'", 'STEP_SIZE': "'1 h'", 'QUANTITIES': "'4'",
    'ANG_FORMAT': "'DEG'", 'CSV_FORMAT': "'YES'", 'APPARENT': "'AIRLESS'",
}
url = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(params)
with urllib.request.urlopen(url, timeout=300) as r:
    text = r.read().decode('utf-8')
el = []
for line in text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
    p = [x.strip() for x in line.split(',')]
    el.append(round(float(p[4]), 2))
Path(sys.argv[1]).write_text(json.dumps({'start': START.replace(' ', 'T') + ':00Z', 'stepH': 1, 'source': 'NASA JPL Horizons: Moon elevation from Robledo de Chavela (DSS-63)', 'el': el}, separators=(',', ':')), encoding='utf-8')
print('hours', len(el), 'max el', max(el), 'share above 10 deg', round(sum(e >= 10 for e in el) / len(el), 3))
