import { useId } from 'react'

// Fly Me to the Moon mark: the Moon with wings, the name in one picture. The thin gold crescent on the
// disc's lower limb is sunlight grazing the south pole, which is what the tool measures. Solid shapes so it reads at 16 px.
// The same drawing is in public/favicon.svg and in the PWA icons (made from it with headless Chrome).
const FEATHERS = [
  { d: 'M41 27 C50 22 56 18 62.5 15.5 C58.5 22 51.5 27 42 30.5 Z', o: 1 },
  { d: 'M42 32.2 C50 29.4 55.5 27.6 61 26.6 C57 31.2 50.5 33.6 42 35.4 Z', o: 0.78 },
  { d: 'M41 37.4 C48 36.4 52.5 35.6 57 35.6 C53 39.4 47.5 40.6 40 40.6 Z', o: 0.56 },
]

// Cropped to the drawing (wings 1.5–62.5, top feather 15.5, disc bottom 43), so `size` is its height.
const VB = { x: 0, y: 13, w: 64, h: 32 }

export function LogoMark({ size = 28, className = '', animated = false }: { size?: number; className?: string; animated?: boolean }) {
  const clip = `mk-disc-${useId().replace(/:/g, '')}`
  const wing = (side: 'r' | 'l') => (
    <g transform={side === 'l' ? 'matrix(-1 0 0 1 64 0)' : undefined}>
      {FEATHERS.map((f, i) => (
        <path key={i} d={f.d} fill="currentColor" fillOpacity={f.o} className={animated ? `mk-feather mk-f${i}` : undefined} />
      ))}
    </g>
  )
  return (
    <svg width={(size * VB.w) / VB.h} height={size} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} aria-hidden="true" className={className} overflow="visible">
      {wing('r')}
      {wing('l')}
      <clipPath id={clip}>
        <circle cx="32" cy="32" r="11" />
      </clipPath>
      <g className={animated ? 'mk-body' : undefined}>
        <circle cx="32" cy="32" r="11" fill="#f2b705" />
        <g clipPath={`url(#${clip})`}>
          <circle cx="32" cy="29.8" r="11" fill="currentColor" className={animated ? 'mk-lit' : undefined} />
        </g>
      </g>
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 text-white ${className}`}>
      <LogoMark size={22} />
      <span className="wordmark wordmark-tight whitespace-nowrap text-[11px] leading-none min-[400px]:text-[13px] sm:text-base">FLY ME TO THE MOON</span>
    </span>
  )
}
