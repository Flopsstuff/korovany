import {
  Color3,
  MeshBuilder,
  type Mesh,
  type Scene,
  StandardMaterial,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core'
import { WORLD_SIZE } from '../game/world/gridSize'

/**
 * Side length of a zone's playable ground plane, in world units. Re-exported from
 * the Babylon-free {@link WORLD_SIZE} constant module (FLO-445) so the pure
 * map-prop builder can share it without importing this renderer. New zones should
 * size their ground from this constant rather than re-hardcoding a magic number.
 */
export { WORLD_SIZE }

/** Height of the perimeter walls, tall enough to read as a hard boundary. */
const WALL_HEIGHT = 10
/** Wall thickness; also the clamp inset so the capsule stops at the inner face. */
const WALL_THICKNESS = 4

/**
 * Ground tessellation (P7.4 / FLO-422). A single quad shades as one flat sheet,
 * which read as a "plain green gradient". A grid of facets, each flat-shaded and
 * tinted with a small deterministic brightness jitter, gives the v1.2 low-poly
 * faceted look. ~12.5 m facets on a 600 m plane read as ground texture from the
 * third-person camera without large colour blocks. The plane stays perfectly
 * flat (no vertex displacement) so the controller's ground ray is unaffected.
 */
const GROUND_SUBDIVISIONS = 48
/** Half-range of the per-facet brightness multiplier (1 ± this). */
const FACET_JITTER = 0.08

/**
 * White-noise hash of an integer grid cell → [0, 1). Integer bit-mixing (not a
 * `sin`-based hash, which aliases into visible diagonal bands for sequential
 * indices) so neighbouring facets differ unpredictably.
 */
function cellNoise(ix: number, iz: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

/**
 * Tint each quad of a flat-shaded ground a slightly different brightness so the
 * surface reads as faceted low-poly rather than a flat sheet (P7.4 / FLO-422).
 * The brightness is a deterministic white-noise hash of the quad's grid cell, so
 * both triangles of a quad share one tint (clean facets) and the pattern is
 * stable across reloads and unit-testable. Mutates `ground` in place; must run
 * after `convertToFlatShadedMesh` so each triangle owns three unique vertices.
 */
function applyFacetTint(ground: Mesh, size: number): void {
  ground.convertToFlatShadedMesh()
  const positions = ground.getVerticesData(VertexBuffer.PositionKind)
  if (!positions) return
  const half = size / 2
  const cell = size / GROUND_SUBDIVISIONS
  const triCount = positions.length / 3 / 3
  const colors = new Float32Array((positions.length / 3) * 4)
  for (let tri = 0; tri < triCount; tri++) {
    // Centroid of the triangle's three (flat-shaded, unique) vertices.
    let cx = 0
    let cz = 0
    for (let k = 0; k < 3; k++) {
      const p = (tri * 3 + k) * 3
      cx += positions[p]
      cz += positions[p + 2]
    }
    const ix = Math.floor((cx / 3 + half) / cell)
    const iz = Math.floor((cz / 3 + half) / cell)
    const brightness = 1 - FACET_JITTER + cellNoise(ix, iz) * (2 * FACET_JITTER)
    for (let k = 0; k < 3; k++) {
      const vi = (tri * 3 + k) * 4
      colors[vi] = brightness
      colors[vi + 1] = brightness
      colors[vi + 2] = brightness
      colors[vi + 3] = 1
    }
  }
  ground.setVerticesData(VertexBuffer.ColorKind, colors)
}

/** The ground + perimeter walls + a player-position clamp for one zone. */
export interface WorldBounds {
  /** The pickable ground plane (the controller's downward ray clamps onto it). */
  readonly ground: Mesh
  /** The four perimeter wall meshes forming the bounding box. */
  readonly walls: readonly Mesh[]
  /**
   * Clamp an x/z position to stay inside the perimeter walls. The character
   * controller has no horizontal collision (only a downward ground ray), so this
   * is what actually contains the player. Mutates and returns `position`.
   */
  clamp(position: Vector3): Vector3
}

/**
 * Build a zone's ground plane and a perimeter bounding box of four walls, and
 * return a `clamp` that keeps a position inside them. Shared by every zone scene
 * so world size and edge behaviour stay consistent (and grow from one constant).
 */
export function createWorldBounds(
  scene: Scene,
  groundColor: Color3,
  size: number = WORLD_SIZE,
): WorldBounds {
  const half = size / 2

  const ground = MeshBuilder.CreateGround(
    'ground',
    { width: size, height: size, subdivisions: GROUND_SUBDIVISIONS },
    scene,
  )
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = groundColor
  // Near-zero specular so the ground reads as a matte flat-shaded low-poly
  // surface (v1.2) rather than a plasticky lit plane — matches the prop palette.
  groundMat.specularColor = new Color3(0.02, 0.02, 0.02)
  ground.material = groundMat
  ground.isPickable = true
  applyFacetTint(ground, size)

  const wallMat = new StandardMaterial('wallMat', scene)
  wallMat.diffuseColor = new Color3(0.18, 0.16, 0.14)

  // [name, x, z, width, depth] — N/S walls span the full width, E/W the depth.
  const wallSpecs: readonly [string, number, number, number, number][] = [
    ['wall-n', 0, half, size, WALL_THICKNESS],
    ['wall-s', 0, -half, size, WALL_THICKNESS],
    ['wall-e', half, 0, WALL_THICKNESS, size],
    ['wall-w', -half, 0, WALL_THICKNESS, size],
  ]
  const walls = wallSpecs.map(([name, x, z, width, depth]) => {
    const wall = MeshBuilder.CreateBox(name, { width, depth, height: WALL_HEIGHT }, scene)
    wall.position = new Vector3(x, WALL_HEIGHT / 2, z)
    wall.material = wallMat
    wall.isPickable = false // not ground; the controller ray must ignore it
    return wall
  })

  // Stop the capsule at the inner face of the walls.
  const limit = half - WALL_THICKNESS / 2
  const clamp = (position: Vector3): Vector3 => {
    position.x = Math.min(limit, Math.max(-limit, position.x))
    position.z = Math.min(limit, Math.max(-limit, position.z))
    return position
  }

  return { ground, walls, clamp }
}
