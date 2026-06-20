import { useEffect, useRef } from 'react'
import { createGameEngine } from '../engine'
import {
  damagePlayer,
  pickUpLoot,
  raidCaravan,
  recordCombatKill,
  recordKill,
  selectLocomotionSpeedMultiplier,
  store,
  useAppDispatch,
  useAppSelector,
} from '../store'
import { caravanLootToPickups } from '../store/caravanLootAdapter'
import { setAssetPhase } from '../store/streamingSlice'
import { createCaravanPlayground } from './caravanPlayground'
import { createControllerPlayground } from './controllerPlayground'
import { createForestScene } from './forestScene'
import { createOrdersPlayground } from './ordersPlayground'
import { createZoneScene } from './zoneScenes'

/**
 * Thin React wrapper around the Babylon engine. It owns nothing but the canvas
 * element and the mount/unmount lifecycle.
 *
 * Scene routing:
 * - `?dev=controller` — controller playground (E1.1 QA)
 * - `?dev=forest`     — forest zone standalone (E1.3 QA)
 * - `?dev=caravan`    — caravan ambush playground (E3.3 QA)
 * - `?dev=orders`     — commander/order playground (E4.3 QA)
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
            : inGame
            ? createZoneScene(zoneId, canvas, {
                onPlayerDamaged: (amount) => dispatch(damagePlayer(amount)),
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
              })
            : createGameEngine(canvas, {
                onAssetLoadingState: (id, phase) => dispatch(setAssetPhase({ id, phase })),
              })
    return () => game.dispose()
  }, [inGame, zoneId, dispatch])

  return <canvas ref={canvasRef} className="render-canvas" />
}
