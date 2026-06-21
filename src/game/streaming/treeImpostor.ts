import {
  type AbstractMesh,
  Camera,
  Color3,
  Color4,
  FreeCamera,
  Material,
  Mesh,
  MeshBuilder,
  RenderTargetTexture,
  type Scene,
  StandardMaterial,
  type Texture,
  Vector3,
} from '@babylonjs/core'

/**
 * Tree impostors — billboard LOD for distant trees (E5.1/E5.2, FLO-394/393).
 *
 * A full forest tree GLB (`forest-tree.glb`, ~1357 tris) is expensive to draw
 * hundreds of times. Past a distance threshold the silhouette is all the eye
 * resolves, so we swap each distant tree for a single camera-facing **billboard
 * plane** (2 tris) carrying a flat snapshot of the tree — an *impostor*.
 *
 * Mechanism — Babylon's native per-mesh LOD (`mesh.addLODLevel`): the impostor
 * plane is registered as the tree's far LOD level, so the engine swaps to it
 * automatically by camera distance. No per-frame loop, and a mesh used as an LOD
 * level is "linked" — Babylon never renders it independently, so there is no
 * double-draw. Instances of an LOD-equipped mesh inherit its LOD levels, so this
 * layer stays compatible with the thin-instance forest (E5.3).
 *
 * Anti-pop hysteresis (E5.2, FLO-393) — a single-distance swap flickers when the
 * camera hovers right on the threshold. We wrap the source meshes' `getLOD` with
 * a small stateful dead-zone: the full→impostor swap fires at
 * `swapDistance + hysteresisBand` and only swaps back at
 * `swapDistance - hysteresisBand`, so the state can't oscillate inside the band.
 * The engine already calls `getLOD` once per mesh per frame during active-mesh
 * evaluation, so this stays loop-free and per-instance — no second LOD system.
 * Sibling meshes share the primary's resolved state so the whole tree swaps
 * coherently (the trunk never culls a few units before the canopy billboards).
 *
 * Texture — a one-time orthographic side-snapshot of the GLB into a
 * `RenderTargetTexture` at scene boot: no offline build step, alpha preserved. A
 * pre-baked atlas can be injected via `options.texture` instead.
 *
 * Out of scope (later tickets): thin-instancing the whole forest (E5.3).
 */

/** Default camera distance (scene units) beyond which trees become impostors. */
export const DEFAULT_IMPOSTOR_SWAP_DISTANCE = 35

/**
 * Default half-width (scene units) of the hysteresis dead-zone around the swap
 * distance. The full→impostor swap fires at `swapDistance + band` and the
 * impostor→full swap back at `swapDistance - band`, so a camera lingering near
 * the boundary can't flicker between the two (E5.2, FLO-393).
 */
export const DEFAULT_HYSTERESIS_BAND = 5

/** Default square resolution of the baked impostor snapshot, in pixels. */
const DEFAULT_TEXTURE_SIZE = 256

export interface TreeImpostorOptions {
  /** Distance beyond which the billboard replaces the full mesh. Default 35. */
  swapDistance?: number
  /**
   * Distance beyond which even the impostor is culled (renders nothing). `0`
   * (default) keeps impostors visible at any distance.
   */
  cullDistance?: number
  /**
   * Half-width (scene units) of the anti-pop hysteresis dead-zone around
   * `swapDistance` (and `cullDistance`, when set). `0` disables hysteresis for a
   * hard single-distance cut. Default {@link DEFAULT_HYSTERESIS_BAND}. Clamped so
   * the inner edge never crosses 0 or the cull boundary.
   */
  hysteresisBand?: number
  /** Pixel size of the baked snapshot. Ignored when `texture` is supplied. */
  textureSize?: number
  /**
   * Pre-baked / injected impostor texture. When omitted, an orthographic side
   * snapshot of the model is baked once. Pass a shared texture to reuse one bake
   * across many trees of the same species.
   */
  texture?: Texture | null
}

export interface TreeImpostor {
  /** The billboard plane that stands in for the tree past `swapDistance`. */
  readonly plane: Mesh
  /** The LOD swap distance actually applied. */
  readonly swapDistance: number
  /** Detach the LOD levels and dispose the plane (+ baked texture, if owned). */
  dispose: () => void
}

/** Geometry-bearing meshes only — skip the GLB's empty transform roots. */
function geometryMeshes(meshes: readonly AbstractMesh[]): Mesh[] {
  return meshes.filter(
    (m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0,
  )
}

/** Combined world-space AABB of a set of meshes. */
function combinedWorldBounds(meshes: readonly AbstractMesh[]): {
  min: Vector3
  max: Vector3
} {
  let min = new Vector3(Infinity, Infinity, Infinity)
  let max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const m of meshes) {
    m.computeWorldMatrix(true)
    const box = m.getBoundingInfo().boundingBox
    min = Vector3.Minimize(min, box.minimumWorld)
    max = Vector3.Maximize(max, box.maximumWorld)
  }
  return { min, max }
}

/**
 * Render one orthographic side view of `sources` into a {@link RenderTargetTexture}
 * sized to the model's silhouette. Returns `null` if the engine cannot render to
 * a texture (e.g. the headless `NullEngine`), in which case the impostor falls
 * back to a flat-coloured plane.
 */
function bakeSideSnapshot(
  scene: Scene,
  sources: readonly Mesh[],
  bounds: { min: Vector3; max: Vector3 },
  size: number,
): Texture | null {
  const { min, max } = bounds
  const centerX = (min.x + max.x) / 2
  const centerY = (min.y + max.y) / 2
  const centerZ = (min.z + max.z) / 2
  const width = Math.max(max.x - min.x, max.z - min.z)
  const height = max.y - min.y

  const previousCamera = scene.activeCamera
  let cam: FreeCamera | null = null
  try {
    const rtt = new RenderTargetTexture('tree-impostor-rtt', size, scene, false)
    rtt.clearColor = new Color4(0, 0, 0, 0)
    for (const m of sources) rtt.renderList?.push(m)

    // Look down +X at the model's centre; ortho frustum framed to its extent so
    // the silhouette fills the texture without perspective foreshortening.
    const distance = Math.max(width, height, 1) * 2
    cam = new FreeCamera(
      'tree-impostor-cam',
      new Vector3(centerX + distance, centerY, centerZ),
      scene,
    )
    cam.setTarget(new Vector3(centerX, centerY, centerZ))
    cam.mode = Camera.ORTHOGRAPHIC_CAMERA
    cam.orthoLeft = -width / 2
    cam.orthoRight = width / 2
    cam.orthoTop = height / 2
    cam.orthoBottom = -height / 2
    rtt.activeCamera = cam

    // One-shot bake — render once, then the framebuffer is sampled as a static
    // texture (it is never added to `customRenderTargets`, so it never refreshes).
    rtt.render()
    return rtt
  } catch {
    return null
  } finally {
    cam?.dispose()
    scene.activeCamera = previousCamera
  }
}

/**
 * Attach a billboard impostor as the far LOD level of a loaded tree model.
 *
 * @param scene       The Babylon scene the model lives in.
 * @param modelMeshes The model's meshes (e.g. `LoadedModel.meshes`). Empty
 *                    transform roots are ignored; the most-detailed mesh carries
 *                    the impostor and any sibling meshes cull at the same range.
 * @param options     Swap/cull distances, texture size, or an injected texture.
 */
export function attachTreeImpostor(
  scene: Scene,
  modelMeshes: readonly AbstractMesh[],
  options: TreeImpostorOptions = {},
): TreeImpostor {
  const {
    swapDistance = DEFAULT_IMPOSTOR_SWAP_DISTANCE,
    cullDistance = 0,
    hysteresisBand = DEFAULT_HYSTERESIS_BAND,
    textureSize = DEFAULT_TEXTURE_SIZE,
    texture,
  } = options

  const sources = geometryMeshes(modelMeshes)
  if (sources.length === 0) {
    throw new Error(
      'attachTreeImpostor: model has no geometry meshes to build an impostor from',
    )
  }

  const { min, max } = combinedWorldBounds(sources)
  const width = Math.max(max.x - min.x, max.z - min.z)
  const height = max.y - min.y

  // Billboard plane sized to the tree silhouette, centred on the trunk and lifted
  // so its base sits at the model's foot (min.y). BILLBOARDMODE_Y keeps trees
  // upright while spinning to face the camera around the vertical axis.
  const plane = MeshBuilder.CreatePlane(
    'tree-impostor',
    { width: width || 1, height: height || 1 },
    scene,
  )
  plane.position.set((min.x + max.x) / 2, min.y + height / 2, (min.z + max.z) / 2)
  plane.billboardMode = Mesh.BILLBOARDMODE_Y
  plane.isPickable = false

  const ownsTexture = !texture
  const baked = texture ?? bakeSideSnapshot(scene, sources, { min, max }, textureSize)

  const material = new StandardMaterial('tree-impostor-mat', scene)
  material.backFaceCulling = false
  material.disableLighting = true // flat-lit: show the baked snapshot as authored
  material.emissiveColor = Color3.White()
  if (baked) {
    baked.hasAlpha = true
    material.diffuseTexture = baked
    material.useAlphaFromDiffuseTexture = true
    material.transparencyMode = Material.MATERIAL_ALPHATEST
    material.alphaCutOff = 0.4
  } else {
    // No bake available (headless) — a muted green stand-in keeps the LOD wiring
    // valid and testable without a GL context.
    material.emissiveColor = new Color3(0.16, 0.3, 0.12)
  }
  plane.material = material

  // The most-detailed mesh carries the impostor LOD; sibling meshes (e.g. a
  // separate trunk submesh) cull at the same distance so the far tree is exactly
  // one billboard, never a billboard layered over leftover geometry.
  const primary = sources.reduce((a, b) =>
    b.getTotalVertices() > a.getTotalVertices() ? b : a,
  )
  const siblings = sources.filter((m) => m !== primary)
  // Register the native LOD levels. Even though the hysteresis wrapper below
  // computes the swap itself, the `addLODLevel(_, plane)` registration is what
  // *links* the plane to the primary so Babylon never renders it independently
  // (no double-draw); the registered distances become the wrapper's centre.
  primary.addLODLevel(swapDistance, plane)
  for (const m of siblings) m.addLODLevel(swapDistance, null)
  if (cullDistance > 0) primary.addLODLevel(cullDistance, null)

  const restoreHysteresis = installLODHysteresis(
    primary,
    plane,
    siblings,
    swapDistance,
    cullDistance,
    hysteresisBand,
  )

  let disposed = false
  return {
    plane,
    swapDistance,
    dispose() {
      if (disposed) return
      disposed = true
      restoreHysteresis()
      primary.removeLODLevel(plane)
      primary.removeLODLevel(null)
      for (const m of sources) m.removeLODLevel(null)
      material.dispose()
      if (ownsTexture) baked?.dispose()
      plane.dispose()
    },
  }
}

/** A mesh whose `getLOD` override we can restore by deleting the own property. */
type LODOverridable = { getLOD?: Mesh['getLOD'] }

/**
 * Wrap the source meshes' `getLOD` with a stateful hysteresis dead-zone so the
 * mesh↔billboard swap can't flicker when the camera lingers near `swapDistance`
 * (E5.2, FLO-393).
 *
 * Babylon calls `getLOD(camera)` on every active mesh each frame, so the wrapper
 * needs no loop of its own. The full→impostor swap fires at `swapDistance + band`
 * and only reverts at `swapDistance - band`; the optional cull boundary gets the
 * same treatment. All source meshes of one tree share a single state object —
 * distance is always measured from the *primary*'s bounding sphere — so the
 * canopy billboard and the trunk cull in lockstep instead of a few units apart.
 *
 * Returns a function that detaches the overrides (restoring Babylon's native
 * `getLOD`); call it before `removeLODLevel` on dispose.
 */
function installLODHysteresis(
  primary: Mesh,
  plane: Mesh,
  siblings: readonly Mesh[],
  swapDistance: number,
  cullDistance: number,
  band: number,
): () => void {
  const clamped = Math.max(0, band)
  // Outer edges fire a transition to a coarser LOD; inner edges revert.
  const swapFar = swapDistance + clamped // full → impostor (moving away)
  const swapNear = Math.max(0, swapDistance - clamped) // impostor → full (moving in)
  const culls = cullDistance > 0
  const cullFar = cullDistance + clamped // impostor → culled
  const cullNear = Math.max(swapFar, cullDistance - clamped) // culled → impostor

  type State = 'full' | 'impostor' | 'culled'
  let state: State = 'full'

  /**
   * Advance the shared state for the camera's current distance and return it.
   * Outward transitions are resolved before inward ones, so a single call
   * settles even on a large camera jump, and the dead-zone is never skipped.
   */
  const resolve = (camera: Camera): State => {
    const { centerWorld } = primary.getBoundingInfo().boundingSphere
    const d = Vector3.Distance(centerWorld, camera.globalPosition)
    if (state === 'full' && d > swapFar) state = 'impostor'
    if (state === 'impostor' && culls && d > cullFar) state = 'culled'
    if (state === 'culled' && d < cullNear) state = 'impostor'
    if (state === 'impostor' && d < swapNear) state = 'full'
    return state
  }

  ;(primary as Mesh & LODOverridable).getLOD = (camera) => {
    const s = resolve(camera)
    return s === 'full' ? primary : s === 'impostor' ? plane : null
  }
  for (const sib of siblings) {
    ;(sib as Mesh & LODOverridable).getLOD = (camera) =>
      resolve(camera) === 'full' ? sib : null
  }

  return () => {
    delete (primary as LODOverridable).getLOD
    for (const sib of siblings) delete (sib as LODOverridable).getLOD
  }
}

export interface LODRenderStats {
  /** How many meshes actually render at the camera's current distance. */
  meshes: number
  /** Total triangles those meshes contribute. */
  triangles: number
}

/**
 * Count the meshes + triangles a set of LOD-equipped source meshes renders at a
 * camera's current position, resolving each through its LOD chain (full mesh →
 * impostor → culled). Pure CPU — no draw — so it yields deterministic before/
 * after numbers under `NullEngine`, which is how the impostor benchmark measures
 * triangle reduction.
 *
 * Pass only the tree *source* meshes; their impostor planes are linked LOD
 * levels and are counted via the source's `getLOD`, never on their own.
 */
export function measureLODRender(
  sources: readonly AbstractMesh[],
  camera: Camera,
): LODRenderStats {
  let meshes = 0
  let triangles = 0
  for (const m of sources) {
    const lod = m instanceof Mesh ? m.getLOD(camera) : m
    if (!lod || !lod.isEnabled()) continue
    meshes += 1
    triangles += lod.getTotalIndices() / 3
  }
  return { meshes, triangles }
}
