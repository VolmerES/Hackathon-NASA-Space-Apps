import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createFranky, type FrankyStage } from './franky3d'
import * as sfx from '../sound'

// The guided tour: Franky walks a newcomer through the tool in a few fixed steps. No AI here: the
// same words every time, it works offline, and it can be skipped at any moment. Each step can point
// at a part of the page (data-franky="…"); the rest of the screen dims around it. Franky himself, in 3D,
// rides inside the bubble (no turning about the screen): the bubble glides to each step and he waves
// when it gets there; at the end the bubble shrinks into the chat button (data-franky="franky").
export type TourStep = { target?: string; title: string; text: string; before?: () => void }
export type TourText = { next: string; back: string; skip: string; done: string; chat: string; step: (i: number, n: number) => string }

const PAD = 8

export function FrankyTour({ steps, text, onClose, onChat }: { steps: TourStep[]; text: TourText; onClose: () => void; onChat: () => void }) {
  const [i, setI] = useState(0)
  const [exit, setExit] = useState<{ x: number; y: number } | null>(null)
  // Leaving: Franky rolls into the chat button, then the tour closes (and the chat opens, if asked).
  const leave = (chat = false) => {
    if (exit) return
    const btn = document.querySelector<HTMLElement>('[data-franky="franky"]')?.getBoundingClientRect()
    const done = () => {
      onClose()
      if (chat) onChat()
    }
    if (!btn || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return done()
    setExit({ x: btn.left + btn.width / 2, y: btn.top + btn.height / 2 })
    sfx.chirp('in')
    window.setTimeout(done, 950)
  }
  const [rect, setRect] = useState<DOMRect | null>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const [bubblePos, setBubblePos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const step = steps[i]

  useEffect(() => {
    step.before?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // Follow the target while it moves (panels sliding in, the Moon's buttons fading in).
  useEffect(() => {
    let raf = 0
    let last = ''
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = step.target ? document.querySelector<HTMLElement>(`[data-franky="${step.target}"]`) : null
      // The box around what is really drawn: the union of its children (some containers are
      // positioned by a transform, or are wider than their buttons).
      let r: DOMRect | null = null
      if (el && el.getClientRects().length) {
        const kids = [...el.children].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0)
        if (kids.length) {
          const x0 = Math.min(...kids.map((b) => b.left))
          const y0 = Math.min(...kids.map((b) => b.top))
          r = new DOMRect(x0, y0, Math.max(...kids.map((b) => b.right)) - x0, Math.max(...kids.map((b) => b.bottom)) - y0)
        } else r = el.getBoundingClientRect()
      }
      const key = r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : ''
      if (key !== last) {
        last = key
        setRect(r && r.width > 0 && r.height > 0 ? r : null)
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [step.target])

  // Put the bubble beside the target: below it if there is room, else above; centred when no target.
  useLayoutEffect(() => {
    const b = bubble.current
    if (!b) return
    const w = window.innerWidth
    const h = window.innerHeight
    const bw = b.offsetWidth
    const bh = b.offsetHeight
    if (!rect) return setBubblePos({ left: (w - bw) / 2, top: (h - bh) / 2 })
    const below = rect.bottom + PAD + 12
    const above = rect.top - PAD - 12 - bh
    const top = below + bh < h - 8 ? below : above > 8 ? above : Math.max(8, Math.min(h - bh - 8, rect.top))
    const sideFits = top === Math.max(8, Math.min(h - bh - 8, rect.top)) && below + bh >= h - 8 && above <= 8
    let left = rect.left + rect.width / 2 - bw / 2
    if (sideFits) left = rect.right + 16 + bw < w ? rect.right + 16 : rect.left - 16 - bw
    setBubblePos({ left: Math.max(8, Math.min(w - bw - 8, left)), top })
  }, [rect, i])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave()
      if (e.key === 'ArrowRight') setI((x) => Math.min(steps.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, steps.length, exit])

  const last = i === steps.length - 1
  return (
    <div className="pointer-events-auto fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* The dim layer with a window over the target. */}
      {rect ? (
        <div
          className="fk-hole pointer-events-none fixed rounded-lg"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-black/65" />
      )}
      <div className="fixed inset-0" onClick={() => undefined} />
      <div
        ref={bubble}
        className="fk-bubble fixed w-[min(460px,calc(100vw-16px))] rounded-xl border border-sun/40 bg-[#0b0f18]/95 p-4 text-sm text-white shadow-2xl backdrop-blur-md"
        style={{
          left: bubblePos.left,
          top: bubblePos.top,
          ...(exit && bubble.current
            ? {
                transform: `translate(${exit.x - bubblePos.left - bubble.current.offsetWidth / 2}px, ${exit.y - bubblePos.top - bubble.current.offsetHeight / 2}px) scale(0.08)`,
                opacity: 0,
                transition: 'transform 0.8s cubic-bezier(0.45, 0, 0.25, 1), opacity 0.4s ease 0.4s',
              }
            : {}),
        }}
      >
        <div className="flex gap-3">
          <BubbleBot step={i} />
          <div key={i} className="ui-in min-w-0 flex-1 self-center">
            <p className="text-[11px] text-white/50">{text.step(i + 1, steps.length)}</p>
            <p className="mt-0.5 text-base font-semibold leading-snug">{step.title}</p>
            <p className="mt-1 leading-relaxed text-white/85">{step.text}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => leave()} className="min-h-10 px-2 text-white/60 underline-offset-4 hover:text-white hover:underline">
            {text.skip}
          </button>
          <span className="ml-auto" />
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)} className="min-h-10 rounded-sm border border-white/25 px-3 hover:bg-white/10">
              {text.back}
            </button>
          )}
          {last ? (
            <>
              <button type="button" onClick={() => leave(true)} className="min-h-10 rounded-sm border border-sun/70 px-3 font-semibold text-sun hover:bg-sun/10">
                {text.chat}
              </button>
              <button type="button" onClick={() => leave()} className="min-h-10 rounded-sm bg-sun px-3 font-semibold text-black hover:brightness-110">
                {text.done}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setI(i + 1)} autoFocus className="min-h-10 rounded-sm bg-sun px-4 font-semibold text-black hover:brightness-110">
              {text.next}
            </button>
          )}
        </div>
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {steps.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-sun' : 'w-1.5 bg-white/25'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Franky in 3D inside the bubble, at the left of the words, turned a little towards them. He waves
// on arrival and at each new step; he never rolls about or turns round.
function BubbleBot({ step }: { step: number }) {
  const small = window.innerWidth < 640
  const W = small ? 72 : 108
  const H = small ? 90 : 134
  const box = useRef<HTMLDivElement>(null)
  const stage = useRef<FrankyStage | null>(null)
  const first = useRef(true)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const s = createFranky(el, W, H, { facing: 0.35 })
    stage.current = s
    s.loaded.then((ok) => {
      if (!ok) return
      s.set({ waving: true })
      sfx.chirp('hello')
      window.setTimeout(() => s.set({ waving: false }), 1600)
    })
    return () => {
      s.dispose()
      stage.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const s = stage.current
    if (!s) return
    // Waits for the bubble to glide into place, then a short wave.
    const a = window.setTimeout(() => {
      s.set({ waving: true })
      sfx.chirp('step')
    }, 420)
    const b = window.setTimeout(() => s.set({ waving: false }), 1500)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [step])

  return <div ref={box} aria-hidden="true" className="-my-2 -ml-1 shrink-0 self-end" style={{ width: W, height: H }} />
}
