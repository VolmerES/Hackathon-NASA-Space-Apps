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
export function StayBar({ samples, madrid = false }: { samples: Sample[]; madrid?: boolean }) {
  const t = useT()
  return (
    <div className="space-y-1">
      <Band samples={samples} on={(s) => s.sunVisible > 0.5} color="var(--color-sun)" label={t.barSun} />
      <Band samples={samples} on={(s) => s.earthVisible} color="var(--color-earth)" label={t.barEarth} />
      {madrid && <Band samples={samples} on={(s) => s.madridLink} color="var(--color-nasa-red)" label={t.barMadrid} />}
    </div>
  )
}
