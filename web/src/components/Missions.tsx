// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
import { useState } from 'react'
import type { Metrics } from '../data/model'
import { useT } from '../i18n'
import { newMission, type MissionDef, type MissionType, type SavedScenario } from '../missions'
import { NumberField } from './Ui'

type Verdict = Metrics['verdict']
export type Evaluated = { site: string; when: string; m: Metrics } | null
type Status = 'draft' | 'planned' | 'at-risk'

const DOT: Record<Verdict, string> = { viable: 'bg-ok', marginal: 'bg-warn', 'not-viable': 'bg-bad' }
const TXT: Record<Verdict, string> = { viable: 'text-ok', marginal: 'text-warn', 'not-viable': 'text-bad' }
const STATUS_CLS: Record<Status, string> = { draft: 'border-white/30 text-muted', planned: 'border-ok/60 text-ok', 'at-risk': 'border-bad/60 text-bad' }

// The missions of this browser: list, create or edit one, and its scenarios side by side. Every figure
// is recomputed from the current data each time (evaluate), with the mission's own requirements.
export function Missions({ startNew = false, missions, activeId, openScenarioId, evaluate, num, onSave, onDelete, onOpen, onDeleteScenario, onRenameScenario }: {
  missions: MissionDef[]
  activeId: string | null
  evaluate: (m: MissionDef, s: SavedScenario) => Evaluated
  num: (n: number, digits?: number) => string
  onSave: (m: MissionDef) => void
  onDelete: (id: string) => void
  onOpen: (m: MissionDef, s?: SavedScenario) => void
  onDeleteScenario: (missionId: string, scenarioId: string) => void
  onRenameScenario: (missionId: string, scenarioId: string, name: string) => void
  /** The saved scenario on screen right now. */
  openScenarioId: string | null
  /** Open straight on the form for a new mission ("Add to mission" → "New mission"). */
  startNew?: boolean
}) {
  const t = useT()
  const [view, setView] = useState<{ kind: 'list' } | { kind: 'edit'; draft: MissionDef } | { kind: 'detail'; id: string }>(() => (startNew ? { kind: 'edit', draft: newMission() } : { kind: 'list' }))
  const [confirm, setConfirm] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  const statusOf = (m: MissionDef): Status => {
    if (!m.scenarios.length) return 'draft'
    return m.scenarios.every((s) => evaluate(m, s)?.m.verdict === 'viable') ? 'planned' : 'at-risk'
  }

  if (view.kind === 'edit') return <MissionForm draft={view.draft} onCancel={() => setView({ kind: 'list' })} onSave={(m) => { onSave(m); setView({ kind: 'detail', id: m.id }) }} />

  if (view.kind === 'detail') {
    const m = missions.find((x) => x.id === view.id)
    if (!m) return null
    const rows = m.scenarios.map((s) => ({ s, e: evaluate(m, s) }))
    return (
      <div>
        <button type="button" onClick={() => setView({ kind: 'list' })} className="mb-3 text-sm text-nasa-blue underline underline-offset-4">← {t.ms.all}</button>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-xl font-bold">{m.name}</h3>
            <p className="text-xs text-muted">{t.ms.types[m.type]} · {t.ms.daysN(m.durationDays)}</p>
          </div>
          <span className={`border px-2 py-0.5 text-xs ${STATUS_CLS[statusOf(m)]}`}>{t.ms.status[statusOf(m)]}</span>
        </div>
        {m.description && <p className="mt-2 text-sm">{m.description}</p>}
        {m.objectives && <p className="mt-1 whitespace-pre-line text-sm text-muted">{m.objectives}</p>}
        <p className="mt-3 border-l-2 border-sun/60 pl-3 text-xs text-white/80">
          {t.ms.reqLine(m.req.minSunPct, m.req.maxDarkH, m.req.minEarthPct)}
          {m.batteryWh > 0 && <> · {t.ms.batteryLine(num(m.batteryWh), m.survivalPowerW)}</>}
        </p>

        <h4 className="mt-5 text-sm font-semibold">{t.ms.scenarios}</h4>
        {rows.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t.ms.noScenarios}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-2 font-normal">{t.ms.scenario}</th>
                  <th className="py-1 pr-2 font-normal">{t.sunlight}</th>
                  <th className="py-1 pr-2 font-normal">{t.longestDarkness}</th>
                  <th className="py-1 pr-2 font-normal">{t.earthContact}</th>
                  <th className="py-1 pr-2 font-normal">{t.ms.batteryLeft}</th>
                  <th className="py-1 pr-2 font-normal">{t.ms.verdict}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, e }) => (
                  <tr key={s.id} className="border-t border-white/10 align-top">
                    <td className="py-2 pr-2">
                      {renaming?.id === s.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            if (renaming.name.trim()) onRenameScenario(m.id, s.id, renaming.name.trim())
                            setRenaming(null)
                          }}
                          className="flex gap-1"
                        >
                          <input autoFocus aria-label={t.ms.rename} value={renaming.name} onChange={(e) => setRenaming({ id: s.id, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRenaming(null) } }} className="min-h-8 min-w-0 flex-1 rounded-sm border border-white/30 bg-black/40 px-1.5 text-xs text-ink" />
                          <button type="submit" className="rounded-sm bg-sun px-2 font-semibold text-black">OK</button>
                        </form>
                      ) : (
                        <span className="flex items-center gap-1 font-semibold text-ink">
                          {s.name}
                          {openScenarioId === s.id && activeId === m.id && <span className="text-[10px] font-normal text-sun">● {t.ms.onScreen}</span>}
                          <button type="button" onClick={() => setRenaming({ id: s.id, name: s.name })} aria-label={`${t.ms.rename}: ${s.name}`} title={t.ms.rename} className="px-1 font-normal text-muted hover:text-ink">✎</button>
                        </span>
                      )}
                      <span className="block text-muted">{t.ms.kinds[s.kind]}{e && <> · {e.site} · {e.when}</>}</span>
                      {/* Actions under the name, so they are in reach on phones too (the table scrolls sideways). */}
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => onOpen(m, s)} className="min-h-8 rounded-sm border border-white/30 px-2.5 hover:bg-white/10">{t.ms.open}</button>
                        {confirm === `s:${s.id}` ? (
                          <>
                            <span className="text-bad">{t.ms.sure}</span>
                            <button type="button" onClick={() => { onDeleteScenario(m.id, s.id); setConfirm(null) }} className="min-h-8 rounded-sm bg-bad px-2.5 font-semibold text-white">{t.ms.delete}</button>
                            <button type="button" onClick={() => setConfirm(null)} className="min-h-8 rounded-sm border border-white/30 px-2.5 hover:bg-white/10">{t.ms.cancel}</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setConfirm(`s:${s.id}`)} aria-label={`${t.ms.delete}: ${s.name}`} className="flex min-h-8 items-center gap-1 rounded-sm border border-bad/50 px-2.5 text-bad hover:bg-bad/15">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
                            {t.ms.delete}
                          </button>
                        )}
                      </span>
                    </td>
                    {e ? (
                      <>
                        <td className="py-2 pr-2 tabular-nums">{num(e.m.sunlightPct)} %</td>
                        <td className="py-2 pr-2 tabular-nums">{num(e.m.longestNightH)} h</td>
                        <td className="py-2 pr-2 tabular-nums">{num(e.m.earthLinkPct)} %</td>
                        <td className={`py-2 pr-2 tabular-nums ${e.m.batteryMarginWh !== null && e.m.batteryMarginWh < 0 ? 'text-bad' : ''}`}>{e.m.batteryMarginWh === null ? '—' : `${num(e.m.batteryMarginWh)} Wh`}</td>
                        <td className={`py-2 pr-2 font-semibold ${TXT[e.m.verdict]}`}>
                          <span className="flex items-center gap-1.5"><i className={`size-2 shrink-0 rounded-full ${DOT[e.m.verdict]}`} aria-hidden="true" />{t.verdictLong[e.m.verdict]}</span>
                        </td>
                      </>
                    ) : (
                      <td colSpan={5} className="py-2 pr-2 text-muted">{t.ms.cannotEvaluate}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted">{t.ms.howToAdd}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onOpen(m)} className="min-h-11 rounded-sm bg-sun px-4 text-sm font-semibold text-black hover:brightness-110">{activeId === m.id ? t.ms.planMore : t.ms.useThis}</button>
          <button type="button" onClick={() => setView({ kind: 'edit', draft: structuredClone(m) })} className="min-h-11 rounded-sm border border-white/30 px-4 text-sm hover:bg-white/10">{t.ms.edit}</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted">{t.ms.intro}</p>
      <button type="button" onClick={() => setView({ kind: 'edit', draft: newMission() })} className="mt-3 min-h-11 rounded-sm bg-sun px-4 text-sm font-semibold text-black hover:brightness-110">+ {t.ms.new}</button>
      {missions.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t.ms.none}</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
          {missions.map((m) => {
            const st = statusOf(m)
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <button type="button" onClick={() => setView({ kind: 'detail', id: m.id })} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold">{m.name}{activeId === m.id && <span className="ml-2 text-xs font-normal text-sun">● {t.ms.active}</span>}</span>
                  <span className="block text-xs text-muted">{t.ms.types[m.type]} · {t.ms.daysN(m.durationDays)} · {t.ms.scenariosN(m.scenarios.length)}</span>
                </button>
                <span className={`border px-2 py-0.5 text-xs ${STATUS_CLS[st]}`}>{t.ms.status[st]}</span>
                {confirm === m.id ? (
                  <span className="flex items-center gap-1 text-xs">
                    {t.ms.sure}
                    <button type="button" onClick={() => { onDelete(m.id); setConfirm(null) }} className="rounded-sm bg-bad px-2 py-1 font-semibold text-white">{t.ms.delete}</button>
                    <button type="button" onClick={() => setConfirm(null)} className="rounded-sm border border-white/30 px-2 py-1">{t.ms.cancel}</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirm(m.id)} aria-label={`${t.ms.delete}: ${m.name}`} className="rounded-sm px-2 py-1 text-muted hover:bg-white/10 hover:text-bad">×</button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted">{t.ms.storageNote}</p>
    </div>
  )
}

function MissionForm({ draft, onCancel, onSave }: { draft: MissionDef; onCancel: () => void; onSave: (m: MissionDef) => void }) {
  const t = useT()
  const [m, setM] = useState(draft)
  const set = <K extends keyof MissionDef>(k: K, v: MissionDef[K]) => setM((x) => ({ ...x, [k]: v }))
  const setReq = (k: keyof MissionDef['req'], v: number) => setM((x) => ({ ...x, req: { ...x.req, [k]: v } }))
  const field = 'mt-1 min-h-11 w-full rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-ink'
  const legend = 'text-xs font-semibold uppercase tracking-wider text-sun'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!m.name.trim()) return
        onSave({ ...m, name: m.name.trim(), updated: new Date().toISOString() })
      }}
      className="space-y-5 text-sm"
    >
      <fieldset className="space-y-3">
        <legend className={legend}>{t.ms.sInfo}</legend>
        <label className="block">{t.ms.name}<input required value={m.name} onChange={(e) => set('name', e.target.value)} placeholder={t.ms.namePh} className={field} /></label>
        <label className="block">
          {t.ms.type}
          <select value={m.type} onChange={(e) => set('type', e.target.value as MissionType)} className={field}>
            {(['lander', 'rover', 'payload', 'other'] as const).map((k) => <option key={k} value={k}>{t.ms.types[k]}</option>)}
          </select>
        </label>
        <label className="block">{t.ms.description}<textarea rows={2} value={m.description} onChange={(e) => set('description', e.target.value)} className={field} /></label>
        <label className="block">{t.ms.objectives}<textarea rows={3} value={m.objectives} onChange={(e) => set('objectives', e.target.value)} placeholder={t.ms.objectivesPh} className={field} /></label>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className={`${legend} col-span-2 mb-3`}>{t.ms.sEnergy}</legend>
        <label className="block">{t.survivalPower}<NumberField min={0} max={1e6} value={m.survivalPowerW} onValue={(v) => set('survivalPowerW', v)} className={field} /></label>
        <label className="block">{t.ms.battery}<NumberField min={0} max={1e7} step={100} value={m.batteryWh} onValue={(v) => set('batteryWh', v)} className={field} /></label>
        <p className="col-span-2 text-xs text-muted">{t.ms.energyNote}</p>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className={`${legend} col-span-2 mb-3`}>{t.ms.sReq}</legend>
        <label className="block">{t.daysOnSurface}<NumberField min={1} max={60} value={m.durationDays} onValue={(v) => set('durationDays', Math.round(v))} className={field} /></label>
        <label className="block">{t.ms.minSun}<NumberField min={0} max={100} value={m.req.minSunPct} onValue={(v) => setReq('minSunPct', v)} className={field} /></label>
        <label className="block">{t.ms.maxDark}<NumberField min={0} max={2000} value={m.req.maxDarkH} onValue={(v) => setReq('maxDarkH', v)} className={field} /></label>
        <label className="block">{t.ms.minEarth}<NumberField min={0} max={100} value={m.req.minEarthPct} onValue={(v) => setReq('minEarthPct', v)} className={field} /></label>
        <label className="block">{t.antennaAngle}<NumberField min={0} max={30} step={0.5} value={m.minAntennaElevDeg} onValue={(v) => set('minAntennaElevDeg', v)} className={field} /></label>
        <p className="col-span-2 text-xs text-muted">{t.ms.reqNote}</p>
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" className="min-h-11 rounded-sm bg-sun px-4 font-semibold text-black hover:brightness-110">{t.ms.save}</button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-sm border border-white/30 px-4 hover:bg-white/10">{t.ms.cancel}</button>
      </div>
    </form>
  )
}
