import { useEffect, useRef } from 'react'
import type { Site } from '../data/model'
import { LIGHT_CAP_DEG, lightColor, type LightMap } from '../data/lightmap'
import { useT } from '../i18n'

// The ground around a site, in its card: on the left the sunlight heat map of the stay, on the
// right the bare relief (LOLA), with the site in the middle. Indicative, like the map on the Moon.
const CAP_DEG = 25 // what polar_height.png covers (scripts/moon_polar_cap.py)
const WIDTH_DEG = 4
const KM_PER_DEG = 30.3
const W = 200
const H = 100

let heights: Promise<{ data: Uint8ClampedArray; n: number }> | null = null
function loadHeights() {
  heights ??= new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = img.width
      const g = c.getContext('2d', { willReadFrequently: true })
      if (!g) return reject(new Error('canvas'))
      g.drawImage(img, 0, 0)
      resolve({ data: g.getImageData(0, 0, img.width, img.width).data, n: img.width })
    }
    img.onerror = () => {
      heights = null
      reject(new Error('polar_height.png'))
    }
    img.src = 'moon/polar_height.png'
  })
  return heights
}

const bilinear = (get: (x: number, y: number) => number, n: number, x: number, y: number) => {
  const fx = Math.min(n - 1.001, Math.max(0, x - 0.5))
  const fy = Math.min(n - 1.001, Math.max(0, y - 0.5))
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  return (get(x0, y0) * (1 - tx) + get(x0 + 1, y0) * tx) * (1 - ty) + (get(x0, y0 + 1) * (1 - tx) + get(x0 + 1, y0 + 1) * tx) * ty
}

export function SiteLight({ site, light, busy, onTurnOn }: { site: Site; light: LightMap | null; busy: boolean; onTurnOn: () => void }) {
  const t = useT()
  const ref = useRef<HTMLCanvasElement>(null)
  const inMap = site.lat + 90 <= LIGHT_CAP_DEG - WIDTH_DEG / 2

  useEffect(() => {
    if (!light || !inMap) return
    let alive = true
    loadHeights()
      .then((hs) => {
        const cv = ref.current
        const g = cv?.getContext('2d')
        if (!alive || !cv || !g) return
        const DEG = Math.PI / 180
        const r = (site.lat + 90) / CAP_DEG / 2
        const cu = 0.5 + r * Math.sin(site.lon * DEG)
        const cvv = 0.5 + r * Math.cos(site.lon * DEG)
        const spanU = WIDTH_DEG / (2 * CAP_DEG)
        const spanV = spanU * (H / W)
        const hAt = (x: number, y: number) => hs.data[(y * hs.n + x) * 4]
        const lAt = (x: number, y: number) => light.share[y * light.n + x]
        const relief = new Float32Array(W * H)
        const uv = (i: number, j: number) => [cu + ((i + 0.5) / W - 0.5) * spanU, cvv - ((j + 0.5) / H - 0.5) * spanV]
        for (let j = 0; j < H; j++)
          for (let i = 0; i < W; i++) {
            const [u, v] = uv(i, j)
            relief[j * W + i] = bilinear(hAt, hs.n, u * hs.n, (1 - v) * hs.n)
          }
        const im = g.createImageData(W, H)
        const k = CAP_DEG / LIGHT_CAP_DEG
        for (let j = 0; j < H; j++)
          for (let i = 0; i < W; i++) {
            const p = j * W + i
            // Shaded relief, lit from the upper left.
            const dx = relief[j * W + Math.min(W - 1, i + 1)] - relief[j * W + Math.max(0, i - 1)]
            const dy = relief[Math.min(H - 1, j + 1) * W + i] - relief[Math.max(0, j - 1) * W + i]
            const shade = Math.min(1, Math.max(0.08, 0.5 - (dx + dy) * 0.11))
            let rgb: [number, number, number] = [shade * 215, shade * 210, shade * 200]
            if (i < W / 2) {
              const [u, v] = uv(i, j)
              const share = bilinear(lAt, light.n, (0.5 + (u - 0.5) * k) * light.n, (1 - (0.5 + (v - 0.5) * k)) * light.n)
              const c = lightColor(share)
              const mix = 0.45 + 0.55 * shade // the relief still shows through the colour
              rgb = [c[0] * mix, c[1] * mix, c[2] * mix]
            }
            im.data.set([rgb[0], rgb[1], rgb[2], 255], p * 4)
          }
        g.putImageData(im, 0, 0)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [light, site.id, site.lat, site.lon, inMap])

  if (!inMap) return null
  if (!light)
    return (
      <button onClick={onTurnOn} disabled={busy} className="mt-3 flex min-h-11 w-full items-center gap-2.5 rounded-sm border border-white/20 bg-black/30 px-3 text-left text-sm hover:bg-white/10 disabled:opacity-60">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </svg>
        <span>
          <span className="block font-semibold">{t.lightLayer}{busy ? '…' : ''}</span>
          <span className="block text-xs text-muted">{t.lightAroundOff}</span>
        </span>
      </button>
    )
  return (
    <figure className="ui-in mt-3 border border-white/10 bg-black/30">
      <div className="relative">
        <canvas ref={ref} width={W} height={H} className="block aspect-[2/1] w-full" role="img" aria-label={t.lightAround(Math.round(WIDTH_DEG * KM_PER_DEG))} />
        <span className="absolute inset-y-0 left-1/2 w-px bg-white/80" aria-hidden="true" />
        <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sun shadow-[0_0_0_1px_rgb(0_0_0/0.6)]" aria-hidden="true" />
      </div>
      <figcaption className="px-2.5 py-1.5 text-[11px] leading-snug text-muted">
        {t.lightAround(Math.round(WIDTH_DEG * KM_PER_DEG))}. {t.lightNote}
      </figcaption>
    </figure>
  )
}
