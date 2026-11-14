// Franky, the little lunar explorer robot that guides the tool and speaks for the assistant. His face
// is a picture of the head of his 3D model (made by the team with Meshy, rendered once to
// public/franky-head.png), so the chat button, the assistant and the tour show the same robot as the
// opening screen. It floats, glows while it thinks, nods while it talks, and turns a little towards
// what it is showing. Animations live in index.css (fk-*) and stop with reduced motion.
export type FrankyMood = 'idle' | 'thinking' | 'talking' | 'happy'

export function FrankyBot({ size = 56, mood = 'idle', look = 0, className = '' }: { size?: number; mood?: FrankyMood; /** -1 left … 1 right */ look?: number; className?: string }) {
  const tilt = Math.max(-1, Math.min(1, look)) * 6
  return (
    <span aria-hidden="true" className={`fk-bot fk-${mood} inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <img src="franky-head.png" alt="" width={size} height={size} draggable={false} className="fk-float fk-head block h-full w-full select-none" style={{ rotate: `${tilt}deg` }} />
    </span>
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
