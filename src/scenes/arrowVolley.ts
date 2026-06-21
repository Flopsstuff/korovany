/**
 * Babylon-side arrow projectile system (FLO-432).
 *
 * Owns the live arrows fired by ranged enemies in a zone. Archers call
 * {@link ArrowVolley.fire}; each frame `update()` advances the pure
 * {@link ProjectileField}, resolves contacts against the registered targets, and
 * funnels every hit through the *same* `Damageable.takeDamage` path the player's
 * melee uses — the target's own `takeDamage` fires the `damageEvents` juice
 * bridge (screen shake / hurt SFX), so no combat feedback is special-cased here.
 *
 * The field is capped (`MAX_LIVE_PROJECTILES`), so a thin mesh pool of that size
 * is allocated once and recycled — arrows never allocate per shot and the frame
 * cost is bounded no matter how fast the line fires.
 */
import {
  Color3,
  type Mesh,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { Damageable, Vec3 } from '../game/combat'
import {
  createProjectile,
  createProjectileField,
  DEFAULT_PROJECTILE_HIT_RADIUS,
  MAX_LIVE_PROJECTILES,
  type ProjectileField,
  spawnProjectile,
  stepProjectileField,
} from '../game/combat'
import type { System } from '../game/loop'

export interface ArrowVolleyOptions {
  /** Living targets arrows can hit (the player). Read each tick. */
  getTargets: () => readonly Damageable[]
  /** Contact radius (m). Defaults to {@link DEFAULT_PROJECTILE_HIT_RADIUS}. */
  hitRadius?: number
  /** Concurrent live-arrow cap. Defaults to {@link MAX_LIVE_PROJECTILES}. */
  cap?: number
}

const ARROW_COLOR = new Color3(0.85, 0.78, 0.55)

export class ArrowVolley implements System {
  private field: ProjectileField
  private readonly scene: Scene
  private readonly getTargets: () => readonly Damageable[]
  private readonly hitRadius: number
  private readonly pool: Mesh[] = []

  constructor(scene: Scene, options: ArrowVolleyOptions) {
    this.scene = scene
    this.getTargets = options.getTargets
    this.hitRadius = options.hitRadius ?? DEFAULT_PROJECTILE_HIT_RADIUS
    this.field = createProjectileField(options.cap ?? MAX_LIVE_PROJECTILES)
  }

  /** Live arrow count (tests / debugging). */
  get liveCount(): number {
    return this.field.projectiles.length
  }

  /** Loose an arrow from `origin` along `dir` (need not be normalised). */
  fire(origin: Vec3, dir: Vec3, damage: number, speed: number): void {
    this.field = spawnProjectile(
      this.field,
      createProjectile(origin, dir, { speed, damage }),
    )
  }

  /** System — driven by FixedStepLoop. Advances arrows + resolves hits. */
  update(dt: number, _world: unknown): void {
    const { field, impacts } = stepProjectileField(
      this.field,
      dt,
      this.getTargets(),
      this.hitRadius,
    )
    this.field = field
    // Route every hit through the shared damage funnel — the target's takeDamage
    // applies HP loss + the damageEvents juice (mirrors the melee hit loop).
    for (const impact of impacts) impact.target.takeDamage(impact.damage)
    this.syncMeshes()
  }

  /** Recycle the mesh pool so exactly one mesh tracks each live arrow. */
  private syncMeshes(): void {
    const arrows = this.field.projectiles
    for (let i = 0; i < arrows.length; i++) {
      const a = arrows[i]
      let mesh = this.pool[i]
      if (!mesh) {
        mesh = MeshBuilder.CreateCylinder(
          `arrow:${i}`,
          { height: 0.7, diameterTop: 0.02, diameterBottom: 0.05 },
          this.scene,
        )
        mesh.isPickable = false
        const mat = new StandardMaterial(`arrowMat:${i}`, this.scene)
        mat.diffuseColor = ARROW_COLOR
        mat.specularColor = new Color3(0.05, 0.05, 0.05)
        mesh.material = mat
        this.pool[i] = mesh
      }
      mesh.setEnabled(true)
      mesh.position.set(a.x, a.y, a.z)
      // Point the cylinder (Y-up by default) along the flight direction.
      const speed = Math.hypot(a.vx, a.vy, a.vz)
      if (speed > 0) {
        mesh.rotation.y = Math.atan2(a.vx, a.vz)
        mesh.rotation.x = Math.PI / 2 - Math.asin(Math.max(-1, Math.min(1, a.vy / speed)))
      }
    }
    // Park any pooled meshes left over from a busier tick.
    for (let i = arrows.length; i < this.pool.length; i++) this.pool[i].setEnabled(false)
  }

  dispose(): void {
    for (const mesh of this.pool) mesh.dispose()
    this.pool.length = 0
  }
}

/** Cheap world-space muzzle point: chest height above the archer's feet. */
export function arrowMuzzle(archerPos: Vec3): Vector3 {
  return new Vector3(archerPos.x, archerPos.y + 1.2, archerPos.z)
}
