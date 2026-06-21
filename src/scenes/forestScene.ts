import {
  type AbstractEngine,
  type AbstractMesh,
  Color3,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { createWorldBounds } from './worldBounds'
import { buildPlayerAvatar } from './playerAvatar'
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
import type { CombatKillTarget } from '../game/progression'
import { emitAttack, emitDamage, emitKill, emitShake } from '../game/combat/damageEvents'
import { SoldierEnemy } from './soldierEnemy'
import { ArcherEnemy, DEFAULT_ARCHER_GLB } from './archerEnemy'
import { ArrowVolley } from './arrowVolley'
import { CaravanEnemy } from './caravanEnemy'
import { CorpseManager } from './corpseManager'
import { getZoneContent, type EncounterKind } from '../game/world'
import { ZONE_MAPS } from '../game/world/mapProps'
import { renderMapProps } from './mapPropsRenderer'

/** Zone id used for the forest scene's corpse persistence. */
export const FOREST_ZONE_ID = 'forest'

/**
 * Convert any newly-dead soldiers into persistent corpses and hide the live
 * mesh. Idempotent per soldier via `converted`. Exported so the live→corpse
 * transition is unit-testable without a render loop.
 */
export function reapDeadEnemies<E extends { isDead(): boolean; mesh: AbstractMesh }>(
  enemies: readonly E[],
  converted: Set<E>,
  corpses: Pick<CorpseManager, 'registerDeath'>,
  onKilled?: () => void,
  /** GLB mounted on the resulting corpse (FLO-432); omit for the manager default. */
  glbUrl?: string,
): void {
  for (const e of enemies) {
    if (!e.isDead() || converted.has(e)) continue
    converted.add(e)
    const p = e.mesh.position
    const pos: Vec3 = { x: p.x, y: p.y, z: p.z }
    corpses.registerDeath(pos, e.mesh.rotation.y, glbUrl)
    e.mesh.setEnabled(false) // hide the live enemy; the corpse mesh takes over
    onKilled?.() // edge-triggered once per enemy: feeds the run score (MPG.1)
  }
}

/** Soldier-specific reap (back-compat wrapper around {@link reapDeadEnemies}). */
export function reapDeadSoldiers(
  soldiers: readonly SoldierEnemy[],
  converted: Set<SoldierEnemy>,
  corpses: Pick<CorpseManager, 'registerDeath'>,
  onKilled?: () => void,
): void {
  reapDeadEnemies(soldiers, converted, corpses, onKilled)
}

// ---------------------------------------------------------------------------
// Asset ids — canonical keys owned by the zone manifest (single source of
// truth). Re-exported here so existing call sites keep their `forestScene`
// import path.
// ---------------------------------------------------------------------------

export { FOREST_TREE_ASSET_ID, WOODEN_HUT_ASSET_ID }

type ForestSpawnPropKind = 'stump' | 'log' | 'rock' | 'shrub'

export interface ForestSpawnPropSpec {
  readonly kind: ForestSpawnPropKind
  readonly position: Readonly<{ x: number; z: number }>
  readonly yaw: number
  readonly scale: number
}

/** Ground clutter around the forest spawn; keeps the inner 3.5m combat radius open. */
export const FOREST_SPAWN_PROP_SPECS: readonly ForestSpawnPropSpec[] = [
  { kind: 'stump', position: { x: 4.2, z: 1.7 }, yaw: 0.2, scale: 1 },
  { kind: 'log', position: { x: -4.8, z: 2.6 }, yaw: -0.85, scale: 1.1 },
  { kind: 'rock', position: { x: 2.8, z: -4.9 }, yaw: 0.5, scale: 0.9 },
  { kind: 'shrub', position: { x: -3.7, z: -4.2 }, yaw: 0.1, scale: 1 },
  { kind: 'log', position: { x: 6.7, z: -2.4 }, yaw: 0.6, scale: 0.85 },
  { kind: 'rock', position: { x: -6.2, z: -1.6 }, yaw: -0.3, scale: 0.75 },
  { kind: 'stump', position: { x: 1.8, z: 6.1 }, yaw: -0.1, scale: 0.8 },
  { kind: 'shrub', position: { x: -1.5, z: 6.5 }, yaw: 0.8, scale: 0.9 },
]

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

function propMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const mat = new StandardMaterial(name, scene)
  mat.diffuseColor = color
  mat.specularColor = new Color3(0.05, 0.05, 0.05)
  return mat
}

/**
 * Create cheap procedural clutter around the player spawn so the forest reads
 * as inhabited before distant streamed GLBs finish loading.
 */
export function createForestSpawnProps(
  scene: Scene,
  specs: readonly ForestSpawnPropSpec[] = FOREST_SPAWN_PROP_SPECS,
): TransformNode {
  const root = new TransformNode('forest-spawn-props', scene)
  const bark = propMaterial(scene, 'forestPropBarkMat', new Color3(0.36, 0.22, 0.12))
  const cut = propMaterial(scene, 'forestPropCutWoodMat', new Color3(0.63, 0.49, 0.31))
  const stone = propMaterial(scene, 'forestPropStoneMat', new Color3(0.34, 0.36, 0.32))
  const leaf = propMaterial(scene, 'forestPropLeafMat', new Color3(0.12, 0.34, 0.15))

  const attach = (mesh: AbstractMesh, spec: ForestSpawnPropSpec) => {
    mesh.parent = root
    mesh.position.x = spec.position.x
    mesh.position.z = spec.position.z
    mesh.rotation.y = spec.yaw
    mesh.isPickable = false
  }

  specs.forEach((spec, index) => {
    if (spec.kind === 'stump') {
      const stump = MeshBuilder.CreateCylinder(
        `forest-prop:stump:${index}`,
        { height: 0.55 * spec.scale, diameterTop: 0.55 * spec.scale, diameterBottom: 0.7 * spec.scale, tessellation: 7 },
        scene,
      )
      stump.position.y = 0.275 * spec.scale
      stump.material = bark
      attach(stump, spec)
      const top = MeshBuilder.CreateCylinder(
        `forest-prop:stump-cut:${index}`,
        { height: 0.03, diameter: 0.5 * spec.scale, tessellation: 7 },
        scene,
      )
      top.position.y = 0.565 * spec.scale
      top.material = cut
      attach(top, spec)
      return
    }

    if (spec.kind === 'log') {
      const log = MeshBuilder.CreateCylinder(
        `forest-prop:log:${index}`,
        { height: 1.45 * spec.scale, diameter: 0.36 * spec.scale, tessellation: 8 },
        scene,
      )
      log.position.y = 0.18 * spec.scale
      log.rotation.z = Math.PI / 2
      log.material = bark
      attach(log, spec)
      return
    }

    if (spec.kind === 'rock') {
      const rock = MeshBuilder.CreateSphere(
        `forest-prop:rock:${index}`,
        { diameterX: 0.8 * spec.scale, diameterY: 0.42 * spec.scale, diameterZ: 0.58 * spec.scale, segments: 5 },
        scene,
      )
      rock.position.y = 0.21 * spec.scale
      rock.material = stone
      attach(rock, spec)
      return
    }

    const shrub = MeshBuilder.CreateSphere(
      `forest-prop:shrub:${index}`,
      { diameterX: 0.9 * spec.scale, diameterY: 0.55 * spec.scale, diameterZ: 0.75 * spec.scale, segments: 6 },
      scene,
    )
    shrub.position.y = 0.28 * spec.scale
    shrub.material = leaf
    attach(shrub, spec)
  })

  return root
}

// ---------------------------------------------------------------------------
// ForestScene
// ---------------------------------------------------------------------------

export interface ForestSceneOptions {
  /** Engine factory — inject a headless `NullEngine` in tests. */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
  /**
   * Player visual control. `null` skips the avatar (headless tests). Any other
   * value (including the default) mounts the procedural low-poly fighter from
   * {@link buildPlayerAvatar}; the rig-less hero GLB was retired in P7.4
   * (FLO-422) because its baked T-pose read as a scarecrow, not a fighter.
   */
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
  /** Fired once per defeated target so progression can award XP without owning combat. */
  onEnemyDefeated?: (target: CombatKillTarget) => void
  /**
   * Fired once per enemy soldier the moment it dies. The caller scores the kill
   * (MPG.1); this scene stays decoupled from the store.
   */
  onEnemyKilled?: () => void
  /**
   * Pause gate (FLO-326). While this returns `true` the per-frame simulation —
   * soldier AI, player movement, and melee damage — is frozen; the scene still
   * renders so the paused frame stays visible under the React pause overlay.
   * Defaults to never paused.
   */
  isPaused?: () => boolean
  /**
   * Per-step locomotion speed multiplier (1 = normal). Surfaces the leg-loss
   * crawl outcome (`selectLocomotionSpeedMultiplier`) to the capsule controller
   * (MPG.6) so a severed leg slows movement. Defaults to full speed.
   */
  getSpeedMultiplier?: () => number
}

export interface ForestScene {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly controller: CharacterController
  /** The wandering caravan the player ambushes for loot (E3.5). */
  readonly caravan: CaravanEnemy
  /** All caravans spawned into the zone on enter (MPG.5). */
  readonly caravans: readonly CaravanEnemy[]
  /** All soldier patrols spawned into the zone on enter (MPG.5). */
  readonly soldiers: readonly SoldierEnemy[]
  /** All ranged archers spawned into the zone on enter (FLO-432). */
  readonly archers: readonly ArcherEnemy[]
  /**
   * Advance one frame by `dt` seconds. The render loop calls this every frame;
   * tests drive it directly to step the simulation deterministically.
   */
  step(dt: number): void
  dispose(): void
}

const DEFAULT_HERO_URL = '/models/korovany_hero_player-default.glb'

/** This zone's content (landmarks + encounter anchors), the single source of
 * truth seeded from `docs/guide/worlds/lysaen-emerald-thicket.md` (FLO-411,
 * ADR-0004). The forest streams its environment props via GLB assets, so only the
 * encounter anchors are consumed here today; landmarks are data for MPG.5. */
const ZONE = getZoneContent(FOREST_ZONE_ID)

/** Encounter spawn points of one kind, as Babylon vectors. */
function spawnsOf(kind: EncounterKind): Vector3[] {
  return ZONE.encounterAnchors
    .filter((a) => a.kind === kind)
    .map((a) => new Vector3(a.position.x, a.position.y, a.position.z))
}

const FOREST_SOLDIER_SPAWNS = spawnsOf('soldier')
const FOREST_CARAVAN_SPAWNS = spawnsOf('caravan')
const FOREST_ARCHER_SPAWNS = spawnsOf('archer')

/** Derived soldier + archer spawn points (from the zone-content `encounterAnchors`).
 *  Exported so the safe-spawn buffer can be asserted in tests (P7.1 / FLO-412). */
export { FOREST_SOLDIER_SPAWNS, FOREST_ARCHER_SPAWNS }

/** World-space spawn pose of a New Game player in the forest (matches the
 *  `new Vector3(0, 2, 0)` fallback below). Its XZ origin is what the difficulty
 *  curve is measured against. */
export const FOREST_PLAYER_SPAWN = new Vector3(0, 2, 0)

/**
 * Soldier-free clear radius around the player spawn (P7.1 / FLO-412). No soldier
 * anchor may sit within this distance of `FOREST_PLAYER_SPAWN`, kept comfortably
 * above `DEFAULT_SOLDIER_PARAMS.detectionRadius` (10 m) so a fresh player is never
 * inside an aggro radius at spawn and can reach the nearest caravan before any
 * soldier engages.
 */
export const SAFE_SPAWN_BUFFER = 18

/**
 * Seconds after spawn during which incoming soldier damage is nullified
 * (P7.1 / FLO-412). A short grace so a player who walks straight into the first
 * patrol's reach gets a beat to react instead of being deleted on contact. The
 * buffer above is the primary safeguard; this is the lethality backstop.
 */
export const SPAWN_GRACE_SECONDS = 2

/**
 * Damage multiplier for a soldier hit `elapsedSeconds` into the session. Returns
 * 0 during the post-spawn grace window, 1 afterwards. Pure + exported so the
 * difficulty curve is unit-testable without a render loop.
 */
export function spawnGraceDamageScale(elapsedSeconds: number): number {
  return elapsedSeconds < SPAWN_GRACE_SECONDS ? 0 : 1
}

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
    onEnemyDefeated,
    onEnemyKilled,
    isPaused,
    getSpeedMultiplier,
  } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)

  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  // ------------------------------------------------------------------
  // Ground + world bounds — a large grassy clearing walled by a perimeter
  // bounding box (FLO-368). `clampToWorld` keeps the capsule inside the walls
  // each frame, since the controller has no horizontal collision of its own.
  // ------------------------------------------------------------------
  // Muted forest-floor olive (P7.4) — desaturated from the old pure grass green
  // so the ground recedes and the props/enemies/avatar read as the foreground.
  const { clamp: clampToWorld } = createWorldBounds(scene, new Color3(0.27, 0.36, 0.21))
  createForestSpawnProps(scene)

  // Populate the wider world from the spec's 20×20 text map (FLO-445): dense and
  // sparse tree fields, trails, the village ring + giant stump hall, elevated
  // huts, rope bridges, marsh pools, the moonwell, axecut clearing and empire camp
  // — greybox primitives spread across the full 600 m world so the forest reads as
  // a thicket, not an empty clearing. Thin-instanced (~1 draw call per symbol),
  // non-pickable so the player passes through; swap to streamed GLBs later.
  const mapProps = renderMapProps(scene, ZONE_MAPS[FOREST_ZONE_ID])

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
    getSpeedMultiplier,
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

  // Player visual: a procedural low-poly fighter built from flat-shaded boxes
  // (P7.4 / FLO-422). `heroUrl: null` (headless tests) skips it.
  if (heroUrl !== null) {
    const avatar = buildPlayerAvatar(scene)
    avatar.root.parent = controller.mesh
    avatar.root.position = new Vector3(0, -0.9, 0)
    controller.mesh.isVisible = false
    controller.animator.node =
      avatar.root as unknown as import('../game/animation/proceduralAnimator').AnimatableNode
  }

  // ------------------------------------------------------------------
  // Enemy soldiers — E2.3 fight loop, populated for MPG.5.
  // ------------------------------------------------------------------
  // Live-session clock (advances only while unpaused) driving the post-spawn
  // damage grace (P7.1 / FLO-412).
  let elapsed = 0

  const soldiers = FOREST_SOLDIER_SPAWNS.map(
    (spawn) =>
      new SoldierEnemy(scene, {
        spawn,
        getPlayerPos: () => controller.mesh.position,
        onAttackPlayer: (dmg) => {
          const dealt = dmg * spawnGraceDamageScale(elapsed)
          if (dealt <= 0) return // spawn grace: swallow the hit (no damage, no shake)
          onPlayerDamaged?.(dealt)
          emitShake() // player-hurt SFX + camera shake bridge (mirrors human-lands)
        },
        onDefeated: () => onEnemyDefeated?.('soldier'),
      }),
  )

  // ------------------------------------------------------------------
  // Ranged archers — FLO-432. A second enemy archetype that keeps its distance
  // and looses arrows. Each arrow's hit routes through the SAME damage funnel as
  // the melee soldier: a `Damageable` player target whose `takeDamage` applies
  // the spawn-grace scale + the `damageEvents` juice bridge (hurt SFX + shake).
  // ------------------------------------------------------------------
  const playerTarget: Damageable = {
    get position(): Vec3 {
      const p = controller.mesh.position
      return { x: p.x, y: p.y, z: p.z }
    },
    takeDamage(amount: number): void {
      const dealt = amount * spawnGraceDamageScale(elapsed)
      if (dealt <= 0) return // spawn grace: swallow the arrow (no damage, no shake)
      onPlayerDamaged?.(dealt)
      emitShake() // player-hurt SFX + camera shake bridge (mirrors the soldier path)
    },
  }
  const arrows = new ArrowVolley(scene, { getTargets: () => [playerTarget] })

  const archers = FOREST_ARCHER_SPAWNS.map(
    (spawn) =>
      new ArcherEnemy(scene, {
        spawn,
        getPlayerPos: () => controller.mesh.position,
        onFire: (muzzle, dir, damage, speed) => arrows.fire(muzzle, dir, damage, speed),
        onDefeated: () => onEnemyDefeated?.('archer'),
      }),
  )

  // ------------------------------------------------------------------
  // Caravans — E3.3 loot piñatas wired into the live zone (E3.5), expanded for
  // MPG.5 so repeated raids are possible without leaving the zone. Each wanders
  // a loop until ambushed, flees when struck, and on defeat emits its rolled
  // loot via `onCaravanLooted` — the reward event the caller dispatches into the
  // inventory (E3.4) so the HUD reflects the haul. The MPG.1 win objective is to
  // raid all of them (distinct spawns → distinct, reproducible loot seeds).
  // ------------------------------------------------------------------
  const caravans = FOREST_CARAVAN_SPAWNS.map(
    (spawn) =>
      new CaravanEnemy(scene, {
        spawn,
        getPlayerPos: () => controller.mesh.position,
        onLooted: onCaravanLooted,
        onDefeated: () => onEnemyDefeated?.('caravan'),
      }),
  )
  // Back-compat handle: the standalone E3.5 smoke + tests drive the first caravan.
  const caravan = caravans[0]

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
  const archersConvertedToCorpse = new Set<ArcherEnemy>()

  // Melee attack state for the player (edge-triggered on intent.attack).
  let meleeState = createMeleeAttack()
  let prevAttack = false

  const loop = new FixedStepLoop({ world: undefined, dt: 1 / 60 })
  loop.scheduler.register(controller)
  for (const s of soldiers) loop.scheduler.register(s)
  for (const a of archers) loop.scheduler.register(a)
  for (const c of caravans) loop.scheduler.register(c)
  loop.scheduler.register(arrows) // arrows tick after the archers that fire them

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

    elapsed += dt // live-session clock for the post-spawn damage grace (P7.1)
    frameIntent = input.sample()

    // Advance the player melee state machine (edge-triggered on F key).
    const attackPressed = frameIntent.attack && !prevAttack
    prevAttack = frameIntent.attack
    if (attackPressed) emitAttack() // swing SFX on the rising edge, before hit resolution
    meleeState = stepMeleeAttack(meleeState, attackPressed, dt)
    controller.setAttackPhase(meleeState.phase)

    // During the active hit window, check all living targets — soldiers and
    // caravans share the same Damageable melee path; defeating any caravan fires
    // its loot event (E3.5).
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
        // Feed the combat event bridge so the audio bus + HUD react (hit thud +
        // damage number on each hit, death sting on a kill). Centred screen
        // position is the same safe default human-lands uses pending full 3D→2D.
        // No emitShake here — that drives the player-hurt SFX and is reserved for
        // when the *player* is struck (soldier onAttackPlayer above).
        emitDamage(25, 50, 40)
        if (!wasDead && nowDead) emitKill()
      })
    }

    // Turn any soldier or archer that died this frame into a persistent corpse,
    // scoring the kill (MPG.1) as it converts. Archers fall as rangers (their own
    // GLB), so the corpse silhouette matches the enemy that died (FLO-432).
    reapDeadSoldiers(soldiers, convertedToCorpse, corpses, onEnemyKilled)
    reapDeadEnemies(
      archers,
      archersConvertedToCorpse,
      corpses,
      onEnemyKilled,
      corpseGlbUrl === null ? undefined : DEFAULT_ARCHER_GLB,
    )

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
  const handle: ForestScene = {
    engine,
    scene,
    controller,
    caravan,
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
      console.info(
        `[zone] dispose ${FOREST_ZONE_ID} (${zoneManager.residentInstanceCount} streamed instances)`,
      )
      zoneManager.dispose()
      mapProps.dispose(false, true) // disposes the thin-instanced map + its materials
      for (const s of soldiers) s.dispose()
      for (const a of archers) a.dispose()
      for (const c of caravans) c.dispose()
      arrows.dispose()
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
