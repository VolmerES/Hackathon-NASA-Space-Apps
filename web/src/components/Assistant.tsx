import { useEffect, useRef, useState } from 'react'
import { FrankyBot } from './FrankyBot'

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
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (!navigator.onLine) throw new Error('offline')
        const r = await fetch('api/agent.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, context: context(), messages: convo }),
        })
        if (r.status === 429) throw new Error('rate')
        if (!r.ok) throw new Error('other')
        const { message } = (await r.json()) as { message: Msg }
        const calls = (message.tool_calls ?? []).filter((c) => c?.function?.name)
        convo = [...convo, { role: 'assistant', content: message.content ?? '', tool_calls: calls.length ? calls : undefined }]
        setMsgs(convo)
        if (!calls.length) break
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
      setError(k === 'rate' ? text.errRate : k === 'offline' ? text.errOffline : text.errOther)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  const shown = msgs.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
  const mood = asking ? 'happy' : busy ? 'thinking' : shown.length && shown[shown.length - 1].role === 'assistant' ? 'talking' : 'idle'
  return (
    <section role="dialog" aria-label={text.title} className="pop-in pointer-events-auto fixed bottom-3 right-3 z-50 flex max-h-[min(660px,calc(100dvh-90px))] w-[min(410px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b0f18]/95 text-sm text-white shadow-2xl backdrop-blur-md">
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5">
        <FrankyBot size={52} mood={mood} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{text.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">{text.aiNote}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={text.close} title={text.close} className="flex size-9 shrink-0 items-center justify-center self-start rounded-sm border border-white/25 hover:bg-white/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {!shown.length && (
          <div className="space-y-2">
            <p className="text-white/85">{text.hello}</p>
            {text.examples.map((e) => (
              <button key={e} type="button" onClick={() => ask(e)} className="block w-full rounded-sm border border-white/15 px-3 py-2 text-left text-white/90 hover:bg-white/10">
                {e}
              </button>
            ))}
            <button type="button" onClick={() => { onClose(); onTour() }} className="block w-full rounded-sm border border-sun/50 px-3 py-2 text-left text-sun hover:bg-sun/10">
              {text.tour}
            </button>
          </div>
        )}
        {shown.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'ml-8 rounded-lg bg-white/10 px-3 py-2' : 'ui-in mr-4 space-y-1 leading-relaxed text-white/90'}>
            {m.role === 'assistant' && <span className="mb-1 inline-block rounded-sm bg-white/10 px-1.5 text-[10px] font-semibold tracking-wide text-white/70">Franky · IA</span>}
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
        className="flex items-end gap-2 border-t border-white/10 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
      >
        <textarea
          ref={field}
          rows={2}
          value={input}
          maxLength={600}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(input)
            }
            if (e.key === 'Escape') onClose()
          }}
          placeholder={text.placeholder}
          className="min-h-11 flex-1 resize-none rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-white placeholder:text-white/40"
        />
        <button type="submit" disabled={busy || !input.trim()} className="min-h-11 rounded-sm bg-sun px-3 font-semibold text-black disabled:opacity-50">
          {text.send}
        </button>
      </form>
    </section>
  )
}
