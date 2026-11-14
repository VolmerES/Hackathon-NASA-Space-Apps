// Technical report of a mission, laid out like the NASA Technical Memoranda on lunar polar illumination
// (Fincannon, NASA/TM-2007-215025): abstract and recommendations first, then mission definition, method,
// results with Sun and Earth elevation profiles against the terrain horizon, energy storage, landing
// accuracy, alternatives, compliance, limitations, references and a documentation page. Template by
// Luna (plantilla_informe_v2), ported from its reference generator. Not a NASA document: no NASA logo or
// numbering. Every figure is computed here from the app's own model; results are worded as suggestions.
import { ARTEMIS3, DATA, SITES, SOURCES, VIPER_BATTERY_WH, gridSites, horizonAt, landingCalendar, metrics, moonDistanceKm, overview, simulate, type GridSite, type Metrics, type Mission, type Sample, type Site } from './data/model'
import type { Strings } from './i18n'
import { missionParams, type MissionDef, type SavedScenario } from './missions'

export interface TechReportInput {
  mission: MissionDef
  site: Site
  siteName: string
  /** Saved scenarios of the mission, already evaluated, for table 5. */
  scenarios: { sc: SavedScenario; siteName?: string; m?: Metrics }[]
  t: Strings
  /** Applies the app's caution (published study disagreeing with us) to a verdict. */
  cautious: (site: Site, m: Metrics) => Metrics
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
const COLOR = { viable: '#127a4a', marginal: '#a86500', 'not-viable': '#b3122a' } as const
const HOUR = 3600000
const ref = (n: number) => n + 3 // SOURCES 1..6 come after the three cited first

const CSS = `@page { size: A4; margin: 18mm 16mm 20mm;
  @bottom-right { content: counter(page); font: 9pt "Helvetica Neue", Arial, sans-serif; color: #5e6672 }
  @bottom-left { content: "Fly Me to the Moon · Technical Report"; font: 8pt "Helvetica Neue", Arial, sans-serif; color: #8c939c } }
@page :first { @bottom-right { content: none } @bottom-left { content: none } }
:root { --ink: #14171c; --muted: #5e6672; --rule: #d5dae0; --accent: #0b3d91; --sun: #c98f00; --wash: #f4f6f9 }
* { box-sizing: border-box }
body { margin: 0; color: var(--ink); background: #e9ecf0; font: 10.5pt/1.5 Georgia, "Times New Roman", serif }
body > section { max-width: 186mm; margin: 0 auto; background: #fff; padding: 10mm 12mm }
h2, h3, caption, figcaption, table, .toolbar, .tick, .badge { font-family: "Helvetica Neue", Arial, sans-serif }
h2 { font-size: 13pt; color: var(--ink); margin: 2mm 0 3mm }
h3 { font-size: 11pt; margin: 6mm 0 2mm }
p { margin: 0 0 2.5mm; text-align: justify; hyphens: auto }
a { color: var(--accent); word-break: break-all }
.toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 12px; align-items: center; justify-content: center; padding: 10px; background: #14171c; color: #cfd5dc; font-size: 13px }
.toolbar button { font: 600 14px "Helvetica Neue", Arial, sans-serif; padding: 8px 16px; border: 0; border-radius: 6px; background: var(--sun); color: #14171c; cursor: pointer }
.cover { min-height: 250mm; display: flex; flex-direction: column; padding-top: 30mm !important }
.repno { margin: 0 0 22mm; font: 11pt Georgia, "Times New Roman", serif; text-align: left }
.cover h1 { font: 700 20pt/1.25 Georgia, "Times New Roman", serif; margin: 0 0 16mm; text-align: left }
.authors { font: 12pt/1.5 Georgia, "Times New Roman", serif; text-align: left; margin-bottom: 0 }
.authors span { font-size: 10.5pt; font-style: italic }
.date { margin-top: auto; font: 11pt Georgia, "Times New Roman", serif; text-align: left }
.notnasa { font: 8.5pt/1.4 Georgia, "Times New Roman", serif; color: var(--muted); text-align: left; border-top: 1px solid var(--ink); padding-top: 3mm; margin-top: 4mm }
.recs li { margin-bottom: 1.5mm; text-align: justify }
.method li { margin-bottom: 1.5mm }
table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 2mm 0 4mm }
caption { caption-side: top; text-align: left; font-size: 9pt; font-weight: 700; padding-bottom: 1.5mm }
.kv th { text-align: left; font-weight: 500; color: var(--muted); padding: 1.5mm 3mm 1.5mm 0; width: 38%; vertical-align: top; border-bottom: 1px solid var(--rule) }
.kv td { padding: 1.5mm 0; border-bottom: 1px solid var(--rule) }
.grid th, .grid td { padding: 1.4mm 2mm; border-bottom: 1px solid var(--rule); text-align: left; vertical-align: top }
.grid thead th { font-weight: 700; border-bottom: 1.5px solid var(--ink); background: none }
.n { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap }
.badge { display: inline-block; padding: 0 2mm; border-radius: 99px; font-size: 8pt; font-weight: 700; color: var(--c); border: 1px solid var(--c); white-space: nowrap }
.pass { color: #127a4a; font-weight: 700 } .fail { color: #b3122a; font-weight: 700 }
figure { margin: 3mm 0 5mm; break-inside: avoid }
figcaption { font-size: 8.5pt; color: var(--muted); margin-top: 1mm }
.fig { width: 100%; height: auto; display: block }
.fig.heat { max-width: 125mm; margin: 0 auto }
.gridl { stroke: #e3e7ec; stroke-width: 1 }
.tick { font-size: 10px; fill: var(--muted) }
.days td.bar { width: 30% } .days td.bar span { display: block; height: 2.2mm; background: var(--sun) }
.refs li { font-size: 9pt; margin-bottom: 1.5mm }
@media screen { body > section { margin: 6mm auto; box-shadow: 0 1px 4px rgba(0,0,0,.12) } }
@media print {
  body { background: #fff }
  .no-print { display: none !important }
  body > section { padding: 0; max-width: none; margin: 0 }
  .cover { min-height: 255mm; break-after: page; padding-top: 14mm !important }
  .summary { break-after: page }
  .pagebreak, .docpage { break-before: page }
  h2, h3 { break-after: avoid }
  table, tr { break-inside: avoid }
}`

type Row = { t: Date; sunEl: number; sunHor: number; sunVis: number; earthEl: number; earthHor: number; earthVis: boolean; madrid: boolean }
type Pt = { p: GridSite; m: Metrics }

/** Returns null when the mission's site or dates fall outside the data: the caller uses the short report. */
export function technicalReportHtml(r: TechReportInput): string | null {
  const { mission: mi, site, t } = r
  const es = t.locale.startsWith('es')
  const L = (en: string, sp: string) => (es ? sp : en)
  const loc = t.locale
  const params: Mission = missionParams(mi)
  const land = params.landing
  if (Number.isNaN(land.getTime()) || land < DATA.start || land.getTime() + mi.durationDays * 86400000 > DATA.end.getTime()) return null
  const samples: Sample[] = simulate(site, params)
  if (samples.length < 24) return null
  const m = r.cautious(site, metrics(samples, params))
  const req = params.req ?? { minSunPct: 90, maxDarkH: 24, minEarthPct: 50 }
  const end = new Date(land.getTime() + mi.durationDays * 86400000)
  const P = mi.survivalPowerW

  // Formatting.
  const nf = (x: number, d = 0) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d })
  const w1 = (x: number) => x.toLocaleString(loc, { maximumFractionDigits: 1 }) // 65 W, 2.5 W
  const pct = (x: number) => `${nf(x)} %`
  const kwh = (wh: number) => (wh >= 1000 ? `${nf(wh / 1000, 1)} kWh` : `${nf(wh)} Wh`)
  const mass = (wh: number) => `${nf(wh / 150)}–${nf(wh / 125)} kg`
  const day = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const dt = (d: Date) => `${day(d)}, ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`
  const short = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const V = (v: Metrics['verdict']) => t.verdictLong[v]
  const badge = (v: Metrics['verdict']) => `<span class="badge" style="--c:${COLOR[v]}">${esc(V(v))}</span>`
  const ok = (b: boolean) => (b ? `<span class="pass">${L('Met', 'Cumple')}</span>` : `<span class="fail">${L('Not met', 'No cumple')}</span>`)

  // Hour by hour, with the terrain horizon in the direction of the Sun and of Earth.
  const S: Row[] = samples.map((s) => ({
    t: s.t,
    sunEl: s.sunEl,
    sunHor: horizonAt(site, s.sunAz),
    sunVis: s.sunVisible,
    earthEl: s.earthEl,
    earthHor: horizonAt(site, s.earthAz),
    earthVis: s.earthVisible,
    madrid: s.madridLink,
  }))
  const days = overview(site, land, mi.durationDays, params.minAntennaElevDeg)

  // Landing accuracy: the grid around the target (empty if it did not load).
  const grid: Pt[] = gridSites(site.id).map((p) => ({ p, m: metrics(simulate(p, params), params) }))
  const g100 = grid.filter((x) => x.p.distM <= ARTEMIS3.landingAccuracyM + 1e-6)
  const worst100 = g100.length ? g100.reduce((a, b) => (b.m.longestNightH > a.m.longestNightH ? b : a)) : null
  const best = g100.filter((x) => x.p.slope < ARTEMIS3.maxLandingSlopeDeg).sort((a, b) => b.m.opsPct - a.m.opsPct || a.m.longestNightH - b.m.longestNightH)[0]

  // Alternatives: the other team sites on the same dates, and the same site landing later.
  const others = SITES.filter((s) => s.team && s.id !== site.id)
    .map((s) => ({ s, km: moonDistanceKm(site, s), m: r.cautious(s, metrics(simulate(s, params), params)) }))
    .sort((a, b) => a.km - b.km)
  const slips = [3, 7]
    .map((d) => {
      const ps = { ...params, slipDays: d }
      if (land.getTime() + (d + mi.durationDays) * 86400000 > DATA.end.getTime()) return null
      return { d, m: r.cautious(site, metrics(simulate(site, ps), ps)) }
    })
    .filter((x): x is { d: number; m: Metrics } => !!x)
  const plan = landingCalendar(site, mi.durationDays, params.minAntennaElevDeg, params.req, P, params.batteryWh, params.dod, params.eta)
  let nextViable: Date | null = null
  for (const d of plan) {
    const h = d.hours.findIndex((v, i) => v === 'viable' && d.t.getTime() + i * HOUR >= land.getTime())
    if (h >= 0) {
      nextViable = new Date(d.t.getTime() + h * HOUR)
      break
    }
  }

  const repNo = `FMTM-TR-${land.getUTCFullYear()}-${site.id.toUpperCase()}-${String(land.getUTCMonth() + 1).padStart(2, '0')}${String(land.getUTCDate()).padStart(2, '0')}`
  const generated = new Date()

  // ---------------------------------------------------------------- figures (SVG)
  const xDay = (k: number) => short(new Date(land.getTime() + k * 86400000))
  const dayStep = mi.durationDays > 20 ? 4 : 2
  const profile = (el: (s: Row) => number, hor: (s: Row) => number, vis: (s: Row) => boolean, color: string, id: string) => {
    const W = 680, H = 230, Lm = 46, R = 12, T = 12, B = 34
    const n = S.length
    const all = [...S.map(el), ...S.map(hor)]
    const lo = Math.floor(Math.min(...all)) - 0.5
    const hi = Math.ceil(Math.max(...all)) + 0.5
    const X = (i: number) => Lm + ((W - Lm - R) * i) / (n - 1)
    const Y = (v: number) => T + ((H - T - B) * (hi - v)) / (hi - lo)
    const out = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}" class="fig">`]
    for (let i = 0; i < n; ) {
      const v = vis(S[i])
      let j = i
      while (j + 1 < n && vis(S[j + 1]) === v) j++
      if (v) out.push(`<rect x="${X(i).toFixed(1)}" y="${T}" width="${Math.max(X(j) - X(i), 1).toFixed(1)}" height="${H - T - B}" fill="${color}" opacity=".10"/>`)
      i = j + 1
    }
    const step = hi - lo <= 6 ? 1 : hi - lo <= 14 ? 2 : 5
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step)
      out.push(`<line x1="${Lm}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="gridl"/><text x="${Lm - 6}" y="${(Y(v) + 3.5).toFixed(1)}" class="tick" text-anchor="end">${v}°</text>`)
    for (let k = 0; k <= mi.durationDays; k += dayStep) {
      const x = X(Math.min(k * 24, n - 1))
      out.push(`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${T}" y2="${H - B}" class="gridl"/><text x="${x.toFixed(1)}" y="${H - B + 15}" class="tick" text-anchor="middle">${esc(xDay(k))}</text>`)
    }
    const hp = S.map((s, i) => `${X(i).toFixed(1)},${Y(hor(s)).toFixed(1)}`).join(' ')
    out.push(`<polygon points="${Lm},${H - B} ${hp} ${W - R},${H - B}" fill="#8c939c" opacity=".35"/>`)
    out.push(`<polyline points="${hp}" fill="none" stroke="#5e6672" stroke-width="1.2"/>`)
    out.push(`<polyline points="${S.map((s, i) => `${X(i).toFixed(1)},${Y(el(s)).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.8"/>`)
    out.push(`<text x="${Lm}" y="${H - 4}" class="tick">${L('UTC date', 'Fecha UTC')}</text></svg>`)
    return out.join('')
  }
  const strip = () => {
    const W = 680, Lm = 118, R = 12, rowh = 16, gap = 8
    const rows: [string, (s: Row) => number, string][] = [
      [L('Sun (disc fraction)', 'Sol (fracción del disco)'), (s) => s.sunVis, '#c98f00'],
      [L('Earth in view', 'Tierra a la vista'), (s) => (s.earthVis ? 1 : 0), '#2f6db5'],
      [L('Madrid link', 'Enlace con Madrid'), (s) => (s.madrid ? 1 : 0), '#5b4bb7'],
    ]
    const H = rows.length * (rowh + gap) + 24
    const n = S.length
    const w = (W - Lm - R) / n
    const out = [`<svg viewBox="0 0 ${W} ${H}" class="fig" role="img" aria-label="${L('Hour-by-hour visibility', 'Visibilidad hora a hora')}">`]
    rows.forEach(([lab, f, c], k) => {
      const y = k * (rowh + gap)
      out.push(`<text x="${Lm - 8}" y="${y + rowh - 4}" class="tick" text-anchor="end">${esc(lab)}</text><rect x="${Lm}" y="${y}" width="${W - Lm - R}" height="${rowh}" fill="#eef0f3"/>`)
      S.forEach((s, i) => {
        const v = f(s)
        if (v > 0) out.push(`<rect x="${(Lm + i * w).toFixed(2)}" y="${y}" width="${(w + 0.3).toFixed(2)}" height="${rowh}" fill="${c}" opacity="${(0.25 + 0.75 * v).toFixed(2)}"/>`)
      })
    })
    const yb = rows.length * (rowh + gap) + 4
    for (let k = 0; k <= mi.durationDays; k += dayStep) out.push(`<text x="${(Lm + ((W - Lm - R) * Math.min(k * 24, n)) / n).toFixed(1)}" y="${yb + 10}" class="tick" text-anchor="middle">${esc(xDay(k))}</text>`)
    out.push('</svg>')
    return out.join('')
  }
  const heat = () => {
    if (!grid.length) return ''
    const cell = 30, pad = 40
    const eS = [...new Set(grid.map((x) => x.p.e))].sort((a, b) => a - b)
    const nS = [...new Set(grid.map((x) => x.p.n))].sort((a, b) => b - a)
    const W = pad + cell * eS.length + 150
    const H = pad + cell * nS.length + 28
    const cx = (e: number) => pad + cell * eS.indexOf(e) + cell / 2
    const cy = (n: number) => 12 + cell * nS.indexOf(n) + cell / 2
    const ramp = ['#f4efe2', '#ecd9a6', '#dfbd5e', '#c98f00', '#8a6100']
    const col = (v: number) => ramp[Math.min(Math.floor(v / 20), 4)]
    const spacing = eS.length > 1 ? eS[1] - eS[0] : 40
    const out = [`<svg viewBox="0 0 ${W} ${H}" class="fig heat" role="img" aria-label="${L('Landing grid', 'Malla de alunizaje')}">`]
    for (const x of grid)
      out.push(`<rect x="${cx(x.p.e) - cell / 2 + 1}" y="${cy(x.p.n) - cell / 2 + 1}" width="${cell - 2}" height="${cell - 2}" fill="${col(x.m.opsPct)}"><title>${x.p.e} m E, ${x.p.n} m N: ${L('Sun and Earth', 'Sol y Tierra')} ${nf(x.m.opsPct)} %, ${L('night', 'noche')} ${x.m.longestNightH} h, ${L('slope', 'pendiente')} ${nf(x.p.slope, 1)}°</title></rect>`)
    const r100 = (ARTEMIS3.landingAccuracyM / spacing) * cell
    out.push(`<circle cx="${cx(0)}" cy="${cy(0)}" r="${r100}" fill="none" stroke="#14171c" stroke-dasharray="4 3" stroke-width="1.2"/>`)
    out.push(`<text x="${cx(0) + r100 * 0.72}" y="${cy(0) - r100 * 0.74}" class="tick">100 m</text>`)
    out.push(`<path d="M${cx(0) - 6},${cy(0)} h12 M${cx(0)},${cy(0) - 6} v12" stroke="#14171c" stroke-width="2"/>`)
    if (best) out.push(`<circle cx="${cx(best.p.e)}" cy="${cy(best.p.n)}" r="7" fill="none" stroke="#127a4a" stroke-width="2.4"/>`)
    for (const e of eS) if (e % (2 * spacing) === 0) out.push(`<text x="${cx(e)}" y="${12 + cell * nS.length + 14}" class="tick" text-anchor="middle">${e}</text>`)
    for (const n of nS) if (n % (2 * spacing) === 0) out.push(`<text x="${pad - 6}" y="${cy(n) + 3.5}" class="tick" text-anchor="end">${n}</text>`)
    out.push(`<text x="${pad + (cell * eS.length) / 2}" y="${H - 2}" class="tick" text-anchor="middle">${L('metres east of the target', 'metros al este del objetivo')}</text>`)
    const lx = pad + cell * eS.length + 18
    out.push(`<text x="${lx}" y="20" class="tick">${L('Sun and Earth together', 'Sol y Tierra a la vez')}</text>`)
    ramp.forEach((c, k) => out.push(`<rect x="${lx}" y="${30 + k * 18}" width="14" height="14" fill="${c}"/><text x="${lx + 20}" y="${41 + k * 18}" class="tick">${k * 20}–${k * 20 + 20} %</text>`))
    out.push(`<path d="M${lx + 1},136 h12 M${lx + 7},130 v12" stroke="#14171c" stroke-width="2"/><text x="${lx + 20}" y="140" class="tick">${L('target', 'objetivo')}</text>`)
    out.push(`<circle cx="${lx + 7}" cy="156" r="6" fill="none" stroke="#127a4a" stroke-width="2.4"/><text x="${lx + 20}" y="160" class="tick">${L('suggested spot', 'punto sugerido')}</text>`)
    out.push('</svg>')
    return out.join('')
  }

  // ---------------------------------------------------------------- computed texts
  const reqs: [string, string, string, boolean][] = [
    [L('Sunlight', 'Luz solar'), `≥ ${nf(req.minSunPct)} % ${L('of the stay', 'de la estancia')}`, pct(m.sunlightPct), m.sunlightPct >= req.minSunPct],
    [L('Longest night', 'Noche más larga'), `≤ ${nf(req.maxDarkH)} h`, `${m.longestNightH} h`, m.longestNightH <= req.maxDarkH],
    [L('Earth in view', 'Tierra a la vista'), `≥ ${nf(req.minEarthPct)} % ${L('of the stay', 'de la estancia')}`, pct(m.earthLinkPct), m.earthLinkPct >= req.minEarthPct],
  ]
  const recs: string[] = []
  const goodSlip = slips.find((x) => x.m.verdict === 'viable')
  if (m.verdict !== 'viable' && goodSlip)
    recs.push(L(
      `Per the data, a landing delayed by ${goodSlip.d} days, to ${day(new Date(land.getTime() + goodSlip.d * 86400000))}, would appear to meet every requirement (Sun ${pct(goodSlip.m.sunlightPct)}, Earth ${pct(goodSlip.m.earthLinkPct)}).`,
      `Según los datos, retrasar el alunizaje ${goodSlip.d} días, al ${day(new Date(land.getTime() + goodSlip.d * 86400000))}, parecería cumplir todos los requisitos (Sol ${pct(goodSlip.m.sunlightPct)}, Tierra ${pct(goodSlip.m.earthLinkPct)}).`))
  if (nextViable)
    recs.push(L(
      `The first hour in the data that looks favourable for touchdown (Sun and Earth in view) and for the whole ${mi.durationDays}-day stay is ${dt(nextViable)}.`,
      `La primera hora de los datos que parece favorable para tocar suelo (Sol y Tierra a la vista) y para toda la estancia de ${mi.durationDays} días es el ${dt(nextViable)}.`))
  else recs.push(L(`No hour in the data looks favourable for the whole ${mi.durationDays}-day stay at this site.`, `Ninguna hora de los datos parece favorable para toda la estancia de ${mi.durationDays} días en este sitio.`))
  if (best && best.m.opsPct > m.opsPct + 0.5)
    recs.push(L(
      `Moving the target ${best.p.e} m east and ${best.p.n} m north would raise the time with the Sun and Earth together from ${pct(m.opsPct)} to ${pct(best.m.opsPct)}, on a ${nf(best.p.slope, 1)}° slope over 100 m.`,
      `Mover el objetivo ${best.p.e} m al este y ${best.p.n} m al norte subiría el tiempo con Sol y Tierra a la vez del ${pct(m.opsPct)} al ${pct(best.m.opsPct)}, con una pendiente de ${nf(best.p.slope, 1)}° sobre 100 m.`))
  if (worst100 && P > 0 && worst100.m.nightEnergyWh > m.nightEnergyWh)
    recs.push(L(
      `Energy storage should be sized for the 100 m landing accuracy rather than for the target: the worst night within 100 m lasts ${worst100.m.longestNightH} h and needs ${kwh(worst100.m.nightEnergyWh)} at ${w1(P)} W (${mass(worst100.m.nightEnergyWh)} of batteries), against ${kwh(m.nightEnergyWh)} at the target.`,
      `La batería convendría dimensionarla para la precisión de 100 m y no para el objetivo: la peor noche a menos de 100 m dura ${worst100.m.longestNightH} h y pide ${kwh(worst100.m.nightEnergyWh)} a ${w1(P)} W (${mass(worst100.m.nightEnergyWh)} de baterías), frente a ${kwh(m.nightEnergyWh)} en el objetivo.`))

  const abstract = L(
    `Terrain horizons computed from NASA LRO LOLA topography and hourly Sun and Earth positions from JPL Horizons were used to assess ${esc(r.siteName)} (${nf(site.lat, 3)}°, ${nf(site.lon, 3)}°) for a ${mi.durationDays}-day stay beginning ${dt(land)}. The Sun is above the local terrain for ${pct(m.sunlightPct)} of the stay and the longest dark period is ${m.longestNightH} h${P > 0 ? `, which at a night survival power of ${w1(P)} W requires ${kwh(m.nightEnergyWh)} of stored energy` : ''}. Earth is in view for ${pct(m.earthLinkPct)} of the stay, with a longest gap of ${m.longestNoEarthH} h; against the mission requirements the stay appears as “${esc(V(m.verdict))}”.${worst100 ? ` Within the 100 m landing accuracy required for Artemis III the longest night ranges up to ${worst100.m.longestNightH} h.` : ''} These results are suggestions from the data, not a mission decision.`,
    `Se han usado horizontes de relieve calculados con la topografía LOLA del LRO de la NASA y posiciones horarias del Sol y la Tierra de JPL Horizons para evaluar ${esc(r.siteName)} (${nf(site.lat, 3)}°, ${nf(site.lon, 3)}°) en una estancia de ${mi.durationDays} días que empieza el ${dt(land)}. El Sol está sobre el relieve local el ${pct(m.sunlightPct)} de la estancia y el periodo de oscuridad más largo es de ${m.longestNightH} h${P > 0 ? `, que con una potencia de supervivencia nocturna de ${w1(P)} W pide ${kwh(m.nightEnergyWh)} de energía almacenada` : ''}. La Tierra está a la vista el ${pct(m.earthLinkPct)} de la estancia, con un hueco máximo de ${m.longestNoEarthH} h; frente a los requisitos de la misión, la estancia aparece como «${esc(V(m.verdict))}».${worst100 ? ` Dentro de la precisión de alunizaje de 100 m que pide Artemis III, la noche más larga llega a ${worst100.m.longestNightH} h.` : ''} Son sugerencias a partir de los datos, no una decisión de misión.`,
  )

  const dayRows = days
    .map((d, i) => `<tr><td>${i + 1}</td><td>${esc(day(d.t))}</td><td class="n">${nf(24 * d.sun)} h</td><td class="n">${nf(24 * d.earth)} h</td><td class="n">${nf(24 * d.both)} h</td><td class="bar"><span style="width:${nf(100 * d.sun)}%"></span></td></tr>`)
    .join('')
  const ring = (pts: Pt[]) => {
    const v = (f: (x: Pt) => number) => pts.map(f)
    const sun = v((x) => x.m.sunlightPct)
    const earth = v((x) => x.m.earthLinkPct)
    return [`${nf(Math.min(...sun))}–${nf(Math.max(...sun))} %`, `${nf(Math.min(...earth))}–${nf(Math.max(...earth))} %`, `${Math.max(...v((x) => x.m.longestNightH))} h`, kwh(Math.max(...v((x) => x.m.nightEnergyWh))), `${nf(Math.max(...v((x) => x.p.slope)), 1)}°`]
  }
  const maxSlope100 = g100.length ? Math.max(...g100.map((x) => x.p.slope)) : null
  const otherRows = others
    .map((o) => `<tr><td>${esc(o.s.name)}</td><td class="n">${nf(o.km)} km</td><td>${badge(o.m.verdict)}</td><td class="n">${pct(o.m.sunlightPct)}</td><td class="n">${pct(o.m.earthLinkPct)}</td><td class="n">${o.m.longestNightH} h</td><td class="n">${kwh(o.m.nightEnergyWh)}</td></tr>`)
    .join('')
  const scenRows = [
    ...slips.map((x) => `<tr><td>${L(`Landing delayed ${x.d} days`, `Alunizaje ${x.d} días más tarde`)}</td><td>${badge(x.m.verdict)}</td><td class="n">${pct(x.m.sunlightPct)}</td><td class="n">${pct(x.m.earthLinkPct)}</td><td class="n">${x.m.longestNightH} h</td><td class="n">${kwh(x.m.nightEnergyWh)}</td><td class="n">${x.m.longestNoEarthH} h</td></tr>`),
    ...r.scenarios.filter((x) => x.m).map((x) => `<tr><td>${esc(x.sc.name)}${x.siteName ? ` <span style="color:var(--muted)">(${esc(x.siteName)})</span>` : ''}</td><td>${badge(x.m!.verdict)}</td><td class="n">${pct(x.m!.sunlightPct)}</td><td class="n">${pct(x.m!.earthLinkPct)}</td><td class="n">${x.m!.longestNightH} h</td><td class="n">${kwh(x.m!.nightEnergyWh)}</td><td class="n">${x.m!.longestNoEarthH} h</td></tr>`),
  ].join('')
  const srcs = SOURCES.map((s) => `<li id="ref${ref(s.n)}">${esc(s.title)}. <a href="${esc(s.url)}">${esc(s.url)}</a></li>`).join('')
  const desc = mi.description.trim() || mi.objectives.trim()

  return `<!doctype html>
<html lang="${es ? 'es' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(repNo)} · ${L('Landing site assessment', 'Evaluación del sitio de alunizaje')} · ${esc(r.siteName)}</title>
<style>${CSS}</style></head><body>
<div class="toolbar no-print"><button onclick="window.print()">${L('Download Mission Report (PDF)', 'Descargar el informe de misión (PDF)')}</button><span>${L('Opens the print dialog: choose “Save as PDF”.', 'Abre el diálogo de impresión: elige «Guardar como PDF».')}</span></div>

<section class="cover">
  <p class="repno">Fly Me to the Moon ${L('Technical Report', 'Informe técnico')} ${esc(repNo)}</p>
  <h1>${L(`Landing Site Assessment for a ${mi.durationDays}-Day Stay at ${esc(r.siteName)}: Illumination, Earth Visibility and Energy Storage`, `Evaluación del sitio de alunizaje para una estancia de ${mi.durationDays} días en ${esc(r.siteName)}: iluminación, visibilidad de la Tierra y almacenamiento de energía`)}</h1>
  <p class="authors">${L('Mission', 'Misión')}: ${esc(mi.name)}<br>Juan Beltrán, Juan Bautista, Ángela ${L('and', 'y')} Luna<br><span>${L('Fly Me to the Moon team, NASA Space Apps Challenge 2026, Madrid, Spain', 'Equipo Fly Me to the Moon, NASA Space Apps Challenge 2026, Madrid, España')}</span></p>
  <p class="date">${esc(generated.toLocaleDateString(loc, { month: 'long', year: 'numeric' }))}</p>
  <p class="notnasa">${L('This report is not a NASA publication. It was produced by the team with the Fly Me to the Moon tool from NASA data (LRO LOLA topography, JPL Horizons ephemerides). Its layout follows NASA Technical Memoranda on lunar polar illumination [1]. Results are suggestions from the data, not mission decisions.', 'Este informe no es una publicación de la NASA. Lo ha generado el equipo con la herramienta Fly Me to the Moon a partir de datos de la NASA (topografía LOLA del LRO, efemérides de JPL Horizons). Su estructura sigue los Technical Memoranda de la NASA sobre iluminación polar lunar [1]. Los resultados son sugerencias a partir de los datos, no decisiones de misión.')}</p>
</section>

<section class="summary">
  <h2>${L('Abstract', 'Resumen')}</h2>
  <p>${abstract}</p>
  <table class="grid"><caption>${L('Summary of results', 'Resumen de resultados')}</caption>
    <thead><tr><th>${L('Quantity', 'Magnitud')}</th><th class="n">${L('Result', 'Resultado')}</th><th>${L('Requirement', 'Requisito')}</th><th>${L('Status', 'Estado')}</th></tr></thead>
    <tbody>${reqs.map(([k, q, v, b]) => `<tr><td>${k}</td><td class="n">${v}</td><td>${q}</td><td>${ok(b)}</td></tr>`).join('')}
    <tr><td>${L('Sun and Earth together', 'Sol y Tierra a la vez')}</td><td class="n">${pct(m.opsPct)}</td><td>—</td><td>—</td></tr>
    <tr><td>${L('Longest time without Earth', 'Mayor tiempo sin Tierra')}</td><td class="n">${m.longestNoEarthH} h</td><td>${mi.maxNoEarthH ? `≤ ${mi.maxNoEarthH} h` : '—'}</td><td>${mi.maxNoEarthH ? ok(!m.noEarthExceeded) : '—'}</td></tr>
    ${P > 0 ? `<tr><td>${L('Energy for the longest night', 'Energía para la noche más larga')}</td><td class="n">${kwh(m.nightEnergyWh)}</td><td>${mi.batteryWh ? `${L('battery', 'batería')} ${kwh(mi.batteryWh)}` : '—'}</td><td>${mi.batteryWh ? ok(m.batteryMarginWh === null || m.batteryMarginWh >= 0) : '—'}</td></tr>` : ''}
    <tr><td><b>${L('Overall, per the data', 'En conjunto, según los datos')}</b></td><td class="n" colspan="3"><b>${esc(V(m.verdict))}</b></td></tr></tbody></table>
  <h3>${L('Suggestions', 'Sugerencias')}</h3>
  <ol class="recs">${recs.map((x) => `<li>${x}</li>`).join('')}</ol>
</section>

<section>
  <h2>1 ${L('Introduction', 'Introducción')}</h2>
  <p>${L(`Near the lunar south pole the Sun never rises far above the horizon, so nearby relief decides when a lander has power and when it can see Earth. This report assesses one landing site and one landing date for a ${mi.durationDays}-day stay, following the approach of NASA illumination studies for power-system planning [1]: the Sun and Earth are compared hour by hour with the terrain horizon of the site, and the longest dark period sets the energy that must be stored.`, `Cerca del polo sur lunar el Sol nunca sube mucho sobre el horizonte, así que el relieve cercano decide cuándo tiene energía un módulo y cuándo ve la Tierra. Este informe evalúa un sitio y una fecha de alunizaje para una estancia de ${mi.durationDays} días, siguiendo el enfoque de los estudios de iluminación de la NASA para planificar sistemas de energía [1]: el Sol y la Tierra se comparan hora a hora con el horizonte de relieve del sitio, y el periodo de oscuridad más largo fija la energía que hay que almacenar.`)}</p>
  ${desc ? `<p>${esc(desc)}</p>` : ''}
</section>

<section>
  <h2>2 ${L('Mission definition', 'Definición de la misión')}</h2>
  <table class="kv"><caption>${L('Table 1. Mission inputs and assumptions', 'Tabla 1. Datos de entrada y supuestos de la misión')}</caption>
    <tr><th>${L('Landing site', 'Sitio de alunizaje')}</th><td>${esc(r.siteName)} (${nf(site.lat, 4)}°, ${nf(site.lon, 4)}°)</td></tr>
    <tr><th>${L('Landing time', 'Hora del alunizaje')}</th><td>${dt(land)}</td></tr>
    <tr><th>${L('Stay on the surface', 'Estancia en superficie')}</th><td>${mi.durationDays} ${L('days', 'días')}, ${L('until', 'hasta el')} ${dt(end)}</td></tr>
    <tr><th>${L('Night survival power', 'Potencia de supervivencia nocturna')}</th><td>${w1(P)} W${mi.powerPreset === 'ltv' ? ` · ${L(`Artemis rover LTV profile: 9.7 kWh over a 150 h night [${ref(6)}]; 65 W is the team's average (9.7 kWh ÷ 150 h)`, `perfil del rover LTV de Artemis: 9,7 kWh en una noche de 150 h [${ref(6)}]; 65 W es la media del equipo (9,7 kWh ÷ 150 h)`)}` : ''}</td></tr>
    <tr><th>${L('Battery', 'Batería')}</th><td>${mi.batteryWh ? kwh(mi.batteryWh) : L('not set', 'sin fijar')} · ${L('usable fraction', 'fracción utilizable')} ${nf(mi.dod * 100)} %, ${L('efficiency', 'eficiencia')} ${nf(mi.eta * 100)} %</td></tr>
    <tr><th>${L('Lowest antenna angle', 'Ángulo mínimo de antena')}</th><td>${nf(mi.minAntennaElevDeg, 1)}° ${L('over the terrain', 'sobre el relieve')}</td></tr>
    <tr><th>${L('Requirements', 'Requisitos')}</th><td>${L(`Sunlight ≥ ${nf(req.minSunPct)} %, longest night ≤ ${nf(req.maxDarkH)} h, Earth in view ≥ ${nf(req.minEarthPct)} % (team criteria, after Wueller et al. [2]; not a NASA standard)`, `Luz solar ≥ ${nf(req.minSunPct)} %, noche más larga ≤ ${nf(req.maxDarkH)} h, Tierra a la vista ≥ ${nf(req.minEarthPct)} % (criterio del equipo, a partir de Wueller et al. [2]; no es una norma de la NASA)`)}</td></tr>
  </table>
</section>

<section>
  <h2>3 ${L('Method and data', 'Método y datos')}</h2>
  <ul class="method">
    <li><b>${L('Terrain horizon.', 'Horizonte de relieve.')}</b> ${L('720 azimuths (every 0.5°), rays traced to 150 km over NASA LRO LOLA elevation models: 5 m near the site, 80 m beyond; observer 2 m above the ground, lunar curvature included.', '720 acimuts (cada 0,5°), rayos trazados hasta 150 km sobre modelos de elevación LOLA del LRO de la NASA: 5 m cerca del sitio y 80 m más lejos; observador a 2 m del suelo, con la curvatura lunar.')}</li>
    <li><b>${L('Sun and Earth.', 'Sol y Tierra.')}</b> ${L("Sub-solar and sub-Earth points from NASA JPL Horizons (DE441, libration included), every hour; Earth direction corrected for the site's offset from the Moon's centre.", 'Puntos subsolar y subterrestre de NASA JPL Horizons (DE441, con libración), cada hora; dirección de la Tierra corregida por la distancia del sitio al centro de la Luna.')}</li>
    <li><b>${L('Visibility.', 'Visibilidad.')}</b> ${L('Sunlight counts the hours with more than half of the solar disc above the terrain; Earth is in view when its centre is above the terrain plus the antenna angle. Madrid link: Earth in view and the Moon at least 10° above Robledo de Chavela.', 'La luz solar cuenta las horas con más de medio disco solar sobre el relieve; la Tierra está a la vista cuando su centro supera el relieve más el ángulo de antena. Enlace con Madrid: Tierra a la vista y la Luna a más de 10° sobre Robledo de Chavela.')}</li>
    <li><b>${L('Energy.', 'Energía.')}</b> ${L(`Energy the battery must deliver = night survival power × longest night, divided by the margins. Battery mass with today's space batteries, 125–150 Wh/kg at module level [${ref(5)}].`, `Energía que debe entregar la batería = potencia de supervivencia × noche más larga, dividida por los márgenes. Masa de batería con baterías espaciales actuales, 125–150 Wh/kg a nivel de módulo [${ref(5)}].`)}</li>
    <li><b>${L('Landing accuracy.', 'Precisión de alunizaje.')}</b> ${L(`Artemis III must land within 100 m of its target, on slopes under 10° measured over 100 m [${ref(1)}]. The same analysis is repeated on a grid every 40 m around the target, each point with its own horizon.`, `Artemis III debe alunizar a menos de 100 m de su objetivo, con pendientes de menos de 10° medidas sobre 100 m [${ref(1)}]. El mismo análisis se repite en una malla cada 40 m alrededor del objetivo, cada punto con su propio horizonte.`)}</li>
    <li><b>${L('Validation.', 'Validación.')}</b> ${L('Sun and Earth directions agree with JPL Horizons to within 0.006°. Against the 18.6-year averages of NASA PGDA product 69 (Mazarico et al.) [3], sunlight agrees within a few points and Earth visibility comes out 1–8 points lower (a known, documented difference).', 'Las direcciones del Sol y la Tierra coinciden con JPL Horizons con un error máximo de 0,006°. Frente a las medias de 18,6 años del producto PGDA 69 de la NASA (Mazarico et al.) [3], la luz solar coincide a pocos puntos y la visibilidad de la Tierra sale entre 1 y 8 puntos más baja (una diferencia conocida y documentada).')}</li>
  </ul>
</section>

<section>
  <h2>4 ${L('Results', 'Resultados')}</h2>
  <h3>4.1 ${L('Illumination', 'Iluminación')}</h3>
  <p>${L(`Over the stay the Sun is up ${pct(m.sunlightPct)} of the time. The longest dark period lasts <b>${m.longestNightH} h</b>${m.longestNightStart && m.longestNightEnd ? `, from ${dt(m.longestNightStart)} to ${dt(m.longestNightEnd)}` : ''}. Figure 1 compares the Sun's elevation with the height of the terrain in the Sun's direction: the Sun is visible whenever the gold line is above the grey terrain.`, `Durante la estancia el Sol está sobre el horizonte el ${pct(m.sunlightPct)} del tiempo. El periodo de oscuridad más largo dura <b>${m.longestNightH} h</b>${m.longestNightStart && m.longestNightEnd ? `, del ${dt(m.longestNightStart)} al ${dt(m.longestNightEnd)}` : ''}. La figura 1 compara la elevación del Sol con la altura del relieve en su dirección: el Sol se ve cuando la línea dorada está por encima del relieve gris.`)}</p>
  <figure>${profile((s) => s.sunEl, (s) => s.sunHor, (s) => s.sunVis > 0.5, '#c98f00', 'f1')}
    <figcaption id="f1">${L(`Figure 1. Solar elevation (gold) and terrain horizon elevation at the solar azimuth (grey), ${esc(r.siteName)}. Shaded bands: Sun visible.`, `Figura 1. Elevación del Sol (dorado) y del horizonte de relieve en el acimut del Sol (gris), ${esc(r.siteName)}. Bandas sombreadas: Sol visible.`)}</figcaption></figure>

  <h3>4.2 ${L('Communications with Earth', 'Comunicaciones con la Tierra')}</h3>
  <p>${L(`Earth is in view ${pct(m.earthLinkPct)} of the stay, and in contact with the Madrid Deep Space station ${pct(m.madridPct)}. The longest time without Earth is <b>${m.longestNoEarthH} h</b>${m.longestNoEarthStart ? `, from ${dt(m.longestNoEarthStart)}` : ''}. Earth in view is line of sight over the terrain, not a radio link budget.`, `La Tierra está a la vista el ${pct(m.earthLinkPct)} de la estancia, y en contacto con la estación de espacio profundo de Madrid el ${pct(m.madridPct)}. El mayor tiempo sin Tierra es de <b>${m.longestNoEarthH} h</b>${m.longestNoEarthStart ? `, desde el ${dt(m.longestNoEarthStart)}` : ''}. Tierra a la vista es línea de visión sobre el relieve, no un balance de enlace de radio.`)}</p>
  <figure>${profile((s) => s.earthEl, (s) => s.earthHor, (s) => s.earthVis, '#2f6db5', 'f2')}
    <figcaption id="f2">${L("Figure 2. Earth elevation (blue) and terrain horizon elevation at Earth's azimuth (grey). Shaded bands: Earth in view.", 'Figura 2. Elevación de la Tierra (azul) y del horizonte de relieve en el acimut de la Tierra (gris). Bandas sombreadas: Tierra a la vista.')}</figcaption></figure>
  <figure>${strip()}
    <figcaption>${L('Figure 3. Hour-by-hour visibility over the stay.', 'Figura 3. Visibilidad hora a hora durante la estancia.')}</figcaption></figure>

  ${P > 0 ? `<h3>4.3 ${L('Energy storage', 'Almacenamiento de energía')}</h3>
  <table class="kv"><caption>${L('Table 2. Energy storage for the longest night', 'Tabla 2. Almacenamiento de energía para la noche más larga')}</caption>
    <tr><th>${L('Energy the battery must deliver', 'Energía que debe entregar la batería')}</th><td>${w1(P)} W × ${m.longestNightH} h = <b>${kwh(m.nightEnergyWh)}</b>${m.requiredBatteryWh > m.nightEnergyWh + 0.5 ? ` · ${L('capacity with margins', 'capacidad con márgenes')} ${kwh(m.requiredBatteryWh)}` : ''}</td></tr>
    <tr><th>${L('Battery mass (125–150 Wh/kg)', 'Masa de batería (125–150 Wh/kg)')} [${ref(5)}]</th><td>${mass(m.requiredBatteryWh)}</td></tr>
    <tr><th>${L('Reference: NASA VIPER rover battery', 'Referencia: batería del rover VIPER de la NASA')} [${ref(4)}]</th><td>${kwh(VIPER_BATTERY_WH)}</td></tr>
    ${worst100 ? `<tr><th>${L('Worst case within the 100 m landing accuracy', 'Peor caso dentro de la precisión de 100 m')}</th><td>${worst100.m.longestNightH} h → ${kwh(worst100.m.nightEnergyWh)} (${mass(worst100.m.nightEnergyWh)})</td></tr>` : ''}
  </table>` : ''}

  ${grid.length ? `<h3>4.4 ${L('Landing-accuracy sensitivity', 'Sensibilidad a la precisión de alunizaje')}</h3>
  <p>${L(`Artemis III must land within 100 m of its target [${ref(1)}]. Within that circle the results can change markedly, because a few tens of metres alter the horizon (Figure 4, Table 3).`, `Artemis III debe alunizar a menos de 100 m de su objetivo [${ref(1)}]. Dentro de ese círculo los resultados pueden cambiar mucho, porque unas decenas de metros alteran el horizonte (figura 4, tabla 3).`)}</p>
  <figure>${heat()}<figcaption>${L('Figure 4. Share of the stay with the Sun and Earth together at each grid point (40 m spacing). Dashed: 100 m Artemis III accuracy.', 'Figura 4. Parte de la estancia con Sol y Tierra a la vez en cada punto de la malla (cada 40 m). Discontinuo: precisión de 100 m de Artemis III.')}</figcaption></figure>
  <table class="grid"><caption>${L('Table 3. Range of results around the target', 'Tabla 3. Rango de resultados alrededor del objetivo')}</caption>
    <thead><tr><th>${L('Within', 'A menos de')}</th><th class="n">${L('Sunlight', 'Luz solar')}</th><th class="n">${L('Earth', 'Tierra')}</th><th class="n">${L('Worst night', 'Peor noche')}</th><th class="n">${L('Worst energy', 'Peor energía')}</th><th class="n">${L('Max slope (100 m)', 'Pendiente máx. (100 m)')}</th></tr></thead>
    <tbody>${g100.length ? `<tr><td>100 m (Artemis III)</td>${ring(g100).map((x) => `<td class="n">${x}</td>`).join('')}</tr>` : ''}
    <tr><td>200 m</td>${ring(grid).map((x) => `<td class="n">${x}</td>`).join('')}</tr></tbody></table>
  ${best ? `<p>${L(`Suggested spot within 100 m with slope under 10°: <b>${best.p.e} m E, ${best.p.n} m N</b> — Sun ${pct(best.m.sunlightPct)}, Earth ${pct(best.m.earthLinkPct)}, Sun and Earth together ${pct(best.m.opsPct)}, longest night ${best.m.longestNightH} h, slope ${nf(best.p.slope, 1)}°.`, `Punto sugerido a menos de 100 m con pendiente de menos de 10°: <b>${best.p.e} m E, ${best.p.n} m N</b> — Sol ${pct(best.m.sunlightPct)}, Tierra ${pct(best.m.earthLinkPct)}, Sol y Tierra a la vez ${pct(best.m.opsPct)}, noche más larga ${best.m.longestNightH} h, pendiente ${nf(best.p.slope, 1)}°.`)}</p>` : ''}` : ''}

  <h3>4.5 ${L('Alternative sites and dates', 'Sitios y fechas alternativos')}</h3>
  <table class="grid"><caption>${L('Table 4. Other team sites, same dates', 'Tabla 4. Otros sitios del equipo, mismas fechas')}</caption>
    <thead><tr><th>${L('Site', 'Sitio')}</th><th class="n">${L('Distance', 'Distancia')}</th><th>${L('Assessment', 'Evaluación')}</th><th class="n">${L('Sunlight', 'Luz solar')}</th><th class="n">${L('Earth', 'Tierra')}</th><th class="n">${L('Longest night', 'Noche más larga')}</th><th class="n">${L('Energy', 'Energía')}</th></tr></thead><tbody>${otherRows}</tbody></table>
  ${scenRows ? `<table class="grid"><caption>${L('Table 5. Same site, later landing, and saved scenarios', 'Tabla 5. Mismo sitio con alunizaje más tarde, y escenarios guardados')}</caption>
    <thead><tr><th>${L('Scenario', 'Escenario')}</th><th>${L('Assessment', 'Evaluación')}</th><th class="n">${L('Sunlight', 'Luz solar')}</th><th class="n">${L('Earth', 'Tierra')}</th><th class="n">${L('Longest night', 'Noche más larga')}</th><th class="n">${L('Energy', 'Energía')}</th><th class="n">${L('Without Earth', 'Sin Tierra')}</th></tr></thead><tbody>${scenRows}</tbody></table>` : ''}
</section>

<section>
  <h2>5 ${L('Compliance with requirements', 'Cumplimiento de requisitos')}</h2>
  <table class="grid"><caption>${L('Table 6. Mission requirements', 'Tabla 6. Requisitos de la misión')}</caption>
    <thead><tr><th>${L('Requirement', 'Requisito')}</th><th>${L('Asked', 'Pedido')}</th><th class="n">${L('Result', 'Resultado')}</th><th>${L('Status', 'Estado')}</th></tr></thead>
    <tbody>${reqs.map(([k, q, v, b]) => `<tr><td>${k}</td><td>${q}</td><td class="n">${v}</td><td>${ok(b)}</td></tr>`).join('')}
    ${maxSlope100 !== null ? `<tr><td>${L('Landing slope (Artemis III)', 'Pendiente de alunizaje (Artemis III)')} [${ref(1)}]</td><td>&lt; 10° ${L('over 100 m, within 100 m', 'sobre 100 m, a menos de 100 m')}</td><td class="n">${nf(maxSlope100, 1)}°</td><td>${ok(maxSlope100 < ARTEMIS3.maxLandingSlopeDeg)}</td></tr>` : ''}</tbody></table>
</section>

<section>
  <h2>6 ${L('Limitations', 'Limitaciones')}</h2>
  <ul class="method">
    <li>${L('Constant power through the night; no solar charging, battery ageing or temperature effects. Long polar nights are often survived with radioisotope heater units or hibernation rather than batteries alone.', 'Potencia constante durante la noche; sin recarga solar, envejecimiento de la batería ni efectos de temperatura. Las noches polares largas a menudo se superan con calentadores de radioisótopos o hibernación, no solo con baterías.')}</li>
    <li>${L('Horizons use LOLA maps of 5 m and 80 m: boulders and craters under about 10 m are not seen.', 'Los horizontes usan mapas LOLA de 5 m y 80 m: no se ven rocas ni cráteres de menos de unos 10 m.')}</li>
    <li>${L('The landing grid covers 200 m around the five team sites only.', 'La malla de alunizaje cubre solo 200 m alrededor de los cinco sitios del equipo.')}</li>
    <li>${L('Requirement thresholds are the team\'s criteria, not NASA standards; every result is an indication from the data, not a mission decision.', 'Los umbrales de los requisitos son criterio del equipo, no normas de la NASA; cada resultado es una orientación a partir de los datos, no una decisión de misión.')}</li>
  </ul>
</section>

${dayRows ? `<section class="pagebreak">
  <h2>${L('Appendix A. Day-by-day hours', 'Apéndice A. Horas día a día')}</h2>
  <table class="grid days"><caption>${L('Table A1. Hours per day', 'Tabla A1. Horas por día')}</caption>
    <thead><tr><th>${L('Day', 'Día')}</th><th>${L('Date (UTC)', 'Fecha (UTC)')}</th><th class="n">${L('Sun', 'Sol')}</th><th class="n">${L('Earth', 'Tierra')}</th><th class="n">${L('Both', 'Ambos')}</th><th>${L('Sun', 'Sol')}</th></tr></thead><tbody>${dayRows}</tbody></table>
</section>` : ''}

<section>
  <h2>${L('References', 'Referencias')}</h2>
  <ol class="refs">
    <li id="ref1">Fincannon, J. Lunar South Pole Illumination: Review, Reassessment, and Power System Implications. NASA/TM-2007-215025, NASA Glenn Research Center, 2007. <a href="https://ntrs.nasa.gov/citations/20070034951">https://ntrs.nasa.gov/citations/20070034951</a></li>
    <li id="ref2">Wueller et al. (2026), Journal of Geophysical Research: Planets (CC BY 4.0). <a href="https://doi.org/10.1029/2025JE009434">https://doi.org/10.1029/2025JE009434</a></li>
    <li id="ref3">Mazarico, E. et al. Illumination conditions of the lunar polar regions using LOLA topography. Icarus 211, 2011. NASA PGDA product 69. <a href="https://doi.org/10.1016/j.icarus.2010.10.030">https://doi.org/10.1016/j.icarus.2010.10.030</a></li>
    ${srcs}
  </ol>
</section>

<section class="docpage">
  <h2>${L('Report documentation', 'Ficha del informe')}</h2>
  <table class="kv">
    <tr><th>${L('Report number', 'Número de informe')}</th><td>${esc(repNo)}</td></tr><tr><th>${L('Report date', 'Fecha del informe')}</th><td>${dt(generated)}</td></tr>
    <tr><th>${L('Title', 'Título')}</th><td>${L('Landing Site Assessment', 'Evaluación del sitio de alunizaje')}: ${esc(r.siteName)}</td></tr>
    <tr><th>${L('Prepared by', 'Preparado por')}</th><td>${L('Fly Me to the Moon team, NASA Space Apps Challenge 2026, Madrid', 'Equipo Fly Me to the Moon, NASA Space Apps Challenge 2026, Madrid')}</td></tr>
    <tr><th>${L('Data', 'Datos')}</th><td>NASA LRO LOLA (PGDA 78, 5 m; PGDA 90, 80 m); JPL Horizons DE441, ${day(DATA.start)} – ${day(DATA.end)}</td></tr>
    <tr><th>${L('Keywords', 'Palabras clave')}</th><td>${L('lunar south pole; illumination; Earth visibility; energy storage; landing site; Artemis III', 'polo sur lunar; iluminación; visibilidad de la Tierra; almacenamiento de energía; sitio de alunizaje; Artemis III')}</td></tr>
    <tr><th>${L('Distribution', 'Distribución')}</th><td>${L('Public', 'Pública')}</td></tr>
    <tr><th>${L('Disclaimer', 'Aviso')}</th><td>${L('Not a NASA document. Figures computed by Fly Me to the Moon from NASA data. Results are suggestions, not mission decisions.', 'No es un documento de la NASA. Cifras calculadas por Fly Me to the Moon con datos de la NASA. Los resultados son sugerencias, no decisiones de misión.')}</td></tr>
  </table>
</section>
</body></html>`
}
