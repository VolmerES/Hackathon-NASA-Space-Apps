import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { measureQuality, qualityAt, type Quality } from './quality'

// The real Moon, behind the whole app. Colour: LRO LROC mosaic; relief: LRO LOLA elevation turned
// into a normal map (NASA's Scientific Visualization Studio, CGI Moon Kit). One scene does three jobs:
//  - intro: seen from afar, the limb low on the screen under the splash, turning slowly;
//  - transition: the camera closes in on the south pole;
//  - app: the south pole sits in the free area of the layout, turning slowly; every chosen site is
//    marked on the surface with a label you can tap, and picking a site turns it to face you.
// Rendering only: no number in the tool comes from this view.

export type MoonSite = { id: string; name: string; lat: number; lon: number; /** verdict colour of the dot */ color?: string }

type Props = {
  mode: 'intro' | 'app'
  sites: MoonSite[]
  focusId?: string
  onPick: (id: string) => void
  /** Where the south pole should sit in app mode (an empty, transparent element of the layout). */
  frameRef: RefObject<HTMLElement | null>
  /** Name labels for all markers; off when there are too many to read (the picked one always shows). */
  showLabels?: boolean
  onFail: () => void
  onReady?: () => void
  /** Contents of the callout shown while the mouse rests on a site (desktop only). */
  info?: (id: string) => ReactNode
  /** Texts of the view controls (zoom in, zoom out, back to the south pole). */
  controls?: { zoomIn: string; zoomOut: string; recenter: string }
  /** Street view: dive down onto the focused site until the camera skims its ground. */
  dive?: boolean
}

const DEG = Math.PI / 180
const TILT = 30 * DEG // camera angle from the polar axis, app mode
const SPIN = 0.018 // rad/s, idle rotation
const HOLD_MS = 6000 // after a pick, stay put this long before turning again
const ZOOM_MIN = 0.45 // closest: almost standing over the site
const ZOOM_MAX = 9 // farthest: the whole Moon in view
const TILT_MIN = 6 * DEG // looking straight down on the pole
const TILT_MAX = 84 * DEG // grazing, the horizon in view

// Same convention as three's SphereGeometry and the equirectangular maps (lon 0 at the centre).
function surface(lat: number, lon: number, r = 1) {
  const theta = (90 - lat) * DEG
  const phi = (lon + 180) * DEG
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r)
}

// South polar cap: azimuthal equidistant textures (scripts/moon_polar_cap.py), so the pole has none
// of the stretching an equirectangular map has there. Its edge fades into the globe.
const CAP_DEG = 25
// Real relief on the polar cap: polar_height.png spans this range of LOLA heights (printed by
// scripts/moon_polar_cap.py), raised RELIEF times so craters and massifs read from any angle.
const HEIGHT_RANGE_M = 12578
const RELIEF = 2.5
const HEIGHT_SCALE = (HEIGHT_RANGE_M * RELIEF) / 1737400
const CAP_R = 1.0006
function polarCap(q: Quality) {
  const { rings, segs } = q
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const nrm: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= rings; i++) {
    const c = (i / rings) * CAP_DEG
    const fade = Math.min(1, Math.max(0, (CAP_DEG - c) / 5))
    for (let j = 0; j <= segs; j++) {
      const L = (j / segs) * 360 - 180
      const p = surface(-90 + c, L, CAP_R)
      pos.push(p.x, p.y, p.z)
      const n = p.clone().normalize()
      nrm.push(n.x, n.y, n.z)
      const r = c / CAP_DEG / 2
      uv.push(0.5 + r * Math.sin(L * DEG), 0.5 + r * Math.cos(L * DEG))
      col.push(1, 1, 1, fade)
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j
      const b = a + segs + 1
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  g.setIndex(idx)
  return g
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

export function MoonScene({ mode, sites, focusId, onPick, frameRef, onFail, onReady, showLabels = true, info, controls, dive = false }: Props) {
  const controlsRef = useRef<HTMLDivElement>(null)
  const calloutRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const state = useRef({ mode, sites, focusId, onPick, showLabels })
  state.current = { mode, sites, focusId, onPick, showLabels }
  const api = useRef<{ syncSites: () => void; focus: (id?: string) => void; zoomBy: (f: number) => void; recenter: () => void; dive: (on: boolean) => void } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const labels = labelsRef.current
    if (!canvas || !labels) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      onFail()
      return
    }
    // If the GPU gives up, or the Moon takes too long to arrive, fall back to the still image.
    const lost = (e: Event) => {
      e.preventDefault()
      onFail()
    }
    canvas.addEventListener('webglcontextlost', lost)
    const slowTimer = window.setTimeout(() => {
      if (!shownAt) onFail()
    }, 12000)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const small = Math.min(window.innerWidth, window.innerHeight) < 700
    // Measure the computer once: it decides mesh detail, shadows, sharp maps and resolution.
    let q = measureQuality(renderer, small)
    canvas.dataset.quality = String(q.level)
    renderer.setPixelRatio(Math.min(q.pixelRatio, window.devicePixelRatio || 1))
    renderer.setClearColor(0x000000)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200)

    // Stars on a far sphere.
    const starGeo = new THREE.BufferGeometry()
    const starPos: number[] = []
    let seed = 13
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 1600; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(60)
      starPos.push(v.x, v.y, v.z)
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.75 }))
    scene.add(stars)

    // The Moon.
    const moon = new THREE.Group()
    scene.add(moon)
    const loader = new THREE.TextureLoader()
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 192), mat)
    globe.visible = false
    moon.add(globe)
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true, transparent: true, side: THREE.FrontSide })
    const cap = new THREE.Mesh(polarCap(q), capMat)
    // The cap casts shadows on itself: with the Sun a few degrees high, crater floors go dark.
    cap.castShadow = true
    cap.receiveShadow = true
    cap.visible = false
    cap.renderOrder = 1
    moon.add(cap)
    let loaded = 0
    let shownAt = 0
    const ready = () => {
      if (++loaded < 5) return
      globe.visible = true
      cap.visible = true
      shownAt = performance.now()
      onReady?.()
      // Sharper maps for big screens, once the light ones are on screen.
      if (q.maps4k) {
        loader.load('moon/moon_color_4k.jpg', (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
          mat.map?.dispose()
          mat.map = tex
          mat.needsUpdate = true
        })
        loader.load('moon/moon_normal_4k.jpg', (tex) => {
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
          mat.normalMap?.dispose()
          mat.normalMap = tex
          mat.needsUpdate = true
        })
      }
    }
    loader.load('moon/polar_color.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      capMat.map = tex
      capMat.needsUpdate = true
      ready()
    }, undefined, () => onFail())
    loader.load('moon/polar_normal.jpg', (tex) => {
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      capMat.normalMap = tex
      capMat.normalScale = new THREE.Vector2(1.4, 1.4)
      capMat.needsUpdate = true
      ready()
    }, undefined, () => onFail())
    // Height of the cap under each site, so the markers sit on the raised ground.
    let heights: { data: Uint8ClampedArray; n: number } | null = null
    const heightAt = (lat: number, lon: number) => {
      const c = lat + 90
      if (!heights || c >= CAP_DEG) return 0
      const r = c / CAP_DEG / 2
      const u = 0.5 + r * Math.sin(lon * DEG)
      const v = 0.5 + r * Math.cos(lon * DEG)
      const x = Math.min(heights.n - 1, Math.max(0, Math.round(u * heights.n - 0.5)))
      const y = Math.min(heights.n - 1, Math.max(0, Math.round((1 - v) * heights.n - 0.5)))
      return (heights.data[(y * heights.n + x) * 4] / 255) * HEIGHT_SCALE
    }
    loader.load('moon/polar_height.png', (tex) => {
      capMat.displacementMap = tex
      capMat.displacementScale = HEIGHT_SCALE
      capMat.needsUpdate = true
      const img = tex.image as HTMLImageElement
      const n = img.width
      const c2 = document.createElement('canvas')
      c2.width = c2.height = n
      const g2 = c2.getContext('2d', { willReadFrequently: true })
      if (g2) {
        g2.drawImage(img, 0, 0)
        heights = { data: g2.getImageData(0, 0, n, n).data, n }
        syncSites()
      }
      ready()
    }, undefined, () => onFail())
    const fail = () => onFail()
    loader.load('moon/moon_color_2k.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      mat.map = tex
      mat.needsUpdate = true
      ready()
    }, undefined, fail)
    loader.load('moon/moon_normal_2k.jpg', (tex) => {
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      mat.normalMap = tex
      mat.normalScale = new THREE.Vector2(1.6, -1.6)
      mat.needsUpdate = true
      ready()
    }, undefined, fail)

    // Sunlight grazing the south pole, plus a faint earthshine so the night side is not pure black.
    const sun = new THREE.DirectionalLight(0xfff4e6, 3.2)
    scene.add(sun)
    // Shadows only over the polar cap, where the camera lives.
    renderer.shadowMap.enabled = q.shadows > 0
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    sun.castShadow = q.shadows > 0
    sun.shadow.mapSize.set(Math.max(512, q.shadows), Math.max(512, q.shadows))
    sun.shadow.camera.left = sun.shadow.camera.bottom = -0.47
    sun.shadow.camera.right = sun.shadow.camera.top = 0.47
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 6
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.0025
    sun.target.position.set(0, -1, 0)
    scene.add(sun.target)
    scene.add(new THREE.AmbientLight(0x9fb4d8, 0.05))

    // Site markers: a ring flat on the surface; the label is HTML so it is readable and tappable.
    type Marker = { id: string; ring: THREE.Mesh; dot: THREE.Mesh; local: THREE.Vector3; el: HTMLButtonElement; color: THREE.Color; sx: number; sy: number; vis: boolean }
    let markers: Marker[] = []
    let hoverHold = 0
    // Site under the mouse: shows the callout and holds the Moon still.
    let hoverId: string | null = null
    const setHoverId = (id: string | null) => {
      if (id === hoverId) return
      hoverId = id
      setHover(id)
    }
    const ringGeo = new THREE.RingGeometry(0.010, 0.0135, 48)
    const dotGeo = new THREE.CircleGeometry(0.0045, 24)
    const syncSites = () => {
      for (const m of markers) {
        moon.remove(m.ring, m.dot)
        ;(m.ring.material as THREE.Material).dispose()
        ;(m.dot.material as THREE.Material).dispose()
        m.el.remove()
      }
      markers = state.current.sites.map((s) => {
        const local = surface(s.lat, s.lon, 1.0015 + heightAt(s.lat, s.lon))
        const n = local.clone().normalize()
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false }))
        const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false }))
        ring.position.copy(local)
        dot.position.copy(local)
        ring.quaternion.copy(q)
        dot.quaternion.copy(q)
        ring.renderOrder = 2
        dot.renderOrder = 2
        moon.add(ring, dot)
        const el = document.createElement('button')
        el.type = 'button'
        el.textContent = s.name
        el.className = 'moon-label'
        // Hard to hit a moving target: the Moon stops while a label is under the pointer or finger.
        const hold = () => {
          hoverHold = performance.now() + 2500
        }
        el.addEventListener('pointerenter', hold)
        el.addEventListener('pointermove', hold)
        el.addEventListener('pointerdown', hold)
        el.addEventListener('pointerenter', (e) => {
          if (e.pointerType === 'mouse') setHoverId(s.id)
        })
        el.addEventListener('pointerleave', () => setHoverId(null))
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          state.current.onPick(s.id)
        })
        labels.appendChild(el)
        return { id: s.id, ring, dot, local, el, color: new THREE.Color(s.color ?? '#ffffff'), sx: 0, sy: 0, vis: false }
      })
    }

    // Spin about the polar axis: idle drift, drag, and turning a picked site to face the camera.
    let spin = -0.6
    let spinTarget: number | null = null
    let holdUntil = 0
    const focus = (id?: string) => {
      const m = markers.find((x) => x.id === id)
      if (!m) return
      const a = Math.atan2(-m.local.x, m.local.z)
      let d = a - spin
      d = Math.atan2(Math.sin(d), Math.cos(d))
      spinTarget = spin + d
      holdUntil = performance.now() + HOLD_MS
    }
    // Free view: zoom (wheel, pinch, buttons) and tilt (vertical drag) on top of the spin.
    let zoom = 1
    let zoomGoal = 1
    let tiltCur = TILT
    let tiltGoal = TILT
    const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
    const clampTilt = (a: number) => Math.min(TILT_MAX, Math.max(TILT_MIN, a))
    const zoomBy = (f: number) => {
      zoomGoal = clampZoom(zoomGoal * f)
      holdUntil = performance.now() + HOLD_MS
    }
    const recenter = () => {
      zoomGoal = 1
      tiltGoal = TILT
      holdUntil = performance.now() + HOLD_MS
      if (state.current.focusId) focus(state.current.focusId)
    }
    const diveTo = (on: boolean) => {
      if (!on) return recenter()
      if (state.current.focusId) focus(state.current.focusId)
      zoomGoal = 0.22
      tiltGoal = TILT_MAX
      spinVel = tiltVel = 0
      holdUntil = performance.now() + 60000
    }
    api.current = { syncSites, focus, zoomBy, recenter, dive: diveTo }
    syncSites()

    const pointers = new Map<number, { x: number; y: number }>()
    let drag: { x: number; y: number; spin: number; tilt: number; moved: number } | null = null
    // Smooth hands: the drag sets a goal the Moon glides to, and a flick keeps turning and slows down.
    let spinDrag = 0
    let spinVel = 0
    let tiltVel = 0
    let track: { t: number; s: number; a: number }[] = []
    let pinch: { d: number; zoom: number } | null = null
    const spread = () => {
      const [a, b] = [...pointers.values()]
      return Math.hypot(a.x - b.x, a.y - b.y) || 1
    }
    const down = (e: PointerEvent) => {
      if (state.current.mode !== 'app') return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      canvas.setPointerCapture(e.pointerId)
      spinTarget = null
      setHoverId(null)
      if (pointers.size >= 2) {
        pinch = { d: spread(), zoom: zoomGoal }
        drag = null
      } else {
        drag = { x: e.clientX, y: e.clientY, spin, tilt: tiltGoal, moved: 0 }
        spinDrag = spin
        spinVel = tiltVel = 0
        track = [{ t: performance.now(), s: spin, a: tiltGoal }]
      }
    }
    const move = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch && pointers.size >= 2) {
        zoomGoal = clampZoom((pinch.zoom * pinch.d) / spread())
        holdUntil = performance.now() + HOLD_MS
        return
      }
      if (!drag) {
        // Mouse resting near a dot (the label may be hidden when many sites are listed).
        if (e.pointerType !== 'mouse' || state.current.mode !== 'app') return
        let best: { id: string; d: number } | null = null
        for (const m of markers) {
          if (!m.vis) continue
          const d = Math.hypot(m.sx - e.clientX, m.sy - e.clientY)
          if (d < 22 && (!best || d < best.d)) best = { id: m.id, d }
        }
        setHoverId(best ? best.id : null)
        canvas.style.cursor = best ? 'pointer' : ''
        return
      }
      setHoverId(null)
      // Closer in, slower turns, so the ground under the finger does not race away.
      const gain = Math.min(1.5, Math.sqrt(zoom))
      spinDrag = drag.spin + ((e.clientX - drag.x) / Math.max(320, window.innerWidth * 0.5)) * Math.PI * gain
      tiltGoal = clampTilt(drag.tilt - ((e.clientY - drag.y) / Math.max(320, window.innerHeight * 0.6)) * Math.PI * 0.6)
      const t = performance.now()
      track.push({ t, s: spinDrag, a: tiltGoal })
      while (track.length > 2 && t - track[0].t > 100) track.shift()
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y))
      holdUntil = performance.now() + HOLD_MS
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pinch) {
        // A pinch never counts as a tap; once both fingers are up, start fresh.
        if (pointers.size < 2) pinch = null
        drag = null
        return
      }
      const moved = drag ? drag.moved : 99
      if (drag && moved > 6 && !reduce && track.length > 1) {
        // Release speed from the last tenth of a second; a hand that stopped before letting go adds none.
        const a = track[0]
        const b = track[track.length - 1]
        const span = (b.t - a.t) / 1000
        const still = performance.now() - b.t > 140
        if (span > 0.01 && !still) {
          spinVel = Math.max(-2.5, Math.min(2.5, (b.s - a.s) / span))
          tiltVel = Math.max(-1.5, Math.min(1.5, (b.a - a.a) / span))
        }
      }
      drag = null
      if (moved > 6 || state.current.mode !== 'app') return
      // A tap on the Moon picks the nearest marker within reach of a finger.
      let best: { id: string; d: number } | null = null
      for (const m of markers) {
        const p = new THREE.Vector3().copy(m.local).applyMatrix4(moon.matrixWorld).project(camera)
        const x = (p.x * 0.5 + 0.5) * window.innerWidth
        const y = (-p.y * 0.5 + 0.5) * window.innerHeight
        const d = Math.hypot(x - e.clientX, y - e.clientY)
        if (d < 34 && (!best || d < best.d)) best = { id: m.id, d }
      }
      if (best) state.current.onPick(best.id)
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    const leave = () => setHoverId(null)
    canvas.addEventListener('pointerleave', leave)
    const wheel = (e: WheelEvent) => {
      if (state.current.mode !== 'app') return
      e.preventDefault()
      zoomGoal = clampZoom(zoomGoal * Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004))
      holdUntil = performance.now() + HOLD_MS
    }
    canvas.addEventListener('wheel', wheel, { passive: false })

    // Camera: intro (far, limb low) -> app (south pole in the free frame). Interpolated by `k`.
    let k = state.current.mode === 'app' ? 1 : 0
    let kFrom = k
    let kStart = 0
    let lastMode = state.current.mode
    const TRANSITION_MS = 2600

    const target = new THREE.Vector3()
    const camDir = new THREE.Vector3()
    // App framing eases towards the pole (nothing picked) or towards the picked site (closer).
    const pole = new THREE.Vector3(0, -1, 0)
    const appTarget = new THREE.Vector3(0, -1, 0)
    const focusWorld = new THREE.Vector3()
    let appDist = small ? 0.62 : 0.48
    const tmp = new THREE.Vector3()
    const world = new THREE.Vector3()
    const camToPoint = new THREE.Vector3()

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
    }
    resize()
    window.addEventListener('resize', resize)

    // Adaptive quality: if frames come too slowly, render fewer pixels (down to 0.6 of CSS pixels).
    let ratio = renderer.getPixelRatio()
    let slowSum = 0
    let slowN = 0
    const adapt = (dt: number) => {
      if (!shownAt) return
      slowSum += dt
      slowN++
      if (slowN < 45) return
      const avg = slowSum / slowN
      slowSum = 0
      slowN = 0
      if (avg <= 0.03) return
      if (q.level > 0) {
        // Slow: one level down. Fewer triangles, smaller or no shadows, lower resolution.
        q = qualityAt((q.level - 1) as 0 | 1, q.gpu)
        canvas.dataset.quality = String(q.level)
        cap.geometry.dispose()
        cap.geometry = polarCap(q)
        if (q.shadows > 0) {
          sun.shadow.map?.dispose()
          sun.shadow.map = null
          sun.shadow.mapSize.set(q.shadows, q.shadows)
        } else {
          sun.castShadow = false
          renderer.shadowMap.enabled = false
          capMat.needsUpdate = true
        }
        ratio = Math.min(ratio, q.pixelRatio)
        renderer.setPixelRatio(ratio)
        resize()
      } else if (avg > 0.045 && ratio > 0.6) {
        ratio = Math.max(0.6, ratio * 0.75)
        renderer.setPixelRatio(ratio)
        resize()
      }
    }

    let raf = 0
    let last = performance.now()
    const t0 = last
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) return
      adapt((now - last) / 1000)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const w = window.innerWidth
      const h = window.innerHeight

      if (state.current.mode !== lastMode) {
        lastMode = state.current.mode
        kFrom = k
        kStart = now
      }
      const goal = state.current.mode === 'app' ? 1 : 0
      if (k !== goal) {
        const p = reduce ? 1 : Math.min(1, (now - kStart) / TRANSITION_MS)
        k = kFrom + (goal - kFrom) * ease(p)
        if (p >= 1) k = goal
      }

      // Spin.
      if (drag) {
        spin += (spinDrag - spin) * (1 - Math.exp(-dt * 18))
      } else if (spinVel !== 0 || tiltVel !== 0) {
        const decay = Math.exp(-dt * 2.2) // a long, soft glide
        spin += spinVel * dt
        tiltGoal = clampTilt(tiltGoal + tiltVel * dt)
        spinVel *= decay
        tiltVel *= decay
        if (Math.abs(spinVel) < 0.004) spinVel = 0
        if (Math.abs(tiltVel) < 0.004) tiltVel = 0
        holdUntil = now + HOLD_MS
      } else if (spinTarget !== null) {
        spin += (spinTarget - spin) * (1 - Math.exp(-dt * 1.6))
        if (Math.abs(spinTarget - spin) < 0.001) spinTarget = null
      } else if (!drag && !reduce && now > holdUntil && now > hoverHold) {
        // Slower while choosing, so labels are easy to tap.
        const choosing = !state.current.focusId
        spin += SPIN * dt * (k < 0.5 ? 1.6 : choosing ? 0.35 : 1)
      }
      moon.rotation.y = spin
      canvas.dataset.spin = spin.toFixed(4) // read by the automated checks

      // The Sun walks slowly around the horizon of the pole; grazing, a few degrees high.
      const az = (150 + (reduce ? 0 : (now - t0) / 1000) * 1.2) * DEG
      sun.position.set(Math.cos(az), -0.13, Math.sin(az)).normalize().multiplyScalar(3).add(sun.target.position)

      // Camera framing. Intro: whole Moon from afar, its disc low so the limb sits under the title.
      // App: close over the south pole, placed in the centre of the free frame of the layout.
      const fm = markers.find((x) => x.id === state.current.focusId)
      if (hoverId) hoverHold = Math.max(hoverHold, now + 400)
      const frozen = now < hoverHold // a label is under the pointer: hold the camera still too
      if (frozen) {
        // keep appTarget and appDist as they are
      } else if (fm) {
        focusWorld.copy(fm.local).applyAxisAngle(new THREE.Vector3(0, 1, 0), spin)
        // Slow, frame-rate independent glides: the camera drifts to a site rather than jumping.
        appTarget.lerp(focusWorld, 1 - Math.exp(-dt * 1.3))
        appDist += ((small ? 0.85 : 0.62) - appDist) * (1 - Math.exp(-dt * 1.3))
      } else {
        appTarget.lerp(pole, 1 - Math.exp(-dt * 1.3))
        appDist += ((small ? 0.62 : 0.48) - appDist) * (1 - Math.exp(-dt * 1.3))
      }
      // Frame-rate independent easing: the same feel at 30 or 120 frames per second.
      zoom += (zoomGoal - zoom) * (1 - Math.exp(-dt * (pinch ? 14 : 4.5)))
      tiltCur += (tiltGoal - tiltCur) * (1 - Math.exp(-dt * (drag ? 12 : 3.5)))
      const viewDist = appDist * zoom
      // Far out, orbit the whole Moon instead of a point on its surface.
      const far = THREE.MathUtils.smoothstep(viewDist, 1.1, 3.2)
      const tilt = THREE.MathUtils.lerp(92 * DEG, tiltCur, k)
      const dist = THREE.MathUtils.lerp(5.4, viewDist, k)
      target.set(0, 0, 0).lerp(appTarget, k * (1 - far))
      camDir.set(0, -Math.cos(tilt), Math.sin(tilt)).normalize()
      camera.position.copy(target).addScaledVector(camDir, dist)
      camera.up.set(0, 1, 0)
      camera.lookAt(target)

      let fx = w / 2
      let fy = h * 1.12
      const frameEl = frameRef.current
      if (frameEl) {
        const r = frameEl.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          fx = THREE.MathUtils.lerp(w / 2, r.left + r.width / 2, k)
          fy = THREE.MathUtils.lerp(h * 1.12, r.top + r.height / 2, k)
        }
      } else {
        fy = THREE.MathUtils.lerp(h * 1.12, h * 0.42, k)
      }
      const ctl = controlsRef.current
      if (ctl) {
        if (frameEl) {
          const r = frameEl.getBoundingClientRect()
          const key = `${Math.round(r.right)},${Math.round(r.bottom)}`
          if (ctl.dataset.pos !== key) {
            ctl.dataset.pos = key
            ctl.style.left = `${Math.round(r.right - 12)}px`
            ctl.style.top = `${Math.round(r.bottom - 12)}px`
          }
        }
        ctl.style.opacity = k > 0.95 ? '1' : '0'
        ctl.style.pointerEvents = k > 0.95 ? 'auto' : 'none'
        ctl.dataset.moved = Math.abs(zoomGoal - 1) > 0.08 || Math.abs(tiltGoal - TILT) > 3 * DEG ? 'true' : 'false'
      }
      camera.setViewOffset(w, h, w / 2 - fx, h / 2 - fy, w, h)
      camera.updateProjectionMatrix()

      const frameBox = frameEl ? frameEl.getBoundingClientRect() : null
      // Markers and their labels. Labels that would overlap are nudged down, in screen order.
      const pulse = 1 + 0.25 * Math.sin(now / 260)
      const placed: { x: number; y: number; w: number }[] = []
      for (const m of markers) {
        const on = m.id === state.current.focusId
        const ringMat = m.ring.material as THREE.MeshBasicMaterial
        const dotMat = m.dot.material as THREE.MeshBasicMaterial
        // Each site is a dot in the colour of its verdict; the picked one gets a pulsing ring.
        ringMat.color.set(on ? 0xf2b705 : 0xffffff)
        if (on) dotMat.color.set(0xf2b705)
        else dotMat.color.copy(m.color)
        m.ring.visible = on || state.current.showLabels
        const size = Math.min(1, dist / 1.05) * 0.75
        m.ring.scale.setScalar(size * (on ? 1.5 * pulse : 1))
        m.dot.scale.setScalar(size * (state.current.showLabels ? 1 : 1.35))
        ringMat.opacity = dotMat.opacity = k
        world.copy(m.local).applyMatrix4(moon.matrixWorld)
        tmp.copy(world).normalize()
        camToPoint.copy(camera.position).sub(world).normalize()
        const facing = tmp.dot(camToPoint)
        tmp.copy(world).project(camera)
        const x = (tmp.x * 0.5 + 0.5) * w
        const y = (-tmp.y * 0.5 + 0.5) * h
        // Only where the Moon is in the clear: no label shows through the panels.
        const inFrame = !frameBox || (x > frameBox.left - 4 && x < frameBox.right - 8 && y > frameBox.top - 4 && y < frameBox.bottom - 8)
        const show = inFrame && k > 0.85 && facing > 0.08 && (on || (state.current.showLabels && (!small || !!state.current.focusId)))
        m.sx = x
        m.sy = y
        m.vis = k > 0.85 && facing > 0.08
        let ly = y
        const lw = m.el.offsetWidth || 120
        // Near the right edge (and the view buttons), the label goes to the left of its dot instead.
        // The label is drawn 14 px right of (lx, ly) and 14 px up (see .moon-label).
        const right = Math.min(w - (small ? 76 : 22), frameBox ? frameBox.right - 8 : w)
        const left = frameBox ? frameBox.left + 8 : 8
        let lx = x
        if (x + 14 + lw > right) {
          if (x - lw - 14 >= left) lx = x - lw - 28
          else {
            // No room either side (a narrow free area): centred under the dot, kept inside.
            lx = Math.min(right - lw, Math.max(left, x - lw / 2)) - 14
            ly = y + 30
          }
        }
        for (let guard = 0; guard < 8; guard++) {
          const hit = placed.find((p) => Math.abs(p.y - ly) < 30 && lx < p.x + p.w + 6 && p.x < lx + lw + 6)
          if (!hit) break
          ly = hit.y + 32
        }
        if (show) placed.push({ x: lx, y: ly, w: lw })
        // Move labels by whole pixels only, so a label under the finger stays put.
        const nx = Math.round(lx)
        const ny = Math.round(ly)
        const key = `${nx},${ny}`
        if (m.el.dataset.pos !== key) {
          m.el.dataset.pos = key
          m.el.style.transform = `translate(${nx}px, ${ny}px)`
        }
        m.el.style.opacity = show ? '1' : '0'
        m.el.style.pointerEvents = show ? 'auto' : 'none'
        m.el.dataset.on = on ? 'true' : 'false'
      }
      stars.rotation.y = spin * 0.08

      // Callout: anchored on the hovered dot, opening to the side with more room.
      const co = calloutRef.current
      if (co) {
        const hm = hoverId ? markers.find((x) => x.id === hoverId) : undefined
        if (hm && hm.vis) {
          const key = `${Math.round(hm.sx)},${Math.round(hm.sy)}`
          if (co.dataset.pos !== key) {
            co.dataset.pos = key
            co.style.transform = `translate(${Math.round(hm.sx)}px, ${Math.round(hm.sy)}px)`
          }
          co.dataset.side = hm.sx > w - 360 ? 'left' : 'right'
          co.dataset.drop = hm.sy < 330 ? 'down' : 'up'
          co.style.visibility = 'visible'
        } else co.style.visibility = 'hidden'
      }

      const rise = shownAt ? Math.min(1, (now - shownAt) / (reduce ? 1 : 1400)) : 0
      renderer.toneMappingExposure = 1.15 * ease(rise)
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      window.clearTimeout(slowTimer)
      canvas.removeEventListener('webglcontextlost', lost)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('wheel', wheel)
      for (const m of markers) m.el.remove()
      api.current = null
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const siteKey = sites.map((s) => s.id).join('|')
  useEffect(() => {
    api.current?.syncSites()
  }, [siteKey])
  useEffect(() => {
    api.current?.focus(focusId)
  }, [focusId, siteKey])
  useEffect(() => {
    api.current?.dive(dive)
  }, [dive])

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-0 h-full w-full touch-none" aria-hidden="true" />
      <div ref={labelsRef} className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" />
      {controls && (
        <div ref={controlsRef} className="moon-controls" style={{ opacity: 0 }}>
          <button type="button" onClick={() => api.current?.zoomBy(1 / 1.6)} aria-label={controls.zoomIn} title={controls.zoomIn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" onClick={() => api.current?.zoomBy(1.6)} aria-label={controls.zoomOut} title={controls.zoomOut}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          <button type="button" className="moon-recenter" onClick={() => api.current?.recenter()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            <span>{controls.recenter}</span>
          </button>
        </div>
      )}
      {info && (
        <div ref={calloutRef} className="moon-callout" style={{ visibility: 'hidden' }} aria-hidden={!hover}>
          {hover && (
            <div key={hover} className="moon-callout-in">
              <svg className="moon-callout-lead" width="64" height="64" viewBox="-4 -60 68 64" aria-hidden="true">
                <circle cx="0" cy="0" r="9" fill="none" stroke="#f2b705" strokeWidth="1.5" />
                <path d="M6.5 -6.5 L44 -44 L64 -44" fill="none" stroke="#f2b705" strokeWidth="1.5" pathLength="1" />
              </svg>
              <div className="moon-callout-card" role="tooltip">
                {info(hover)}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
