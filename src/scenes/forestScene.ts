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
import { resizeEngineToDisplay } from '../engine'
import { ThirdPersonCamera } from '../game/camera'
import { CharacterController } from '../game/controller'
import { createInputController, type Intent } from '../game/input'
import { FixedStepLoop } from '../game/loop'
import {
  AssetRegistry,
  AssetStreamLoader,
  FOREST_TREE_ASSET_ID,
  WOODEN_HUT_ASSET_ID,
  ZoneStreamingManager,
  defaultLoadGlb,
  getZoneManifest,
} from '../game/streaming'
import {
  createMeleeAttack,
  getMeleeHits,
  stepMeleeAttack,
  type Damageable,
  type Vec3,
} from '../game/combat'
import { registerPlayer, takeSpawn } from '../game/save/playerRuntime'
import type { PlayerTransform } from '../game/save'
import { type CorpseStore } from '../game/corpses'
import type { LootDrop } from '../game/loot'
import { SoldierEnemy } from './soldierEnemy'
import { CaravanEnemy } from './caravanEnemy'
import { CorpseManager } from './corpseManager'

/** Zone id used for the forest scene's corpse persistence. */
export const FOREST_ZONE_ID = 'forest'

/**
 * Convert any newly-dead soldiers into persistent corpses and hide the live
 * mesh. Idempotent per soldier via `converted`. Exported so the live→corpse
 * transition is unit-testable without a render loop.
 */
export function reapDeadSoldiers(
  soldiers: readonly SoldierEnemy[],
  converted: Set<SoldierEnemy>,
  corpses: Pick<CorpseManager, 'registerDeath'>,
): void {
  for (const s of soldiers) {
    if (!s.isDead() || converted.has(s)) continue
    converted.add(s)
    const p = s.mesh.position
    const pos: Vec3 = { x: p.x, y: p.y, z: p.z }
    corpses.registerDeath(pos, s.mesh.rotation.y)
    s.mesh.setEnabled(false) // hide the live soldier; the corpse mesh takes over
  }
}

// ---------------------------------------------------------------------------
// Asset ids — canonical keys owned by the zone manifest (single source of
// truth). Re-exported here so existing call sites keep their `forestScene`
// import path.
// ---------------------------------------------------------------------------

export { FOREST_TREE_ASSET_ID, WOODEN_HUT_ASSET_ID }

/** Seed the forest environment assets into a registry. */
export function seedForestAssets(registry: AssetRegistry): void {
  registry.register(FOREST_TREE_ASSET_ID, {
    url: '/models/forest-tree.glb',
    metadata: { label: 'Forest tree', targetSize: 4 },
  })
  registry.register(WOODEN_HUT_ASSET_ID, {
    url: '/models/wooden-hut.glb',
    metadata: { label: 'Wooden hut', targetSize: 3 },
  })
}

// ---------------------------------------------------------------------------
// ForestScene
// ---------------------------------------------------------------------------

export interface ForestSceneOptions {
  /** Engine factory — inject a headless `NullEngine` in tests. */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
  /** Hero GLB to mount on the capsule; `null` skips it. */
  heroUrl?: string | null
  /** Called when an enemy hits the player. Caller dispatches damagePlayer. */
  onPlayerDamaged?: (amount: number) => void
  /**
   * Spawn pose for the player capsule. Defaults to a staged Continue spawn
   * (`takeSpawn()`) so a loaded save lands the player where it left off, falling
   * back to the clearing centre for a New Game.
   */
  initialSpawn?: PlayerTransform | null
  /** Corpse store for E2.4 persistence. Defaults to the session singleton. */
  corpseStore?: CorpseStore
  /** Soldier GLB to mount on corpses; `null` keeps bare capsules (tests). */
  corpseGlbUrl?: string | null
  /**
   * Fired once when the player defeats the wandering caravan, with its rolled
   * loot (E3.5). The caller adapts the drop into `pickUpLoot` dispatches so the
   * HUD inventory reflects the haul; this scene stays decoupled from the store.
   */
  onCaravanLooted?: (drop: LootDrop) => void
  /**
   * Pause gate (FLO-326). While this returns `true` the per-frame simulation —
   * soldier AI, player movement, and melee damage — is frozen; the scene still
   * renders so the paused frame stays visible under the React pause overlay.
   * Defaults to never paused.
   */
  isPaused?: () => boolean
}

export interface ForestScene {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly controller: CharacterController
  /** The wandering caravan the player ambushes for loot (E3.5). */
  readonly caravan: CaravanEnemy
  /**
   * Advance one frame by `dt` seconds. The render loop calls this every frame;
   * tests drive it directly to step the simulation deterministically.
   */
  step(dt: number): void
  dispose(): void
}

const DEFAULT_HERO_URL = '/models/korovany_hero_player-default.glb'

function defaultEngineFactory(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true)
}

/**
 * Phase-1 forest zone stub (E1.3). A ground plane with collision, a sparse
 * scatter of streamed tree + hut GLBs, and the full third-person controller rig.
 * The assets stream lazily — placeholder boxes appear immediately and swap to the
 * real GLBs as they load.
 *
 * Wired into the app via `?dev=forest` for browser QA. The full integration
 * (play-state → forest scene) is E1.5.
 */
export function createForestScene(
  canvas: HTMLCanvasElement,
  options: ForestSceneOptions = {},
): ForestScene {
  const {
    createEngine = defaultEngineFactory,
    heroUrl = DEFAULT_HERO_URL,
    onPlayerDamaged,
    initialSpawn = takeSpawn(),
    corpseStore,
    corpseGlbUrl,
    onCaravanLooted,
    isPaused,
  } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)

  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  // ------------------------------------------------------------------
  // Ground — a grassy clearing with ray-cast collision.
  // ------------------------------------------------------------------
  const ground = MeshBuilder.CreateGround('ground', { width: 60, height: 60 }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.2, 0.38, 0.15)
  ground.material = groundMat
  ground.isPickable = true

  // ------------------------------------------------------------------
  // Streaming — the zone's environment is streamed via the
  // ZoneStreamingManager (E3.2 / FLO-345). Entering the forest manifest loads
  // its placed props (placeholder boxes swap to GLBs as they resolve); leaving
  // the zone disposes them. The travel trigger is the GameCanvas scene remount
  // keyed on `playerSlice.zoneId` — each zone change tears this scene (and its
  // manager) down and boots the destination's, so resident meshes stay bounded.
  // ------------------------------------------------------------------
  const registry = new AssetRegistry()
  seedForestAssets(registry)
  const loader = new AssetStreamLoader(scene, registry, defaultLoadGlb)

  const zoneManager = new ZoneStreamingManager(scene, loader)
  console.info(`[zone] enter ${FOREST_ZONE_ID}`)
  void zoneManager.enterZone(getZoneManifest(FOREST_ZONE_ID))

  // ------------------------------------------------------------------
  // Character controller + follow camera.
  // ------------------------------------------------------------------
  const input = createInputController(canvas)
  let frameIntent: Intent = input.sample()

  const spawnPos = initialSpawn
    ? new Vector3(initialSpawn.position.x, initialSpawn.position.y, initialSpawn.position.z)
    : new Vector3(0, 2, 0)
  const controller = new CharacterController({
    scene,
    getIntent: () => frameIntent,
    spawn: spawnPos,
    spawnRotationY: initialSpawn?.rotationY ?? 0,
  })

  // Bridge the live capsule to the save system: autosave-on-pause reads this
  // pose (E1.4) and Continue teleports it to a loaded save. Without this the
  // forest slice would autosave nothing and never restore position (E1.5).
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

  if (heroUrl) {
    void import('./modelLoader').then(({ loadModel }) =>
      loadModel(scene, heroUrl, { targetSize: 1.8, groundIt: true }).then((hero) => {
        hero.root.parent = controller.mesh
        hero.root.position = new Vector3(0, -0.9, 0)
        for (const mesh of hero.meshes) mesh.isPickable = false
        controller.mesh.isVisible = false
      }),
    )
  }

  // ------------------------------------------------------------------
  // Enemy soldiers — E2.3 fight loop.
  // ------------------------------------------------------------------
  const soldiers: SoldierEnemy[] = [
    new SoldierEnemy(scene, {
      spawn: new Vector3(6, 0.9, 6),
      getPlayerPos: () => controller.mesh.position,
      onAttackPlayer: (dmg) => onPlayerDamaged?.(dmg),
    }),
  ]

  // ------------------------------------------------------------------
  // Caravan — E3.3 loot piñata wired into the live zone (E3.5). It wanders a
  // loop until ambushed, flees when struck, and on defeat emits its rolled loot
  // via `onCaravanLooted` — the reward event the caller dispatches into the
  // inventory (E3.4) so the HUD reflects the haul.
  // ------------------------------------------------------------------
  const caravan = new CaravanEnemy(scene, {
    spawn: new Vector3(-8, 1, -6),
    getPlayerPos: () => controller.mesh.position,
    onLooted: onCaravanLooted,
  })

  // ------------------------------------------------------------------
  // Corpses — E2.4. Re-spawns any corpses recorded earlier this session and
  // converts each fresh kill into a persistent, inert downed body.
  // ------------------------------------------------------------------
  const corpses = new CorpseManager(scene, {
    zoneId: FOREST_ZONE_ID,
    store: corpseStore,
    glbUrl: corpseGlbUrl,
  })
  const convertedToCorpse = new Set<SoldierEnemy>()

  // Melee attack state for the player (edge-triggered on intent.attack).
  let meleeState = createMeleeAttack()
  let prevAttack = false

  const loop = new FixedStepLoop({ world: undefined, dt: 1 / 60 })
  loop.scheduler.register(controller)
  for (const s of soldiers) loop.scheduler.register(s)
  loop.scheduler.register(caravan)

  // One simulation+render frame. Extracted so the render loop and tests share
  // the exact same stepping path.
  const frame = (dt: number) => {
    // Pause gate (FLO-326): while paused, freeze the whole sim — no input
    // sampling, no melee, no soldier AI, no movement — but keep rendering so the
    // frozen frame stays visible under the pause overlay. The phase state
    // machine is the single source of truth for "is the sim live".
    if (isPaused?.()) {
      scene.render()
      return
    }

    frameIntent = input.sample()

    // Advance the player melee state machine (edge-triggered on F key).
    const attackPressed = frameIntent.attack && !prevAttack
    prevAttack = frameIntent.attack
    meleeState = stepMeleeAttack(meleeState, attackPressed, dt)

    // During the active hit window, check all living targets — soldiers and the
    // caravan share the same Damageable melee path; defeating the caravan fires
    // its loot event (E3.5).
    if (meleeState.hitWindowOpen) {
      const playerPos = controller.mesh.position
      const forward = controller.mesh.forward
      const targets: Damageable[] = soldiers.filter((s) => !s.isDead())
      if (!caravan.isDead()) targets.push(caravan)
      const hits = getMeleeHits(meleeState, playerPos as unknown as Vec3, forward as unknown as Vec3, targets)
      hits.forEach((h) => h.takeDamage(25))
    }

    // Turn any soldier that died this frame into a persistent corpse.
    reapDeadSoldiers(soldiers, convertedToCorpse, corpses)

    loop.advance(dt)
    rig.update(frameIntent.lookDX, frameIntent.lookDY)
    scene.render()
  }

  engine.runRenderLoop(() => frame(engine.getDeltaTime() / 1000))

  const onResize = () => resizeEngineToDisplay(engine, window.devicePixelRatio)
  onResize()
  window.addEventListener('resize', onResize)

  let disposed = false
  const handle: ForestScene = {
    engine,
    scene,
    controller,
    caravan,
    step: frame,
    dispose() {
      if (disposed) return
      disposed = true
      unregisterPlayer()
      window.removeEventListener('resize', onResize)
      input.dispose()
      engine.stopRenderLoop()
      console.info(
        `[zone] dispose ${FOREST_ZONE_ID} (${zoneManager.residentInstanceCount} streamed instances)`,
      )
      zoneManager.dispose()
      for (const s of soldiers) s.dispose()
      caravan.dispose()
      corpses.dispose() // meshes only — store records persist for re-enter
      scene.dispose()
      engine.dispose()
    },
  }

  // Dev-only handle so the browser loot smoke (E3.5) can reach the live caravan
  // and the ambush→defeat→HUD path can be driven without the full melee dance.
  if (import.meta.env.DEV) {
    ;(globalThis as Record<string, unknown>).__korovanyForestScene = handle
  }

  return handle
}
