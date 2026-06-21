import { useCallback, useEffect, useRef, useState } from 'react'
import { GameCanvas } from '../scenes/GameCanvas'
import { InventoryPanel } from './InventoryPanel'
import { DamageNumbers, type DamageNumberEntry } from './DamageNumber'
import { useGameAudio } from './useGameAudio'
import { onDamage } from '../game/combat/damageEvents'
import { audioBus } from '../game/audio'
import { WorldMap } from '../components/WorldMap'
import { OnboardingIntroCard } from '../components/OnboardingIntroCard'
import { SettingsPanel } from '../components/SettingsPanel'
import { FactionPicker } from '../components/FactionPicker'
import { ProstheticsShop, prostheticFailureMessage } from '../components/ProstheticsShop'
import { PLAYABLE_FACTIONS, type PlayableFactionId } from '../game/faction'
import { BANDAGE_ITEM_ID, totalItemCount, type ProstheticKind } from '../game/economy'
import { hasSave, loadLatest, saveGame } from '../game/save'
import { listZones, planTravel, type ZoneId } from '../game/world'
import {
  applyPlayerTransform,
  readPlayerTransform,
  stageSpawn,
} from '../game/save/playerRuntime'
import {
  continueGame,
  dismissOnboardingIntro,
  loseGame,
  resetInjuries,
  resetInventory,
  resetPlayer,
  resetPlayerHealth,
  resetProgression,
  resetRun,
  restoreInventory,
  restorePlayer,
  restorePlayerHealth,
  restoreProgression,
  returnToMenu,
  purchaseProsthetic,
  selectHasHalfScreenBlackout,
  selectGold,
  selectInjury,
  selectIsBleeding,
  selectIsStreamingLoading,
  selectPlayerFactionId,
  selectScore,
  setPlayerFaction,
  setZone,
  startNewGame,
  tickInjuries,
  togglePause,
  useAppDispatch,
  useAppSelector,
  useBandage,
  winGame,
} from '../store'
import { evaluateOutcome } from '../game/objective/objectiveMachine'

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
  const showOnboardingIntro = useAppSelector((state) => state.app.showOnboardingIntro)
  const health = useAppSelector((state) => state.health.player)
  const zoneId = useAppSelector((state) => state.player.zoneId)
  const inventory = useAppSelector((state) => state.inventory)
  const injury = useAppSelector(selectInjury)
  const goldBalance = useAppSelector(selectGold)
  const playerFactionId = useAppSelector(selectPlayerFactionId)
  const progression = useAppSelector((state) => state.progression)
  const caravansRaided = useAppSelector((state) => state.game.caravansRaided)
  const objectiveTarget = useAppSelector((state) => state.game.objectiveTarget)
  const isLoadingAssets = useAppSelector(selectIsStreamingLoading)
  const isBleeding = useAppSelector(selectIsBleeding)
  const hasHalfScreenBlackout = useAppSelector(selectHasHalfScreenBlackout)
  const score = useAppSelector(selectScore)
  const lootCount = totalItemCount(inventory)
  const bandageCount = inventory.counts[BANDAGE_ITEM_ID] ?? 0
  const menuPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const onboardingPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const pausePrimaryActionRef = useRef<HTMLButtonElement>(null)
  const settingsPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const endgamePrimaryActionRef = useRef<HTMLButtonElement>(null)

  const [damageNumbers, setDamageNumbers] = useState<DamageNumberEntry[]>([])
  const nextDmgId = useRef(0)
  // Footstep tracking: last known position, or null on first frame
  const lastPlayerPosRef = useRef<{ x: number; y: number; z: number } | null>(null)

  useEffect(() => {
    return onDamage((amount, screenX, screenY) => {
      const id = nextDmgId.current++
      setDamageNumbers((prev) => [...prev, { id, amount, x: screenX, y: screenY }])
    })
  }, [])

  // Audio: subscribe the bus to combat events, unlock on first gesture, and play
  // win/lose stings on phase change. Mirrors the HUD's event-driven consumption.
  useGameAudio(phase)

  // Locomotion + ambience: loop forest ambience while playing and emit a
  // footstep whenever the player's transform moves far enough on the ground.
  useEffect(() => {
    if (phase !== 'playing') {
      audioBus.stopAmbience()
      lastPlayerPosRef.current = null
      return
    }

    audioBus.startAmbience()

    // Browsers gate audio until a user gesture; unlock on the first interaction.
    const tryUnlock = () => {
      void audioBus.unlock()
      audioBus.startAmbience() // start now that the context can produce sound
      window.removeEventListener('pointerdown', tryUnlock)
      window.removeEventListener('keydown', tryUnlock)
    }
    window.addEventListener('pointerdown', tryUnlock)
    window.addEventListener('keydown', tryUnlock)

    let frameId = 0
    let lastTs: number | null = null
    const tick = (ts: number) => {
      // Real frame delta (seconds), clamped so a backgrounded tab can't fire a
      // burst of steps on resume.
      const dt = lastTs === null ? 1 / 60 : Math.min(0.1, (ts - lastTs) / 1000)
      lastTs = ts
      const transform = readPlayerTransform()
      if (transform) {
        const pos = { x: transform.position.x, y: transform.position.y, z: transform.position.z }
        // The player walks on flat terrain here, so they are always grounded.
        audioBus.checkFootstep(true, pos, lastPlayerPosRef.current, dt)
        lastPlayerPosRef.current = pos
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointerdown', tryUnlock)
      window.removeEventListener('keydown', tryUnlock)
      cancelAnimationFrame(frameId)
      audioBus.stopAmbience()
    }
  }, [phase])

  const [hasSaveSlot, setHasSaveSlot] = useState(false)
  // Main menu sub-view: the landing actions, or the New-Game faction picker.
  const [menuView, setMenuView] = useState<'main' | 'factions'>('main')
  // World-map / fast-travel overlay (E3.1). `traveling` keeps the overlay in its
  // "Travelling…" state until the destination scene has streamed in.
  const [worldMapOpen, setWorldMapOpen] = useState(false)
  const [traveling, setTraveling] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [prostheticsOpen, setProstheticsOpen] = useState(false)
  const [prostheticsMessage, setProstheticsMessage] = useState<string | null>(null)

  // Win/lose loop (MPG.1). Each frame the live progress — caravans raided + the
  // player's death — flows through the pure `evaluateOutcome` machine, which
  // drives the app phase to the win or lose screen. Death takes priority over
  // victory. Only processed while `playing`: paused freezes combat, so the
  // player can neither die nor finish the objective there (FLO-326). HP and run
  // state are NOT reset here — the screen shows the final tally; Restart resets.
  useEffect(() => {
    if (phase !== 'playing') return
    const outcome = evaluateOutcome({
      caravansRaided,
      target: objectiveTarget,
      playerDead: health.current <= 0,
    })
    if (outcome === 'won') dispatch(winGame())
    else if (outcome === 'lost') dispatch(loseGame())
  }, [phase, caravansRaided, objectiveTarget, health.current, dispatch])

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
  const snapshotRef = useRef({ health, zoneId, inventory, playerFactionId, progression })
  snapshotRef.current = { health, zoneId, inventory, playerFactionId, progression }

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
    if (settingsOpen) settingsPrimaryActionRef.current?.focus()
    else if (phase === 'menu') menuPrimaryActionRef.current?.focus()
    else if (showOnboardingIntro) onboardingPrimaryActionRef.current?.focus()
    else if (phase === 'paused') pausePrimaryActionRef.current?.focus()
    else if (phase === 'won' || phase === 'lost') endgamePrimaryActionRef.current?.focus()
  }, [phase, showOnboardingIntro, settingsOpen])

  // Autosave on the transition into `paused`. The transform comes from the live
  // scene via the bridge; health from `healthSlice`, zone from `playerSlice`. No
  // scene mounted → skip.
  useEffect(() => {
    if (phase !== 'paused') return
    const transform = readPlayerTransform()
    if (!transform) return
    const { health: hp, zoneId: zone, inventory: inv, playerFactionId: faction, progression: prog } =
      snapshotRef.current
    void saveGame(
      { transform, health: hp, zoneId: zone, inventory: inv, playerFactionId: faction, progression: prog },
      Date.now(),
    )
      .then(() => setHasSaveSlot(true))
      .catch(() => {})
  }, [phase])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (settingsOpen) {
        if (event.code === 'Escape') {
          event.preventDefault()
          setSettingsOpen(false)
        }
        return
      }
      if (showOnboardingIntro) {
        if (event.code === 'Escape') {
          event.preventDefault()
          dispatch(dismissOnboardingIntro())
        }
        return
      }
      // Escape closes the world map first (if open), otherwise toggles pause.
      if (event.code === 'Escape') {
        event.preventDefault()
        if (prostheticsOpen) {
          setProstheticsOpen(false)
          setProstheticsMessage(null)
          return
        }
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
        if (!traveling) {
          setProstheticsOpen(false)
          setProstheticsMessage(null)
          setWorldMapOpen((open) => !open)
        }
      }
      // P opens the prosthetics shop from any safe HUD moment in live play.
      if (event.code === 'KeyP' && phase === 'playing') {
        event.preventDefault()
        if (!traveling) {
          setWorldMapOpen(false)
          setProstheticsMessage(null)
          setProstheticsOpen((open) => !open)
        }
      }
      // B spends a carried bandage to stop bleeding (P7.2 counterplay). The
      // thunk is a no-op when not bleeding or out of bandages, so it's safe to
      // fire unconditionally during play.
      if (event.code === 'KeyB' && phase === 'playing') {
        event.preventDefault()
        dispatch(useBandage())
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    dispatch,
    phase,
    prostheticsOpen,
    worldMapOpen,
    traveling,
    showOnboardingIntro,
    settingsOpen,
  ])

  const onBuyProsthetic = useCallback(
    (kind: ProstheticKind) => {
      const result = dispatch(purchaseProsthetic(kind))
      if (result.ok) {
        setProstheticsMessage(`Fitted ${kind} prosthetic for ${result.price} gold pieces.`)
        return
      }
      setProstheticsMessage(prostheticFailureMessage(result.reason))
    },
    [dispatch],
  )

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
      setProstheticsOpen(false)
      setProstheticsMessage(null)
      setMenuView('main')
    }
    if (phase !== 'menu' && phase !== 'paused') {
      setSettingsOpen(false)
    }
  }, [phase])

  // Wipe every per-run slice — player, health, injuries, inventory, progression,
  // and the objective/score run state — back to a fresh start. Shared by the
  // New-Game faction flow and the win/lose Restart so both begin clean.
  const resetRunState = useCallback(() => {
    dispatch(resetPlayer())
    dispatch(resetPlayerHealth())
    dispatch(resetInjuries())
    dispatch(resetInventory())
    dispatch(resetProgression())
    dispatch(resetRun())
  }, [dispatch])

  // New Game opens the faction picker; the campaign only starts once a faction
  // is chosen so the choice is recorded in `factionSlice` and the save.
  const onNewGame = useCallback(() => {
    audioBus.play('uiClick')
    setMenuView('factions')
  }, [])

  const onBeginWithFaction = useCallback(
    (factionId: PlayableFactionId) => {
      resetRunState()
      dispatch(setPlayerFaction(factionId))
      dispatch(startNewGame({ showIntro: true }))
    },
    [resetRunState, dispatch],
  )

  // Restart from the win/lose screen: fresh run, same faction (no need to
  // re-pick), straight back into play (MPG.1).
  const onRestart = useCallback(() => {
    audioBus.play('uiClick')
    resetRunState()
    dispatch(startNewGame())
  }, [resetRunState, dispatch])

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
    dispatch(restoreProgression(data.progression))
    // The objective/score aren't persisted yet — resume with a fresh tally.
    dispatch(resetRun())
    dispatch(continueGame())
  }, [dispatch])

  return (
    <div className="app-shell">
      <GameCanvas />
      <DamageNumbers
        entries={damageNumbers}
        onExpire={(id) => setDamageNumbers((prev) => prev.filter((e) => e.id !== id))}
      />
      {phase !== 'menu' && hasHalfScreenBlackout ? (
        <div className="injury-vignette" aria-hidden="true" />
      ) : null}
      {isLoadingAssets ? <p className="hud-loading">Loading…</p> : null}
      {showOnboardingIntro && phase === 'playing' ? (
        <OnboardingIntroCard
          objectiveTarget={objectiveTarget}
          dismissButtonRef={onboardingPrimaryActionRef}
          onDismiss={() => dispatch(dismissOnboardingIntro())}
        />
      ) : null}
      {phase === 'playing' || phase === 'paused' ? (
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
          <p
            className="hud-objective"
            aria-label={`Objective: raid ${objectiveTarget} caravans — ${Math.min(
              caravansRaided,
              objectiveTarget,
            )} done`}
          >
            <span className="hud-objective-label">Raid caravans</span>
            <span className="hud-objective-count">
              {Math.min(caravansRaided, objectiveTarget)}/{objectiveTarget}
            </span>
          </p>
          {isBleeding ? (
            <div className="hud-bleeding" role="status">
              <span className="hud-bleeding-dot" aria-hidden="true" />
              {bandageCount > 0 ? (
                <>
                  Bleeding — press <kbd>B</kbd> to bandage ({bandageCount})
                </>
              ) : (
                'Bleeding — find a bandage'
              )}
            </div>
          ) : null}
          <div className="hud-score" role="group" aria-label="Score">
            <span className="hud-score-stat">
              <span className="hud-score-label">Score</span>
              <span className="hud-score-value">{score}</span>
            </span>
            <span className="hud-score-sep" aria-hidden="true">
              ·
            </span>
            <span className="hud-score-stat">
              <span className="hud-score-label">Loot</span>
              <span className="hud-score-value">{lootCount}</span>
            </span>
          </div>
          <InventoryPanel inventory={inventory} />
          {phase === 'playing' ? (
            <>
              <button
                type="button"
                className="hud-travel"
                onClick={() => {
                  setProstheticsOpen(false)
                  setProstheticsMessage(null)
                  setWorldMapOpen(true)
                }}
              >
                Travel <kbd>M</kbd>
              </button>
              <button
                type="button"
                className="hud-prosthetics"
                onClick={() => {
                  setWorldMapOpen(false)
                  setProstheticsMessage(null)
                  setProstheticsOpen(true)
                }}
              >
                Prosthetics <kbd>P</kbd>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {prostheticsOpen ? (
        <ProstheticsShop
          injury={injury}
          goldBalance={goldBalance}
          message={prostheticsMessage}
          onBuy={onBuyProsthetic}
          onClose={() => {
            setProstheticsOpen(false)
            setProstheticsMessage(null)
          }}
        />
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
              <button
                type="button"
                onClick={() => {
                  audioBus.play('uiClick')
                  setSettingsOpen(true)
                }}
              >
                Settings
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
                onClick={() => {
                  audioBus.play('uiClick')
                  dispatch(togglePause())
                }}
              >
                Resume
              </button>
              <button type="button" onClick={() => dispatch(returnToMenu())}>
                Quit to Main Menu
              </button>
              <button
                type="button"
                onClick={() => {
                  audioBus.play('uiClick')
                  setSettingsOpen(true)
                }}
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {settingsOpen ? (
        <SettingsPanel
          closeButtonRef={settingsPrimaryActionRef}
          onClose={() => {
            audioBus.play('uiClick')
            setSettingsOpen(false)
          }}
        />
      ) : null}
      {phase === 'won' || phase === 'lost' ? (
        <div
          className={`menu-overlay endgame-overlay endgame-overlay--${phase}`}
          role="dialog"
          aria-labelledby="endgame-title"
          aria-modal="true"
        >
          <div className="menu-panel endgame-panel">
            <p className="menu-kicker">{phase === 'won' ? 'Victory' : 'Defeated'}</p>
            <h1 id="endgame-title">
              {phase === 'won' ? 'Korovany raided' : 'You fell in the forest'}
            </h1>
            <p className="menu-hint endgame-summary">
              {phase === 'won'
                ? `You raided ${objectiveTarget} caravans.`
                : 'The raid is over.'}{' '}
              Final score: <strong>{score}</strong>.
            </p>
            <div className="menu-actions" aria-label="End-of-run actions">
              <button
                ref={endgamePrimaryActionRef}
                type="button"
                className="primary-action"
                onClick={onRestart}
              >
                Restart
              </button>
              <button type="button" onClick={() => dispatch(returnToMenu())}>
                Main Menu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
