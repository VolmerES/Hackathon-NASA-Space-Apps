// Written with Claude Code (Claude Opus 5.5) from the team's spec (paquete_crear_mision_v2); reviewed by <name>
// Live mission report: from where, when and how long the mission lands, it works out the energy the
// battery must deliver through the longest night (and its mass), the darkest day, the longest time
// without Earth, what happens inside the Artemis III landing accuracy of 100 m (the landing grid of
// elipse.json, each point with its own LOLA horizon) and how the other team sites compare on the same
// dates. Every default comes from a NASA source, listed at the foot. All in the browser, recomputed on
// every change: about 90 sites × 14 days × 24 h, well under 0.1 s.
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ARTEMIS3, DATA, SITES, SOURCES, SPACE_BATTERY_WH_PER_KG, VIPER_BATTERY_WH, batteryMassKg, gridReady, gridSites, loadGrid, metrics, moonDistanceKm, overview, simulate, type GridSite, type Metrics, type Site, DSN_STATIONS } from '../data/model'
import { useT } from '../i18n'
import { missionParams, type MissionDef } from '../missions'

const RINGS = [ARTEMIS3.landingAccuracyM, 2 * ARTEMIS3.landingAccuracyM]
const TXT: Record<Metrics['verdict'], string> = { viable: 'text-ok', marginal: 'text-warn', 'not-viable': 'text-bad' }
const FILL: Record<Metrics['verdict'], string> = { viable: '#3fcf8e', marginal: '#f2a93b', 'not-viable': '#ff5a6a' }
const flatEnough = (p: GridSite) => p.slope < ARTEMIS3.maxLandingSlopeDeg

type Point = { p: GridSite; m: Metrics }

function compute(d: MissionDef, site: Site) {
  const mission = missionParams(d)
  const main = metrics(simulate(site, mission), mission)
  const days = overview(site, mission.landing, d.durationDays, d.minAntennaElevDeg)
  const darkest = days.length ? days.reduce((a, b) => (b.sun < a.sun ? b : a)) : null
  const grid: Point[] = gridSites(site.id).map((p) => ({ p, m: metrics(simulate(p, mission), mission) }))
  const rings = RINGS.map((r) => {
    const pts = grid.filter((x) => x.p.distM <= r + 1e-6)
    if (!pts.length) return null
    const v = (f: (x: Point) => number) => pts.map(f)
    const sun = v((x) => x.m.sunlightPct)
    const earth = v((x) => x.m.earthLinkPct)
    const worst = pts.reduce((a, b) => (b.m.longestNightH > a.m.longestNightH ? b : a))
    return {
      r,
      sun: [Math.min(...sun), Math.max(...sun)],
      earth: [Math.min(...earth), Math.max(...earth)],
      night: worst.m.longestNightH,
      energy: Math.max(...v((x) => x.m.nightEnergyWh)),
      slope: Math.max(...v((x) => x.p.slope)),
    }
  })
  // Best spot within the Artemis III accuracy: under 10 deg over 100 m, most hours with the Sun and
  // Earth together, then the shortest night.
  const best = grid
    .filter((x) => x.p.distM <= ARTEMIS3.landingAccuracyM + 1e-6 && flatEnough(x.p))
    .sort((a, b) => b.m.opsPct - a.m.opsPct || a.m.longestNightH - b.m.longestNightH)[0]
  const others = SITES.filter((s) => s.team && s.id !== site.id)
    .map((s) => ({ s, km: moonDistanceKm(site, s), m: metrics(simulate(s, mission), mission) }))
    .sort((a, b) => a.km - b.km)
  const end = mission.landing.getTime() + d.durationDays * 86400000
  return { mission, main, darkest, grid, rings, best, others, pastData: end > DATA.end.getTime() }
}

/** A numbered link to one of the NASA sources. */
function Src({ n }: { n: number }) {
  const s = SOURCES[n - 1]
  return (
    <a href={s.url} target="_blank" rel="noreferrer" title={s.title} className="ml-0.5 align-super text-[10px] text-nasa-blue no-underline hover:underline">
      [{n}]
    </a>
  )
}

export function MissionReport({ def, onUseSpot }: { def: MissionDef; onUseSpot?: (id: string, def: MissionDef) => void }) {
  const t = useT()
  const ms = t.ms
  const [gridTick, setGridTick] = useState(() => (gridReady() ? 1 : 0))
  useEffect(() => {
    if (!gridReady()) loadGrid().then(() => setGridTick((n) => n + 1))
  }, [])
  // Typing in the form stays smooth: the report follows a moment later.
  const d = useDeferredValue(def)
  const site = SITES.find((s) => s.id === d.site)
  const landingOk = Number.isFinite(Date.parse(d.landing))
  const res = useMemo(
    () => (DATA.ready && site && landingOk ? compute(d, site) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, site, landingOk, gridTick],
  )

  const num = (n: number, digits = 0) => n.toLocaleString(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const kwh = (wh: number) => `${num(wh / 1000, 1)} kWh`
  const kg = (wh: number) => {
    const [a, b] = batteryMassKg(wh)
    return `${num(a)}–${num(b)} kg`
  }
  const date = (x: Date) => x.toLocaleDateString(t.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const dateTime = (x: Date) => `${date(x)}, ${x.toISOString().slice(11, 16)}`
  const hours = (h: number) => `${num(h)} h`
  const range = (a: number[]) => (Math.round(a[0]) === Math.round(a[1]) ? `${num(a[0])} %` : `${num(a[0])}–${num(a[1])} %`)

  if (!res || !site) return <p className="text-sm text-muted">{ms.reportNA}</p>
  const { mission, main, darkest, grid, rings, best, others, pastData } = res
  const dod = mission.dod ?? 1
  const eta = mission.eta ?? 1
  const margins = dod < 1 || eta < 1
  const within = rings[0]
  const card = 'rounded-sm border border-white/10 bg-black/30 p-3'
  const h4 = 'mb-2 text-sm font-semibold text-white'

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted">{ms.reportLive(site.name, dateTime(mission.landing), d.durationDays)}</p>
      {pastData && <p className="text-xs text-warn">{ms.outOfData(date(DATA.end))}</p>}

      {/* a) Energy */}
      <section className={card}>
        <h4 className={h4}>{ms.sEnergy}</h4>
        {main.longestNightH > 0 && main.longestNightStart && main.longestNightEnd ? (
          <p>{ms.longestNightFrom(hours(main.longestNightH), dateTime(main.longestNightStart), dateTime(main.longestNightEnd))}</p>
        ) : (
          <p>{ms.noNight}</p>
        )}
        <p className="mt-2">
          <span className="font-semibold">{ms.nightEnergy}: {kwh(main.nightEnergyWh)}</span>
          <span className="mt-0.5 block text-xs tabular-nums text-muted">
            {num(d.survivalPowerW, d.survivalPowerW % 1 ? 1 : 0)} W × {num(main.longestNightH)} h = {kwh(main.nightEnergyWh)}
          </span>
        </p>
        {margins && (
          <p className="mt-1">
            {ms.withMargins}: <span className="font-semibold">{kwh(main.requiredBatteryWh)}</span>
            <span className="ml-1 text-xs tabular-nums text-muted">
              = {kwh(main.nightEnergyWh)} ÷ ({num(dod, 2)} × {num(eta, 2)})
            </span>
          </p>
        )}
        {main.nightEnergyWh > 0 && (
          <p className="mt-1">
            {ms.batteryMass(`${SPACE_BATTERY_WH_PER_KG[0]}–${SPACE_BATTERY_WH_PER_KG[1]}`, kg(main.requiredBatteryWh))}
            <Src n={5} />
          </p>
        )}
        <p className="mt-1 text-muted">
          {ms.viperRef(kwh(VIPER_BATTERY_WH))}
          <Src n={4} />
        </p>
        {d.batteryWh > 0 && main.batteryMarginWh !== null ? (
          <p className={`mt-1 ${main.batteryMarginWh >= 0 ? 'text-ok' : 'text-bad'}`}>{ms.batteryYours(kwh(d.batteryWh), (main.batteryMarginWh >= 0 ? '+' : '−') + kwh(Math.abs(main.batteryMarginWh)))}</p>
        ) : (
          <p className="mt-1 text-muted">{ms.sizedForYou}</p>
        )}
        {darkest && <p className="mt-2">{ms.darkestDay(date(darkest.t), num(darkest.sun * 24))}</p>}
      </section>

      {/* b) Communications */}
      <section className={card}>
        <h4 className={h4}>{ms.sComms}</h4>
        {main.longestNoEarthH > 0 && main.longestNoEarthStart ? <p>{ms.noEarthFrom(hours(main.longestNoEarthH), dateTime(main.longestNoEarthStart))}</p> : <p>{ms.noEarthNone}</p>}
        <p className="mt-1 text-muted">{ms.earthShare(num(main.earthLinkPct), DSN_STATIONS.map((st, k) => `${st.name} ${num(main.stationPct[k])} %`).join(' · '))}</p>
        {main.noEarthExceeded && <p className="mt-2 text-bad">{ms.noEarthFail}</p>}
      </section>

      {/* c) Landing accuracy (Artemis III: within 100 m) */}
      <section className={card}>
        <h4 className={h4}>
          {ms.accuracy}
          <Src n={1} />
        </h4>
        {!grid.length ? (
          <p className="text-muted">{gridTick ? ms.noGrid : ms.loadingGrid}</p>
        ) : (
          <>
            {within && within.night > main.longestNightH && (
              <p className="mb-2">{ms.worse100(hours(within.night), kwh(within.energy), within.energy > VIPER_BATTERY_WH ? ms.moreThanViper : '', kg(within.energy))}</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-xs tabular-nums">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 pr-2 font-normal">{ms.colWithin}</th>
                    <th className="py-1 pr-2 font-normal">{ms.colSun}</th>
                    <th className="py-1 pr-2 font-normal">{ms.colEarth}</th>
                    <th className="py-1 pr-2 font-normal">{ms.colNight}</th>
                    <th className="py-1 pr-2 font-normal">{ms.colEnergyWorst}</th>
                    <th className="py-1 pr-2 font-normal">{ms.colSlope100}</th>
                  </tr>
                </thead>
                <tbody>
                  {rings.map(
                    (g, i) =>
                      g && (
                        <tr key={g.r} className="border-t border-white/10">
                          <td className="py-1.5 pr-2">
                            <span className="font-semibold">{g.r} m</span>
                            <span className="block text-muted">{i === 0 ? ms.ringReq : ms.ringWorse}</span>
                          </td>
                          <td className="py-1.5 pr-2">{range(g.sun)}</td>
                          <td className="py-1.5 pr-2">{range(g.earth)}</td>
                          <td className="py-1.5 pr-2">{hours(g.night)}</td>
                          <td className="py-1.5 pr-2">{kwh(g.energy)}</td>
                          <td className={`py-1.5 pr-2 ${g.slope < ARTEMIS3.maxLandingSlopeDeg ? 'text-ok' : 'text-bad'}`}>
                            {num(g.slope, 1)}° {g.slope < ARTEMIS3.maxLandingSlopeDeg ? '✓' : '✗'}
                          </td>
                        </tr>
                      ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-start gap-4">
              <GridMap grid={grid} best={best?.p} label={ms.mapLabel} />
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-semibold">{ms.bestSpot}</p>
                {best ? (
                  <>
                    <p className="mt-1">{best.p.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {ms.bestSpotLine(num(best.m.opsPct), num(best.m.sunlightPct), num(best.m.earthLinkPct), hours(best.m.longestNightH), num(best.p.slope, 1))}
                    </p>
                    {onUseSpot && (
                      <button type="button" onClick={() => onUseSpot(best.p.id, d)} className="mt-2 min-h-10 rounded-sm border border-sun/60 px-3 text-xs font-semibold text-sun hover:bg-sun/10">
                        {ms.useSpot}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-muted">{ms.noBestSpot}</p>
                )}
                <p className="mt-3 text-[11px] text-muted">{ms.accuracyNote}</p>
              </div>
            </div>
          </>
        )}
      </section>

      {/* d) Other team sites */}
      <section className={card}>
        <h4 className={h4}>{ms.otherSites}</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-xs tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-2 font-normal">{ms.colSite}</th>
                <th className="py-1 pr-2 font-normal">{ms.colDist}</th>
                <th className="py-1 pr-2 font-normal">{ms.verdict}</th>
                <th className="py-1 pr-2 font-normal">{ms.colSun}</th>
                <th className="py-1 pr-2 font-normal">{ms.colEarth}</th>
                <th className="py-1 pr-2 font-normal">{t.longestDarkness}</th>
                <th className="py-1 pr-2 font-normal">{ms.colEnergy}</th>
              </tr>
            </thead>
            <tbody>
              {others.map(({ s, km, m }) => (
                <tr key={s.id} className="border-t border-white/10">
                  <td className="py-1.5 pr-2 font-semibold">{s.name}</td>
                  <td className="py-1.5 pr-2">{num(km)} km</td>
                  <td className={`py-1.5 pr-2 font-semibold ${TXT[m.verdict]}`}>{t.verdictLong[m.verdict]}</td>
                  <td className="py-1.5 pr-2">{num(m.sunlightPct)} %</td>
                  <td className="py-1.5 pr-2">{num(m.earthLinkPct)} %</td>
                  <td className="py-1.5 pr-2">{hours(m.longestNightH)}</td>
                  <td className="py-1.5 pr-2">{kwh(m.nightEnergyWh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* e) Fixed note and the sources */}
      <div className="border-l-2 border-sun/60 pl-3 text-[11px] leading-relaxed text-muted">
        <p>{ms.estimateNote}</p>
        <p className="mt-2 font-semibold text-white/80">{ms.sources}</p>
        <ol className="mt-1 space-y-0.5">
          {SOURCES.map((s) => (
            <li key={s.n}>
              [{s.n}]{' '}
              <a href={s.url} target="_blank" rel="noreferrer" className="text-nasa-blue underline underline-offset-2">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// The grid round the site, north up: each point coloured by its verdict, circles at 100 m (Artemis III)
// and 200 m, the site in the centre and the best spot ringed in gold. Points at 10 deg or more over
// 100 m are crossed.
function GridMap({ grid, best, label }: { grid: Point[]; best?: GridSite; label: string }) {
  const S = 200 // half side in metres
  const C = 10 // cell size in px per 40 m
  const px = (m: number) => ((m + S) / 40) * C + C / 2
  const W = ((2 * S) / 40) * C + C
  return (
    <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} role="img" aria-label={label} className="shrink-0 rounded-sm bg-black/50">
      <title>{label}</title>
      {grid.map(({ p, m }) => (
        <g key={p.id}>
          <rect x={px(p.e) - C / 2 + 0.5} y={px(-p.n) - C / 2 + 0.5} width={C - 1} height={C - 1} fill={FILL[m.verdict]} fillOpacity={0.85}>
            <title>{`${p.name}: ${Math.round(m.sunlightPct)} % sun, ${Math.round(m.earthLinkPct)} % Earth, ${m.longestNightH} h night, ${p.slope}° over 100 m`}</title>
          </rect>
          {!flatEnough(p) && <path d={`M${px(p.e) - 3} ${px(-p.n) - 3} L${px(p.e) + 3} ${px(-p.n) + 3}`} stroke="#000" strokeWidth="1.2" />}
        </g>
      ))}
      {RINGS.map((r, i) => (
        <circle key={r} cx={px(0)} cy={px(0)} r={(r / 40) * C} fill="none" stroke="#fff" strokeOpacity={i === 0 ? 0.85 : 0.45} strokeWidth={i === 0 ? 1.4 : 1} strokeDasharray={i === 0 ? undefined : '2 2'} />
      ))}
      <circle cx={px(0)} cy={px(0)} r="2.2" fill="#fff" />
      {best && <rect x={px(best.e) - C / 2 - 1} y={px(-best.n) - C / 2 - 1} width={C + 2} height={C + 2} fill="none" stroke="#f2b705" strokeWidth="2" />}
      <text x={W / 2} y="8" textAnchor="middle" fontSize="8" fill="#fff" fillOpacity="0.7">N</text>
    </svg>
  )
}
