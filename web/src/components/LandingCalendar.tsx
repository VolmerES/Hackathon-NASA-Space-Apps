// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
import { useEffect, useRef, useState } from 'react'
import type { DayPlan, Metrics } from '../data/model'
import { useT } from '../i18n'

type Verdict = Metrics['verdict']
const DAY = 86400000
const RANK: Record<Verdict, number> = { viable: 0, marginal: 1, 'not-viable': 2 }
const CELL: Record<Verdict, string> = {
  viable: 'bg-ok/80 text-black hover:bg-ok',
  marginal: 'bg-warn/80 text-black hover:bg-warn',
  'not-viable': 'bg-bad/60 text-white hover:bg-bad/80',
}

/** Best verdict among the landing hours of a day (null: no hour has data). */
function bestOf(day?: DayPlan): Verdict | null {
  let best: Verdict | null = null
  for (const v of day?.hours ?? []) if (v && (!best || RANK[v] < RANK[best])) best = v
  return best
}

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

// Month calendar to choose the landing day: each day coloured by its best landing hour for the stay
// that is set (green: lands in a window with Sun and Earth and the whole stay is viable; orange:
// tight; red: no hour works). Under it, the 24 hours of the chosen day, coloured the same way.
export function LandingCalendar({ value, min, max, plan, onPick }: {
  value: Date
  min: Date
  max: Date
  plan?: DayPlan[]
  onPick: (d: Date) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const planStart = plan?.length ? plan[0].t.getTime() : utcDay(min)
  const dayPlan = (ms: number) => plan?.[Math.round((ms - planStart) / DAY)]
  const chosenDay = utcDay(value)
  const hour = value.getUTCHours()
  const minDay = utcDay(min)
  const maxDay = utcDay(max)

  const m = new Date(month)
  const daysInMonth = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).getUTCDate()
  const lead = (m.getUTCDay() + 6) % 7 // weeks start on Monday
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(t.locale, { weekday: 'narrow', timeZone: 'UTC' }))
  const canPrev = month > Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1)
  const canNext = month < Date.UTC(max.getUTCFullYear(), max.getUTCMonth(), 1)
  const shiftMonth = (k: number) => setMonth(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + k, 1))
  const fmtDay = (ms: number) => new Date(ms).toLocaleDateString(t.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const chosenBest = bestOf(dayPlan(chosenDay))
  const hourVerdict = dayPlan(chosenDay)?.hours[hour] ?? null

  return (
    <div ref={root} className="relative shrink-0" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t.calPick}: ${fmtDay(chosenDay)}`}
        onClick={() => {
          if (!open) setMonth(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)) // open on the chosen month
          setOpen((o) => !o)
        }}
        className="flex h-8 items-center gap-1.5 rounded-sm border border-white/20 bg-black/40 px-2 text-xs text-ink hover:border-white/50"
      >
        {plan && <span className={`size-2.5 rounded-full ${hourVerdict ? CELL[hourVerdict].split(' ')[0] : 'bg-white/20'}`} aria-hidden="true" />}
        {fmtDay(chosenDay)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="dialog" aria-label={t.calTitle} className="pop-in absolute left-0 z-50 mt-1 w-[19rem] max-w-[calc(100vw-2rem)] border border-white/15 bg-black/90 p-3 text-white shadow-xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} disabled={!canPrev} aria-label={t.calPrev} className="flex size-9 items-center justify-center rounded-sm hover:bg-white/10 disabled:opacity-30">‹</button>
            <span className="text-sm font-semibold capitalize">{m.toLocaleDateString(t.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
            <button type="button" onClick={() => shiftMonth(1)} disabled={!canNext} aria-label={t.calNext} className="flex size-9 items-center justify-center rounded-sm hover:bg-white/10 disabled:opacity-30">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted" aria-hidden="true">
            {weekdays.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const ms = Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), i + 1)
              const inData = ms >= minDay && ms <= maxDay
              const v = inData ? bestOf(dayPlan(ms)) : null
              const chosen = ms === chosenDay
              const cls = v && plan ? CELL[v] : 'bg-white/5 text-white/40'
              return (
                <button
                  key={ms}
                  type="button"
                  disabled={!inData}
                  onClick={() => onPick(new Date(ms + hour * 3600000))}
                  aria-pressed={chosen}
                  aria-label={`${fmtDay(ms)}: ${v && plan ? t.calVerdict[v] : t.calNoData}`}
                  className={`h-8 rounded-sm text-xs font-semibold tabular-nums disabled:cursor-not-allowed ${cls} ${chosen ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : ''}`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          {plan && (
            <>
              <p className="mt-3 text-[11px] text-muted">{t.calHours(fmtDay(chosenDay))}</p>
              <div className="mt-1 grid grid-cols-12 gap-0.5">
                {Array.from({ length: 24 }, (_, h) => {
                  const v = dayPlan(chosenDay)?.hours[h] ?? null
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onPick(new Date(chosenDay + h * 3600000))}
                      disabled={v === null}
                      aria-pressed={h === hour}
                      aria-label={`${String(h).padStart(2, '0')}:00 UTC: ${v ? t.calVerdict[v] : t.calNoData}`}
                      className={`h-7 rounded-sm text-[10px] tabular-nums disabled:cursor-not-allowed ${v ? CELL[v] : 'bg-white/5 text-white/40'} ${h === hour ? 'ring-2 ring-white' : ''}`}
                    >
                      {String(h).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
              {chosenBest && hourVerdict && RANK[hourVerdict] > RANK[chosenBest] && <p className="mt-1 text-[11px] text-warn">{t.calBetterHour}</p>}
              <ul className="mt-3 space-y-1 text-[11px] text-white/80">
                {(['viable', 'marginal', 'not-viable'] as const).map((v) => (
                  <li key={v} className="flex items-start gap-2">
                    <span className={`mt-0.5 size-2.5 shrink-0 rounded-sm ${CELL[v].split(' ')[0]}`} aria-hidden="true" />
                    {t.calLegend[v]}
                  </li>
                ))}
              </ul>
            </>
          )}
          {!plan && <p className="mt-3 text-[11px] text-muted">{t.calPickSite}</p>}
        </div>
      )}
    </div>
  )
}
