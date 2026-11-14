// Folding sections (<details>) open and close with a height animation in CSS where the browser
// can (interpolate-size). Where it cannot (Safari, Firefox), this does the same by hand.
export function installSoftDetails() {
  if (typeof CSS !== 'undefined' && CSS.supports('interpolate-size', 'allow-keywords')) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const running = new WeakMap<HTMLDetailsElement, Animation>()
  document.addEventListener('click', (e) => {
    const summary = (e.target as Element | null)?.closest?.('summary')
    const details = summary?.parentElement
    if (!summary || !(details instanceof HTMLDetailsElement) || typeof details.animate !== 'function') return
    e.preventDefault()
    running.get(details)?.cancel()
    const closing = details.open
    const from = details.offsetHeight
    if (!closing) details.open = true
    const cs = getComputedStyle(details)
    const edge = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    const to = closing ? summary.offsetHeight + edge : details.offsetHeight
    details.classList.add('soft-moving')
    const anim = details.animate({ height: [`${from}px`, `${to}px`] }, { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    running.set(details, anim)
    const done = () => {
      if (running.get(details) !== anim) return
      running.delete(details)
      details.classList.remove('soft-moving')
      if (closing) details.open = false
    }
    anim.onfinish = done
    anim.oncancel = () => details.classList.remove('soft-moving')
  })
}
