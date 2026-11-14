// How much Moon this computer can draw, decided once at start and lowered if frames come slow.
// Level 0: software rendering or a weak device. 1: phones, tablets, laptops with integrated GPUs.
// 2: desktop-class GPUs. `#q=0|1|2` in the address forces a level (for testing).
import type { WebGLRenderer } from 'three'

export type Quality = {
  level: 0 | 1 | 2
  gpu: string
  rings: number
  segs: number
  shadows: number // shadow map size; 0 = no shadows
  pixelRatio: number
  maps4k: boolean
}

const LEVELS: Omit<Quality, 'level' | 'gpu'>[] = [
  { rings: 120, segs: 256, shadows: 0, pixelRatio: 1, maps4k: false },
  { rings: 200, segs: 480, shadows: 1536, pixelRatio: 1.5, maps4k: false },
  { rings: 300, segs: 720, shadows: 3072, pixelRatio: 1.75, maps4k: true },
]

// Read when the page starts (main.tsx): the app rewrites the address before the Moon is loaded.
let forced: 0 | 1 | 2 | null = null
export function readForcedQuality() {
  const m = /[#&]q=([012])/.exec(window.location.hash)
  forced = m ? (Number(m[1]) as 0 | 1 | 2) : null
}

export function qualityAt(level: 0 | 1 | 2, gpu = ''): Quality {
  return { level, gpu, ...LEVELS[level] }
}

export function measureQuality(renderer: WebGLRenderer, small: boolean): Quality {
  const gl = renderer.getContext()
  let gpu = ''
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase()
  } catch {
    // some browsers hide the GPU name; the other signals still count
  }
  if (forced !== null) return qualityAt(forced, gpu)

  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency || 4
  const memory = nav.deviceMemory ?? 4
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number

  const software = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(gpu)
  const weak = cores <= 2 || memory <= 2 || maxTex < 4096 || /mali-[34]|mali-t|adreno \(tm\) [345]\d\d|powervr|intel\(r\) (hd|uhd) graphics [2-5]\d\d\b/.test(gpu)
  const strong = /nvidia|geforce|rtx|quadro|radeon rx|radeon pro|apple m\d|apple gpu|arc a\d/.test(gpu) && cores >= 6 && memory >= 8

  let level: 0 | 1 | 2 = 1
  if (software || weak) level = 0
  else if (strong && !small) level = 2
  return qualityAt(level, gpu)
}
