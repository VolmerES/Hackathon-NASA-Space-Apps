import type { Sample } from '../data/model'
import { useT } from '../i18n'

function runs(samples: Sample[], on: (s: Sample) => boolean) {
  const out: { from: number; to: number }[] = []
  let start = -1
  samples.forEach((s, i) => {
    if (on(s) && start < 0) start = i
    if (!on(s) && start >= 0) {
      out.push({ from: start, to: i })
      start = -1
    }
  })
  if (start >= 0) out.push({ from: start, to: samples.length })
  return out
}

function Band({ samples, on, color, label }: { samples: Sample[]; on: (s: Sample) => boolean; color: string; label: string }) {
  const n = samples.length
  return (
    <div className="relative h-2.5 bg-wash" role="img" aria-label={label}>
      {runs(samples, on).map((r) => (
        <div key={r.from} className="absolute inset-y-0" style={{ left: `${(100 * r.from) / n}%`, width: `${(100 * (r.to - r.from)) / n}%`, background: color }} />
      ))}
    </div>
  )
}

// The whole stay at a glance: when there is sunlight, and when Earth can be reached.
// With `from` and `to`, a time axis runs under it: start, end, a tick per day and the length in hours.
export function StayBar({ samples, madrid = false, from, to }: { samples: Sample[]; madrid?: boolean; from?: string; to?: string }) {
  const t = useT()
  const n = samples.length
  const days = Array.from({ length: Math.max(0, Math.ceil(n / 24) - 1) }, (_, i) => (i + 1) * 24).filter((h) => h < n)
  return (
    <div>
      <div className="relative space-y-1">
        <Band samples={samples} on={(s) => s.sunVisible > 0.5} color="var(--color-sun)" label={t.barSun} />
        <Band samples={samples} on={(s) => s.earthVisible} color="var(--color-earth)" label={t.barEarth} />
        {madrid && <Band samples={samples} on={(s) => s.madridLink} color="var(--color-nasa-red)" label={t.barMadrid} />}
        {from &&
          days.length <= 14 &&
          days.map((h) => <span key={h} aria-hidden="true" className="absolute -top-0.5 -bottom-0.5 w-px bg-white/35" style={{ left: `${(100 * h) / n}%` }} />)}
      </div>
      {from && (
        <div className="mt-1 flex items-baseline justify-between gap-2 text-[11px] tabular-nums text-muted">
          <span className="whitespace-nowrap">{from}</span>
          <span className="whitespace-nowrap font-semibold text-ink">{t.stayAxis(String(n))}</span>
          <span className="whitespace-nowrap text-right">{to}</span>
        </div>
      )}
    </div>
  )
}
