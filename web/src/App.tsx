import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DATA, MADRID_DSN, SITES, clampToData, customSite, landingCalendar, loadData, metrics, overview, simulate, subsolarAt, subearthAt, type Metrics, type Mission, type Sample, type Site } from './data/model'
import { Panorama } from './components/Panorama'
import { SiteMap } from './components/SiteMap'
import { StayBar } from './components/StayBar'
import { YearStrip, type YearMetric } from './components/YearView'
import { readScenario, writeScenario } from './scenario'
import { LIGHT_CAP_DEG, LIGHT_GRADIENT, lightMap, lightUpTo, type LightMap } from './data/lightmap'
import { SiteLight } from './components/SiteLight'
import { LangContext, STRINGS, readLang, useT, type Lang, type Strings } from './i18n'
import { useBoxHeight, useStay } from './hooks'
import { CloseButton, FloatPanel, HamburgerMenu, Overlay, Snackbar } from './components/Ui'
import { Splash, SKIP as SKIP_SPLASH } from './components/Splash'
import { TimeBar } from './components/TimeBar'
import { Logo } from './components/Logo'
import { StayHeatmap } from './components/StayHeatmap'
import { MoonFallback } from './components/MoonFallback'

// three.js for the 3D view from the surface is loaded only when that view is opened.
// three.js lives in its own file: the page and the opening screen do not wait for it.
const MoonScene = lazy(() => import('./components/MoonScene').then((m) => ({ default: m.MoonScene })))
const Surface3D = lazy(() => import('./components/Surface3D'))

const MAX_SITES = 4
// The tool proposes the sites the team studied in depth (a choice of the team). Without that file,
// the best few of all the candidate sites for the chosen stay.
const TOP_SITES = 5
const PLAY_STEP = 2
const PLAY_MS = 90
const OVERVIEW_MONTHS = 14
const OVERVIEW_DAYS = 426

type Panel = 'sky' | 'when' | 'compare'

function csvFor(samples: Sample[], t: Strings) {
  const yn = (b: boolean) => (b ? t.yes : t.no)
  const rows = samples.map((s) => {
    const lit = s.sunVisible > 0.5
    return [s.t.toISOString().slice(0, 16) + 'Z', yn(lit), yn(s.earthVisible), yn(lit && s.earthVisible), yn(s.madridLink), s.sunAz.toFixed(2), s.sunEl.toFixed(3), s.earthAz.toFixed(2), s.earthEl.toFixed(3)].join(',')
  })
  return [t.csvHeader.join(','), ...rows].join('\n') + '\n'
}

const VERDICT_CLS = { viable: 'text-ok', marginal: 'text-warn', 'not-viable': 'text-bad' } as const
const VERDICT_BG = { viable: 'bg-ok', marginal: 'bg-warn', 'not-viable': 'bg-bad' } as const
const RANK = { viable: 0, marginal: 1, 'not-viable': 2 } as const
const VERDICT_HEX = { viable: '#3fcf8e', marginal: '#f2a93b', 'not-viable': '#ff5a6a' } as const


// Everything that turns a value into words, in the chosen language.
function formatters(t: Strings) {
  const num = (n: number, digits = 0) => n.toLocaleString(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const date = (d: Date) => d.toLocaleDateString(t.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const dateTime = (d: Date) => `${date(d)}, ${d.toISOString().slice(11, 16)} UTC`
  const duration = (h: number) => (h === 0 ? t.none : h < 48 ? t.hours(num(h)) : t.days(num(h / 24, 1)))
  const reason = (m: Metrics) => {
    const sun = m.longestNightH === 0 ? t.reasonSunAll : t.reasonDark(duration(m.longestNightH))
    const e = m.earthLinkPct
    const earth = e >= 99 ? t.reasonEarthAll : e <= 1 ? t.reasonEarthNone : t.reasonEarthPart(num(e))
    return `${sun}; ${earth}.`
  }
  const siteName = (s: Site) => (s.ideal ? t.customName(s.lat.toFixed(2), s.lon.toFixed(2)) : s.name)
  return { num, date, dateTime, duration, reason, siteName }
}

// Where our result and the published study disagree by more than 5 sunlit days, never say green.
const disagrees = (site: Site) => site.published?.['2027'] !== undefined && site.oursSunDays2027 !== undefined && Math.abs(site.oursSunDays2027 - site.published['2027']) > 5
const cautious = (site: Site, m: Metrics): Metrics => (disagrees(site) && m.verdict === 'viable' ? { ...m, verdict: 'marginal' } : m)

function resolveSite(id: string): Site | undefined {
  if (id.startsWith('custom:')) {
    const [lat, lon] = id.slice(7).split(',').map(Number)
    return Number.isFinite(lat) && Number.isFinite(lon) ? customSite(lat, lon) : undefined
  }
  return SITES.find((s) => s.id === id)
}

function VerdictIcon({ v, size = 22 }: { v: Metrics['verdict']; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
      {v === 'viable' && <path d="M7.5 12.5l3 3 6-6.5" />}
      {v === 'marginal' && <path d="M12 7v6M12 16.5v.5" />}
      {v === 'not-viable' && <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />}
    </svg>
  )
}

// While the 3D view downloads: the Sun glows over a still horizon, so the wait reads as part of the tool.
function SkyLoading({ height, label }: { height: number; label: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 bg-black text-white" style={{ height }}>
      <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="h-10 w-72 overflow-visible" aria-hidden="true">
        <path d="M0,92 L80,82 L150,70 L232,76 L320,58 L400,70 L500,82 L590,60 L680,50 L770,70 L870,74 L1000,84" fill="none" stroke="#3a3f46" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <ellipse className="sp-glow" cx="500" cy="26" rx="22" ry="18" fill="#f2b705" />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  )
}

// The sky of the chosen site in 2D: terrain silhouette with the Sun and Earth paths over it.
function SkyStrip({ name, height, onExpand, onClose, children }: { name: string; height: number; onExpand: () => void; onClose?: () => void; children: ReactNode }) {
  const t = useT()
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pt-2">
        <h2 className="mr-auto text-sm font-semibold">{t.skyFrom(name)}</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <i className="inline-block size-2 rounded-full bg-sun" /> {t.sunPath}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <i className="inline-block size-2 rounded-full bg-earth" /> {t.earthPath}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <i className="inline-block size-2 bg-regolith" /> {t.terrain}
        </span>
        <button onClick={onExpand} className="min-h-9 text-xs font-semibold text-nasa-blue underline underline-offset-4">
          {t.expandSky}
        </button>
        {onClose && (
          <CloseButton label={t.fold} onClick={onClose} kind="fold" className="-my-1" />
          
        )}
      </div>
      <p className="px-3 text-[11px] text-white/55">{t.fadedHidden}</p>
      <div style={{ height }}>{children}</div>
    </>
  )
}

function Was({ show, text }: { show: boolean; text: string }) {
  return show ? <span className="block text-xs font-normal text-muted">{text}</span> : null
}

export default function App() {
  const initial = useMemo(() => readScenario(window.location.hash), [])
  const hasLink = window.location.hash.includes('s=')
  // Sites from a shared link are kept as they are: they resolve once the data has arrived.
  const [chosen, setChosen] = useState<string[]>(hasLink ? initial.chosen : [])
  const [focus, setFocus] = useState(hasLink ? initial.focus : '')
  const [mission, setMission] = useState<Mission>(initial.mission)
  const [picking, setPicking] = useState(!hasLink)
  const [cardOpen, setCardOpen] = useState(true)
  // Street view: the 3D Moon dives onto the site, then the ground view opens full screen.
  const [diving, setDiving] = useState(false)
  const [streetOpen, setStreetOpen] = useState(false)
  const [streetRef, streetH] = useBoxHeight<HTMLDivElement>()
  const [skyOpen, setSkyOpenState] = useState(() => {
    try {
      return localStorage.getItem('ll-sky-open') === '1'
    } catch {
      return false
    }
  })
  const setSkyOpen = (v: boolean) => {
    setSkyOpenState(v)
    try {
      localStorage.setItem('ll-sky-open', v ? '1' : '0')
    } catch {
      /* private mode: just not remembered */
    }
  }
  const [customLat, setCustomLat] = useState('-88.5')
  const [customLon, setCustomLon] = useState('45')
  const [playIdx, setPlayIdx] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [view, setView] = useState<'2d' | '3d'>(() => (window.location.hash.includes('v=3d') ? '3d' : '2d'))
  const [lang, setLang] = useState<Lang>(() => readLang(window.location.hash))
  const [madrid, setMadrid] = useState(() => window.location.hash.includes('dsn=1'))
  const [yearMetric, setYearMetric] = useState<YearMetric>('both')
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(() => {
    const p = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('p')
    return p === 'sky' || p === 'when' || p === 'compare' ? p : null
  })
  const [splashDone, setSplashDone] = useState(SKIP_SPLASH)
  const [moonOk, setMoonOk] = useState(true)
  const [moonState, setMoonState] = useState<'pending' | 'done' | 'failed'>('pending')
  const [ready, setReady] = useState(DATA.ready)
  const [dataFailed, setDataFailed] = useState(false)
  useEffect(() => {
    loadData()
      .then(() => setReady(true))
      .catch(() => setDataFailed(true))
  }, [])
  const frameRef = useRef<HTMLDivElement>(null)
  const [skyRef, skyH] = useBoxHeight<HTMLDivElement>()
  const t = STRINGS[lang]
  const { num, date: fmtDate, dateTime: fmtDateTime, duration: fmtDuration, reason, siteName } = useMemo(() => formatters(t), [t])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Losing the connection never blocks the tool: say so, and keep working with what is loaded.
  useEffect(() => {
    const off = () => setToast(STRINGS[lang].offlineTitle)
    const on = () => setToast(STRINGS[lang].offlineBack)
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    if (!navigator.onLine) off()
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [lang])

  useEffect(() => {
    const extra = (lang === 'es' ? '&l=es' : '') + (view === '3d' ? '&v=3d' : '') + (madrid ? '&dsn=1' : '') + (panel ? `&p=${panel}` : '')
    if (chosen.length) window.history.replaceState(null, '', writeScenario({ chosen, focus, mission, mode: 'planner' }) + extra)
    else window.history.replaceState(null, '', lang === 'es' ? '#l=es' : window.location.pathname)
  }, [chosen, focus, mission, lang, view, madrid, panel])

  useEffect(() => {
    if (!panel) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (streetOpen) {
        setStreetOpen(false)
        setDiving(false)
      } else setPanel(null)
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [panel, streetOpen])

  // Choosing a site: it becomes the one shown, and joins the comparison list.
  const pick = useCallback((id: string) => {
    setChosen((c) => (c.includes(id) ? c : [id, ...c].slice(0, MAX_SITES)))
    setFocus(id)
    setPicking(false)
  }, [])
  const remove = (id: string) =>
    setChosen((c) => {
      const next = c.filter((x) => x !== id)
      if (focus === id) setFocus(next[0] ?? '')
      if (!next.length) setPicking(true)
      return next
    })
  const addToCompare = (id: string) => {
    if (chosen.includes(id)) return
    if (chosen.length >= MAX_SITES) {
      setToast(t.toastMaxSites(MAX_SITES))
      return
    }
    setChosen((c) => [...c, id])
  }

  const addCustom = () => {
    const lat = Number(customLat)
    const lon = Number(customLon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > -80 || lon < -180 || lon > 180) return
    pick(customSite(lat, lon).id)
  }

  const evaluate = useCallback(
    (site: Site) => {
      const samples = simulate(site, mission)
      return { site, samples, m: cautious(site, metrics(samples, mission)), base: cautious(site, metrics(simulate(site, { ...mission, slipDays: 0 }), mission)) }
    },
    [mission],
  )
  const results = useMemo(
    () => (ready ? chosen.flatMap((id) => (resolveSite(id) ? [evaluate(resolveSite(id)!)] : [])) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chosen, evaluate, ready],
  )
  const focused = results.find((r) => r.site.id === focus) ?? results[0]
  // The sites of the team, evaluated for the current dates and listed best first: verdict, then
  // more sunlight, shorter darkness, more contact with Earth.
  const catalogue = useMemo(
    () =>
      ready
        ? (SITES.some((s) => s.team) ? SITES.filter((s) => s.team) : SITES)
            .map((s) => ({ site: s, m: cautious(s, metrics(simulate(s, mission), mission)) }))
            .sort(
              (a, b) =>
                RANK[a.m.verdict] - RANK[b.m.verdict] ||
                b.m.sunlightPct - a.m.sunlightPct ||
                a.m.longestNightH - b.m.longestNightH ||
                b.m.earthLinkPct - a.m.earthLinkPct ||
                a.site.name.localeCompare(b.site.name),
            )
            .slice(0, TOP_SITES)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mission, ready],
  )
  const best = useMemo(() => (results.length > 1 ? [...results].sort((a, b) => RANK[a.m.verdict] - RANK[b.m.verdict] || b.m.opsPct - a.m.opsPct)[0] : undefined), [results])

  // The 14 months of hourly data, from the first day they cover.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overviewFrom = useMemo(() => DATA.start, [ready])
  const overviews = useMemo(
    () => (panel === 'when' ? results.map((r) => ({ site: r.site, days: overview(r.site, overviewFrom, OVERVIEW_DAYS, mission.minAntennaElevDeg) })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel, chosen, overviewFrom, mission.minAntennaElevDeg, ready],
  )
  const slipped = mission.slipDays !== 0
  // Panels, street view and the sky strip fade out before they go.
  const panelStay = useStay(focused ? panel : null)
  const shownPanel = panelStay.value
  const streetStay = useStay(streetOpen && !!focused, 520)
  const skyStay = useStay(!!focused && !picking && panel !== 'sky' && skyOpen)
  const cardStay = useStay(cardOpen)
  // The stay in hours (one sample per hour), so every percentage can also be read as hours.
  const stayH = Math.max(1, focused?.samples.length ?? 1)
  const hrs = (pct: number) => t.hoursOf(num((pct * stayH) / 100), num(stayH))
  const start = new Date(mission.landing.getTime() + mission.slipDays * 86400000)
  // Sunlight heat map over the pole, for the stay on screen. Computed when the layer is turned on.
  const [lightOn, setLightOn] = useState(false)
  const [light, setLight] = useState<LightMap | null>(null)
  const [lightBusy, setLightBusy] = useState(false)
  useEffect(() => {
    if (!lightOn || !ready) return
    let alive = true
    setLightBusy(true)
    lightMap(start, mission.durationDays, () => alive)
      .then((m) => {
        if (alive && m) setLight(m)
      })
      .catch(() => {
        if (!alive) return
        setLightOn(false)
        setToast(t.lightFailed)
      })
      .finally(() => alive && setLightBusy(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightOn, ready, start.getTime(), mission.durationDays])
  // The map fills up with the hour of the time bar: light received from landing until then. With
  // no hour chosen (the bar at its start), the whole stay.
  const [lightHour, setLightHour] = useState(0)
  const lightShown = useMemo(() => (light && lightHour > 0 ? lightUpTo(light, lightHour) : light), [light, lightHour])
  const heat = useMemo(() => (lightOn && lightShown ? { canvas: lightShown.canvas, deg: LIGHT_CAP_DEG } : null), [lightOn, lightShown])
  const end = new Date(start.getTime() + mission.durationDays * 86400000)

  const landOn = (d: Date) => {
    const l = mission.landing
    const landing = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), l.getUTCHours(), l.getUTCMinutes()))
    setMission((m) => ({ ...m, slipDays: 0, landing }))
    setToast(t.toastLanded(fmtDateTime(landing)))
  }
  const downloadCsv = () => {
    if (!focused) return
    const url = URL.createObjectURL(new Blob([csvFor(focused.samples, t)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${focused.site.id}-${start.toISOString().slice(0, 10)}-${mission.durationDays}d.csv`
    a.click()
    URL.revokeObjectURL(url)
    setToast(t.toastCsv)
  }

  useEffect(() => {
    setPlaying(false)
    setPlayIdx(null)
    setFreeHour(0)
  }, [focus, mission])
  useEffect(() => {
    if (!playing || !focused) return
    const last = focused.samples.length - 1
    const id = window.setInterval(() => {
      setPlayIdx((i) => {
        const next = (i ?? 0) + PLAY_STEP
        if (next >= last) {
          setPlaying(false)
          return last
        }
        return next
      })
    }, PLAY_MS)
    return () => window.clearInterval(id)
  }, [playing, focused])
  const cursor = focused && playIdx !== null ? focused.samples[Math.min(playIdx, focused.samples.length - 1)] : undefined
  // The hour the Moon is lit for: the one being played or scrubbed (time bar, sky chart), else the
  // start of the stay. With no site chosen yet the time bar keeps its own hour.
  const [freeHour, setFreeHour] = useState(0)
  const litAt = cursor?.t ?? (focused ? start : new Date(start.getTime() + freeHour * 3600000))
  const hourNow = focused ? (playIdx ?? 0) : freeHour
  useEffect(() => setLightHour(hourNow), [hourNow])
  // The date field of the time bar sets the start of the stay; a slip already set is kept.
  const setStart = (d: Date) => set('landing', new Date(clampToData(d.getTime()) - mission.slipDays * 86400000))
  // Landing calendar of the chosen site for the stay that is set; never green where our result and the
  // published study disagree (same caution as the verdicts).
  const plan = useMemo(() => {
    if (!ready || !focused) return undefined
    const p = landingCalendar(focused.site, mission.durationDays, mission.minAntennaElevDeg)
    return disagrees(focused.site) ? p.map((d) => ({ ...d, hours: d.hours.map((v) => (v === 'viable' ? 'marginal' : v)) })) : p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focused?.site.id, mission.durationDays, mission.minAntennaElevDeg])
  const scrub = (i: number) => {
    setPlaying(false)
    if (focused) setPlayIdx(i)
    else setFreeHour(i)
  }
  const sunAt = useMemo(() => (ready ? subsolarAt(litAt) : undefined), [ready, litAt.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  const earthAt = useMemo(() => {
    if (!ready) return undefined
    const e = subearthAt(litAt)
    return { ...e, t: litAt.getTime(), label: t.earthFar((Math.round(e.km / 100) * 100).toLocaleString(t.locale)) }
  }, [ready, litAt.getTime(), t]) // eslint-disable-line react-hooks/exhaustive-deps
  const togglePlay = () => {
    if (!focused) return
    if (!playing && (playIdx === null || playIdx >= focused.samples.length - 1)) setPlayIdx(0)
    setPlaying((p) => !p)
  }

  const openStreet = () => {
    setPanel(null)
    setDiving(true)
    const instant = !moonOk || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // The view starts fading in while the camera is still closing in on the site.
    window.setTimeout(() => setStreetOpen(true), instant ? 0 : 1300)
  }
  const closeStreet = () => {
    setStreetOpen(false)
    setDiving(false)
    setLanding(0)
  }
  // Landing simulation: the dive from orbit, then the lander comes down in the street view.
  const [landing, setLanding] = useState(0)
  const simulateLanding = () => {
    setLanding(Date.now())
    openStreet()
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setToast(t.linkCopied)
    } catch {
      /* clipboard unavailable: the address bar already holds the link */
    }
  }

  const set = <K extends keyof Mission>(k: K, v: Mission[K]) => setMission((m) => ({ ...m, [k]: v }))
  const field = 'min-h-11 w-full rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-ink'
  const ghost = 'min-h-11 rounded-sm border border-white/25 px-4 hover:bg-white/10'
  const seg = (on: boolean) => `min-h-11 px-3 text-sm ${on ? 'bg-ink font-semibold text-paper' : 'hover:bg-white/10'}`

  const moonSites = useMemo(() => {
    const list = picking ? catalogue.map((c) => c.site) : results.map((r) => r.site)
    const verdictOf = new Map([...catalogue.map((c) => [c.site.id, c.m.verdict] as const), ...results.map((r) => [r.site.id, r.m.verdict] as const)])
    return list.map((s) => ({ id: s.id, name: siteName(s), lat: s.lat, lon: s.lon, color: VERDICT_HEX[verdictOf.get(s.id) ?? 'not-viable'] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking, results, siteName, catalogue])
  const moonLabels = !picking || moonSites.length <= 12
  // What the callout on the 3D Moon says about a site under the mouse.
  const byId = useMemo(() => new Map([...catalogue.map((c) => [c.site.id, c] as const), ...results.map((r) => [r.site.id, { site: r.site, m: r.m }] as const)]), [catalogue, results])
  const moonInfo = (id: string) => {
    const c = byId.get(id)
    if (!c) return null
    const { site, m } = c
    const rows = [
      { label: t.sunlight, value: `${num(m.sunlightPct)} %`, fill: m.sunlightPct / 100, bar: 'bg-sun' },
      { label: t.earthContact, value: `${num(m.earthLinkPct)} %`, fill: m.earthLinkPct / 100, bar: 'bg-earth' },
      { label: t.longestDarkness, value: fmtDuration(m.longestNightH), fill: Math.min(1, m.longestNightH / 96), bar: m.longestNightH <= 24 ? 'bg-ok' : m.longestNightH <= 72 ? 'bg-warn' : 'bg-bad' },
    ]
    return (
      <>
        <p className="text-base font-bold leading-tight">{siteName(site)}</p>
        <p className="text-[11px] tabular-nums text-muted">
          {site.lat.toFixed(2)}°, {site.lon.toFixed(2)}°
        </p>
        <p className={`mt-1.5 flex items-center gap-1.5 text-sm font-semibold ${VERDICT_CLS[m.verdict]}`}>
          <VerdictIcon v={m.verdict} size={16} />
          {t.verdictLong[m.verdict]}
        </p>
        <div className="mt-2.5 space-y-1.5">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs">
                <span className="text-muted">{r.label}</span>
                <span className="font-semibold tabular-nums">{r.value}</span>
              </div>
              <div className="mt-0.5 h-1 bg-white/10">
                <div className={`h-full ${r.bar}`} style={{ width: `${Math.max(0, Math.min(1, r.fill)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 border-t border-white/10 pt-2 text-[11px] text-muted">
          {t.stayDays(mission.durationDays)}
        </p>
      </>
    )
  }

  const skyHeight = Math.max(220, skyH)

  return (
    <LangContext.Provider value={t}>
      {moonOk ? (
        <Suspense fallback={null}>
        <MoonScene mode={splashDone ? 'app' : 'intro'} sites={moonSites} showLabels={moonLabels} focusId={picking ? undefined : focused?.site.id} onPick={pick} info={moonInfo} dive={diving} sunAt={sunAt} earth={earthAt} onStreet={(id) => { pick(id); openStreet() }} streetLabel={t.streetView} answerLabel={t.seeAnswer} heat={heat} controls={{ zoomIn: t.zoomIn, zoomOut: t.zoomOut, recenter: t.recenter, earth: t.viewEarth, fromEarth: t.viewFromEarth, hd: t.viewHd, layer: t.lightLayer, layerOn: lightOn, layerBusy: lightBusy, onLayer: () => setLightOn((o) => !o) }} frameRef={frameRef} onFail={() => {
            setMoonOk(false)
            setMoonState('failed')
          }} onReady={() => setMoonState('done')} />
        </Suspense>
      ) : (
        <MoonFallback />
      )}

      <div className={`pointer-events-none relative z-10 flex h-dvh flex-col transition-opacity duration-700 ${splashDone ? 'opacity-100' : 'opacity-0'}`}>
        <header className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2 bg-gradient-to-b from-black/85 to-transparent px-4 pb-4 pt-3">
          <div className="flex items-center gap-3">
            <HamburgerMenu label={t.mainMenu}>
              {(close) => (
                <>
                  <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">{t.language}</p>
                  <div className="mx-4 mb-2 inline-flex border border-white/30" role="group" aria-label={t.language}>
                    {(
                      [
                        ['en', 'English'],
                        ['es', 'Español'],
                      ] as const
                    ).map(([id, label]) => (
                      <button key={id} lang={id} onClick={() => setLang(id)} aria-pressed={lang === id} className={seg(lang === id)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-white/10 pt-1">
                    {[
                      { label: t.copyLink, onSelect: share, hidden: !chosen.length },
                      { label: focused ? t.downloadCsv(siteName(focused.site)) : '', onSelect: downloadCsv, hidden: !focused },
                      { label: t.dataSources, onSelect: () => setSourcesOpen(true) },
                    ]
                      .filter((i) => !i.hidden)
                      .map((i) => (
                        <button key={i.label} onClick={() => { close(); i.onSelect() }} className="block min-h-11 w-full px-4 text-left text-sm hover:bg-white/10 lg:min-h-10">
                          {i.label}
                        </button>
                      ))}
                  </div>
                  <p className="mx-4 mt-2 border-t border-white/10 pt-2 text-xs text-white/75">
                    <strong className="mb-0.5 block text-white">{t.demoStrong}</strong>
                    {t.demoRest}
                  </p>
                </>
              )}
            </HamburgerMenu>
            <button onClick={() => setPicking(true)} aria-label={t.findTitle} className="min-h-11">
              <Logo />
            </button>
          </div>
          {/* Quick date and hour: the Moon's light and shadows follow it. A second line on phones. */}
          {splashDone && ready && (
            <div className="order-last min-w-0 basis-full lg:order-none lg:ml-auto lg:max-w-2xl lg:flex-1 lg:basis-auto">
              <TimeBar start={start} min={DATA.start} max={DATA.end} stay={mission.durationDays} index={focused ? (playIdx ?? 0) : freeHour} sunHours={focused?.samples.map((x) => x.sunVisible)} plan={plan} label={fmtDateTime} onStart={setStart} onStay={(n) => set('durationDays', n)} onScrub={scrub} />
            </div>
          )}
        </header>

        <div className="relative min-h-0 flex-1 lg:flex lg:gap-3 lg:px-3 lg:pb-3">
          {/* The guided card: find a site, then the answer. A bottom sheet on phones. */}
          <section className={`ui-in glass pointer-events-auto absolute inset-x-0 bottom-0 max-h-[64dvh] overflow-y-auto rounded-t-xl px-4 pb-6 pt-4 lg:relative lg:max-h-none lg:w-[400px] lg:shrink-0 lg:rounded-none lg:p-5 ${cardOpen ? '' : cardStay.value ? 'sheet-out' : 'hidden'}`}>
            <CloseButton label={t.hidePanel} onClick={() => setCardOpen(false)} kind="fold" className="float-right -mt-1 ml-2" />
            {picking || !focused ? (
              <div>
                {focused && (
                  <CloseButton label={t.back} onClick={() => setPicking(false)} kind="back" withText className="mb-3" />
                )}
                <h1 className="text-2xl font-bold">{t.findTitle}</h1>
                <p className="mt-1 text-muted">{t.findHelp}</p>
                {!ready && <p className="mt-4 text-sm text-muted">{dataFailed ? t.dataFailed : t.loadingData}</p>}
                {ready && (
                  <>
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={t.legend}>
                      {(['viable', 'marginal', 'not-viable'] as const).map((v) => (
                        <span key={v} className="flex items-center gap-1.5">
                          <span className={`size-2.5 rounded-full ${VERDICT_BG[v]}`} aria-hidden="true" />
                          {t.verdictLong[v]}
                        </span>
                      ))}
                    </p>
                    <p className="mt-2 text-xs text-muted">{t.teamSites(catalogue.length, SITES.length)}</p>
                  </>
                )}
                <div className="mt-2 border-t border-white/10">
                  <ol>
                    {catalogue.map(({ site, m }, n) => (
                      <li key={site.id} className="border-b border-white/10">
                        <button onClick={() => pick(site.id)} className="flex min-h-14 w-full items-center gap-3 py-2 pl-1 text-left hover:bg-white/5">
                          <span className="w-5 text-center text-sm font-bold tabular-nums text-muted">{n + 1}</span>
                          <span className={`size-2.5 shrink-0 rounded-full ${VERDICT_BG[m.verdict]}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{site.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {t.sunlight} {num(m.sunlightPct)} %, {t.earthInView} {num(m.earthLinkPct)} %
                            </span>
                          </span>
                          <span className={`shrink-0 text-sm font-semibold ${VERDICT_CLS[m.verdict]}`}>{t.verdict[m.verdict]}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
                <details className="mt-4 text-sm">
                  <summary className="min-h-11 cursor-pointer py-2 text-nasa-blue underline underline-offset-4">{t.useOwnCoords}</summary>
                  <div className="mt-2 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        {t.latitude}
                        <input type="number" step={0.01} value={customLat} onChange={(e) => setCustomLat(e.target.value)} className={`mt-1 ${field}`} />
                      </label>
                      <label>
                        {t.longitude}
                        <input type="number" step={0.1} value={customLon} onChange={(e) => setCustomLon(e.target.value)} className={`mt-1 ${field}`} />
                      </label>
                    </div>
                    <p className="text-warn">{t.customWarning}</p>
                    <button onClick={addCustom} className="min-h-11 rounded-sm bg-nasa-blue px-4 font-semibold text-white">
                      {t.addPoint}
                    </button>
                  </div>
                </details>
                {!moonOk && (
                  <div className="mt-5 max-w-[240px]">
                    <SiteMap sites={catalogue.map((c) => c.site)} chosen={chosen} onToggle={pick} />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <CloseButton label={t.changeSite} onClick={() => setPicking(true)} kind="back" withText />
                <h1 className="mt-3 text-2xl font-bold">{siteName(focused.site)}</h1>
                <p className="text-xs text-muted">
                  {focused.site.lat.toFixed(2)}°, {focused.site.lon.toFixed(2)}°
                </p>

                <div className={`mt-4 flex items-center gap-3 ${VERDICT_CLS[focused.m.verdict]}`}>
                  <VerdictIcon v={focused.m.verdict} size={34} />
                  <p className="text-2xl font-bold leading-tight">{t.verdictLong[focused.m.verdict]}</p>
                </div>
                <p className="mt-2 text-ink">{reason(focused.m)}</p>
                {focused.site.ideal && <p className="mt-1 text-sm text-warn">{t.noTerrain}</p>}
                <p className="mt-1 text-sm text-muted">{t.forDates(fmtDate(start), fmtDate(end))}</p>
                {focused.site.published && focused.site.published['2027'] !== undefined && (
                  <p className="mt-2 border-l-2 border-white/25 pl-3 text-sm text-muted">{t.publishedRef(focused.site.published['2027'])}</p>
                )}
                {focused.site.team && (
                  <p className="mt-2 border-l-2 border-sun/60 pl-3 text-sm text-muted">{focused.site.team.hypothesis[lang]}</p>
                )}
                {disagrees(focused.site) && focused.site.oursSunDays2027 !== undefined && focused.site.published?.['2027'] !== undefined && (
                  <p className="mt-2 flex gap-2 border border-warn/40 bg-warn/10 p-2.5 text-sm text-warn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden="true">
                      <path d="M12 3l9.5 17h-19z" />
                      <path d="M12 10v4.5M12 17.5v.5" />
                    </svg>
                    <span>{t.disagree(num(focused.site.oursSunDays2027, 0), focused.site.published['2027'])}</span>
                  </p>
                )}

                <dl className="mt-4 grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        sub: hrs(focused.m.sunlightPct),
                        label: t.sunlight,
                        value: `${num(focused.m.sunlightPct)} %`,
                        fill: focused.m.sunlightPct / 100,
                        bar: 'bg-sun',
                        tone: focused.m.sunlightPct >= 90 ? 'ok' : focused.m.sunlightPct >= 60 ? 'warn' : 'bad',
                        ticks: [0.6, 0.9],
                        was: slipped && Math.round(focused.m.sunlightPct) !== Math.round(focused.base.sunlightPct) ? t.was(`${num(focused.base.sunlightPct)} %`) : '',
                      },
                      {
                        sub: hrs(focused.m.earthLinkPct),
                        label: t.earthContact,
                        value: `${num(focused.m.earthLinkPct)} %`,
                        fill: focused.m.earthLinkPct / 100,
                        bar: 'bg-earth',
                        tone: focused.m.earthLinkPct >= 50 ? 'ok' : 'warn',
                        ticks: [0.5],
                        was: slipped && Math.round(focused.m.earthLinkPct) !== Math.round(focused.base.earthLinkPct) ? t.was(`${num(focused.base.earthLinkPct)} %`) : '',
                      },
                      {
                        sub: hrs(focused.m.opsPct),
                        label: t.both,
                        value: `${num(focused.m.opsPct)} %`,
                        fill: focused.m.opsPct / 100,
                        bar: 'bg-[rgb(120,190,255)]',
                        tone: null,
                        ticks: [],
                        was: slipped && Math.round(focused.m.opsPct) !== Math.round(focused.base.opsPct) ? t.was(`${num(focused.base.opsPct)} %`) : '',
                      },
                      {
                        sub: t.ofStay(num((100 * focused.m.longestNightH) / stayH)),
                        label: t.longestDarkness,
                        value: fmtDuration(focused.m.longestNightH),
                        fill: Math.min(focused.m.longestNightH / 96, 1),
                        bar: focused.m.longestNightH <= 24 ? 'bg-ok' : focused.m.longestNightH <= 72 ? 'bg-warn' : 'bg-bad',
                        tone: focused.m.longestNightH <= 24 ? 'ok' : focused.m.longestNightH <= 72 ? 'warn' : 'bad',
                        ticks: [24 / 96, 72 / 96],
                        was: slipped && focused.m.longestNightH !== focused.base.longestNightH ? t.was(fmtDuration(focused.base.longestNightH).toLowerCase()) : '',
                      },
                    ] as const
                  ).map(({ label, value, sub, fill, bar, tone, ticks, was }) => (
                    <div key={label} className="border border-white/10 bg-black/30 p-2.5">
                      <dt className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span>{label}</span>
                        {tone && <i aria-hidden="true" className={`inline-block size-2 rounded-full ${tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-bad'}`} />}
                      </dt>
                      <dd className="mt-1 text-2xl font-bold tabular-nums leading-none">{value}</dd>
                      <dd className="mt-1 text-xs tabular-nums text-white/80">{sub}</dd>
                      <div className="relative mt-2 h-1.5 bg-white/10" role="presentation">
                        <div className={`h-full ${bar} transition-[width] duration-500`} style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }} />
                        {ticks.map((x) => (
                          <span key={x} className="absolute -top-0.5 h-2.5 w-px bg-white/60" style={{ left: `${x * 100}%` }} />
                        ))}
                      </div>
                      <Was show={!!was} text={was} />
                    </div>
                  ))}
                </dl>
                <SiteLight site={focused.site} light={lightOn ? lightShown : null} onTurnOn={() => setLightOn(true)} busy={lightBusy} />
                <div className="mt-3">
                  <StayBar samples={focused.samples} madrid={madrid} from={fmtDate(focused.samples[0].t)} to={fmtDate(focused.samples[stayH - 1].t)} />
                  <p className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <i className="inline-block size-2 bg-sun" /> {t.sunlight}: <b className="font-semibold text-ink tabular-nums">{Math.round((focused.m.sunlightPct * stayH) / 100)} h</b>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="inline-block size-2 bg-earth" /> {t.earthInView}: <b className="font-semibold text-ink tabular-nums">{Math.round((focused.m.earthLinkPct * stayH) / 100)} h</b>
                    </span>
                    {madrid && (
                      <span className="flex items-center gap-1.5">
                        <i className="inline-block size-2 bg-nasa-red" /> {t.madridShort}: <b className="font-semibold text-ink tabular-nums">{Math.round((focused.m.madridPct * stayH) / 100)} h</b>
                      </span>
                    )}
                  </p>
                </div>

                {/* Phone: the sky in 2D right in the answer (on desktop it sits under the Moon). */}
                {skyOpen ? (
                  <div className="mt-4 border border-white/10 bg-black/30 lg:hidden">
                    <SkyStrip name={siteName(focused.site)} height={180} onExpand={() => { setView('2d'); setPanel('sky') }} onClose={() => setSkyOpen(false)}>
                      <Panorama site={focused.site} samples={focused.samples} height={180} />
                    </SkyStrip>
                  </div>
                ) : (
                  <button onClick={() => setSkyOpen(true)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-white/20 bg-black/30 text-sm font-semibold hover:bg-white/10 lg:hidden">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 18c3-7 6-10 9-10s6 3 9 10" /><path d="M3 21h18" /><circle cx="12" cy="8" r="1.6" fill="currentColor" /></svg>
                    {t.skyCurves}
                  </button>
                )}

                <button
                  onClick={openStreet}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-sm bg-sun px-4 font-semibold text-black hover:brightness-110"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="5" r="2.2" />
                    <path d="M12 8v6M9 21l3-7 3 7M8.5 11.5h7" />
                    <path d="M3 18.5c2.2-1 5.4-1.6 9-1.6s6.8.6 9 1.6" />
                  </svg>
                  {t.streetView}
                </button>
                <button onClick={simulateLanding} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-sm border border-sun/70 bg-black/30 px-4 font-semibold text-sun hover:bg-sun/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 4h8l2 6H6l2-6z" />
                    <path d="M7 10l-3 9M17 10l3 9M12 10v5M9 20h6M2.5 19h3M18.5 19h3" />
                  </svg>
                  {t.simulate}
                </button>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ['sky', t.seeSky],
                      ['when', t.bestDates],
                      ['compare', t.compare],
                    ] as const
                  ).map(([id, label]) => (
                    <button key={id} onClick={() => setPanel(panel === id ? null : id)} aria-pressed={panel === id} className={`min-h-12 rounded-sm px-2 text-sm font-semibold ${panel === id ? 'bg-sun text-black' : 'bg-white/10 hover:bg-white/15'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <details className="mt-5 border-t border-white/10 pt-2" open={slipped || undefined}>
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 font-semibold">
                    <span>{t.whenTitle}</span>
                    <span className="text-xs font-normal text-muted">{t.stayDays(mission.durationDays)}, {fmtDate(start)}</span>
                  </summary>
                  {/* Date, hour and days on the surface are set in the time bar of the header. */}
                  <details className="mt-1" open={slipped}>
                    <summary className="min-h-11 cursor-pointer py-2 text-sm text-nasa-blue underline underline-offset-4">{t.slipTitle}</summary>
                    <div className="flex items-center gap-2">
                      <button aria-label={t.dayEarlier} onClick={() => set('slipDays', Math.max(-30, mission.slipDays - 1))} className="size-11 shrink-0 rounded-sm border border-white/25 text-xl hover:bg-white/10">
                        −
                      </button>
                      <input type="range" min={-30} max={60} value={mission.slipDays} onChange={(e) => set('slipDays', Number(e.target.value))} className="h-11 min-w-0 flex-1 accent-sun" aria-label={t.daysOfDelay} />
                      <button aria-label={t.dayLater} onClick={() => set('slipDays', Math.min(60, mission.slipDays + 1))} className="size-11 shrink-0 rounded-sm border border-white/25 text-xl hover:bg-white/10">
                        +
                      </button>
                    </div>
                    <p className="mt-1 text-sm">
                      {slipped ? (
                        <>
                          <strong>{t.slipBy(mission.slipDays)}</strong> {t.landingMovesTo(fmtDateTime(start))}{' '}
                          <button onClick={() => set('slipDays', 0)} className="text-nasa-blue underline underline-offset-4">
                            {t.backToPlanned}
                          </button>
                        </>
                      ) : (
                        t.onSchedule(fmtDateTime(start))
                      )}
                    </p>
                  </details>
                  <details className="mt-1 text-sm">
                    <summary className="min-h-11 cursor-pointer py-2 text-nasa-blue underline underline-offset-4">{t.options}</summary>
                    <div className="mt-1 grid grid-cols-1 gap-3">
                      <label>
                        {t.survivalPower}
                        <input type="number" min={0} value={mission.survivalPowerW} onChange={(e) => set('survivalPowerW', Math.max(0, Number(e.target.value) || 0))} className={`mt-1 ${field}`} />
                      </label>
                      <label>
                        {t.antennaAngle}
                        <input type="number" step={0.5} min={0} value={mission.minAntennaElevDeg} onChange={(e) => set('minAntennaElevDeg', Math.max(0, Number(e.target.value) || 0))} className={`mt-1 ${field}`} />
                      </label>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" checked={madrid} onChange={(e) => setMadrid(e.target.checked)} className="mt-1 size-5 shrink-0 accent-sun" />
                        <span>
                          {t.madridToggle}
                          <span className="block text-xs text-muted">{t.madridExplain(MADRID_DSN.minElevDeg)}</span>
                          {madrid && <span className="mt-1 block text-xs">{t.madridPct(num(focused.m.madridPct))}</span>}
                        </span>
                      </label>
                    </div>
                  </details>
                </details>
                <p className="mt-4 text-xs text-muted">{t.caveat}</p>
              </div>
            )}
          </section>

          {/* Free area: the 3D Moon frames the south pole here. */}
          <div className={`pointer-events-none absolute inset-x-0 top-0 flex flex-col lg:static lg:min-w-0 lg:flex-1 ${cardOpen ? 'bottom-[64dvh]' : 'bottom-20'}`}>
            <div ref={frameRef} className="relative min-h-0 flex-1" aria-hidden="true">
              {splashDone && moonOk && !panel && !lightOn && <p className="absolute inset-x-0 bottom-2 hidden text-center text-xs text-white/60 lg:block">{t.dragHint}</p>}
              {/* Legend of the heat map: what the colours mean, and how far to trust them. */}
              {splashDone && moonOk && lightOn && (
                <div className="ui-in glass absolute bottom-2 left-2 max-w-[min(300px,calc(100%-88px))] px-3 py-2 text-xs">
                  <p className="font-semibold">{lightHour > 0 ? t.lightLegendTo(fmtDateTime(litAt)) : t.lightLegend}{lightBusy ? '…' : ''}</p>
                  <div className="mt-1.5 h-2.5" style={{ background: LIGHT_GRADIENT }} />
                  <p className="mt-0.5 flex justify-between tabular-nums text-white/80">
                    <span>0 %</span>
                    <span>50 %</span>
                    <span>100 %</span>
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted">{t.lightNote}</p>
                </div>
              )}
            </div>
            {/* Desktop: with a site chosen, its sky in 2D docked under the Moon. */}
            {skyStay.value && focused && (
              <section className={`${skyStay.leaving ? 'ui-out' : 'ui-in'} glass pointer-events-auto mx-3 mb-3 hidden lg:block`} aria-label={t.skyFrom(siteName(focused.site))}>
                <SkyStrip name={siteName(focused.site)} height={190} onExpand={() => { setView('2d'); setPanel('sky') }} onClose={() => setSkyOpen(false)}>
                  <Panorama site={focused.site} samples={focused.samples} height={190} />
                </SkyStrip>
              </section>
            )}
            {focused && !picking && panel !== 'sky' && !skyOpen && !skyStay.value && (
              <div className="pointer-events-none mb-12 hidden justify-center lg:flex">
                <button onClick={() => setSkyOpen(true)} className="ui-in glass pointer-events-auto flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold hover:bg-white/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 18c3-7 6-10 9-10s6 3 9 10" /><path d="M3 21h18" /><circle cx="12" cy="8" r="1.6" fill="currentColor" /></svg>
                  {t.skyCurves}
                </button>
              </div>
            )}
            {/* The main card, folded: a floating button brings it back (fixed, so its place here does not matter). */}
          {!cardOpen && !cardStay.value && (
            <button
              onClick={() => setCardOpen(true)}
              aria-label={t.showPanel}
              className="ui-in glass pointer-events-auto fixed bottom-4 left-1/2 z-20 flex min-h-12 max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2.5 rounded-full px-5 font-semibold lg:bottom-6 lg:left-6 lg:translate-x-0"
            >
              {focused && !picking ? (
                <>
                  <i className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: VERDICT_HEX[focused.m.verdict] }} />
                  <span className="truncate">{siteName(focused.site)}</span>
                  <span className={`shrink-0 text-sm ${VERDICT_CLS[focused.m.verdict]}`}>{t.verdictLong[focused.m.verdict]}</span>
                </>
              ) : (
                <span>{t.chooseSiteShort}</span>
              )}
              <span className="rotate-180 text-muted"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></span>
            </button>
          )}
          </div>

          {/* On-demand panels: the sky, the best dates, the comparison. */}
          {shownPanel && focused && (
            <section className={`${panelStay.leaving ? 'ui-out' : 'ui-in'} glass pointer-events-auto fixed inset-0 z-30 solid-phone flex flex-col lg:static lg:inset-auto lg:z-auto lg:w-[min(760px,50vw)] lg:shrink-0`} aria-label={shownPanel === 'sky' ? t.seeSky : shownPanel === 'when' ? t.bestDates : t.compare}>
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
                  {(
                    [
                      ['sky', t.seeSky],
                      ['when', t.bestDates],
                      ['compare', t.compare],
                    ] as const
                  ).map(([id, label]) => (
                    <button key={id} role="tab" aria-selected={shownPanel === id} onClick={() => setPanel(id)} className={`min-h-11 shrink-0 whitespace-nowrap px-2.5 text-sm sm:px-3 ${shownPanel === id ? 'border-b-2 border-sun font-semibold' : 'text-muted hover:text-ink'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <CloseButton label={t.close} onClick={() => setPanel(null)} withText />
              </div>

              <div key={shownPanel} className="ui-fade flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                {shownPanel === 'sky' && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="mr-auto text-lg font-bold">{t.skyFrom(siteName(focused.site))}</h2>
                      <div className="inline-flex border border-white/25" role="group" aria-label={t.view}>
                        {(
                          [
                            ['2d', t.view2d],
                            ['3d', t.view3d],
                          ] as const
                        ).map(([id, label]) => (
                          <button key={id} onClick={() => setView(id)} aria-pressed={view === id} className={seg(view === id)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted">{t.skyIntro}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button onClick={togglePlay} className="min-h-11 rounded-sm bg-sun px-4 font-semibold text-black">
                        {playing ? t.pause : t.play}
                      </button>
                      {cursor && (
                        <input
                          type="range"
                          min={0}
                          max={focused.samples.length - 1}
                          value={playIdx ?? 0}
                          onChange={(e) => {
                            setPlaying(false)
                            setPlayIdx(Number(e.target.value))
                          }}
                          className="h-11 min-w-0 flex-1 accent-sun"
                          aria-label={t.moment}
                        />
                      )}
                    </div>
                    <div ref={skyRef} className="relative mt-3 min-h-[240px] flex-1">
                      {cursor && (
                        <FloatPanel title={fmtDateTime(cursor.t)} className="left-2 top-2">
                          {t.sunState(cursor.sunVisible > 0.5)}. {t.earthState(cursor.earthVisible)}.
                        </FloatPanel>
                      )}
                      <FloatPanel title={t.legend} className="right-2 top-2" defaultOpen={false}>
                        {view === '3d' ? (
                          t.note3d
                        ) : (
                          <span className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5">
                              <i className="inline-block size-2.5 rounded-full bg-sun" /> {t.sunPath}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <i className="inline-block size-2.5 rounded-full bg-earth" /> {t.earthPath}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <i className="inline-block size-2.5 bg-regolith" /> {t.terrain}
                            </span>
                            <span className="text-white/75">{t.fadedHidden}</span>
                          </span>
                        )}
                      </FloatPanel>
                      {view === '2d' ? (
                        <div className="h-full bg-black p-1">
                          <Panorama site={focused.site} samples={focused.samples} cursor={cursor} height={skyHeight - 8} />
                        </div>
                      ) : (
                        <Suspense fallback={<SkyLoading height={skyHeight} label={t.loading3d} />}>
                          <Surface3D site={focused.site} sample={cursor ?? focused.samples[0]} height={skyHeight} />
                        </Suspense>
                      )}
                    </div>
                    <StayHeatmap
                      samples={focused.samples}
                      cursor={playIdx ?? undefined}
                      onPick={(i) => {
                        setPlaying(false)
                        setPlayIdx(i)
                      }}
                    />
                  </>
                )}

                {shownPanel === 'when' && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="mr-auto text-lg font-bold">{t.yearTitle}</h2>
                      <div className="inline-flex flex-wrap border border-white/25" role="group" aria-label={t.yearShow}>
                        {(
                          [
                            ['sun', t.sunlight],
                            ['earth', t.earthContact],
                            ['both', t.both],
                          ] as const
                        ).map(([id, label]) => (
                          <button key={id} onClick={() => setYearMetric(id)} aria-pressed={yearMetric === id} className={seg(yearMetric === id)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted">{t.yearIntro(OVERVIEW_MONTHS)}</p>
                    <div className="mt-4 space-y-4">
                      {overviews.map((o) => (
                        <div key={o.site.id}>
                          <p className="mb-1 text-sm font-semibold">{siteName(o.site)}</p>
                          <YearStrip days={o.days} metric={yearMetric} stayFrom={start} stayDays={mission.durationDays} onPick={landOn} label={`${siteName(o.site)}: ${yearMetric === 'sun' ? t.sunlight : yearMetric === 'earth' ? t.earthContact : t.both}`} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {shownPanel === 'compare' && (
                  <>
                    <h2 className="text-lg font-bold">{t.compareTitle}</h2>
                    <p className="mt-1 text-sm text-muted">{t.forDates(fmtDate(start), fmtDate(end))}</p>
                    {best && <p className="mt-3 border-l-2 border-sun pl-3 font-semibold">{t.bestNow(siteName(best.site))}</p>}
                    <ul className="mt-3 divide-y divide-white/10 border-y border-white/10">
                      {results.map((r) => (
                        <li key={r.site.id} className={`py-3 ${r.site.id === focused.site.id ? 'bg-white/5' : ''}`}>
                          <div className="flex items-start gap-3">
                            <button onClick={() => setFocus(r.site.id)} className="flex flex-1 items-start gap-2 text-left">
                              <span className={VERDICT_CLS[r.m.verdict]}>
                                <VerdictIcon v={r.m.verdict} size={20} />
                              </span>
                              <span>
                                <span className="block font-semibold">{siteName(r.site)}</span>
                                <span className={`block text-sm ${VERDICT_CLS[r.m.verdict]}`}>{t.verdictLong[r.m.verdict]}</span>
                              </span>
                            </button>
                            <CloseButton label={t.remove} onClick={() => remove(r.site.id)} withText />
                          </div>
                          <dl className="mt-2 grid grid-cols-4 gap-2 text-sm">
                            {[
                              [t.sunlight, `${num(r.m.sunlightPct)} %`],
                              [t.longestDarkness, fmtDuration(r.m.longestNightH)],
                              [t.earthContact, `${num(r.m.earthLinkPct)} %`],
                              [t.both, `${num(r.m.opsPct)} %`],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <dt className="text-xs text-muted">{label}</dt>
                                <dd className="font-semibold">{value}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="mt-2">
                            <StayBar samples={r.samples} madrid={madrid} />
                          </div>
                        </li>
                      ))}
                    </ul>
                    {chosen.length < MAX_SITES && (
                      <div className="mt-4">
                        <h3 className="text-sm font-semibold">{t.addToCompare}</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {catalogue
                            .filter((c) => !chosen.includes(c.site.id))
                            .map(({ site, m }) => (
                              <button key={site.id} onClick={() => addToCompare(site.id)} className={`${ghost} flex items-center gap-2 text-sm`}>
                                <span className={`size-2 rounded-full ${VERDICT_BG[m.verdict]}`} aria-hidden="true" />+ {site.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                    <p className="mt-4 text-xs text-muted">{t.caveat}</p>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <Snackbar message={toast} onDone={clearToast} />
      {landing > 0 && diving && !streetOpen && (
        <p className="ui-in glass pointer-events-none fixed left-1/2 top-24 z-30 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-semibold text-sun" role="status">
          {t.simApproach}
        </p>
      )}
      {/* Street view, full screen: the ground of the site, its Sun and Earth, and the stay to play. */}
      {streetStay.value && focused && (
        <div className={`${streetStay.leaving ? 'street-out' : 'street-in'} fixed inset-0 z-40 flex flex-col bg-black`} role="dialog" aria-modal="true" aria-label={t.streetView}>
          <div className="glass flex items-center gap-3 px-3 py-2 sm:px-4">
            <span className={VERDICT_CLS[focused.m.verdict]}>
              <VerdictIcon v={focused.m.verdict} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold leading-tight">{siteName(focused.site)}</p>
              <p className={`truncate text-xs ${VERDICT_CLS[focused.m.verdict]}`}>{t.verdictLong[focused.m.verdict]}</p>
            </div>
            <CloseButton label={t.close} onClick={closeStreet} withText />
          </div>
          <div ref={streetRef} className="relative min-h-0 flex-1">
            {streetH > 0 && (
              <Suspense fallback={<SkyLoading height={streetH} label={t.loading3d} />}>
                <Surface3D site={focused.site} sample={cursor ?? focused.samples[0]} height={streetH} landing={landing} />
              </Suspense>
            )}
          </div>
          <div className="glass flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 sm:px-4">
            <button onClick={togglePlay} className="min-h-11 rounded-sm bg-sun px-4 font-semibold text-black">
              {playing ? t.pause : t.play}
            </button>
            <input
              type="range"
              min={0}
              max={focused.samples.length - 1}
              value={playIdx ?? 0}
              onChange={(e) => {
                setPlaying(false)
                setPlayIdx(Number(e.target.value))
              }}
              className="h-11 min-w-40 flex-1 accent-sun"
              aria-label={t.moment}
            />
            <p className="w-full text-xs text-white/80 sm:w-auto">
              <span className="font-semibold text-ink">{fmtDateTime((cursor ?? focused.samples[0]).t)}</span>
              {'. '}
              {t.sunState((cursor ?? focused.samples[0]).sunVisible > 0.5)}. {t.earthState((cursor ?? focused.samples[0]).earthVisible)}.
            </p>
          </div>
        </div>
      )}

      <Overlay open={sourcesOpen} title={t.dataSources} onClose={() => setSourcesOpen(false)}>
        <p className="text-muted">{t.sourcesIntro}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {t.sourcesItems.map((x) => (
            <li key={x}>{x}</li>
          ))}
          <li>{t.moonCredit}</li>
        </ul>
        <h3 className="mt-4 font-semibold">{t.howWeKnow}</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
          <li>{t.checkHorizons}</li>
          {DATA.validation && <li>{t.checkWueller(DATA.validation.sites, Math.round(DATA.validation.agreementOn10DayThreshold * 100), DATA.validation.correlation, DATA.validation.medianAbsDiffDays)}</li>}
        </ul>
        {/* Our long-term figures against NASA's own illumination and Earth-visibility maps, site by site. */}
        {SITES.some((s) => s.team) && (
          <>
            <h3 className="mt-4 font-semibold">{t.pgdaTitle}</h3>
            <p className="mt-1 text-sm text-muted">{t.pgdaIntro}</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-rule text-xs text-muted">
                    <th className="py-1.5 pr-2 font-normal">{t.pgdaSite}</th>
                    <th className="px-2 py-1.5 font-normal">{t.sunlight}: {t.pgdaOurs}</th>
                    <th className="px-2 py-1.5 font-normal">NASA</th>
                    <th className="px-2 py-1.5 font-normal">{t.earthInView}: {t.pgdaOurs}</th>
                    <th className="py-1.5 pl-2 font-normal">NASA</th>
                  </tr>
                </thead>
                <tbody>
                  {SITES.filter((s) => s.team).map((s) => {
                    const c = s.team!.pgda69
                    const inBand = (x: { ours: number; band: [number, number] }) => x.ours >= x.band[0] - 0.5 && x.ours <= x.band[1] + 0.5
                    return (
                      <tr key={s.id} className="border-b border-rule/60">
                        <td className="py-1.5 pr-2 font-semibold">{s.name}</td>
                        <td className={`px-2 py-1.5 ${inBand(c.sun) ? '' : 'text-warn'}`}>{num(c.sun.ours, 1)} %</td>
                        <td className="px-2 py-1.5 text-muted">{num(c.sun.nasa, 1)} % <span className="text-xs">({num(c.sun.band[0], 0)}–{num(c.sun.band[1], 0)})</span></td>
                        <td className={`px-2 py-1.5 ${inBand(c.earth) ? '' : 'text-warn'}`}>{num(c.earth.ours, 1)} %</td>
                        <td className="py-1.5 pl-2 text-muted">{num(c.earth.nasa, 1)} % <span className="text-xs">({num(c.earth.band[0], 0)}–{num(c.earth.band[1], 0)})</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">{t.pgdaNote}</p>
          </>
        )}
        <p className="mt-4 border-t border-rule pt-3 text-sm">{t.caveat}</p>
        <p className="mt-2 text-sm text-muted">{t.footer}</p>
      </Overlay>
      <Splash onDone={() => setSplashDone(true)} showMoon={false} moon={moonState} />
    </LangContext.Provider>
  )
}
