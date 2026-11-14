import { useEffect, useRef, useState } from 'react'
import type { Config, Data, Layout } from 'plotly.js'
import { useT } from '../i18n'

type PlotlyModule = {
  react: (el: HTMLElement, data: Data[], layout: Partial<Layout>, config: Partial<Config>) => Promise<unknown>
  purge: (el: HTMLElement) => void
}

let plotlyPromise: Promise<PlotlyModule> | null = null
export function loadPlotly(): Promise<PlotlyModule> {
  // Loaded only when a chart is shown, so the first screen stays light.
  plotlyPromise ??= import('plotly.js-basic-dist-min').then((m) => (m.default ?? m) as PlotlyModule)
  return plotlyPromise
}

export const DARK_LAYOUT: Partial<Layout> = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#d9dce2', family: '"Public Sans Variable", Helvetica, Arial, sans-serif', size: 13 },
  margin: { l: 48, r: 16, t: 8, b: 36 },
  showlegend: false,
}

export function Plot({ data, layout, height }: { data: Data[]; layout: Partial<Layout>; height: number }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    loadPlotly()
      .then((Plotly) => {
        if (!cancelled) return Plotly.react(el, data, { ...DARK_LAYOUT, ...layout, height }, { displaylogo: false, responsive: true })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
  }, [data, layout, height])

  useEffect(() => {
    const el = ref.current
    return () => {
      if (el && plotlyPromise) plotlyPromise.then((P) => P.purge(el)).catch(() => {})
    }
  }, [])

  if (failed) {
    return (
      <div className="flex items-center justify-center text-sm text-white/70" style={{ height }}>
        {t.chartUnavailable}
      </div>
    )
  }
  return <div ref={ref} style={{ height }} />
}
