import {
  Color3,
  Matrix,
  type Mesh,
  MeshBuilder,
  Quaternion,
  type Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import {
  buildMapProps,
  type BuildMapPropsOptions,
  type MapPropSpec,
  type PropShape,
  type ZoneMapGrid,
} from '../game/world/mapProps'

/**
 * Render the greybox map props for a zone (FLO-445). Groups the resolved
 * {@link MapPropSpec}s by legend symbol and draws each group as a single
 * thin-instanced mesh, so an entire populated 20×20 map costs roughly one draw
 * call per symbol (~a dozen) rather than one per cell (*budgets are real*). When a
 * real model lands for a symbol, swap that group's base mesh for a streamed GLB —
 * the {@link MapPropSpec} placement data is unchanged.
 *
 * Props are non-pickable so the controller's downward ground ray ignores them and
 * the capsule passes through (the controller has no horizontal collision; the
 * spawn-clear radius in `buildMapProps` keeps the spawn point itself open).
 *
 * Returns a {@link TransformNode} root parenting every base mesh + material, so a
 * scene tears the whole map down with a single `root.dispose(false, true)`.
 */
export function renderMapProps(
  scene: Scene,
  grid: ZoneMapGrid,
  options: BuildMapPropsOptions = {},
): TransformNode {
  const root = new TransformNode('map-props', scene)
  const specs = buildMapProps(grid, options)

  // Bucket by legend symbol — each bucket shares one base mesh + material.
  const byKind = new Map<string, MapPropSpec[]>()
  for (const spec of specs) {
    const bucket = byKind.get(spec.kind)
    if (bucket) bucket.push(spec)
    else byKind.set(spec.kind, [spec])
  }

  for (const [kind, group] of byKind) {
    const sample = group[0]
    const base = createUnitMesh(scene, `map-prop:${kind}`, sample.shape)
    base.parent = root
    base.isPickable = false

    const mat = new StandardMaterial(`map-prop-mat:${kind}`, scene)
    mat.diffuseColor = new Color3(sample.color.r, sample.color.g, sample.color.b)
    // Near-zero specular to match the matte low-poly prop palette (v1.2).
    mat.specularColor = new Color3(0.04, 0.04, 0.04)
    base.material = mat

    // One 4×4 matrix per instance: scale the unit mesh to the prop's footprint /
    // height, rotate by its heading, and lift it so its base sits on the ground.
    const matrices = new Float32Array(group.length * 16)
    group.forEach((spec, i) => {
      const scaling = new Vector3(spec.size, spec.height, spec.size)
      const rotation = Quaternion.RotationYawPitchRoll(spec.yaw, 0, 0)
      const translation = new Vector3(spec.x, spec.height / 2, spec.z)
      Matrix.Compose(scaling, rotation, translation).copyToArray(matrices, i * 16)
    })
    base.thinInstanceSetBuffer('matrix', matrices, 16, true)
  }

  return root
}

/**
 * A unit-sized (≈1×1×1, base-centred) low-poly mesh for a prop shape. The
 * instance matrix scales it to the real footprint/height, so one base mesh serves
 * every instance of a symbol. Low tessellation keeps the v1.2 faceted look.
 */
function createUnitMesh(scene: Scene, name: string, shape: PropShape): Mesh {
  switch (shape) {
    case 'box':
    case 'slab':
      return MeshBuilder.CreateBox(name, { size: 1 }, scene)
    case 'cylinder':
      return MeshBuilder.CreateCylinder(name, { height: 1, diameter: 1, tessellation: 8 }, scene)
    case 'cone':
      return MeshBuilder.CreateCylinder(
        name,
        { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 7 },
        scene,
      )
    case 'sphere':
      return MeshBuilder.CreateSphere(name, { diameter: 1, segments: 4 }, scene)
  }
}
