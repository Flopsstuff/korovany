import '@babylonjs/loaders/glTF'
import {
  type AbstractMesh,
  type Scene,
  SceneLoader,
  TransformNode,
  Vector3,
} from '@babylonjs/core'

/**
 * GLB/glTF model loader for the korovany Babylon scenes.
 *
 * Loads a web-ready GLB (the default export of the `meshy-3d` skill) and
 * normalizes it on import so assets from different sources drop into a scene at
 * a predictable size and position. The `@babylonjs/loaders/glTF` side-effect
 * import above registers the glTF/GLB plugin — without it `ImportMeshAsync`
 * cannot resolve the `.glb` extension.
 *
 * Coordinate handedness: glTF is right-handed / Y-up; Babylon is left-handed.
 * The glTF loader already inserts its own conversion node, so we deliberately do
 * NOT re-flip anything here — we only normalize scale, recenter, and (optionally)
 * apply a yaw. See docs/decisions/0001-asset-hosting.md for the import contract.
 */

export interface LoadModelOptions {
  /** Longest bounding-box dimension after normalization, in scene units. Default 2. */
  targetSize?: number
  /**
   * `true` (default): sit the model on the ground plane (its lowest point at y=0).
   * `false`: center the model's bounding box on the origin.
   */
  groundIt?: boolean
  /** Yaw applied to the loaded root, in radians. Default 0. */
  yaw?: number
}

export interface LoadedModel {
  /** Parent node holding the normalized model — position/parent this, not the raw meshes. */
  root: TransformNode
  /** The raw meshes returned by the loader (root mesh first). */
  meshes: AbstractMesh[]
}

/**
 * Uniform scale that makes the largest bounding-box extent equal `targetSize`.
 * Pure function — no engine state — so it is unit-testable without a GL context.
 */
export function fitScale(min: Vector3, max: Vector3, targetSize: number): number {
  const extent = Math.max(max.x - min.x, max.y - min.y, max.z - min.z)
  return extent > 1e-6 ? targetSize / extent : 1
}

/**
 * Root position (in parent space, i.e. after `scale` is applied) that recenters the
 * model on the X/Z origin and either grounds it (lowest point -> y=0) or centers it on Y.
 * Pure function — unit-testable without a GL context.
 */
export function recenterOffset(
  min: Vector3,
  max: Vector3,
  scale: number,
  groundIt: boolean,
): Vector3 {
  const cx = ((min.x + max.x) / 2) * scale
  const cz = ((min.z + max.z) / 2) * scale
  const y = groundIt ? min.y * scale : ((min.y + max.y) / 2) * scale
  return new Vector3(-cx, -y, -cz)
}

/**
 * Load a GLB/glTF model into `scene`, normalized under a single root node.
 *
 * @param url Full URL or path to the model, e.g. `/models/chest.glb` (served by
 *            Cloudflare Pages from `public/models/`).
 */
export async function loadModel(
  scene: Scene,
  url: string,
  opts: LoadModelOptions = {},
): Promise<LoadedModel> {
  const { targetSize = 2, groundIt = true, yaw = 0 } = opts

  // ImportMeshAsync resolves the loader plugin from the filename extension, so
  // split the URL into directory + filename rather than passing one blob.
  const lastSlash = url.lastIndexOf('/')
  const rootUrl = url.slice(0, lastSlash + 1)
  const filename = url.slice(lastSlash + 1)

  const result = await SceneLoader.ImportMeshAsync(null, rootUrl, filename, scene)

  const root = new TransformNode(`model:${filename}`, scene)
  for (const mesh of result.meshes) {
    // Re-parent only the top-level meshes; descendants follow their own parents.
    if (!mesh.parent) mesh.parent = root
  }
  root.computeWorldMatrix(true)

  const { min, max } = root.getHierarchyBoundingVectors(true)
  const scale = fitScale(min, max, targetSize)
  root.scaling = new Vector3(scale, scale, scale)
  root.position = recenterOffset(min, max, scale, groundIt)
  root.rotation = new Vector3(0, yaw, 0)

  return { root, meshes: result.meshes }
}
