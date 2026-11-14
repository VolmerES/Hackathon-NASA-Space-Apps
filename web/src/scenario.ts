import type { Mission } from './data/model'

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
    // Inside the southern midsummer of 2027 (sub-solar latitude <= -1.5 deg, 14 Oct to 14 Nov,
    // from JPL Horizons): the season the south pole is best lit.
    // Stay centred on the peak (7 Nov 2027).
    landing: new Date(Date.UTC(2027, 9, 31, 6, 0)),
    durationDays: 14,
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
  if (s.mode === 'explore') p.set('m', 'explore')
  return '#' + p.toString()
}
