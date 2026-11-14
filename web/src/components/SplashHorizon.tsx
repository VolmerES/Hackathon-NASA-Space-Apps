import { useEffect, useRef, useState } from 'react'

// Progress gauge of the opening screen: the real horizon of Mons Mouton 07, one of the team's five
// sites, all the way round (north, east, south, west, north). Elevation in degrees every 2° of
// azimuth, a 5-point mean of horizons.json (LRO LOLA, 80 m merged with 5 m). As the tool loads, the
// Sun grazes the ridge from left to right and its light spreads along the rim; Earth rises once the
// ephemerides are in. Vertical scale exaggerated so the relief reads.
const PROFILE = [1.38,1.49,1.51,1.45,1.59,1.81,2.02,2.31,2.73,3.08,3.32,3.56,3.88,4.19,4.45,4.62,4.82,5.09,5.31,5.54,5.69,5.82,5.97,6.17,6.38,6.61,6.78,6.89,6.93,6.9,6.81,6.64,6.35,6.01,5.69,5.5,5.39,5.27,5.18,5.2,5.24,5.22,5.2,5.63,6.01,6.22,6.26,6.19,6.09,5.91,5.69,5.43,5.15,4.93,4.81,4.66,4.37,4.01,3.59,3.1,2.64,2.17,1.66,1.18,0.8,0.72,0.76,0.76,0.86,0.89,0.88,0.89,0.92,0.92,0.91,0.86,0.79,0.79,0.84,1.13,1.5,1.9,2.25,2.55,2.77,2.96,3.09,3.2,3.4,3.7,3.97,4.26,4.48,4.63,4.72,4.79,4.91,5.16,5.43,5.66,5.93,6.26,6.59,6.88,7.13,7.36,7.6,7.81,8.0,8.18,8.33,8.44,8.51,8.53,8.53,8.44,8.31,8.16,7.99,7.8,7.58,7.35,7.07,6.82,6.55,6.31,6.09,5.83,5.51,5.27,5.14,5.02,4.82,4.63,4.39,4.13,3.88,3.59,3.28,2.93,2.56,2.2,1.82,1.5,1.22,0.98,0.77,0.47,0.14,-0.13,-0.41,-0.67,-0.9,-0.98,-1.02,-1.1,-1.22,-1.33,-1.43,-1.53,-1.62,-1.72,-1.82,-1.86,-1.84,-1.78,-1.56,-1.28,-0.99,-0.74,-0.51,-0.25,-0.02,0.18,0.35,0.56,0.81,1.03,1.14,1.22,1.38]

const W = 1000
const H = 150
const K = 9 // px per degree of elevation
const yOf = (e: number) => 118 - (e + 2) * K
const step = W / (PROFILE.length - 1)
const RIDGE = 'M' + PROFILE.map((e, i) => `${(i * step).toFixed(1)},${yOf(e).toFixed(1)}`).join(' L')
const GROUND = `${RIDGE} L${W},${H} L0,${H} Z`
const ridgeY = (x: number) => {
  const f = Math.min(PROFILE.length - 1.001, Math.max(0, x / step))
  const i = Math.floor(f)
  return yOf(PROFILE[i] + (PROFILE[i + 1] - PROFILE[i]) * (f - i))
}
// Earth, low in the south-east sky seen from the site.
const EARTH_X = 0.36 * W
const TICKS = Array.from({ length: 37 }, (_, i) => i * 10)

export function SplashHorizon({ progress, earthUp, reduce }: { progress: number; earthUp: boolean; reduce: boolean }) {
  // The Sun glides to each new value instead of jumping, so it can follow the ridge.
  const [p, setP] = useState(0)
  const target = useRef(progress)
  useEffect(() => {
    target.current = progress
    if (reduce) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      let done = false
      setP((v) => {
        const nv = v + (target.current - v) * (1 - Math.exp(-dt * 3.2))
        done = Math.abs(target.current - nv) < 0.0005
        return done ? target.current : nv
      })
      if (!done) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [progress, reduce])

  const at = reduce ? progress : p
  const x = at * W
  const sunY = ridgeY(x) - 15 - 5 * Math.sin(Math.PI * at)
  const lit = at > 0.002
  const earthY = ridgeY(EARTH_X) - (earthUp ? 30 : -14)

  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="block h-auto w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="hz-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1e24" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hz-lit" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={Math.max(1, x)} y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.8" stopColor="#fff" />
          <stop offset="1" stopColor="#ffd75a" />
        </linearGradient>
        <radialGradient id="hz-sky" gradientUnits="userSpaceOnUse" cx={x} cy={sunY} r="190">
          <stop offset="0" stopColor="#f2b705" stopOpacity="0.22" />
          <stop offset="0.35" stopColor="#f2b705" stopOpacity="0.07" />
          <stop offset="1" stopColor="#f2b705" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hz-terrain" gradientUnits="userSpaceOnUse" cx={x} cy={ridgeY(x)} r="150">
          <stop offset="0" stopColor="#ffe3a0" stopOpacity="0.16" />
          <stop offset="0.45" stopColor="#ffe3a0" stopOpacity="0.05" />
          <stop offset="1" stopColor="#ffe3a0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hz-sun">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.3" stopColor="#fff3cf" />
          <stop offset="0.55" stopColor="#f2b705" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f2b705" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hz-earth" cx="0.62" cy="0.38" r="0.75">
          <stop offset="0" stopColor="#9cc8ff" />
          <stop offset="0.55" stopColor="#3f7fd6" />
          <stop offset="1" stopColor="#0c2347" />
        </radialGradient>
        <clipPath id="hz-litclip">
          <rect x="0" y="0" width={x} height={H} />
        </clipPath>
        <clipPath id="hz-groundclip">
          <path d={GROUND} />
        </clipPath>
      </defs>

      <g opacity={lit ? 1 : 0} style={{ transition: 'opacity 0.6s' }}>
        <rect x="0" y="-200" width={W} height={H + 200} fill="url(#hz-sky)" />
        <circle cx={x} cy={sunY} r="17" fill="url(#hz-sun)" />
        <circle cx={x} cy={sunY} r="4.2" fill="#fffaf0" />
      </g>

      <g style={{ transform: `translateY(${earthY}px)`, opacity: earthUp ? 1 : 0, transition: reduce ? 'none' : 'transform 1.4s cubic-bezier(.16,1,.3,1), opacity 0.8s' }}>
        <circle cx={EARTH_X} cy="0" r="9" fill="none" stroke="#4f97ea" strokeOpacity="0.25" strokeWidth="1" />
        <circle cx={EARTH_X} cy="0" r="5.2" fill="url(#hz-earth)" />
      </g>

      <path d={GROUND} fill="#000" />
      <path d={GROUND} fill="url(#hz-ground)" />
      <g clipPath="url(#hz-groundclip)" opacity={lit ? 1 : 0}>
        <rect x="0" y="0" width={W} height={H} fill="url(#hz-terrain)" />
      </g>
      <path d={RIDGE} fill="none" stroke="#3a3f46" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <path d={RIDGE} clipPath="url(#hz-litclip)" fill="none" stroke="url(#hz-lit)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />

      {/* Azimuth scale, every 10°, longer every 90°. */}
      <g stroke="#fff" vectorEffect="non-scaling-stroke">
        {TICKS.map((a) => (
          <line key={a} x1={(a / 360) * W} x2={(a / 360) * W} y1={H + 2} y2={H + (a % 90 === 0 ? 12 : a % 30 === 0 ? 8 : 5)} strokeOpacity={a % 90 === 0 ? 0.45 : 0.2} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  )
}
