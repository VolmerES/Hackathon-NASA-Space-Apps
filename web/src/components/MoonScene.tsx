import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { DSN_MIN_ELEV_DEG, DSN_STATIONS } from '../data/model'
import { measureQuality, qualityAt, type Quality } from './quality'
import type { CesiumMoon } from './cesiumMoon'
import * as sfx from '../sound'

// The real Moon, behind the whole app. Colour: LRO LROC mosaic; relief: LRO LOLA elevation turned
// into a normal map (NASA's Scientific Visualization Studio, CGI Moon Kit). Sunlight comes from the
// real sub-solar point of the chosen hour, so the shadows of the LOLA relief on the polar cap are
// the ones of that date.
// One scene does three jobs:
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
  controls?: { zoomIn: string; zoomOut: string; recenter: string; /** The orientation ring: its name and the label of each meridian button. */ gizmo?: string; faceLon?: (lon: string) => string; layer?: string; layerOn?: boolean; layerBusy?: boolean; onLayer?: () => void; earth?: string; fromEarth?: string; hd?: string; newMoon?: (pct: number) => string }
  /** Heat map laid over the polar cap (a square picture out to `deg` of colatitude), or null. */
  heat?: { canvas: HTMLCanvasElement; deg: number } | null
  /** Street view: dive down onto the focused site until the camera skims its ground. */
  dive?: boolean
  /** View buttons show only their icons (a big panel is open beside the Moon). */
  compactControls?: boolean
  /** Sub-solar point (deg) at the chosen date and hour, from JPL Horizons. In app mode the sunlight
   *  comes from there, so day, night and the terminator on the Moon are the real ones. */
  sunAt?: { lat: number; lon: number }
  /** The Earth in the Moon's sky at the chosen hour: sub-Earth point (deg) and distance, from JPL
   *  Horizons; `t` (ms, UTC) sets which side of the Earth faces the Moon. */
  earth?: { lat: number; lon: number; km: number; t: number; label: string; /** Moon elevation (deg) over each DSN antenna, in DSN_STATIONS order. */ dsn?: number[] }
  /** Street view button inside the callout: stand on that site. */
  onStreet?: (id: string) => void
  streetLabel?: string
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
// scripts/moon_polar_cap.py), times RELIEF (1: the true heights).
const HEIGHT_RANGE_M = 12578
const RELIEF = 1 // true scale (it was 1.5 before, a choice of the team for readability)
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

// A round dot (or a soft glow) drawn once on a canvas, for points and sprites.
function dotTexture(soft = false) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(soft ? 0.25 : 0.7, soft ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,1)')
  grad.addColorStop(soft ? 1 : 0.85, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// Read once at load: the app rewrites the hash afterwards.
const SFX_DEBUG = typeof window !== 'undefined' && /sfxdebug/.test(window.location.hash)

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

export function MoonScene({ mode, sites, focusId, onPick, frameRef, onFail, onReady, showLabels = true, info, controls, dive = false, compactControls = false, sunAt, onStreet, streetLabel = 'Street view', heat = null, earth }: Props) {
  const [view, setView] = useState<0 | 1 | 2>(0) // 0: the pole; 1: the Moon seen from the Earth; 2: looking at the Earth
  const controlsRef = useRef<HTMLDivElement>(null)
  const calloutRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [credit, setCredit] = useState(false) // Cesium ion terrain on screen: their attribution is due
  const [hdState, setHdState] = useState<0 | 1 | 2>(0) // HD Moon: off, loading, on
  const hdAvailable = !!import.meta.env.VITE_CESIUM_TOKEN
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const state = useRef({ mode, sites, focusId, onPick, showLabels, sunAt, earth })
  state.current = { mode, sites, focusId, onPick, showLabels, sunAt, earth }
  const api = useRef<{ syncSites: () => void; focus: (id?: string) => void; zoomBy: (f: number) => void; recenter: () => void; dive: (on: boolean) => void; closeCallout: () => void; setHeat: (h: Props['heat']) => void; setView: (v: 0 | 1 | 2) => void; setHd: (on: boolean) => void; faceLon: (lon: number) => void; rotateBy: (screenRad: number) => void } | null>(null)
  const gizmoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const labels = labelsRef.current
    if (!canvas || !labels) return
    // Set when this scene is torn down: late callbacks (a texture arriving after an unmount, as with
    // React's double mount in development) must not add labels to the page nobody will move or hide.
    let disposed = false
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

    // Decoration for the opening only: a small orbiter on a polar orbit, like the Lunar
    // Reconnaissance Orbiter whose LOLA data the tool uses. It passes over the south pole, goes behind
    // the Moon (the globe hides it) and fades out once the tool opens. Not to scale.
    const orbit = new THREE.Group()
    scene.add(orbit)
    const ORBIT_R = 1.24
    const ORBIT_S = 34 // seconds per turn
    const orbitPts: THREE.Vector3[] = []
    for (let i = 0; i <= 256; i++) orbitPts.push(new THREE.Vector3(Math.cos((i / 256) * Math.PI * 2) * ORBIT_R, Math.sin((i / 256) * Math.PI * 2) * ORBIT_R, 0))
    const orbitMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
    orbit.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPts), orbitMat))
    const sat = new THREE.Group()
    const satBody = new THREE.MeshStandardMaterial({ color: 0xc8a659, roughness: 0.45, metalness: 0.6, transparent: true })
    const satPanel = new THREE.MeshStandardMaterial({ color: 0x24375e, roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide, transparent: true })
    sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.02), satBody))
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.042), satPanel)
      panel.rotation.x = Math.PI / 2
      panel.position.z = side * 0.034
      sat.add(panel)
    }
    const satDotMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false })
    sat.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]), satDotMat))
    sat.scale.setScalar(1.5)
    orbit.add(sat)
    let orbitA = 2.2
    const orbitU = new THREE.Vector3()
    const orbitN = new THREE.Vector3()
    const orbitM = new THREE.Matrix4()

    // The Moon.
    const moon = new THREE.Group()
    scene.add(moon)
    const loader = new THREE.TextureLoader()
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
    // In HD the globe only fills the holes of the tiles near the poles (above 55 degrees): elsewhere it
    // is cut away, or it would show through the hairline seams between tiles.
    const globeHd = { value: 0 }
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.globeHd = globeHd
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vUp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normalize(position).y;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float globeHd;\nvarying float vUp;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (globeHd > 0.5 && abs(vUp) < 0.8) discard;')
    }
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 192), mat)
    globe.visible = false
    moon.add(globe)
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true, transparent: true, side: THREE.FrontSide })
    // Heat map: its colours tint the sunlit ground (relief and real shadows stay readable) and glow
    // faintly where the ground is dark; where the picture is transparent the Moon is untouched.
    // In HD the cap stays solid almost to its edge (see showHd): 1 there, 0 otherwise.
    const capHd = { value: 0 }
    capMat.onBeforeCompile = (shader) => {
      shader.uniforms.capHd = capHd
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float capHd;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a = mix(diffuseColor.a, clamp(diffuseColor.a * 5.0, 0.0, 1.0), capHd);')
        .replace(
        '#include <emissivemap_fragment>',
        `#ifdef USE_EMISSIVEMAP
          vec4 heatColor = texture2D( emissiveMap, vEmissiveMapUv );
          diffuseColor.rgb *= mix( vec3( 1.0 ), heatColor.rgb * 1.7 + 0.12, heatColor.a * 0.9 );
          totalEmissiveRadiance *= heatColor.rgb * heatColor.a * 0.3;
        #endif`,
      )
    }
    const cap = new THREE.Mesh(polarCap(q), capMat)
    // The cap casts shadows on itself: with the Sun a few degrees high, crater floors go dark.
    cap.castShadow = true
    cap.receiveShadow = true
    cap.visible = false
    cap.renderOrder = 1
    moon.add(cap)
    let loaded = 0
    let shownAt = 0
    // Optional high-detail Moon from Cesium ion, turned on by the viewer (the HD button). Its
    // picture has the light baked in, so our own Moon (real sunlight of the date) is the default.
    let cesium: CesiumMoon | null = null
    let hdOn = false
    let hdTiles = false // at least one tile has arrived
    const showHd = () => {
      const on = hdOn && hdTiles
      cesium?.setVisible(on)
      // In HD the tiles cover the globe, which stays just underneath (0.6 % smaller, below the lowest
      // ground) to fill the holes of their mosaic; the polar cap stays on top (see cesiumMoon.ts).
      globe.visible = shownAt > 0
      globe.scale.setScalar(on ? 0.994 : 1)
      globeHd.value = on ? 1 : 0
      cap.visible = shownAt > 0
      // Their mosaic has black blocks of painted shadow right where the cap fades out (65 to 70 S):
      // with the tiles on, the cap is solid to 24 degrees and fades over the last one.
      capHd.value = on ? 1 : 0
      setCredit(on)
    }
    const setHd = (on: boolean) => {
      const token = import.meta.env.VITE_CESIUM_TOKEN as string | undefined
      hdOn = on && !!token
      setHdState(hdOn ? (hdTiles ? 2 : 1) : 0)
      showHd()
      if (!hdOn || cesium || !token) return
      import('./cesiumMoon')
        .then(({ attachCesiumMoon }) => {
          if (!api.current || cesium) return
          cesium = attachCesiumMoon({
            token,
            parent: moon,
            camera,
            renderer,
            onFirstTile: () => {
              sfx.confirm()
              hdTiles = true
              if (hdOn) setHdState(2)
              showHd()
            },
          })
          cesium.setVisible(false)
          cesium.setHeat(heatTex, CAP_DEG)
        })
        .catch(() => {
          hdOn = false
          setHdState(0)
        })
    }
    // The Moon is "ready" only once it is drawn: maps in, the 4k ones too on the strongest computers
    // (so nothing swaps in front of the viewer), shaders compiled and two frames on screen. The
    // splash screen waits for this.
    const ready = () => {
      if (++loaded < 5) return
      if (q.maps4k) load4k(show)
      else show()
    }
    let showing = false
    const show = () => {
      if (showing) return
      showing = true
      globe.visible = true
      cap.visible = true
      try {
        renderer.compile(scene, camera)
      } catch {
        /* compiled on the first frame instead */
      }
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          shownAt = performance.now()
          onReady?.()
        }),
      )
    }
    // The 4k maps of the whole globe: at once on the strongest computers; on middle ones, the first
    // time the camera backs off far enough to see the whole Moon.
    let got4k = false
    const load4k = (then?: () => void) => {
      if (got4k) return
      got4k = true
      let left = 2
      const one = () => {
        if (--left === 0) then?.()
      }
      if (then) window.setTimeout(then, 6000) // a slow line does not hold the splash for the 4k maps
      {
        loader.load('moon/moon_color_4k.jpg', (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
          mat.map?.dispose()
          mat.map = tex
          mat.needsUpdate = true
          one()
        }, undefined, one)
        loader.load('moon/moon_normal_4k.jpg', (tex) => {
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
          mat.normalMap?.dispose()
          mat.normalMap = tex
          mat.needsUpdate = true
          one()
        }, undefined, one)
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
    // Phones and weak computers see the whole globe small: lighter maps for it (the pole has its own).
    const globeRes = small || q.level === 0 ? '1k' : '2k'
    loader.load(`moon/moon_color_${globeRes}.jpg`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      mat.map = tex
      mat.needsUpdate = true
      ready()
    }, undefined, fail)
    loader.load(`moon/moon_normal_${globeRes}.jpg`, (tex) => {
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      mat.normalMap = tex
      mat.normalScale = new THREE.Vector2(1.6, -1.6)
      mat.needsUpdate = true
      ready()
    }, undefined, fail)

    // Sunlight grazing the south pole, plus a faint earthshine so the night side is not pure black.
    const sun = new THREE.DirectionalLight(0xfff4e6, 3.2)
    scene.add(sun)
    const Y_AXIS = new THREE.Vector3(0, 1, 0)
    const Z_AXIS = new THREE.Vector3(0, 0, 1)
    const sunGoal = new THREE.Vector3()
    const sunLocal = new THREE.Vector3() // current sunlight direction, Moon-fixed

    // Shadows only over the polar cap, where the camera lives.
    renderer.shadowMap.enabled = q.shadows > 0
    renderer.shadowMap.type = THREE.PCFShadowMap
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

    // The Earth, in the Moon's own frame: towards the sub-Earth point, at its true angular size
    // (drawn nearer and smaller in proportion). Colour: NASA Blue Marble. Lit by the same Sun, so
    // its phase is the real one.
    const EARTH_AT = 50
    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 1, metalness: 0 }))
    // The picture has no clouds or air, so the sunlit Earth would come out far too dark: lifted, with a blue haze.
    earthMesh.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = diffuseColor.rgb * 2.6 + vec3( 0.05, 0.09, 0.16 );`)
    }
    earthMesh.visible = false
    moon.add(earthMesh)
    let earthLoaded = false
    loader.load('moon/earth_1k.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      ;(earthMesh.material as THREE.MeshStandardMaterial).map = tex
      ;(earthMesh.material as THREE.MeshStandardMaterial).needsUpdate = true
      earthLoaded = true
    })
    const earthEl = document.createElement('div')
    earthEl.className = 'moon-earth-label'
    earthEl.style.opacity = '0'
    labels.appendChild(earthEl)
    // NASA's Deep Space Network on the Earth: the three 70 m antennas at their real latitude and
    // longitude (the Earth turns to its real side for the hour, see orientEarth). Looking at the Earth,
    // each antenna that has the Moon at least DSN_MIN_ELEV_DEG over its horizon is linked to the chosen
    // site, with signal pulses travelling along the link. A picture of the geometry, not a radio budget.
    const DSN_HEX = [0xff5a6a, 0xb794f6, 0x2dd4bf] // Madrid, Goldstone, Canberra (as in the stay bar)
    const dsnLocal = DSN_STATIONS.map((st) => surface(st.lat, st.lon, 1.015))
    const dsnDots = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(dsnLocal),
      new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, depthWrite: false, map: dotTexture(), alphaTest: 0.3, transparent: true }),
    )
    dsnDots.geometry.setAttribute('color', new THREE.Float32BufferAttribute(DSN_HEX.flatMap((c) => new THREE.Color(c).toArray()), 3))
    dsnDots.visible = false
    earthMesh.add(dsnDots)
    const linkMat = (hex: number) =>
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, alpha: { value: 0 }, color: { value: new THREE.Color(hex) } },
        vertexShader: 'attribute float u; varying float vU; void main() { vU = u; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        // A faint line with bright pulses running from the antenna (u = 0) to the site (u = 1).
        fragmentShader: 'uniform float time; uniform float alpha; uniform vec3 color; varying float vU; void main() { float p = fract(vU * 7.0 - time * 0.9); float pulse = smoothstep(0.82, 0.97, p) * (1.0 - smoothstep(0.97, 1.0, p)); gl_FragColor = vec4(color, alpha * (0.45 + 0.55 * pulse)); }',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    const dsnLinks = DSN_STATIONS.map((_, k) => {
      const g = new THREE.BufferGeometry()
      const SEG = 64 // many points along the link, so the pulses are smooth
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((SEG + 1) * 3), 3))
      g.setAttribute('u', new THREE.Float32BufferAttribute(Array.from({ length: SEG + 1 }, (_, i) => i / SEG), 1))
      const line = new THREE.Line(g, linkMat(DSN_HEX[k]))
      line.frustumCulled = false
      line.visible = false
      moon.add(line)
      return line
    })
    // A bright packet of signal running down each link, antenna to site.
    const packetTex = dotTexture(true)
    const dsnPackets = DSN_STATIONS.map((_, k) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: packetTex, color: DSN_HEX[k], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false }))
      sp.scale.setScalar(0.0045)
      sp.visible = false
      moon.add(sp)
      return sp
    })
    const dsnLabels = DSN_STATIONS.map((st, k) => {
      const el = document.createElement('div')
      el.className = 'moon-earth-label moon-dsn-label'
      el.style.opacity = '0'
      el.innerHTML = `<i style="background:#${DSN_HEX[k].toString(16).padStart(6, '0')}"></i>${st.name} <span>${st.dss}</span>`
      labels.appendChild(el)
      return el
    })
    const dsnA = new THREE.Vector3()
    const dsnB = new THREE.Vector3()
    const dsnN = new THREE.Vector3()
    let dsnShow = 0 // 0..1, fades the links in and out
    const earthDir = new THREE.Vector3(1, 0, 0) // Moon-fixed
    const earthWorld = new THREE.Vector3()
    let earthKey = ''
    // Which side of the Earth faces the Moon. Worked out from what the scene already knows (the
    // Sun's direction in the Moon's frame) plus the date: the Earth's axis leans 23.44 deg towards
    // ecliptic longitude 90, and the Sun stands over the meridian of local noon. The Moon's pole
    // is taken as the ecliptic pole (1.5 deg apart). Checked against JPL Horizons: the Moon's
    // elevation over Madrid this gives is within 1.6 deg over the whole period.
    const orientEarth = (tMs: number) => {
      const days = (tMs - Date.UTC(2000, 0, 1, 12)) / 86400000
      const g = (357.528 + 0.9856003 * days) * DEG
      const lam = (280.46 + 0.9856474 * days + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG
      const h = new THREE.Vector3(sunLocal.x, 0, sunLocal.z).normalize().applyAxisAngle(Y_AXIS, Math.PI / 2 - lam)
      const axis = h.multiplyScalar(Math.cos(66.56 * DEG)).addScaledVector(Y_AXIS, Math.sin(66.56 * DEG)).normalize()
      const b = ((360 / 365) * ((days % 365.25) - 81)) * DEG
      const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b) // minutes
      const utH = (((tMs / 3600000) % 24) + 24) % 24
      const lonSun = -15 * (utH - 12) - eot / 4
      const q1 = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, axis)
      const a0 = surface(0, lonSun).applyQuaternion(q1)
      const sp = sunLocal.clone().addScaledVector(axis, -sunLocal.dot(axis)).normalize()
      const ang = Math.atan2(new THREE.Vector3().crossVectors(a0, sp).dot(axis), a0.dot(sp))
      earthMesh.quaternion.setFromAxisAngle(axis, ang).multiply(q1)
    }
    // Other views: the Moon as seen from the Earth, and the Earth over the Moon's south pole.
    let viewGoal: 0 | 1 | 2 = 0
    let vk = 0
    let altKind: 0 | 1 | 2 = 0 // the view being entered or left, for the roll
    const slerpQ = new THREE.Quaternion()
    const altDir = new THREE.Vector3(1, 0, 0)
    let altDist = 30
    const altTarget = new THREE.Vector3()
    let altFov = 30
    const goalPos = new THREE.Vector3()
    const goalTarget = new THREE.Vector3()
    const curDir = new THREE.Vector3()
    const lookTarget = new THREE.Vector3()
    const sideUp = new THREE.Vector3()

    // Site markers: a ring flat on the surface; the label is HTML so it is readable and tappable.
    type Marker = { id: string; ring: THREE.Mesh; dot: THREE.Mesh; local: THREE.Vector3; el: HTMLButtonElement; lead: HTMLDivElement; spot: number; box: { x: number; y: number; w: number; h: number }; color: THREE.Color; sx: number; sy: number; vis: boolean }
    let markers: Marker[] = []
    let hoverHold = 0
    // Site under the mouse: shows the callout and holds the Moon still.
    let hoverId: string | null = null
    let sticky = false // opened by a finger: stays until a tap elsewhere
    let overCallout = false
    let labelFocus: string | undefined = undefined // picked site the labels were last laid out for
    let hoverVia: 'dot' | 'label' = 'dot' // where the mouse found the site: the callout opens next to it
    let dropTimer = 0
    const setHoverId = (id: string | null, byTouch = false) => {
      window.clearTimeout(dropTimer)
      dropTimer = 0
      sticky = !!id && byTouch
      if (id === hoverId) return
      if (id) sfx.hover()
      hoverId = id
      setHover(id)
    }
    // The mouse left the site: give it a moment to reach the callout before closing it.
    const dropHoverSoon = () => {
      if (dropTimer || !hoverId || sticky) return
      dropTimer = window.setTimeout(() => {
        dropTimer = 0
        if (!overCallout && !sticky) setHoverId(null)
      }, 900)
    }
    // Picking a site: a small lunar module comes down a beam of light onto it, and as it touches two
    // waves open on the ground in the colour of the site's verdict. A sign, not a trajectory.
    const pickBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 20, 1, true),
      new THREE.ShaderMaterial({
        uniforms: { alpha: { value: 0 } },
        vertexShader: 'varying float vY; void main() { vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        // Bright at the ground (y = 0), fading upwards.
        fragmentShader: 'uniform float alpha; varying float vY; void main() { gl_FragColor = vec4(1.0, 0.82, 0.35, alpha * pow(1.0 - vY, 2.0) * 0.55); }',
        transparent: true,
        depthWrite: false,
        depthTest: false, // the relief of the high-resolution cap would cut it
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    )
    pickBeam.visible = false
    pickBeam.renderOrder = 5
    moon.add(pickBeam)
    const pickRings = [0, 1].map(() => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.0125, 0.0135, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
      r.visible = false
      r.renderOrder = 5
      moon.add(r)
      return r
    })
    // The lander, drawn once: body, descent stage, four legs.
    const landerTex = (() => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const g = c.getContext('2d')!
      g.strokeStyle = g.fillStyle = '#fff'
      g.lineWidth = 3
      g.lineCap = 'round'
      g.fillRect(24, 14, 16, 12) // ascent stage
      g.fillRect(20, 26, 24, 12) // descent stage
      g.beginPath()
      for (const [x0, x1] of [[22, 10], [42, 54], [26, 20], [38, 44]]) {
        g.moveTo(x0, 36)
        g.lineTo(x1, 52)
      }
      g.moveTo(6, 52); g.lineTo(14, 52); g.moveTo(50, 52); g.lineTo(58, 52)
      g.stroke()
      return new THREE.CanvasTexture(c)
    })()
    const pickLander = new THREE.Sprite(new THREE.SpriteMaterial({ map: landerTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false }))
    pickLander.center.set(0.5, 0.18) // its feet, not its middle, sit on the line of descent
    pickLander.visible = false
    pickLander.renderOrder = 6
    moon.add(pickLander)
    let pickAnim: { id: string; t0: number } | null = null
    let pickSeen: string | undefined | null = null // null: the app has not shown a frame yet
    const pickN = new THREE.Vector3()
    const pickQ = new THREE.Quaternion()
    const pickInv = new THREE.Quaternion()
    const pickUp = new THREE.Vector3()
    const ringGeo = new THREE.RingGeometry(0.010, 0.0135, 48)
    const dotGeo = new THREE.CircleGeometry(0.0045, 24)
    const syncSites = () => {
      if (disposed) return
      for (const m of markers) {
        moon.remove(m.ring, m.dot)
        ;(m.ring.material as THREE.Material).dispose()
        ;(m.dot.material as THREE.Material).dispose()
        m.el.remove()
        m.lead.remove()
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
          if (e.pointerType === 'mouse') {
            hoverVia = 'label'
            setHoverId(s.id)
          }
        })
        el.addEventListener('pointerleave', dropHoverSoon)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          state.current.onPick(s.id)
        })
        labels.appendChild(el)
        // A thin leader line from the dot to its label, shown when the label had to move away from it.
        const lead = document.createElement('div')
        lead.className = 'moon-lead'
        lead.style.opacity = '0'
        labels.insertBefore(lead, labels.firstChild)
        return { id: s.id, ring, dot, local, el, lead, spot: 0, box: { x: 0, y: 0, w: 0, h: 0 }, color: new THREE.Color(s.color ?? '#ffffff'), sx: 0, sy: 0, vis: false }
      })
    }

    // Spin about the polar axis: idle drift, drag, and turning a picked site to face the camera.
    let spin = -0.6
    let spinTarget: number | null = null
    // A turn to a newly picked site: eased in and out, longer the bigger it is, with the camera
    // backing off a little half way, like a hop between places on a map.
    let turn: { from: number; to: number; t0: number; dur: number; hop: number } | null = null
    let hop = 0
    let holdUntil = 0
    const focus = (id?: string) => {
      const m = markers.find((x) => x.id === id)
      if (!m) return
      sfx.whoosh(0.6)
      const a = Math.atan2(-m.local.x, m.local.z)
      let d = a - spin
      d = Math.atan2(Math.sin(d), Math.cos(d))
      spinTarget = null
      turn = Math.abs(d) < 0.02 ? null : { from: spin, to: spin + d, t0: performance.now(), dur: reduce ? 1 : 1100 + (Math.abs(d) / (Math.PI / 2)) * 1300, hop: Math.min(1, Math.abs(d) / (60 * DEG)) * 0.45 }
      holdUntil = performance.now() + HOLD_MS
    }
    // Free view: zoom (wheel, pinch, buttons) and tilt (vertical drag) on top of the spin.
    let zoom = 1
    let zoomGoal = 1
    // Diving into street view, the camera rolls on its axis so the ground sits at the bottom of the
    // screen and the sky above, as if standing on the Moon. Only then: manual zoom keeps the map view.
    let roll = 0 // 0: polar view, north up; 1: standing, ground at the bottom
    let standGoal = 0
    let tiltCur = TILT
    let tiltGoal = TILT
    const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
    const clampTilt = (a: number) => Math.min(TILT_MAX, Math.max(TILT_MIN, a))
    const zoomBy = (f: number) => {
      sfx.click()
      zoomGoal = clampZoom(zoomGoal * f)
      holdUntil = performance.now() + HOLD_MS
    }
    const setViewTo = (v: 0 | 1 | 2) => {
      sfx.whoosh(0.9)
      viewGoal = v
      setView(v)
      zoomGoal = 1
      tiltGoal = TILT
      spinVel = tiltVel = 0
    }
    const recenter = () => {
      sfx.whoosh(0.7)
      viewGoal = 0
      setView(0)
      zoomGoal = 1
      tiltGoal = TILT
      holdUntil = performance.now() + HOLD_MS
      if (state.current.focusId) focus(state.current.focusId)
    }
    const diveTo = (on: boolean) => {
      standGoal = on ? 1 : 0
      viewGoal = 0
      setView(0)
      if (!on) return recenter()
      if (state.current.focusId) focus(state.current.focusId)
      zoomGoal = 0.12
      tiltGoal = TILT_MAX
      spinVel = tiltVel = 0
      holdUntil = performance.now() + 60000
    }
    // Heat map: drawn into the cap's own texture space and shown as light the ground gives off, so
    // it reads the same in sunlit and in shadowed terrain; the photo underneath is dimmed.
    let heatTex: THREE.CanvasTexture | null = null
    const setHeat = (h: Props['heat']) => {
      heatTex?.dispose()
      heatTex = null
      if (h) {
        const size = 640
        const c = document.createElement('canvas')
        c.width = c.height = size
        const g = c.getContext('2d')
        if (g) {
          const span = (h.deg / CAP_DEG) * size
          g.imageSmoothingQuality = 'high'
          g.drawImage(h.canvas, (size - span) / 2, (size - span) / 2, span, span)
          heatTex = new THREE.CanvasTexture(c)
          heatTex.colorSpace = THREE.SRGBColorSpace
        }
      }
      const had = !!capMat.emissiveMap
      capMat.emissiveMap = heatTex
      cesium?.setHeat(heatTex, CAP_DEG)
      capMat.emissive.set(heatTex ? 0xffffff : 0x000000)
      capMat.emissiveIntensity = heatTex ? 1 : 0
      if (had !== !!heatTex) capMat.needsUpdate = true
    }
    // The orientation ring (as in 3D editors): a meridian turned to face the camera, or the Moon
    // turned with the ring by an angle on the screen.
    const faceLon = (lon: number) => {
      const v = surface(-84, lon)
      let d = Math.atan2(-v.x, v.z) + Math.PI - spin // + half a turn: towards the viewer, at the bottom
      d = Math.atan2(Math.sin(d), Math.cos(d))
      sfx.whoosh(0.5)
      spinTarget = null
      spinVel = tiltVel = 0
      turn = Math.abs(d) < 0.02 ? null : { from: spin, to: spin + d, t0: performance.now(), dur: reduce ? 1 : 700 + (Math.abs(d) / Math.PI) * 900, hop: 0 }
      holdUntil = performance.now() + HOLD_MS * 3
    }
    let gizmoSign = 1 // how the meridians turn on screen when the spin grows (depends on the view)
    const rotateBy = (a: number) => {
      turn = null
      spinTarget = null
      spinVel = tiltVel = 0
      spin += a * gizmoSign
      holdUntil = performance.now() + HOLD_MS * 3
    }
    api.current = { syncSites, focus, zoomBy, recenter, dive: diveTo, closeCallout: () => setHoverId(null), setHeat, setView: setViewTo, setHd, faceLon, rotateBy }
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
      turn = null
      setHoverId(null)
      if (pointers.size >= 2) {
        pinch = { d: spread(), zoom: zoomGoal }
        drag = null
      } else {
        drag = { x: e.clientX, y: e.clientY, spin, tilt: tiltGoal, moved: 0 }
        sfx.grab()
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
        if (best) {
          hoverVia = 'dot'
          setHoverId(best.id)
        }
        else dropHoverSoon()
        canvas.style.cursor = best ? 'pointer' : ''
        return
      }
      setHoverId(null)
      // Closer in, slower turns, so the ground under the finger does not race away.
      const gain = Math.min(1.5, Math.sqrt(zoom))
      // With the view rolled over, screen directions turn round: keep "grab the ground and move it".
      const flip = roll > 0.5 ? -1 : 1
      spinDrag = drag.spin + flip * ((e.clientX - drag.x) / Math.max(320, window.innerWidth * 0.5)) * Math.PI * gain
      // Vertical drag the natural way: the ground follows the hand.
      tiltGoal = clampTilt(drag.tilt + flip * ((e.clientY - drag.y) / Math.max(320, window.innerHeight * 0.6)) * Math.PI * 0.6)
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
      // A finger first opens the callout of the site (its numbers, the answer, street view);
      // a mouse, which already saw the callout on hover, picks the site.
      if (best && e.pointerType === 'touch' && calloutRef.current) setHoverId(best.id, true)
      else if (best) state.current.onPick(best.id)
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    // The callout can be reached with the mouse: over it, the site stays hovered.
    const leave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') dropHoverSoon()
    }
    canvas.addEventListener('pointerleave', leave)
    const calloutEnter = () => {
      overCallout = true
      window.clearTimeout(dropTimer)
      dropTimer = 0
    }
    const calloutLeave = () => {
      overCallout = false
      dropHoverSoon()
    }
    calloutRef.current?.addEventListener('pointerenter', calloutEnter)
    calloutRef.current?.addEventListener('pointerleave', calloutLeave)
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
    // The orientation ring: the pole and a point on each of four meridians (0, 90 E, 180, 90 W).
    const gzPole = surface(-90, 0)
    const gzLon = [0, 90, 180, -90].map((lon) => surface(-84, lon))
    const gzTmp = new THREE.Vector3()
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
      // A long gap is not a slow frame: the tab was hidden or the page paused. Counting it used to
      // drop the quality one level for good every time someone came back to the tab. The same
      // while the HD Moon is streaming its tiles.
      if (!shownAt || dt > 0.25 || (hdOn && !hdTiles)) return
      slowSum += dt
      slowN++
      if (slowN < 45) return
      const avg = slowSum / slowN
      slowSum = 0
      slowN = 0
      // Fast again: win back the resolution lost earlier, step by step.
      const maxRatio = Math.min(q.pixelRatio, window.devicePixelRatio || 1)
      if (avg < 0.018 && ratio < maxRatio) {
        ratio = Math.min(maxRatio, ratio / 0.8)
        renderer.setPixelRatio(ratio)
        resize()
        return
      }
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
    let lastSpinSound = 0
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
      } else if (turn) {
        const p = Math.min(1, (now - turn.t0) / turn.dur)
        spin = turn.from + (turn.to - turn.from) * ease(p)
        hop = turn.hop * Math.sin(Math.PI * p)
        if (p >= 1) {
          turn = null
          hop = 0
        }
      } else if (spinTarget !== null) {
        spin += (spinTarget - spin) * (1 - Math.exp(-dt * 1.6))
        if (Math.abs(spinTarget - spin) < 0.001) spinTarget = null
      } else if (!drag && !reduce && now > holdUntil && now > hoverHold && (k < 0.5 || !state.current.focusId)) {
        // Slower while choosing, so labels are easy to tap. With a site picked, the Moon holds still.
        spin += SPIN * dt * (k < 0.5 ? 1.6 : 0.35)
      }
      moon.rotation.y = spin
      // The sound of the rotation follows its speed (silent for the slow idle drift and in the intro).
      sfx.setSpin(state.current.mode === 'app' && dt > 0 ? Math.abs(spin - lastSpinSound) / dt : 0, spin)
      lastSpinSound = spin
      canvas.dataset.spin = spin.toFixed(4) // read by the automated checks

      // Sunlight. App mode, with data: from the real sub-solar point of the chosen hour, fixed to the
      // Moon (it turns with the globe), so lit and dark ground are the real ones for that date.
      // Intro, or before the data arrive: a decorative Sun walking low around the pole.
      const real = state.current.mode === 'app' ? state.current.sunAt : undefined
      // Worked out in the Moon's own frame, so the light turns with the globe however fast it spins.
      if (real) {
        sunGoal.copy(surface(real.lat, real.lon)).normalize()
      } else {
        const az = (150 + (reduce ? 0 : (now - t0) / 1000) * 1.2) * DEG
        sunGoal.set(Math.cos(az), -0.13, Math.sin(az)).normalize().applyAxisAngle(Y_AXIS, -spin)
      }
      // Glide to a new direction (a new date should not flash the whole globe).
      if (sunLocal.lengthSq() === 0 || reduce) sunLocal.copy(sunGoal)
      else sunLocal.lerp(sunGoal, 1 - Math.exp(-dt * 4)).normalize()
      sun.position.copy(sunLocal).applyAxisAngle(Y_AXIS, spin).multiplyScalar(3).add(sun.target.position)
      cesium?.setSun(sunLocal)

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
      // Diving into street view, a slower, longer push-in: it is still going while the view fades in.
      zoom += (zoomGoal - zoom) * (1 - Math.exp(-dt * (pinch ? 14 : standGoal ? 1.7 : 4.5)))
      tiltCur += (tiltGoal - tiltCur) * (1 - Math.exp(-dt * (drag ? 12 : 3.5)))
      if (!turn) hop = 0
      const viewDist = appDist * zoom * (1 + hop)
      if (!got4k && shownAt && !small && q.level >= 1 && viewDist > 1.6) load4k()
      // Far out, orbit the whole Moon instead of a point on its surface.
      const far = THREE.MathUtils.smoothstep(viewDist, 1.1, 3.2)
      const tilt = THREE.MathUtils.lerp(92 * DEG, tiltCur, k)
      let dist = THREE.MathUtils.lerp(5.4, viewDist, k)
      target.set(0, 0, 0).lerp(appTarget, k * (1 - far))
      camDir.set(0, -Math.cos(tilt), Math.sin(tilt)).normalize()
      camera.position.copy(target).addScaledVector(camDir, dist)
      lookTarget.copy(target)
      let fov = 30

      // The Earth: where it is, how big, which side it shows.
      const ea = real ? state.current.earth : undefined
      earthMesh.visible = !!ea && earthLoaded
      if (ea) {
        earthDir.copy(surface(ea.lat, ea.lon)).normalize()
        earthMesh.position.copy(earthDir).multiplyScalar(EARTH_AT)
        earthMesh.scale.setScalar((EARTH_AT * 6371) / ea.km)
        const key = `${ea.t}|${sunLocal.x.toFixed(3)}|${sunLocal.z.toFixed(3)}`
        if (key !== earthKey) {
          earthKey = key
          orientEarth(ea.t)
        }
      } else if (viewGoal) {
        viewGoal = 0
        setView(0)
      }
      earthWorld.copy(earthDir).applyAxisAngle(Y_AXIS, spin)
      // The other views, blended in from wherever the camera is.
      // A timed glide (1.6 s), eased at both ends: no lurch at the start or at the end.
      if (viewGoal) altKind = viewGoal
      vk = reduce ? (viewGoal ? 1 : 0) : Math.min(1, Math.max(0, vk + (viewGoal ? dt : -dt) / 1.6))
      if (vk === 0) altKind = 0
      if (viewGoal) {
        holdUntil = Math.max(holdUntil, now + 1500)
        const fr = frameRef.current?.getBoundingClientRect()
        const side = fr && fr.width > 0 ? Math.min(fr.width, fr.height) : Math.min(w, h)
        let goalFov: number
        if (viewGoal === 1) {
          // From the Earth: far along the line to it, through a long lens, the whole disc in the frame.
          goalPos.copy(earthWorld).multiplyScalar(30)
          goalTarget.set(0, 0, 0)
          goalFov = (3.82 * h) / (0.72 * side)
        } else {
          // Towards the Earth, from behind the Moon and south of it: the Earth over the polar limb.
          sideUp.copy(Y_AXIS).addScaledVector(earthWorld, -earthWorld.y).normalize()
          goalPos.copy(earthWorld).multiplyScalar(-7.87).addScaledVector(sideUp, -1.42)
          goalTarget.copy(goalPos).addScaledVector(earthWorld, 10)
          goalFov = (9 * h) / side
        }
        goalFov = Math.min(60, goalFov * THREE.MathUtils.clamp(zoom, 0.4, 2.5))
        const gd = goalPos.length()
        goalPos.divideScalar(gd)
        if (vk < 0.02 || reduce) {
          altDir.copy(goalPos)
          altDist = gd
          altTarget.copy(goalTarget)
          altFov = goalFov
        } else {
          const s = 1 - Math.exp(-dt * 3)
          altDir.lerp(goalPos, s).normalize()
          altDist += (gd - altDist) * s
          altTarget.lerp(goalTarget, s)
          altFov += (goalFov - altFov) * s
        }
      }
      if (vk > 0) {
        const e = ease(vk)
        const d0 = camera.position.length()
        // Along an arc round the Moon, not a straight line through it: a straight line between two
        // almost opposite directions passes near the centre and the view flips there.
        curDir.copy(camera.position).divideScalar(d0)
        slerpQ.setFromUnitVectors(curDir, altDir)
        curDir.applyQuaternion(new THREE.Quaternion().slerp(slerpQ, e))
        camera.position.copy(curDir).multiplyScalar(Math.exp(THREE.MathUtils.lerp(Math.log(d0), Math.log(altDist), e)))
        lookTarget.lerp(altTarget, e)
        fov = THREE.MathUtils.lerp(30, altFov, e)
        dist = camera.position.distanceTo(lookTarget)
      }
      camera.fov = fov
      camera.up.set(0, 1, 0)
      camera.lookAt(lookTarget)
      // Street view dive: roll on the view axis, slowly, as the camera goes down to the ground.
      // The same when looking at the Earth, so the Moon's horizon lies at the bottom.
      roll += (standGoal * THREE.MathUtils.smoothstep(k, 0.85, 1) - roll) * (1 - Math.exp(-dt * (reduce ? 60 : 1.8)))
      // Looking at the Earth, the camera turns on its axis in step with the glide itself.
      if (altKind === 2) roll = Math.max(roll, ease(vk))
      if (roll < 0.001) roll = 0
      if (roll > 0) camera.rotateZ(Math.PI * roll)

      let fx = w / 2
      // Opening: the Moon rises higher than before, a third of the screen, the star of the splash.
      let fy = h * 1.0
      const frameEl = frameRef.current
      if (frameEl) {
        const r = frameEl.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          fx = THREE.MathUtils.lerp(w / 2, r.left + r.width / 2, k)
          fy = THREE.MathUtils.lerp(h * 1.0, r.top + r.height / 2, k)
        }
      } else {
        fy = THREE.MathUtils.lerp(h * 1.0, h * 0.42, k)
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
        ctl.dataset.moved = viewGoal || Math.abs(zoomGoal - 1) > 0.08 || Math.abs(tiltGoal - TILT) > 3 * DEG ? 'true' : 'false'
      }
      camera.setViewOffset(w, h, w / 2 - fx, h / 2 - fy, w, h)
      camera.updateProjectionMatrix()
      const gz = gizmoRef.current
      if (gz) {
        const on = k > 0.95 && viewGoal === 0 && standGoal === 0
        gz.style.opacity = on ? '1' : '0'
        gz.style.pointerEvents = on ? 'auto' : 'none'
        if (on) {
          camera.updateMatrixWorld()
          moon.updateMatrixWorld()
          const toScreen = (v: THREE.Vector3) => {
            tmp.copy(v).applyMatrix4(moon.matrixWorld).project(camera)
            return [tmp.x * w, -tmp.y * h]
          }
          const [px, py] = toScreen(gzPole)
          const angleOf = (v: THREE.Vector3) => {
            const [x, y] = toScreen(v)
            return Math.atan2(y - py, x - px)
          }
          const R = 34
          const place = (el: Element | null | undefined, a: number, r = R) => {
            if (el) (el as HTMLElement).style.transform = `translate(${(Math.cos(a) * r).toFixed(1)}px, ${(Math.sin(a) * r).toFixed(1)}px)`
          }
          const a0 = angleOf(gzLon[0])
          // The sign of the turn: the same meridian a little further on in the spin.
          const a1 = angleOf(gzTmp.copy(gzLon[0]).applyAxisAngle(Y_AXIS, 0.05))
          gizmoSign = Math.sin(a1 - a0) >= 0 ? 1 : -1
          const ring = gz.querySelector<SVGGElement>('.gz-ticks')
          if (ring) ring.setAttribute('transform', `rotate(${((a0 * 180) / Math.PI).toFixed(2)} 44 44)`)
          gz.querySelectorAll('.gz-lon').forEach((el, i) => place(el, angleOf(gzLon[i])))
          place(gz.querySelector('.gz-sun'), angleOf(gzTmp.copy(sunLocal).setY(0).normalize().add(gzPole)), 45)
          if (ea) place(gz.querySelector('.gz-earth'), angleOf(gzTmp.copy(earthDir).setY(0).normalize().add(gzPole)), 45)
          ;(gz.querySelector('.gz-earth') as HTMLElement | null)?.style.setProperty('display', ea ? 'block' : 'none')
        }
      }

      const frameBox = frameEl ? frameEl.getBoundingClientRect() : null
      // Markers and their labels. Each label takes a free spot around its dot (the picked site first).
      const pulse = 1 + 0.25 * Math.sin(now / 260)
      const placed: { x: number; y: number; w: number; h: number }[] = []
      const order = state.current.focusId ? [...markers].sort((a, b) => Number(b.id === state.current.focusId) - Number(a.id === state.current.focusId)) : markers
      // A new picked site: every label looks for its spot again from the best one.
      if (labelFocus !== state.current.focusId) {
        labelFocus = state.current.focusId
        for (const mk of markers) mk.spot = 0
      }
      let focusPx: { x: number; y: number } | null = null // the picked site on screen (it comes first)
      for (const m of order) {
        const on = m.id === state.current.focusId
        const ringMat = m.ring.material as THREE.MeshBasicMaterial
        const dotMat = m.dot.material as THREE.MeshBasicMaterial
        // Each site is a dot in the colour of its verdict; the picked one gets a pulsing ring.
        ringMat.color.set(on ? 0xf2b705 : 0xffffff)
        if (on) dotMat.color.set(0xf2b705)
        else dotMat.color.copy(m.color)
        m.ring.visible = on || state.current.showLabels
        world.copy(m.local).applyMatrix4(moon.matrixWorld)
        // About the same size on screen wherever the marker is: those near the camera do not balloon.
        const reach = THREE.MathUtils.clamp(camera.position.distanceTo(world) / dist, 0.3, 1.4)
        const size = Math.min(1, dist / 1.05) * 0.75 * reach * (Math.tan((fov * DEG) / 2) / Math.tan(15 * DEG))
        m.ring.scale.setScalar(size * (on ? 1.5 * pulse : 1))
        m.dot.scale.setScalar(size * (state.current.showLabels ? 1 : 1.35))
        ringMat.opacity = dotMat.opacity = k
        tmp.copy(world).normalize()
        camToPoint.copy(camera.position).sub(world).normalize()
        const facing = tmp.dot(camToPoint)
        tmp.copy(world).project(camera)
        const x = (tmp.x * 0.5 + 0.5) * w
        const y = (-tmp.y * 0.5 + 0.5) * h
        // Sites a few km apart land on the same pixels: the picked one is drawn on top and a dot hidden
        // under it is left out (its label still shows, with its leader to the shared point).
        m.ring.renderOrder = m.dot.renderOrder = on ? 4 : 2
        if (on) focusPx = { x, y }
        else if (focusPx && Math.hypot(x - focusPx.x, y - focusPx.y) < 10) m.ring.visible = m.dot.visible = false
        else m.dot.visible = true
        // Only where the Moon is in the clear: no label shows through the panels.
        const inFrame = !frameBox || (x > frameBox.left - 4 && x < frameBox.right - 8 && y > frameBox.top - 4 && y < frameBox.bottom - 8)
        const show = inFrame && k > 0.85 && facing > 0.08 && (on || (state.current.showLabels && (!small || !!state.current.focusId)))
        m.sx = x
        m.sy = y
        m.vis = k > 0.85 && facing > 0.08
        // Label placement: try spots around the dot (right, left, then above and below on each side,
        // then further down) and take the first that is free and inside the clear area. (lx, ly) is the
        // label's top-left corner.
        const lw = m.el.offsetWidth || 120
        const lh = m.el.offsetHeight || 26
        const G = 10 // gap between the dot and its label
        const right = Math.min(w - (small ? 64 : 16), frameBox ? frameBox.right - 8 : w)
        const left = frameBox ? frameBox.left + 8 : 8
        const top = frameBox ? frameBox.top + 4 : 4
        const bottom = frameBox ? frameBox.bottom - 8 : h
        const spots: [number, number][] = [
          [x + G, y - lh / 2],
          [x - G - lw, y - lh / 2],
          [x + G, y - lh - 8],
          [x + G, y + 8],
          [x - G - lw, y - lh - 8],
          [x - G - lw, y + 8],
        ]
        for (let k = 1; k <= 4; k++) spots.push([x + G, y + 8 + k * (lh + 6)], [x - G - lw, y + 8 + k * (lh + 6)], [x + G, y - lh - 8 - k * (lh + 6)])
        const free = (bx: number, by: number) =>
          bx >= left && bx + lw <= right && by >= top && by + lh <= bottom && !placed.some((p) => bx < p.x + p.w + 6 && p.x < bx + lw + 6 && by < p.y + p.h + 4 && p.y < by + lh + 4)
        // Keep the spot it had while it stays free, so labels do not hop around as the Moon turns.
        // Others keep the spot they had while it stays free (no hopping as the Moon turns); the picked
        // site always takes the best free spot, right by its dot.
        let pick = !on && free(...spots[m.spot] ?? spots[0]) ? m.spot : spots.findIndex(([bx, by]) => free(bx, by))
        if (pick >= 0) m.spot = pick
        else pick = 0
        let [lx, ly] = spots[pick]
        if (!free(lx, ly)) {
          // Nowhere free: next to the dot, kept inside the clear area.
          lx = Math.min(right - lw, Math.max(left, lx))
          ly = Math.min(bottom - lh, Math.max(top, ly))
        }
        if (show) placed.push({ x: lx, y: ly, w: lw, h: lh })
        // Leader line from the dot to the nearest point of the label, when the label sits away from it.
        const ax = Math.min(lx + lw, Math.max(lx, x))
        const ay = Math.min(ly + lh, Math.max(ly, y))
        const dx = ax - x
        const dy = ay - y
        const len = Math.hypot(dx, dy)
        const leadOn = show && len > G + 6
        if (leadOn) {
          const start = 6 // leave the dot itself clear
          m.lead.style.width = `${Math.max(0, len - start)}px`
          m.lead.style.transform = `translate(${(x + (dx / len) * start).toFixed(1)}px, ${(y + (dy / len) * start).toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(4)}rad)`
        }
        m.lead.style.opacity = leadOn ? (on ? '0.9' : '0.55') : '0'
        m.lead.dataset.on = on ? 'true' : 'false'
        // Move labels by whole pixels only, so a label under the finger stays put.
        m.box = { x: lx, y: ly, w: lw, h: lh }
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

      // Name and distance of the Earth, when it is in view and the Moon is not in front of it.
      let earthShown = false
      if (ea && earthMesh.visible && k > 0.85) {
        world.copy(earthWorld).multiplyScalar(EARTH_AT)
        tmp.copy(world).sub(camera.position)
        const len = tmp.length()
        tmp.divideScalar(len)
        const along = -camera.position.dot(tmp) // closest approach of the line of sight to the Moon's centre
        const hidden = along > 0 && along < len && camera.position.lengthSq() - along * along < 1.02
        const rPx = (((EARTH_AT * 6371) / ea.km / len) / Math.tan((fov * DEG) / 2)) * (h / 2)
        tmp.copy(world).project(camera)
        const x = (tmp.x * 0.5 + 0.5) * w
        const y = (-tmp.y * 0.5 + 0.5) * h
        if (!hidden && tmp.z < 1 && x > 0 && x < w && y > 0 && y < h && (!frameBox || (x > frameBox.left && x < frameBox.right && y > frameBox.top && y < frameBox.bottom))) {
          earthShown = true
          if (earthEl.textContent !== ea.label) earthEl.textContent = ea.label
          earthEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + rPx + 8)}px) translateX(-50%)`
        }
      }
      earthEl.style.opacity = earthShown ? '1' : '0'

      // The DSN antennas and their links, looking at the Earth.
      dsnShow += ((ea && earthMesh.visible && altKind === 2 ? vk : 0) - dsnShow) * (1 - Math.exp(-dt * 4))
      const dsnOn = dsnShow > 0.02 && !!ea
      dsnDots.visible = dsnOn
      if (dsnOn) {
        earthMesh.updateMatrix()
        const fm2 = markers.find((x) => x.id === state.current.focusId)
        dsnB.copy(fm2 ? fm2.local : surface(-89.5, 0)).multiplyScalar(1.004)
        DSN_STATIONS.forEach((_, k) => {
          const up = (ea.dsn?.[k] ?? -90) >= DSN_MIN_ELEV_DEG
          const line = dsnLinks[k]
          line.visible = up
          dsnA.copy(dsnLocal[k]).applyMatrix4(earthMesh.matrix)
          if (up) {
            const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute
            for (let i = 0; i < pos.count; i++) {
              const f = i / (pos.count - 1)
              pos.setXYZ(i, dsnA.x + (dsnB.x - dsnA.x) * f, dsnA.y + (dsnB.y - dsnA.y) * f, dsnA.z + (dsnB.z - dsnA.z) * f)
            }
            pos.needsUpdate = true
            const mat = line.material as THREE.ShaderMaterial
            mat.uniforms.time.value = now / 1000 + k * 0.37
            mat.uniforms.alpha.value = dsnShow
            const f = (now / 1000 / 2.4 + k * 0.33) % 1
            dsnPackets[k].position.lerpVectors(dsnA, dsnB, f)
            ;(dsnPackets[k].material as THREE.SpriteMaterial).opacity = dsnShow * Math.sin(Math.PI * f)
          }
          dsnPackets[k].visible = up
          // Its name, when the antenna is on the side of the Earth facing the camera.
          world.copy(dsnA).applyMatrix4(moon.matrixWorld)
          dsnN.copy(dsnLocal[k]).applyQuaternion(earthMesh.quaternion).applyQuaternion(moon.quaternion)
          tmp.copy(camera.position).sub(world)
          const facing = dsnN.dot(tmp) > 0
          tmp.copy(world).project(camera)
          const el = dsnLabels[k]
          if (facing && tmp.z < 1) {
            const x = (tmp.x * 0.5 + 0.5) * w
            const y = (-tmp.y * 0.5 + 0.5) * h
            el.style.transform = `translate(${Math.round(x + 8)}px, ${Math.round(y - 7)}px)`
            el.style.opacity = String(dsnShow * (up ? 1 : 0.55))
          } else el.style.opacity = '0'
        })
      } else {
        dsnLinks.forEach((l) => (l.visible = false))
        dsnPackets.forEach((p) => (p.visible = false))
        dsnLabels.forEach((el) => (el.style.opacity = '0'))
      }

      // The landing sign on a newly picked site (see pickBeam). Not on the first site of a shared link
      // or of the expert mode, which arrive picked, and not with reduced motion.
      if (state.current.mode === 'app') {
        const fid = state.current.focusId
        if (pickSeen === null) pickSeen = fid // what arrives already picked is not animated
        else if (fid !== pickSeen) {
          if (fid && !reduce) pickAnim = { id: fid, t0: now }
          pickSeen = fid
        }
      }
      const pm = pickAnim ? markers.find((x) => x.id === pickAnim!.id) : undefined
      // #sfxdebug: window.__pickT freezes the animation at that second, for checks.
      const dbgW = window as unknown as { __pickT?: number; __dbg?: boolean; __pickDbg?: unknown }
      const pickDbg = SFX_DEBUG || !!dbgW.__dbg // the hash may have changed before this chunk loaded
      const pickFix = pickDbg ? dbgW.__pickT : undefined
      const pt = pickAnim ? (pickFix ?? (now - pickAnim.t0) / 1000) : 99
      if (pickDbg) dbgW.__pickDbg = { mode: state.current.mode, focus: state.current.focusId, seen: pickSeen, anim: !!pickAnim, pm: !!pm, pt }
      if (pm && pt < 3.6) {
        const S = pm.dot.scale.x || 1
        // The beam stands straight up on the screen (a sign, not a trajectory): seen from above the
        // pole the local vertical points at the camera, and the lander would seem to rise.
        pickN.set(0, 1, 0).applyQuaternion(camera.quaternion).applyQuaternion(moon.getWorldQuaternion(pickInv).invert())
        pickQ.setFromUnitVectors(Y_AXIS, pickN)
        const D = camera.position.distanceTo(world.copy(pm.local).applyMatrix4(moon.matrixWorld))
        // The beam: a quarter of the screen high at any zoom (in the Moon's own units, it may be scaled).
        const H = (0.5 * D * Math.tan((fov * DEG) / 2)) / (moon.matrixWorld.getMaxScaleOnAxis() || 1)
        if (pickDbg) dbgW.__pickDbg = { ...(dbgW.__pickDbg as object), D, H, fov, ms: moon.matrixWorld.getMaxScaleOnAxis() }
        const down = Math.min(1, pt / 1.6)
        const fall = 1 - Math.pow(1 - down, 3) // eases into the touchdown
        // Beam: fades in, then out after the touchdown.
        ;(pickBeam.material as THREE.ShaderMaterial).uniforms.alpha.value = Math.min(1, pt / 0.15) * (1 - THREE.MathUtils.smoothstep(pt, 1.6, 2.3))
        pickBeam.visible = true
        pickBeam.quaternion.copy(pickQ)
        pickBeam.scale.set(H * 0.008, H, H * 0.008)
        pickBeam.position.copy(pm.local).addScaledVector(pickN, H / 2)
        // Lander: from the top of the beam down to the ground, then gone.
        pickLander.visible = pt < 2.2
        pickLander.position.copy(pm.local).addScaledVector(pickN, H * (1 - fall))
        pickLander.scale.setScalar(H * 0.16)
        ;(pickLander.material as THREE.SpriteMaterial).opacity = (1 - THREE.MathUtils.smoothstep(pt, 1.75, 2.2))
        // Two waves on the ground from the touchdown, in the verdict colour of the site.
        pickRings.forEach((r, i) => {
          const f = (pt - 1.55 - i * 0.35) / 1.4
          r.visible = f > 0 && f < 1
          if (!r.visible) return
          pickUp.copy(pm.local).normalize() // the waves lie on the ground
          r.position.copy(pm.local).addScaledVector(pickUp, 0.0004)
          r.quaternion.setFromUnitVectors(Z_AXIS, pickUp)
          r.scale.setScalar(S * (1 + 6 * (1 - Math.pow(1 - f, 2))))
          const mat = r.material as THREE.MeshBasicMaterial
          mat.color.copy(pm.color)
          mat.opacity = (1 - f) * 0.9
        })
      } else {
        pickAnim = null
        pickBeam.visible = pickLander.visible = false
        pickRings.forEach((r) => (r.visible = false))
      }

      // Callout: next to where the mouse found the site (its dot, or its label when the label sits away
      // from the dot), opening to the side with more room.
      const co = calloutRef.current
      if (co) {
        const hm = hoverId ? markers.find((x) => x.id === hoverId) : undefined
        if (hm && hm.vis) {
          const fromLabel = hoverVia === 'label' && !small && hm.box.w > 0
          const card = co.querySelector('.moon-callout-card') as HTMLElement | null
          const cardW = card?.offsetWidth || 248
          const cardH = card?.offsetHeight || 280
          const top = frameBox ? frameBox.top : 0
          const bottom = frameBox ? frameBox.bottom : h
          let ax: number
          let ay: number
          if (fromLabel) {
            // Beside the label it came from: to its right (or left), centred on it, kept inside the clear area.
            const b = hm.box
            const side = b.x + b.w + 8 + cardW > w - 8 ? 'left' : 'right'
            ax = side === 'right' ? b.x + b.w + 8 : b.x - 8 - cardW
            ay = Math.min(bottom - cardH - 8, Math.max(top + 8, b.y + b.h / 2 - cardH / 2))
            co.dataset.side = side
            co.dataset.anchor = 'label'
            co.style.setProperty('--card-h', `${cardH}px`)
            co.style.setProperty('--card-w', `${cardW}px`)
          } else {
            ax = hm.sx
            ay = hm.sy
            co.dataset.anchor = 'dot'
            if (small) {
              co.dataset.side = 'center'
              co.style.setProperty('--card-left', `${Math.round(Math.min(w - 256, Math.max(8, hm.sx - 124)) - hm.sx)}px`)
            } else co.dataset.side = hm.sx > w - 360 ? 'left' : 'right'
            // Up or down, wherever the card fits (never under the header or off the bottom).
            const roomUp = ay - top
            const roomDown = bottom - ay
            co.dataset.drop = roomUp >= cardH + 30 ? 'up' : roomDown >= cardH + 30 ? 'down' : roomUp > roomDown ? 'up' : 'down'
          }
          const key = `${Math.round(ax)},${Math.round(ay)}`
          if (co.dataset.pos !== key) {
            co.dataset.pos = key
            co.style.transform = `translate(${Math.round(ax)}px, ${Math.round(ay)}px)`
          }
          co.style.visibility = 'visible'
        } else co.style.visibility = 'hidden'
      }

      // The orbiter: its plane holds the Moon's axis and is turned 40° from the line of sight, so the
      // orbit reads as an ellipse over the pole.
      const show = 1 - k
      orbit.visible = show > 0.01
      if (orbit.visible) {
        if (!reduce) orbitA -= (dt * Math.PI * 2) / ORBIT_S
        orbitN.set(camera.position.x, 0, camera.position.z).normalize().applyAxisAngle(Y_AXIS, (40 * Math.PI) / 180)
        orbitU.crossVectors(Y_AXIS, orbitN).normalize()
        orbitM.makeBasis(orbitU, Y_AXIS, orbitN)
        orbit.quaternion.setFromRotationMatrix(orbitM)
        sat.position.set(Math.cos(orbitA) * ORBIT_R, Math.sin(orbitA) * ORBIT_R, 0)
        sat.rotation.z = orbitA
        orbitMat.opacity = 0.13 * show
        satBody.opacity = satPanel.opacity = show
        satDotMat.opacity = 0.7 * show
      }

      const rise = shownAt ? Math.min(1, (now - shownAt) / (reduce ? 1 : 1400)) : 0
      renderer.toneMappingExposure = 1.15 * ease(rise)
      cesium?.update()
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      disposed = true
      window.clearTimeout(slowTimer)
      canvas.removeEventListener('webglcontextlost', lost)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', leave)
      calloutRef.current?.removeEventListener('pointerenter', calloutEnter)
      calloutRef.current?.removeEventListener('pointerleave', calloutLeave)
      window.clearTimeout(dropTimer)
      canvas.removeEventListener('wheel', wheel)
      for (const m of markers) {
        m.el.remove()
        m.lead.remove()
      }
      earthEl.remove()
      api.current = null
      heatTex?.dispose()
      cesium?.dispose()
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
  useEffect(() => {
    api.current?.setHeat(heat)
  }, [heat])

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-0 h-full w-full touch-none" aria-hidden="true" />
      <div ref={labelsRef} className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" />
      {controls && (
        <div ref={controlsRef} data-franky="moon-tools" className={`moon-controls${compactControls ? ' compact' : ''}`} style={{ opacity: 0 }}>
          {controls.gizmo && (
            <div
              ref={gizmoRef}
              className="moon-gizmo"
              role="group"
              aria-label={controls.gizmo}
              title={controls.gizmo}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return
                const box = e.currentTarget.getBoundingClientRect()
                const cx = box.left + box.width / 2
                const cy = box.top + box.height / 2
                let last = Math.atan2(e.clientY - cy, e.clientX - cx)
                e.currentTarget.setPointerCapture(e.pointerId)
                const move = (ev: PointerEvent) => {
                  const a = Math.atan2(ev.clientY - cy, ev.clientX - cx)
                  let d = a - last
                  d = Math.atan2(Math.sin(d), Math.cos(d))
                  last = a
                  api.current?.rotateBy(d)
                }
                const el = e.currentTarget
                const up = () => {
                  el.removeEventListener('pointermove', move)
                  el.removeEventListener('pointerup', up)
                  el.removeEventListener('pointercancel', up)
                }
                el.addEventListener('pointermove', move)
                el.addEventListener('pointerup', up)
                el.addEventListener('pointercancel', up)
              }}
            >
              <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
                <circle cx="44" cy="44" r="41" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.25)" />
                <circle cx="44" cy="44" r="25" fill="none" stroke="rgba(255,255,255,0.12)" />
                <g className="gz-ticks">
                  {Array.from({ length: 24 }, (_, i) => (
                    <line key={i} x1="44" y1={i % 6 === 0 ? 5 : 6} x2="44" y2={i % 6 === 0 ? 11 : 9} stroke={i === 0 ? '#f2b705' : 'rgba(255,255,255,0.45)'} strokeWidth={i % 6 === 0 ? 1.6 : 1} transform={`rotate(${i * 15 + 90} 44 44)`} />
                  ))}
                </g>
              </svg>
              <span className="gz-sun" aria-hidden="true" />
              <span className="gz-earth" aria-hidden="true" />
              {(['0°', '90°E', '180°', '90°W'] as const).map((l, i) => (
                <button key={l} type="button" className={`gz-lon${i === 0 ? ' is-zero' : ''}`} onClick={() => api.current?.faceLon([0, 90, 180, -90][i])} aria-label={controls.faceLon ? controls.faceLon(l) : l} title={controls.faceLon ? controls.faceLon(l) : l}>
                  {l}
                </button>
              ))}
              <button type="button" className="gz-pole" onClick={() => api.current?.recenter()} aria-label={controls.recenter} title={controls.recenter}>
                S
              </button>
            </div>
          )}
          <div className="moon-zoom">
          <button type="button" onClick={() => api.current?.zoomBy(1 / 1.6)} aria-label={controls.zoomIn} title={controls.zoomIn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" onClick={() => api.current?.zoomBy(1.6)} aria-label={controls.zoomOut} title={controls.zoomOut}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          </div>
          <div className="moon-group">
          {controls.layer && controls.onLayer && (
            <button type="button" className="moon-layer" data-on={controls.layerOn ? 'true' : 'false'} aria-pressed={!!controls.layerOn} aria-busy={!!controls.layerBusy} onClick={() => { sfx.toggle(!controls.layerOn); controls.onLayer?.() }} title={controls.layer}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l9 5-9 5-9-5 9-5z" />
                <path d="M3 13l9 5 9-5" />
              </svg>
              <span>{controls.layer}</span>
            </button>
          )}
          {hdAvailable && controls.hd && (
            <button type="button" className="moon-layer" data-on={hdState ? 'true' : 'false'} aria-pressed={!!hdState} aria-busy={hdState === 1} onClick={() => { sfx.toggle(!hdState); api.current?.setHd(!hdState) }} title={controls.hd}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7v10M3 12h5M8 7v10M13 7h3a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4h-3z" />
              </svg>
              <span>{controls.hd}</span>
            </button>
          )}
          </div>
          <div className="moon-group">
          {earth && controls.fromEarth && (
            <button type="button" className="moon-layer" data-on={view === 1 ? 'true' : 'false'} aria-pressed={view === 1} onClick={() => api.current?.setView(view === 1 ? 0 : 1)} title={controls.fromEarth}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 4a8 8 0 0 0 0 16c-3-2.2-3-13.8 0-16z" fill="currentColor" stroke="none" />
              </svg>
              <span>{controls.fromEarth}</span>
            </button>
          )}
          {earth && controls.earth && (
            <button type="button" className="moon-layer" data-on={view === 2 ? 'true' : 'false'} aria-pressed={view === 2} onClick={() => api.current?.setView(view === 2 ? 0 : 2)} title={controls.earth}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <path d="M4 12h16M12 4c2.6 2.4 2.6 13.6 0 16M12 4c-2.6 2.4-2.6 13.6 0 16" />
              </svg>
              <span>{controls.earth}</span>
            </button>
          )}
          <button type="button" className="moon-recenter" onClick={() => api.current?.recenter()} title={controls.recenter}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            <span>{controls.recenter}</span>
          </button>
          </div>
        </div>
      )}
      {/* Seen from the Earth near new Moon the near side is in night: say so, it is not a fault. */}
      {view === 1 && controls?.newMoon && sunAt && earth && (() => {
        const u = (lat: number, lon: number) => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)]
        const a = u(sunAt.lat, sunAt.lon)
        const b = u(earth.lat, earth.lon)
        const lit = (100 * (1 + a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / 2
        return lit < 15 ? <p className="ui-in glass pointer-events-none fixed left-1/2 top-24 z-[6] -translate-x-1/2 px-3 py-2 text-center text-sm">{controls.newMoon(Math.round(lit))}</p> : null
      })()}
      {credit && (
        <a href="https://cesium.com/platform/cesium-ion/" target="_blank" rel="noreferrer" className="fixed bottom-1 left-2 z-[6] bg-black/60 px-2 py-0.5 text-[11px] text-white/85">
          <img src="https://assets.ion.cesium.com/ion-credit.png" alt="Cesium ion" className="mr-1.5 inline h-4 align-middle" />
          NASA and the USGS Astrogeology Science Center
        </a>
      )}
      {info && (
        <div ref={calloutRef} className="moon-callout" style={{ visibility: 'hidden' }} aria-hidden={!hover}>
          {hover && (
            <div key={hover} className="moon-callout-in">
              {/* Invisible bridge from the dot to the card: on the way there the callout counts as hovered. */}
              <div className="moon-callout-bridge" aria-hidden="true" />
              <svg className="moon-callout-lead" width="46" height="42" viewBox="-12 -30 46 42" aria-hidden="true">
                <circle cx="0" cy="0" r="9" fill="none" stroke="#f2b705" strokeWidth="1.5" />
                <path d="M6.5 -6.5 L22 -22 L32 -22" fill="none" stroke="#f2b705" strokeWidth="1.5" pathLength="1" />
              </svg>
              <div className="moon-callout-card" role="group">
                {info(hover)}
                {onStreet && (
                  <button
                    type="button"
                    className="moon-callout-street"
                    onClick={() => {
                      api.current?.closeCallout()
                      onStreet(hover)
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="5" r="2.2" />
                      <path d="M12 8v6M9 21l3-7 3 7M8.5 11.5h7" />
                      <path d="M3 18.5c2.2-1 5.4-1.6 9-1.6s6.8.6 9 1.6" />
                    </svg>
                    {streetLabel}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
