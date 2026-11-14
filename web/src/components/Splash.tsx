import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { LogoMark } from './Logo'
import { SplashHorizon } from './SplashHorizon'
import { onDataProgress, type DataPart } from '../data/model'

const NAME = 'FLY ME TO THE MOON'
const LETTERS = NAME.split('').map((c) => (c === ' ' ? ' ' : c))

type Service = DataPart | 'moon'
type State = { state: 'pending' | 'done' | 'failed'; detail?: Record<string, number> }
const ORDER: Service[] = ['ephem', 'sites', 'team', 'horizons', 'madrid', 'check', 'moon']
const FIRST_MS = 1100 // name and Moon first
const STEP_MS = 620 // each service stays long enough to be read
const END_MS = 1000 // a beat on "ready" before the tool appears
const CAP_MS = 30000 // never hold anyone longer, whatever happens (a very slow line)
const LEAVE_MS = 550

// `nosplash` in the link opens the tool directly (shared links, demos, tests).
export const SKIP = /(^|[#&])nosplash/.test(window.location.hash)

// Opening screen over the live 3D Moon. It shows the real services the tool starts, one by one,
// with what each brought (hours of ephemerides, sites, horizons...), while the Sun crosses a lunar
// horizon as the progress bar and Earth rises once the ephemerides are in. Once everything is
// in, a click, tap or key skips the rest of the reveal. `showMoon` draws a still SVG Moon when WebGL is not available.
export function Splash({ onDone, showMoon, moon }: { onDone: () => void; showMoon: boolean; moon: 'pending' | 'done' | 'failed' }) {
  const t = useT()
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>(() => (SKIP ? 'gone' : 'show'))
  const [status, setStatus] = useState<Record<Service, State>>(() => Object.fromEntries(ORDER.map((s) => [s, { state: 'pending' }])) as Record<Service, State>)
  const [shown, setShown] = useState(0)
  const lastReveal = useRef(0)
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const mark = (s: Service, st: State) => setStatus((prev) => (prev[s].state === 'pending' ? { ...prev, [s]: st } : prev))

  // Real events: data files and Moon imagery.
  useEffect(() => {
    if (phase === 'gone') return
    const off = onDataProgress((part, detail) => mark(part, detail ? { state: 'done', detail } : { state: 'failed' }))
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
    // A key skips the wait for the slow reveal, never the loading: the tool only shows once
    // everything is in and the Moon is drawn.
    const skip = () => {
      if (ORDER.every((s) => status[s].state !== 'pending')) setPhase('leave')
    }
    window.addEventListener('keydown', skip)
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
        return t.svcEphem(d.hours, d.start)
      case 'sites':
        return t.svcSites(d.sites, d.regions)
      case 'team':
        return t.svcTeam(d.sites)
      case 'check':
        return t.svcCheck(d.sites, d.median)
      case 'horizons':
        return t.svcHorizons(d.sites)
      case 'madrid':
        return t.svcMadrid(d.hours)
      default:
        return t.svcMoon
    }
  }
  const earthUp = status.ephem.state === 'done' && shown >= 1

  return (
    <div
      role="status"
      aria-label={t.splashLabel}
      onClick={() => {
        if (ORDER.every((s) => status[s].state !== 'pending')) setPhase('leave')
      }}
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

      <div className="absolute inset-x-0 top-[8vh] flex flex-col items-center gap-3 px-6 text-center">
        <LogoMark size={52} animated className="mb-2 text-white" />
        {/* The name, letter by letter: each comes in from a blur while the tracking closes, then a
            glint of sunlight runs across it (a copy on top, masked to a moving band). */}
        <div className="flex w-full justify-center">
        <div className="relative shrink-0">
          <h1 aria-label={NAME} className="sp-name wordmark whitespace-nowrap text-[clamp(16px,3.6vw,52px)] leading-none">
            {LETTERS.map((ch, i) => (
              <span key={i} aria-hidden="true" className="sp-l" style={{ animationDelay: `${(0.55 + i * 0.045).toFixed(3)}s` }}>
                {ch}
              </span>
            ))}
          </h1>
          <span aria-hidden="true" className="sp-name sp-glint wordmark absolute inset-0 whitespace-nowrap text-[clamp(16px,3.6vw,52px)] leading-none">
            {LETTERS.map((ch, i) => (
              <span key={i} className="inline-block">
                {ch}
              </span>
            ))}
          </span>
        </div>
        </div>
        <p className="sp-sub max-w-xl text-balance text-base font-light text-white/80 sm:text-lg" style={{ animationDelay: '1.5s' }}>{t.splashTagline}</p>
      </div>

      <div className="sp-ui absolute left-1/2 top-[34vh] w-[min(560px,calc(100%-32px))] -translate-x-1/2 rounded-2xl bg-black/55 p-3.5 ring-1 ring-white/10 backdrop-blur-md sm:p-4">
        {/* Progress: the real horizon of one of the team's sites, with the Sun grazing its ridge. */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-white">{allDone ? t.splashReady : t.splashStarting}</p>
            <p className="mt-1 truncate text-xs text-white/50">{t.splashHorizon}</p>
          </div>
          <span className="wordmark shrink-0 text-[24px] leading-none tabular-nums text-white sm:text-[28px]" style={{ letterSpacing: 0, fontStretch: '112%' }}>
            {Math.round(progress * 100)}
            <span className="ml-1 text-base text-white/50">%</span>
          </span>
        </div>
        <div className="mt-3">
          <SplashHorizon progress={progress} earthUp={earthUp} reduce={reduce} />
          <div className="relative mt-1 h-4 text-[10px] tracking-[0.18em] text-white/45" aria-hidden="true">
            {['N', 'E', 'S', 'W', 'N'].map((c, i) => (
              <span key={i} className="absolute -translate-x-1/2" style={{ left: `${i * 25}%` }}>
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* Mission checklist: every source from the start, each one filled in as it arrives. */}
        {(() => {
          const cur = Math.max(0, Math.min(shown, ORDER.length) - 1)
          const s = ORDER[cur]
          const st = shown ? status[s].state : 'queued'
          return (
            <div className="mt-3 border-t border-white/10 pt-2.5" aria-hidden="true">
              <div className="flex gap-1">
                {ORDER.map((x, k) => (
                  <span key={x} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${k < shown && status[x].state === 'done' ? 'bg-ok' : k < shown && status[x].state === 'failed' ? 'bg-warn' : k < shown ? 'bg-sun' : 'bg-white/15'}`} />
                ))}
              </div>
              <p className="mt-2 flex items-center gap-2 text-[13px]">
                <span className="shrink-0 tabular-nums text-[11px] text-white/45">{String(cur + 1).padStart(2, '0')}/{String(ORDER.length).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate text-white/90">{t.svc[s]}</span>
                <span className={`hidden shrink-0 tabular-nums sm:inline ${st === 'failed' ? 'text-warn' : 'text-white/55'}`}>{shown ? detail(s) : t.svcQueued}</span>
              </p>
            </div>
          )
        })()}
        <ol className="sr-only" aria-live="polite">
          {ORDER.map((s, i) => {
            const on = i < shown
            const st = on ? status[s].state : 'queued'
            return (
              <li key={s} className={`flex items-center gap-3 border-b border-white/[0.07] py-1.5 transition-opacity duration-500 ${on ? 'opacity-100' : 'opacity-35'}`}>
                <span className="w-5 shrink-0 tabular-nums text-[11px] text-white/40">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                  {st === 'queued' && <span className="size-1.5 rounded-full bg-white/40" />}
                  {st === 'pending' && <span className="size-3 animate-spin rounded-full border-[1.5px] border-white/25 border-t-sun" />}
                  {st === 'done' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3fcf8e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                  {st === 'failed' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f2a93b" strokeWidth="2.6" strokeLinecap="round">
                      <path d="M12 6v8M12 18v.5" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-white/90">{t.svc[s]}</span>
                <span className={`hidden shrink-0 tabular-nums sm:inline ${st === 'failed' ? 'text-warn' : 'text-white/55'}`}>{on ? detail(s) : t.svcQueued}</span>
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
