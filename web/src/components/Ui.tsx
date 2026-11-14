import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { useStay } from '../hooks'

/** Short confirmation at the bottom of the screen. Announced to screen readers. */
export function Snackbar({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(onDone, 2600)
    return () => window.clearTimeout(id)
  }, [message, onDone])
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {message && <p key={message} className="toast-in pointer-events-auto max-w-md rounded-sm bg-ink/85 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-md">{message}</p>}
    </div>
  )
}

export type MenuItem = { label: string; onSelect: () => void; hidden?: boolean }

/** Dropdown menu: opens on click, closes on Escape, on a choice or on a click outside. */
export function Menu({ label, items, className = '' }: { label: string; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const stay = useStay(open, 220)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  return (
    <div ref={root} className={`relative ${className}`} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-11 items-center gap-2 rounded-sm border border-white/50 px-3 text-sm hover:bg-white/10 lg:min-h-9">
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {stay.value && (
        <ul role="menu" className={`${stay.leaving ? 'pop-out' : 'pop-in'} absolute right-0 z-40 mt-1 min-w-56 border border-white/15 bg-black/85 py-1 text-white shadow-xl backdrop-blur-md`}>
          {items
            .filter((i) => !i.hidden)
            .map((i) => (
              <li key={i.label} role="none">
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    i.onSelect()
                  }}
                  className="block min-h-11 w-full px-4 text-left text-sm hover:bg-white/10 lg:min-h-10"
                >
                  {i.label}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

/** Hamburger button on the left of the header; its panel holds language, actions and notes. */
export function HamburgerMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  return (
    <div ref={root} className="relative" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button aria-haspopup="true" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen((o) => !o)} className="flex size-11 items-center justify-center rounded-sm border border-white/40 hover:bg-white/10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={open ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </>
          )}
        </svg>
      </button>
      {open && <div className="pop-in absolute right-0 z-40 mt-1 w-72 border border-white/15 bg-black/90 py-2 text-white shadow-xl backdrop-blur-md">{children(() => setOpen(false))}</div>}
    </div>
  )
}

/**
 * The one button that closes, folds or goes back, everywhere: a 44 px target with a clear outline,
 * an X (close), a chevron (fold) or an arrow (back), and the word next to it when `withText`.
 */
export function CloseButton({ label, onClick, kind = 'close', withText = false, className = '' }: { label: string; onClick: () => void; kind?: 'close' | 'fold' | 'back'; withText?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-sm border border-white/30 bg-white/5 text-sm font-semibold text-ink transition-colors hover:border-white/60 hover:bg-white/15 active:bg-white/25 ${withText ? (kind === 'back' ? 'px-3.5' : 'sm:px-3.5') : ''} ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === 'close' ? <path d="M6 6l12 12M18 6L6 18" /> : kind === 'back' ? <path d="M19 12H5M11 6l-6 6 6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
      {withText && <span className={kind === 'back' ? '' : 'max-sm:hidden'}>{label}</span>}
    </button>
  )
}

/** Modal overlay over a translucent backdrop (native dialog: focus trap and Escape for free). */
export function Overlay({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.classList.remove('modal-leaving')
      d.showModal()
    }
    if (!open && d.open) {
      // Sink out first, then close for real.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return d.close()
      d.classList.add('modal-leaving')
      const id = window.setTimeout(() => {
        d.classList.remove('modal-leaving')
        d.close()
      }, 300)
      return () => {
        window.clearTimeout(id)
        d.classList.remove('modal-leaving')
      }
    }
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        // Escape: ask to close, so the dialog can leave softly.
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="modal-soft m-auto w-[min(560px,calc(100%-32px))] border border-rule bg-paper/95 p-0 text-ink shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <CloseButton label={t.close} onClick={onClose} withText />
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  )
}

/** Translucent panel laid over a chart or the 3D view; folds to its title. */
export function FloatPanel({ title, children, className = '', defaultOpen = true }: { title: string; children: ReactNode; className?: string; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className={`group absolute z-10 max-w-[min(340px,calc(100%-16px))] border border-white/15 bg-black/55 text-white backdrop-blur-md ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 pl-3 pr-1.5 text-xs font-semibold">
        {title}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="rounded-sm border border-white/30 p-1 transition-transform group-open:rotate-180">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-3 pb-2.5 text-xs leading-relaxed">{children}</div>
    </details>
  )
}

/**
 * A number field you can type into freely: it may be empty or half-typed while you write (so "1" can
 * be cleared to type "30"); each valid value inside [min, max] applies at once, and on leaving the
 * field anything else is put back inside the range.
 */
export function NumberField({ value, min, max, step = 1, onValue, className = '', ...rest }: {
  value: number
  min: number
  max: number
  step?: number
  onValue: (n: number) => void
  className?: string
  'aria-label'?: string
  title?: string
  required?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const commit = () => {
    if (draft === null) return
    const n = Number(draft.replace(',', '.'))
    onValue(draft.trim() === '' || !Number.isFinite(n) ? clamp(value) : clamp(n))
    setDraft(null)
  }
  return (
    <input
      type="text"
      inputMode={step < 1 ? 'decimal' : 'numeric'}
      value={draft ?? String(value)}
      onChange={(e) => {
        const text = e.target.value
        if (!/^-?\d*([.,]\d*)?$/.test(text)) return
        setDraft(text)
        const n = Number(text.replace(',', '.'))
        if (text.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onValue(n)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const base = draft !== null && Number.isFinite(Number(draft.replace(',', '.'))) && draft.trim() !== '' ? Number(draft.replace(',', '.')) : value
          const n = clamp(Math.round((base + (e.key === 'ArrowUp' ? step : -step)) * 1000) / 1000)
          setDraft(null)
          onValue(n)
        }
      }}
      className={className}
      {...rest}
    />
  )
}
