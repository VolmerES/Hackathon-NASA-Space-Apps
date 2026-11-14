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
