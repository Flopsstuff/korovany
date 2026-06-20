import { useCallback, useEffect, useRef, useState } from 'react'
import { GameCanvas } from '../scenes/GameCanvas'
import { InventoryPanel } from './InventoryPanel'
import { WorldMap } from '../components/WorldMap'
import { FactionPicker } from '../components/FactionPicker'
import { PLAYABLE_FACTIONS, type PlayableFactionId } from '../game/faction'
import { hasSave, loadLatest, saveGame } from '../game/save'
import { listZones, planTravel, type ZoneId } from '../game/world'
import {
  applyPlayerTransform,
  readPlayerTransform,
  stageSpawn,
} from '../game/save/playerRuntime'
import {
  continueGame,
  resetInjuries,
  resetInventory,
  resetPlayer,
  resetPlayerHealth,
  restoreInventory,
  restorePlayer,
  restorePlayerHealth,
  returnToMenu,
  selectIsBleeding,
  selectIsStreamingLoading,
  selectPlayerFactionId,
  setPlayerFaction,
  setZone,
  startNewGame,
  tickInjuries,
  togglePause,
  useAppDispatch,
  useAppSelector,
} from '../store'

/** Static zone list for the world map (registry order). */
const ZONES = listZones()

/**
 * App shell: a full-viewport stage holding the 3D canvas with React overlays
 * above it. The app state machine owns coarse flow while Babylon remains
 * isolated behind GameCanvas.
 *
 * It also owns the save/load wiring (E1.4): autosave whenever the game enters
 * `paused`, and a **Continue** button that restores the latest save. The live
 * capsule transform crosses the React↔Babylon boundary only through the save
 * `playerRuntime` bridge — never a direct mesh reference. Health is sourced from
 * the canonical `healthSlice`; the zone id from `playerSlice`.
 *
 * See `src/styles/global.css` for the no-scroll, full-page reset and the
 * `.app-shell` / overlay layering.
 */
export function App() {
  const dispatch = useAppDispatch()
  const phase = useAppSelector((state) => state.app.phase)
  const health = useAppSelector((state) => state.health.player)
  const zoneId = useAppSelector((state) => state.player.zoneId)
  const inventory = useAppSelector((state) => state.inventory)
  const playerFactionId = useAppSelector(selectPlayerFactionId)
  const isLoadingAssets = useAppSelector(selectIsStreamingLoading)
  const isBleeding = useAppSelector(selectIsBleeding)
  const menuPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const pausePrimaryActionRef = useRef<HTMLButtonElement>(null)

  const [hasSaveSlot, setHasSaveSlot] = useState(false)
  // Main menu sub-view: the landing actions, or the New-Game faction picker.
  const [menuView, setMenuView] = useState<'main' | 'factions'>('main')
  // World-map / fast-travel overlay (E3.1). `traveling` keeps the overlay in its
  // "Travelling…" state until the destination scene has streamed in.
  const [worldMapOpen, setWorldMapOpen] = useState(false)
  const [traveling, setTraveling] = useState(false)

  // Return to menu on player death; reset HP and injuries so a subsequent New
  // Game starts fresh. Death is a consequence of the live sim, so it is only
  // processed while `playing` — never while `paused`, where combat is frozen and
  // the player cannot take damage (FLO-326).
  useEffect(() => {
    if (phase !== 'playing') return
    if (health.current > 0) return
    dispatch(resetPlayerHealth())
    dispatch(resetInjuries())
    dispatch(returnToMenu())
  }, [health.current, phase, dispatch])

  // Bleed-out: while a wound is untreated and the game is live, drain HP each
  // second. tickInjuries funnels the damage into the health system, so an
  // untreated bleed reaches 0 HP and triggers the death effect above.
  useEffect(() => {
    if (phase !== 'playing') return
    if (!isBleeding) return
    const id = window.setInterval(() => dispatch(tickInjuries(1)), 1000)
    return () => window.clearInterval(id)
  }, [isBleeding, phase, dispatch])

  // Latest player scalars, read at autosave time without re-arming the pause
  // effect every time health/zone change.
  const snapshotRef = useRef({ health, zoneId, inventory, playerFactionId })
  snapshotRef.current = { health, zoneId, inventory, playerFactionId }

  // Probe whether a save exists so the Continue button can render enabled/empty.
  useEffect(() => {
    let active = true
    void hasSave()
      .then((exists) => {
        if (active) setHasSaveSlot(exists)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (phase === 'menu') menuPrimaryActionRef.current?.focus()
    else if (phase === 'paused') pausePrimaryActionRef.current?.focus()
  }, [phase])

  // Autosave on the transition into `paused`. The transform comes from the live
  // scene via the bridge; health from `healthSlice`, zone from `playerSlice`. No
  // scene mounted → skip.
  useEffect(() => {
    if (phase !== 'paused') return
    const transform = readPlayerTransform()
    if (!transform) return
    const { health: hp, zoneId: zone, inventory: inv, playerFactionId: faction } =
      snapshotRef.current
    void saveGame(
      { transform, health: hp, zoneId: zone, inventory: inv, playerFactionId: faction },
      Date.now(),
    )
      .then(() => setHasSaveSlot(true))
      .catch(() => {})
  }, [phase])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Escape closes the world map first (if open), otherwise toggles pause.
      if (event.code === 'Escape') {
        event.preventDefault()
        if (worldMapOpen) {
          if (!traveling) setWorldMapOpen(false)
          return
        }
        dispatch(togglePause())
        return
      }
      // M opens/closes the world map, but only during live play.
      if (event.code === 'KeyM' && phase === 'playing') {
        event.preventDefault()
        if (!traveling) setWorldMapOpen((open) => !open)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, phase, worldMapOpen, traveling])

  // Fast-travel: validate the destination, stage its spawn on the playerRuntime
  // bridge, then switch zones. Changing `zoneId` remounts the GameCanvas with the
  // destination scene, which consumes the staged spawn on boot (`takeSpawn`).
  const onTravel = useCallback(
    (target: ZoneId) => {
      const result = planTravel(snapshotRef.current.zoneId, target)
      if (!result.ok) return // locked/current are already disabled in the UI
      setTraveling(true)
      stageSpawn(result.plan.spawn)
      dispatch(setZone(target))
    },
    [dispatch],
  )

  // A committed travel completes once the destination scene has streamed in.
  // Wait one frame after streaming settles so the new scene is mounted, then
  // dismiss the overlay. (Stub zones stream nothing, so this is near-instant.)
  useEffect(() => {
    if (!traveling) return
    if (isLoadingAssets) return
    const id = window.requestAnimationFrame(() => {
      setTraveling(false)
      setWorldMapOpen(false)
    })
    return () => window.cancelAnimationFrame(id)
  }, [traveling, isLoadingAssets])

  // Leaving play (death, quit-to-menu) tears the overlay down with the session.
  useEffect(() => {
    if (phase === 'menu') {
      setWorldMapOpen(false)
      setTraveling(false)
      setMenuView('main')
    }
  }, [phase])

  // New Game opens the faction picker; the campaign only starts once a faction
  // is chosen so the choice is recorded in `factionSlice` and the save.
  const onNewGame = useCallback(() => {
    setMenuView('factions')
  }, [])

  const onBeginWithFaction = useCallback(
    (factionId: PlayableFactionId) => {
      dispatch(resetPlayer())
      dispatch(resetPlayerHealth())
      dispatch(resetInventory())
      dispatch(setPlayerFaction(factionId))
      dispatch(startNewGame())
    },
    [dispatch],
  )

  const onContinue = useCallback(async () => {
    const data = await loadLatest()
    if (!data) return
    // Stage for a scene that boots later; teleport the one already running.
    stageSpawn(data.transform)
    applyPlayerTransform(data.transform)
    dispatch(restorePlayerHealth(data.health))
    dispatch(restorePlayer({ zoneId: data.zoneId }))
    dispatch(restoreInventory(data.inventory))
    dispatch(setPlayerFaction(data.playerFactionId))
    dispatch(continueGame())
  }, [dispatch])

  return (
    <div className="app-shell">
      <GameCanvas />
      {isLoadingAssets ? <p className="hud-loading">Loading…</p> : null}
      {phase !== 'menu' ? (
        <div className="hud">
          <h1>Korovany</h1>
          <div
            className="hud-health"
            role="group"
            aria-label={`Player health: ${health.current} of ${health.max} hit points`}
          >
            <span className="hud-health-label">HP</span>
            <span className="hud-health-bar" aria-hidden="true">
              <span
                className="hud-health-fill"
                style={{ width: `${Math.max(0, (health.current / health.max) * 100)}%` }}
              />
            </span>
            <span className="hud-health-value">
              {health.current}/{health.max}
            </span>
          </div>
          <InventoryPanel inventory={inventory} />
          {phase === 'playing' ? (
            <button
              type="button"
              className="hud-travel"
              onClick={() => setWorldMapOpen(true)}
            >
              Travel <kbd>M</kbd>
            </button>
          ) : null}
        </div>
      ) : null}
      {worldMapOpen ? (
        <WorldMap
          zones={ZONES}
          currentZoneId={zoneId}
          status={traveling ? 'loading' : 'idle'}
          onTravel={onTravel}
          onClose={() => {
            if (!traveling) setWorldMapOpen(false)
          }}
        />
      ) : null}
      {phase === 'menu' && menuView === 'factions' ? (
        <FactionPicker
          factions={PLAYABLE_FACTIONS}
          onConfirm={onBeginWithFaction}
          onBack={() => setMenuView('main')}
        />
      ) : null}
      {phase === 'menu' && menuView === 'main' ? (
        <main className="menu-overlay" aria-labelledby="main-menu-title">
          <div className="menu-panel">
            <p className="menu-kicker">Forest vertical slice</p>
            <h1 id="main-menu-title">Korovany</h1>
            <div className="menu-actions" aria-label="Main menu actions">
              <button
                ref={menuPrimaryActionRef}
                type="button"
                className="primary-action"
                onClick={onNewGame}
              >
                New Game
              </button>
              <button
                type="button"
                onClick={() => void onContinue()}
                disabled={!hasSaveSlot}
                aria-disabled={!hasSaveSlot}
              >
                Continue
              </button>
            </div>
            {!hasSaveSlot ? (
              <p className="menu-hint">No saved game yet — start a new game.</p>
            ) : null}
          </div>
        </main>
      ) : null}
      {phase === 'paused' ? (
        <div
          className="pause-overlay"
          role="dialog"
          aria-labelledby="pause-title"
          aria-modal="true"
        >
          <div className="pause-panel">
            <h2 id="pause-title">Paused</h2>
            <div className="menu-actions" aria-label="Pause actions">
              <button
                ref={pausePrimaryActionRef}
                type="button"
                className="primary-action"
                onClick={() => dispatch(togglePause())}
              >
                Resume
              </button>
              <button type="button" onClick={() => dispatch(returnToMenu())}>
                Quit to Main Menu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
