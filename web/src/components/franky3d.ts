// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
// Franky in 3D, shared by the opening screen and the guided tour. The model was made by the team with
// Meshy (AI); it comes rigged but without animations, so everything here is driven bone by bone. The
// caller only says where Franky is and what he does (x, facing, rolling, waving); the stage eases
// towards it every frame. If WebGL or the model fail, nothing is drawn and nothing breaks.
import * as THREE from 'three'
import * as sfx from '../sound'

const URL = 'models/franky.glb'
// #sfxdebug exposes the stage (window.__franky) to check poses; read at load, before the hash changes.
const DEBUG = typeof window !== 'undefined' && /sfxdebug/.test(window.location.hash)

export type FrankyPose = {
  /** Sideways position in model units (0: centre of the canvas). */
  x: number
  /** Turn about the vertical (rad): 0 faces the viewer, +π/2 faces right, −π/2 faces left. */
  facing: number
  /** Rolling: bumps on the regolith and a lean into the motion. */
  rolling: boolean
  /** Waving with the arm on the viewer's right. */
  waving: boolean
}

export type FrankyStage = { set: (p: Partial<FrankyPose>) => void; dispose: () => void; loaded: Promise<boolean> }

// The wave, in radians: shoulder lift (out to the side), forward swing of the arm, elbow bend, and the
// outward swing of the forearm and hand.
const WAVE = { lift: 0.85, forward: -0.3, elbow: 0.6, swing: 0.7, hand: 0.4 }

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x))

let modelPromise: Promise<THREE.Group | null> | null = null
const loadModel = () =>
  (modelPromise ??= import('three/examples/jsm/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(URL))
    .then((g) => g.scene)
    .catch(() => null))

export function createFranky(el: HTMLElement, w: number, h: number, init: Partial<FrankyPose> = {}): FrankyStage {
  const pose: FrankyPose = { x: 0, facing: 0, rolling: false, waving: false, ...init }
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: DEBUG })
  } catch {
    return { set: () => {}, dispose: () => {}, loaded: Promise.resolve(false) }
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w, h)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50)
  camera.position.set(0, 1.05, 4.2)
  camera.lookAt(0, 0.82, 0)
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x20242c, 1.4))
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6) // the Sun, low and to one side, as at the pole
  key.position.set(2.5, 2.2, 3)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x8fb4ff, 1.4)
  rim.position.set(-3, 2, -2)
  scene.add(rim)

  let disposed = false
  let raf = 0
  let root: THREE.Object3D | null = null
  const bones: Record<string, { b: THREE.Bone; rest: THREE.Quaternion }> = {}
  const q = new THREE.Quaternion()
  const pq = new THREE.Quaternion()
  const fwd = new THREE.Vector3()
  const UP = new THREE.Vector3(0, 1, 0)
  // Eased state, following the pose.
  let x = pose.x
  let facing = pose.facing
  let roll = 0
  let wave = 0
  let waveClock = 0

  const side = new THREE.Vector3()
  const q2 = new THREE.Quaternion()
  // Two turns about world axes (applied b then a), on top of the rest pose.
  const turn2 = (name: string, a: THREE.Vector3, angA: number, b: THREE.Vector3, angB: number) => {
    const j = bones[name]
    if (!j) return
    j.b.parent!.getWorldQuaternion(pq)
    q.setFromAxisAngle(a, angA).multiply(q2.setFromAxisAngle(b, angB))
    j.b.quaternion.copy(pq.clone().invert().multiply(q).multiply(pq)).multiply(j.rest)
  }
  // Turn a bone about an axis given in world space, on top of its rest pose.
  const turn = (name: string, axis: THREE.Vector3, angle: number) => {
    const j = bones[name]
    if (!j) return
    j.b.parent!.getWorldQuaternion(pq)
    q.setFromAxisAngle(axis, angle)
    j.b.quaternion.copy(pq.clone().invert().multiply(q).multiply(pq)).multiply(j.rest)
  }

  const loaded = loadModel().then((model) => {
    if (disposed || !model) return false
    // Each stage gets its own copy (the opening screen and the tour may overlap for a moment).
    root = model.clone(true)
    root.traverse((o) => {
      const b = o as THREE.Bone
      if (b.isBone) bones[b.name] = { b, rest: b.quaternion.clone() }
      const m = o as THREE.Mesh
      if (m.isMesh) m.frustumCulled = false
    })
    // Skinned meshes cloned with clone(true) keep the original skeleton: rebind them to the copy.
    root.traverse((o) => {
      const sk = o as THREE.SkinnedMesh
      if (sk.isSkinnedMesh) sk.skeleton = new THREE.Skeleton(sk.skeleton.bones.map((b) => bones[b.name]?.b ?? b), sk.skeleton.boneInverses)
    })
    scene.add(root)
    if (DEBUG) (window as unknown as { __franky?: unknown }).__franky = { bones, root, renderer, scene, camera }
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!root) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const k = reduce ? 1 : 1 - Math.exp(-dt * 6)
      x += (pose.x - x) * (reduce ? 1 : 1 - Math.exp(-dt * 2.4))
      let d = pose.facing - facing
      d = Math.atan2(Math.sin(d), Math.cos(d))
      facing += d * k
      roll += ((pose.rolling ? 1 : 0) - roll) * k
      wave += ((pose.waving ? 1 : 0) - wave) * (reduce ? 1 : 1 - Math.exp(-dt * 5))
      waveClock += dt
      if (DEBUG) {
        const fix = (window as unknown as { __fpose?: { wave: number; clock: number; facing?: number } }).__fpose
        if (fix) {
          wave = fix.wave
          waveClock = fix.clock
          if (fix.facing !== undefined) facing = fix.facing
        }
      }
      root.position.x = x
      root.position.y = 0.014 * Math.sin(now / 1000 * 11) * roll // bumps on the regolith
      root.rotation.y = facing
      root.rotation.z = -0.07 * roll * Math.sign(Math.sin(facing) || 1) // leaning into the motion
      root.updateMatrixWorld(true)
      root.getWorldDirection(fwd)
      // Wave: the upper arm out to the side, a little back (clear of the big helmet), the forearm up,
      // and forearm and hand swinging outwards, never towards the head.
      const P = (DEBUG && (window as unknown as { __fparams?: typeof WAVE }).__fparams) || WAVE
      const swing = P.swing * (0.5 + 0.5 * Math.sin(waveClock * 9)) * wave
      side.crossVectors(fwd, UP).normalize()
      turn2('Bone_018', fwd, P.lift * wave, side, P.forward * wave)
      turn('Bone_017', fwd, (P.elbow - swing) * wave)
      turn('Bone_016', fwd, -swing * P.hand * wave)
      // Alive while idle: the head looks around a little.
      turn('Bone_021', UP, 0.12 * Math.sin(now / 1000 * 0.9) * (1 - roll))
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(frame)
    return true
  })

  return {
    set: (p) => {
      if (p.rolling !== undefined && p.rolling !== pose.rolling) sfx.roll(p.rolling)
      Object.assign(pose, p)
    },
    loaded,
    dispose: () => {
      disposed = true
      if (pose.rolling) sfx.roll(false)
      cancelAnimationFrame(raf)
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

export { ease }
