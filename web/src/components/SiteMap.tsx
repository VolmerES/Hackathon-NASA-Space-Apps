import type { Site } from '../data/model'
import { useT } from '../i18n'

// South pole seen from above, pole at the centre, 85°S at the edge.
// Placeholder for the Moon Trek / LOLA basemap.
export function SiteMap({ sites, chosen, onToggle }: { sites: Site[]; chosen: string[]; onToggle: (id: string) => void }) {
  const t = useT()
  const R = 100
  const maxColat = 7
  const toXY = (lat: number, lon: number) => {
    const r = ((90 + lat) / maxColat) * R
    const a = (lon * Math.PI) / 180
    return { x: R + r * Math.sin(a), y: R - r * Math.cos(a) }
  }
  return (
    <svg viewBox="-4 -4 208 208" className="w-full" role="img" aria-label={t.mapLabel}>
      <circle cx={R} cy={R} r={R} fill="#b9bcc2" />
      {[1, 2, 3, 4].map((c) => (
        <circle key={c} cx={R} cy={R} r={(c / maxColat) * R} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.6" />
      ))}
      <line x1={R} y1={0} x2={R} y2={200} stroke="#fff" strokeOpacity="0.55" strokeWidth="0.6" />
      <line x1={0} y1={R} x2={200} y2={R} stroke="#fff" strokeOpacity="0.55" strokeWidth="0.6" />
      <text x={R + 3} y={9} fontSize="7" fill="#16181d">{t.towardEarth}</text>
      <text x={R + 3} y={R - 3} fontSize="7" fill="#16181d">{t.southPole}</text>
      {sites.map((s, i) => {
        const p = toXY(s.lat, s.lon)
        const on = chosen.includes(s.id)
        const left = i % 2 === 1
        return (
          <g key={s.id} className="cursor-pointer" onClick={() => onToggle(s.id)}>
            <circle cx={p.x} cy={p.y} r={on ? 5 : 3.5} fill={on ? '#0b3d91' : '#fff'} stroke="#16181d" strokeWidth="1" />
            <text
              x={left ? p.x - 7 : p.x + 7}
              y={p.y + (left ? 9 : -2)}
              fontSize="7.5"
              fontWeight={on ? 700 : 400}
              textAnchor={left ? 'end' : 'start'}
              fill="#16181d"
              paintOrder="stroke"
              stroke="#b9bcc2"
              strokeWidth="2.5"
            >
              {on ? s.name : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
