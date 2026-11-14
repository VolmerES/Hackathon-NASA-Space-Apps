import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DATA, DEFAULT_REQUIREMENTS, MADRID_DSN, SITES, clampToData, customSite, landingCalendar, loadData, metrics, overview, simulate, subsolarAt, subearthAt, type Metrics, type Mission, type Sample, type Site } from './data/model'
import { Panorama } from './components/Panorama'
import { SiteMap } from './components/SiteMap'
import { StayBar } from './components/StayBar'
import { YearStrip, type YearMetric } from './components/YearView'
import { readScenario, writeScenario } from './scenario'
import { LIGHT_CAP_DEG, LIGHT_GRADIENT, lightMap, lightUpTo, type LightMap } from './data/lightmap'
import { SiteLight } from './components/SiteLight'
import { LangContext, STRINGS, readLang, useT, type Lang, type Strings } from './i18n'
import { useBoxHeight, useMedia, useStay } from './hooks'
import { CloseButton, FloatPanel, HamburgerMenu, NumberField, Overlay, Snackbar } from './components/Ui'
import { Splash, SKIP as SKIP_SPLASH } from './components/Splash'
import { TimeBar } from './components/TimeBar'
import { Missions, type Evaluated } from './components/Missions'
import { missionReportHtml, type ReportRow } from './report'
import { applyMission, kindOf, loadMissions, saveMissions, uid, type MissionDef, type SavedScenario } from './missions'
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
    const battery = m.batteryMarginWh !== null && m.batteryMarginWh < 0 ? ` ${t.reasonBattery}` : ''
    return `${sun}; ${earth}.${battery}`
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
  // Only the five landing sites of the team: a shared link naming any other candidate opens nothing.
  const site = SITES.find((s) => s.id === id)
  return site && (site.team || !SITES.some((x) => x.team)) ? site : undefined
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
  // The card starts folded on every load: the Moon first; the pill at the top left opens it.
  const [cardOpen, setCardOpen] = useState(false)
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
  // Missions of this browser, and the one being planned with (its requirements drive every verdict).
  const [missions, setMissions] = useState<MissionDef[]>(() => loadMissions())
  // No mission applies until one is opened: by default the tool explores freely, with its usual thresholds.
  const [activeId, setActiveId] = useState<string | null>(null)
  const [missionsStartNew, setMissionsStartNew] = useState(0) // bump: the overlay opens on a new mission
  const pendingScenario = useRef<Omit<SavedScenario, 'id' | 'name' | 'kind'> | null>(null)
  const [missionsOpen, setMissionsOpen] = useState(false)
  // The saved scenario on screen: changes can update it instead of making a new one.
  const [scenarioId, setScenarioId] = useState<string | null>(null)
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
  // Once the data arrive: without a link, the stay starts on their first day at 06:00 UTC. With a
  // link whose dates have no data, it moves to the nearest day that has, at 06:00, and says so.
  useEffect(() => {
    if (!ready) return
    const DAY = 86400000
    if (!hasLink) {
      const first = DATA.start
      setMission((m) => ({ ...m, slipDays: 0, landing: new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate(), 6)) }))
      return
    }
    const from = mission.landing.getTime() + mission.slipDays * DAY
    const lo = DATA.start.getTime()
    const hi = DATA.end.getTime() - mission.durationDays * DAY
    if (from >= lo && from <= hi) return
    const near = new Date(from < lo ? lo : Math.max(lo, hi))
    let day = Date.UTC(near.getUTCFullYear(), near.getUTCMonth(), near.getUTCDate(), 6)
    if (day < lo) day += DAY
    if (day > hi && day - DAY >= lo) day -= DAY
    setMission((m) => ({ ...m, landing: new Date(day - m.slipDays * DAY) }))
    setToast(t.toastNoData(fmtDateTime(new Date(day))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

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
    if (chosen.length) window.history.replaceState(window.history.state, '', writeScenario({ chosen, focus, mission, mode: 'planner' }) + extra)
    else window.history.replaceState(window.history.state, '', lang === 'es' ? '#l=es' : window.location.pathname)
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
  const swipe = useRef<{ x: number; y: number } | null>(null)
  // Phones: the card is a centred pop-up; the system Back button closes it (one history entry while open).
  const isPhone = useMedia('(max-width: 639px)')
  const cardHistory = useRef(false)
  useEffect(() => {
    if (cardOpen && isPhone && !cardHistory.current) {
      window.history.pushState({ ...(window.history.state ?? {}), card: true }, '', window.location.href)
      cardHistory.current = true
    }
    if (!cardOpen && cardHistory.current) {
      cardHistory.current = false
      if (window.history.state?.card) window.history.back()
    }
  }, [cardOpen, isPhone])
  useEffect(() => {
    const onPop = () => {
      if (!cardHistory.current) return
      cardHistory.current = false
      setCardOpen(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // The stay in hours (one sample per hour), so every percentage can also be read as hours.
  const stayH = Math.max(1, focused?.samples.length ?? 1)
  // Hours of the stay in the short form of the tiles: "217/241 h".
  const hrsShort = (pct: number) => `${num((pct * stayH) / 100)}/${num(stayH)} h`
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
    const p = landingCalendar(focused.site, mission.durationDays, mission.minAntennaElevDeg, mission.req, mission.survivalPowerW, mission.batteryWh)
    return disagrees(focused.site) ? p.map((d) => ({ ...d, hours: d.hours.map((v) => (v === 'viable' ? 'marginal' : v)) })) : p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focused?.site.id, mission.durationDays, mission.minAntennaElevDeg, mission.req, mission.survivalPowerW, mission.batteryWh])

  // Missions: open one (its requirements, and a saved scenario if given), save the current view as a
  // scenario, and evaluate any scenario with the current data.
  const active = missions.find((x) => x.id === activeId) ?? null
  const req = mission.req ?? DEFAULT_REQUIREMENTS
  const storeMissions = (list: MissionDef[]) => {
    setMissions(list)
    saveMissions(list)
  }
  const activate = (id: string | null) => setActiveId(id)
  // Back to free exploration: the mission's requirements and battery stop applying.
  const leaveMission = () => {
    activate(null)
    setScenarioId(null)
    setMission((cur) => ({ ...cur, req: undefined, batteryWh: undefined }))
  }
  const openMission = (m: MissionDef, sc?: SavedScenario) => {
    activate(m.id)
    setScenarioId(sc?.id ?? null)
    setMission((cur) => {
      const base = applyMission(m, cur)
      return sc ? { ...base, landing: new Date(sc.landing), slipDays: sc.slipDays } : base
    })
    if (sc) {
      setChosen(sc.sites)
      setFocus(sc.focus)
      setPicking(false)
    }
    setMissionsOpen(false)
    setToast(t.ms.opened(m.name))
  }
  const saveMissionDef = (m: MissionDef) => {
    // A mission created from "Add to mission" gets the view it was created from as its first scenario.
    const pend = pendingScenario.current
    pendingScenario.current = null
    const def = pend && !missions.some((x) => x.id === m.id) ? { ...m, scenarios: [{ id: uid(), name: autoName('baseline', pend), kind: 'baseline' as const, ...pend }] } : m
    storeMissions(missions.some((x) => x.id === def.id) ? missions.map((x) => (x.id === def.id ? def : x)) : [def, ...missions])
    if (pend) setToast(t.ms.addedTo(def.name))
    else {
      // Editing a mission is working on it: its values apply from now on (back to free exploration with ×).
      activate(def.id)
      setMission((cur) => applyMission(def, cur))
      setToast(t.ms.opened(def.name))
    }
  }
  const deleteMission = (id: string) => {
    storeMissions(missions.filter((x) => x.id !== id))
    if (activeId === id) leaveMission()
  }
  const deleteScenario = (mid: string, sid: string) => {
    storeMissions(
      missions.map((x) => {
        if (x.id !== mid) return x
        const wasBase = x.scenarios[0]?.id === sid
        let rest = x.scenarios.filter((sc) => sc.id !== sid)
        // Without its baseline, the next scenario becomes the baseline and the others are typed again against it.
        if (wasBase && rest.length) rest = rest.map((sc, i) => ({ ...sc, kind: i === 0 ? 'baseline' : kindOf(sc, rest[0]) }))
        return { ...x, scenarios: rest, updated: new Date().toISOString() }
      }),
    )
    if (sid === scenarioId) setScenarioId(null)
  }
  const patchScenario = (mid: string, sid: string, patch: Partial<SavedScenario>) =>
    storeMissions(missions.map((x) => (x.id === mid ? { ...x, scenarios: x.scenarios.map((sc) => (sc.id === sid ? { ...sc, ...patch } : sc)), updated: new Date().toISOString() } : x)))
  // What is on screen, in the shape of a saved scenario.
  const current = focused ? { sites: chosen.length ? chosen : [focused.site.id], focus: focused.site.id, landing: mission.landing.toISOString(), slipDays: mission.slipDays } : null
  const autoName = (kind: SavedScenario['kind'], sc: { landing: string; slipDays: number }) => `${t.ms.kinds[kind]} · ${fmtDate(new Date(Date.parse(sc.landing) + sc.slipDays * 86400000))}`
  const openScenario = active?.scenarios.find((sc) => sc.id === scenarioId) ?? null
  const scenarioDirty = !!openScenario && !!current && (openScenario.focus !== current.focus || openScenario.landing !== current.landing || openScenario.slipDays !== current.slipDays || openScenario.sites.join('|') !== current.sites.join('|'))
  const saveScenario = () => {
    if (!active || !current) return
    const kind = kindOf(current, active.scenarios[0])
    const sc: SavedScenario = { id: uid(), name: autoName(kind, current), kind, ...current }
    storeMissions(missions.map((x) => (x.id === active.id ? { ...x, scenarios: [...x.scenarios, sc], updated: new Date().toISOString() } : x)))
    setScenarioId(sc.id)
    setToast(t.ms.saved(sc.name))
  }
  // Free exploration: put what is on screen into any mission, without switching to it.
  const addToMission = (m: MissionDef) => {
    if (!current) return
    const kind = kindOf(current, m.scenarios[0])
    const sc: SavedScenario = { id: uid(), name: autoName(kind, current), kind, ...current }
    storeMissions(missions.map((x) => (x.id === m.id ? { ...x, scenarios: [...x.scenarios, sc], updated: new Date().toISOString() } : x)))
    setToast(t.ms.addedTo(m.name))
  }
  const addToNewMission = () => {
    pendingScenario.current = current
    setMissionsStartNew((k) => k + 1)
    setMissionsOpen(true)
  }
  const updateScenario = () => {
    if (!active || !current || !openScenario) return
    // The baseline stays the baseline; the others are typed again against it.
    const isBase = active.scenarios[0]?.id === openScenario.id
    const kind = isBase ? 'baseline' : kindOf(current, active.scenarios[0])
    // A name the tool made follows the new dates; a name the user wrote stays.
    const name = openScenario.name === autoName(openScenario.kind, openScenario) ? autoName(kind, current) : openScenario.name
    patchScenario(active.id, openScenario.id, { ...current, kind, name })
    setToast(t.ms.updated(name))
  }
  // A mission's report: every scenario recomputed with the current data, plus the best landing days at
  // its baseline site, as one readable HTML file to keep or print to PDF.
  const downloadReport = (m: MissionDef) => {
    if (!ready) return
    const rows: ReportRow[] = m.scenarios.map((sc) => {
      const site = resolveSite(sc.focus)
      const landing = new Date(sc.landing)
      const from = landing.getTime() + sc.slipDays * 86400000
      if (!site || Number.isNaN(from) || from < DATA.start.getTime() || from + m.durationDays * 86400000 > DATA.end.getTime()) return { sc, siteName: site ? siteName(site) : undefined }
      const params = applyMission(m, { ...mission, landing, slipDays: sc.slipDays })
      const samples = simulate(site, params)
      return { sc, site, siteName: siteName(site), params, samples, m: cautious(site, metrics(samples, params)) }
    })
    const baseRow = rows.find((x) => x.site && x.sc.kind === 'baseline') ?? rows.find((x) => x.site)
    const plan = baseRow?.site ? landingCalendar(baseRow.site, m.durationDays, m.minAntennaElevDeg, m.req, m.survivalPowerW, m.batteryWh || undefined) : undefined
    const status = !m.scenarios.length ? 'draft' : rows.every((x) => x.m?.verdict === 'viable') ? 'planned' : 'at-risk'
    const html = missionReportHtml({
      mission: m,
      status,
      rows,
      plan: plan && baseRow?.site && disagrees(baseRow.site) ? plan.map((d) => ({ ...d, hours: d.hours.map((v) => (v === 'viable' ? 'marginal' : v)) })) : plan,
      planSite: baseRow?.siteName,
      t,
      fmt: { num, date: fmtDate, dateTime: fmtDateTime },
      dataStart: DATA.start,
      dataEnd: DATA.end,
      appUrl: window.location.origin + window.location.pathname,
    })
    const slug = m.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'mission'
    const file = `${slug}-report-${new Date().toISOString().slice(0, 10)}.html`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = file
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast(t.rp.downloaded(file))
  }
  const evaluateScenario = (m: MissionDef, sc: SavedScenario): Evaluated => {
    if (!ready) return null
    const site = resolveSite(sc.focus)
    const landing = new Date(sc.landing)
    const from = landing.getTime() + sc.slipDays * 86400000
    if (!site || Number.isNaN(from) || from < DATA.start.getTime() || from + m.durationDays * 86400000 > DATA.end.getTime()) return null
    const mp = applyMission(m, { ...mission, landing, slipDays: sc.slipDays })
    return { site: siteName(site), when: fmtDate(new Date(from)), m: cautious(site, metrics(simulate(site, mp), mp)) }
  }

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
  // Mission values edited from the card or the time bar: with a mission open, they are saved to it too.
  const setMissionValue = (k: 'durationDays' | 'survivalPowerW' | 'minAntennaElevDeg' | 'batteryWh', v: number) => {
    set(k, k === 'batteryWh' ? v || undefined : v)
    if (active) storeMissions(missions.map((x) => (x.id === active.id ? { ...x, [k]: v, updated: new Date().toISOString() } : x)))
  }
  const field = 'min-h-11 w-full rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-ink'
  const ghost = 'min-h-11 rounded-sm border border-white/25 px-4 hover:bg-white/10'
  const seg = (on: boolean) => `min-h-11 px-3 text-sm ${on ? 'bg-ink font-semibold text-paper' : 'hover:bg-white/10'}`

  const moonSites = useMemo(() => {
    // The five sites stay on the Moon at all times (picking one used to hide the others), plus any
    // own coordinates added to the list.
    const list = [...catalogue.map((c) => c.site), ...results.map((r) => r.site).filter((s) => !catalogue.some((c) => c.site.id === s.id))]
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
        <MoonScene compactControls={!!panel} mode={splashDone ? 'app' : 'intro'} sites={moonSites} showLabels={moonLabels} focusId={picking ? undefined : focused?.site.id} onPick={pick} info={moonInfo} dive={diving} sunAt={sunAt} earth={earthAt} onStreet={(id) => { pick(id); openStreet() }} streetLabel={t.streetView} answerLabel={t.seeAnswer} heat={heat} controls={{ zoomIn: t.zoomIn, zoomOut: t.zoomOut, recenter: t.recenter, earth: t.viewEarth, fromEarth: t.viewFromEarth, hd: t.viewHd, layer: t.lightLayer, layerOn: lightOn, layerBusy: lightBusy, onLayer: () => setLightOn((o) => !o) }} frameRef={frameRef} onFail={() => {
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
            <button onClick={() => setPicking(true)} aria-label={t.findTitle} className="min-h-11">
              <Logo />
            </button>
          </div>
          {/* Quick date and hour: the Moon's light and shadows follow it. A second line on phones. */}
          {splashDone && ready && (
            <div className="order-last min-w-0 basis-full lg:order-none lg:ml-auto lg:max-w-2xl lg:flex-1 lg:basis-auto">
              <TimeBar start={start} min={DATA.start} max={DATA.end} stay={mission.durationDays} index={focused ? (playIdx ?? 0) : freeHour} sunHours={focused?.samples.map((x) => x.sunVisible)} plan={plan} label={fmtDateTime} onStart={setStart} onStay={(n) => setMissionValue('durationDays', n)} onScrub={scrub} />
            </div>
          )}
          {/* Settings and actions: a gear in the top right corner. */}
          <div className="ml-auto lg:ml-0">
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
                        { label: t.ms.title, onSelect: () => setMissionsOpen(true) },
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
          </div>
        </header>

        <div className="relative min-h-0 flex-1 lg:flex lg:gap-3 lg:px-3 lg:pb-3">
          {/* Phones: a dimmed backdrop behind the pop-up; tapping it closes the card. */}
          {cardOpen && <div className="ui-fade pointer-events-auto fixed inset-0 z-30 bg-black/55 sm:hidden" onClick={() => setCardOpen(false)} aria-hidden="true" />}
          {/* The guided card: find a site, then the answer. A drawer on the left at every size: over the
              Moon on phones, beside it from tablets up. A slim tab on its edge folds it; on phones a swipe
              to the left does too. */}
          <div
            className={`pointer-events-auto fixed inset-x-3 inset-y-0 z-40 m-auto h-fit max-w-[440px] sm:absolute sm:inset-x-auto sm:left-0 sm:z-20 sm:m-0 sm:h-auto sm:w-[380px] sm:max-w-none lg:relative lg:z-auto lg:w-[400px] lg:shrink-0 ${cardOpen ? 'drawer-in' : cardStay.value ? 'drawer-out' : 'hidden'}`}
            role={isPhone ? 'dialog' : undefined}
            aria-modal={isPhone ? true : undefined}
            onTouchStart={(e) => {
              const p = e.touches[0]
              swipe.current = { x: p.clientX, y: p.clientY }
            }}
            onTouchEnd={(e) => {
              const p = e.changedTouches[0]
              const st = swipe.current
              swipe.current = null
              if (st && st.x - p.clientX > 70 && Math.abs(p.clientY - st.y) < 50) setCardOpen(false)
            }}
          >
          <section className="glass max-h-[82dvh] overflow-y-auto overscroll-contain rounded-xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:h-full sm:max-h-none sm:rounded-l-none sm:rounded-r-xl lg:rounded-none lg:p-5">
            {/* Phones: the pop-up's close button, always in reach at the top right. */}
            <div className="sticky top-0 z-10 -mx-1 -mt-1 flex justify-end sm:hidden">
              <button type="button" onClick={() => setCardOpen(false)} aria-label={t.closePanel} title={t.closePanel} className="flex size-10 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white backdrop-blur hover:bg-white/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
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
                <div className="flex flex-wrap items-center gap-2 border border-white/10 bg-black/30 px-2.5 py-2 text-xs">
                  {active ? (
                    <>
                      <span className="text-muted">{t.ms.missionLabel}</span>
                      <button type="button" onClick={leaveMission} aria-label={t.ms.leave} title={t.ms.leave} className="-mx-1 px-1 text-muted hover:text-ink">×</button>
                      <button type="button" onClick={() => setMissionsOpen(true)} className="min-w-0 truncate text-sm font-semibold text-ink underline-offset-4 hover:underline">{active.name}</button>
                      {openScenario ? (
                        <>
                          <span className="basis-full text-muted sm:basis-auto">
                            · {t.ms.scenario}: <b className="font-semibold text-ink">{openScenario.name}</b>
                          </span>
                          <span className="ml-auto flex gap-1.5">
                            {scenarioDirty ? (
                              <button type="button" onClick={updateScenario} className="min-h-9 rounded-sm bg-sun px-2.5 font-semibold text-black hover:brightness-110">{t.ms.update}</button>
                            ) : (
                              <span className="flex min-h-9 items-center px-1 text-ok">{t.ms.upToDate}</span>
                            )}
                            <button type="button" onClick={saveScenario} className="min-h-9 rounded-sm border border-sun/70 px-2.5 font-semibold text-sun hover:bg-sun/10">{t.ms.saveNew}</button>
                          </span>
                        </>
                      ) : (
                        <button type="button" onClick={saveScenario} className="ml-auto min-h-9 rounded-sm border border-sun/70 px-2.5 font-semibold text-sun hover:bg-sun/10">{t.ms.saveScenario}</button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-muted">{t.ms.noActive}</span>
                      <details className="relative ml-auto">
                        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-sm border border-sun/70 px-2.5 font-semibold text-sun hover:bg-sun/10">
                          {t.ms.addTo}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                        </summary>
                        <div className="absolute right-0 z-30 mt-1 w-56 border border-white/15 bg-black/90 py-1 shadow-xl backdrop-blur-md">
                          {missions.map((m) => (
                            <button key={m.id} type="button" onClick={(e) => { addToMission(m); e.currentTarget.closest('details')?.removeAttribute('open') }} className="block min-h-10 w-full truncate px-3 text-left hover:bg-white/10">
                              {m.name}
                            </button>
                          ))}
                          <button type="button" onClick={(e) => { addToNewMission(); e.currentTarget.closest('details')?.removeAttribute('open') }} className="block min-h-10 w-full border-t border-white/10 px-3 text-left text-sun hover:bg-white/10">
                            + {t.ms.new}…
                          </button>
                          <button type="button" onClick={(e) => { setMissionsOpen(true); e.currentTarget.closest('details')?.removeAttribute('open') }} className="block min-h-10 w-full px-3 text-left text-muted hover:bg-white/10">
                            {t.ms.manage}
                          </button>
                        </div>
                      </details>
                    </>
                  )}
                </div>
                {/* Compact card: everything that answers the question and the two main actions fit
                    without scrolling; the rest is folded under "More detail". */}
                <div className="mt-3 flex items-center gap-2.5">
                  <CloseButton label={t.changeSite} onClick={() => setPicking(true)} kind="back" />
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold leading-tight">{siteName(focused.site)}</h1>
                    <p className="truncate text-xs text-muted">
                      {focused.site.lat.toFixed(2)}°, {focused.site.lon.toFixed(2)}° · {fmtDate(start)} – {fmtDate(end)}
                    </p>
                  </div>
                </div>

                <div className={`mt-3 flex items-center gap-2 ${VERDICT_CLS[focused.m.verdict]}`}>
                  <VerdictIcon v={focused.m.verdict} size={24} />
                  <p className="text-lg font-bold leading-tight">{t.verdictLong[focused.m.verdict]}</p>
                </div>
                <p className="mt-1 text-sm text-ink">{reason(focused.m)}</p>
                {active && <p className="mt-1 text-xs text-muted">{t.ms.judgedBy(active.name)}</p>}
                {focused.site.ideal && <p className="mt-1 text-xs text-warn">{t.noTerrain}</p>}
                {disagrees(focused.site) && focused.site.oursSunDays2027 !== undefined && focused.site.published?.['2027'] !== undefined && (
                  <p className="mt-2 flex gap-2 border border-warn/40 bg-warn/10 p-2.5 text-sm text-warn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden="true">
                      <path d="M12 3l9.5 17h-19z" />
                      <path d="M12 10v4.5M12 17.5v.5" />
                    </svg>
                    <span>{t.disagree(num(focused.site.oursSunDays2027, 0), focused.site.published['2027'])}</span>
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-4 gap-1.5">
                  {(
                    [
                      {
                        sub: hrsShort(focused.m.sunlightPct),
                        label: t.tileSun,
                        value: `${num(focused.m.sunlightPct)} %`,
                        fill: focused.m.sunlightPct / 100,
                        bar: 'bg-sun',
                        tone: focused.m.sunlightPct >= req.minSunPct ? 'ok' : focused.m.sunlightPct >= (req.minSunPct * 2) / 3 ? 'warn' : 'bad',
                        ticks: [(req.minSunPct * 2) / 300, req.minSunPct / 100],
                        was: slipped && Math.round(focused.m.sunlightPct) !== Math.round(focused.base.sunlightPct) ? t.was(`${num(focused.base.sunlightPct)} %`) : '',
                      },
                      {
                        sub: hrsShort(focused.m.earthLinkPct),
                        label: t.tileEarth,
                        value: `${num(focused.m.earthLinkPct)} %`,
                        fill: focused.m.earthLinkPct / 100,
                        bar: 'bg-earth',
                        tone: focused.m.earthLinkPct >= req.minEarthPct ? 'ok' : 'warn',
                        ticks: [req.minEarthPct / 100],
                        was: slipped && Math.round(focused.m.earthLinkPct) !== Math.round(focused.base.earthLinkPct) ? t.was(`${num(focused.base.earthLinkPct)} %`) : '',
                      },
                      {
                        sub: hrsShort(focused.m.opsPct),
                        label: t.tileBoth,
                        value: `${num(focused.m.opsPct)} %`,
                        fill: focused.m.opsPct / 100,
                        bar: 'bg-[rgb(120,190,255)]',
                        tone: null,
                        ticks: [],
                        was: slipped && Math.round(focused.m.opsPct) !== Math.round(focused.base.opsPct) ? t.was(`${num(focused.base.opsPct)} %`) : '',
                      },
                      {
                        sub: t.ofStay(num((100 * focused.m.longestNightH) / stayH)),
                        label: t.tileDark,
                        value: fmtDuration(focused.m.longestNightH),
                        fill: Math.min(focused.m.longestNightH / (req.maxDarkH * 4 || 96), 1),
                        bar: focused.m.longestNightH <= req.maxDarkH ? 'bg-ok' : focused.m.longestNightH <= req.maxDarkH * 3 ? 'bg-warn' : 'bg-bad',
                        tone: focused.m.longestNightH <= req.maxDarkH ? 'ok' : focused.m.longestNightH <= req.maxDarkH * 3 ? 'warn' : 'bad',
                        ticks: req.maxDarkH > 0 ? [0.25, 0.75] : [],
                        was: slipped && focused.m.longestNightH !== focused.base.longestNightH ? t.was(fmtDuration(focused.base.longestNightH).toLowerCase()) : '',
                      },
                      ...(focused.m.batteryMarginWh !== null && mission.batteryWh
                        ? [
                            {
                              sub: t.ms.batteryNeed(num(mission.survivalPowerW * focused.m.longestNightH)),
                              label: t.ms.batteryLeft,
                              value: `${num(focused.m.batteryMarginWh)} Wh`,
                              fill: Math.max(0, focused.m.batteryMarginWh) / mission.batteryWh,
                              bar: focused.m.batteryMarginWh >= 0 ? 'bg-ok' : 'bg-bad',
                              tone: focused.m.batteryMarginWh >= 0 ? 'ok' : 'bad',
                              ticks: [],
                              was: '',
                            } as const,
                          ]
                        : []),
                    ] as const
                  ).map(({ label, value, sub, fill, bar, tone, ticks, was }) => (
                    <div key={label} className="min-w-0 border border-white/10 bg-black/30 px-2 py-1.5">
                      <dt className="flex items-start justify-between gap-1 text-[11px] leading-tight text-muted">
                        <span className="min-w-0">{label}</span>
                        {tone && <i aria-hidden="true" className={`inline-block size-2 rounded-full ${tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-bad'}`} />}
                      </dt>
                      <dd className="mt-1 text-xl font-bold tabular-nums leading-none">{value}</dd>
                      <dd className="mt-0.5 text-[11px] leading-tight tabular-nums text-white/80">{sub}</dd>
                      <div className="relative mt-1.5 h-1 bg-white/10" role="presentation">
                        <div className={`h-full ${bar} transition-[width] duration-500`} style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }} />
                        {ticks.map((x) => (
                          <span key={x} className="absolute -top-0.5 h-2.5 w-px bg-white/60" style={{ left: `${x * 100}%` }} />
                        ))}
                      </div>
                      <Was show={!!was} text={was} />
                    </div>
                  ))}
                </dl>
                <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={openStreet}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-sm bg-sun px-2 text-sm font-semibold text-black hover:brightness-110"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="5" r="2.2" />
                    <path d="M12 8v6M9 21l3-7 3 7M8.5 11.5h7" />
                    <path d="M3 18.5c2.2-1 5.4-1.6 9-1.6s6.8.6 9 1.6" />
                  </svg>
                  {t.streetShort}
                </button>
                <button onClick={simulateLanding} className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-sun/70 bg-black/30 px-2 text-sm font-semibold text-sun hover:bg-sun/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 4h8l2 6H6l2-6z" />
                    <path d="M7 10l-3 9M17 10l3 9M12 10v5M9 20h6M2.5 19h3M18.5 19h3" />
                  </svg>
                  {t.simShort}
                </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ['sky', t.seeSky],
                      ['when', t.bestDates],
                      ['compare', t.compare],
                    ] as const
                  ).map(([id, label]) => (
                    <button key={id} onClick={() => setPanel(panel === id ? null : id)} aria-pressed={panel === id} className={`min-h-10 rounded-sm px-2 text-sm font-semibold ${panel === id ? 'bg-sun text-black' : 'bg-white/10 hover:bg-white/15'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <details className="mt-3 border-t border-white/10 pt-1">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 font-semibold">
                    <span>{t.moreDetail}</span>
                    <span className="text-xs font-normal text-muted">{t.moreDetailHint}</span>
                  </summary>
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

                {focused.site.published && focused.site.published['2027'] !== undefined && (
                  <p className="mt-2 border-l-2 border-white/25 pl-3 text-sm text-muted">{t.publishedRef(focused.site.published['2027'])}</p>
                )}
                {focused.site.team && (
                  <p className="mt-2 border-l-2 border-sun/60 pl-3 text-sm text-muted">{focused.site.team.hypothesis[lang]}</p>
                )}
                </details>
                <details className="border-t border-white/10 pt-1" open={slipped || undefined}>
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
                      <p className={`border-l-2 pl-2 text-xs ${active ? 'border-sun/60 text-white/85' : 'border-white/25 text-muted'}`}>{active ? t.ms.valuesOf(active.name) : t.ms.valuesFree}</p>
                      <label>
                        {t.ms.battery}
                        <NumberField min={0} max={1e7} step={100} value={mission.batteryWh ?? 0} onValue={(v) => setMissionValue('batteryWh', v)} className={`mt-1 ${field}`} />
                      </label>
                      <label>
                        {t.survivalPower}
                        <NumberField min={0} max={1e6} value={mission.survivalPowerW} onValue={(v) => setMissionValue('survivalPowerW', v)} className={`mt-1 ${field}`} />
                      </label>
                      <label>
                        {t.antennaAngle}
                        <NumberField min={0} max={30} step={0.5} value={mission.minAntennaElevDeg} onValue={(v) => setMissionValue('minAntennaElevDeg', v)} className={`mt-1 ${field}`} />
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
          <button
            type="button"
            onClick={() => setCardOpen(false)}
            aria-label={t.hidePanel}
            title={t.hidePanel}
            className="glass absolute -right-5 top-1/2 hidden h-14 w-5 -translate-y-1/2 items-center justify-center rounded-r-md border-l-0 text-white/70 hover:text-white sm:flex"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          </div>

          {/* Free area: the 3D Moon frames the south pole here. */}
          <div className={`pointer-events-none absolute inset-0 flex flex-col lg:static lg:min-w-0 lg:flex-1 ${cardOpen ? 'sm:left-[380px]' : ''}`}>
            <div ref={frameRef} className="relative min-h-0 flex-1">
              {splashDone && moonOk && !panel && !lightOn && <p className={`absolute inset-x-0 hidden text-center text-xs text-white/60 lg:block ${focused && !picking && !skyOpen && !skyStay.value ? 'bottom-16' : 'bottom-2'}`}>{t.dragHint}</p>}
              {/* Desktop: the sky curves button, centred at the very bottom of the Moon's area. */}
                {focused && !picking && panel !== 'sky' && !skyOpen && !skyStay.value && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 hidden justify-center lg:flex">
                  <button onClick={() => setSkyOpen(true)} className="ui-in glass pointer-events-auto flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold hover:bg-white/10">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 18c3-7 6-10 9-10s6 3 9 10" /><path d="M3 21h18" /><circle cx="12" cy="8" r="1.6" fill="currentColor" /></svg>
                    {t.skyCurves}
                  </button>
                </div>
              )}

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
            {/* The main card, folded: a small pill at the top left brings it back. */}
          {!cardOpen && !cardStay.value && (
            <button
              onClick={() => setCardOpen(true)}
              aria-label={t.showPanel}
              className="drawer-in glass pointer-events-auto absolute left-4 top-2 z-20 flex min-h-8 max-w-[min(62vw,320px)] items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 text-xs font-semibold sm:top-3 sm:min-h-10 sm:gap-2 sm:py-1.5 sm:pl-3 sm:pr-3 sm:text-sm lg:left-3"
            >
              {focused && !picking ? (
                <>
                  <i className="inline-block size-2 shrink-0 rounded-full sm:size-2.5" style={{ background: VERDICT_HEX[focused.m.verdict] }} />
                  <span className="truncate">{siteName(focused.site)}</span>
                  <span className={`hidden shrink-0 text-xs sm:inline ${VERDICT_CLS[focused.m.verdict]}`}>{t.verdictLong[focused.m.verdict]}</span>
                </>
              ) : (
                <span>{t.chooseSiteShort}</span>
              )}
              <span className="shrink-0 text-muted"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></span>
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

      <Overlay open={missionsOpen} title={t.ms.title} onClose={() => { setMissionsOpen(false); pendingScenario.current = null }}>
        <Missions key={missionsStartNew} startNew={missionsStartNew > 0 && pendingScenario.current !== null} missions={missions} activeId={activeId} evaluate={evaluateScenario} num={num} onSave={saveMissionDef} onDelete={deleteMission} onOpen={openMission} onDeleteScenario={deleteScenario} onRenameScenario={(mid, sid, name) => patchScenario(mid, sid, { name })} onReport={downloadReport} openScenarioId={scenarioId} />
      </Overlay>
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
