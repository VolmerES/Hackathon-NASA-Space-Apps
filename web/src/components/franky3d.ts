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
  const Z_AXIS = new THREE.Vector3(0, 0, 1)
  // Eased state, following the pose.
  let x = pose.x
  let facing = pose.facing
  let roll = 0
  let wave = 0
  let waveClock = 0
  // Motion with weight: the speed he really moves at, the lean it gives him, a nod when he brakes,
  // a little hop when he starts to wave, and springs so turns and stops overshoot and settle.
  let vx = 0
  let facingV = 0
  let lean = 0
  let leanV = 0
  let hop = 0
  let hopV = 0
  let wasWaving = false
  let blinkLook = 0

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
      const t = now / 1000
      // Rolling to a new place: he picks up speed, cruises and brakes (a critically damped spring),
      // instead of jumping to full speed.
      const accel = reduce ? 0 : (pose.x - x) * 10.2 - vx * 6.4
      if (reduce) x = pose.x
      else {
        vx += accel * dt
        x += vx * dt
      }
      // Turning: a spring, so he swings round, goes a touch too far and comes back.
      let d = pose.facing - facing
      d = Math.atan2(Math.sin(d), Math.cos(d))
      if (reduce) facing = pose.facing
      else {
        facingV += (d * 60 - facingV * 11) * dt
        facing += facingV * dt
      }
      roll += ((pose.rolling ? 1 : 0) - roll) * k
      wave += ((pose.waving ? 1 : 0) - wave) * (reduce ? 1 : 1 - Math.exp(-dt * 5))
      waveClock += dt
      // Leaning: back when he speeds up, forward when he brakes (a spring: he rocks once on stopping).
      const leanGoal = reduce ? 0 : Math.max(-0.2, Math.min(0.2, -accel * Math.sign(Math.sin(facing) || 1) * 0.03)) + 0.05 * roll
      leanV += ((leanGoal - lean) * 90 - leanV * 9) * dt
      lean += leanV * dt
      // A happy little hop as the wave starts.
      if (pose.waving && !wasWaving && !reduce) hopV = 0.6
      wasWaving = pose.waving
      hopV -= (hop * 120 + hopV * 9) * dt
      hop = Math.max(-0.02, hop + hopV * dt)
      if (DEBUG) {
        const fix = (window as unknown as { __fpose?: { wave: number; clock: number; facing?: number } }).__fpose
        if (fix) {
          wave = fix.wave
          waveClock = fix.clock
          if (fix.facing !== undefined) facing = fix.facing
        }
      }
      const idle = 1 - roll
      const moving = Math.min(1, Math.abs(vx) / 1.2)
      root.position.x = x
      // Bumps on the regolith while rolling (faster: more of them), a slow breath while standing.
      root.position.y = 0.012 * Math.sin(t * 13) * roll * (0.4 + 0.6 * moving) + 0.006 * Math.sin(t * 1.7) * idle + hop
      root.rotation.set(0, 0, 0)
      root.rotation.y = facing
      // The lean is about the axis across his way: forwards or backwards along the screen's x.
      const dirX = Math.sin(facing)
      root.rotateOnWorldAxis(Z_AXIS, -lean * Math.sign(dirX || 1) * Math.abs(dirX))
      // Standing: a slight sway, so he is never a statue.
      root.rotateOnWorldAxis(Z_AXIS, 0.012 * Math.sin(t * 1.1) * idle)
      root.updateMatrixWorld(true)
      root.getWorldDirection(fwd)
      // Wave: the upper arm out to the side, a little back (clear of the big helmet), the forearm up,
      // and forearm and hand swinging outwards, never towards the head.
      const P = (DEBUG && (window as unknown as { __fparams?: typeof WAVE }).__fparams) || WAVE
      const swing = P.swing * (0.5 + 0.5 * Math.sin(waveClock * 8.5)) * wave
      side.crossVectors(fwd, UP).normalize()
      turn2('Bone_018', fwd, P.lift * wave, side, P.forward * wave)
      turn('Bone_017', fwd, (P.elbow - swing) * wave)
      turn('Bone_016', fwd, -swing * P.hand * wave)
      // The head: looks around while idle (two slow rhythms, so it never repeats), tips towards the
      // waving hand, and looks ahead into the turn while he swings round.
      blinkLook += (Math.max(-0.35, Math.min(0.35, facingV * 0.12)) - blinkLook) * k
      const look = (0.1 * Math.sin(t * 0.9) + 0.05 * Math.sin(t * 0.37 + 1)) * idle + blinkLook
      turn2('Bone_021', UP, look, fwd, -0.13 * wave + 0.03 * Math.sin(t * 2.3) * moving)
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
