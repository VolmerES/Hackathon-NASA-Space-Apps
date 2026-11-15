import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FrankyBot } from './FrankyBot'
import * as sfx from '../sound'

// Franky, the assistant: helps someone new plan a landing with the tool. A language model (open model
// on Groq, through api/agent.php, which holds the key) reads the question and acts through the tools
// below: it reads the screen, opens panels, points at what is missing, fills values once the person
// says yes, and explains. The tools run here, on the same calculations the web shows, so every figure
// comes from the tool, not from the model. Marked as AI on screen, as Space Apps requires.

type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
type Msg = { role: 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCall[]; tool_call_id?: string }
export type AssistantTools = Record<string, (args: Record<string, unknown>) => unknown>
/** Tools that change the person's settings: Franky asks first, with this summary. */
export type AssistantConfirm = Record<string, (args: Record<string, unknown>) => string>
export type AssistantText = {
  open: string
  title: string
  aiNote: string
  placeholder: string
  send: string
  close: string
  thinking: string
  errRate: string
  errBusy: string
  errOffline: string
  errOther: string
  hello: string
  examples: string[]
  apply: string
  yes: string
  no: string
  tour: string
}

const MAX_ROUNDS = 8

// Plain text with **bold** and line breaks; nothing else is rendered from the model.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className={line.trim() ? '' : 'h-2'}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith('**') && part.endsWith('**') ? <b key={j}>{part.slice(2, -2)}</b> : <span key={j}>{part.replace(/(^|\s)\*([^*]+)\*/g, '$1$2')}</span>))}
        </p>
      ))}
    </>
  )
}

export function Assistant({ open, onClose, lang, text, tools, confirm, context, onTour }: { open: boolean; onClose: () => void; lang: 'en' | 'es'; text: AssistantText; tools: AssistantTools; confirm: AssistantConfirm; context: () => string; onTour: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [asking, setAsking] = useState<{ text: string; answer: (ok: boolean) => void } | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  // Kept on screen a moment after closing, for the closing animation.
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) setMounted(true)
    else if (mounted) {
      const id = setTimeout(() => setMounted(false), 180)
      return () => clearTimeout(id)
    }
  }, [open, mounted])
  // Wide screens: the chat hangs from Franky's button in the header, with a notch pointing at it.
  const [anchor, setAnchor] = useState<{ top: number; notch: number } | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = document.querySelector<HTMLElement>('[data-franky="franky"]')?.getBoundingClientRect()
      setAnchor(r && r.width ? { top: Math.round(r.bottom + 10), notch: Math.round(window.innerWidth - (r.left + r.width / 2)) } : null)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy, asking])
  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])

  const askPermission = (summary: string) => new Promise<boolean>((resolve) => setAsking({ text: summary, answer: (ok) => { setAsking(null); resolve(ok) } }))

  const ask = async (q: string) => {
    if (!q.trim() || busy) return
    setError('')
    setInput('')
    let convo: Msg[] = [...msgs, { role: 'user', content: q.trim() }]
    setMsgs(convo)
    setBusy(true)
    sfx.radioIn()
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (!navigator.onLine) throw new Error('offline')
        const r = await fetch('api/agent.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, context: context(), messages: convo }),
        })
        if (r.status === 429) throw new Error('rate')
        if (r.status === 503) throw new Error('busy')
        if (!r.ok) throw new Error('other')
        const { message } = (await r.json()) as { message: Msg }
        const calls = (message.tool_calls ?? []).filter((c) => c?.function?.name)
        convo = [...convo, { role: 'assistant', content: message.content ?? '', tool_calls: calls.length ? calls : undefined }]
        setMsgs(convo)
        if (!calls.length) {
          sfx.radioOut()
          break
        }
        for (const c of calls) {
          let out: unknown
          try {
            const args = c.function.arguments ? (JSON.parse(c.function.arguments) as Record<string, unknown>) : {}
            const run = tools[c.function.name]
            if (!run) out = { error: `unknown tool ${c.function.name}` }
            else if (confirm[c.function.name] && !(await askPermission(confirm[c.function.name](args)))) out = { declined: true, note: 'the person said no: do not apply it' }
            else out = await run(args)
          } catch (e) {
            out = { error: String(e instanceof Error ? e.message : e) }
          }
          convo = [...convo, { role: 'tool', tool_call_id: c.id, content: JSON.stringify(out ?? { ok: true }) }]
        }
        setMsgs(convo)
      }
    } catch (e) {
      const k = e instanceof Error ? e.message : ''
      sfx.warn()
      setError(k === 'rate' ? text.errRate : k === 'busy' ? text.errBusy : k === 'offline' ? text.errOffline : text.errOther)
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null
  const shown = msgs.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
  const mood = asking ? 'happy' : busy ? 'thinking' : shown.length && shown[shown.length - 1].role === 'assistant' ? 'talking' : 'idle'
  const [name, ...role] = text.title.split(', ')
  return (
    <>
    {/* Phones: a bottom sheet over a dimmed backdrop; tapping the backdrop closes it. */}
    <div className={`fixed inset-0 z-50 bg-black/55 sm:hidden ${open ? 'ui-fade' : 'chat-fade-out'}`} onClick={onClose} aria-hidden="true" />
    <section
      role="dialog"
      aria-label={text.title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      className={`chat-panel ${open ? 'is-open' : 'is-closing'} pointer-events-auto fixed inset-x-0 bottom-0 z-50 flex max-h-[86dvh] flex-col rounded-t-2xl border border-white/15 bg-[#0b0f18]/97 text-sm text-white shadow-2xl backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:right-3 sm:w-[min(420px,calc(100vw-24px))] sm:rounded-xl`}
      style={anchor ? ({ '--chat-top': `${anchor.top}px`, '--chat-notch': `${Math.max(16, anchor.notch - 18)}px` } as React.CSSProperties) : undefined}
    >
      <span className="chat-notch hidden sm:block" aria-hidden="true" />
      <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-white/25 sm:hidden" aria-hidden="true" />
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5">
        <FrankyBot size={48} mood={mood} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight">{name}</p>
          {role.length > 0 && <p className="text-xs text-white/65">{role.join(', ')}</p>}
        </div>
        <span className="rounded-sm border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/70">AI</span>
        <button type="button" onClick={onClose} aria-label={text.close} title={text.close} className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-white/25 hover:bg-white/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {!shown.length && (
          <div className="space-y-3">
            <p className="chat-bubble">{text.hello}</p>
            <div className="flex flex-wrap gap-1.5 pl-1">
              {text.examples.map((e) => (
                <button key={e} type="button" onClick={() => ask(e)} className="chat-chip">
                  {e}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { onClose(); onTour() }} className="flex min-h-11 w-full items-center gap-2.5 rounded-sm border border-sun/50 px-3 text-left font-semibold text-sun hover:bg-sun/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>
              {text.tour}
            </button>
          </div>
        )}
        {shown.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'chat-user ui-in' : 'chat-bubble ui-in space-y-1'}>
            <Rich text={m.content} />
          </div>
        ))}
        {asking && (
          <div className="ui-in rounded-lg border border-sun/50 bg-sun/10 p-3">
            <p className="font-semibold text-sun">{text.apply}</p>
            <p className="mt-1 text-white/90">{asking.text}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => asking.answer(true)} className="min-h-10 rounded-sm bg-sun px-4 font-semibold text-black hover:brightness-110">{text.yes}</button>
              <button type="button" onClick={() => asking.answer(false)} className="min-h-10 rounded-sm border border-white/25 px-4 hover:bg-white/10">{text.no}</button>
            </div>
          </div>
        )}
        {busy && !asking && <p className="fk-dots text-white/60">{text.thinking}</p>}
        {error && <p className="text-warn">{error}</p>}
      </div>
      <form
        className="flex items-end gap-2 border-t border-white/10 px-3 pb-1.5 pt-3"
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
      >
        <textarea
          ref={field}
          rows={1}
          value={input}
          maxLength={600}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(input)
            }
          }}
          placeholder={text.placeholder}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-sm [field-sizing:content] border border-white/20 bg-black/40 px-3 py-2 text-white placeholder:text-white/40"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label={text.send} title={text.send} className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-sun font-semibold text-black disabled:opacity-40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
      <p className="px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] text-[10.5px] leading-snug text-white/45">{text.aiNote}</p>
    </section>
    </>
  )
}
