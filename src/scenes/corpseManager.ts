/**
 * Babylon-side corpse spawner (E2.4 / FLO-315).
 *
 * Owns every corpse VISUAL in a zone. On enemy death the scene calls
 * `registerDeath()`, which:
 *   1. records the corpse in the session store (capped, FIFO — see corpseModel),
 *   2. spawns a static "downed" mesh reusing the soldier GLB (no physics — a
 *      toppled capsule + grounded GLB child, matching the E2.3 kill read), and
 *   3. disposes the meshes of any records the cap evicted.
 *
 * On construction it re-spawns the corpses the store already holds for this
 * zone, so corpses survive a zone re-enter within the session. Corpse meshes are
 * non-pickable and have collisions off, so they never act or get hit as a live
 * enemy — they are inert scenery.
 */
import {
  type AbstractMesh,
  Color3,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { Vec3 } from '../game/combat'
import {
  type CorpseRecord,
  type CorpseStore,
  sessionCorpseStore,
} from '../game/corpses'
import { DEFAULT_SOLDIER_GLB } from './soldierEnemy'

export interface CorpseManagerOptions {
  /** Zone these corpses belong to; gates re-spawn on re-enter. */
  zoneId: string
  /** Session store to read/write. Defaults to the shared session singleton. */
  store?: CorpseStore
  /**
   * Soldier GLB to mount on each corpse; `null` keeps the bare toppled capsule
   * (used by headless tests to skip the async fetch). Defaults to the soldier.
   */
  glbUrl?: string | null
}

const CORPSE_COLOR = new Color3(0.3, 0.3, 0.3)
/** Capsule radius — the body rests this high off the ground when toppled. */
const CORPSE_REST_Y = 0.35

export class CorpseManager {
  private readonly scene: Scene
  private readonly zoneId: string
  private readonly store: CorpseStore
  private readonly glbUrl: string | null
  private readonly meshes = new Map<string, AbstractMesh>()

  constructor(scene: Scene, options: CorpseManagerOptions) {
    this.scene = scene
    this.zoneId = options.zoneId
    this.store = options.store ?? sessionCorpseStore
    this.glbUrl = options.glbUrl === undefined ? DEFAULT_SOLDIER_GLB : options.glbUrl

    // Re-spawn corpses recorded before this scene was (re)built.
    for (const rec of this.store.forZone(this.zoneId)) this.spawnMesh(rec)
  }

  /** Convert an enemy death into a persistent corpse. Returns the new record. */
  registerDeath(position: Vec3, rotationY: number): CorpseRecord {
    const { corpse, evicted } = this.store.record(this.zoneId, position, rotationY)
    this.spawnMesh(corpse)
    for (const ev of evicted) {
      const mesh = this.meshes.get(ev.id)
      if (mesh) {
        mesh.dispose()
        this.meshes.delete(ev.id)
      }
    }
    return corpse
  }

  /** Live corpse-mesh count in this scene (for tests / debugging). */
  get count(): number {
    return this.meshes.size
  }

  private spawnMesh(rec: CorpseRecord): void {
    const mesh = MeshBuilder.CreateCapsule(
      `corpse:${rec.id}`,
      { radius: 0.35, height: 1.8 },
      this.scene,
    )
    // Lie the body on its side, resting on the ground, facing where it fell.
    mesh.position = new Vector3(rec.position.x, CORPSE_REST_Y, rec.position.z)
    mesh.rotation = new Vector3(0, rec.rotationY, Math.PI / 2)
    mesh.isPickable = false
    mesh.checkCollisions = false

    const mat = new StandardMaterial(`corpseMat:${rec.id}`, this.scene)
    mat.diffuseColor = CORPSE_COLOR
    mesh.material = mat

    // Mount the soldier GLB as a child (best-effort — the toppled capsule is the
    // fallback if the fetch fails, e.g. in headless tests).
    if (this.glbUrl) {
      void import('./modelLoader')
        .then(({ loadModel }) =>
          loadModel(this.scene, this.glbUrl as string, { targetSize: 1.8, groundIt: true }).then(
            (model) => {
              if (mesh.isDisposed()) {
                model.root.dispose()
                return
              }
              model.root.parent = mesh
              model.root.position = new Vector3(0, -0.9, 0)
              for (const m of model.meshes) m.isPickable = false
              mesh.isVisible = false // hide the placeholder capsule
            },
          ),
        )
        .catch(() => {
          /* keep the toppled capsule placeholder visible */
        })
    }

    this.meshes.set(rec.id, mesh)
  }

  /**
   * Dispose the corpse meshes for this scene. The store records are deliberately
   * RETAINED so the corpses re-spawn when the zone is re-entered this session.
   */
  dispose(): void {
    for (const mesh of this.meshes.values()) mesh.dispose()
    this.meshes.clear()
  }
}
