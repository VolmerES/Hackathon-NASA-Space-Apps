// Sunlight heat map of the south polar cap for a stay: the share of the stay each point is sunlit.
// Indicative only. It uses the same test as the site model (Sun elevation against the terrain
// horizon in its azimuth) but on a coarse grid: LOLA relief at about 1.9 km per pixel, horizons
// every 10 degrees of azimuth (scripts/moon_light_horizons.py). Checked against the 130 sites it
// follows the trend (correlation 0.72 to 0.79) and differs by about 12 points on average at a
// given site, so the figure that counts is always the one of the site itself.
import { subsolarAt } from './model'

export const LIGHT_CAP_DEG = 10 // colatitude covered by the grid
const N = 256
const AZ_N = 36
const MIN = -6
const RANGE = 24
const SUN_RADIUS_DEG = 0.2665
const DEG = Math.PI / 180
const MAX_SAMPLES = 240

type Grid = { hz: Uint8Array; frame: Float32Array } // frame: per pixel, the local east, north and up axes
let grid: Promise<Grid> | null = null

/** Downloads the horizon atlas (1.7 MB) the first time the map is asked for. */
function loadGrid(): Promise<Grid> {
  grid ??= new Promise<Grid>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d', { willReadFrequently: true })
      if (!g) return reject(new Error('canvas'))
      g.drawImage(img, 0, 0)
      const px = g.getImageData(0, 0, c.width, c.height).data
      const side = Math.round(c.width / N)
      const hz = new Uint8Array(AZ_N * N * N)
      for (let a = 0; a < AZ_N; a++) {
        const ox = (a % side) * N
        const oy = Math.floor(a / side) * N
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) hz[(a * N + y) * N + x] = px[((oy + y) * c.width + ox + x) * 4]
      }
      const frame = new Float32Array(N * N * 9)
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const X = ((x + 0.5) / N - 0.5) * 2 * LIGHT_CAP_DEG
          const Y = (1 - (y + 0.5) / N - 0.5) * 2 * LIGHT_CAP_DEG
          const la = (-90 + Math.hypot(X, Y)) * DEG
          const lo = Math.atan2(X, Y)
          frame.set(
            [
              -Math.sin(lo), Math.cos(lo), 0,
              -Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la),
              Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la),
            ],
            (y * N + x) * 9,
          )
        }
      }
      resolve({ hz, frame })
    }
    img.onerror = () => {
      grid = null
      reject(new Error('light_horizons.png'))
    }
    img.src = 'moon/light_horizons.png'
  })
  return grid
}

const pause = () => new Promise<void>((r) => window.setTimeout(r, 0))

// Dark to bright: night blue, violet, red, orange, pale yellow.
const RAMP: [number, number, number, number][] = [
  [0, 18, 16, 60],
  [0.25, 92, 30, 122],
  [0.5, 196, 52, 96],
  [0.75, 245, 142, 36],
  [1, 255, 244, 170],
]
export function lightColor(f: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, f))
  let i = 1
  while (i < RAMP.length - 1 && x > RAMP[i][0]) i++
  const a = RAMP[i - 1]
  const b = RAMP[i]
  const k = (x - a[0]) / (b[0] - a[0])
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k]
}
export const LIGHT_GRADIENT = `linear-gradient(90deg, ${RAMP.map(([p, r, g, b]) => `rgb(${r} ${g} ${b}) ${p * 100}%`).join(', ')})`

export type LightMap = {
  /** Share of the stay in sunlight, 0..1, N x N, row 0 at the top (toward longitude 0). */
  share: Float32Array
  n: number
  /** The same as a picture in the colours of the legend, transparent outside the cap. */
  canvas: HTMLCanvasElement
  /** Sunlit samples of every point up to each sample of the stay (count x N x N), to show the map
   *  filling up as the stay goes by. */
  cum: Uint8Array
  count: number
  hours: number
}

function paint(sum: Uint8Array, count: number): { share: Float32Array; canvas: HTMLCanvasElement } | null {
  const share = new Float32Array(N * N)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = N
  const g = canvas.getContext('2d')
  if (!g) return null
  const im = g.createImageData(N, N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const p = y * N + x
      share[p] = sum[p] / count
      const [r, gg, b] = lightColor(share[p])
      // Fades out over the last degrees, so the map melts into the ground with no rim.
      const colat = Math.hypot(((x + 0.5) / N - 0.5) * 2, ((y + 0.5) / N - 0.5) * 2) * LIGHT_CAP_DEG
      const a = Math.min(1, Math.max(0, (LIGHT_CAP_DEG - colat) / 2.5))
      im.data.set([r, gg, b, 255 * a * a * (3 - 2 * a)], p * 4)
    }
  }
  g.putImageData(im, 0, 0)
  return { share, canvas }
}

/** The map as it stands `hour` hours after landing: sunlight received so far, as a share of the whole stay. */
export function lightUpTo(m: LightMap, hour: number): LightMap {
  const s = Math.min(m.count - 1, Math.max(0, Math.round((hour / m.hours) * (m.count - 1))))
  const p = paint(m.cum.subarray(s * N * N, (s + 1) * N * N), m.count)
  return p ? { ...m, ...p } : m
}

/** Sunlit share of the stay for every point of the grid. `alive` lets a newer request cancel it. */
export async function lightMap(from: Date, days: number, alive: () => boolean = () => true): Promise<LightMap | null> {
  const { hz, frame } = await loadGrid()
  const hours = Math.max(1, Math.round(days * 24))
  const count = Math.min(MAX_SAMPLES, hours + 1)
  const sum = new Uint8Array(N * N) // at most 240 samples
  const cum = new Uint8Array(count * N * N)
  for (let s = 0; s < count; s++) {
    if (s % 12 === 0) {
      await pause() // keep the page moving
      if (!alive()) return null
    }
    const t = new Date(from.getTime() + ((count > 1 ? s / (count - 1) : 0) * hours * 3600000))
    const sub = subsolarAt(t)
    const sla = sub.lat * DEG
    const slo = sub.lon * DEG
    const vx = Math.cos(sla) * Math.cos(slo)
    const vy = Math.cos(sla) * Math.sin(slo)
    const vz = Math.sin(sla)
    for (let p = 0, f = 0; p < N * N; p++, f += 9) {
      const ve = vx * frame[f] + vy * frame[f + 1]
      const vn = vx * frame[f + 3] + vy * frame[f + 4] + vz * frame[f + 5]
      const vu = vx * frame[f + 6] + vy * frame[f + 7] + vz * frame[f + 8]
      const el = Math.atan2(vu, Math.hypot(ve, vn)) / DEG
      if (el < MIN - SUN_RADIUS_DEG) continue
      const a = ((Math.atan2(ve, vn) / DEG + 360) % 360) / (360 / AZ_N)
      const a0 = Math.floor(a) % AZ_N
      const a1 = (a0 + 1) % AZ_N
      const k = a - Math.floor(a)
      const hor = ((hz[a0 * N * N + p] * (1 - k) + hz[a1 * N * N + p] * k) / 255) * RANGE + MIN
      // The same rule as the site model: lit when more than half of the Sun's disc is above the terrain.
      if ((el - hor + SUN_RADIUS_DEG) / (2 * SUN_RADIUS_DEG) > 0.5) sum[p]++
    }
    cum.set(sum, s * N * N)
  }
  const p = paint(sum, count)
  return p ? { ...p, n: N, cum, count, hours } : null
}
/** Grid pixel of a place (fractional), or null outside the map. */
export function lightPixel(lat: number, lon: number): { x: number; y: number } | null {
  const colat = lat + 90
  if (colat > LIGHT_CAP_DEG) return null
  const r = colat / LIGHT_CAP_DEG / 2
  return { x: (0.5 + r * Math.sin(lon * DEG)) * N, y: (1 - (0.5 + r * Math.cos(lon * DEG))) * N }
}
