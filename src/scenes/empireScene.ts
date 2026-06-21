import {
  type AbstractEngine,
  Color3,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import { createWorldBounds } from './worldBounds'
import { mountSurvivorAvatar } from './survivorAvatar'
import { resizeEngineToDisplay } from '../engine'
import { ThirdPersonCamera } from '../game/camera'
import { CharacterController } from '../game/controller'
import { createInputController, type Intent } from '../game/input'
import { FixedStepLoop } from '../game/loop'
import { registerPlayer, takeSpawn } from '../game/save/playerRuntime'
import type { PlayerTransform } from '../game/save'
import type { LootDrop } from '../game/loot'
import type { CombatKillTarget } from '../game/progression'
import {
  createMeleeAttack,
  getMeleeHits,
  stepMeleeAttack,
  type Damageable,
  type Vec3,
} from '../game/combat'
import { HitFlashManager } from '../game/combat/hitFlash'
import { DeathEmphasisManager, type TimeScaleable } from '../game/combat/deathEmphasis'
import { ScreenShakeManager } from '../game/camera/screenShake'
import { emitAttack, emitDamage, emitKill, emitShake } from '../game/combat/damageEvents'
import { AssetRegistry, AssetStreamLoader, ZoneStreamingManager, defaultLoadGlb, getZoneManifest } from '../game/streaming'
import { SoldierEnemy } from './soldierEnemy'
import { ArcherEnemy } from './archerEnemy'
import { ArrowVolley } from './arrowVolley'
import { CaravanEnemy } from './caravanEnemy'
import { getZoneContent, type EncounterKind } from '../game/world'

/** Zone id used for the Empire (palace) scene's save/streaming wiring. */
export const EMPIRE_ZONE_ID = 'empire'

export interface EmpireSceneOptions {
  /** Engine factory — inject a headless `NullEngine` in tests. */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
  /**
   * Player visual control. `null` skips the avatar (tests). Any other value
   * mounts the procedural low-poly fighter ({@link buildPlayerAvatar}).
   */
  heroUrl?: string | null
  /**
   * Spawn pose for the player capsule. Defaults to a staged fast-travel/Continue
   * spawn (`takeSpawn()`), falling back to the palace approach.
   */
  initialSpawn?: PlayerTransform | null
  /** Pause gate (FLO-326): freezes the per-frame simulation while it returns `true`. */
  isPaused?: () => boolean
  /** Called when an enemy hits the player. Caller dispatches damagePlayer. */
  onPlayerDamaged?: (amount: number) => void
  /** Fired once when the player defeats a caravan; caller dispatches loot pickup. */
  onCaravanLooted?: (drop: LootDrop) => void
  /** Fired once per defeated combat target so progression can award XP. */
  onEnemyDefeated?: (target: CombatKillTarget) => void
  /** Fired when the player defeats a guard/archer (MPG.1 score). */
  onEnemyKilled?: () => void
  /** Per-step locomotion speed multiplier (1 = normal); surfaces the leg-loss crawl (MPG.6). */
  getSpeedMultiplier?: () => number
}

export interface EmpireScene {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly controller: CharacterController
  /** All caravans (tribute wagons) spawned into the zone on enter (MPG.5). */
  readonly caravans: readonly CaravanEnemy[]
  /** All Palace-Guard patrols spawned into the zone on enter (MPG.5). */
  readonly soldiers: readonly SoldierEnemy[]
  /** All wall archers spawned into the zone on enter. */
  readonly archers: readonly ArcherEnemy[]
  /** Advance one frame by `dt` seconds (tests drive this directly). */
  step(dt: number): void
  dispose(): void
}

const DEFAULT_HERO_URL = '/models/korovany_hero_player-default.glb'
/** Strike-pose twin shown while a melee swing is in flight (FLO-481 / FLO-480). */
const ATTACK_HERO_URL = '/models/korovany_hero_player-attack.glb'

/** This zone's content (landmarks + encounter anchors), the single source of
 * truth seeded from `docs/guide/worlds/imperial-palace.md` (E8.1, ADR-0004). */
const ZONE = getZoneContent(EMPIRE_ZONE_ID)

/** Encounter spawn points of one kind, as Babylon vectors. */
function spawnsOf(kind: EncounterKind): Vector3[] {
  return ZONE.encounterAnchors
    .filter((a) => a.kind === kind)
    .map((a) => new Vector3(a.position.x, a.position.y, a.position.z))
}

const EMPIRE_GUARD_SPAWNS = spawnsOf('soldier')
const EMPIRE_ARCHER_SPAWNS = spawnsOf('archer')
const EMPIRE_CARAVAN_SPAWNS = spawnsOf('caravan')

function defaultEngineFactory(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true)
}

/**
 * Empire ("The Imperial March") palace zone (E8.1 / FLO-427). A pale stone plaza
 * walled by a perimeter bounding box, with greybox palace landmarks (keep, crown
 * gate, barracks, banner), the full third-person controller rig, and the MPG.5
 * encounter population: Palace-Guard patrols (placeholder `soldier` archetype until
 * the palace-guard GLB lands), a wall archer, and tribute caravans. The faction
 * directive (defend vs raid) is surfaced in the HUD from `zoneDirectives.ts`. See
 * `docs/guide/world-specs.md` §4 and `docs/guide/worlds/imperial-palace.md`.
 */
export function createEmpireScene(
  canvas: HTMLCanvasElement,
  options: EmpireSceneOptions = {},
): EmpireScene {
  const {
    createEngine = defaultEngineFactory,
    heroUrl = DEFAULT_HERO_URL,
    initialSpawn = takeSpawn(),
    isPaused,
    onPlayerDamaged,
    onCaravanLooted,
    onEnemyDefeated,
    onEnemyKilled,
    getSpeedMultiplier,
  } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)

  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  // Pale crown-stone plaza, visually distinct from the forest's olive and the Salt
  // Road's dusty tan, walled by a perimeter bounding box (FLO-368). `clampToWorld`
  // keeps the capsule inside the walls each frame (the controller has no wall
  // collision).
  const { clamp: clampToWorld } = createWorldBounds(scene, new Color3(0.5, 0.48, 0.44))

  // Greybox palace landmarks (keep, crown gate, barracks, banner) from the
  // zone-content table; a later asset ticket swaps these for streamed GLBs via each
  // landmark's `assetKey`.
  const landmarkMeshes = ZONE.landmarks.map((lm, i) => {
    const box = MeshBuilder.CreateBox(`landmark-${i}`, { size: lm.size, height: lm.height }, scene)
    box.position = new Vector3(lm.position.x, lm.height / 2, lm.position.z)
    const mat = new StandardMaterial(`landmarkMat-${i}`, scene)
    const c = lm.color ?? { r: 0.5, g: 0.5, b: 0.5 }
    mat.diffuseColor = new Color3(c.r, c.g, c.b)
    box.material = mat
    return box
  })

  // ------------------------------------------------------------------
  // Streaming — enter the empire manifest so travel loads via the same
  // ZoneStreamingManager path as the forest (E3.2 / FLO-345). The manifest is
  // empty today (no palace GLBs yet) but entering it keeps the call site uniform;
  // disposing the manager on teardown unloads the zone on the next border crossing.
  // ------------------------------------------------------------------
  const registry = new AssetRegistry()
  const loader = new AssetStreamLoader(scene, registry, defaultLoadGlb)
  const zoneManager = new ZoneStreamingManager(scene, loader)
  console.info(`[zone] enter ${EMPIRE_ZONE_ID}`)
  void zoneManager.enterZone(getZoneManifest(EMPIRE_ZONE_ID))

  // ------------------------------------------------------------------
  // Character controller + follow camera (same rig as the other zones).
  // ------------------------------------------------------------------
  const input = createInputController(canvas)
  let frameIntent: Intent = input.sample()

  const spawnPos = initialSpawn
    ? new Vector3(initialSpawn.position.x, initialSpawn.position.y, initialSpawn.position.z)
    : new Vector3(0, 2, 0)
  const controller = new CharacterController({
    scene,
    getIntent: () => frameIntent,
    getSpeedMultiplier,
    spawn: spawnPos,
    spawnRotationY: initialSpawn?.rotationY ?? 0,
  })

  const unregisterPlayer = registerPlayer({
    read: () => controller.snapshot(),
    write: (transform) => controller.teleport(transform),
  })

  const rig = new ThirdPersonCamera({ scene, target: controller.mesh })
  rig.activate()
  controller.camera = rig.camera

  const capsuleMat = new StandardMaterial('capsuleMat', scene)
  capsuleMat.diffuseColor = new Color3(0.3, 0.5, 0.8)
  controller.mesh.material = capsuleMat
  controller.mesh.isVisible = false

  // Player visual: the flat-albedo survivor GLB faceted in-engine (FLO-443/447),
  // mounted fire-and-forget on the capsule, plus the attack-pose twin swapped in
  // by combat state (FLO-481). `heroUrl: null` (headless tests) skips it.
  if (heroUrl !== null) {
    mountSurvivorAvatar(scene, controller, heroUrl, ATTACK_HERO_URL)
  }

  const hitFlash = new HitFlashManager()
  const deathEmphasis = new DeathEmphasisManager(engine as TimeScaleable)
  const screenShake = new ScreenShakeManager()

  // ------------------------------------------------------------------
  // Palace-Guard patrols (E8.1) — placeholder `soldier` archetype until the
  // palace-guard GLB lands. Same melee fight loop as the other zones.
  // ------------------------------------------------------------------
  const soldiers = EMPIRE_GUARD_SPAWNS.map(
    (spawn) =>
      new SoldierEnemy(scene, {
        spawn,
        getPlayerPos: () => controller.mesh.position,
        onAttackPlayer: (dmg) => {
          onPlayerDamaged?.(dmg)
          screenShake.trigger()
          emitShake()
        },
        onDefeated: () => onEnemyDefeated?.('soldier'),
      }),
  )

  // ------------------------------------------------------------------
  // Wall archer (FLO-432 archetype) — keeps its distance and looses arrows. Each
  // arrow routes through the same `Damageable` player path as a melee guard hit.
  // ------------------------------------------------------------------
  const playerTarget: Damageable = {
    get position(): Vec3 {
      const p = controller.mesh.position
      return { x: p.x, y: p.y, z: p.z }
    },
    takeDamage(amount: number): void {
      onPlayerDamaged?.(amount)
      screenShake.trigger()
      emitShake()
    },
  }
  const arrows = new ArrowVolley(scene, { getTargets: () => [playerTarget] })

  const archers = EMPIRE_ARCHER_SPAWNS.map(
    (spawn) =>
      new ArcherEnemy(scene, {
        spawn,
        getPlayerPos: () => controller.mesh.position,
        onFire: (muzzle, dir, damage, speed) => arrows.fire(muzzle, dir, damage, speed),
        onDefeated: () => onEnemyDefeated?.('archer'),
      }),
  )

  // ------------------------------------------------------------------
  // Tribute caravans — the raid/loot targets that keep the win objective alive in
  // the palace zone (MPG.1). On defeat each emits its rolled loot via onCaravanLooted.
  // ------------------------------------------------------------------
  const caravans = EMPIRE_CARAVAN_SPAWNS.map(
    (spawn) =>
      new CaravanEnemy(scene, {
        spawn,
        getPlayerPos: () => controller.mesh.position,
        onLooted: onCaravanLooted,
        onDefeated: () => onEnemyDefeated?.('caravan'),
      }),
  )

  const loop = new FixedStepLoop({ world: undefined, dt: 1 / 60 })
  loop.scheduler.register(controller)
  for (const s of soldiers) loop.scheduler.register(s)
  for (const a of archers) loop.scheduler.register(a)
  for (const c of caravans) loop.scheduler.register(c)
  loop.scheduler.register(arrows)

  let meleeState = createMeleeAttack()
  let prevAttack = false

  const frame = (dt: number) => {
    if (isPaused?.()) {
      scene.render()
      return
    }
    frameIntent = input.sample()
    const attackPressed = frameIntent.attack && !prevAttack
    prevAttack = frameIntent.attack
    if (attackPressed) emitAttack() // swing SFX on the rising edge, before hit resolution
    meleeState = stepMeleeAttack(meleeState, attackPressed, dt)
    controller.setAttackPhase(meleeState.phase)

    if (meleeState.hitWindowOpen) {
      const playerPos = controller.mesh.position
      const forward = controller.mesh.forward
      const targets: Damageable[] = soldiers.filter((s) => !s.isDead())
      targets.push(...archers.filter((a) => !a.isDead()))
      targets.push(...caravans.filter((c) => !c.isDead()))
      const hits = getMeleeHits(meleeState, playerPos as unknown as Vec3, forward as unknown as Vec3, targets)
      hits.forEach((h) => {
        const enemy = h as SoldierEnemy | ArcherEnemy | CaravanEnemy
        const wasDead = enemy.isDead?.()
        h.takeDamage(25)
        const nowDead = enemy.isDead?.()
        const mesh = enemy.mesh
        if (mesh) hitFlash.flash(mesh)
        emitDamage(25, 50, 40)
        if (!wasDead && nowDead) {
          deathEmphasis.trigger()
          emitKill()
          // Score guard/archer kills (MPG.1); caravans score via the loot loop.
          if (!(enemy instanceof CaravanEnemy)) onEnemyKilled?.()
        }
        screenShake.trigger()
      })
    }

    hitFlash.update(dt)
    deathEmphasis.update(dt)
    const [shakeX, shakeY] = screenShake.update(dt)
    if (shakeX !== 0 || shakeY !== 0) {
      rig.camera.target.x += shakeX
      rig.camera.target.y += shakeY
    }

    loop.advance(dt)
    clampToWorld(controller.mesh.position) // contain the player within the world bounds
    rig.update(frameIntent.lookDX, frameIntent.lookDY)
    scene.render()
  }

  engine.runRenderLoop(() => frame(engine.getDeltaTime() / 1000))

  const onResize = () => resizeEngineToDisplay(engine, window.devicePixelRatio)
  onResize()
  window.addEventListener('resize', onResize)

  let disposed = false
  return {
    engine,
    scene,
    controller,
    caravans,
    soldiers,
    archers,
    step: frame,
    dispose() {
      if (disposed) return
      disposed = true
      unregisterPlayer()
      window.removeEventListener('resize', onResize)
      input.dispose()
      engine.stopRenderLoop()
      zoneManager.dispose()
      for (const mesh of landmarkMeshes) mesh.dispose()
      for (const s of soldiers) s.dispose()
      for (const a of archers) a.dispose()
      for (const c of caravans) c.dispose()
      arrows.dispose()
      scene.dispose()
      engine.dispose()
    },
  }
}
