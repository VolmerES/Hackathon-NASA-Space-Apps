// Real data model. Where the Sun and Earth are, seen from any point of the Moon, every hour:
//  - sub-solar and sub-Earth points on the Moon (libration included) and the Earth-Moon distance,
//    from NASA JPL Horizons (DE441), scripts/fetch_subpoints.py. Checked against direct per-site
//    Horizons runs: max difference 0.0065 deg over 10,249 hours and 6 sites;
//  - terrain horizon of every candidate site, ray-traced on NASA LRO LOLA relief (16 px/deg),
//    scripts/build_catalogue.py;
//  - candidate sites: Wueller et al. (2026), 130 sites in the 16 Artemis candidate regions;
//  - Moon elevation over NASA's Madrid deep space station, from Horizons (fetch_madrid.py).
// Everything is computed here, in the browser, from those files: no server.

export interface Site {
  id: string
  /** Short code from the source (CR06, MMA_K2023, 001...). */
  code: string
  name: string
  lat: number
  lon: number
  /** Terrain horizon (deg) for azimuths 0..359.5 every 0.5 deg, from local north clockwise. */
  horizon: number[]
  region?: string
  regionName?: string
  /** Published max consecutive sunlit days per southern midsummer (Wueller et al. 2026). */
  published?: Record<string, number>
  /** Ours for the same midsummer (2027), to flag sites where the two disagree. */
  oursSunDays2027?: number
  /** Custom coordinates: no terrain data, ideal (smooth sphere) horizon. */
  ideal?: boolean
}

export interface Mission {
  landing: Date
  durationDays: number
  slipDays: number
  survivalPowerW: number
  minAntennaElevDeg: number
}

export interface Sample {
  t: Date
  sunAz: number
  sunEl: number
  earthAz: number
  earthEl: number
  sunVisible: number // fraction of the solar disc above the terrain, 0..1
  earthVisible: boolean
  /** Earth in view from the site AND the Moon at least 10 deg over Madrid (Robledo de Chavela). */
  madridLink: boolean
}

export interface Day {
  t: Date
  sun: number
  earth: number
  both: number
}

export interface Metrics {
  sunlightPct: number
  longestNightH: number
  batteryKWh: number
  earthLinkPct: number
  opsPct: number
  madridPct: number
  hoursToSunset: number | null
  hoursToEarthset: number | null
  verdict: 'viable' | 'marginal' | 'not-viable'
}

export const MADRID_DSN = { name: 'Robledo de Chavela', lat: 40.431, lon: -4.248, minElevDeg: 10 }

const R_MOON_KM = 1737.4
const SUN_RADIUS_DEG = 0.2665
const DEG = Math.PI / 180
const HOUR = 3600000

/** Filled by loadData(). */
export const SITES: Site[] = []
let rows: Float64Array = new Float64Array(0) // 5 per hour: earthLon, earthLat, sunLon, sunLat, earthKm
let madrid: Float32Array = new Float32Array(0)
let startMs = 0
let hours = 0
export const DATA = { start: new Date(0), end: new Date(0), ready: false, validation: null as null | Record<string, number> }

const REGION_CODES: Record<string, string> = {
  AR: 'AR', CR: 'CR', CRE: 'CRE', dGR1: 'dGR1', dGR2: 'dGR2', dGKM: 'dGKM', FRA: 'FRA', HW: 'HW',
  MMA: 'MMA', MMO: 'MMO', MMP: 'MMP', NR1: 'NR1', NR2: 'NR2', PCB: 'PCB', PNS: 'PNS', SP: 'SP',
}

// "CR06" in region "Connecting Ridge" reads as "Connecting Ridge 06"; NASA's 2020 sites keep their number.
function friendlyName(code: string, region: string, regionName: string) {
  const prefix = REGION_CODES[region]
  let rest = code
  if (prefix && code.startsWith(prefix)) rest = code.slice(prefix.length).replace(/^_/, '')
  return `${regionName} ${rest}`.trim()
}

export type DataPart = 'ephem' | 'sites' | 'horizons' | 'madrid'
type Progress = (part: DataPart, detail: Record<string, number>) => void
const listeners: Progress[] = []
const doneParts = new Map<DataPart, Record<string, number>>()
/** Be told as each data file arrives (parts already loaded are reported at once). */
export function onDataProgress(fn: Progress) {
  listeners.push(fn)
  doneParts.forEach((d, part) => fn(part, d))
  return () => {
    listeners.splice(listeners.indexOf(fn), 1)
  }
}
const report = (part: DataPart, detail: Record<string, number>) => {
  doneParts.set(part, detail)
  listeners.forEach((fn) => fn(part, detail))
}

let loading: Promise<void> | null = null
export function loadData(base = 'data/'): Promise<void> {
  loading ??= (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const get = (f: string): Promise<any> => fetch(base + f).then((r) => (r.ok ? r.json() : Promise.reject(new Error(f))))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tap = (p: Promise<any>, part: DataPart, detail: (x: any) => Record<string, number>): Promise<any> => p.then((x) => (report(part, detail(x)), x))
    const [sites, horizons, sub, mad, val] = await Promise.all([
      tap(get('sites.json'), 'sites', (x: { sites: { region: string }[] }) => ({ sites: x.sites.length, regions: new Set(x.sites.map((s) => s.region)).size })),
      tap(get('horizons.json'), 'horizons', (x: Record<string, unknown>) => ({ sites: Object.keys(x).length - 1, azimuths: 720 })),
      tap(get('subpoints.json'), 'ephem', (x: { rows: unknown[] }) => ({ hours: x.rows.length })),
      tap(get('madrid.json'), 'madrid', (x: { el: unknown[] }) => ({ hours: x.el.length })),
      get('validation.json').catch(() => null),
    ])
    startMs = Date.parse(sub.start)
    hours = sub.rows.length
    rows = new Float64Array(hours * 5)
    sub.rows.forEach((r: number[], i: number) => rows.set(r, i * 5))
    madrid = Float32Array.from(mad.el as number[])
    DATA.start = new Date(startMs)
    DATA.end = new Date(startMs + (hours - 1) * HOUR)
    DATA.validation = val?.stats ?? null
    const ours2027 = new Map<string, number>((val?.sites ?? []).map((c: { id: string; ours: number }) => [c.id, c.ours]))
    SITES.length = 0
    for (const s of sites.sites) {
      SITES.push({
        id: s.id,
        code: s.name,
        name: friendlyName(s.name, s.region, s.regionName),
        lat: s.lat,
        lon: s.lon,
        horizon: horizons[s.id],
        region: s.region,
        regionName: s.regionName,
        published: s.publishedSunDays,
        oursSunDays2027: ours2027.get(s.id),
      })
    }
    DATA.ready = true
  })()
  return loading
}

export function customSite(lat: number, lon: number): Site {
  return {
    id: `custom:${lat.toFixed(2)},${lon.toFixed(2)}`,
    code: 'custom',
    name: `Custom ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
    lat,
    lon,
    horizon: new Array(720).fill(0),
    ideal: true,
  }
}

export function horizonAt(site: Site, az: number): number {
  const a = ((az % 360) + 360) % 360
  const i = a * 2
  const i0 = Math.floor(i) % 720
  const i1 = (i0 + 1) % 720
  const f = i - Math.floor(i)
  return site.horizon[i0] * (1 - f) + site.horizon[i1] * f
}

/** The hourly data cover this range; outside it nothing is computed. */
export const clampToData = (t: number) => Math.min(DATA.end.getTime(), Math.max(DATA.start.getTime(), t))

function unit(lat: number, lon: number): [number, number, number] {
  const la = lat * DEG
  const lo = lon * DEG
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
}

// Azimuth (from north, clockwise) and elevation of vector v seen from (lat, lon).
function local(lat: number, lon: number, v: [number, number, number]) {
  const la = lat * DEG
  const lo = lon * DEG
  const e = [-Math.sin(lo), Math.cos(lo), 0]
  const n = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)]
  const u = unit(lat, lon)
  const ve = v[0] * e[0] + v[1] * e[1]
  const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]
  const vu = v[0] * u[0] + v[1] * u[1] + v[2] * u[2]
  return { az: ((Math.atan2(ve, vn) / DEG) % 360 + 360) % 360, el: Math.atan2(vu, Math.hypot(ve, vn)) / DEG }
}

// Linear interpolation between two hourly rows; longitudes across the 0/360 wrap.
function row(t: number) {
  const x = Math.min(hours - 1.000001, Math.max(0, (t - startMs) / HOUR))
  const i = Math.floor(x)
  const f = x - i
  const a = i * 5
  const b = a + 5
  const lerpLon = (p: number, q: number) => {
    const d = ((q - p + 540) % 360) - 180
    return p + d * f
  }
  return {
    eLon: lerpLon(rows[a], rows[b]),
    eLat: rows[a + 1] + (rows[b + 1] - rows[a + 1]) * f,
    sLon: lerpLon(rows[a + 2], rows[b + 2]),
    sLat: rows[a + 3] + (rows[b + 3] - rows[a + 3]) * f,
    km: rows[a + 4] + (rows[b + 4] - rows[a + 4]) * f,
    madridEl: madrid[Math.min(madrid.length - 1, Math.round(x))],
  }
}

/** Sub-solar point on the Moon (deg, Moon-fixed, east longitude) at time t, from the Horizons rows. */
export function subsolarAt(t: Date): { lat: number; lon: number } {
  const r = row(t.getTime())
  return { lat: r.sLat, lon: r.sLon }
}

function sampleAt(site: Site, t: number, minAntennaElevDeg: number): Sample {
  const r = row(t)
  const sun = local(site.lat, site.lon, unit(r.sLat, r.sLon))
  const s = unit(site.lat, site.lon)
  const e = unit(r.eLat, r.eLon)
  const earth = local(site.lat, site.lon, [r.km * e[0] - R_MOON_KM * s[0], r.km * e[1] - R_MOON_KM * s[1], r.km * e[2] - R_MOON_KM * s[2]])
  const sunVisible = Math.min(1, Math.max(0, (sun.el - horizonAt(site, sun.az) + SUN_RADIUS_DEG) / (2 * SUN_RADIUS_DEG)))
  const earthVisible = earth.el - horizonAt(site, earth.az) >= minAntennaElevDeg
  return {
    t: new Date(t),
    sunAz: sun.az,
    sunEl: sun.el,
    earthAz: earth.az,
    earthEl: earth.el,
    sunVisible,
    earthVisible,
    madridLink: earthVisible && r.madridEl >= MADRID_DSN.minElevDeg,
  }
}

export function simulate(site: Site, mission: Mission): Sample[] {
  if (!DATA.ready) return []
  const start = clampToData(mission.landing.getTime() + mission.slipDays * 86400000)
  const end = clampToData(start + mission.durationDays * 86400000)
  const out: Sample[] = []
  for (let t = start; t <= end; t += HOUR) out.push(sampleAt(site, t, mission.minAntennaElevDeg))
  return out
}

/** Hour by hour over a long span, summarised per day (clipped to the data range). */
export function overview(site: Site, from: Date, days: number, minAntennaElevDeg: number): Day[] {
  const out: Day[] = []
  if (!DATA.ready) return out
  const first = Math.max(DATA.start.getTime(), Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  for (let d = 0; d < days; d++) {
    const day = first + d * 86400000
    if (day + 23 * HOUR > DATA.end.getTime()) break
    let sun = 0
    let earth = 0
    let both = 0
    for (let h = 0; h < 24; h++) {
      const s = sampleAt(site, day + h * HOUR, minAntennaElevDeg)
      const lit = s.sunVisible > 0.5
      sun += lit ? 1 : 0
      earth += s.earthVisible ? 1 : 0
      both += lit && s.earthVisible ? 1 : 0
    }
    out.push({ t: new Date(day), sun: sun / 24, earth: earth / 24, both: both / 24 })
  }
  return out
}

export function metrics(samples: Sample[], mission: Mission): Metrics {
  const n = Math.max(1, samples.length)
  const sunlit = samples.filter((s) => s.sunVisible > 0.5).length
  const earth = samples.filter((s) => s.earthVisible).length
  const ops = samples.filter((s) => s.sunVisible > 0.5 && s.earthVisible).length

  let longest = 0
  let run = 0
  for (const s of samples) {
    run = s.sunVisible > 0.5 ? 0 : run + 1
    longest = Math.max(longest, run)
  }
  const firstIndex = (pred: (s: Sample) => boolean) => {
    const i = samples.findIndex(pred)
    return i < 0 ? null : i
  }
  const hoursToSunset = samples.length && samples[0].sunVisible > 0.5 ? firstIndex((s) => s.sunVisible <= 0.5) : 0
  const hoursToEarthset = samples.length && samples[0].earthVisible ? firstIndex((s) => !s.earthVisible) : 0

  const sunlightPct = (100 * sunlit) / n
  const earthLinkPct = (100 * earth) / n
  const batteryKWh = (mission.survivalPowerW * longest) / 1000

  // Thresholds, stated in the app: a crewed or robotic stay needs (almost) continuous sunlight for
  // power and regular direct contact with Earth (Wueller et al. 2026 ask for continuous sunlight
  // over the whole Artemis III stay, with margin).
  let verdict: Metrics['verdict'] = 'not-viable'
  if (sunlightPct >= 90 && longest <= 24 && earthLinkPct >= 50) verdict = 'viable'
  else if (sunlightPct >= 60 && longest <= 72) verdict = 'marginal'

  return { sunlightPct, longestNightH: longest, batteryKWh, earthLinkPct, opsPct: (100 * ops) / n, madridPct: (100 * samples.filter((s) => s.madridLink).length) / n, hoursToSunset, hoursToEarthset, verdict }
}
