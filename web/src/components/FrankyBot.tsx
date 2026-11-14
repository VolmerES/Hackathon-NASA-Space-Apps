// Franky, the little lunar explorer robot that guides the tool and speaks for the assistant.
// Drawn by hand (SVG, no picture files). It floats, blinks, lights its antenna while it thinks and
// moves its mouth while it talks; its eyes can look towards what it is showing. Animations live in
// index.css (fk-*) and stop with reduced motion.
export type FrankyMood = 'idle' | 'thinking' | 'talking' | 'happy'

export function FrankyBot({ size = 56, mood = 'idle', look = 0, className = '' }: { size?: number; mood?: FrankyMood; /** -1 left … 1 right */ look?: number; className?: string }) {
  const dx = Math.max(-1, Math.min(1, look)) * 2.2
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`fk-bot fk-${mood} ${className}`}>
      <g className="fk-float">
        {/* antenna */}
        <line x1="32" y1="12" x2="32" y2="5" stroke="#9aa3b2" strokeWidth="2" strokeLinecap="round" />
        <circle className="fk-antenna" cx="32" cy="4.5" r="3" fill="#f2b705" />
        {/* head */}
        <rect x="14" y="12" width="36" height="26" rx="9" fill="#e9edf3" />
        <rect x="14" y="12" width="36" height="26" rx="9" fill="url(#fk-shade)" />
        <rect x="18.5" y="16.5" width="27" height="17" rx="6" fill="#0d1220" />
        {/* eyes */}
        <g className="fk-eyes" transform={`translate(${dx} 0)`}>
          <circle cx="26" cy="24.5" r="3.3" fill="#7fd4ff" />
          <circle cx="38" cy="24.5" r="3.3" fill="#7fd4ff" />
          <circle cx="27" cy="23.5" r="1" fill="#fff" />
          <circle cx="39" cy="23.5" r="1" fill="#fff" />
        </g>
        {/* mouth */}
        <rect className="fk-mouth" x="28" y="29.5" width="8" height="1.8" rx="0.9" fill="#7fd4ff" />
        {/* ears */}
        <rect x="10" y="20" width="4" height="10" rx="2" fill="#c3cad6" />
        <rect x="50" y="20" width="4" height="10" rx="2" fill="#c3cad6" />
        {/* body */}
        <rect x="21" y="40" width="22" height="15" rx="5" fill="#d9dee7" />
        <circle cx="32" cy="47.5" r="3" fill="#f2b705" opacity="0.9" />
        {/* arms */}
        <path className="fk-arm-l" d="M21 44 Q14 46 13 51" stroke="#c3cad6" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path className="fk-arm-r" d="M43 44 Q50 46 51 51" stroke="#c3cad6" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* wheels */}
        <circle cx="25" cy="58" r="3.4" fill="#4a5262" />
        <circle cx="39" cy="58" r="3.4" fill="#4a5262" />
      </g>
      <defs>
        <linearGradient id="fk-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Point at a part of the page: open the folds around it, bring it into view and make it glow. */
export function spotlight(key: string, ms = 6500): boolean {
  const el = document.querySelector<HTMLElement>(`[data-franky="${key}"]`)
  if (!el) return false
  for (let p: HTMLElement | null = el; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.classList.remove('fk-spot')
  void el.offsetWidth
  el.classList.add('fk-spot')
  window.setTimeout(() => el.classList.remove('fk-spot'), ms)
  return true
}
