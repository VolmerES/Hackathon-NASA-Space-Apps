"""Hourly elevation of the Moon above the horizon of NASA's three Deep Space Network complexes,
from NASA JPL Horizons: Madrid (DSS-63), Goldstone (DSS-14) and Canberra (DSS-43), the 70 m antennas.

Sites: geodetic WGS84 coordinates (latitude, east longitude, height in km above the ellipsoid),
converted by the team from the Earth-fixed X, Y, Z positions NASA/JPL publish for the antennas.
Writes web/public/data/dsn.json
  { start, stepH, minElevDeg, source, stations: [{ id, name, dss, lat, lon, altKm, el: [...] }] }.

usage: python -P fetch_dsn.py <out_file>
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

START = '2026-12-01 00:00'
STOP = '2028-02-01 00:00'
STATIONS = [
    {'id': 'madrid', 'name': 'Madrid (Robledo de Chavela)', 'dss': 'DSS-63', 'lat': 40.431208, 'lon': -4.248010, 'altKm': 0.865},
    {'id': 'goldstone', 'name': 'Goldstone (California)', 'dss': 'DSS-14', 'lat': 35.425901, 'lon': -116.889537, 'altKm': 1.001},
    {'id': 'canberra', 'name': 'Canberra (Tidbinbilla)', 'dss': 'DSS-43', 'lat': -35.402428, 'lon': 148.981265, 'altKm': 0.689},
]
MIN_ELEV = 10  # degrees: the elevation the tool already used for Madrid


def elevations(st):
    params = {
        'format': 'text', 'COMMAND': "'301'", 'CENTER': "'coord@399'", 'COORD_TYPE': "'GEODETIC'",
        'SITE_COORD': f"'{st['lon'] % 360:.6f},{st['lat']:.6f},{st['altKm']}'", 'MAKE_EPHEM': "'YES'",
        'EPHEM_TYPE': "'OBSERVER'", 'START_TIME': f"'{START}'", 'STOP_TIME': f"'{STOP}'", 'STEP_SIZE': "'1 h'",
        'QUANTITIES': "'4'", 'ANG_FORMAT': "'DEG'", 'CSV_FORMAT': "'YES'", 'APPARENT': "'AIRLESS'",
    }
    url = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=300) as r:
        text = r.read().decode('utf-8')
    out = []
    for line in text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
        p = [x.strip() for x in line.split(',')]
        out.append(round(float(p[4]), 2))
    return out


for st in STATIONS:
    st['el'] = elevations(st)
    up = sum(e >= MIN_ELEV for e in st['el']) / len(st['el'])
    print(st['dss'], 'hours', len(st['el']), f'Moon above {MIN_ELEV} deg', round(up, 3))
n = len(STATIONS[0]['el'])
anyup = sum(any(s['el'][i] >= MIN_ELEV for s in STATIONS) for i in range(n)) / n
print('at least one station', round(anyup, 4))
Path(sys.argv[1]).write_text(json.dumps({
    'start': START.replace(' ', 'T') + ':00Z', 'stepH': 1, 'minElevDeg': MIN_ELEV,
    'source': 'NASA JPL Horizons: Moon elevation from the 70 m antennas of the Deep Space Network (DSS-63, DSS-14, DSS-43)',
    'stations': STATIONS,
}, separators=(',', ':')), encoding='utf-8')
