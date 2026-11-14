// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
// Missions and their scenarios, kept in this browser (localStorage): no server, no accounts, as decided
// for the whole tool (docs/STACK.md). A scenario is what the rest of the app already plans (sites,
// landing date, slip); a mission adds who it is for and what it asks: hardware and requirements.
// Simulations are never stored: they take milliseconds and are always recomputed from the current data.
//
// Names: `Mission` in data/model.ts is the set of stay parameters the model runs on (landing, days,
// power...); a MissionDef here is the mission itself, which fills those parameters.
import { DATA, DEFAULT_DOD, DEFAULT_ETA, DEFAULT_REQUIREMENTS, POWER_PRESETS, type Mission, type PowerPreset, type Requirements } from './data/model'

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
  /** Where and when the mission lands, for its report: one of the team's sites, ISO date (UTC). */
  site: string
  landing: string
  /** Night survival power profile that filled survivalPowerW ('custom': typed by the user). */
  powerPreset: PowerPreset
  /** Battery margins, the user's own: usable fraction and storage efficiency (1 = no margin). */
  dod: number
  eta: number
  /** Longest time without Earth the mission accepts (h); 0: not checked. */
  maxNoEarthH: number
  scenarios: SavedScenario[]
  updated: string
}

const KEY = 'll-missions-v1'

// Fields added later: missions saved before them get these values. No margins by default and the
// first date of the data (team package v2: no default without a source).
const firstLanding = () => (DATA.ready ? DATA.start : new Date('2026-12-01T00:00:00Z')).toISOString().slice(0, 16) + ':00Z'
const added = () => ({ site: 'mma-k2023', landing: firstLanding(), dod: DEFAULT_DOD, eta: DEFAULT_ETA, maxNoEarthH: 0 })
const LTV = POWER_PRESETS.find((p) => p.id === 'ltv')!.w
/** The profile whose power matches w ('custom' if none does). */
export const presetFor = (w: number): PowerPreset => POWER_PRESETS.find((p) => p.w === w)?.id ?? 'custom'

export function newMission(): MissionDef {
  return {
    id: uid(),
    name: '',
    type: 'lander',
    description: '',
    objectives: '',
    durationDays: 14,
    survivalPowerW: LTV,
    powerPreset: 'ltv',
    batteryWh: 0,
    minAntennaElevDeg: 0,
    req: { ...DEFAULT_REQUIREMENTS },
    ...added(),
    scenarios: [],
    updated: new Date().toISOString(),
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export function loadMissions(): MissionDef[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as MissionDef[]) : []
    // Older missions keep their power; their profile is the one that matches it.
    return Array.isArray(list) ? list.filter((m) => m && typeof m.id === 'string').map((m) => ({ ...added(), ...m, powerPreset: m.powerPreset ?? presetFor(m.survivalPowerW) })) : []
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
    dod: m.dod,
    eta: m.eta,
    maxNoEarthH: m.maxNoEarthH,
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

/** The stay parameters of a mission definition, landing at its own site and date. */
export function missionParams(d: MissionDef): Mission {
  return {
    landing: new Date(d.landing),
    durationDays: d.durationDays,
    slipDays: 0,
    survivalPowerW: d.survivalPowerW,
    minAntennaElevDeg: d.minAntennaElevDeg,
    batteryWh: d.batteryWh || undefined,
    req: { ...d.req },
    dod: d.dod,
    eta: d.eta,
    maxNoEarthH: d.maxNoEarthH,
  }
}
