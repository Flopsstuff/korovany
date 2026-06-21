/**
 * Thin Babylon wrapper for a wandering caravan (E3.3 — "грабить корованы").
 *
 * The pure behaviour is in `src/game/ai/caravanFSM.ts`. This class wires it to a
 * scene mesh + the fixed-step loop's Updatable interface, and implements
 * Damageable so the player's existing E2 melee sweep can defeat it. A caravan is
 * a non-combatant loot piñata: it follows a looping path, flees when ambushed,
 * and on defeat rolls a loot table and emits the drop via `onLooted` — the
 * reward event the E3.4 inventory will consume. Nothing here knows about the
 * inventory; the caller decides what to do with the drop.
 */
import {
  type AbstractMesh,
  Color3,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  type TransformNode,
  Vector3,
} from '@babylonjs/core'
import type { Damageable, Vec3 } from '../game/combat'
import {
  applyDamageToCaravan,
  createCaravanFSM,
  DEFAULT_CARAVAN_PARAMS,
  stepCaravanFSM,
  type CaravanFSMParams,
  type CaravanFSMState,
  type Waypoint,
} from '../game/ai'
import { DEFAULT_CARAVAN_LOOT, rollLoot, type LootDrop, type LootTable } from '../game/loot'
import { createSeededRng, seedFromString } from '../game/util'
import { flatShade } from '../game/util'
import type { System } from '../game/loop'
import { loadModel, type LoadedModel } from './modelLoader'

export const DEFAULT_CARAVAN_WAGON_GLB = '/models/caravan-wagon.glb'

type CaravanVisualLoadFn = (
  scene: Scene,
  url: string,
  options: { targetSize: number; groundIt: boolean; yaw: number },
) => Promise<LoadedModel>

export interface CaravanEnemyOptions {
  spawn: Vector3
  /** Looping wander path (world XZ). Defaults to a small square around `spawn`. */
  path?: Waypoint[]
  params?: CaravanFSMParams
  /** Supplier for the player's current world position — read each tick. */
  getPlayerPos: () => Vector3
  /**
   * Fired exactly once when the caravan is defeated, with the rolled loot. The
   * caller dispatches it into the inventory (E3.4); this class stays decoupled.
   */
  onLooted?: (drop: LootDrop) => void
  /** Fired exactly once when the caravan dies, before loot is adapted by callers. */
  onDefeated?: () => void
  /** Loot table rolled on defeat. Defaults to {@link DEFAULT_CARAVAN_LOOT}. */
  lootTable?: LootTable
  /**
   * Deterministic seed for the loot roll. Defaults to one derived from the spawn
   * position so distinct caravans drop distinct (but reproducible) hauls.
   */
  lootSeed?: number
  /** Wagon GLB mounted as the visible body. `null` keeps the procedural box. */
  visualUrl?: string | null
  /** Test seam for the async GLB load path. */
  loadVisual?: CaravanVisualLoadFn
}

/** Build a default square wander loop centred on `spawn`. */
function defaultPathAround(spawn: Vector3, half = 8): Waypoint[] {
  const { x, z } = spawn
  return [
    { x: x - half, z: z - half },
    { x: x + half, z: z - half },
    { x: x + half, z: z + half },
    { x: x - half, z: z + half },
  ]
}

export class CaravanEnemy implements System, Damageable {
  readonly mesh: AbstractMesh
  private fsm: CaravanFSMState
  private readonly params: CaravanFSMParams
  private readonly path: Waypoint[]
  private readonly getPlayerPos: () => Vector3
  private readonly onLooted?: (drop: LootDrop) => void
  private readonly onDefeated?: () => void
  private readonly lootTable: LootTable
  private readonly lootSeed: number
  private visualRoot: TransformNode | null = null
  private disposed = false
  /** The drop rolled on defeat — exposed for smoke tests / inspection. */
  loot: LootDrop | null = null

  get position(): Vec3 {
    return { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z }
  }

  constructor(scene: Scene, options: CaravanEnemyOptions) {
    this.params = options.params ?? DEFAULT_CARAVAN_PARAMS
    this.path = options.path ?? defaultPathAround(options.spawn)
    this.getPlayerPos = options.getPlayerPos
    this.onLooted = options.onLooted
    this.onDefeated = options.onDefeated
    this.lootTable = options.lootTable ?? DEFAULT_CARAVAN_LOOT
    this.lootSeed =
      options.lootSeed ?? seedFromString(`${options.spawn.x},${options.spawn.z}`)
    this.fsm = createCaravanFSM(this.params)

    // Gameplay proxy: keeps collision/position/FSM stable while the GLB visual
    // loads asynchronously as a child. It remains the Damageable target.
    this.mesh = MeshBuilder.CreateBox('caravan', { width: 1.6, height: 1.2, depth: 2.4 }, scene)
    this.mesh.position = options.spawn.clone()
    this.mesh.isPickable = false

    const mat = new StandardMaterial('caravanMat', scene)
    mat.diffuseColor = new Color3(0.55, 0.4, 0.2) // weathered wood
    this.mesh.material = mat

    const visualUrl = options.visualUrl === undefined ? DEFAULT_CARAVAN_WAGON_GLB : options.visualUrl
    if (visualUrl !== null) {
      const loadVisual = options.loadVisual ?? loadModel
      void loadVisual(scene, visualUrl, { targetSize: 2.8, groundIt: true, yaw: Math.PI / 2 })
        .then((model) => {
          if (this.disposed) {
            model.root.dispose(false, true)
            return
          }
          flatShade(model.meshes)
          model.root.parent = this.mesh
          model.root.position = new Vector3(0, -0.6, 0)
          this.visualRoot = model.root
          this.mesh.visibility = 0
        })
        .catch(() => {
          // Keep the box proxy visible as a graceful fallback if the GLB fails.
        })
    }
  }

  /** Damageable — called by the melee hit sweep when the player strikes. */
  takeDamage(amount: number): void {
    if (this.fsm.phase === 'dead') return
    this.fsm = applyDamageToCaravan(this.fsm, amount)
    if (this.fsm.phase === 'dead') {
      this.onDefeated?.()
      // Roll the haul once and emit the reward event (E3.4 consumes it).
      this.loot = rollLoot(this.lootTable, createSeededRng(this.lootSeed))
      this.onLooted?.(this.loot)

      // Topple in place so the kill reads clearly; we deliberately leave the
      // wreck rather than despawn it.
      this.mesh.rotation.z = Math.PI / 6
      const mat = this.mesh.material as StandardMaterial | null
      if (mat) mat.diffuseColor = new Color3(0.3, 0.25, 0.15)
    }
  }

  /** System — driven by FixedStepLoop. */
  update(dt: number, _world: unknown): void {
    if (this.fsm.phase === 'dead') return

    const playerPos = this.getPlayerPos()
    const result = stepCaravanFSM(
      this.fsm,
      this.position,
      playerPos as unknown as Vec3,
      dt,
      this.params,
      this.path,
    )
    this.fsm = result.state

    this.mesh.position.x += result.moveDX
    this.mesh.position.z += result.moveDZ

    // Face the travel direction.
    if (Math.abs(result.moveDX) + Math.abs(result.moveDZ) > 1e-4) {
      this.mesh.rotation.y = Math.atan2(result.moveDX, result.moveDZ)
    }
  }

  get phase(): CaravanFSMState['phase'] {
    return this.fsm.phase
  }

  isDead(): boolean {
    return this.fsm.phase === 'dead'
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.visualRoot?.dispose(false, true)
    this.mesh.dispose()
  }
}
