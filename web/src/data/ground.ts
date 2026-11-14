// Real ground around the team's sites: LOLA heights every 5 m (NASA PGDA 78, Barker et al. 2021),
// a 900 m square centred on each site, made by scripts/ground_patches.py. Used by the street view
// for the near ground and by the landing for the slope under the lander. Loaded on first use.

export type Ground = {
  n: number
  step: number
  /** Decimetres relative to the site; rows south to north, columns west to east. */
  z: Int16Array
  heightM: number
  slopeDeg: number
  /** Rise of the ground per metre towards the east and towards the north, at the site. */
  gradE: number
  gradN: number
}

type Meta = { n: number; stepM: number; sites: Record<string, { block: number; heightM: number; slopeDeg: number; gradE: number; gradN: number }> }

let all: Promise<{ meta: Meta; bin: ArrayBuffer } | null> | null = null

export function loadGround(id: string): Promise<Ground | null> {
  all ??= Promise.all([fetch('data/ground.json').then((r) => (r.ok ? r.json() : null)), fetch('data/ground.bin').then((r) => (r.ok ? r.arrayBuffer() : null))])
    .then(([meta, bin]) => (meta && bin ? { meta, bin } : null))
    .catch(() => {
      all = null
      return null
    })
  return all.then((d) => {
    const s = d?.meta.sites[id]
    if (!d || !s) return null
    const n = d.meta.n
    return { n, step: d.meta.stepM, z: new Int16Array(d.bin, s.block * n * n * 2, n * n), heightM: s.heightM, slopeDeg: s.slopeDeg, gradE: s.gradE, gradN: s.gradN }
  })
}

/** Height (m) relative to the site at `de` metres east and `dn` metres north, or null off the map. */
export function groundHeight(g: Ground, de: number, dn: number): number | null {
  const c = (g.n - 1) / 2
  const x = de / g.step + c
  const y = dn / g.step + c
  if (x < 0 || y < 0 || x > g.n - 1 || y > g.n - 1) return null
  const x0 = Math.min(g.n - 2, Math.floor(x))
  const y0 = Math.min(g.n - 2, Math.floor(y))
  const tx = x - x0
  const ty = y - y0
  const at = (i: number, j: number) => g.z[j * g.n + i] / 10
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
}

/** Angle (deg) between the Sun and the perpendicular to the ground at the site: under 90, the Sun
 *  shines on the slope; over 90, the slope faces away. */
export function incidenceDeg(g: Ground, sunAz: number, sunEl: number): number {
  const D = Math.PI / 180
  const s = [Math.sin(sunAz * D) * Math.cos(sunEl * D), Math.cos(sunAz * D) * Math.cos(sunEl * D), Math.sin(sunEl * D)]
  const len = Math.hypot(g.gradE, g.gradN, 1)
  const cos = (-g.gradE * s[0] - g.gradN * s[1] + s[2]) / len
  return Math.acos(Math.max(-1, Math.min(1, cos))) / D
}
