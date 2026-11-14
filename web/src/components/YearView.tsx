import type { Day } from '../data/model'
import { useT } from '../i18n'

export type YearMetric = 'sun' | 'earth' | 'both'

const COLOR: Record<YearMetric, string> = { sun: '242,183,5', earth: '79,151,234', both: '120,190,255' }

// Fourteen months hour by hour, one thin column per day: the darker, the more hours of the day
// meet the condition. The outlined band is the stay being planned; clicking a day lands there.
export function YearStrip({
  days,
  metric,
  stayFrom,
  stayDays,
  onPick,
  label,
}: {
  days: Day[]
  metric: YearMetric
  stayFrom: Date
  stayDays: number
  onPick: (d: Date) => void
  label: string
}) {
  const t = useT()
  const n = days.length
  const first = days[0].t.getTime()
  const startIdx = (stayFrom.getTime() - first) / 86400000
  const months = days.filter((d) => d.t.getUTCDate() === 1)
  return (
    <div>
      <svg viewBox={`0 0 ${n} 30`} preserveAspectRatio="none" className="block h-10 w-full cursor-pointer bg-wash lg:h-7" role="img" aria-label={label}>
        {days.map((d, i) => (
          <rect key={i} x={i} y={0} width={1.02} height={30} fill={`rgba(${COLOR[metric]},${0.06 + 0.94 * d[metric]})`} onClick={() => onPick(d.t)}>
            <title>{`${d.t.toISOString().slice(0, 10)}: ${Math.round(d[metric] * 24)} h / 24 h`}</title>
          </rect>
        ))}
        {startIdx > -stayDays && startIdx < n && (
          <rect x={Math.max(0, startIdx)} y={0.75} width={Math.min(stayDays, n - Math.max(0, startIdx))} height={28.5} fill="none" stroke="#ffffff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        )}
      </svg>
      <div className="relative h-5 overflow-hidden text-xs text-muted lg:h-4 lg:text-[11px]" aria-hidden>
        {months.map((d) => {
          const i = (d.t.getTime() - first) / 86400000
          return (
            <span key={i} className="absolute top-0.5 border-l border-rule pl-1" style={{ left: `${(100 * i) / n}%` }}>
              {d.t.toLocaleDateString(t.locale, { month: 'short', timeZone: 'UTC' })}
            </span>
          )
        })}
      </div>
    </div>
  )
}
