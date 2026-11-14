"""
elipse_export.py — Exporta para la app los horizontes de la malla de aterrizaje (elipse.py).

Para cada sitio del equipo guarda los puntos de la malla a <= --radius-m del centro, con su
horizonte (720 valores, cada 0,5°, en CENTÉSIMAS de grado como enteros para ocupar poco),
su desplazamiento (este/norte, m), lat/lon y pendiente. La app los trata como "sitios" normales
(Site.horizon = valores / 100) y simula cualquier fecha con su propio modelo.

Salida: elipse.json  { "_meta": {...}, "<id-app>": {"stepM", "points": [...]}, ... }
No modifica ningún archivo existente.

Uso:
  python elipse_export.py --dem LDEM_80S_80MPP_ADJ.tiff --sites sites.json --near-dir carpeta_5m
"""
from __future__ import annotations
import argparse, json, math, os, sys, time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import horizon as H                    # noqa: E402
from fiabilidad import horizonte       # noqa: E402
from elipse import slope_deg           # noqa: E402


def app_id(sid: str) -> str:           # MMA_K2023 -> mma-k2023 (ids de la app)
    return sid.lower().replace("_", "-")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dem", required=True); p.add_argument("--sites", required=True)
    p.add_argument("--near-dir", required=True); p.add_argument("--out", default="elipse.json")
    p.add_argument("--n", type=int, default=11); p.add_argument("--step-m", type=float, default=40.0)
    p.add_argument("--radius-m", type=float, default=200.0)
    p.add_argument("--obs", type=float, default=2.0)
    p.add_argument("--range-km", type=float, default=150.0); p.add_argument("--near-range-km", type=float, default=15.0)
    a = p.parse_args()

    out = {"_meta": {
        "what": "Landing-error grid around each team site: terrain horizon at every grid point",
        "horizon": "720 values, azimuth 0..359.5 every 0.5 deg from local north clockwise, in HUNDREDTHS of a degree (divide by 100)",
        "method": "Same as horizons.json for team sites: LOLA 5 m (PGDA 78) near field + LOLA 80 m (PGDA 90) to 150 km, observer 2 m",
        "slope": "slope100: deg over a 100 m baseline (NASA Artemis III landing criterion: <10 deg over 100 m), from the 5 m DEM. slope10: same over 10 m (finer, noisier)",
        "grid": f"{a.n}x{a.n} every {a.step_m:g} m, points within {a.radius_m:g} m of the site",
        "script": "elipse_export.py (team), written with Claude"}}
    far_rng, near_rng = a.range_km * 1000, a.near_range_km * 1000
    offs = (np.arange(a.n) - (a.n - 1) / 2) * a.step_m
    for s in json.load(open(a.sites))["sites"]:
        t = time.time()
        lat0, lon0 = s["lat"], s["lon"] % 360
        half = (a.n - 1) / 2 * a.step_m
        dem_far = H.load_dem(a.dem, center_lonlat=(lon0, lat0), radius_m=far_rng * 1.05 + half + 500)
        dem_near = H.load_dem(os.path.join(a.near_dir, s["dem_near"].split(" ")[0]),
                              center_lonlat=(lon0, lat0), radius_m=near_rng * 1.05 + half + 500)
        pts = []
        for dy in offs[::-1]:
            for dx in offs:
                r = math.hypot(dx, dy)
                if r > a.radius_m + 1e-6:
                    continue
                if r == 0:
                    la, lo = lat0, lon0
                else:
                    la_r, lo_r = H.destination(math.radians(lat0), math.radians(lon0), math.atan2(dx, dy), r / H.R_MOON)
                    la, lo = math.degrees(la_r), math.degrees(lo_r) % 360
                h = horizonte(dem_far, dem_near, la, lo, a.obs, far_rng, near_rng)
                assert h["rays_without_data"] == 0
                pts.append({"e": int(dx), "n": int(dy), "lat": round(la, 6), "lon": round(lo, 6),
                            "slope10": round(slope_deg(dem_near, la, lo), 1), "slope100": round(slope_deg(dem_near, la, lo, base_px=10), 1),
                            "h": [int(round(v * 100)) for v in h["el_deg"]]})
        out[app_id(s["id"])] = {"stepM": a.step_m, "radiusM": a.radius_m, "points": pts}
        print(f"{s['id']}: {len(pts)} puntos, {time.time() - t:.0f} s")
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    print(a.out, f"{os.path.getsize(a.out) / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
