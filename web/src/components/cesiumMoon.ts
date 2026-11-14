// EXPERIMENTAL, NOT YET TESTED WITH A REAL TOKEN: optional high-detail Moon from Cesium ion.
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

export type CesiumMoon = { update: () => void; dispose: () => void }

/**
 * Adds the tiles to `parent` (the Moon group of the scene, unit sphere, north along +Y).
 * `onFirstTile` runs when the first piece of terrain is on screen, so the caller can hide its own
 * globe; until then, and if no tile ever arrives, the scene is untouched.
 */
export function attachCesiumMoon(o: { token: string; parent: THREE.Object3D; camera: THREE.Camera; renderer: THREE.WebGLRenderer; onFirstTile: () => void }): CesiumMoon {
  const tiles = new TilesRenderer()
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
  tiles.addEventListener('load-model', () => {
    if (!first) return
    first = false
    o.onFirstTile()
  })
  return {
    update: () => {
      tiles.setResolutionFromRenderer(o.camera, o.renderer)
      tiles.update()
    },
    dispose: () => {
      o.parent.remove(tiles.group)
      tiles.dispose()
    },
  }
}
