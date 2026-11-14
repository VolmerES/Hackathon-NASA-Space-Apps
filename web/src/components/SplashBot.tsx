// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
// Franky in 3D on the opening screen: rolls in from the side, turns to the viewer, waves and asks how
// to start; once a mode is chosen he waves goodbye and rolls off to the right. Driven through the
// shared stage in franky3d.ts. Until the model is in (or if WebGL fails) the screen is simply without him.
import { useEffect, useRef, useState } from 'react'
import { createFranky, type FrankyStage } from './franky3d'
import * as sfx from '../sound'

export function SplashBot({ width, height, leaving = false, onWave }: { width: number; height: number; leaving?: boolean; onWave?: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const stage = useRef<FrankyStage | null>(null)
  const [shown, setShown] = useState(false)
  const waved = useRef(onWave)
  useEffect(() => {
    waved.current = onWave
  }, [onWave])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const s = createFranky(el, width, height, reduce ? { x: 0, facing: -0.18 } : { x: -2.8, facing: Math.PI / 2, rolling: true })
    stage.current = s
    const timers: number[] = []
    const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, reduce ? 0 : ms))
    s.loaded.then((ok) => {
      if (!ok) return
      setShown(true)
      // Roll in, turn to the viewer, wave, and ask.
      s.set({ x: 0 })
      at(1500, () => s.set({ rolling: false, facing: -0.18 }))
      at(2000, () => {
        s.set({ waving: true })
        sfx.chirp('hello')
        waved.current?.()
      })
      at(4600, () => s.set({ waving: false }))
      // Every 9 s, a short wave again while waiting.
      timers.push(
        window.setInterval(() => {
          s.set({ waving: true })
          window.setTimeout(() => s.set({ waving: false }), 1600)
        }, 9000),
      )
    })
    return () => {
      timers.forEach((t) => {
        window.clearTimeout(t)
        window.clearInterval(t)
      })
      s.dispose()
      stage.current = null
    }
  }, [width, height])

  // A mode chosen: wave goodbye, turn right and roll off.
  useEffect(() => {
    const s = stage.current
    if (!leaving || !s) return
    s.set({ waving: true })
    sfx.chirp('bye')
    const a = window.setTimeout(() => s.set({ waving: false, facing: Math.PI / 2, rolling: true }), 450)
    const b = window.setTimeout(() => s.set({ x: 3.2 }), 650)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [leaving])

  // Both edges fade, so Franky rolls in and out of the dark instead of being cut at the canvas edge.
  const mask = 'linear-gradient(90deg, transparent, #000 25%, #000 80%, transparent)'
  return <div ref={box} aria-hidden="true" className={`transition-opacity duration-500 ${shown ? 'opacity-100' : 'opacity-0'}`} style={{ width, height, maskImage: mask, WebkitMaskImage: mask }} />
}
