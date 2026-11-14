import { useCallback, useEffect, useRef, useState } from 'react'

/** True while the media query matches (e.g. the one-screen desktop layout). */
export function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    on()
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

/** Live height of an element, so charts can fill the panel they sit in. A callback ref, so it
 *  starts measuring whenever the element appears (panels mount later than the app). */
export function useBoxHeight<T extends HTMLElement>() {
  const [h, setH] = useState(0)
  const ro = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect()
    ro.current = null
    if (!el) return
    const measure = () => setH(Math.floor(el.clientHeight))
    ro.current = new ResizeObserver(measure)
    ro.current.observe(el)
    measure()
  }, [])
  return [ref, h] as const
}

/** Keeps the last value on screen a moment after it goes away, so panels can fade out instead
 *  of vanishing. `leaving` is true during that moment. No delay with reduced motion. */
export function useStay<T>(value: T | null | undefined | false, ms = 380) {
  const [kept, setKept] = useState<T | null>(value || null)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (value) {
      setKept(value)
      setLeaving(false)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setKept(null)
      return
    }
    setLeaving(true)
    const id = window.setTimeout(() => {
      setKept(null)
      setLeaving(false)
    }, ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return { value: value || kept, leaving: !value && leaving }
}
