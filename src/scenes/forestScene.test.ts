import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FOREST_TREE_ASSET_ID,
  FOREST_SPAWN_PROP_SPECS,
  FOREST_ZONE_ID,
  WOODEN_HUT_ASSET_ID,
  createForestSpawnProps,
  createForestScene,
  reapDeadSoldiers,
  seedForestAssets,
} from './forestScene'
import { AssetRegistry, getZoneManifest } from '../game/streaming'
import {
  applyPlayerTransform,
  readPlayerTransform,
  stageSpawn,
  takeSpawn,
} from '../game/save/playerRuntime'
import { CorpseManager } from './corpseManager'
import { CorpseStore } from '../game/corpses'
import { onAttack, onShake } from '../game/combat/damageEvents'
import { SoldierEnemy } from './soldierEnemy'
import { DEFAULT_SOLDIER_PARAMS } from '../game/ai'

// jsdom has no WebGL, so inject a headless NullEngine and skip hero/asset GLB
// fetches. Asserts the scene wires the ground, controller, and streaming loader.
function boot() {
  const canvas = document.createElement('canvas')
  return createForestScene(canvas, {
    heroUrl: null,
    createEngine: () => new NullEngine(),
  })
}

describe('seedForestAssets', () => {
  it('registers tree and hut with their canonical ids', () => {
    const registry = new AssetRegistry()
    seedForestAssets(registry)
    const tree = registry.resolve(FOREST_TREE_ASSET_ID)
    const hut = registry.resolve(WOODEN_HUT_ASSET_ID)
    expect(tree.url).toContain('forest-tree.glb')
    expect(hut.url).toContain('wooden-hut.glb')
  })

  it('gives the tree a larger targetSize than the hut', () => {
    const registry = new AssetRegistry()
    seedForestAssets(registry)
    expect(registry.resolve(FOREST_TREE_ASSET_ID).metadata.targetSize).toBeGreaterThan(
      registry.resolve(WOODEN_HUT_ASSET_ID).metadata.targetSize ?? 0,
    )
  })

  // The forest manifest (E3.2 wiring) and the registry seeding live in separate
  // modules; this guards them from drifting — every streamed asset id the
  // ZoneStreamingManager will try to load must be registered before entry.
  it('seeds every asset the forest manifest places', () => {
    const registry = new AssetRegistry()
    seedForestAssets(registry)
    for (const placement of getZoneManifest(FOREST_ZONE_ID).placements) {
      expect(() => registry.resolve(placement.assetId)).not.toThrow()
    }
  })
})

describe('createForestSpawnProps', () => {
  it('creates every configured spawn-area prop', () => {
    const scene = new Scene(new NullEngine())
    createForestSpawnProps(scene)
    const propMeshes = scene.meshes.filter((mesh) => mesh.name.startsWith('forest-prop:'))
    expect(propMeshes.length).toBeGreaterThanOrEqual(FOREST_SPAWN_PROP_SPECS.length)
    expect(scene.getTransformNodeByName('forest-spawn-props')).not.toBeNull()
  })

  it('keeps the immediate player spawn radius clear', () => {
    for (const spec of FOREST_SPAWN_PROP_SPECS) {
      const distance = Math.hypot(spec.position.x, spec.position.z)
      expect(distance).toBeGreaterThanOrEqual(3.5)
    }
  })
})

describe('createForestScene', () => {
  it('boots a live scene with an active camera', () => {
    const game = boot()
    expect(game.scene).toBeInstanceOf(Scene)
    expect(game.scene.activeCamera).not.toBeNull()
    game.dispose()
  })

  it('spawns the player capsule and wires the follow camera to it', () => {
    const game = boot()
    expect(game.controller.mesh.name).toBe('playerCapsule')
    expect(game.scene.activeCamera).toBeDefined()
    game.dispose()
  })

  it('creates a pickable ground mesh', () => {
    const game = boot()
    const ground = game.scene.getMeshByName('ground')
    expect(ground).not.toBeNull()
    expect(ground!.isPickable).toBe(true)
    game.dispose()
  })

  it('populates the spawn clearing with lightweight forest props', () => {
    const game = boot()
    expect(game.scene.getTransformNodeByName('forest-spawn-props')).not.toBeNull()
    expect(game.scene.meshes.some((mesh) => mesh.name.startsWith('forest-prop:log:'))).toBe(true)
    expect(game.scene.meshes.some((mesh) => mesh.name.startsWith('forest-prop:stump:'))).toBe(true)
    game.dispose()
  })

  it('re-spawns persisted corpses for the forest zone on boot', () => {
    const canvas = document.createElement('canvas')
    const store = new CorpseStore(8)
    store.record(FOREST_ZONE_ID, { x: 4, y: 0.9, z: 4 }, 0)
    const game = createForestScene(canvas, {
      heroUrl: null,
      corpseStore: store,
      corpseGlbUrl: null,
      createEngine: () => new NullEngine(),
    })
    expect(game.scene.getMeshByName('corpse:corpse-0')).not.toBeNull()
    game.dispose()
  })

  it('tears down cleanly and is idempotent', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const game = boot()
    game.dispose()
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(game.scene.isDisposed).toBe(true)
    expect(() => game.dispose()).not.toThrow()
    remove.mockRestore()
  })
})

// Regression guard for FLO-297: the deployed slice autosaved nothing and never
// restored position because the forest scene mounted into `playing` forgot to
// register the player handle with the save bridge (only the `?dev` playground
// did). These assert the integration the E1.5 capstone is responsible for.
describe('createForestScene — save bridge (E1.4/E1.5 integration)', () => {
  beforeEach(() => {
    // Clear any spawn staged by a previous test so each boot is deterministic.
    takeSpawn()
  })

  it('registers the live player so autosave-on-pause has a pose to read', () => {
    expect(readPlayerTransform()).toBeNull()
    const game = boot()
    const pose = readPlayerTransform()
    expect(pose).not.toBeNull()
    expect(pose!.position).toEqual({ x: 0, y: 2, z: 0 })
    game.dispose()
    // A torn-down scene must stop being the save source of truth.
    expect(readPlayerTransform()).toBeNull()
  })

  it('lets Continue teleport the live capsule via applyPlayerTransform', () => {
    const game = boot()
    const target = { position: { x: 5, y: 2, z: -3 }, rotationY: 1 }
    expect(applyPlayerTransform(target)).toBe(true)
    expect(readPlayerTransform()).toEqual(target)
    game.dispose()
  })

  it('boots at a staged Continue spawn instead of the clearing centre', () => {
    const spawn = { position: { x: -8, y: 2, z: 11 }, rotationY: 0.5 }
    stageSpawn(spawn)
    const game = boot()
    expect(readPlayerTransform()).toEqual(spawn)
    game.dispose()
  })
})

// Regression guard for FLO-326: while the game is paused the forest scene's
// per-frame sim (soldier AI + melee) must not advance — an idle player was
// approached, killed, and bounced to the menu on the pause screen. The pause
// gate freezes the whole frame; only rendering survives.
describe('createForestScene — pause gating (FLO-326)', () => {
  beforeEach(() => {
    // Consume any spawn staged by a previous test so the player boots at the
    // clearing centre and the soldier (spawned at 6,6) is in detection range.
    takeSpawn()
  })

  // Drive the deterministic frame step instead of the rAF render loop.
  function drive(game: { step(dt: number): void }, frames: number) {
    for (let i = 0; i < frames; i++) game.step(1 / 60)
  }

  it('does not advance soldier AI or damage the player while paused', () => {
    const onPlayerDamaged = vi.fn()
    const game = createForestScene(document.createElement('canvas'), {
      heroUrl: null,
      createEngine: () => new NullEngine(),
      onPlayerDamaged,
      isPaused: () => true,
    })

    const soldier = game.scene.getMeshByName('soldier')!
    const startX = soldier.position.x
    const startZ = soldier.position.z

    // Step well past the time the soldier would need to close in and attack.
    drive(game, 600)

    expect(onPlayerDamaged).not.toHaveBeenCalled()
    // The frozen soldier must not have moved a single step.
    expect(soldier.position.x).toBe(startX)
    expect(soldier.position.z).toBe(startZ)

    game.dispose()
  })

  it('advances combat and damages the player when not paused (control)', () => {
    const onPlayerDamaged = vi.fn()
    const game = createForestScene(document.createElement('canvas'), {
      heroUrl: null,
      createEngine: () => new NullEngine(),
      onPlayerDamaged,
      isPaused: () => false,
    })

    // The soldier detects the idle player, chases, and lands a hit — proving the
    // paused case above genuinely suppresses live combat, not a dead scene.
    drive(game, 600)

    expect(onPlayerDamaged).toHaveBeenCalled()

    game.dispose()
  })

  it('freezes mid-session when the pause gate flips, then resumes', () => {
    const onPlayerDamaged = vi.fn()
    let paused = false
    const game = createForestScene(document.createElement('canvas'), {
      heroUrl: null,
      createEngine: () => new NullEngine(),
      onPlayerDamaged,
      isPaused: () => paused,
    })

    const soldier = game.scene.getMeshByName('soldier')!

    // Live: let the soldier close in.
    drive(game, 200)
    const pausedX = soldier.position.x
    const pausedZ = soldier.position.z

    // Pause: no movement, no damage while frozen.
    paused = true
    onPlayerDamaged.mockClear()
    drive(game, 400)
    expect(soldier.position.x).toBe(pausedX)
    expect(soldier.position.z).toBe(pausedZ)
    expect(onPlayerDamaged).not.toHaveBeenCalled()

    // Resume: combat advances again and the player can take damage.
    paused = false
    drive(game, 400)
    expect(onPlayerDamaged).toHaveBeenCalled()

    game.dispose()
  })
})

// E3.5: the caravan loot loop is closed in the live forest scene. Defeating the
// wandering caravan must emit its rolled loot via onCaravanLooted, which the app
// adapts into pickUpLoot dispatches (see caravanLootAdapter). These guard the
// scene-side half of that join: spawn + Damageable melee path + reward event.
describe('createForestScene — caravan loot loop (E3.5)', () => {
  beforeEach(() => {
    takeSpawn()
  })

  it('spawns a wandering caravan into the live zone', () => {
    const game = boot()
    expect(game.caravan).toBeDefined()
    expect(game.caravans).toHaveLength(3)
    expect(game.scene.getMeshByName('caravan')).not.toBeNull()
    expect(game.caravan.isDead()).toBe(false)
    game.dispose()
  })

  it('meets the MPG.5 minimum population on zone enter', () => {
    const game = boot()
    expect(game.caravans.length).toBeGreaterThanOrEqual(3)
    expect(game.soldiers.length).toBeGreaterThanOrEqual(5)
    expect(game.caravans.every((caravan) => !caravan.isDead())).toBe(true)
    expect(game.soldiers.every((soldier) => !soldier.isDead())).toBe(true)
    game.dispose()
  })

  it('emits the rolled loot exactly once when the caravan is defeated', () => {
    const onCaravanLooted = vi.fn()
    const game = createForestScene(document.createElement('canvas'), {
      heroUrl: null,
      createEngine: () => new NullEngine(),
      onCaravanLooted,
    })

    // Drive the caravan past its HP on the same Damageable path the melee sweep
    // uses; the kill rolls the loot table and fires the reward event.
    game.caravan.takeDamage(1000)
    expect(game.caravan.isDead()).toBe(true)
    expect(onCaravanLooted).toHaveBeenCalledTimes(1)

    const drop = onCaravanLooted.mock.calls[0][0]
    expect(drop.items.length).toBeGreaterThan(0)
    for (const stack of drop.items) {
      expect(typeof stack.id).toBe('string')
      expect(stack.qty).toBeGreaterThan(0)
    }

    // A second strike on the dead wreck must not re-emit loot.
    game.caravan.takeDamage(1000)
    expect(onCaravanLooted).toHaveBeenCalledTimes(1)

    game.dispose()
  })
})

describe('reapDeadSoldiers (live → corpse transition)', () => {
  function makeSoldier(scene: Scene) {
    return new SoldierEnemy(scene, {
      spawn: new Vector3(6, 0.9, 6),
      glbUrl: null,
      getPlayerPos: () => new Vector3(0, 0.9, 0),
      onAttackPlayer: () => {},
    })
  }

  it('converts a dead soldier into a corpse exactly once and hides it', () => {
    const scene = new Scene(new NullEngine())
    const store = new CorpseStore(8)
    const corpses = new CorpseManager(scene, {
      zoneId: FOREST_ZONE_ID,
      store,
      glbUrl: null,
    })
    const soldier = makeSoldier(scene)
    const converted = new Set<SoldierEnemy>()

    // Alive → no corpse.
    reapDeadSoldiers([soldier], converted, corpses)
    expect(corpses.count).toBe(0)

    soldier.takeDamage(DEFAULT_SOLDIER_PARAMS.maxHp)
    reapDeadSoldiers([soldier], converted, corpses)
    expect(corpses.count).toBe(1)
    expect(soldier.mesh.isEnabled()).toBe(false) // live mesh hidden
    expect(store.forZone(FOREST_ZONE_ID)).toHaveLength(1)

    // Idempotent: a second pass does not spawn a duplicate corpse.
    reapDeadSoldiers([soldier], converted, corpses)
    expect(corpses.count).toBe(1)
  })

  it('records the corpse at the soldier position', () => {
    const scene = new Scene(new NullEngine())
    const store = new CorpseStore(8)
    const corpses = new CorpseManager(scene, {
      zoneId: FOREST_ZONE_ID,
      store,
      glbUrl: null,
    })
    const soldier = makeSoldier(scene)
    soldier.takeDamage(DEFAULT_SOLDIER_PARAMS.maxHp)
    reapDeadSoldiers([soldier], new Set(), corpses)
    const [corpse] = store.forZone(FOREST_ZONE_ID)
    expect(corpse.position.x).toBeCloseTo(6)
    expect(corpse.position.z).toBeCloseTo(6)
  })
})

// FLO-383: the default forest zone must feed the combat event bridge so the
// audio bus (and HUD) actually react — otherwise the merged audio system is
// silent in the zone the player starts in.
describe('createForestScene — combat event bridge (audio/HUD feedback)', () => {
  beforeEach(() => {
    takeSpawn() // boot at the clearing centre so the soldier (6,6) is in range
  })

  function drive(game: { step(dt: number): void }, frames: number) {
    for (let i = 0; i < frames; i++) game.step(1 / 60)
  }

  it('emits a shake (player-hurt) event when a soldier strikes the player', () => {
    let shakes = 0
    const off = onShake(() => shakes++)
    const game = createForestScene(document.createElement('canvas'), {
      heroUrl: null,
      createEngine: () => new NullEngine(),
      isPaused: () => false,
    })
    drive(game, 600) // soldier closes in and lands a hit
    off()
    game.dispose()
    expect(shakes).toBeGreaterThan(0)
  })

  it('emits an attack (swing) event on the rising edge of the attack key', () => {
    let swings = 0
    const off = onAttack(() => swings++)
    const game = createForestScene(document.createElement('canvas'), {
      heroUrl: null,
      createEngine: () => new NullEngine(),
      isPaused: () => false,
    })
    // Hold the attack key (KeyF) so input.sample() reads it on the next frame.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))
    drive(game, 2)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }))
    off()
    game.dispose()
    expect(swings).toBe(1) // exactly once — edge-triggered, not per-frame
  })
})
