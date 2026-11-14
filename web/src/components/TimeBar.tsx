// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
import { useState } from 'react'
import type { DayPlan } from '../data/model'
import { useT } from '../i18n'
import { LandingCalendar } from './LandingCalendar'

const HOUR = 3600000

// Quick date, hour and days on the surface, one line in the header. The slider moves only through
// the stay, hour by hour: the Moon's light and shadows, and the sky chart, follow it. Behind it, the
// hours of sunlight at the chosen site (brighter = Sun up), so the dark spells of the stay show.
export function TimeBar({ start, min, max, stay, index, sunHours, plan, label, onStart, onStay, onScrub }: {
  /** Start of the stay (landing, plus any slip). */
  start: Date
  /** Range of the data, for the date field. */
  min: Date
  max: Date
  /** Days on the surface. */
  stay: number
  /** Hours since the start of the stay shown now. */
  index: number
  /** Fraction of the solar disc in view at the chosen site, hour by hour over the stay. */
  sunHours?: number[]
  /** Landing calendar of the chosen site for this stay: colours the days and hours to choose from. */
  plan?: DayPlan[]
  label: (d: Date) => string
  onStart: (d: Date) => void
  onStay: (days: number) => void
  onScrub: (hours: number) => void
}) {
  const t = useT()
  // Phones: folded into one line until tapped; from sm up it is always open.
  const [open, setOpen] = useState(false)
  const last = Math.max(1, sunHours?.length ? sunHours.length - 1 : stay * 24)
  const at = new Date(start.getTime() + Math.min(index, last) * HOUR)
  // Where the thumb is: day of the stay, and its date and hour.
  const day = Math.min(stay, Math.floor(Math.min(index, last) / 24) + 1)
  const when = `${at.toLocaleDateString(t.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${at.toISOString().slice(11, 16)} UTC`

  const startLabel = `${start.toLocaleDateString(t.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} · ${start.toISOString().slice(11, 16)}`

  return (
    <>
    {/* Phones, folded: one line with the date, hour and days; tap to open the whole bar. */}
    {!open && (
      <button type="button" onClick={() => setOpen(true)} aria-expanded={false} aria-label={`${t.timeBarTitle}: ${startLabel} UTC, ${stay} ${t.daysShort}`} className="glass flex min-h-9 w-full items-center gap-2 px-2.5 text-xs sm:hidden">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-sun" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <span className="truncate tabular-nums text-ink">{startLabel} UTC</span>
        <span className="shrink-0 text-muted">· {stay} {t.daysShort}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="ml-auto shrink-0 text-muted" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    )}
    <div className={`glass flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 sm:flex sm:flex-nowrap ${open ? 'flex' : 'hidden'}`} title={t.timeBarTitle}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-sun" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <LandingCalendar value={start} min={min} max={max} plan={plan} onPick={onStart} />
      <input
        type="time"
        step={3600}
        aria-label={t.landingHour}
        value={start.toISOString().slice(11, 16)}
        onChange={(e) => {
          const [h, mi] = e.target.value.split(':').map(Number)
          if (!Number.isFinite(h)) return
          const day = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
          onStart(new Date(Math.min(max.getTime(), Math.max(min.getTime(), day + (h * 60 + (mi || 0)) * 60000))))
        }}
        className="h-8 w-[5.5rem] shrink-0 rounded-sm border border-white/20 bg-black/40 px-1.5 text-xs text-ink"
      />
      <span className="hidden text-[11px] text-muted sm:inline">UTC</span>
      <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted" title={t.daysOnSurface}>
        <input
          type="number"
          aria-label={t.daysOnSurface}
          min={1}
          max={60}
          value={stay}
          onChange={(e) => onStay(Math.min(60, Math.max(1, Math.round(Number(e.target.value)) || 1)))}
          className="h-8 w-12 rounded-sm border border-white/20 bg-black/40 px-1.5 text-xs text-ink"
        />
        {t.daysShort}
      </label>
      <output className="ml-auto shrink-0 rounded-sm bg-sun/15 px-2 py-1 text-xs tabular-nums text-ink sm:order-last sm:ml-0">
        <strong className="font-semibold text-sun">{t.dayOfStay(day, stay)}</strong> · {when}
      </output>
      <div className="relative min-w-0 flex-1 basis-full sm:basis-auto" title={sunHours?.length ? t.timeBarStrip : undefined}>
        {sunHours && sunHours.length > 1 && (
          <svg className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full" viewBox={`0 0 ${sunHours.length} 1`} preserveAspectRatio="none" aria-hidden="true">
            {sunHours.map((v, i) => (
              <rect key={i} x={i} y={0} width={1.02} height={1} fill="#ffc94a" opacity={0.08 + 0.92 * v} />
            ))}
          </svg>
        )}
        <input
          type="range"
          aria-label={t.timeBarSlider}
          aria-valuetext={label(at)}
          min={0}
          max={last}
          step={1}
          value={Math.min(index, last)}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="time-range relative block h-8 w-full cursor-pointer"
        />
      </div>
      <button type="button" onClick={() => setOpen(false)} aria-label={t.timeBarFold} title={t.timeBarFold} className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-white/10 hover:text-ink sm:hidden">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
      </button>
    </div>
    </>
  )
}
