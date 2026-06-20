import { Color3, MeshBuilder, type Mesh, type Scene, StandardMaterial, Vector3 } from '@babylonjs/core'

/**
 * Side length of a zone's playable ground plane, in world units. The Phase-3
 * zones shipped a cramped 60×60 clearing; per board feedback (FLO-357 →
 * FLO-368) the world is scaled **10× per axis** (100× area) so it no longer
 * reads as a tiny empty box. New zones should size their ground from this
 * constant rather than re-hardcoding a magic number.
 */
export const WORLD_SIZE = 600

/** Height of the perimeter walls, tall enough to read as a hard boundary. */
const WALL_HEIGHT = 10
/** Wall thickness; also the clamp inset so the capsule stops at the inner face. */
const WALL_THICKNESS = 4

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

  const ground = MeshBuilder.CreateGround('ground', { width: size, height: size }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = groundColor
  ground.material = groundMat
  ground.isPickable = true

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
