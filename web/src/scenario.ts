import { DEFAULT_REQUIREMENTS, type Mission } from './data/model'

// The whole scenario lives in the URL hash, so a planner can share it as a link.
export interface Scenario {
  chosen: string[]
  focus: string
  mission: Mission
  mode: 'planner' | 'explore'
}

export const DEFAULT_SCENARIO: Scenario = {
  chosen: ['shackleton-rim', 'connecting-ridge', 'malapert-massif'],
  focus: 'shackleton-rim',
  mode: 'planner',
  mission: {
    // The first day of the data at 06:00 UTC, for 10 days. App.tsx re-anchors it to DATA.start once
    // the data arrive, so it follows the data if they are regenerated.
    landing: new Date(Date.UTC(2026, 11, 1, 6, 0)),
    durationDays: 10,
    slipDays: 0,
    survivalPowerW: 120,
    // Earth counts as in view when it clears the terrain, as in Wueller et al. (2026); raise it in More options.
    minAntennaElevDeg: 0,
  },
}

const num = (v: string | null, fallback: number, min: number, max: number) => {
  const n = v === null ? NaN : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function readScenario(hash: string): Scenario {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const d = DEFAULT_SCENARIO
  const landing = new Date(p.get('t') ?? '')
  const chosen = (p.get('s') ?? '').split('|').filter(Boolean).slice(0, 4)
  return {
    chosen: p.has('s') ? chosen : d.chosen,
    focus: p.get('f') ?? (p.has('s') ? (chosen[0] ?? '') : d.focus),
    mode: p.get('m') === 'explore' ? 'explore' : 'planner',
    mission: {
      landing: Number.isNaN(landing.getTime()) ? d.mission.landing : landing,
      durationDays: num(p.get('d'), d.mission.durationDays, 1, 60),
      slipDays: num(p.get('slip'), 0, -30, 60),
      survivalPowerW: num(p.get('w'), d.mission.survivalPowerW, 0, 100000),
      minAntennaElevDeg: num(p.get('e'), d.mission.minAntennaElevDeg, 0, 30),
      // Mission requirements and battery travel in the link too, so it reproduces the same verdict.
      batteryWh: p.has('b') ? num(p.get('b'), 0, 0, 1e7) || undefined : undefined,
      req: p.has('rs') || p.has('rd') || p.has('re')
        ? {
            minSunPct: num(p.get('rs'), DEFAULT_REQUIREMENTS.minSunPct, 0, 100),
            maxDarkH: num(p.get('rd'), DEFAULT_REQUIREMENTS.maxDarkH, 0, 2000),
            minEarthPct: num(p.get('re'), DEFAULT_REQUIREMENTS.minEarthPct, 0, 100),
          }
        : undefined,
    },
  }
}

export function writeScenario(s: Scenario): string {
  const p = new URLSearchParams({
    s: s.chosen.join('|'),
    f: s.focus,
    t: s.mission.landing.toISOString().slice(0, 16) + 'Z',
    d: String(s.mission.durationDays),
    slip: String(s.mission.slipDays),
    w: String(s.mission.survivalPowerW),
    e: String(s.mission.minAntennaElevDeg),
  })
  if (s.mission.batteryWh) p.set('b', String(s.mission.batteryWh))
  const r = s.mission.req
  if (r && (r.minSunPct !== DEFAULT_REQUIREMENTS.minSunPct || r.maxDarkH !== DEFAULT_REQUIREMENTS.maxDarkH || r.minEarthPct !== DEFAULT_REQUIREMENTS.minEarthPct)) {
    p.set('rs', String(r.minSunPct))
    p.set('rd', String(r.maxDarkH))
    p.set('re', String(r.minEarthPct))
  }
  if (s.mode === 'explore') p.set('m', 'explore')
  return '#' + p.toString()
}
