// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
// Mission report: one self-contained HTML file, readable in any browser and printable to PDF. Every
// figure is computed here from the same model as the app (JPL Horizons ephemerides, LRO LOLA horizons):
// nothing is typed by hand and nothing is written by AI.
import type { DayPlan, Metrics, Mission, Sample, Site } from './data/model'
import type { Strings } from './i18n'
import type { MissionDef, SavedScenario } from './missions'

export interface ReportRow {
  sc: SavedScenario
  site?: Site
  siteName?: string
  params?: Mission
  samples?: Sample[]
  m?: Metrics
}

export interface ReportInput {
  mission: MissionDef
  status: 'draft' | 'planned' | 'at-risk'
  rows: ReportRow[]
  /** Landing calendar at the baseline site, for the best days. */
  plan?: DayPlan[]
  planSite?: string
  t: Strings
  fmt: { num: (n: number, d?: number) => string; date: (d: Date) => string; dateTime: (d: Date) => string }
  dataStart: Date
  dataEnd: Date
  appUrl: string
}

const HOUR = 3600000
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
const VERDICT_COLOR = { viable: '#127a4a', marginal: '#a35d00', 'not-viable': '#b3122a' } as const

function badge(v: Metrics['verdict'], t: Strings) {
  return `<span class="badge" style="--c:${VERDICT_COLOR[v]}">${esc(t.verdictLong[v])}</span>`
}

// Longest run of hours without sunlight, with its start and end.
function longestDark(samples: Sample[]) {
  let best = { len: 0, from: -1 }
  let run = 0
  for (let i = 0; i < samples.length; i++) {
    run = samples[i].sunVisible > 0.5 ? 0 : run + 1
    if (run > best.len) best = { len: run, from: i - run + 1 }
  }
  return best
}

// Hours of each kind per day of the stay.
function daily(all: Sample[]) {
  // The last sample is the instant the stay ends: it does not start another day.
  const samples = all.length % 24 === 1 ? all.slice(0, -1) : all
  const days: { day: number; t: Date; sun: number; earth: number; both: number; madrid: number; n: number }[] = []
  samples.forEach((s, i) => {
    const d = Math.floor(i / 24)
    days[d] ??= { day: d + 1, t: s.t, sun: 0, earth: 0, both: 0, madrid: 0, n: 0 }
    const lit = s.sunVisible > 0.5
    days[d].sun += lit ? 1 : 0
    days[d].earth += s.earthVisible ? 1 : 0
    days[d].both += lit && s.earthVisible ? 1 : 0
    days[d].madrid += s.madridLink ? 1 : 0
    days[d].n++
  })
  return days
}

function delta(a: number, b: number, unit: string, num: (n: number, d?: number) => string) {
  const d = a - b
  if (Math.abs(d) < 0.5) return '<span class="muted">=</span>'
  return `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${num(Math.abs(d))} ${unit}</span>`
}

export function missionReportHtml(r: ReportInput): string {
  const { mission: m, t, fmt } = r
  const rp = t.rp
  const num = fmt.num
  const generated = new Date()
  const valid = r.rows.filter((x) => x.m && x.samples && x.params)
  const base = valid.find((x) => x.sc.kind === 'baseline') ?? valid[0]

  // Overview and hardware.
  const overview = `
    <dl class="facts">
      <div><dt>${esc(rp.type)}</dt><dd>${esc(t.ms.types[m.type])}</dd></div>
      <div><dt>${esc(rp.status)}</dt><dd>${esc(t.ms.status[r.status])}</dd></div>
      <div><dt>${esc(rp.duration)}</dt><dd>${esc(t.ms.daysN(m.durationDays))}</dd></div>
      <div><dt>${esc(rp.scenariosCount)}</dt><dd>${r.rows.length}</dd></div>
    </dl>
    ${m.description ? `<h3>${esc(rp.description)}</h3><p>${esc(m.description)}</p>` : ''}
    ${m.objectives ? `<h3>${esc(rp.objectives)}</h3><ul>${m.objectives.split('\n').filter((l) => l.trim()).map((l) => `<li>${esc(l.trim())}</li>`).join('')}</ul>` : ''}`

  const hardware = `
    <table class="kv">
      <tr><th>${esc(t.survivalPower)}</th><td>${num(m.survivalPowerW)} W</td></tr>
      <tr><th>${esc(t.ms.battery)}</th><td>${m.batteryWh > 0 ? `${num(m.batteryWh)} Wh` : esc(rp.notSet)}</td></tr>
      <tr><th>${esc(t.antennaAngle)}</th><td>${num(m.minAntennaElevDeg, 1)}°</td></tr>
      <tr><th>${esc(t.ms.minSun)}</th><td>≥ ${num(m.req.minSunPct)} %</td></tr>
      <tr><th>${esc(t.ms.maxDark)}</th><td>≤ ${num(m.req.maxDarkH)} h</td></tr>
      <tr><th>${esc(t.ms.minEarth)}</th><td>≥ ${num(m.req.minEarthPct)} %</td></tr>
    </table>
    <p class="note">${esc(rp.thresholdsNote(num((m.req.minSunPct * 2) / 3), num(m.req.maxDarkH * 3)))}</p>`

  // All scenarios at a glance.
  const summaryRows = r.rows
    .map((x) => {
      if (!x.m || !x.samples) return `<tr><td><b>${esc(x.sc.name)}</b><br><span class="muted">${esc(t.ms.kinds[x.sc.kind])}</span></td><td colspan="8" class="muted">${esc(t.ms.cannotEvaluate)}</td></tr>`
      const mm = x.m
      return `<tr>
        <td><b>${esc(x.sc.name)}</b><br><span class="muted">${esc(t.ms.kinds[x.sc.kind])}</span></td>
        <td>${esc(x.siteName ?? x.sc.focus)}</td>
        <td>${esc(fmt.dateTime(x.samples[0].t))}</td>
        <td>${badge(mm.verdict, t)}</td>
        <td class="n">${num(mm.sunlightPct)} %</td>
        <td class="n">${num(mm.earthLinkPct)} %</td>
        <td class="n">${num(mm.opsPct)} %</td>
        <td class="n">${num(mm.longestNightH)} h</td>
        <td class="n ${mm.batteryMarginWh !== null && mm.batteryMarginWh < 0 ? 'down' : ''}">${mm.batteryMarginWh === null ? '—' : `${num(mm.batteryMarginWh)} Wh`}</td>
      </tr>`
    })
    .join('')
  const summary = r.rows.length
    ? `<div class="scroll"><table class="grid">
        <thead><tr><th>${esc(t.ms.scenario)}</th><th>${esc(rp.site)}</th><th>${esc(rp.landing)}</th><th>${esc(t.ms.verdict)}</th><th class="n">${esc(t.sunlight)}</th><th class="n">${esc(t.earthContact)}</th><th class="n">${esc(t.both)}</th><th class="n">${esc(t.longestDarkness)}</th><th class="n">${esc(t.ms.batteryLeft)}</th></tr></thead>
        <tbody>${summaryRows}</tbody></table></div>`
    : `<p class="muted">${esc(t.ms.noScenarios)}</p>`

  // One section per scenario.
  const details = valid
    .map((x) => {
      const s = x.samples as Sample[]
      const mm = x.m as Metrics
      const p = x.params as Mission
      const site = x.site as Site
      const end = s[s.length - 1].t
      const ld = longestDark(s)
      const firstSunset = s[0].sunVisible > 0.5 ? s.findIndex((q) => q.sunVisible <= 0.5) : 0
      const firstEarthset = s[0].earthVisible ? s.findIndex((q) => !q.earthVisible) : 0
      const window = s[0].sunVisible > 0.5 && s[0].earthVisible
      const when = (i: number, atLanding: string) => (i < 0 ? esc(rp.never) : i === 0 ? esc(atLanding) : `${esc(fmt.dateTime(s[i].t))} <span class="muted">(${esc(rp.afterH(num(i)))})</span>`)
      const vsBase =
        base && x !== base && base.m
          ? `<h4>${esc(rp.vsBase)}</h4><table class="kv">
              <tr><th>${esc(t.sunlight)}</th><td>${delta(mm.sunlightPct, base.m.sunlightPct, 'pp', num)}</td></tr>
              <tr><th>${esc(t.earthContact)}</th><td>${delta(mm.earthLinkPct, base.m.earthLinkPct, 'pp', num)}</td></tr>
              <tr><th>${esc(t.longestDarkness)}</th><td>${delta(mm.longestNightH, base.m.longestNightH, 'h', num)}</td></tr>
              <tr><th>${esc(t.ms.verdict)}</th><td>${badge(base.m.verdict, t)} → ${badge(mm.verdict, t)}</td></tr>
            </table>`
          : ''
      const days = daily(s)
        .map((d) => `<tr><td>${d.day}</td><td>${esc(fmt.date(d.t))}</td><td class="n">${d.sun} h</td><td class="n">${d.earth} h</td><td class="n">${d.both} h</td><td class="n">${d.madrid} h</td><td class="bar"><span style="width:${(100 * d.sun) / d.n}%"></span></td></tr>`)
        .join('')
      return `
      <section class="scenario">
        <h3>${esc(x.sc.name)} ${badge(mm.verdict, t)}</h3>
        <table class="kv">
          <tr><th>${esc(rp.kind)}</th><td>${esc(t.ms.kinds[x.sc.kind])}</td></tr>
          <tr><th>${esc(rp.site)}</th><td>${esc(x.siteName ?? site.id)} · ${num(site.lat, 2)}°, ${num(site.lon, 2)}°${site.ideal ? ` · <span class="down">${esc(t.noTerrain)}</span>` : ''}</td></tr>
          <tr><th>${esc(rp.stay)}</th><td>${esc(fmt.dateTime(s[0].t))} → ${esc(fmt.dateTime(end))}</td></tr>
          <tr><th>${esc(rp.slip)}</th><td>${p.slipDays ? esc(t.slipBy(p.slipDays)) : esc(rp.noSlip)}</td></tr>
          <tr><th>${esc(rp.landingWindow)}</th><td>${window ? `<span class="up">${esc(t.yesCap)}</span>` : `<span class="down">${esc(t.noCap)}</span>`}</td></tr>
          <tr><th>${esc(rp.firstSunset)}</th><td>${when(firstSunset, rp.sunDownAtLanding)}</td></tr>
          <tr><th>${esc(rp.firstEarthset)}</th><td>${when(firstEarthset, rp.earthDownAtLanding)}</td></tr>
          <tr><th>${esc(t.longestDarkness)}</th><td>${ld.len ? `${num(ld.len)} h · ${esc(fmt.dateTime(s[ld.from].t))} → ${esc(fmt.dateTime(new Date(s[ld.from].t.getTime() + ld.len * HOUR)))}` : esc(t.none)}</td></tr>
          <tr><th>${esc(t.ms.batteryLeft)}</th><td>${mm.batteryMarginWh === null ? esc(rp.notSet) : `${num(mm.batteryMarginWh)} Wh · ${esc(t.ms.batteryNeed(num(p.survivalPowerW * mm.longestNightH)))}`}</td></tr>
          <tr><th>${esc(t.madridShort)}</th><td>${num(mm.madridPct)} %</td></tr>
        </table>
        ${vsBase}
        <h4>${esc(rp.daily)}</h4>
        <div class="scroll"><table class="grid days">
          <thead><tr><th>${esc(rp.day)}</th><th>${esc(rp.date)}</th><th class="n">${esc(t.sunlight)}</th><th class="n">${esc(t.earthInView)}</th><th class="n">${esc(t.both)}</th><th class="n">${esc(t.madridShort)}</th><th></th></tr></thead>
          <tbody>${days}</tbody>
        </table></div>
      </section>`
    })
    .join('')

  // Best landing days for this mission at the baseline site.
  let best = ''
  if (r.plan && r.planSite) {
    const RANK = { viable: 0, marginal: 1, 'not-viable': 2 } as const
    const good = r.plan
      .map((d) => {
        let h = -1
        d.hours.forEach((v, i) => {
          if (v && (h < 0 || RANK[v] < RANK[d.hours[h] as Metrics['verdict']])) h = i
        })
        return { d, h, v: h >= 0 ? d.hours[h] : null }
      })
      .filter((x) => x.v === 'viable')
    const list = good.slice(0, 12).map((x) => `<li>${esc(fmt.date(x.d.t))} · ${String(x.h).padStart(2, '0')}:00 UTC</li>`).join('')
    best = `<p>${esc(rp.bestNote(r.planSite, m.durationDays, good.length))}</p>${list ? `<ul class="cols">${list}</ul>` : `<p class="muted">${esc(rp.noneBest)}</p>`}`
  }

  return `<!doctype html>
<html lang="${esc(t.locale.slice(0, 2))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(rp.title)} · ${esc(m.name)}</title>
<style>
  :root { --ink: #14171c; --muted: #5e6672; --rule: #dde1e6; --sun: #c98f00; --wash: #f5f6f8 }
  * { box-sizing: border-box }
  body { margin: 0; padding: 32px 20px 48px; color: var(--ink); background: #fff; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif }
  main { max-width: 920px; margin: 0 auto }
  header { border-bottom: 3px solid var(--sun); padding-bottom: 14px; margin-bottom: 24px }
  .brand { margin: 0; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted) }
  h1 { margin: 4px 0 2px; font-size: 30px; line-height: 1.15 }
  h2 { margin: 36px 0 10px; font-size: 20px; border-bottom: 1px solid var(--rule); padding-bottom: 6px }
  h3 { margin: 22px 0 8px; font-size: 17px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px }
  h4 { margin: 18px 0 6px; font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted) }
  p { margin: 6px 0 }
  .muted, .note { color: var(--muted) }
  .note { font-size: 13px }
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin: 0 }
  .facts div { background: var(--wash); padding: 10px 12px; border-left: 3px solid var(--sun) }
  .facts dt { font-size: 12px; color: var(--muted) }
  .facts dd { margin: 2px 0 0; font-weight: 600 }
  table { border-collapse: collapse; width: 100% }
  .kv th { text-align: left; font-weight: 500; color: var(--muted); padding: 5px 12px 5px 0; width: 42%; vertical-align: top }
  .kv td { padding: 5px 0; border-bottom: 1px solid var(--rule) }
  .grid th, .grid td { padding: 7px 8px; border-bottom: 1px solid var(--rule); text-align: left; vertical-align: top }
  .grid thead th { font-size: 12px; color: var(--muted); font-weight: 600; background: var(--wash) }
  .grid tbody tr:nth-child(even) { background: #fafbfc }
  .n { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap }
  .badge { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--c); border: 1px solid var(--c); white-space: nowrap }
  .up { color: #127a4a; font-weight: 600 }
  .down { color: #b3122a; font-weight: 600 }
  .scroll { overflow-x: auto }
  .scenario { border: 1px solid var(--rule); padding: 4px 18px 16px; margin: 16px 0; page-break-inside: avoid }
  .days td.bar { width: 26%; min-width: 80px }
  .days td.bar span { display: block; height: 8px; background: var(--sun); border-radius: 2px }
  ul.cols { columns: 3 200px; padding-left: 18px }
  footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid var(--rule); font-size: 13px; color: var(--muted) }
  footer li { margin: 3px 0 }
  @media print { body { padding: 0 } .scroll { overflow: visible } a { color: inherit } .print-hint { display: none } }
</style>
</head>
<body>
<main>
  <header>
    <p class="brand">Fly Me to the Moon · ${esc(rp.title)}</p>
    <h1>${esc(m.name)}</h1>
    <p class="muted">${esc(rp.generated(fmt.dateTime(generated)))} · ${esc(rp.dataRange(fmt.date(r.dataStart), fmt.date(r.dataEnd)))}</p>
    <p class="note print-hint">${esc(rp.print)}</p>
  </header>

  <h2>${esc(rp.overview)}</h2>
  ${overview}

  <h2>${esc(rp.hardware)}</h2>
  ${hardware}

  <h2>${esc(rp.summary)}</h2>
  ${summary}

  ${details ? `<h2>${esc(rp.detail)}</h2>${details}` : ''}

  ${best ? `<h2>${esc(rp.best)}</h2>${best}` : ''}

  <footer>
    <p><b>${esc(rp.notes)}</b></p>
    <ul>${rp.notesItems.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <p>${esc(rp.by)} <a href="${esc(r.appUrl)}">${esc(r.appUrl)}</a></p>
  </footer>
</main>
</body>
</html>
`
}
