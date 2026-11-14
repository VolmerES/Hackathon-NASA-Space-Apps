import type { Sample } from '../data/model'
import { useT } from '../i18n'

// The whole stay as a heat map: one row per day, one column per hour (UTC). Each cell says what
// the site has at that hour: Sun and Earth, Sun only, Earth only, or neither. Tapping a cell moves
// the sky view (panorama or street view) to that hour.
const FILL = { both: '#3fcf8e', sun: '#f2b705', earth: '#4f97ea', none: '#1b1f26' } as const

export function StayHeatmap({ samples, cursor, onPick }: { samples: Sample[]; cursor?: number; onPick: (index: number) => void }) {
  const t = useT()
  if (!samples.length) return null
  const t0 = samples[0].t.getTime()
  const day0 = Date.UTC(samples[0].t.getUTCFullYear(), samples[0].t.getUTCMonth(), samples[0].t.getUTCDate())
  const rows = Math.ceil((samples[samples.length - 1].t.getTime() - day0) / 86400000) + 1
  const cells = samples.map((s, i) => {
    const ms = s.t.getTime()
    const r = Math.floor((ms - day0) / 86400000)
    const c = s.t.getUTCHours()
    const lit = s.sunVisible > 0.5
    const kind: keyof typeof FILL = lit && s.earthVisible ? 'both' : lit ? 'sun' : s.earthVisible ? 'earth' : 'none'
    return { i, r, c, kind, label: `${s.t.toISOString().slice(0, 13).replace('T', ' ')}:00 UTC` }
  })
  const rowLabel = (r: number) => new Date(day0 + r * 86400000).toLocaleDateString(t.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const cur = cursor !== undefined ? cells[Math.min(cursor, cells.length - 1)] : undefined
  const h = Math.min(220, Math.max(80, rows * 9))
  void t0
  return (
    <figure className="mt-3">
      <figcaption className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-ink">{t.heatTitle}</span>
        {(['both', 'sun', 'earth', 'none'] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <i className="inline-block size-2.5" style={{ background: FILL[k] }} />
            {t.heatKinds[k]}
          </span>
        ))}
      </figcaption>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-0.5 text-[10px] leading-none text-muted" style={{ height: h }} aria-hidden="true">
          <span>{rowLabel(0)}</span>
          <span>{rowLabel(rows - 1)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <svg viewBox={`0 0 24 ${rows}`} preserveAspectRatio="none" className="block w-full cursor-pointer" style={{ height: h }} role="img" aria-label={t.heatTitle}>
            {cells.map((c) => (
              <rect key={c.i} x={c.c + 0.04} y={c.r + 0.06} width={0.92} height={0.88} fill={FILL[c.kind]} onClick={() => onPick(c.i)}>
                <title>{`${c.label}: ${t.heatKinds[c.kind]}`}</title>
              </rect>
            ))}
            {cur && <rect x={cur.c} y={cur.r} width={1} height={1} fill="none" stroke="#fff" strokeWidth={0.12} />}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-muted" aria-hidden="true">
            <span>00 h</span>
            <span>06 h</span>
            <span>12 h</span>
            <span>18 h</span>
            <span>24 h UTC</span>
          </div>
        </div>
      </div>
    </figure>
  )
}
