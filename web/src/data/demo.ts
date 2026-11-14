// DEMO DATA ONLY. Synthetic sites, horizons and Sun/Earth tracks so the
// interface can be built before the real pipeline (SPICE + LOLA) exists.
// None of these numbers are real. The real data will follow the same shapes
// (see docs/STACK.md, "El contrato de datos").

export interface Site {
  id: string
  name: string
  lat: number
  lon: number
  /** Horizon elevation (deg) for azimuths 0..359.5 every 0.5 deg (720 values). */
  horizon: number[]
  /** True for custom coordinates: ideal (smooth sphere) horizon, no terrain. */
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
  sunVisible: number // fraction of the solar disc above the local horizon, 0..1
  earthVisible: boolean
  /** Optional DSN layer: Earth in view from the site AND the Moon high enough over Madrid (Robledo de Chavela). */
  madridLink: boolean
}

/** One day of the long-range overview: fraction of the day's hours with each condition. */
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

const SUN_RADIUS_DEG = 0.265
const SYNODIC_DAYS = 29.53
const SIDEREAL_DAYS = 27.32
const STEP_HOURS = 1

// Madrid Deep Space Communications Complex (Robledo de Chavela), DSS-63.
export const MADRID_DSN = { name: 'Robledo de Chavela', lat: 40.431, lon: -4.248, minElevDeg: 10 }

// Deterministic pseudo-random generator, so every reload shows the same demo.
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function makeHorizon(seed: number, roughness: number, base: number): number[] {
  const rnd = seeded(seed)
  const terms = Array.from({ length: 7 }, (_, k) => ({
    amp: roughness * rnd() / (k + 1),
    freq: k + 1 + Math.floor(rnd() * 3),
    phase: rnd() * Math.PI * 2,
  }))
  return Array.from({ length: 720 }, (_, i) => {
    const az = (i / 2) * (Math.PI / 180)
    const v = terms.reduce((acc, t) => acc + t.amp * Math.sin(t.freq * az + t.phase), base)
    return Math.max(-0.4, v)
  })
}

export const SITES: Site[] = [
  { id: 'shackleton-rim', name: 'Shackleton rim', lat: -89.68, lon: -162.7, horizon: makeHorizon(11, 0.9, 0.2) },
  { id: 'connecting-ridge', name: 'Connecting ridge', lat: -89.45, lon: -137.3, horizon: makeHorizon(23, 1.3, 0.5) },
  { id: 'malapert-massif', name: 'Malapert massif', lat: -86.04, lon: 2.9, horizon: makeHorizon(37, 2.2, 1.1) },
  { id: 'nobile-rim-1', name: 'Nobile rim 1', lat: -85.43, lon: 37.3, horizon: makeHorizon(41, 1.8, 0.8) },
  { id: 'de-gerlache-rim', name: 'de Gerlache rim', lat: -88.7, lon: -68.6, horizon: makeHorizon(53, 1.5, 0.6) },
  { id: 'haworth', name: 'Haworth', lat: -87.4, lon: -5.0, horizon: makeHorizon(67, 2.6, 1.4) },
]

export function customSite(lat: number, lon: number): Site {
  return {
    id: `custom:${lat.toFixed(2)},${lon.toFixed(2)}`,
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

const EPOCH = Date.UTC(2026, 0, 1)

// Rough shape only. Near the south pole, elevation ≈ colatitude · cos(hour
// angle) − latitude of the sub-solar (or sub-Earth) point.
function sunAt(t: number, site: Site) {
  const days = (t - EPOCH) / 86400000
  const colat = 90 + site.lat
  const hourAngle = ((days / SYNODIC_DAYS) * 360 + site.lon) % 360
  const subSolarLat = -1.54 * Math.sin((2 * Math.PI * (days - 406)) / 346.6)
  const el = colat * Math.cos((hourAngle * Math.PI) / 180) - subSolarLat
  const az = (((hourAngle + 180) % 360) + 360) % 360
  return { az, el }
}

function earthAt(t: number, site: Site) {
  const days = (t - EPOCH) / 86400000
  const colat = 90 + site.lat
  const subEarthLon = 7.9 * Math.sin((2 * Math.PI * days) / SIDEREAL_DAYS)
  const subEarthLat = 6.7 * Math.sin((2 * Math.PI * days) / 27.21 + 1.1)
  const hourAngle = site.lon - subEarthLon
  const el = colat * Math.cos((hourAngle * Math.PI) / 180) - subEarthLat
  const az = (((hourAngle + 180) % 360) + 360) % 360
  return { az, el }
}

// Rough Moon elevation over Madrid: one pass every 24.84 h, declination swinging ±28° over a month.
function moonElevMadrid(t: number) {
  const hours = (t - EPOCH) / 3600000
  const H = (2 * Math.PI * hours) / 24.8412 + 1.3
  const dec = (28 * Math.PI) / 180 * Math.sin((2 * Math.PI * hours) / (27.32 * 24))
  const lat = (MADRID_DSN.lat * Math.PI) / 180
  return (Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)) * 180) / Math.PI
}

function sampleAt(site: Site, t: number, minAntennaElevDeg: number): Sample {
  const sun = sunAt(t, site)
  const earth = earthAt(t, site)
  const hSun = horizonAt(site, sun.az)
  const sunVisible = Math.min(1, Math.max(0, (sun.el - hSun + SUN_RADIUS_DEG) / (2 * SUN_RADIUS_DEG)))
  const earthVisible = earth.el - horizonAt(site, earth.az) >= minAntennaElevDeg
  const madridLink = earthVisible && moonElevMadrid(t) >= MADRID_DSN.minElevDeg
  return { t: new Date(t), sunAz: sun.az, sunEl: sun.el, earthAz: earth.az, earthEl: earth.el, sunVisible, earthVisible, madridLink }
}

/** Hour by hour over a long span (e.g. 14 months), summarised per day. */
export function overview(site: Site, from: Date, days: number, minAntennaElevDeg: number): Day[] {
  const out: Day[] = []
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  for (let d = 0; d < days; d++) {
    let sun = 0
    let earth = 0
    let both = 0
    for (let h = 0; h < 24; h++) {
      const s = sampleAt(site, start + (d * 24 + h) * 3600000, minAntennaElevDeg)
      const lit = s.sunVisible > 0.5
      sun += lit ? 1 : 0
      earth += s.earthVisible ? 1 : 0
      both += lit && s.earthVisible ? 1 : 0
    }
    out.push({ t: new Date(start + d * 86400000), sun: sun / 24, earth: earth / 24, both: both / 24 })
  }
  return out
}

export function simulate(site: Site, mission: Mission): Sample[] {
  const start = mission.landing.getTime() + mission.slipDays * 86400000
  const n = Math.round((mission.durationDays * 24) / STEP_HOURS)
  const out: Sample[] = []
  for (let k = 0; k <= n; k++) out.push(sampleAt(site, start + k * STEP_HOURS * 3600000, mission.minAntennaElevDeg))
  return out
}

export function metrics(samples: Sample[], mission: Mission): Metrics {
  const n = samples.length
  const sunlit = samples.filter((s) => s.sunVisible > 0.5).length
  const earth = samples.filter((s) => s.earthVisible).length
  const ops = samples.filter((s) => s.sunVisible > 0.5 && s.earthVisible).length

  let longest = 0
  let run = 0
  for (const s of samples) {
    run = s.sunVisible > 0.5 ? 0 : run + STEP_HOURS
    longest = Math.max(longest, run)
  }

  const firstIndex = (pred: (s: Sample) => boolean) => {
    const i = samples.findIndex(pred)
    return i < 0 ? null : i * STEP_HOURS
  }
  const hoursToSunset = samples[0].sunVisible > 0.5 ? firstIndex((s) => s.sunVisible <= 0.5) : 0
  const hoursToEarthset = samples[0].earthVisible ? firstIndex((s) => !s.earthVisible) : 0

  const sunlightPct = (100 * sunlit) / n
  const earthLinkPct = (100 * earth) / n
  const batteryKWh = (mission.survivalPowerW * longest) / 1000

  let verdict: Metrics['verdict'] = 'not-viable'
  if (sunlightPct >= 70 && longest <= 50 && earthLinkPct >= 50) verdict = 'viable'
  else if (sunlightPct >= 45 && longest <= 120) verdict = 'marginal'

  return {
    sunlightPct,
    longestNightH: longest,
    batteryKWh,
    earthLinkPct,
    opsPct: (100 * ops) / n,
    madridPct: (100 * samples.filter((s) => s.madridLink).length) / n,
    hoursToSunset,
    hoursToEarthset,
    verdict,
  }
}
