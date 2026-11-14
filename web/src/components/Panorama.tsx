import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { horizonAt, type Sample, type Site } from '../data/model'
import { useT } from '../i18n'

// 360-degree horizon panorama of a site, drawn by hand (SVG):
//  - the real terrain silhouette (ray-traced on LRO LOLA), filled like regolith;
//  - the paths of the Sun and Earth over the stay (JPL Horizons), glowing where they are in view
//    and dotted where the terrain hides them;
//  - the Sun and Earth themselves at the chosen moment (Earth with its phase).
// The vertical scale is exaggerated on purpose: at the pole everything happens within a few degrees.

const PAD = { l: 40, r: 10, t: 10, b: 24 }

type Pt = { x: number; y: number; on: boolean }

/** Splits a path into drawable runs: a new run where it wraps round north or changes visibility. */
function runs(pts: Pt[]) {
  const out: { on: boolean; pts: Pt[] }[] = []
  let cur: { on: boolean; pts: Pt[] } | null = null
  let prev: Pt | null = null
  for (const p of pts) {
    const wrap = prev && Math.abs(p.x - prev.x) > 0.5
    if (!cur || wrap || p.on !== cur.on) {
      if (cur && !wrap && prev) cur.pts.push(p) // join the two runs at the change of visibility
      cur = { on: p.on, pts: [] }
      out.push(cur)
    }
    cur.pts.push(p)
    prev = p
  }
  return out
}

export function Panorama({ site, samples, cursor, height = 300 }: { site: Site; samples: Sample[]; cursor?: Sample; height?: number }) {
  const t = useT()
  const uid = useId().replace(/[:]/g, '')
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null) // azimuth under the pointer

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.max(280, el.clientWidth)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const W = width
  const H = height
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b

  const g = useMemo(() => {
    const lo = Math.floor(Math.min(-1, ...site.horizon, ...samples.map((s) => Math.min(s.sunEl, s.earthEl))) - 0.5)
    const hi = Math.ceil(Math.max(4, ...site.horizon, ...samples.map((s) => Math.max(s.sunEl, s.earthEl))) + 0.5)
    const x = (az: number) => PAD.l + ((((az % 360) + 360) % 360) / 360) * iw
    const y = (el: number) => PAD.t + ((hi - el) / (hi - lo)) * ih
    // Terrain silhouette, closed down to the bottom of the chart.
    let ridge = ''
    for (let i = 0; i <= 720; i++) {
      const az = i / 2
      ridge += `${i ? 'L' : 'M'}${(PAD.l + (az / 360) * iw).toFixed(1)},${y(horizonAt(site, az)).toFixed(1)}`
    }
    const ground = `${ridge}L${PAD.l + iw},${PAD.t + ih}L${PAD.l},${PAD.t + ih}Z`
    const frac = (az: number) => (((az % 360) + 360) % 360) / 360
    const sun = runs(samples.map((s) => ({ x: frac(s.sunAz), y: s.sunEl, on: s.sunVisible > 0.5 })))
    const earth = runs(samples.map((s) => ({ x: frac(s.earthAz), y: s.earthEl, on: s.earthVisible })))
    const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${(PAD.l + p.x * iw).toFixed(1)},${y(p.y).toFixed(1)}`).join('')
    const ticks: number[] = []
    const step = hi - lo > 12 ? 4 : hi - lo > 6 ? 2 : 1
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
    // A few stars in the sky above the ridge (fixed per site, so they do not jump).
    let seed = Math.round(Math.abs(site.lat * 1000 + site.lon * 7)) || 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const stars = Array.from({ length: Math.round(iw / 9) }, () => {
      const az = rnd() * 360
      const top = horizonAt(site, az)
      const el = top + 0.4 + rnd() * (hi - top)
      return { x: x(az), y: y(el), r: rnd() < 0.85 ? 0.6 : 1.1, o: 0.25 + rnd() * 0.6 }
    }).filter((s) => s.y > PAD.t + 2)
    return { lo, hi, x, y, ground, ridge, sun, earth, toPath, ticks, stars }
  }, [site, samples, iw, ih])

  const now = cursor ?? samples[0]
  // Earth's phase seen from the Moon: lit fraction from the Sun-Earth angle on the sky.
  const phase = useMemo(() => {
    if (!now) return { k: 1, dx: 0, dy: 0 }
    const v = (az: number, el: number) => {
      const a = (az * Math.PI) / 180
      const e = (el * Math.PI) / 180
      return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]
    }
    const s = v(now.sunAz, now.sunEl)
    const e = v(now.earthAz, now.earthEl)
    const elong = Math.acos(Math.max(-1, Math.min(1, s[0] * e[0] + s[1] * e[1] + s[2] * e[2])))
    const k = (1 - Math.cos(elong)) / 2 // 0 new Earth (Sun behind it), 1 full Earth (Sun behind us)
    let dAz = ((now.sunAz - now.earthAz + 540) % 360) - 180
    const dEl = now.sunEl - now.earthEl
    const n = Math.hypot(dAz, dEl) || 1
    dAz /= n
    return { k, dx: dAz, dy: -dEl / n }
  }, [now])

  const hoverInfo = hover !== null ? { x: g.x(hover), el: horizonAt(site, hover) } : null
  const compass = t.compassShort

  return (
    <div ref={box} className="relative select-none" style={{ height }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${t.sunPath}, ${t.earthPath}, ${t.terrain}`}
        className="block touch-pan-y"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const fx = (e.clientX - r.left - PAD.l) / iw
          setHover(fx >= 0 && fx <= 1 ? fx * 360 : null)
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" />
            <stop offset="1" stopColor="#0d1320" />
          </linearGradient>
          <linearGradient id={`rock${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8d9097" />
            <stop offset="0.25" stopColor="#4a4d53" />
            <stop offset="1" stopColor="#17191d" />
          </linearGradient>
          {/* Regolith grain: fractal noise, faint, clipped to the ground. */}
          <filter id={`grain${uid}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 -0.2" />
          </filter>
          <filter id={`glow${uid}`} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`sun${uid}`}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.3" stopColor="#fff6d8" />
            <stop offset="0.55" stopColor="#f2b705" stopOpacity="0.55" />
            <stop offset="1" stopColor="#f2b705" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`earth${uid}`} cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#bfe0ff" />
            <stop offset="0.45" stopColor="#3d8fe0" />
            <stop offset="1" stopColor="#123c7a" />
          </radialGradient>
          <clipPath id={`ground${uid}`}>
            <path d={g.ground} />
          </clipPath>
          <clipPath id={`earthClip${uid}`}>
            <circle r="7" />
          </clipPath>
        </defs>

        {/* Sky, stars and grid. */}
        <rect x={PAD.l} y={PAD.t} width={iw} height={ih} fill={`url(#sky${uid})`} />
        {g.stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
        ))}
        {g.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={PAD.l + iw} y1={g.y(v)} y2={g.y(v)} stroke={v === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.07)'} strokeDasharray={v === 0 ? '4 4' : undefined} />
            <text x={PAD.l - 6} y={g.y(v) + 3.5} textAnchor="end" fontSize="10.5" fill="rgba(255,255,255,0.6)">
              {v}°
            </text>
          </g>
        ))}
        {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((az, i) => (
          <g key={az}>
            <line x1={g.x(az === 360 ? 359.999 : az)} x2={g.x(az === 360 ? 359.999 : az)} y1={PAD.t} y2={PAD.t + ih} stroke="rgba(255,255,255,0.06)" />
            <text x={PAD.l + (az / 360) * iw} y={H - 7} textAnchor={i === 0 ? 'start' : i === 8 ? 'end' : 'middle'} fontSize="11" fontWeight="600" fill="rgba(255,255,255,0.75)">
              {compass[i]}
            </text>
          </g>
        ))}

        {/* Paths behind the terrain first, dotted and faint. */}
        {g.sun.filter((r) => !r.on).map((r, i) => (
          <path key={`sh${i}`} d={g.toPath(r.pts)} fill="none" stroke="#f2b705" strokeOpacity="0.4" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
        ))}
        {g.earth.filter((r) => !r.on).map((r, i) => (
          <path key={`eh${i}`} d={g.toPath(r.pts)} fill="none" stroke="#4f97ea" strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
        ))}

        {/* Terrain: rock gradient, grain, and a lit rim. */}
        <path d={g.ground} fill={`url(#rock${uid})`} />
        <g clipPath={`url(#ground${uid})`} opacity="0.35">
          <rect x={PAD.l} y={PAD.t} width={iw} height={ih} filter={`url(#grain${uid})`} />
        </g>
        <path d={g.ridge} fill="none" stroke="#d8dbe0" strokeWidth="1.3" strokeLinejoin="round" />

        {/* Paths in view: glowing. */}
        <g filter={`url(#glow${uid})`}>
          {g.earth.filter((r) => r.on).map((r, i) => (
            <path key={`e${i}`} d={g.toPath(r.pts)} fill="none" stroke="#5aa8ff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {g.sun.filter((r) => r.on).map((r, i) => (
            <path key={`s${i}`} d={g.toPath(r.pts)} fill="none" stroke="#f2b705" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>

        {/* The Sun and Earth at the chosen moment. */}
        {now && (
          <>
            <g transform={`translate(${g.x(now.sunAz)},${g.y(now.sunEl)})`} opacity={now.sunVisible > 0.5 ? 1 : 0.45}>
              <circle r="17" fill={`url(#sun${uid})`} />
              <circle r="5.5" fill="#fffbea" />
            </g>
            <g transform={`translate(${g.x(now.earthAz)},${g.y(now.earthEl)})`} opacity={now.earthVisible ? 1 : 0.45}>
              <circle r="11" fill="#4f97ea" opacity="0.18" />
              <circle r="7" fill={`url(#earth${uid})`} />
              {/* Night side: a dark disc slid away from the Sun as the lit fraction grows. */}
              <g clipPath={`url(#earthClip${uid})`}>
                <circle r="7" cx={-phase.dx * 14 * phase.k} cy={-phase.dy * 14 * phase.k} fill="#020611" opacity="0.88" />
              </g>
              <circle r="7" fill="none" stroke="rgba(190,225,255,0.6)" strokeWidth="0.8" />
            </g>
          </>
        )}

        {/* Pointer guide: which way, and how high the terrain is there. */}
        {hoverInfo && (
          <g pointerEvents="none">
            <line x1={hoverInfo.x} x2={hoverInfo.x} y1={PAD.t} y2={PAD.t + ih} stroke="rgba(255,255,255,0.45)" strokeDasharray="2 3" />
            <circle cx={hoverInfo.x} cy={g.y(hoverInfo.el)} r="3" fill="#fff" />
            <g transform={`translate(${Math.min(hoverInfo.x + 8, PAD.l + iw - 118)},${PAD.t + 6})`}>
              <rect width="112" height="34" rx="2" fill="rgba(0,0,0,0.75)" stroke="rgba(255,255,255,0.2)" />
              <text x="8" y="14" fontSize="10.5" fill="#fff" fontWeight="600">
                Az {Math.round(hover ?? 0)}°
              </text>
              <text x="8" y="27" fontSize="10.5" fill="rgba(255,255,255,0.75)">
                {t.horizon} {hoverInfo.el.toFixed(1)}°
              </text>
            </g>
          </g>
        )}
        <text x={12} y={PAD.t + ih / 2} transform={`rotate(-90 12 ${PAD.t + ih / 2})`} textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,0.5)">
          {t.heightAxis}
        </text>
      </svg>
    </div>
  )
}
