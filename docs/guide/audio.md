# Audio system & SFX

Korovany answers the board's "audible + visible feedback for every action" goal
(MPG / [FLO-355](/FLO/issues/FLO-355)) with a deliberately small, serverless
audio layer. This is the audio half of the combat juice shipped alongside the
visual feedback (screen-shake / hit-flash / damage numbers).

Source: [`src/game/audio/`](../../src/game/audio/).

## Design at a glance

- **Raw Web Audio, no library.** One lazily-created `AudioContext`, one master
  `GainNode` for mute/volume, and a `play(name)` that fans a cached
  `AudioBuffer` to the speakers. That's the whole runtime.
- **Event-driven, not scene-driven.** The bus subscribes to the existing
  [`damageEvents`](../../src/game/combat/damageEvents.ts) bridge — the same one
  the HUD consumes for damage numbers and shake. No `play()` calls live in the
  Babylon scene; the scene only *emits* events.
- **Procedurally synthesized SFX.** Every sound is generated from oscillator +
  noise math with gain envelopes — see [Why synthesis](#why-synthesis-not-files).

## Components

| File | Role |
|------|------|
| [`synth.ts`](../../src/game/audio/synth.ts) | Pure PCM generation: `renderTone`, `mix`, `renderClip`. No Web Audio — takes a sample rate, returns `Float32Array`. |
| [`sfx.ts`](../../src/game/audio/sfx.ts) | The named-sound recipe registry (`SfxName` → voices) and `renderSfx`. |
| [`audioBus.ts`](../../src/game/audio/audioBus.ts) | The `AudioBus`: lazy context, master gain, `play`, `unlock`, mute/volume + persistence, locomotion/ambience (`checkFootstep`, `startZoneAmbience`, `stopAmbience`), and `ZONE_AMBIENCE` mapping. Exports the shared `audioBus` singleton. |
| [`uiCues.ts`](../../src/game/audio/uiCues.ts) | UI cue API: `playUiClick`, `playUiHover`, `onUiClick`, `uiHoverProps` — menu surfaces route through here instead of raw `play()`. |
| [`../../src/app/useGameAudio.ts`](../../src/app/useGameAudio.ts) | React hook that wires events → `play()`, unlocks on first gesture, and rides win/lose stings off the app phase. |
| [`../../src/app/AudioControls.tsx`](../../src/app/AudioControls.tsx) | Mute toggle + volume slider embedded in the Settings panel. |

## Event → sound map

| Game event | Source | Sound |
|------------|--------|-------|
| Enemy takes a hit | `onDamage` | `hit` (low thud + noise transient) |
| Enemy dies | `onKill` | `kill` (falling death sting) |
| Player takes damage | `onShake` (fires only when the player is struck) | `playerHurt` (harsh low buzz) |
| Player swings | `onAttack` (new emitter, rising edge of the melee input) | `attack` (whoosh) |
| Run won | app phase → `won` | `win` (ascending major triad) |
| Run lost | app phase → `lost` | `lose` (descending minor fall) |
| UI button press | `playUiClick()` / `onUiClick()` | `uiClick` (tiny blip) |
| UI hover / focus | `playUiHover()` / `uiHoverProps()` | `uiHover` (softer tick, cooldown-gated) |

## UI cue API

Menu, faction picker, save manager, settings, and prosthetics shop buttons call
the helpers in [`uiCues.ts`](../../src/game/audio/uiCues.ts):

- **`playUiClick()`** — standard press blip; use in `onClick` handlers.
- **`playUiHover()`** — softer focus/hover tick; rate-limited to 80 ms so
  keyboard focus sweeps do not spam the bus.
- **`onUiClick(handler?)`** — wraps a handler so the click cue always fires first.
- **`uiHoverProps()`** — `{ onMouseEnter, onFocus }` to spread on buttons/links.

Never call `audioBus.play('uiClick')` directly from UI code — the cue API keeps
naming and cooldown policy in one place.

## Locomotion & zone ambience

These sounds are **transform-driven**, not `damageEvents`-driven, so they live
as methods on the bus rather than in `useGameAudio`:

| Game state | Driver | Sound |
|------------|--------|-------|
| Player walking on the ground | `audioBus.checkFootstep(...)` once per frame | `footstep` (short low thud + tap), gated by a `0.4 s` cooldown and a `0.01`-unit movement threshold |
| In-run zone bed | `audioBus.startZoneAmbience(zoneId)` / `stopAmbience()` | Per-zone looped beds (see table below) |

Wiring lives in [`App.tsx`](../../src/app/App.tsx): a `requestAnimationFrame`
loop active only while `phase === 'playing'` reads the player transform
(`readPlayerTransform`), feeds the real frame `dt` (clamped to `0.1 s` so a
backgrounded tab can't burst-fire steps) into `checkFootstep`, and starts/stops
the looped ambience on phase entry/exit keyed on `playerSlice.zoneId`. The
footstep cooldown is advanced by `dt` (not wall-clock), so it is frame-rate
independent and deterministic in tests.

### Zone ambience beds

| Zone id | SFX name | Character |
|---------|----------|-----------|
| `forest` | `forestAmbience` | Wind, crickets, low drone |
| `human-lands` | `humanLandsAmbience` | Open breeze, warm mid drone |
| `empire` | `empireAmbience` | Low march pulse (ready when the zone ships) |
| `mountains` | `mountainsAmbience` | Cold wind, high whistle (ready when the zone ships) |

- **`checkFootstep(grounded, pos, lastPos, dt)`** — advances the step clock by
  `dt`; plays `footstep` when grounded, moved past the threshold, and the
  cooldown has elapsed. A `null` `lastPos` (first frame) only seeds timing.
- **`startZoneAmbience(zoneId)` / `stopAmbience()`** — idempotent start; switches
  tracks when the zone changes. Silent until audio is unlocked.
  `getAmbienceZoneId()` reports which bed is playing. `startAmbience()` remains a
  forest alias for older call sites.

## Autoplay policy

Browsers leave a fresh `AudioContext` **suspended** until a user gesture.
`useGameAudio` installs one-time `pointerdown` / `keydown` listeners that call
`audioBus.unlock()` (which `resume()`s the context) and then detach. Before that
gesture, `play()` is a silent no-op — so there are **no autoplay console
warnings** and no errors if a sound is requested early.

## Settings & persistence

Mute and master volume are owned by the bus and persisted to **`localStorage`**
under the key **`korovany-audio`** as `{ muted: boolean, volume: number }`
(defaults `{ false, 0.7 }`, volume clamped to `[0, 1]`). The pause-menu control
writes through `audioBus.setMuted` / `setVolume` and re-renders off
`audioBus.subscribe`, so any surface that changes settings stays in sync. Zone
beds and UI cues respect the same master gain — no separate music bus.

## Why synthesis, not files

The task brief allowed bundled CC0 sample files (LFS). We chose procedural
synthesis instead because it scores better on every decision lens that matters
here:

- **Budgets are real:** zero binary payload — no Git LFS objects, no extra
  network fetch, nothing to lazy-load.
- **Licensing:** we author every waveform, so each clip is unambiguously
  CC0-equivalent — the strongest possible answer to "never commit non-CC0."
- **Boring tech:** it *is* raw Web Audio (oscillator/noise + envelopes); no
  audio library, no asset pipeline.
- **Testable:** the generators are pure functions, unit-tested without a real
  `AudioContext`.

The buffer path is the only thing that would change if we later want recorded
samples: decode a file into an `AudioBuffer` instead of synthesizing one. The
bus, wiring, events, and UI stay put. (Because no audio files ship, there is no
audio entry in [`assets.md`](assets.md) — that catalog covers binary assets
only.)

## Testing

jsdom has no real Web Audio API, so:

- `synth` / `sfx` are pure — assert PCM length, range, and determinism directly.
- `uiCues` is tested with a mocked `audioBus.play` — asserts routing and hover
  cooldown.
- `audioBus` is tested against a **stubbed `AudioContext`** and an in-memory
  `Storage` double, both injected via `new AudioBus({ createContext, storage })`.
  Asserts routing (source → master gain → destination), mute/volume gating,
  buffer caching, persistence round-trip, the suspended-context no-op, zone
  ambience switching, and the footstep cooldown/threshold behaviour.

See [`testing.md`](testing.md) for the project-wide stubbing patterns.
