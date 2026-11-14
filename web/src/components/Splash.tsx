import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { loadPlotly } from './Plot'
import { LogoMark } from './Logo'
import { onDataProgress, type DataPart } from '../data/model'

const RIDGE =
  'M0,92 L40,86 L72,90 L110,72 L150,78 L190,62 L232,70 L280,54 L322,66 L362,60 L402,74 L452,68 L500,82 L542,76 L590,58 L632,64 L680,50 L722,62 L770,72 L820,66 L862,80 L910,74 L960,86 L1000,82'

type Service = DataPart | 'moon' | 'charts'
type State = { state: 'pending' | 'done' | 'failed'; detail?: Record<string, number> }
const ORDER: Service[] = ['ephem', 'sites', 'horizons', 'madrid', 'moon', 'charts']
const FIRST_MS = 1100 // name and Moon first
const STEP_MS = 850 // each service stays long enough to be read
const END_MS = 1000 // a beat on "ready" before the tool appears
const CAP_MS = 16000 // never hold anyone longer, whatever happens
const LEAVE_MS = 550

// `nosplash` in the link opens the tool directly (shared links, demos, tests).
export const SKIP = /(^|[#&])nosplash/.test(window.location.hash)

// Opening screen over the live 3D Moon. It shows the real services the tool starts, one by one,
// with what each brought (hours of ephemerides, sites, horizons...), while the Sun crosses a lunar
// horizon as the progress bar and Earth rises once the ephemerides are in. Any click, tap or key
// skips it. `showMoon` draws a still SVG Moon when WebGL is not available.
export function Splash({ onDone, showMoon, moon }: { onDone: () => void; showMoon: boolean; moon: 'pending' | 'done' | 'failed' }) {
  const t = useT()
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>(() => (SKIP ? 'gone' : 'show'))
  const [status, setStatus] = useState<Record<Service, State>>(() => Object.fromEntries(ORDER.map((s) => [s, { state: 'pending' }])) as Record<Service, State>)
  const [shown, setShown] = useState(0)
  const lastReveal = useRef(0)
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const mark = (s: Service, st: State) => setStatus((prev) => (prev[s].state === 'pending' ? { ...prev, [s]: st } : prev))

  // Real events: data files, chart engine, Moon imagery.
  useEffect(() => {
    if (phase === 'gone') return
    const off = onDataProgress((part, detail) => mark(part, { state: 'done', detail }))
    loadPlotly()
      .then(() => mark('charts', { state: 'done' }))
      .catch(() => mark('charts', { state: 'failed' }))
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (moon !== 'pending') mark('moon', { state: moon === 'done' ? 'done' : 'failed' })
  }, [moon])

  // Reveal the services one at a time, never faster than they can be read.
  useEffect(() => {
    if (phase !== 'show') return
    const t0 = performance.now()
    lastReveal.current = t0
    const tick = window.setInterval(() => {
      const now = performance.now()
      setShown((n) => {
        if (n === 0) {
          if (now - t0 < (reduce ? 200 : FIRST_MS)) return n
          lastReveal.current = now
          return 1
        }
        if (n >= ORDER.length) return n
        if (now - lastReveal.current < (reduce ? 150 : STEP_MS)) return n
        const prev = status[ORDER[n - 1]]
        if (prev.state === 'pending' && now - t0 < CAP_MS - 2000) return n
        lastReveal.current = now
        return n + 1
      })
      if (now - t0 > CAP_MS) setPhase('leave')
    }, 120)
    const skip = () => setPhase('leave')
    window.addEventListener('keydown', skip, { once: true })
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('keydown', skip)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, status, reduce])

  const settled = ORDER.slice(0, shown).filter((s) => status[s].state !== 'pending').length
  const allDone = shown === ORDER.length && settled === ORDER.length
  const progress = settled / ORDER.length

  useEffect(() => {
    if (!allDone || phase !== 'show') return
    const id = window.setTimeout(() => setPhase('leave'), reduce ? 200 : END_MS)
    return () => window.clearTimeout(id)
  }, [allDone, phase, reduce])

  // The camera starts closing in on the south pole as the splash fades.
  useEffect(() => {
    if (phase === 'leave') onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])
  useEffect(() => {
    if (phase !== 'leave') return
    const id = window.setTimeout(() => setPhase('gone'), LEAVE_MS)
    return () => window.clearTimeout(id)
  }, [phase])

  // Stars keep clear of the middle band, where the name and the progress sit.
  const stars = useMemo(() => {
    let seed = 29
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const out: { x: number; y: number; r: number; twinkle: boolean; delay: number; o: number }[] = []
    while (out.length < 80) {
      const x = rnd() * 100
      const y = rnd() * 64
      const r = 0.4 + rnd() * 0.9
      const twinkle = rnd() < 0.2
      const delay = rnd() * 3
      const o = 0.2 + rnd() * 0.5
      if (x > 15 && x < 85 && y > 15 && y < 70) continue
      out.push({ x, y, r, twinkle, delay, o })
    }
    return out
  }, [])

  if (phase === 'gone') return null

  const detail = (s: Service) => {
    const st = status[s]
    if (st.state === 'failed') return s === 'moon' ? t.svcMoonStill : t.svcFailed
    if (st.state === 'pending') return t.svcWait
    const d = st.detail ?? {}
    switch (s) {
      case 'ephem':
        return t.svcEphem(d.hours)
      case 'sites':
        return t.svcSites(d.sites, d.regions)
      case 'horizons':
        return t.svcHorizons(d.sites)
      case 'madrid':
        return t.svcMadrid(d.hours)
      case 'moon':
        return t.svcMoon
      default:
        return t.svcCharts
    }
  }
  const sec = reduce ? '0s' : '0.9s'
  const earthUp = status.ephem.state === 'done' && shown >= 1

  return (
    <div
      role="status"
      aria-label={t.splashLabel}
      onClick={() => setPhase('leave')}
      className={`fixed inset-0 z-[60] cursor-pointer overflow-hidden text-white ${showMoon ? 'bg-black' : 'bg-transparent'} ${phase === 'leave' ? 'sp-leave' : ''}`}
    >
      {showMoon && (
        <>
          <svg className="sp-stars absolute inset-0 h-full w-full" aria-hidden="true">
            {stars.map((s, i) => (
              <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#fff" className={s.twinkle ? 'sp-twinkle' : ''} style={s.twinkle ? { animationDelay: `${s.delay}s` } : { opacity: s.o }} />
            ))}
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-[radial-gradient(120%_100%_at_30%_100%,#2a2c30_0%,#0b0c0e_45%,#000_70%)]" aria-hidden="true" />
        </>
      )}

      <div className="sp-meta absolute inset-x-0 top-6 flex justify-center px-6 text-xs text-white/65 sm:top-12 sm:justify-between sm:px-20 sm:text-[13px]">
        <span>{t.madeFor}</span>
        <span className="hidden sm:inline">{t.southPole2}</span>
      </div>

      <div className="absolute inset-x-0 top-[13vh] flex flex-col items-center gap-4 px-6 text-center">
        <LogoMark size={52} className="sp-sub mb-2 text-white" />
        <h1 className="sp-sheen wordmark text-[clamp(28px,5vw,64px)] leading-none" style={{ paddingLeft: '0.28em', letterSpacing: '0.28em' }}>
          LUNAR LANDING
        </h1>
        <p className="sp-sub max-w-xl text-balance text-base font-light text-white/80 sm:text-lg">{t.splashTagline}</p>
      </div>

      <div className="sp-ui absolute left-1/2 top-[40vh] w-[min(760px,calc(100%-48px))] -translate-x-1/2">
        {/* Instrument-style progress: a lunar horizon lit from the left as the Sun crosses it. */}
        <div className="relative h-[clamp(52px,7vh,80px)]">
          <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <defs>
              <clipPath id="sp-litclip">
                <rect x="0" y="0" height="120" style={{ width: `${progress * 1000}px`, transition: `width ${sec} cubic-bezier(.45,0,.25,1)` }} />
              </clipPath>
            </defs>
            <path className="sp-ridge" d={RIDGE} fill="none" stroke="#3a3f46" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <path d={RIDGE} clipPath="url(#sp-litclip)" fill="none" stroke="#fff" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            className="absolute left-[16%] size-[11px] -translate-x-1/2 rounded-full border-[1.5px] border-earth"
            style={{ top: earthUp ? '30%' : '64%', opacity: earthUp ? 1 : 0, transition: `top ${sec} cubic-bezier(.16,1,.3,1), opacity ${sec}` }}
            aria-hidden="true"
          />
          <span
            className="absolute top-0 bottom-0 w-px -translate-x-1/2 bg-gradient-to-b from-sun/70 to-sun/0"
            style={{ left: `${progress * 100}%`, opacity: shown ? 1 : 0, transition: `left ${sec} cubic-bezier(.45,0,.25,1), opacity 0.4s` }}
            aria-hidden="true"
          >
            <span className="absolute left-1/2 top-[14%] size-[9px] -translate-x-1/2 rounded-full bg-sun shadow-[0_0_0_3px_rgba(242,183,5,0.18)]" />
          </span>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-white/15 pt-3 text-sm">
          <span>{allDone ? t.splashReady : t.splashStarting}</span>
          <span className="wordmark tabular-nums text-white/70" style={{ letterSpacing: 0, fontStretch: '112%' }}>
            {Math.round(progress * 100)} %
          </span>
        </div>

        {/* The services, as they come up. */}
        <ol className="mt-4 space-y-2 text-[13px]" aria-live="polite">
          {ORDER.slice(0, shown).map((s) => {
            const st = status[s].state
            return (
              <li key={s} className="toast-in flex items-center gap-3">
                <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                  {st === 'pending' && <span className="size-3 animate-spin rounded-full border-[1.5px] border-white/25 border-t-sun" />}
                  {st === 'done' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3fcf8e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                  {st === 'failed' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f2a93b" strokeWidth="3" strokeLinecap="round">
                      <path d="M12 6v8M12 18v.5" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-white">{t.svc[s]}</span>
                <span className={`shrink-0 tabular-nums ${st === 'failed' ? 'text-warn' : 'text-white/55'}`}>{detail(s)}</span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="sp-meta absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 px-6 text-xs text-white/80 [text-shadow:0_1px_10px_#000,0_0_2px_#000] sm:bottom-12 sm:flex-row sm:justify-between sm:px-20">
        <span className="text-center">{t.splashData}</span>
        <span>{t.splashSkip}</span>
      </div>
    </div>
  )
}
