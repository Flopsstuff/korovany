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
import { buildPlayerAvatar } from './playerAvatar'
import { resizeEngineToDisplay } from '../engine'
import { ThirdPersonCamera } from '../game/camera'
import { CharacterController } from '../game/controller'
import { createInputController, type Intent } from '../game/input'
import { FixedStepLoop } from '../game/loop'
import { registerPlayer, takeSpawn } from '../game/save/playerRuntime'
import type { PlayerTransform } from '../game/save'
import type { LootDrop } from '../game/loot'
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
import { SoldierEnemy } from './soldierEnemy'
import { ArcherEnemy } from './archerEnemy'
import { ArrowVolley } from './arrowVolley'
import { CaravanEnemy } from './caravanEnemy'
import { getZoneContent, type EncounterKind } from '../game/world'

/** Zone id used for the mountains scene's save/corpse persistence. */
export const MOUNTAINS_ZONE_ID = 'mountains'

export interface MountainsSceneOptions {
  /** Engine factory — inject a headless `NullEngine` in tests. */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
  /**
   * Player visual control. `null` skips the avatar (tests). Any other value
   * mounts the procedural low-poly fighter ({@link buildPlayerAvatar}); the
   * rig-less hero GLB was retired in P7.4 (FLO-422).
   */
  heroUrl?: string | null
  /**
   * Spawn pose for the player capsule. Defaults to a staged fast-travel/Continue
   * spawn (`takeSpawn()`), falling back to the lower switchback centre.
   */
  initialSpawn?: PlayerTransform | null
  /**
   * Pause gate (FLO-326). While this returns `true` the per-frame simulation is
   * frozen but the scene keeps rendering under the React pause overlay.
   */
  isPaused?: () => boolean
  /** Called when an enemy hits the player. Caller dispatches damagePlayer. */
  onPlayerDamaged?: (amount: number) => void
  /** Fired once when the player frees a captured caravan; caller dispatches loot. */
  onCaravanLooted?: (drop: LootDrop) => void
  /**
   * Per-step locomotion speed multiplier (1 = normal). Surfaces the leg-loss
   * crawl outcome to the capsule controller (MPG.6). Defaults to full speed.
   */
  getSpeedMultiplier?: () => number
}

export interface MountainsScene {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly controller: CharacterController
  /** All captured caravans spawned into the zone on enter. */
  readonly caravans: readonly CaravanEnemy[]
  /** All villain soldier patrols spawned into the zone on enter. */
  readonly soldiers: readonly SoldierEnemy[]
  /** All ranged units spawned on enter — includes the commander placeholder (E4.3). */
  readonly archers: readonly ArcherEnemy[]
  /** Advance one frame by `dt` seconds (tests drive this directly). */
  step(dt: number): void
  dispose(): void
}

const DEFAULT_HERO_URL = '/models/korovany_hero_player-default.glb'

/** This zone's content (landmarks + encounter anchors), the single source of
 * truth seeded from `docs/guide/worlds/black-crown-pass.md` (FLO-411, ADR-0004). */
const ZONE = getZoneContent(MOUNTAINS_ZONE_ID)

/** Encounter spawn points of one kind, as Babylon vectors. */
function spawnsOf(kind: EncounterKind): Vector3[] {
  return ZONE.encounterAnchors
    .filter((a) => a.kind === kind)
    .map((a) => new Vector3(a.position.x, a.position.y, a.position.z))
}

const MOUNTAINS_SOLDIER_SPAWNS = spawnsOf('soldier')
const MOUNTAINS_ARCHER_SPAWNS = spawnsOf('archer')
const MOUNTAINS_CARAVAN_SPAWNS = spawnsOf('caravan')

/**
 * Greybox rocky peaks ringing the walkable pass (E8.2). Cheap raised boxes at
 * the world edge that read as the cliff walls the spec calls for — "use cliff
 * meshes outside the walkable path to create danger visually" — without touching
 * the controller (the world bounds already clamp the player inside). Each is an
 * `(x, z)` centre with a `height`; the box footprint is generous so they overlap
 * into a jagged ridge line. Kept clear of the spawn and the encounter anchors.
 */
const PEAK_SPECS: readonly { x: number; z: number; height: number }[] = [
  { x: -22, z: 6, height: 12 },
  { x: -20, z: 22, height: 16 },
  { x: -16, z: 34, height: 14 },
  { x: 18, z: 34, height: 15 },
  { x: 22, z: 16, height: 13 },
  { x: 20, z: -4, height: 11 },
  { x: -22, z: -10, height: 10 },
  { x: 0, z: 40, height: 18 },
]

function defaultEngineFactory(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true)
}

/**
 * Phase-8 Mountains ("Black Crown Pass") zone — the Villain's old fort, the
 * fourth and final canonical zone (E8.2 / FLO-428). Mirrors the human-lands
 * structure: a walled ground plane, greybox fort landmarks, raised rocky peaks
 * for mountain identity, the full third-person controller rig, and the villain's
 * own troops (soldiers + a commander-placeholder ranged unit) plus a captured
 * caravan to free. See `docs/guide/worlds/black-crown-pass.md`.
 */
export function createMountainsScene(
  canvas: HTMLCanvasElement,
  options: MountainsSceneOptions = {},
): MountainsScene {
  const {
    createEngine = defaultEngineFactory,
    heroUrl = DEFAULT_HERO_URL,
    initialSpawn = takeSpawn(),
    isPaused,
    onPlayerDamaged,
    onCaravanLooted,
    getSpeedMultiplier,
  } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)

  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  // Cold snow-grey ground (distinct from the dusty road and forest olive), walled
  // by a perimeter bounding box (FLO-368). `clampToWorld` keeps the capsule inside
  // the walls each frame (the controller has no wall collision).
  const { clamp: clampToWorld } = createWorldBounds(scene, new Color3(0.62, 0.64, 0.7))

  // Greybox fort landmarks (crown tower, keep gate, command tent, prison cages)
  // standing in for the streamed fort kit so the zone reads as the villain's
  // stronghold. Geometry/colour come from the zone-content table; a later asset
  // ticket swaps these for streamed GLBs via each landmark's `assetKey`.
  const landmarkMeshes = ZONE.landmarks.map((lm, i) => {
    const box = MeshBuilder.CreateBox(`landmark-${i}`, { size: lm.size, height: lm.height }, scene)
    box.position = new Vector3(lm.position.x, lm.height / 2, lm.position.z)
    const mat = new StandardMaterial(`landmarkMat-${i}`, scene)
    const c = lm.color ?? { r: 0.5, g: 0.5, b: 0.5 }
    mat.diffuseColor = new Color3(c.r, c.g, c.b)
    box.material = mat
    return box
  })

  // Rocky greybox peaks ringing the pass — raised boxes at the world edge that
  // read as cliff walls without blocking the controller (world bounds clamp the
  // player). Dark cold stone to match the spec's "grey stone, cold blue shadows".
  const peakMat = new StandardMaterial('peakMat', scene)
  peakMat.diffuseColor = new Color3(0.3, 0.32, 0.38)
  peakMat.specularColor = new Color3(0.04, 0.04, 0.05)
  const peakMeshes = PEAK_SPECS.map((p, i) => {
    const peak = MeshBuilder.CreateBox(`peak-${i}`, { size: 8, height: p.height }, scene)
    peak.position = new Vector3(p.x, p.height / 2, p.z)
    peak.rotation.y = (i * Math.PI) / 7 // jitter the facing so the ridge reads as irregular
    peak.material = peakMat
    peak.isPickable = false
    return peak
  })

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

  // Player visual: procedural low-poly fighter (P7.4 / FLO-422). `null` skips it.
  if (heroUrl !== null) {
    const avatar = buildPlayerAvatar(scene)
    avatar.root.parent = controller.mesh
    avatar.root.position = new Vector3(0, -0.9, 0)
    controller.animator.node =
      avatar.root as unknown as import('../game/animation/proceduralAnimator').AnimatableNode
  }

  const hitFlash = new HitFlashManager()
  const deathEmphasis = new DeathEmphasisManager(engine as TimeScaleable)
  const screenShake = new ScreenShakeManager()

  // ------------------------------------------------------------------
  // Villain forces — the fort's garrison. Melee soldiers hold the yard; a
  // commander-placeholder ranged unit watches from the command tent.
  // ------------------------------------------------------------------
  const soldiers = MOUNTAINS_SOLDIER_SPAWNS.map(
    (spawn) =>
      new SoldierEnemy(scene, {
        spawn,
        getPlayerPos: () => controller.mesh.position,
        onAttackPlayer: (dmg) => {
          onPlayerDamaged?.(dmg)
          screenShake.trigger()
          emitShake()
        },
      }),
  )

  // Ranged arrows reuse the SAME damage funnel as melee: a `Damageable` player
  // target whose `takeDamage` drives the hurt SFX + camera shake bridge.
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

  // commanderObjective: each archer here stands in for the villain's commander
  // (commander/order system E4.3). Today it is a lone elevated ranged unit; E4.3
  // will promote this slot to a real commander issuing orders to the soldiers.
  const archers = MOUNTAINS_ARCHER_SPAWNS.map(
    (spawn) =>
      new ArcherEnemy(scene, {
        spawn,
        getPlayerPos: () => controller.mesh.position,
        onFire: (muzzle, dir, damage, speed) => arrows.fire(muzzle, dir, damage, speed),
      }),
  )

  // Captured prisoner caravan held in the yard — a rescue/raid objective that
  // ties the pass back into the human-caravan loop (spec "Faction pressure").
  const caravans = MOUNTAINS_CARAVAN_SPAWNS.map(
    (spawn) =>
      new CaravanEnemy(scene, {
        spawn,
        getPlayerPos: () => controller.mesh.position,
        onLooted: onCaravanLooted,
      }),
  )

  const loop = new FixedStepLoop({ world: undefined, dt: 1 / 60 })
  loop.scheduler.register(controller)
  for (const s of soldiers) loop.scheduler.register(s)
  for (const a of archers) loop.scheduler.register(a)
  for (const c of caravans) loop.scheduler.register(c)
  loop.scheduler.register(arrows) // arrows tick after the archers that fire them

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
        const wasDead = (h as SoldierEnemy | ArcherEnemy | CaravanEnemy).isDead?.()
        h.takeDamage(25)
        const nowDead = (h as SoldierEnemy | ArcherEnemy | CaravanEnemy).isDead?.()
        const mesh = (h as SoldierEnemy | ArcherEnemy | CaravanEnemy).mesh
        if (mesh) hitFlash.flash(mesh)
        emitDamage(25, 50, 40)
        if (!wasDead && nowDead) {
          deathEmphasis.trigger()
          emitKill()
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
      for (const mesh of landmarkMeshes) mesh.dispose()
      for (const mesh of peakMeshes) mesh.dispose()
      for (const s of soldiers) s.dispose()
      for (const a of archers) a.dispose()
      for (const c of caravans) c.dispose()
      arrows.dispose()
      scene.dispose()
      engine.dispose()
    },
  }
}
