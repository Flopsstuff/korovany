import { useEffect, useRef } from 'react'
import { createGameEngine } from '../engine'
import {
  damagePlayer,
  pickUpLoot,
  raidCaravan,
  recordCombatKill,
  recordKill,
  selectLocomotionSpeedMultiplier,
  severPlayerLimb,
  store,
  useAppDispatch,
  useAppSelector,
} from '../store'
import { emitDismember } from '../game/combat'
import { resolveDismemberment } from '../game/health'
import { clearMinimapSnapshot, publishMinimapSnapshot } from '../game/minimap'
import { caravanLootToPickups } from '../store/caravanLootAdapter'
import { setAssetPhase } from '../store/streamingSlice'
import { createCaravanPlayground } from './caravanPlayground'
import { createControllerPlayground } from './controllerPlayground'
import { createForestScene } from './forestScene'
import { createMountainsScene } from './mountainsScene'
import { createImpostorBench } from './impostorBench'
import { createVegetationBench } from './vegetationBench'
import { createPerfBench } from './perfBench'
import { createOrdersPlayground } from './ordersPlayground'
import { createZoneScene } from './zoneScenes'

/**
 * Thin React wrapper around the Babylon engine. It owns nothing but the canvas
 * element and the mount/unmount lifecycle.
 *
 * Scene routing:
 * - `?dev=controller` — controller playground (E1.1 QA)
 * - `?dev=forest`     — forest zone standalone (E1.3 QA)
 * - `?dev=mountains`  — mountains (Black Crown Pass) zone standalone (E8.2 QA)
 * - `?dev=caravan`    — caravan ambush playground (E3.3 QA)
 * - `?dev=orders`     — commander/order playground (E4.3 QA)
 * - `?dev=impostor`   — dense-forest tree-impostor benchmark (E5.1 QA)
 * - `?dev=vegetation` — dense-forest thin-instance benchmark (E5.3 QA)
 * - `?dev=perf`       — performance-budget profiler over a dense forest (E5.4 QA)
 * - `phase === menu`  — engine smoke scene (hero preview, streaming HUD)
 * - `phase === playing | paused` — the active zone's scene, keyed by
 *   `playerSlice.zoneId` (E3.1). Fast-travel changes `zoneId`, which remounts
 *   the canvas with the new zone's scene; the staged spawn lands the player.
 *
 * Pause does NOT remount the scene — it keeps `inGame` true and `zoneId` stable
 * so the scene survives ESC toggles. Only the menu↔playing boundary and a
 * zone change cause a scene swap.
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dispatch = useAppDispatch()
  const phase = useAppSelector((state) => state.app.phase)
  const zoneId = useAppSelector((state) => state.player.zoneId)
  // Only the live run owns a zone scene. won/lost unmount it (the win/lose
  // overlay takes over above the menu smoke scene), so Restart boots a fresh one.
  const inGame = phase === 'playing' || phase === 'paused'

  // Mirror the live phase into a ref so the forest render loop can read "is
  // paused" every frame without re-running the mount effect — pause must not
  // remount the scene. The scene closure reads `phaseRef.current` at frame time
  // (FLO-326).
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dev = new URLSearchParams(window.location.search).get('dev')
    const game =
      dev === 'controller'
        ? createControllerPlayground(canvas)
        : dev === 'caravan'
          ? createCaravanPlayground(canvas)
          : dev === 'orders'
            ? createOrdersPlayground(canvas)
          : dev === 'forest'
            ? createForestScene(canvas)
          : dev === 'mountains'
            ? createMountainsScene(canvas)
          : dev === 'impostor'
            ? createImpostorBench(canvas)
          : dev === 'vegetation'
            ? createVegetationBench(canvas)
          : dev === 'perf'
            ? createPerfBench(canvas)
            : inGame
            ? createZoneScene(zoneId, canvas, {
                onPlayerDamaged: (amount) => {
                  dispatch(damagePlayer(amount))
                  // E6.1.2 combat → dismemberment hook: a heavy enemy blow can
                  // take a limb. Roll against the *current* injury state (read
                  // off the store singleton — this fires inside the Babylon
                  // loop, not a React render). On a sever, update the injury
                  // slice (which drives bleed-out / blackout / crawl) and fire
                  // the dismember event for downstream feedback. Combat is not
                  // reproducible, so a plain Math.random generator is fine.
                  const limb = resolveDismemberment(
                    amount,
                    store.getState().injury,
                    Math.random,
                  )
                  if (limb) {
                    dispatch(severPlayerLimb(limb))
                    emitDismember(limb)
                  }
                },
                // Close the loot loop (E3.5): adapt the caravan's aggregated drop
                // into one pickUpLoot per stack so the HUD inventory updates, then
                // advance the raid objective + score the haul (MPG.1).
                onCaravanLooted: (drop) => {
                  const pickups = caravanLootToPickups(drop)
                  for (const pickup of pickups) dispatch(pickUpLoot(pickup))
                  const lootPoints = pickups.reduce((sum, p) => sum + p.count, 0)
                  dispatch(raidCaravan(lootPoints))
                },
                onEnemyDefeated: (target) => dispatch(recordCombatKill(target)),
                // Score each enemy soldier defeated (MPG.1).
                onEnemyKilled: () => dispatch(recordKill()),
                isPaused: () => phaseRef.current === 'paused',
                // Leg-loss locomotion (MPG.6): the controller pulls this each
                // step so a severed leg (crawl) actually slows the capsule. Read
                // straight off the store singleton — a per-frame getter, not a
                // React-reactive value.
                getSpeedMultiplier: () => selectLocomotionSpeedMultiplier(store.getState()),
                // Minimap radar (FLO-449): the scene fires this throttled to
                // ~10 Hz; we stash the snapshot on the module bridge for the
                // <Minimap> rAF draw — no Redux/React state per tick.
                onMinimapTick: (snapshot) => publishMinimapSnapshot(snapshot),
              })
            : createGameEngine(canvas, {
                onAssetLoadingState: (id, phase) => dispatch(setAssetPhase({ id, phase })),
              })
    return () => {
      game.dispose()
      // Drop the radar frame so a torn-down zone never lingers on the minimap.
      clearMinimapSnapshot()
    }
  }, [inGame, zoneId, dispatch])

  return <canvas ref={canvasRef} className="render-canvas" />
}
