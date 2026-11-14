// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
// Missions and their scenarios, kept in this browser (localStorage): no server, no accounts, as decided
// for the whole tool (docs/STACK.md). A scenario is what the rest of the app already plans (sites,
// landing date, slip); a mission adds who it is for and what it asks: hardware and requirements.
// Simulations are never stored: they take milliseconds and are always recomputed from the current data.
//
// Names: `Mission` in data/model.ts is the set of stay parameters the model runs on (landing, days,
// power...); a MissionDef here is the mission itself, which fills those parameters.
import { DEFAULT_REQUIREMENTS, type Mission, type Requirements } from './data/model'

export type MissionType = 'lander' | 'rover' | 'payload' | 'other'
export type ScenarioKind = 'baseline' | 'delayed' | 'alt-site' | 'custom'

export interface SavedScenario {
  id: string
  name: string
  kind: ScenarioKind
  sites: string[]
  focus: string
  landing: string // ISO, UTC
  slipDays: number
}

export interface MissionDef {
  id: string
  name: string
  type: MissionType
  description: string
  objectives: string
  durationDays: number
  survivalPowerW: number
  batteryWh: number // 0: not set
  minAntennaElevDeg: number
  req: Requirements
  scenarios: SavedScenario[]
  updated: string
}

const KEY = 'll-missions-v1'

export function newMission(): MissionDef {
  return {
    id: uid(),
    name: '',
    type: 'lander',
    description: '',
    objectives: '',
    durationDays: 14,
    survivalPowerW: 120,
    batteryWh: 0,
    minAntennaElevDeg: 0,
    req: { ...DEFAULT_REQUIREMENTS },
    scenarios: [],
    updated: new Date().toISOString(),
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export function loadMissions(): MissionDef[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as MissionDef[]) : []
    return Array.isArray(list) ? list.filter((m) => m && typeof m.id === 'string') : []
  } catch {
    return []
  }
}

export function saveMissions(list: MissionDef[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Private mode or storage full: the missions last until the page is closed.
  }
}

/** The stay parameters of a mission, for the model, over the current ones (dates are kept). */
export function applyMission(m: MissionDef, base: Mission): Mission {
  return {
    ...base,
    durationDays: m.durationDays,
    survivalPowerW: m.survivalPowerW,
    batteryWh: m.batteryWh || undefined,
    minAntennaElevDeg: m.minAntennaElevDeg,
    req: { ...m.req },
  }
}

/** What changed against the mission's first scenario, the baseline. */
export function kindOf(s: Omit<SavedScenario, 'id' | 'name' | 'kind'>, baseline?: SavedScenario): ScenarioKind {
  if (!baseline) return 'baseline'
  const sameSite = s.focus === baseline.focus
  const sameDate = Date.parse(s.landing) + s.slipDays * 86400000 === Date.parse(baseline.landing) + baseline.slipDays * 86400000
  if (sameSite && !sameDate) return 'delayed'
  if (!sameSite && sameDate) return 'alt-site'
  return 'custom'
}
