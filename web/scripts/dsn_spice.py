"""(Del paquete de Luna, 15-nov-2026. Las rutas de los kernels SPICE y de los ficheros de entrada son las de su equipo:
cambiarlas antes de ejecutarlo. Necesita spiceypy y numpy.)

Ventanas de contacto con la Red de Espacio Profundo (DSN) desde un sitio lunar.
Contacto posible en una hora si: (1) la Tierra está sobre el horizonte del terreno del sitio
y (2) la Luna está a >= ELEV_MIN sobre el horizonte de alguna estación.
Elevación de la Luna desde la estación: posición geocéntrica de la Luna (SPICE de440s),
rotación terrestre por GMST (IAU 1982), estación en coordenadas geodésicas WGS84 (paralaje incluido).
Sin modelo de refracción (la Luna se ve sin aire... pero la estación sí tiene aire: ~0,1° a 10°, despreciable aquí)."""
import json, math, sys, numpy as np, spiceypy as sp
sp.furnsh('/mnt/user-data/uploads/b48f516d-naif0012.tls.txt'); sp.furnsh('/mnt/user-data/uploads/de440s.bsp')
STATIONS = {'Madrid (DSS-63)': (40.431, -4.248, 0.834), 'Goldstone (DSS-14)': (35.426, -116.890, 1.001), 'Canberra (DSS-43)': (-35.403, 148.981, 0.689)}
ELEV_MIN = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
A, F = 6378.137, 1/298.257223563
def ecef(lat, lon, h):
    la, lo = math.radians(lat), math.radians(lon); e2 = F*(2-F); N = A/math.sqrt(1-e2*math.sin(la)**2)
    return np.array([(N+h)*math.cos(la)*math.cos(lo), (N+h)*math.cos(la)*math.sin(lo), (N*(1-e2)+h)*math.sin(la)])
def gmst(et):
    jd_ut = sp.unitim(et, 'ET', 'JDTDB') - sp.deltet(et, 'ET')/86400.0  # TDB->UTC approx (UT1~UTC, <1 s)
    T = (jd_ut - 2451545.0)/36525.0
    g = 280.46061837 + 360.98564736629*(jd_ut-2451545.0) + 0.000387933*T*T - T**3/38710000.0
    return math.radians(g % 360.0)
def moon_el(et, lat, lon, h):
    r, _ = sp.spkpos('301', et, 'J2000', 'LT', '399')          # Luna geocéntrica, J2000 (~GCRF)
    th = gmst(et); c, s = math.cos(th), math.sin(th)
    # ECEF -> inercial: rotar por GMST (sin precesión/nutación: error < 0,3°, suficiente para ventanas)
    st = ecef(lat, lon, h); st_i = np.array([c*st[0]-s*st[1], s*st[0]+c*st[1], st[2]])
    up = np.array([math.cos(math.radians(lat))*math.cos(math.radians(lon)+th), math.cos(math.radians(lat))*math.sin(math.radians(lon)+th), math.sin(math.radians(lat))])
    d = np.array(r) - st_i
    return math.degrees(math.asin(np.dot(d, up)/np.linalg.norm(d)))
eph = json.load(open(sys.argv[1]))
et0 = sp.str2et(eph['t0'].replace('Z','')); n = eph['n']; vis = np.array(eph['earth']['visible'], dtype=bool)
els = {k: np.array([moon_el(et0+3600*i, *v) for i in range(n)]) for k, v in STATIONS.items()}
json.dump({'t0': eph['t0'], 'stepH': 1, 'elevMin': ELEV_MIN, 'stations': {k: v.round(2).tolist() for k, v in els.items()}}, open('dsn_el.json','w'))
def report(sl, label):
    v = vis[sl]; H = v.sum(); tot = v.size
    print(f'\n{label}: {tot} h · Tierra sobre el horizonte {H} h ({100*H/tot:.0f} %)')
    any_st = np.zeros(tot, bool)
    for k, e in els.items():
        up = e[sl] >= ELEV_MIN; both = v & up; any_st |= up
        print(f'  {k:20s} Luna ≥{ELEV_MIN:.0f}°: {100*up.mean():.0f} % del tiempo · contacto (Tierra visible y estación): {both.sum()} h ({100*both.sum()/tot:.0f} % de la estancia, {100*both.sum()/max(H,1):.0f} % de las horas con Tierra)')
    c = v & any_st
    print(f'  DSN (alguna estación)      : {c.sum()} h ({100*c.sum()/tot:.0f} % de la estancia, {100*c.sum()/max(H,1):.0f} % de las horas con Tierra) · huecos de la red sin cubrir: {(v & ~any_st).sum()} h')
import datetime as dt
t0 = dt.datetime.fromisoformat(eph['t0'].replace('Z',''))
def idx(s): return int((dt.datetime.fromisoformat(s) - t0).total_seconds()//3600)
report(slice(idx('2026-12-24T12:00'), idx('2026-12-31T13:00')), 'Malapert, 24 dic 12:00 → 31 dic 2026 (169 h, la pantalla de la app)')
report(slice(idx('2026-12-01T00:00'), idx('2026-12-15T00:00')), 'Malapert, 1–15 dic 2026 (14 días, el caso de las slides)')
report(slice(idx('2026-12-01T00:00'), n), 'Malapert, 1 dic 2026 → fin de los datos')
# Comprobación frente a Horizons (madrid.json de la app)
m = json.load(open('/tmp/prueba_v2_1794659442/web/public/data/madrid.json'))
i0 = idx('2026-12-01T00:00'); k = min(len(m['el']), n - i0)
diff = els['Madrid (DSS-63)'][i0:i0+k] - np.array(m['el'][:k])
print(f'\nComprobación Madrid frente a JPL Horizons ({k} h): diferencia media {diff.mean():+.3f}°, máxima {np.abs(diff).max():.3f}°')
