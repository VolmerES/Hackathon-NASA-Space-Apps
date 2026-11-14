// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
// The sounds of the app, all synthesised here with Web Audio: no audio files, no licences, works
// offline. "Mission control" character: console blips, radio pulses, Quindar tones (the radio beeps
// of Apollo), a low engine rumble. The browser lets nothing play until the first click or key, so
// unlockAudio() runs on the start screen's mode buttons. Sound never carries anything the screen
// does not also say. Muted state is kept in this browser (ll-sound).

type Verdict = 'viable' | 'marginal' | 'not-viable'

const KEY = 'll-sound'
let ctx: AudioContext | null = null
let master: GainNode
let sfxBus: GainNode
let ambBus: GainNode
let noiseBuf: AudioBuffer
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '0'
  } catch {
    return false
  }
})()
const listeners = new Set<(m: boolean) => void>()
// #sfxdebug in the link logs every sound fired (window.__sfx), to check the hooks without speakers.
const debug = typeof window !== 'undefined' && /sfxdebug/.test(window.location.hash)
const log = (name: string) => {
  if (!debug) return
  const w = window as unknown as { __sfx?: string[] }
  ;(w.__sfx ??= []).push(name)
}

function init(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 4
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 0.9
  sfxBus = ctx.createGain()
  sfxBus.gain.value = 0.55
  ambBus = ctx.createGain()
  ambBus.gain.value = 0
  sfxBus.connect(comp)
  ambBus.connect(comp)
  comp.connect(master)
  master.connect(ctx.destination)
  // Two seconds of white noise, shared by every noisy sound.
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else if (!muted) void ctx.resume()
  })
  return ctx
}

/** Call from a click or key: creates and starts the audio (browsers need a user gesture). */
export function unlockAudio() {
  const c = init()
  if (c && c.state !== 'running' && !muted) void c.resume()
}

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(KEY, m ? '0' : '1')
  } catch {
    // Private mode: the choice lasts until the page closes.
  }
  if (ctx) {
    master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05)
    if (!m) void ctx.resume()
  }
  listeners.forEach((f) => f(m))
}
export function onMuteChange(f: (m: boolean) => void) {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}

// The context, ready to play now, or null (muted, locked or no Web Audio).
const live = () => (ctx && !muted && ctx.state === 'running' ? ctx : null)

/** A tone with an attack/decay envelope. */
function tone(c: AudioContext, o: { f: number; f2?: number; t?: number; dur: number; type?: OscillatorType; gain?: number; attack?: number; to?: AudioNode }) {
  const t0 = c.currentTime + (o.t ?? 0)
  const osc = c.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.f, t0)
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur)
  const g = c.createGain()
  const a = o.attack ?? 0.005
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t0 + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  osc.connect(g).connect(o.to ?? sfxBus)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.05)
}

/** A burst of filtered noise. */
function noise(c: AudioContext, o: { t?: number; dur: number; type?: BiquadFilterType; f: number; f2?: number; q?: number; gain?: number; attack?: number; to?: AudioNode }) {
  const t0 = c.currentTime + (o.t ?? 0)
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const flt = c.createBiquadFilter()
  flt.type = o.type ?? 'bandpass'
  flt.frequency.setValueAtTime(o.f, t0)
  if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur)
  flt.Q.value = o.q ?? 1
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t0 + (o.attack ?? 0.01))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  src.connect(flt).connect(g).connect(o.to ?? sfxBus)
  src.start(t0, Math.random())
  src.stop(t0 + o.dur + 0.05)
}

// ── One-shot sounds ──────────────────────────────────────────────────────────────────────────

/** Opening: a sub-bass hit, a chord that swells through an opening filter, a Quindar beep (~4 s). */
export function launch() {
  log('launch')
  const c = live()
  if (!c) return
  tone(c, { f: 58, f2: 32, dur: 2.2, type: 'sine', gain: 0.7, attack: 0.01 })
  tone(c, { f: 116, f2: 64, dur: 1.2, type: 'triangle', gain: 0.12, attack: 0.01 })
  const flt = c.createBiquadFilter()
  flt.type = 'lowpass'
  flt.Q.value = 6
  flt.frequency.setValueAtTime(180, c.currentTime + 0.2)
  flt.frequency.exponentialRampToValueAtTime(3800, c.currentTime + 3.2)
  flt.frequency.exponentialRampToValueAtTime(900, c.currentTime + 4.6)
  flt.connect(sfxBus)
  // A wide open fifth with a ninth on top (D, A, D, E, A), detuned saws for width.
  for (const f of [73.4, 110, 146.8, 164.8, 220]) {
    for (const det of [-6, 6]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      const g = c.createGain()
      const t0 = c.currentTime + 0.25
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.035, t0 + 2.4)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.6)
      o.connect(g).connect(flt)
      o.start(t0)
      o.stop(t0 + 4.8)
    }
  }
  // A high shimmer that rises as the name appears.
  tone(c, { t: 1.2, f: 880, f2: 1760, dur: 2.4, type: 'triangle', gain: 0.03, attack: 1.2 })
  quindar(c, 2525, 3.4)
}

/** Telemetry blip as each data source arrives; rises with its position. */
export function tick(i = 0) {
  log('tick')
  const c = live()
  if (!c) return
  const f = 880 * Math.pow(2, (i * 2) / 12)
  tone(c, { f, dur: 0.09, type: 'square', gain: 0.05 })
  tone(c, { t: 0.05, f: f * 1.5, dur: 0.12, type: 'sine', gain: 0.06 })
}

/** Everything loaded: a short bright chord. */
export function ready() {
  log('ready')
  const c = live()
  if (!c) return
  ;[587, 880, 1175].forEach((f, i) => tone(c, { t: i * 0.06, f, dur: 0.9, type: 'sine', gain: 0.09 }))
}

/** A transition (entering the Moon, changing view, flying between sites): an electronic glide, no
 *  air (there is none in space). The name stays for the callers. */
export function whoosh(strength = 1) {
  log('whoosh')
  const c = live()
  if (!c) return
  tone(c, { f: 220, f2: 660, dur: 0.55, type: 'sine', gain: 0.06 * strength, attack: 0.18 })
  tone(c, { t: 0.06, f: 330, f2: 990, dur: 0.5, type: 'triangle', gain: 0.025 * strength, attack: 0.16 })
  tone(c, { f: 80, f2: 55, dur: 0.6, type: 'sine', gain: 0.06 * strength, attack: 0.2 })
}

export function click() {
  log('click')
  const c = live()
  if (!c) return
  tone(c, { f: 1800, f2: 1200, dur: 0.04, type: 'square', gain: 0.04 })
}

let lastHover = 0
/** Pointer over a site: very soft, at most a few times a second. */
export function hover() {
  const now = performance.now()
  if (now - lastHover < 120) return
  lastHover = now
  log('hover')
  const c = live()
  if (!c) return
  tone(c, { f: 2400, dur: 0.03, type: 'sine', gain: 0.025 })
}

export function open() {
  log('open')
  const c = live()
  if (!c) return
  tone(c, { f: 520, f2: 780, dur: 0.12, type: 'triangle', gain: 0.07 })
}

export function close() {
  log('close')
  const c = live()
  if (!c) return
  tone(c, { f: 700, f2: 440, dur: 0.12, type: 'triangle', gain: 0.06 })
}

/** A site chosen: a radar-like ping. */
export function select() {
  log('select')
  const c = live()
  if (!c) return
  tone(c, { f: 1320, dur: 0.5, type: 'sine', gain: 0.1 })
  tone(c, { t: 0.08, f: 1980, dur: 0.35, type: 'sine', gain: 0.04 })
}

export function toggle(on: boolean) {
  log(on ? 'toggle-on' : 'toggle-off')
  const c = live()
  if (!c) return
  tone(c, { f: on ? 660 : 880, f2: on ? 990 : 550, dur: 0.1, type: 'square', gain: 0.04 })
}

/** Saved, copied, downloaded. */
export function confirm() {
  log('confirm')
  const c = live()
  if (!c) return
  tone(c, { f: 988, dur: 0.1, type: 'sine', gain: 0.08 })
  tone(c, { t: 0.09, f: 1319, dur: 0.22, type: 'sine', gain: 0.08 })
}

/** A short notice on screen (toasts). */
export function notify() {
  log('notify')
  const c = live()
  if (!c) return
  tone(c, { f: 1175, dur: 0.12, type: 'triangle', gain: 0.05 })
}

export function warn() {
  log('warn')
  const c = live()
  if (!c) return
  tone(c, { f: 440, dur: 0.12, type: 'square', gain: 0.04 })
  tone(c, { t: 0.14, f: 349, dur: 0.18, type: 'square', gain: 0.04 })
}

/** Signatures that only accompany the verdict written on screen. */
export function verdict(v: Verdict) {
  log(`verdict-${v}`)
  const c = live()
  if (!c) return
  if (v === 'viable') [659, 988].forEach((f, i) => tone(c, { t: 0.15 + i * 0.12, f, dur: 0.5, gain: 0.07 }))
  else if (v === 'marginal') [740, 740].forEach((f, i) => tone(c, { t: 0.15 + i * 0.16, f, dur: 0.2, gain: 0.06 }))
  else [392, 311].forEach((f, i) => tone(c, { t: 0.15 + i * 0.15, f, dur: 0.35, type: 'triangle', gain: 0.07 }))
}

// Quindar tones: 250 ms pure tones that keyed Apollo's radio, 2525 Hz to open and 2475 Hz to close.
function quindar(c: AudioContext, f: number, t = 0) {
  tone(c, { t, f, dur: 0.25, type: 'sine', gain: 0.06, attack: 0.01 })
}
/** Asking the assistant: the radio opens. */
export function radioIn() {
  log('radio-in')
  const c = live()
  if (!c) return
  quindar(c, 2525)
  noise(c, { t: 0.25, dur: 0.18, type: 'bandpass', f: 1800, q: 2, gain: 0.03 })
}
/** The answer arrives: static and the closing beep. */
export function radioOut() {
  log('radio-out')
  const c = live()
  if (!c) return
  noise(c, { dur: 0.16, type: 'bandpass', f: 1800, q: 2, gain: 0.03 })
  quindar(c, 2475, 0.16)
}

/** Touchdown: a deep thump and the dust settling. */
export function touchdown() {
  log('touchdown')
  const c = live()
  if (!c) return
  // Felt through the lander's legs, not heard through air: a deep thump and a short settle.
  tone(c, { f: 70, f2: 38, dur: 0.6, gain: 0.5, attack: 0.004 })
  tone(c, { t: 0.18, f: 52, f2: 40, dur: 0.5, gain: 0.18, attack: 0.01 })
  setTimeout(radioOut, 1400)
}

// ── Continuous sounds ────────────────────────────────────────────────────────────────────────

let spinOsc: OscillatorNode | null = null
let spinGain: GainNode
let lastDetent = 0
let lastDetentAt = 0
/** Rotation of the Moon, kept subtle: a low servo hum that barely rises with the speed (rad/s), and
 *  a soft detent every 5 degrees of turn, like a rotary knob. No noise (it read as rustling paper). */
export function setSpin(speed: number, angle = 0) {
  const c = live()
  if (!c) return
  if (!spinOsc) {
    spinOsc = c.createOscillator()
    spinOsc.type = 'sine'
    spinOsc.frequency.value = 70
    spinGain = c.createGain()
    spinGain.gain.value = 0
    spinOsc.connect(spinGain).connect(sfxBus)
    spinOsc.start()
    lastDetent = Math.round(angle / DETENT)
  }
  const s = Math.min(1, Math.abs(speed) / 2.5)
  spinGain.gain.setTargetAtTime(s < 0.03 ? 0 : 0.012 + 0.03 * s, c.currentTime, 0.12)
  spinOsc.frequency.setTargetAtTime(70 + 40 * s, c.currentTime, 0.12)
  // Detents: one per 5 degrees crossed, at most 14 a second, quieter as it spins faster.
  const d = Math.round(angle / DETENT)
  if (d !== lastDetent) {
    lastDetent = d
    const now = performance.now()
    if (s >= 0.03 && now - lastDetentAt > 70) {
      lastDetentAt = now
      tone(c, { f: 1500, dur: 0.018, type: 'sine', gain: 0.012 * (1 - 0.6 * s) })
    }
  }
}
const DETENT = (5 * Math.PI) / 180

/** Taking hold of the Moon: a soft low tap. */
export function grab() {
  log('grab')
  const c = live()
  if (!c) return
  tone(c, { f: 180, f2: 120, dur: 0.06, type: 'sine', gain: 0.05 })
}

let eng: { osc: OscillatorNode; src: AudioBufferSourceNode; gain: GainNode; flt: BiquadFilterNode } | null = null
/** The lander's engine during the descent, 0 (off) to 1 (full thrust). */
export function setEngine(level: number) {
  const c = live()
  if (!c) return
  if (!eng && level > 0.01) {
    log('engine')
    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 42
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const flt = c.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = 400
    const gain = c.createGain()
    gain.gain.value = 0
    const og = c.createGain()
    og.gain.value = 0.35
    osc.connect(og).connect(flt)
    src.connect(flt)
    flt.connect(gain).connect(sfxBus)
    osc.start()
    src.start()
    eng = { osc, src, gain, flt }
  }
  if (!eng) return
  const l = Math.max(0, Math.min(1, level))
  eng.gain.gain.setTargetAtTime(0.22 * l, c.currentTime, 0.1)
  eng.flt.frequency.setTargetAtTime(220 + 900 * l, c.currentTime, 0.1)
  if (l <= 0.01) {
    const e = eng
    eng = null
    setTimeout(() => {
      e.osc.stop()
      e.src.stop()
    }, 600)
  }
}

let amb: AudioNode[] | null = null
/** A very soft space bed: a low drone that breathes slowly (no noise: no wind in space). */
export function startAmbient() {
  const c = init()
  if (!c || amb) return
  log('ambient')
  const bed = c.createGain()
  bed.gain.value = 0.8
  bed.connect(ambBus)
  const nodes: AudioScheduledSourceNode[] = []
  for (const [f, g] of [
    [55, 0.5],
    [82.4, 0.25],
    [110.2, 0.12],
    [164.8, 0.05],
  ]) {
    const o = c.createOscillator()
    o.frequency.value = f
    const og = c.createGain()
    og.gain.value = g
    o.connect(og).connect(bed)
    o.start()
    nodes.push(o)
  }
  // Slow breathing of the whole bed.
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.06
  const lg = c.createGain()
  lg.gain.value = 0.25
  lfo.connect(lg).connect(bed.gain)
  lfo.start()
  nodes.push(lfo)
  amb = nodes
  ambBus.gain.setTargetAtTime(0.05, c.currentTime + 1.5, 2.5)
}

// ── Franky, the little robot ────────────────────────────────────────────────────────────────

/** Robot chirps: quick sine blips gliding up and down, like a small droid talking. */
export function chirp(kind: 'hello' | 'step' | 'bye' | 'in' = 'step') {
  log(`chirp-${kind}`)
  const c = live()
  if (!c) return
  const notes: [number, number, number][] =
    kind === 'hello'
      ? [[880, 1400, 0], [1400, 990, 0.11], [990, 1760, 0.2], [1320, 1320, 0.34]]
      : kind === 'bye'
        ? [[1320, 1760, 0], [1760, 990, 0.1], [990, 660, 0.2]]
        : kind === 'in'
          ? [[660, 2200, 0]]
          : [[1100, 1500, 0], [1500, 1250, 0.09]]
  for (const [f, f2, t] of notes) tone(c, { t, f, f2, dur: kind === 'in' ? 0.35 : 0.1, type: 'sine', gain: 0.07, attack: 0.008 })
  // A little square-wave grit under the first blip, so it reads as electronic.
  tone(c, { f: notes[0][0] / 2, dur: 0.06, type: 'square', gain: 0.015 })
}

let rollNode: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null
/** Franky's wheels and motor while he rolls: a soft electric whir with a gentle wobble. */
export function roll(on: boolean) {
  const c = live()
  if (!c) return
  if (on && !rollNode) {
    log('roll')
    const osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 210
    const lfo = c.createOscillator()
    lfo.frequency.value = 7
    const lg = c.createGain()
    lg.gain.value = 18
    lfo.connect(lg).connect(osc.frequency)
    const flt = c.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = 900
    const gain = c.createGain()
    gain.gain.value = 0
    osc.connect(flt).connect(gain).connect(sfxBus)
    osc.start()
    lfo.start()
    gain.gain.setTargetAtTime(0.035, c.currentTime, 0.08)
    osc.frequency.setTargetAtTime(260, c.currentTime, 0.3)
    rollNode = { osc, lfo, gain }
  } else if (!on && rollNode) {
    const r = rollNode
    rollNode = null
    r.gain.gain.setTargetAtTime(0, c.currentTime, 0.08)
    r.osc.frequency.setTargetAtTime(150, c.currentTime, 0.1)
    setTimeout(() => {
      r.osc.stop()
      r.lfo.stop()
    }, 500)
  }
}
