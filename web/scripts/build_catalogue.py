"""Landing-site catalogue, terrain horizons and validation against Wueller et al. (2026).

Inputs
  sites   JSON read from the Zenodo shapefile (10.5281/zenodo.17084058, CC BY 4.0): 130 candidate
          landing sites in the 16 Artemis candidate regions, with their published maximum number
          of consecutive sunlit days per southern midsummer (SunDays25..32).
  dem     LDEM_80S_80M.IMG (NASA PDS LOLA node, 80 m/px polar stereographic, 80S to the pole) and,
          beyond it, ldem_16_uint.tif (NASA SVS CGI Moon Kit, LRO LOLA, 16 px/deg).
  sub     web/public/data/subpoints.json (JPL Horizons, see fetch_subpoints.py).
Outputs (web/public/data/)
  sites.json       catalogue for the app
  horizons.json    terrain horizon of every site (720 azimuths, from local north clockwise)
  validation.json  our consecutive sunlit days in midsummer 2027 vs the published ones

usage: python -P build_catalogue.py <sites.json> <dir with ldem_16_uint.tif> <web/public/data> <dir with LDEM_80S_80M.IMG>
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import tifffile

REGIONS = {
    'AR': 'Amundsen Rim', 'CR': 'Connecting Ridge', 'CRE': 'Connecting Ridge Extension', 'dGR1': 'de Gerlache Rim 1',
    'dGR2': 'de Gerlache Rim 2', 'dGKM': 'de Gerlache-Kocher Massif', 'FRA': 'Faustini Rim A', 'HW': 'Haworth',
    'MMA': 'Malapert Massif', 'MMO': 'Mons Mouton', 'MMP': 'Mons Mouton Plateau', 'NR1': 'Nobile Rim 1',
    'NR2': 'Nobile Rim 2', 'PCB': 'Peak near Cabeus B', 'PNS': 'Peak Near Shackleton', 'SP': 'Slater Plain',
}
R = 1737400.0
OBS_H = 2.0
MAX_M = 150000.0
SUN_R = 0.2665  # apparent solar radius, deg

sites_in, dem_dir, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
raw = json.loads(sites_in.read_text(encoding='utf-8'))
dem = tifffile.imread(dem_dir / 'ldem_16_uint.tif').astype(np.float32) * 0.5 - 10000.0
H, W = dem.shape


N80, OFF80, SC80 = 7600, 3799.5, 80.0
d80 = np.fromfile(Path(sys.argv[4]) / 'LDEM_80S_80M.IMG', dtype='<i2').reshape(N80, N80).astype(np.float32) * 0.5


def sample16(lat, lon):
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


def sample(lat, lon):
    """LOLA 80 m polar stereographic where it covers the point, 16 px/deg elsewhere (bilinear)."""
    lat = np.asarray(lat, dtype=np.float64)
    lon = np.asarray(lon, dtype=np.float64)
    rho = 2 * R * np.tan(np.radians(90 + lat) / 2)
    L = np.radians(lon)
    fx = rho * np.sin(L) / SC80 + OFF80
    fy = OFF80 - rho * np.cos(L) / SC80
    inside = (fx >= 0) & (fx < N80 - 1) & (fy >= 0) & (fy < N80 - 1)
    x0 = np.clip(np.floor(fx).astype(int), 0, N80 - 2)
    y0 = np.clip(np.floor(fy).astype(int), 0, N80 - 2)
    tx, ty = fx - x0, fy - y0
    h80 = (d80[y0, x0] * (1 - tx) + d80[y0, x0 + 1] * tx) * (1 - ty) + (d80[y0 + 1, x0] * (1 - tx) + d80[y0 + 1, x0 + 1] * tx) * ty
    return np.where(inside, h80, sample16(lat, lon))


dist = np.concatenate([np.arange(80, 5000, 80), np.arange(5000, 30000, 250), np.arange(30000, MAX_M + 1, 800)])
dl = (dist / R)[None, :]
A = np.radians(np.arange(720) * 0.5)[:, None]


def horizon(lat0, lon0):
    la0, lo0 = math.radians(lat0), math.radians(lon0)
    h0 = float(sample(np.array(lat0), np.array(lon0))) + OBS_H
    lat2 = np.arcsin(np.sin(la0) * np.cos(dl) + np.cos(la0) * np.sin(dl) * np.cos(A))
    lon2 = lo0 + np.arctan2(np.sin(A) * np.sin(dl) * np.cos(la0), np.cos(dl) - np.sin(la0) * np.sin(lat2))
    h2 = sample(np.degrees(lat2), np.degrees(lon2))
    x = (R + h2) * np.sin(dl)
    z = (R + h2) * np.cos(dl) - (R + h0)
    return np.degrees(np.arctan2(z, x)).max(axis=1), h0


def unit(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


sub = json.loads((out / 'subpoints.json').read_text())
rows = np.array(sub['rows'])
sun_u = unit(rows[:, 3], rows[:, 2])
t0 = np.datetime64(sub['start'].replace('Z', ''))
times = t0 + np.arange(len(rows)).astype('timedelta64[h]')
# Southern midsummer as in Wueller et al.: sub-solar latitude <= -1.5 deg. Keep the 2027 window.
summer = (rows[:, 3] <= -1.5) & (times >= np.datetime64('2027-01-01')) & (times < np.datetime64('2028-01-01'))


def sun_sky(lat, lon):
    la, lo = math.radians(lat), math.radians(lon)
    e = np.array([-math.sin(lo), math.cos(lo), 0.0])
    n = np.array([-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)])
    u = unit(lat, lon)
    ve, vn, vu = sun_u @ e, sun_u @ n, sun_u @ u
    return np.degrees(np.arctan2(ve, vn)) % 360.0, np.degrees(np.arctan2(vu, np.hypot(ve, vn)))


def longest_run(mask):
    best = run = 0
    for m in mask:
        run = run + 1 if m else 0
        best = max(best, run)
    return best


sites, horizons, checks = [], {}, []
for r in raw:
    sid = r['Name'].lower().replace('_', '-')
    lat, lon = r['lat'], r['lon']
    hz, h0 = horizon(lat, lon)
    horizons[sid] = [round(float(v), 2) for v in hz]
    pub = {y: int(float(r[k])) for y, k in [(2025, 'SunDays25'), (2026, 'SunDays26'), (2027, 'SunDays27'), (2028, 'SunDays28'), (2029, 'SunDays29'), (2030, 'Sundays30'), (2031, 'SunDays31'), (2032, 'Sundays32')] if r.get(k, '').strip() not in ('', '/')}
    region = r['Landing_Re']
    sites.append({'id': sid, 'name': r['Name'], 'region': region, 'regionName': REGIONS.get(region, region), 'lat': lat, 'lon': lon, 'elevationM': round(h0 - OBS_H), 'publishedSunDays': pub})
    az, el = sun_sky(lat, lon)
    hor = np.interp(az, np.arange(721) * 0.5, np.append(hz, hz[0]))
    lit = (el + SUN_R) > hor  # any part of the solar disc above the terrain, as in the paper
    ours = longest_run(lit[summer]) / 24.0
    if 2027 in pub:
        checks.append({'id': sid, 'published': pub[2027], 'ours': round(ours, 1)})

(out / 'sites.json').write_text(json.dumps({'source': 'Wueller et al. (2026), JGR Planets, doi:10.1029/2025JE009434; data doi:10.5281/zenodo.17084058 (CC BY 4.0)', 'sites': sites}, separators=(',', ':')), encoding='utf-8')
(out / 'horizons.json').write_text(json.dumps({'_meta': {'source': 'NASA LRO LOLA: LDEM_80S_80M (80 m/px, PDS) and ldem_16 (16 px/deg, NASA SVS) beyond 80S', 'azimuth': '0..359.5 every 0.5 deg from local north, clockwise', 'observerHeightM': OBS_H, 'maxDistanceKm': MAX_M / 1000}, **horizons}, separators=(',', ':')), encoding='utf-8')

pub = np.array([c['published'] for c in checks], float)
ours = np.array([c['ours'] for c in checks], float)
diff = ours - pub
agree10 = np.mean((pub >= 10) == (ours >= 10))
corr = float(np.corrcoef(pub, ours)[0, 1])
stats = {
    'sites': len(checks), 'summerHours': int(summer.sum()),
    'medianAbsDiffDays': round(float(np.median(np.abs(diff))), 1),
    'meanDiffDays': round(float(diff.mean()), 1),
    'correlation': round(corr, 2),
    'agreementOn10DayThreshold': round(float(agree10), 2),
}
(out / 'validation.json').write_text(json.dumps({'reference': 'Wueller et al. (2026), SunDays27 (max consecutive sunlit days, midsummer 2027; 60 m/px relief, 12 h steps)', 'ours': 'JPL Horizons sub-solar point + LOLA 80 m horizon, 1 h steps', 'stats': stats, 'sites': checks}, indent=1), encoding='utf-8')
print(json.dumps(stats, indent=1))
for c in sorted(checks, key=lambda c: abs(c['ours'] - c['published']))[-8:]:
    print('largest diff', c)
