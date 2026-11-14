// Optional high-detail Moon from Cesium ion. Tested with a real token: the tiles load and line up
// with the site markers (same craters under them as on our own Moon). It is an option the viewer
// turns on (HD button). Its picture keeps its own painted relief; our Sun of the chosen date sets
// where it is day and night, and the heat map is laid over it.
//
// "Cesium Moon Terrain" (ion asset 2684829) is a 3D Tiles set of the Moon built from NASA LRO data
// (LOLA, LROC), with terrain down to 5 m near the poles. It is streamed from Cesium ion, needs an
// access token of the team's own ion account (VITE_CESIUM_TOKEN in web/.env.local) and their
// attribution on screen; it does not work offline. The tiles are drawn inside our three.js scene
// with 3DTilesRendererJS, the open-source renderer of NASA JPL (NASA-AMMOS).
//
// This file is only downloaded when a token is present. If anything fails, nothing changes:
// the Moon of the app (NASA SVS CGI Moon Kit) stays as it is.
import * as THREE from 'three'
import { TilesRenderer } from '3d-tiles-renderer'
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

const ASSET_ID = '2684829'
const R_MOON_M = 1737400

export type CesiumMoon = { update: () => void; dispose: () => void; setVisible: (v: boolean) => void; setHeat: (tex: THREE.Texture | null, capDeg: number) => void; setSun: (dir: THREE.Vector3) => void }

// Their tiles come unlit: the relief is already painted in the picture (LROC), shadows included.
// Shading it again with the Sun on their own normals made it far too dark: a dim lit half and a
// straight terminator from the Earth, a black polar cap with the Sun a degree or two up. So the
// picture keeps its own relief, and our Sun only says where it is day: the real Sun of the chosen
// date against each point of the lunar sphere, with a soft terminator. The sunlight heat map is laid
// over it the same way as on our own Moon.
const shared = {
  heatMap: { value: null as THREE.Texture | null },
  heatOn: { value: 0 },
  capDeg: { value: 25 },
  toMoon: { value: new THREE.Matrix4() }, // world -> Moon-fixed (unit sphere, north along +Y)
  sunDir: { value: new THREE.Vector3(1, 0, 0) }, // towards the Sun, Moon-fixed
}
function dayMaterial(old: THREE.Material): THREE.Material {
  const src = old as THREE.MeshBasicMaterial
  const m = new THREE.MeshBasicMaterial({ map: src.map ?? null, color: 0xffffff })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 toMoon;\nvarying vec3 vMoonPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMoonPos = (toMoon * modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D heatMap;\nuniform float heatOn;\nuniform float capDeg;\nuniform vec3 sunDir;\nvarying vec3 vMoonPos;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 p = normalize(vMoonPos);
        // Day and night from the Sun's height over this point's horizon: full light once it is a
        // few degrees up, a faint glow (earthshine) at night.
        float sunUp = dot(p, normalize(sunDir));
        diffuseColor.rgb *= mix(0.03, 1.0, smoothstep(-0.015, 0.06, sunUp));
        if (heatOn > 0.5) {
          float colat = degrees(acos(clamp(-p.y, -1.0, 1.0)));
          if (colat < capDeg) {
            float lon = atan(p.z, -p.x) - PI; // the same longitude as the scene's own Moon
            float r = colat / capDeg * 0.5;
            vec4 heat = texture2D(heatMap, vec2(0.5 + r * sin(lon), 0.5 + r * cos(lon)));
            diffuseColor.rgb *= mix(vec3(1.0), heat.rgb * 1.7 + 0.12, heat.a * 0.9);
            diffuseColor.rgb += heat.rgb * heat.a * 0.3;
          }
        }`,
      )
  }
  old.dispose()
  return m
}

/**
 * Adds the tiles to `parent` (the Moon group of the scene, unit sphere, north along +Y).
 * `onFirstTile` runs when the first piece of terrain is on screen, so the caller can hide its own
 * globe; until then, and if no tile ever arrives, the scene is untouched.
 */
export function attachCesiumMoon(o: { token: string; parent: THREE.Object3D; camera: THREE.Camera; renderer: THREE.WebGLRenderer; onFirstTile: () => void }): CesiumMoon {
  const tiles = new TilesRenderer()
  // Finer than the default (16 px of screen error per tile): sharper ground, more tiles.
  tiles.errorTarget = 6
  tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: o.token, assetId: ASSET_ID, autoRefreshToken: true }))
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: new DRACOLoader() }))
  tiles.setCamera(o.camera)
  tiles.setResolutionFromRenderer(o.camera, o.renderer)
  // The tiles are in metres, Moon-fixed, with Z to the north pole. The scene has the north along
  // +Y and longitude 0 along +X: (X, Y, Z) -> (X, Z, -Y), and metres -> Moon radii.
  tiles.group.rotation.x = -Math.PI / 2
  tiles.group.scale.setScalar(1 / R_MOON_M)
  o.parent.add(tiles.group)
  let first = true
  tiles.addEventListener('load-model', (e: { scene: THREE.Object3D }) => {
    e.scene.traverse((c) => {
      const mesh = c as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(dayMaterial) : dayMaterial(mesh.material)
      // They cast shadows on our polar cap; they do not receive them (their shadows are in the picture).
      mesh.castShadow = true
      mesh.receiveShadow = false
    })
    if (!first) return
    first = false
    o.onFirstTile()
  })
  return {
    setVisible: (v: boolean) => {
      tiles.group.visible = v
    },
    setSun: (dir) => {
      shared.sunDir.value.copy(dir)
    },
    setHeat: (tex, capDeg) => {
      shared.heatMap.value = tex
      shared.heatOn.value = tex ? 1 : 0
      shared.capDeg.value = capDeg
    },
    update: () => {
      if (!tiles.group.visible && !first) return // hidden: no more tiles are asked for
      shared.toMoon.value.copy(o.parent.matrixWorld).invert()
      tiles.setResolutionFromRenderer(o.camera, o.renderer)
      tiles.update()
    },
    dispose: () => {
      o.parent.remove(tiles.group)
      tiles.dispose()
    },
  }
}
