// Written with Claude Code (Claude Opus 5.5); reviewed by <name>
// Franky in 3D on the opening screen: rolls in from the side, turns to the viewer, waves and asks how
// to start. The model was made by the team with Meshy (AI) and comes rigged but without animations,
// so the roll, the turn and the wave are driven here, bone by bone. Loaded on its own: until it is in
// (or if WebGL fails) the opening screen is simply without it.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const URL = 'models/franky.glb'
// #sfxdebug exposes the bones (window.__bot) to check the animation; read at load, before the app rewrites the hash.
const DEBUG = /sfxdebug/.test(window.location.hash)
const ROLL_S = 1.8 // rolling in
const TURN_S = 0.7 // turning to the viewer
const WAVE_S = 2.6 // the first, big wave

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x))

export function SplashBot({ width, height, onWave }: { width: number; height: number; onWave?: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const waved = useRef(onWave)
  useEffect(() => {
    waved.current = onWave
  }, [onWave])

  useEffect(() => {
    const el = box.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50)
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

    // Turn a bone about an axis given in world space, on top of its rest pose.
    const turn = (name: string, axis: THREE.Vector3, angle: number) => {
      const j = bones[name]
      if (!j) return
      j.b.parent!.getWorldQuaternion(pq)
      q.setFromAxisAngle(axis, angle)
      j.b.quaternion.copy(pq.clone().invert().multiply(q).multiply(pq)).multiply(j.rest)
    }

    import('three/examples/jsm/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(URL))
      .then((gltf) => {
        if (disposed) return
        root = gltf.scene
        root.traverse((o) => {
          const b = o as THREE.Bone
          if (b.isBone) bones[b.name] = { b, rest: b.quaternion.clone() }
          const m = o as THREE.Mesh
          if (m.isMesh) m.frustumCulled = false
        })
        scene.add(root)
        if (DEBUG) (window as unknown as { __bot?: unknown }).__bot = { bones, root }
        setShown(true)
        const t0 = performance.now()
        let wavedOnce = false
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame)
          if (!root) return
          const fixed = DEBUG ? (window as unknown as { __botT?: number }).__botT : undefined
          const t = fixed ?? (reduce ? ROLL_S + TURN_S + WAVE_S + 1 : (now - t0) / 1000)
          // Roll in from the left, facing where it goes, then turn to the viewer.
          const roll = ease(t / ROLL_S)
          root.position.x = -2.6 * (1 - roll)
          root.position.y = 0.012 * Math.sin(t * 9) * (1 - roll) // bumps on the regolith
          const facing = ease((t - ROLL_S + 0.2) / TURN_S)
          root.rotation.y = (Math.PI / 2) * (1 - facing) - 0.18 * facing
          root.rotation.z = -0.06 * Math.sin(Math.PI * roll) // leaning into the start, then settling
          root.updateMatrixWorld(true)
          root.getWorldDirection(fwd)
          // Wave: raise the arm on the viewer's right, then the forearm swings.
          const tw = t - ROLL_S - TURN_S * 0.6
          let lift = 0
          let swing = 0
          if (tw > 0) {
            if (!wavedOnce) {
              wavedOnce = true
              waved.current?.()
            }
            const up = ease(tw / 0.5)
            const down = tw > WAVE_S ? ease((tw - WAVE_S) / 0.6) : 0
            // After the big wave the arm rests low, and waves again briefly every 9 s.
            const again = tw > WAVE_S + 1 ? Math.max(0, Math.sin(((tw - WAVE_S - 1) / 9) * Math.PI * 2)) ** 8 : 0
            const on = Math.max(up * (1 - down), again)
            lift = 1.35 * on
            swing = 0.65 * Math.sin(tw * 9) * on
          }
          // Shoulder up beside the head; the forearm and the hand swing side to side.
          turn('Bone_018', fwd, lift)
          turn('Bone_017', fwd, lift * 0.55 + swing)
          turn('Bone_016', fwd, swing * 0.6)
          // Alive while idle: the head looks around a little.
          turn('Bone_021', new THREE.Vector3(0, 1, 0), 0.12 * Math.sin(t * 0.9) * facing)
          renderer.render(scene, camera)
        }
        raf = requestAnimationFrame(frame)
      })
      .catch(() => {
        /* no model: the opening screen goes on without it */
      })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      renderer.dispose()
      renderer.domElement.remove()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.geometry.dispose()
          ;(Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => mt.dispose())
        }
      })
    }
  }, [width, height])

  // The left edge fades, so Franky rolls in out of the dark instead of being cut at the canvas edge.
  return <div ref={box} aria-hidden="true" className={`transition-opacity duration-500 ${shown ? 'opacity-100' : 'opacity-0'}`} style={{ width, height, maskImage: 'linear-gradient(90deg, transparent, #000 30%)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 30%)' }} />
}
