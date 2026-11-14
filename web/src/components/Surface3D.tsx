import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { horizonAt, ridgeKmAt, type Sample, type Site } from '../data/model'
import { useT } from '../i18n'
import * as sfx from '../sound'
import { groundHeight, incidenceDeg, loadGround, type Ground } from '../data/ground'

// First-person view from the landing site: look around, see the terrain, the Sun and Earth.
// - Terrain: the real horizon of the site (ray-traced on LOLA), wearing the real colour and relief
//   of the south pole (LRO LROC + LOLA, NASA SVS CGI Moon Kit) plus a fine relief layer for the near ground.
// - Sun and Earth: real directions from JPL Horizons for the chosen hour. Earth shows its real phase.
// - Shadows: the terrain casts them for that Sun (shadow map).
// Angles at true scale (STRETCH 1): terrain, Sun and Earth as high as they really stand. The Earth
// is drawn larger than it is, to be visible. A rendering, not a photo.
const STRETCH = 1 // true angles (it was 4 before, to make low relief and a low Sun easier to see)
const RIDGE = 1000 // distance (scene units) at which the terrain reaches its horizon angle
const UNIT_M = 30 // metres per scene unit for the ground texture: the ridge sits ~30 km away
const SKY = 3000
const DEG = Math.PI / 180
const CAP = 25 // degrees of colatitude covered by the polar textures
const M_PER_DEG = (2 * Math.PI * 1737400) / 360
// Landing: a NASA lunar module comes down in front of the camera, following the real height and
// descent rate and forward speed of Apollo 11 over its last 750 feet (20 July 1969), as Buzz Aldrin
// read them out. Source: NASA Apollo Lunar Surface Journal, apollojournals.org/alsj/a11/a11.landing.html,
// from 102:43:01 to "Contact light" at 102:45:40. Played faster (A11_SPEEDUP). The lander comes in
// from about 1.2 km away (the forward speed, added up) and the camera follows it down.
const LAND_DIST = 38 // metres from the camera to the touchdown point
const G_MOON = 1.62 // m/s2
const FT = 0.3048
// [seconds after 102:43:01, height (ft), descent rate (ft/s) or null when not called out]
const A11: [number, number, number | null][] = [
  [0, 750, 23], [6, 700, 21], [10, 600, 19], [15, 540, 15], [25, 400, 9], [32, 350, 4], [34, 330, 3.5],
  [45, 300, 3.5], [51, 270, 1.5], [66, 250, 2.5], [75, 220, 3.5], [83, 200, 4.5], [90, 160, 6.5],
  [99, 120, null], [104, 100, 3.5], [113, 75, 0.5], [127, 60, 2.5], [136, 40, 2.5], [140, 30, 2.5],
  [144, 20, 0.5], [159, 0, 0],
]
const A11_SPEEDUP = 8
const A11_END = A11[A11.length - 1][0]
// [seconds after 102:43:01, forward speed (ft/s)] as called out. Ours, not called out: the 58 ft/s
// of the first callout held before it, 1 ft/s for "drifting forward just a little bit" (102:45:32)
// and 0 at contact.
const A11_FWD: [number, number][] = [
  [0, 58], [25, 58], [45, 47], [66, 19], [75, 13], [82, 11], [92, 9], [104, 9], [113, 6], [144, 4], [151, 1], [159, 0],
]
// Distance still to fly (ft) at each callout: the speed added up to contact, straight lines between callouts.
const A11_LEFT = A11_FWD.map((_, i) => {
  let d = 0
  for (let k = i; k < A11_FWD.length - 1; k++) d += ((A11_FWD[k][1] + A11_FWD[k + 1][1]) / 2) * (A11_FWD[k + 1][0] - A11_FWD[k][0])
  return d
})
/** Forward speed (m/s), distance left to the touchdown point (m) and braking (m/s2) at clock second s. */
function a11Forward(s: number) {
  let i = 1
  while (i < A11_FWD.length - 1 && A11_FWD[i][0] < s) i++
  const [t0, v0] = A11_FWD[i - 1]
  const [t1, v1] = A11_FWD[i]
  const u = Math.min(t1, Math.max(t0, s))
  const v = v0 + ((v1 - v0) * (u - t0)) / (t1 - t0)
  return { v: v * FT, left: (A11_LEFT[i] + ((v + v1) / 2) * (t1 - u)) * FT, brake: ((v0 - v1) / (t1 - t0)) * FT }
}
function a11At(s: number) {
  let i = 1
  while (i < A11.length - 1 && A11[i][0] < s) i++
  const [t0, h0] = A11[i - 1]
  const [t1, h1] = A11[i]
  const f = Math.min(1, Math.max(0, (s - t0) / (t1 - t0)))
  // The rate: between the two nearest callouts that give one.
  let a = i - 1
  while (a > 0 && A11[a][2] === null) a--
  let b = i
  while (b < A11.length - 1 && A11[b][2] === null) b++
  const ra = A11[a][2] ?? 0
  const rb = A11[b][2] ?? 0
  const fr = Math.min(1, Math.max(0, (s - A11[a][0]) / Math.max(1e-6, A11[b][0] - A11[a][0])))
  return { alt: (h0 + (h1 - h0) * f) * FT, rate: (ra + (rb - ra) * fr) * FT }
}

// The lander: Apollo Lunar Module from NASA 3D Resources (github.com/nasa/NASA-3D-Resources),
// free and without copyright. Loaded once, only when a landing is simulated.
let landerModel: Promise<THREE.Object3D> | null = null
function loadLander() {
  landerModel ??= Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/loaders/DRACOLoader.js')]).then(
    ([{ GLTFLoader }, { DRACOLoader }]) =>
      new Promise<THREE.Object3D>((resolve, reject) => {
        const draco = new DRACOLoader()
        const loader = new GLTFLoader()
        loader.setDRACOLoader(draco)
        loader.load('models/apollo_lunar_module.glb', (g) => resolve(g.scene), undefined, (e) => {
          landerModel = null
          reject(e)
        })
      }),
  )
  return landerModel
}

function direction(azDeg: number, elDeg: number) {
  const az = azDeg * DEG
  const el = Math.min(89, elDeg * STRETCH) * DEG
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
}

// Near the site, out to NEAR_M, the ground is the real one: LOLA heights every 5 m (PGDA 78).
// Beyond, it is shaped from the site's horizon, as before. The two are blended over BLEND_M.
const NEAR_M = 330
const BLEND_M = 110
function buildTerrain(site: Site, real: Ground | null = null) {
  const rings = 64
  const spokes = 360
  const pos: number[] = []
  const uv: number[] = []
  const uv1: number[] = []
  const idx: number[] = []
  // Where the site sits on the polar texture (azimuthal equidistant around the south pole).
  const colat = 90 + site.lat
  const lon = site.lon * DEG
  const N = [Math.sin(lon), Math.cos(lon)] // local north on the texture plane
  const E = [Math.cos(lon), -Math.sin(lon)] // local east
  for (let i = 0; i <= rings; i++) {
    const r = 1.5 * Math.pow(RIDGE / 1.5, i / rings) * (i === rings ? 1.8 : 1)
    const t = Math.min(1, r / RIDGE)
    const rise = t * t * (3 - 2 * t)
    for (let j = 0; j <= spokes; j++) {
      const az = (j / spokes) * 360
      // The real horizon, negative too: from a peak (Malapert) the ground falls away and the Sun
      // can shine from below the flat horizontal.
      // Near the feet, a smoothed horizon (no streaks between neighbouring azimuths); exact at the ridge.
      let smooth = 0
      for (let k = -8; k <= 8; k++) smooth += horizonAt(site, az + k * 1.5)
      smooth /= 17
      const blend = Math.min(1, r / (RIDGE * 0.6))
      const angle = (smooth + (horizonAt(site, az) - smooth) * blend) * STRETCH * DEG
      // Below the horizontal (a peak), the ground slopes away from the feet; above it, it stays
      // flat near the site and rises to the ridge.
      // Gradually, not with a switch, so there is no groove where the horizon crosses 0 degrees.
      const down = Math.min(1, Math.max(0, -angle / (0.4 * STRETCH * DEG)))
      const h = i === rings ? RIDGE * Math.tan(angle) - 80 : r * Math.tan(angle) * (rise + (1 - rise) * down) - 0.6 * down
      const x = Math.sin(az * DEG) * r
      const z = -Math.cos(az * DEG) * r
      let y = h
      const hr = real && i < rings ? groundHeight(real, x, -z) : null
      if (hr !== null) {
        const w = 1 - THREE.MathUtils.smoothstep(r, NEAR_M, NEAR_M + BLEND_M)
        y = hr * w + h * (1 - w)
      }
      pos.push(x, y, z)
      const dn = (-z * UNIT_M) / M_PER_DEG
      const de = (x * UNIT_M) / M_PER_DEG
      const px = colat * N[0] + dn * N[0] + de * E[0]
      const py = colat * N[1] + dn * N[1] + de * E[1]
      uv.push(0.5 + px / (2 * CAP), 0.5 + py / (2 * CAP))
      uv1.push(x / 60, z / 60)
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < spokes; j++) {
      const a = i * (spokes + 1) + j
      const b = a + spokes + 1
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // The ring closes at north: share the normals of its first and last spoke so no seam shows.
  const n = g.getAttribute('normal') as THREE.BufferAttribute
  for (let i = 0; i <= rings; i++) {
    const a = i * (spokes + 1)
    const b = a + spokes
    const x = (n.getX(a) + n.getX(b)) / 2
    const y = (n.getY(a) + n.getY(b)) / 2
    const z = (n.getZ(a) + n.getZ(b)) / 2
    n.setXYZ(a, x, y, z)
    n.setXYZ(b, x, y, z)
  }
  n.needsUpdate = true
  return g
}

// A soft glow for the Sun: white core, warm halo, drawn once on a canvas.
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.08, 'rgba(255,252,240,1)')
  grad.addColorStop(0.16, 'rgba(255,236,190,0.55)')
  grad.addColorStop(0.4, 'rgba(255,200,120,0.12)')
  grad.addColorStop(1, 'rgba(255,180,90,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// The engine plume: in a vacuum it is faint and spreads wide. Bright at the nozzle, gone by the end.
function plumeTexture() {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 128) // top of the canvas = the nozzle
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.12, 'rgba(255,236,205,0.6)')
  grad.addColorStop(0.45, 'rgba(255,214,170,0.16)')
  grad.addColorStop(1, 'rgba(255,200,150,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 8, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// The lander's long shadow: dark along the middle, soft at the edges, fading out at the far end.
function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 128
  const g = c.getContext('2d')!
  const img = g.createImageData(32, 128)
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 32; x++) {
      const across = 1 - Math.abs((x + 0.5) / 16 - 1)
      const along = 1 - y / 127
      const a = Math.min(1, across * 2.2) * Math.min(1, along * 1.6) * Math.min(1, (y + 1) / 5)
      img.data[(y * 32 + x) * 4 + 3] = 255 * a * a * (3 - 2 * a)
    }
  }
  g.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(c)
}

// A soft round grain for the dust.
function dustTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// Earth seen from the Moon: oceans, land, ice and clouds, generated (no photo is shipped).
function earthTexture() {
  const W = 512
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const img = g.createImageData(W, H)
  const hash = (x: number, y: number, s: number) => {
    const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
    return h - Math.floor(h)
  }
  const noise = (x: number, y: number, s: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const w = (a: number) => ((a % 16) + 16) % 16 // wraps around the globe
    const a = hash(w(xi), yi, s)
    const b = hash(w(xi + 1), yi, s)
    const cc = hash(w(xi), yi + 1, s)
    const d = hash(w(xi + 1), yi + 1, s)
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v
  }
  const fbm = (x: number, y: number, s: number) => {
    let f = 0
    let amp = 0.5
    let fx = x
    let fy = y
    for (let o = 0; o < 5; o++) {
      f += amp * noise(fx, fy, s)
      fx *= 2
      fy *= 2
      amp *= 0.5
    }
    return f
  }
  for (let y = 0; y < H; y++) {
    const lat = 1 - (2 * y) / H // 1 north, -1 south
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 16
      const ny = (y / H) * 8
      const land = fbm(nx * 0.5, ny * 0.5, 1)
      const cloud = fbm(nx, ny * 1.6, 7)
      let r: number
      let gg: number
      let b: number
      if (Math.abs(lat) > 0.86) [r, gg, b] = [235, 240, 245]
      else if (land > 0.52) {
        const dry = fbm(nx * 2, ny * 2, 3)
        ;[r, gg, b] = dry > 0.5 ? [150, 130, 90] : [70, 110, 60]
      } else [r, gg, b] = [18, 52, 120 + 40 * land]
      const cl = Math.max(0, Math.min(1, (cloud - 0.5) * 3.2))
      r = r + (250 - r) * cl
      gg = gg + (252 - gg) * cl
      b = b + (255 - b) * cl
      const k = (y * W + x) * 4
      img.data[k] = r
      img.data[k + 1] = gg
      img.data[k + 2] = b
      img.data[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// The fold mark of a panel: points down when closed, up when open.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={`ml-auto shrink-0 text-white/70 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export default function Surface3D({ site, sample, height = 420, landing = 0 }: { site: Site; sample: Sample; height?: number; /** Changes to a new number to play a landing. */ landing?: number }) {
  const t = useT()
  const [real, setReal] = useState<Ground | null>(null)
  const [hudOpen, setHudOpen] = useState(true)
  // Sun, Earth and ground cards: each opens on its own; open on wide screens, folded on phones.
  const wide = typeof window === 'undefined' || window.innerWidth >= 768
  const [open, setOpen] = useState({ sun: wide, earth: wide, ground: wide })
  const [cardsShown, setCardsShown] = useState(wide) // the whole stack, hidden behind one pill
  const toggle = (k: keyof typeof open) => (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = e.currentTarget.open
    setOpen((o) => (o[k] === isOpen ? o : { ...o, [k]: isOpen }))
  }
  const mount = useRef<HTMLDivElement>(null)
  const api = useRef<{ setSite: (s: Site, g: Ground | null) => void; setSample: (s: Sample) => void; lookAt: (az: number) => void; land: (sunAz: number) => void } | null>(null)
  const [hud, setHud] = useState<{ alt: number; speed: number; fwd: number; clock: number; phase: 'load' | 'descent' | 'down' | 'failed' } | null>(null)
  const [heading, setHeading] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = mount.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setClearColor(0x000000)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    el.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.style.cursor = 'grab'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.5, SKY * 2)
    camera.position.set(0, 1.7, 0)
    camera.rotation.order = 'YXZ'

    // No atmosphere: black sky, hard light, long shadows. A faint bluish fill stands for earthshine
    // and keeps the ground readable when the Sun is hidden.
    scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x1a1a1a, 0.35))
    const sunLight = new THREE.DirectionalLight(0xfff4dc, 4.5)
    scene.add(sunLight, sunLight.target)
    // Cast shadows: the relief between the site and its ridge shades the ground for the real Sun of
    // the chosen hour. At the site itself light and shadow match the LOLA horizon; elsewhere in the
    // bowl the ground is shaped from that horizon, so the shadows there are indicative.
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    sunLight.castShadow = true
    const reach = RIDGE * 1.8
    Object.assign(sunLight.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 10, far: 6000 })
    sunLight.shadow.camera.updateProjectionMatrix()
    sunLight.shadow.mapSize.set(window.innerWidth < 768 ? 2048 : 4096, window.innerWidth < 768 ? 2048 : 4096)
    sunLight.shadow.bias = -0.0004
    sunLight.shadow.normalBias = 2
    sunLight.shadow.radius = 2.5 // a grazing Sun: soften the edges, or they break into streaks

    const loader = new THREE.TextureLoader()
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
    let pending = 2
    const loaded = () => {
      if (--pending === 0) invalidate()
    }
    loader.load('moon/polar_color.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      groundMat.map = tex
      groundMat.needsUpdate = true
      loaded()
    })
    // Large relief from the polar map, fine relief from the global one tiled (channel 1).
    loader.load('moon/moon_normal_2k.jpg', (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.channel = 1
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      groundMat.normalMap = tex
      groundMat.normalScale = new THREE.Vector2(0.9, 0.9)
      groundMat.needsUpdate = true
      loaded()
    })
    const ground = new THREE.Mesh(new THREE.BufferGeometry(), groundMat)
    ground.castShadow = true
    ground.receiveShadow = true
    scene.add(ground)

    // The Sun: a bright disc inside a glow. The terrain hides it when it is below the ridge.
    const glow = glowTexture()
    const sunSize = SKY * Math.tan(0.27 * STRETCH * DEG) * 2
    const sun = new THREE.Group()
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    halo.scale.setScalar(sunSize * 9)
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, depthWrite: false, transparent: true }))
    core.scale.setScalar(sunSize * 1.6)
    sun.add(halo, core)
    scene.add(sun)

    // Earth: lit by the Sun from its real direction, so it shows its real phase, with a thin blue rim.
    const earthR = SKY * Math.tan(0.95 * 2 * DEG)
    const earthMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: earthTexture() }, sunDir: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: `
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          vUv = uv;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform vec3 sunDir;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          vec3 base = texture2D(map, vUv).rgb;
          float day = smoothstep(-0.08, 0.25, dot(vN, sunDir));
          float rim = pow(1.0 - max(dot(vN, vView), 0.0), 3.0);
          vec3 col = base * (0.03 + 1.25 * day) + vec3(0.35, 0.6, 1.0) * rim * (0.15 + 0.85 * day);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    })
    const earth = new THREE.Mesh(new THREE.SphereGeometry(earthR, 48, 32), earthMat)
    earth.rotation.z = 23 * DEG
    scene.add(earth)

    // Stars of different brightness.
    const starPos: number[] = []
    const starCol: number[] = []
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 1800; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.0 - 0.02, rnd() * 2 - 1).normalize().multiplyScalar(SKY * 1.5)
      starPos.push(v.x, v.y, v.z)
      const b = Math.pow(rnd(), 3) * 0.9 + 0.1
      const warm = rnd()
      starCol.push(b * (0.85 + 0.15 * warm), b * 0.92, b * (1 - 0.15 * warm))
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true })))

    // Look around: smooth drag with a little inertia, wheel or pinch to zoom (field of view).
    let yaw = 0
    let pitch = 4
    let yawGoal = 0
    let pitchGoal = 4
    let fov = 60
    let fovGoal = 60
    let vYaw = 0
    let vPitch = 0
    let raf = 0
    let last = performance.now()
    // Landing: the lander group, its engine plume and the dust it raises.
    const lander = new THREE.Group()
    lander.visible = false
    scene.add(lander)
    // The engine: a faint plume (it spreads in the vacuum), a bright point at the nozzle, and its light
    // on the underside of the lander and on the ground below.
    const plumeMap = plumeTexture()
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 6, 24, 1, true),
      new THREE.MeshBasicMaterial({ map: plumeMap, color: 0xffe2c0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    )
    plume.position.y = -2.4
    lander.add(plume)
    const nozzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe6c8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    nozzle.position.y = 0.4
    lander.add(nozzle)
    const engineGlow = new THREE.PointLight(0xffd9a0, 0, 60, 1.6)
    engineGlow.position.y = -0.5
    lander.add(engineGlow)
    // Dust: the engine blows it away in flat, straight sheets (no air to make it billow), and every
    // grain falls back at once when the engine stops.
    const DUST = 1800
    const dustPos = new Float32Array(DUST * 3)
    const dustCol = new Float32Array(DUST * 3)
    const dustSeed = new Float32Array(DUST * 4) // angle, speed, rise, birth (fraction of the cycle)
    for (let i = 0; i < DUST; i++) {
      dustSeed[i * 4] = rnd() * Math.PI * 2
      dustSeed[i * 4 + 1] = 9 + rnd() * 22
      dustSeed[i * 4 + 2] = 0.02 + rnd() * rnd() * 0.16
      dustSeed[i * 4 + 3] = rnd()
    }
    const dustGeo = new THREE.BufferGeometry()
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3))
    const dustMap = dustTexture()
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dustMap, size: 0.5, sizeAttenuation: true, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    dust.frustumCulled = false
    dust.visible = false
    scene.add(dust)
    // The lander's own shadow. The Sun grazes the pole, so it runs for tens of metres; the terrain shadow
    // map (about 1 m per texel) is too coarse for it, so it is a soft dark ribbon laid on the ground,
    // away from the Sun, as long as a 7 m lander casts at that Sun height (140 m at most).
    const SH_SEG = 28
    const shadowGeo = new THREE.BufferGeometry()
    const shPos = new Float32Array((SH_SEG + 1) * 6)
    const shUv = new Float32Array((SH_SEG + 1) * 4)
    const shIdx: number[] = []
    for (let i = 0; i <= SH_SEG; i++) shUv.set([0, 1 - i / SH_SEG, 1, 1 - i / SH_SEG], i * 4)
    for (let i = 0; i < SH_SEG; i++) shIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3)
    shadowGeo.setAttribute('position', new THREE.BufferAttribute(shPos, 3))
    shadowGeo.setAttribute('uv', new THREE.BufferAttribute(shUv, 2))
    shadowGeo.setIndex(shIdx)
    const shadowMap = shadowTexture()
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: shadowMap, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    const landerShadow = new THREE.Mesh(shadowGeo, shadowMat)
    landerShadow.frustumCulled = false
    landerShadow.visible = false
    scene.add(landerShadow)
    let sunAzNow = 0
    let sunElNow = 5
    let shadowShown = 0 // 0..1: comes in as the lander reaches the ground
    const placeShadow = () => {
      if (!landAt) return
      const az = (sunAzNow + 180) * DEG
      const dx = Math.sin(az)
      const dz = -Math.cos(az)
      const len = Math.min(140, 7 / Math.tan(Math.max(1.2, sunElNow) * DEG))
      for (let i = 0; i <= SH_SEG; i++) {
        const f = i / SH_SEG
        const d = -3 + f * f * (len + 3) // closer steps near the lander, where the ground is seen best
        const w = 5.2 * (1 - 0.4 * f)
        for (let k = 0; k < 2; k++) {
          const sgn = k ? 1 : -1
          const x = landAt.x + dx * d - dz * w * sgn
          const z = landAt.z + dz * d + dx * w * sgn
          shPos.set([x, groundAt(x, z) + 0.05, z], (i * 2 + k) * 3)
        }
      }
      shadowGeo.attributes.position.needsUpdate = true
    }
    const showShadow = () => {
      shadowMat.opacity = 0.78 * shadowShown * sunShine
      landerShadow.visible = shadowMat.opacity > 0.01
    }
    let dustClock = 0
    let dustPower = 0 // 0..1, how hard the engine blows; eases out after the engine stops
    let sunShine = 1
    const DUST_LIFE = 1.3
    const stepDust = (dt: number, blow: number) => {
      dustClock += dt
      dustPower += (blow - dustPower) * (1 - Math.exp(-dt * (blow > dustPower ? 6 : 2.2)))
      dust.visible = dustPower > 0.01
      if (!dust.visible) return
      const lit = 0.25 + 0.75 * sunShine
      for (let i = 0; i < DUST; i++) {
        const age = (dustClock / DUST_LIFE + dustSeed[i * 4 + 3]) % 1
        const tt = age * DUST_LIFE
        const r = 1.2 + dustSeed[i * 4 + 1] * tt * (0.5 + 0.5 * dustPower)
        const a = dustSeed[i * 4]
        dustPos[i * 3] = Math.cos(a) * r
        dustPos[i * 3 + 1] = 0.15 + Math.max(0, dustSeed[i * 4 + 1] * dustSeed[i * 4 + 2] * tt - 0.5 * G_MOON * tt * tt)
        dustPos[i * 3 + 2] = Math.sin(a) * r
        const k = dustPower * lit * 0.34 * Math.min(1, age * 8) * (1 - age) * (1 - age)
        dustCol[i * 3] = 0.86 * k
        dustCol[i * 3 + 1] = 0.82 * k
        dustCol[i * 3 + 2] = 0.74 * k
      }
      dustGeo.attributes.position.needsUpdate = true
      dustGeo.attributes.color.needsUpdate = true
    }
    let land: { t: number; ground: number; lastHud: number } | null = null
    let landAt: { x: number; z: number } | null = null
    // The way the lander flies in (unit vector on the ground) and the axis it leans back about to brake.
    const fly = new THREE.Vector3(0, 0, 1)
    const leanAxis = new THREE.Vector3(1, 0, 0)
    const leanQ = new THREE.Quaternion()
    let lean = 0
    let settleT = -1 // seconds since touchdown while the legs settle; -1: at rest
    // The lander comes down upright and, as its pads touch, settles to the slope of the ground.
    const slopeQ = new THREE.Quaternion()
    const yawQ = new THREE.Quaternion()
    const UP = new THREE.Vector3(0, 1, 0)
    let landYaw = 0
    let landed = false
    let shake = 0
    const groundAt = (x: number, z: number) => {
      const hit = new THREE.Raycaster(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0)).intersectObject(ground)[0]
      return hit ? hit.point.y : 0
    }
    // Where the lander touches down: the height and the slope of the ground under its footpads (4.5 m
    // from the centre, as on the Apollo lunar module), at most 25 degrees. Run again whenever the
    // ground changes: the real 5 m ground arrives after the view opens, and the lander used to stay
    // at the old height, under the new ground.
    const placeLander = () => {
      if (!landAt) return
      const { x, z } = landAt
      const g = groundAt(x, z)
      dust.position.set(x, g, z)
      const d = 4.5
      const n = new THREE.Vector3(groundAt(x - d, z) - groundAt(x + d, z), 2 * d, groundAt(x, z - d) - groundAt(x, z + d)).normalize()
      slopeQ.setFromUnitVectors(UP, n)
      const tilt = 2 * Math.acos(Math.min(1, Math.abs(slopeQ.w)))
      if (tilt > 25 * DEG) slopeQ.identity().slerp(new THREE.Quaternion().setFromUnitVectors(UP, n), (25 * DEG) / tilt)
      if (land) land.ground = g
      placeShadow()
      if (landed) {
        lander.position.y = g
        lander.quaternion.copy(slopeQ).multiply(yawQ.setFromAxisAngle(UP, landYaw))
      }
    }
    const tick = (now: number) => {
      raf = 0
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      if (land && landAt) {
        land.t += dt
        const clock = Math.min(A11_END, land.t * A11_SPEEDUP) // seconds of the real descent
        const p = clock / A11_END
        const { alt, rate: speed } = a11At(clock)
        const f = a11Forward(clock)
        // Still that far from the touchdown point, back along the way it flies.
        const lx = landAt.x - fly.x * f.left
        const lz = landAt.z - fly.z * f.left
        // Height over the touchdown point; far out, never under the ground it flies over.
        const ly = f.left > 12 ? Math.max(land.ground + alt, groundAt(lx, lz) + Math.min(alt, 12)) : land.ground + alt
        lander.position.set(lx, ly, lz)
        // It leans back to brake: the engine has to hold it up (lunar gravity) and slow it down.
        lean += (Math.atan2(f.brake, G_MOON) - lean) * (1 - Math.exp(-dt * 3))
        const settle = THREE.MathUtils.smoothstep(1 - alt / 1.4, 0, 1)
        leanQ.setFromAxisAngle(leanAxis, lean)
        lander.quaternion.copy(leanQ).slerp(slopeQ, settle).multiply(yawQ.setFromAxisAngle(UP, landYaw))
        const on = p < 1
        plume.visible = nozzle.visible = on
        const flick = Math.sin(now / 31) + 0.5 * Math.sin(now / 13)
        engineGlow.intensity = on ? 260 + 50 * flick : 0
        plume.scale.set(1 + 0.12 * Math.sin(now / 37), 1 + 0.08 * flick, 1 + 0.12 * Math.sin(now / 37))
        nozzle.scale.setScalar(2.6 + 0.3 * flick)
        // Dust from 40 ft down ("picking up some dust", 102:45:17), harder the lower it gets.
        const near = Math.min(1, Math.max(0, 1 - alt / (45 * FT)))
        stepDust(dt, on ? near : 0)
        // The engine: a steady burn, louder over the last metres as it holds the lander up.
        sfx.setEngine(on ? 0.55 + 0.45 * near : 0)
        // The camera follows: far out, close in on the lander; near the ground, the lander and the
        // ground it comes down to both in the frame.
        const dist = Math.hypot(lx, lz)
        const top = Math.atan2(ly + 5 - 1.7, dist) / DEG
        const foot = Math.atan2(land.ground - 1.7, Math.max(LAND_DIST, dist)) / DEG
        let az = Math.atan2(lx, -lz) / DEG
        while (az - yawGoal > 180) az -= 360
        while (az - yawGoal < -180) az += 360
        yawGoal = az
        const far = THREE.MathUtils.smoothstep(f.left, 50, 380)
        const mid = Math.atan2(ly + 2 - 1.7, dist) / DEG
        const size = (Math.atan2(9, Math.hypot(dist, ly)) / DEG) * 9 // the lander about a ninth of the view
        pitchGoal = Math.max(-8, Math.min(80, (foot + (top - foot) * 0.58) * (1 - far) + mid * far))
        fovGoal = Math.max(5, Math.min(58, ((top - foot) * 1.7 + 7) * (1 - far) + Math.max(5, size) * far))
        shadowShown = THREE.MathUtils.smoothstep(1 - alt / 30, 0, 1)
        showShadow()
        shake = on ? 0.05 * near : 0.5
        if (now - land.lastHud > 90 || !on) {
          land.lastHud = now
          setHud({ alt, speed, fwd: f.v, clock, phase: on ? 'descent' : 'down' })
        }
        if (!on) {
          sfx.touchdown()
          land = null
          landed = true
          settleT = 0
        }
      } else if (settleT >= 0 && landAt) {
        // Touchdown: the legs take the blow and settle, the last dust falls back.
        settleT += dt
        stepDust(dt, 0)
        const g = groundAt(landAt.x, landAt.z)
        lander.position.y = g - 0.09 * Math.sin(settleT * 13) * Math.exp(-settleT * 5)
        shake = 0.5 * Math.exp(-settleT * 6)
        if (settleT > 2.2) {
          settleT = -1
          shake = 0
          lander.position.y = g
          dust.visible = false
          fovGoal = 42
        }
      }
      if (!drag && (vYaw || vPitch)) {
        yawGoal += vYaw * dt
        pitchGoal = Math.max(-10, Math.min(landed ? 58 : 45, pitchGoal + vPitch * dt))
        const d = Math.exp(-dt * 3.5)
        vYaw *= d
        vPitch *= d
        if (Math.abs(vYaw) < 0.5) vYaw = 0
        if (Math.abs(vPitch) < 0.5) vPitch = 0
      }
      const e = 1 - Math.exp(-dt * 16)
      yaw += (yawGoal - yaw) * e
      pitch += (pitchGoal - pitch) * e
      fov += (fovGoal - fov) * (1 - Math.exp(-dt * 12))
      camera.fov = fov
      camera.updateProjectionMatrix()
      // The engine shakes the view a little near the ground; the touchdown gives it a jolt.
      const jx = shake ? shake * Math.sin(now / 17) * Math.sin(now / 5.3) : 0
      const jy = shake ? shake * 0.6 * Math.sin(now / 11) * Math.sin(now / 7.1) : 0
      camera.rotation.set((pitch + jx) * DEG, -(yaw + jy) * DEG, 0)
      renderer.render(scene, camera)
      // Where the Sun lands on screen, for the automated checks.
      const sp = sun.position.clone().project(camera)
      cvs.dataset.sun = `${sp.x.toFixed(2)},${sp.y.toFixed(2)},${sp.z.toFixed(3)}`
      const moving = !!land || settleT >= 0 || Math.abs(yawGoal - yaw) > 0.01 || Math.abs(pitchGoal - pitch) > 0.01 || Math.abs(fovGoal - fov) > 0.01 || vYaw || vPitch
      if (moving) raf = requestAnimationFrame(tick)
      const hd = (((yaw % 360) + 360) % 360)
      if (Math.abs(hd - shownHeading) > 2) {
        shownHeading = hd
        setHeading(hd)
      }
    }
    let shownHeading = -99
    const invalidate = () => {
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }

    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight || 1
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      invalidate()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const pointers = new Map<number, { x: number; y: number }>()
    let drag: { x: number; y: number; track: { t: number; x: number; y: number }[] } | null = null
    let pinch: { d: number; fov: number } | null = null
    const spread = () => {
      const [a, b] = [...pointers.values()]
      return Math.hypot(a.x - b.x, a.y - b.y) || 1
    }
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      renderer.domElement.setPointerCapture(e.pointerId)
      vYaw = vPitch = 0
      if (pointers.size >= 2) {
        pinch = { d: spread(), fov: fovGoal }
        drag = null
      } else {
        drag = { x: e.clientX, y: e.clientY, track: [{ t: performance.now(), x: e.clientX, y: e.clientY }] }
        renderer.domElement.style.cursor = 'grabbing'
      }
    }
    const move = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch && pointers.size >= 2) {
        fovGoal = Math.max(20, Math.min(75, (pinch.fov * pinch.d) / spread()))
        invalidate()
        return
      }
      if (!drag) return
      // Closer in (narrow view), slower turns.
      const k = 0.2 * (fovGoal / 60)
      yawGoal -= (e.clientX - drag.x) * k
      pitchGoal = Math.max(-10, Math.min(45, pitchGoal + (e.clientY - drag.y) * k * 0.6))
      drag.x = e.clientX
      drag.y = e.clientY
      const now = performance.now()
      drag.track.push({ t: now, x: e.clientX, y: e.clientY })
      while (drag.track.length > 2 && now - drag.track[0].t > 100) drag.track.shift()
      invalidate()
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pinch) {
        if (pointers.size < 2) pinch = null
        drag = null
        return
      }
      if (drag && drag.track.length > 1 && performance.now() - drag.track[drag.track.length - 1].t < 70) {
        const a = drag.track[0]
        const b = drag.track[drag.track.length - 1]
        const span = (b.t - a.t) / 1000
        if (span > 0.01) {
          const k = 0.2 * (fovGoal / 60)
          vYaw = Math.max(-240, Math.min(240, (-(b.x - a.x) * k) / span))
          vPitch = Math.max(-120, Math.min(120, ((b.y - a.y) * k * 0.6) / span))
        }
      }
      drag = null
      renderer.domElement.style.cursor = 'grab'
      invalidate()
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      fovGoal = Math.max(20, Math.min(75, fovGoal * Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.003)))
      invalidate()
    }
    const cvs = renderer.domElement
    cvs.addEventListener('pointerdown', down)
    cvs.addEventListener('pointermove', move)
    cvs.addEventListener('pointerup', up)
    cvs.addEventListener('pointercancel', up)
    cvs.addEventListener('wheel', wheel, { passive: false })

    api.current = {
      setSite: (s, g) => {
        ground.geometry.dispose()
        ground.geometry = buildTerrain(s, g)
        placeLander()
        invalidate()
      },
      setSample: (s) => {
        const d = direction(s.sunAz, s.sunEl)
        sun.position.copy(d).multiplyScalar(SKY)
        sunLight.position.copy(d).multiplyScalar(3000)
        sunLight.intensity = 4.5 * s.sunVisible
        sunShine = s.sunVisible
        sunAzNow = s.sunAz
        sunElNow = s.sunEl
        if (landAt) {
          placeShadow()
          showShadow()
        }
        earth.position.copy(direction(s.earthAz, s.earthEl)).multiplyScalar(SKY)
        earthMat.uniforms.sunDir.value.copy(d)
        invalidate()
      },
      lookAt: (az) => {
        // Turn the short way round to face that azimuth.
        let target = az
        while (target - yawGoal > 180) target -= 360
        while (target - yawGoal < -180) target += 360
        yawGoal = target
        vYaw = vPitch = 0
        invalidate()
      },
      land: (sunAz) => {
        setHud({ alt: A11[0][1] * FT, speed: 0, fwd: 0, clock: 0, phase: 'load' })
        loadLander()
          .then((model) => {
            if (!api.current) return
            if (!lander.children.includes(model)) {
              model.traverse((o) => {
                const m = o as THREE.Mesh
                if (m.isMesh) m.castShadow = m.receiveShadow = true
              })
              lander.add(model)
            }
            // Touch down with the Sun to one side, so the lander is lit and its long shadow lies
            // across the view; on the side the camera is already nearer to.
            const off = ((((yawGoal - sunAz) % 360) + 540) % 360) - 180 < 0 ? -105 : 105
            const az = (sunAz + off) * DEG
            const x = Math.sin(az) * LAND_DIST
            const z = -Math.cos(az) * LAND_DIST
            // It flies in from beyond the touchdown point, a little further round from the Sun.
            const from = (sunAz + off * 1.27) * DEG
            fly.set(-Math.sin(from), 0, Math.cos(from))
            leanAxis.crossVectors(fly, UP).normalize()
            lean = 0
            lander.visible = true
            landed = false
            settleT = -1
            landAt = { x, z }
            landYaw = Math.atan2(fly.x, fly.z)
            lander.quaternion.identity()
            land = { t: 0, ground: 0, lastHud: 0 }
            dustPower = 0
            shadowShown = 0
            showShadow()
            placeLander()
            vYaw = vPitch = 0
            invalidate()
          })
          .catch(() => setHud({ alt: 0, speed: 0, fwd: 0, clock: 0, phase: 'failed' }))
      },
    }

    return () => {
      api.current = null
      sfx.setEngine(0) // closed mid-descent: the engine stops too
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
      cvs.removeEventListener('wheel', wheel)
      ground.geometry.dispose()
      groundMat.map?.dispose()
      groundMat.normalMap?.dispose()
      glow.dispose()
      plumeMap.dispose()
      dustMap.dispose()
      dustGeo.dispose()
      shadowGeo.dispose()
      shadowMap.dispose()
      earthMat.uniforms.map.value.dispose()
      starGeo.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
    // The container's size is followed by the ResizeObserver; no need to rebuild the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let alive = true
    setReal(null)
    api.current?.setSite(site, null)
    loadGround(site.id).then((g) => {
      if (!alive || !g) return
      setReal(g)
      api.current?.setSite(site, g)
    })
    return () => {
      alive = false
    }
  }, [site])
  useEffect(() => {
    api.current?.setSample(sample)
  }, [sample])
  // Start each site facing the Sun.
  useEffect(() => {
    api.current?.lookAt(sample.sunAz)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site])
  useEffect(() => {
    if (landing) api.current?.land(sample.sunAz)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing])

  if (failed) {
    return (
      <div className="flex items-center justify-center bg-black text-sm text-white/70" style={{ height }}>
        {t.no3d}
      </div>
    )
  }

  return (
    <div className="relative bg-black">
      <div ref={mount} style={{ height }} />
      <p className="pointer-events-none absolute left-3 top-2 text-sm text-white/80">
        {t.looking(t.compassLong[Math.round(heading / 45) % 8])}
        {ridgeKmAt(site, heading) !== null && <span className="block text-xs text-white/65">{t.reliefSeen(ridgeKmAt(site, heading)!)}</span>}
      </p>
      {/* Landing simulation: height above the ground, descent speed and what is happening. */}
      <div className="pointer-events-none absolute right-3 top-2 flex max-h-[calc(100%-76px)] w-[min(260px,calc(100%-24px))] flex-col gap-1.5 overflow-y-auto">
      {hud && (
        <details open={hudOpen} onToggle={(e) => setHudOpen((e.target as HTMLDetailsElement).open)} className="ui-in glass pointer-events-auto px-3 py-2 text-sm" role="status">
          <summary className={`flex cursor-pointer list-none items-center gap-2 font-semibold ${hud.phase === 'down' ? 'text-ok' : hud.phase === 'failed' ? 'text-warn' : 'text-sun'}`}>
            <span className="min-w-0 flex-1">
              {hud.phase === 'load' ? t.simLoading : hud.phase === 'descent' ? t.simDescent : hud.phase === 'down' ? t.simDown : t.simFailed}
              {!hudOpen && (hud.phase === 'descent' || hud.phase === 'down') && <span className="ml-2 font-normal tabular-nums text-white/80">{hud.alt.toFixed(hud.alt < 10 ? 1 : 0)} m</span>}
            </span>
            <Chevron open={hudOpen} />
          </summary>
          {(hud.phase === 'descent' || hud.phase === 'down') && (
            <dl className="mt-1 grid grid-cols-3 gap-x-2 tabular-nums">
              <div>
                <dt className="text-xs text-muted">{t.simAltitude}</dt>
                <dd className="text-lg font-bold leading-tight">{hud.alt.toFixed(hud.alt < 10 ? 1 : 0)} <span className="text-xs font-normal">m</span></dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t.simSpeed}</dt>
                <dd className="text-lg font-bold leading-tight">{hud.phase === 'down' ? '0.0' : hud.speed.toFixed(1)} <span className="text-xs font-normal">m/s</span></dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t.simForward}</dt>
                <dd className="text-lg font-bold leading-tight">{hud.phase === 'down' ? '0.0' : hud.fwd.toFixed(1)} <span className="text-xs font-normal">m/s</span></dd>
              </div>
            </dl>
          )}
          {(hud.phase === 'descent' || hud.phase === 'down') && (
            <p className="mt-1 text-xs tabular-nums text-white/80">{t.simClock(`102:${String(43 + Math.floor((1 + Math.round(hud.clock)) / 60)).padStart(2, '0')}:${String((1 + Math.round(hud.clock)) % 60).padStart(2, '0')}`, A11_SPEEDUP)}</p>
          )}
          <p className="mt-1 text-[11px] leading-snug text-muted">{t.simNote}</p>
        </details>
      )}
      {/* What the sky and the ground are like at this hour, from the data of the tool. */}
      <button type="button" onClick={() => setCardsShown((v) => !v)} aria-expanded={cardsShown} title={cardsShown ? t.hideCards : t.skyPanel} className="glass pointer-events-auto flex min-h-9 items-center gap-2 self-end px-3 text-xs font-semibold hover:bg-white/10">
        {t.skyPanel}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${cardsShown ? 'rotate-180' : ''}`} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {cardsShown && (
      <>
      <details open={open.sun} onToggle={toggle('sun')} className="glass pointer-events-auto border-l-2 border-l-sun px-3 py-2 text-xs tabular-nums">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-sun">
          <i className="inline-block size-2.5 rounded-full bg-sun" aria-hidden="true" />{t.sunWord}
          {!open.sun && <span className="ml-auto pr-1 text-xs font-normal text-white/80">{sample.sunEl.toFixed(1)}° · {sample.sunVisible > 0.5 ? t.yesCap : t.noCap}</span>}
        <Chevron open={open.sun} />
        </summary>
        <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
          <dt className="text-white/75">{t.azimuth}</dt><dd className="text-right">{sample.sunAz.toFixed(1)}°</dd>
          <dt className="text-white/75">{t.elevation}</dt><dd className="text-right">{sample.sunEl.toFixed(1)}°</dd>
          <dt className="text-white/75">{t.litSite}</dt><dd className="text-right">{sample.sunVisible > 0.5 ? <span className="text-ok">{t.yesCap}</span> : <span className="text-warn">{t.noCap}</span>}</dd>
        </dl>
        <p className="mt-1.5 text-[11px] leading-snug text-muted">{real ? t.skyNoteGround : t.skyNote}</p>
      </details>
      <details open={open.earth} onToggle={toggle('earth')} className="glass pointer-events-auto border-l-2 border-l-earth px-3 py-2 text-xs tabular-nums">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-earth">
          <i className="inline-block size-2.5 rounded-full bg-earth" aria-hidden="true" />{t.earthWord}
          {!open.earth && <span className="ml-auto pr-1 text-xs font-normal text-white/80">{sample.earthEl.toFixed(1)}° · {sample.earthVisible ? t.yesCap : t.noCap}</span>}
        <Chevron open={open.earth} />
        </summary>
        <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
          <dt className="text-white/75">{t.azimuth}</dt><dd className="text-right">{sample.earthAz.toFixed(1)}°</dd>
          <dt className="text-white/75">{t.elevation}</dt><dd className="text-right">{sample.earthEl.toFixed(1)}°</dd>
          <dt className="text-white/75">{t.earthAbove}</dt><dd className="text-right">{sample.earthVisible ? <span className="text-ok">{t.yesCap}</span> : <span className="text-warn">{t.noCap}</span>}</dd>
        </dl>
      </details>
      {real && (
        <details open={open.ground} onToggle={toggle('ground')} className="glass pointer-events-auto border-l-2 border-l-white/40 px-3 py-2 text-xs tabular-nums">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold">
            {t.groundHere}
            {!open.ground && <span className="ml-auto pr-1 text-xs font-normal text-white/80">{real.slopeDeg.toFixed(1)}°</span>}
          <Chevron open={open.ground} />
          </summary>
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            <dt className="text-white/75">{t.slope}</dt><dd className="text-right">{real.slopeDeg.toFixed(1)}°</dd>
            <dt className="text-white/75">{t.incidence}</dt><dd className="text-right">{incidenceDeg(real, sample.sunAz, sample.sunEl).toFixed(1)}°</dd>
          </dl>
        </details>
      )}
      </>
      )}
      </div>
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button onClick={() => api.current?.lookAt(sample.sunAz)} className="flex min-h-11 items-center gap-2 rounded-sm border border-white/40 bg-black/60 px-3.5 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/15">
          <i className="inline-block size-2.5 rounded-full bg-sun" aria-hidden="true" />
          {t.faceSun}
        </button>
        <button onClick={() => api.current?.lookAt(sample.earthAz)} className="flex min-h-11 items-center gap-2 rounded-sm border border-white/40 bg-black/60 px-3.5 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/15">
          <i className="inline-block size-2.5 rounded-full bg-earth" aria-hidden="true" />
          {t.faceEarth}
        </button>
      </div>
    </div>
  )
}
