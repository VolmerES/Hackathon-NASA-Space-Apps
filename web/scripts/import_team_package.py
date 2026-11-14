"""Brings the team's data package (5 chosen sites) into the files the app reads.

The package (Juan and Luna) has, for each of the 5 sites, a terrain horizon traced on finer NASA
relief than ours: LOLA 80 m out to 150 km (PGDA 90) merged with 5 m around the site (PGDA 78).
The hourly Sun and Earth tables it also carries are not copied: the app computes the same
positions from JPL Horizons, and with these horizons its visibility is identical hour by hour
(checked over 9,505 common hours: 0.0 % of hours differ; positions agree within 0.0065 deg).

What it does, in <data dir> (web/public/data):
  horizons.json    the 5 sites get the package horizon (720 azimuths, every 0.5 deg)
  validation.json  their consecutive sunlit days in midsummer 2027 are recomputed with it
  team.json        the 5 sites: hypothesis (es, and en translated with SI), the NASA region, the
                   distance to the ridge that makes the horizon, and the check against NASA
                   PGDA 69 (Mazarico et al. 2011; 18.6-year averages with a tolerance band)

usage: python -I import_team_package.py <package dir> <data dir>
"""
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np

pk, out = Path(sys.argv[1]), Path(sys.argv[2])
load = lambda p: json.loads(Path(p).read_text(encoding='utf-8'))
dump = lambda p, d: Path(p).write_text(json.dumps(d, separators=(',', ':'), ensure_ascii=False), encoding='utf-8')

APP_ID = {'MMA_K2023': 'mma-k2023', 'HW09': 'hw09', 'dGR205': 'dgr205', 'MMO07': 'mmo07', 'NR102': 'nr102'}
# English versions of the team's hypotheses: translated with SI, to be reviewed by the team.
HYPOTHESIS_EN = {
    'MMA_K2023': 'Hypothesis (unverified): high ground with an open near horizon; it could have good illumination and a view of Earth.',
    'HW09': 'Hypothesis (unverified): surrounded by walls up to about 12° on the near horizon; it could have fewer hours of sunlight.',
    'dGR205': 'Hypothesis (unverified): close to the pole and with walls up to about 12°; conditions could change a lot with the date.',
    'MMO07': 'Hypothesis (unverified): Mons Mouton region, close to the IM-2 area.',
    'NR102': 'Hypothesis (unverified): 10.2 km from the Mons Mouton point; it will show how much conditions change between nearby sites.',
}
SUN_R = 0.2665

sites = load(pk / 'sites.json')['sites']
pgda = load(pk / 'validation_pgda69.json')
ours = {r['site_id']: r for r in csv.DictReader((pk / 'comparacion_nasa_v2.csv').open(encoding='utf-8'))}
horizons = load(out / 'horizons.json')
validation = load(out / 'validation.json')

# Midsummer 2027 as in build_catalogue.py, to recompute the check against the published study.
sub = load(out / 'subpoints.json')
rows = np.array(sub['rows'])
la_s, lo_s = np.radians(rows[:, 3]), np.radians(rows[:, 2])
sun_u = np.stack([np.cos(la_s) * np.cos(lo_s), np.cos(la_s) * np.sin(lo_s), np.sin(la_s)], -1)
times = np.datetime64(sub['start'].replace('Z', '')) + np.arange(len(rows)).astype('timedelta64[h]')
summer = (rows[:, 3] <= -1.5) & (times >= np.datetime64('2027-01-01')) & (times < np.datetime64('2028-01-01'))


def sunlit_days(lat, lon, hz):
    la, lo = math.radians(lat), math.radians(lon)
    e = np.array([-math.sin(lo), math.cos(lo), 0.0])
    n = np.array([-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)])
    u = np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    ve, vn, vu = sun_u @ e, sun_u @ n, sun_u @ u
    az, el = np.degrees(np.arctan2(ve, vn)) % 360.0, np.degrees(np.arctan2(vu, np.hypot(ve, vn)))
    lit = (el + SUN_R) > np.interp(az, np.arange(721) * 0.5, np.append(hz, hz[0]))
    best = run = 0
    for m in lit[summer]:
        run = run + 1 if m else 0
        best = max(best, run)
    return best / 24.0


team = []
for s in sites:
    pid, aid = s['id'], APP_ID[s['id']]
    h = load(pk / f'horizon_{pid}.json')
    assert len(h['el_deg']) == 720 and h['az_deg'][1] == 0.5, pid
    horizons[aid] = [round(float(v), 3) for v in h['el_deg']]
    days = round(sunlit_days(s['lat'], s['lon_180'], np.array(h['el_deg'])), 1)
    for c in validation['sites']:
        if c['id'] == aid:
            print(f"{pid:10s} sunlit days in midsummer 2027: published {c['published']}, ours before {c['ours']}, now {days}")
            c['ours'] = days
    v, o = pgda['sites'][pid], ours[pid]
    num = lambda k: float(o[k])
    team.append({
        'id': aid,
        'code': pid,
        'hypothesis': {'es': s['hipotesis'], 'en': HYPOTHESIS_EN[pid]},
        'nasaRegion': {'name': s['nasa_region']['nombre_tabla'], 'lat': s['nasa_region']['lat'], 'lon': s['nasa_region']['lon']},
        'heightM': h['site_height_m'],
        'ridgeKm': [round(d / 1000, 2) for d in h['ridge_dist_m']],
        'pgda69': {
            'sun': {'nasa': v['sol_pct']['valor'], 'band': v['sol_pct']['rango_3x3'], 'ours': num('sol_18_6a'), 'ours2027': num('sol_2026_27')},
            'earth': {'nasa': v['tierra_pct']['valor'], 'band': v['tierra_pct']['rango_3x3'], 'ours': num('tierra_18_6a'), 'ours2027': num('tierra_2026_27')},
        },
    })

horizons['_meta']['teamSites'] = 'The 5 sites of the team (' + ', '.join(APP_ID.values()) + ') use LOLA 80 m (PGDA 90) merged with 5 m around the site (PGDA 78), from the team package.'
dump(out / 'horizons.json', horizons)
dump(out / 'validation.json', validation)
dump(out / 'team.json', {
    'source': 'Team package v1: horizons on NASA LOLA (PGDA 90, 80 m; PGDA 78, 5 m), ephemerides NASA/JPL DE440 in MOON_ME; observer 2 m above ground.',
    'regions': 'NASA M2M-30044 Lunar Surface Data Book (NASA/TP-20250002845), Table A2.1-1',
    'pgda69': pgda['fuente'],
    'sites': team,
})
print('written: horizons.json, validation.json, team.json', round((out / 'team.json').stat().st_size / 1024), 'KB')
