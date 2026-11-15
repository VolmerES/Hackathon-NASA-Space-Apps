// Real data model. Where the Sun and Earth are, seen from any point of the Moon, every hour:
//  - sub-solar and sub-Earth points on the Moon (libration included) and the Earth-Moon distance,
//    from NASA JPL Horizons (DE441), scripts/fetch_subpoints.py. Checked against direct per-site
//    Horizons runs: max difference 0.0065 deg over 10,249 hours and 6 sites;
//  - terrain horizon of every candidate site, ray-traced on NASA LRO LOLA relief (80 m),
//    scripts/build_catalogue.py; the 5 sites of the team use 5 m relief near the site
//    (scripts/import_team_package.py);
//  - candidate sites: Wueller et al. (2026), 130 sites in the 16 Artemis candidate regions;
//  - Moon elevation over NASA's Madrid deep space station, from Horizons (fetch_madrid.py).
// Everything is computed here, in the browser, from those files: no server.
import { versioned } from './version'

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
  /** One of the sites the team studied in depth: finer horizon (5 m relief), hypothesis, NASA check. */
  team?: TeamSite
}

type Check = { nasa: number; band: [number, number]; ours: number; ours2027: number }
export interface TeamSite {
  code: string
  hypothesis: { es: string; en: string }
  nasaRegion: { name: string; lat: number; lon: number }
  heightM: number
  /** Distance (km) to the ridge that makes the horizon, for azimuths 0..359.5 every 0.5 deg. */
  ridgeKm: number[]
  /** Share of time with the Sun and with Earth in view over 18.6 years, ours against NASA PGDA 69. */
  pgda69: { sun: Check; earth: Check }
}

/** What a mission asks of its stay: the verdict thresholds. The defaults are the ones the tool
 *  always used (inspired by Wueller et al. 2026); a mission can set its own. */
export interface Requirements {
  minSunPct: number
  maxDarkH: number
  minEarthPct: number
}
export const DEFAULT_REQUIREMENTS: Requirements = { minSunPct: 90, maxDarkH: 24, minEarthPct: 50 }

export interface Mission {
  landing: Date
  durationDays: number
  slipDays: number
  survivalPowerW: number
  minAntennaElevDeg: number
  /** Battery capacity (Wh). When set, a stay whose longest night needs more is not viable. */
  batteryWh?: number
  /** The mission's own thresholds; DEFAULT_REQUIREMENTS when absent. */
  req?: Requirements
  /** Usable fraction of the battery (depth of discharge); DEFAULT_DOD when absent. */
  dod?: number
  /** Efficiency of storing and delivering the energy; DEFAULT_ETA when absent. */
  eta?: number
  /** Longest time without Earth the mission accepts (h); 0 or absent: not checked. */
  maxNoEarthH?: number
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
  /** Battery left after the longest night (Wh): capacity minus the battery that night needs. Null: no battery set. */
  batteryMarginWh: number | null
  verdict: 'viable' | 'marginal' | 'not-viable'
  /** The longest night of the stay: when it starts and ends (null: no night). */
  longestNightStart: Date | null
  longestNightEnd: Date | null
  /** The longest run without Earth in view (h) and when it starts. */
  longestNoEarthH: number
  longestNoEarthStart: Date | null
  /** Energy (Wh) the battery must deliver through the longest night, no margins (nightEnergyWh). */
  nightEnergyWh: number
  /** Nominal capacity (Wh) for that night with the mission's margins (requiredBatteryWh). */
  requiredBatteryWh: number
  /** The mission's limit on hours without Earth is exceeded (the verdict is then at most marginal). */
  noEarthExceeded: boolean
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

export type DataPart = 'ephem' | 'sites' | 'team' | 'horizons' | 'madrid' | 'check'
/** `detail` is null when an optional file is missing: the tool goes on without it. */
type Progress = (part: DataPart, detail: Record<string, number> | null) => void
const listeners: Progress[] = []
const doneParts = new Map<DataPart, Record<string, number> | null>()
/** Be told as each data file arrives (parts already loaded are reported at once). */
export function onDataProgress(fn: Progress) {
  listeners.push(fn)
  doneParts.forEach((d, part) => fn(part, d))
  return () => {
    listeners.splice(listeners.indexOf(fn), 1)
  }
}
const report = (part: DataPart, detail: Record<string, number> | null) => {
  doneParts.set(part, detail)
  listeners.forEach((fn) => fn(part, detail))
}

let loading: Promise<void> | null = null
export function loadData(base = 'data/'): Promise<void> {
  loading ??= (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const get = (f: string): Promise<any> => fetch(versioned(base + f)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(f))))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tap = (p: Promise<any>, part: DataPart, detail: (x: any) => Record<string, number>): Promise<any> => p.then((x) => (report(part, detail(x)), x))
    const [sites, horizons, sub, mad, val, team] = await Promise.all([
      tap(get('sites.json'), 'sites', (x: { sites: { region: string }[] }) => ({ sites: x.sites.length, regions: new Set(x.sites.map((s) => s.region)).size })),
      tap(get('horizons.json'), 'horizons', (x: Record<string, unknown>) => ({ sites: Object.keys(x).length - 1, azimuths: 720 })),
      tap(get('subpoints.json'), 'ephem', (x: { rows: unknown[]; start: string }) => ({ hours: x.rows.length, start: Date.parse(x.start) })),
      tap(get('madrid.json'), 'madrid', (x: { el: unknown[] }) => ({ hours: x.el.length })),
      get('validation.json').then(
        (x) => (report('check', { sites: x.stats.sites, median: x.stats.medianAbsDiffDays }), x),
        () => (report('check', null), null),
      ),
      get('team.json').then(
        (x) => (report('team', { sites: x.sites.length }), x),
        () => (report('team', null), null),
      ),
    ])
    const teamOf = new Map<string, TeamSite>((team?.sites ?? []).map((x: TeamSite & { id: string }) => [x.id, x]))
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
        team: teamOf.get(s.id),
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

/** Distance (km) to the terrain that makes the horizon toward `az`, where the team traced it. */
export function ridgeKmAt(site: Site, az: number): number | null {
  const r = site.team?.ridgeKm
  if (!r) return null
  return r[Math.round((((az % 360) + 360) % 360) / 0.5) % 720]
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

/** Sub-Earth point on the Moon (deg) and Earth-Moon distance (km) at time t, from the Horizons rows. */
export function subearthAt(t: Date): { lat: number; lon: number; km: number } {
  const r = row(t.getTime())
  return { lat: r.eLat, lon: r.eLon, km: r.km }
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

/** The verdict, shared by metrics() and landingCalendar(): viable when the stay meets the mission's
 *  requirements; marginal within 2/3 of the sunlight and 3 times the night (60 % and 72 h with the
 *  defaults); never viable if the battery cannot carry the longest night. */
export function verdictOf(sunlightPct: number, longestNightH: number, earthLinkPct: number, req: Requirements = DEFAULT_REQUIREMENTS, batteryOk = true): Metrics['verdict'] {
  if (!batteryOk) return 'not-viable'
  if (sunlightPct >= req.minSunPct && longestNightH <= req.maxDarkH && earthLinkPct >= req.minEarthPct) return 'viable'
  if (sunlightPct >= (req.minSunPct * 2) / 3 && longestNightH <= req.maxDarkH * 3) return 'marginal'
  return 'not-viable'
}

// Battery margins are the user's: none by default (usable fraction and efficiency 1). Every default
// below comes from a NASA source (SOURCES, numbered as in the team's package v2, section 7).
export const DEFAULT_DOD = 1 // usable fraction of the battery (depth of discharge)
export const DEFAULT_ETA = 1 // efficiency of storing and delivering the energy

/** Energy (Wh) the battery must DELIVER to get through a night of nightH hours at powerW. No margins: the physical minimum. */
export const nightEnergyWh = (powerW: number, nightH: number) => powerW * nightH

/** Nominal capacity (Wh) with the user's margins (1 = no margin). */
export const requiredBatteryWh = (powerW: number, nightH: number, dod = DEFAULT_DOD, eta = DEFAULT_ETA) => nightEnergyWh(powerW, nightH) / (dod * eta)

/** Specific energy of today's space batteries at module level (source 5). */
export const SPACE_BATTERY_WH_PER_KG: [number, number] = [125, 150]
/** Battery mass (kg) for wh, lightest and heaviest with today's space batteries. */
export const batteryMassKg = (wh: number): [number, number] => [wh / SPACE_BATTERY_WH_PER_KG[1], wh / SPACE_BATTERY_WH_PER_KG[0]]

/** A real reference: the battery of NASA's VIPER rover (source 4). */
export const VIPER_BATTERY_WH = 5420

/** NASA's crewed landing requirement (source 1): land within 100 m, under 10 deg of slope over 100 m.
 *  The name stays from when it was set for Artemis III (since February 2026 the first landing is Artemis IV). */
export const ARTEMIS3 = { landingAccuracyM: 100, maxLandingSlopeDeg: 10, slopeBaselineM: 100 }

/** Night survival power profiles. LTV's 65 W is our average: 9.7 kWh ÷ 150 h (NASA gives the energy, not the power). */
export const POWER_PRESETS = [
  { id: 'lemsHeater', w: 2.5, src: 3 },
  { id: 'smallLander', w: 40, src: 2 },
  { id: 'ltv', w: 65, src: 6 },
  { id: 'custom', w: null, src: null },
] as const
export type PowerPreset = (typeof POWER_PRESETS)[number]['id']

/** The NASA sources behind every default, numbered as in the team's package (v2, section 7). */
export const SOURCES = [
  { n: 1, title: 'NASA, Artemis Human Landing System Overview, 2025 International Space Apps Challenge (L. Ortiz, A. Dwyer Cianciolo)', url: 'https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf' },
  { n: 2, title: 'NASA GRC Compass, Overnight Power and Thermal Solutions for Small Landers (2022)', url: 'https://ntrs.nasa.gov/api/citations/20220018215/downloads/Overnight%20Power%20and%20Thermal%20Solutions%20for%20Small%20Landers%20final2.pdf' },
  { n: 3, title: 'NASA, Simulating the Lunar Thermal Environment for the Surface-Deployed LEMS Artemis III TVAC Test (2026)', url: 'https://ntrs.nasa.gov/citations/20260001865' },
  { n: 4, title: 'NASA, VIPER Rover Overview (LSIC 2024)', url: 'https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf' },
  { n: 5, title: 'E. Brandon (JPL/Caltech), Space Power Workshop, April 2026', url: 'https://spw.aerospace.org/files/2026/05/2_ES1_E.-Brandon_Presentation.pdf' },
  { n: 6, title: 'NASA, Wheel Module Motor Trade Study for LTV TCS (2024)', url: 'https://ntrs.nasa.gov/api/citations/20240004621/downloads/Wheel%20Module%20Motor%20Trade%20Study%20for%20LTV%20TCS.pdf' },
] as const

/** Does a battery of batteryWh carry survivalPowerW through a night of nightH hours? (No battery set: yes.) */
export const batteryCarries = (nightH: number, survivalPowerW: number, batteryWh?: number, dod = DEFAULT_DOD, eta = DEFAULT_ETA) =>
  !batteryWh || requiredBatteryWh(survivalPowerW, nightH, dod, eta) <= batteryWh

/** One calendar day: the verdict of landing at each UTC hour (null: the stay runs past the data). */
export interface DayPlan {
  t: Date
  hours: (Metrics['verdict'] | null)[]
}

// Landing calendar of a site for a stay of durationDays: for every hour of the data, the verdict of a
// stay that starts then (same thresholds as metrics()), and only if that hour is a landing window,
// with the Sun and Earth both in view (power and direct contact during the descent). Otherwise that
// hour is 'not-viable'. Sliding sums over one hourly pass: about 10,000 samples per site.
export function landingCalendar(site: Site, durationDays: number, minAntennaElevDeg: number, req: Requirements = DEFAULT_REQUIREMENTS, survivalPowerW = 0, batteryWh?: number, dod = DEFAULT_DOD, eta = DEFAULT_ETA): DayPlan[] {
  if (!DATA.ready) return []
  const n = hours
  const lit = new Uint8Array(n)
  const earth = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const s = sampleAt(site, startMs + i * HOUR, minAntennaElevDeg)
    lit[i] = s.sunVisible > 0.5 ? 1 : 0
    earth[i] = s.earthVisible ? 1 : 0
  }
  const pl = new Uint32Array(n + 1)
  const pe = new Uint32Array(n + 1)
  for (let i = 0; i < n; i++) {
    pl[i + 1] = pl[i] + lit[i]
    pe[i + 1] = pe[i] + earth[i]
  }
  const w = Math.round(durationDays * 24) // a stay covers w + 1 hourly samples, as in simulate()
  const verdictAt = (i: number): Metrics['verdict'] | null => {
    if (i + w >= n) return null
    if (!lit[i] || !earth[i]) return 'not-viable'
    const cnt = w + 1
    const sunPct = (100 * (pl[i + w + 1] - pl[i])) / cnt
    if (sunPct < (req.minSunPct * 2) / 3) return 'not-viable'
    let longest = 0
    let run = 0
    for (let k = i; k <= i + w; k++) {
      run = lit[k] ? 0 : run + 1
      if (run > longest) longest = run
    }
    return verdictOf(sunPct, longest, (100 * (pe[i + w + 1] - pe[i])) / cnt, req, batteryCarries(longest, survivalPowerW, batteryWh, dod, eta))
  }
  const out: DayPlan[] = []
  for (let d = 0; d * 24 < n; d++) {
    const hrs: (Metrics['verdict'] | null)[] = []
    for (let h = 0; h < 24; h++) hrs.push(d * 24 + h < n ? verdictAt(d * 24 + h) : null)
    out.push({ t: new Date(startMs + d * 24 * HOUR), hours: hrs })
  }
  return out
}

export function metrics(samples: Sample[], mission: Mission): Metrics {
  const n = Math.max(1, samples.length)
  const sunlit = samples.filter((s) => s.sunVisible > 0.5).length
  const earth = samples.filter((s) => s.earthVisible).length
  const ops = samples.filter((s) => s.sunVisible > 0.5 && s.earthVisible).length

  // Longest runs of dark hours and of hours without Earth, with the index where each one starts.
  let longest = 0
  let longestAt = -1
  let run = 0
  let noEarth = 0
  let noEarthAt = -1
  let runE = 0
  samples.forEach((s, i) => {
    run = s.sunVisible > 0.5 ? 0 : run + 1
    if (run > longest) {
      longest = run
      longestAt = i - run + 1
    }
    runE = s.earthVisible ? 0 : runE + 1
    if (runE > noEarth) {
      noEarth = runE
      noEarthAt = i - runE + 1
    }
  })
  const longestNightStart = longestAt >= 0 ? samples[longestAt].t : null
  const longestNightEnd = longestNightStart ? new Date(longestNightStart.getTime() + longest * HOUR) : null
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
  const dod = mission.dod ?? DEFAULT_DOD
  const eta = mission.eta ?? DEFAULT_ETA
  const needWh = requiredBatteryWh(mission.survivalPowerW, longest, dod, eta)
  let verdict = verdictOf(sunlightPct, longest, earthLinkPct, mission.req, batteryCarries(longest, mission.survivalPowerW, mission.batteryWh, dod, eta))
  // Too long without Earth for this mission: at most marginal.
  const noEarthExceeded = !!mission.maxNoEarthH && mission.maxNoEarthH > 0 && noEarth > mission.maxNoEarthH
  if (noEarthExceeded && verdict === 'viable') verdict = 'marginal'
  const batteryMarginWh = mission.batteryWh ? mission.batteryWh - needWh : null

  return {
    sunlightPct,
    longestNightH: longest,
    batteryKWh,
    earthLinkPct,
    opsPct: (100 * ops) / n,
    madridPct: (100 * samples.filter((s) => s.madridLink).length) / n,
    hoursToSunset,
    hoursToEarthset,
    batteryMarginWh,
    verdict,
    longestNightStart,
    longestNightEnd,
    longestNoEarthH: noEarth,
    longestNoEarthStart: noEarthAt >= 0 ? samples[noEarthAt].t : null,
    nightEnergyWh: nightEnergyWh(mission.survivalPowerW, longest),
    requiredBatteryWh: needWh,
    noEarthExceeded,
  }
}

// Landing-error grid around each team site (elipse.json, scripts/elipse_export.py): 81 points every
// 40 m out to 200 m, each with its own terrain horizon (hundredths of a degree) and its slope over
// 100 m (the Artemis III criterion) and over 10 m. Loaded only when a mission report needs it.
type GridPoint = { e: number; n: number; lat: number; lon: number; slope100: number; slope10: number; h: number[] }
let grid: Record<string, { stepM: number; radiusM: number; points: GridPoint[] }> | null = null
let gridLoading: Promise<typeof grid> | null = null
export function loadGrid(base = 'data/') {
  gridLoading ??= fetch(versioned(base + 'elipse.json'))
    .then((r) => (r.ok ? r.json() : null))
    .then((g) => (grid = g))
    .catch(() => null)
  return gridLoading
}
export const gridReady = () => grid !== null

/** slope: over 100 m (Artemis III criterion); slope10: over 10 m, finer and noisier. */
export type GridSite = Site & { e: number; n: number; distM: number; slope: number; slope10: number; parent: string }
const gridSite = (siteId: string, p: GridPoint): GridSite => ({
  id: `${siteId}@${p.e},${p.n}`,
  code: 'grid',
  name: `${p.e} m E, ${p.n} m N`,
  lat: p.lat,
  lon: p.lon,
  horizon: p.h.map((v) => v / 100),
  e: p.e,
  n: p.n,
  distM: Math.hypot(p.e, p.n),
  slope: p.slope100,
  slope10: p.slope10,
  parent: siteId,
})
/** The grid points of a team site as ordinary sites (for simulate/metrics). Empty until loadGrid(). */
export function gridSites(siteId: string): GridSite[] {
  return grid?.[siteId]?.points.map((p) => gridSite(siteId, p)) ?? []
}
/** A grid point from its id ("mma-k2023@40,80"), once the grid is loaded. */
export function gridSiteById(id: string): GridSite | undefined {
  const [siteId, off] = id.split('@')
  const [e, n] = (off ?? '').split(',').map(Number)
  const p = grid?.[siteId]?.points.find((q) => q.e === e && q.n === n)
  return p ? gridSite(siteId, p) : undefined
}

// Landing-grid robustness for every landing date (robustez.json, computed by the team with this same
// model over elipse.json): per team site and landing day at 00:00 UTC, for a 14-day stay. c: longest
// night at the target; w: worst longest night within 100 m; b: the same after moving the target to the
// best grid point within 100 m (hours). e0/emin/emax: Earth in view at the target and its range within
// 100 m (%). Loaded only when a mission report needs it.
export type RobustDay = { t: string; c: number; w: number; b: number; e0: number; emin: number; emax: number }
let robust: Record<string, unknown> | null = null
let robustLoading: Promise<unknown> | null = null
export function loadRobustness(base = 'data/') {
  robustLoading ??= fetch(versioned(base + 'robustez.json'))
    .then((r) => (r.ok ? r.json() : null))
    .then((g) => (robust = g))
    .catch(() => null)
  return robustLoading
}
/** Every landing date of a team site, for stays of `stayDays` days (empty if not loaded). */
export function robustness(siteId: string): { stayDays: number; days: RobustDay[] } {
  const days = robust && Array.isArray(robust[siteId]) ? (robust[siteId] as RobustDay[]) : []
  const meta = robust?._meta as { stay_days?: number } | undefined
  return { stayDays: meta?.stay_days ?? 14, days }
}

/** Great-circle distance between two points of the Moon (km), haversine on a 1737.4 km sphere. */
export function moonDistanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = (b.lat - a.lat) * DEG
  const dLon = (b.lon - a.lon) * DEG
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2
  return 2 * R_MOON_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}
