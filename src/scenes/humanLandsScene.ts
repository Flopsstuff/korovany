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
import type { LocomotionMode } from '../game/health/locomotion'
import { CharacterController } from '../game/controller'
import { createInputController, type Intent } from '../game/input'
import { FixedStepLoop } from '../game/loop'
import { readPlayerTransform, registerPlayer, takeSpawn } from '../game/save/playerRuntime'
import type { PlayerTransform } from '../game/save'
import type { LootDrop } from '../game/loot'
import type { MinimapSnapshot } from '../game/minimap'
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
import { CaravanEnemy } from './caravanEnemy'
import { type AnchorRespawnState, getAnchorsToRearm } from '../game/ai'
import { getZoneContent, type EncounterKind } from '../game/world'
import { ZONE_MAPS } from '../game/world/mapProps'
import { renderMapProps } from './mapPropsRenderer'
import { type PalaceGuardProp, spawnPalaceGuardProps } from './palaceGuardProp'
import { type TollGateProp, spawnTollGateProp } from './tollGateProp'

/** Zone id used for the human-lands scene's save/corpse persistence. */
export const HUMAN_LANDS_ZONE_ID = 'human-lands'

export interface HumanLandsSceneOptions {
  /** Engine factory — inject a headless `NullEngine` in tests. */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
  /**
   * Player visual control. `null` skips the avatar (tests). Any other value
   * mounts the flat-albedo survivor GLB, faceted in-engine, via
   * {@link mountSurvivorAvatar} (FLO-443).
   */
  heroUrl?: string | null
  /**
   * Spawn pose for the player capsule. Defaults to a staged fast-travel/Continue
   * spawn (`takeSpawn()`), falling back to the road centre.
   */
  initialSpawn?: PlayerTransform | null
  /**
   * Pause gate (FLO-326). While this returns `true` the per-frame simulation is
   * frozen but the scene keeps rendering under the React pause overlay.
   */
  isPaused?: () => boolean
  /** Called when an enemy hits the player. Caller dispatches damagePlayer. */
  onPlayerDamaged?: (amount: number) => void
  /** Fired once when the player defeats a caravan; caller dispatches loot pickup. */
  onCaravanLooted?: (drop: LootDrop) => void
  /**
   * Per-step locomotion speed multiplier (1 = normal). Surfaces the leg-loss
   * crawl outcome to the capsule controller (MPG.6). Defaults to full speed.
   */
  getSpeedMultiplier?: () => number
  getLocomotionMode?: () => LocomotionMode
  /**
   * Fired from the fixed-step loop, throttled to ~10 Hz, with a top-down radar
   * snapshot for the HUD minimap (FLO-449). Positions stay scene-owned.
   */
  onMinimapTick?: (snapshot: MinimapSnapshot) => void
  /** Display-only stamina push for the HUD (FLO-465); fired on rounded-% change. */
  onStaminaChange?: (current: number, max: number) => void
  /**
   * Palace-guard GLB for static toll-gate decor (FLO-471); `null` skips the fetch
   * (headless tests) but still spawns placement roots.
   */
  palaceGuardGlbUrl?: string | null
  /**
   * Toll-gate landmark GLB (FLO-478); `null` skips the fetch (headless tests) but
   * still spawns the placement root at the zone-content position.
   */
  tollGateGlbUrl?: string | null
}

export interface HumanLandsScene {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly controller: CharacterController
  /** All caravans spawned into the zone on enter (MPG.5). */
  readonly caravans: readonly CaravanEnemy[]
  /** All soldier patrols spawned into the zone on enter (MPG.5). */
  readonly soldiers: readonly SoldierEnemy[]
  /** Static ceremonial palace-guard decor at the toll gate (FLO-471). */
  readonly palaceGuards: readonly PalaceGuardProp[]
  /** Empire toll gate landmark GLB (FLO-478). */
  readonly tollGate: TollGateProp
  /** Advance one frame by `dt` seconds (tests drive this directly). */
  step(dt: number): void
  dispose(): void
}

const DEFAULT_HERO_URL = '/models/korovany_hero_player-default.glb'

/** Minimap publish cadence — ~10 Hz, decoupled from the render frame rate (FLO-449). */
const MINIMAP_TICK_INTERVAL = 1 / 10

/** This zone's content (landmarks + encounter anchors), the single source of
 * truth seeded from `docs/guide/worlds/velya-salt-road.md` (FLO-411, ADR-0004). */
const ZONE = getZoneContent(HUMAN_LANDS_ZONE_ID)

/** Encounter spawn points of one kind, as Babylon vectors. */
function spawnsOf(kind: EncounterKind): Vector3[] {
  return ZONE.encounterAnchors
    .filter((a) => a.kind === kind)
    .map((a) => new Vector3(a.position.x, a.position.y, a.position.z))
}

const HUMAN_LANDS_SOLDIER_SPAWNS = spawnsOf('soldier')
const HUMAN_LANDS_CARAVAN_SPAWNS = spawnsOf('caravan')

function defaultEngineFactory(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true)
}

/**
 * Phase-3 Human-lands ("Salt Road of Velya") stub zone (E3.1). A flat dusty road
 * plane with a few landmark blocks, the full third-person controller rig, and
 * the MPG.5 minimum encounter population (see `docs/guide/world-specs.md` §1).
 */
export function createHumanLandsScene(
  canvas: HTMLCanvasElement,
  options: HumanLandsSceneOptions = {},
): HumanLandsScene {
  const {
    createEngine = defaultEngineFactory,
    heroUrl = DEFAULT_HERO_URL,
    initialSpawn = takeSpawn(),
    isPaused,
    onPlayerDamaged,
    onCaravanLooted,
    getSpeedMultiplier,
    getLocomotionMode,
    onMinimapTick,
    onStaminaChange,
    palaceGuardGlbUrl,
    tollGateGlbUrl,
  } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)

  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  // Dusty trade-road ground (tan), visually distinct from the forest's green,
  // walled by a perimeter bounding box (FLO-368). `clampToWorld` keeps the
  // capsule inside the walls each frame (the controller has no wall collision).
  const { clamp: clampToWorld } = createWorldBounds(scene, new Color3(0.62, 0.55, 0.38))

  // Populate the wider world from the spec's 20×20 text map (FLO-445): road,
  // farms, hedges, pines, dry riverbed, toll gate, shrine, watchtower, overlook,
  // caravan staging and barriers as greybox primitives spread across the full
  // 600 m world so it no longer reads as an empty box. Thin-instanced, ~1 draw
  // call per symbol; non-pickable so the player passes through. Swap to GLBs later.
  const mapProps = renderMapProps(scene, ZONE_MAPS[HUMAN_LANDS_ZONE_ID])

  // Greybox marker boxes for landmarks not yet swapped to GLBs (shrine, watchtower).
  // The toll gate is mounted via `spawnTollGateProp` (FLO-478).
  const landmarkMeshes = ZONE.landmarks.filter((lm) => lm.id !== 'toll-gate').map((lm, i) => {
    const box = MeshBuilder.CreateBox(`landmark-${i}`, { size: lm.size, height: lm.height }, scene)
    box.position = new Vector3(lm.position.x, lm.height / 2, lm.position.z)
    const mat = new StandardMaterial(`landmarkMat-${i}`, scene)
    const c = lm.color ?? { r: 0.5, g: 0.5, b: 0.5 }
    mat.diffuseColor = new Color3(c.r, c.g, c.b)
    box.material = mat
    return box
  })

  // ------------------------------------------------------------------
  // Character controller + follow camera (same rig as the forest scene).
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
    getLocomotionMode,
    onStaminaChange,
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

  // Player visual: the flat-albedo survivor GLB faceted in-engine (FLO-443),
  // mounted fire-and-forget on the capsule. `null` skips it (headless tests).
  if (heroUrl !== null) {
    mountSurvivorAvatar(scene, controller, heroUrl)
  }

  const hitFlash = new HitFlashManager()
  const deathEmphasis = new DeathEmphasisManager(engine as TimeScaleable)
  const screenShake = new ScreenShakeManager()

  const palaceGuards = spawnPalaceGuardProps(scene, undefined, palaceGuardGlbUrl)
  const tollGate = spawnTollGateProp(scene, tollGateGlbUrl)

  const soldiers = HUMAN_LANDS_SOLDIER_SPAWNS.map(
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

  const anchorRespawnStateHL: AnchorRespawnState[] = HUMAN_LANDS_CARAVAN_SPAWNS.map(() => ({
    defeatedAt: null,
  }))

  const spawnCaravanHL = (index: number): CaravanEnemy => {
    const spawn = HUMAN_LANDS_CARAVAN_SPAWNS[index]
    return new CaravanEnemy(scene, {
      spawn,
      getPlayerPos: () => controller.mesh.position,
      onLooted: onCaravanLooted,
      onDefeated: () => {
        anchorRespawnStateHL[index] = { defeatedAt: performance.now() }
      },
    })
  }

  const caravans: CaravanEnemy[] = HUMAN_LANDS_CARAVAN_SPAWNS.map((_, i) => spawnCaravanHL(i))

  const loop = new FixedStepLoop({ world: undefined, dt: 1 / 60 })
  loop.scheduler.register(controller)
  for (const s of soldiers) loop.scheduler.register(s)
  for (const c of caravans) loop.scheduler.register(c)

  let meleeState = createMeleeAttack()
  let prevAttack = false

  // Minimap radar (FLO-449): throttled ~10 Hz publish to the HUD bridge.
  let minimapAccum = MINIMAP_TICK_INTERVAL // emit on the first frame
  const emitMinimap = () => {
    const player = readPlayerTransform()
    if (!player) return
    onMinimapTick?.({
      player: { x: player.position.x, z: player.position.z, rotationY: player.rotationY },
      caravans: caravans.filter((c) => !c.isDead()).map((c) => ({ x: c.position.x, z: c.position.z })),
      soldiers: soldiers
        .filter((s) => !s.isDead())
        .map((s) => ({ x: s.mesh.position.x, z: s.mesh.position.z })),
    })
  }

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
      targets.push(...caravans.filter((c) => !c.isDead()))
      const hits = getMeleeHits(meleeState, playerPos as unknown as Vec3, forward as unknown as Vec3, targets)
      hits.forEach((h) => {
        const wasDead = (h as SoldierEnemy | CaravanEnemy).isDead?.()
        h.takeDamage(25)
        const nowDead = (h as SoldierEnemy | CaravanEnemy).isDead?.()
        // Flash the hit mesh (only enemies backed by a Babylon mesh).
        const mesh = (h as SoldierEnemy | CaravanEnemy).mesh
        if (mesh) hitFlash.flash(mesh)
        // Emit damage number at approximate screen-centre for now (MPG.3 full 3D→2D projection
        // requires a live camera reference; a centred position is a safe default here).
        emitDamage(25, 50, 40)
        // Death emphasis on kill.
        if (!wasDead && nowDead) {
          deathEmphasis.trigger()
          emitKill()
        }
        // Screen shake on landing a hit.
        screenShake.trigger()
      })
    }

    hitFlash.update(dt)
    deathEmphasis.update(dt)
    const [shakeX, shakeY] = screenShake.update(dt)
    if (shakeX !== 0 || shakeY !== 0) {
      // Offset the camera target slightly to produce the shake.
      rig.camera.target.x += shakeX
      rig.camera.target.y += shakeY
    }

    // Re-arm caravan anchors whose cooldown has elapsed (FLO-456).
    const toRearmHL = getAnchorsToRearm(performance.now(), anchorRespawnStateHL)
    for (const idx of toRearmHL) {
      caravans[idx].dispose()
      anchorRespawnStateHL[idx] = { defeatedAt: null }
      const fresh = spawnCaravanHL(idx)
      caravans[idx] = fresh
      loop.scheduler.register(fresh)
    }

    loop.advance(dt)
    clampToWorld(controller.mesh.position) // contain the player within the world bounds

    if (onMinimapTick) {
      minimapAccum += dt
      if (minimapAccum >= MINIMAP_TICK_INTERVAL) {
        minimapAccum = 0
        emitMinimap()
      }
    }

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
    palaceGuards,
    tollGate,
    step: frame,
    dispose() {
      if (disposed) return
      disposed = true
      unregisterPlayer()
      window.removeEventListener('resize', onResize)
      input.dispose()
      engine.stopRenderLoop()
      mapProps.dispose(false, true) // disposes the thin-instanced map + its materials
      for (const mesh of landmarkMeshes) mesh.dispose()
      for (const g of palaceGuards) g.dispose()
      tollGate.dispose()
      for (const s of soldiers) s.dispose()
      for (const c of caravans) c.dispose()
      scene.dispose()
      engine.dispose()
    },
  }
}
