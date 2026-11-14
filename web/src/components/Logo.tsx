// Lunar Landing mark: the Moon's disc, its surface with a ridge, and the Sun just grazing that
// ridge: the light that decides where you can land. Solid, simple shapes so it reads at 16 px.
export const MARK_PATHS = {
  ridge: 'M2 20.6 L6.6 18.9 L9.6 19.7 L13.2 17.3 L16.4 19.1 L19.6 18.3 L23.2 19.9 L30 18.6 L30 31 L2 31 Z',
  sun: { cx: 22.6, cy: 15.2, r: 2.7 },
}

export function LogoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <clipPath id="ll-disc">
          <circle cx="16" cy="16" r="13.2" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="13.2" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.4" />
      <path d={MARK_PATHS.ridge} clipPath="url(#ll-disc)" fill="currentColor" />
      <circle cx={MARK_PATHS.sun.cx} cy={MARK_PATHS.sun.cy} r={MARK_PATHS.sun.r} fill="#f2b705" />
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 text-white ${className}`}>
      <LogoMark />
      <span className="wordmark text-[13px] leading-none min-[400px]:text-[15px] sm:text-base">LUNAR LANDING</span>
    </span>
  )
}
