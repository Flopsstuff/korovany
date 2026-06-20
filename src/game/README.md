# game/

Engine-agnostic game logic — systems, entities, rules. No React imports here so
logic stays testable. Each subsystem splits a pure, `NullEngine`-testable core
from a thin Babylon binding; Babylon is used only at those bindings (and in
`streaming/` for GLB load glue).

## `loop/`

Fixed-timestep simulation loop (`FixedStepLoop`) decoupled from render FPS, plus
a tiny system-registration API (`SystemScheduler`, `System`). See
[`docs/guide/game-loop.md`](../../docs/guide/game-loop.md).

## `input/`

Keyboard/pointer → intent mapping: rebindable `bindings`, a DOM adapter, and the
pure `intent` reducer. See [`docs/guide/input-system.md`](../../docs/guide/input-system.md).

## `controller/`

Capsule character controller — pure movement math (gravity, ground clamp, jump,
coyote-time) plus a Babylon binding that runs as a loop `System`. See
[`docs/guide/character-controller.md`](../../docs/guide/character-controller.md).

## `camera/`

Third-person follow rig over Babylon's `ArcRotateCamera` with a collision-aware
boom. Documented alongside the controller in
[`docs/guide/character-controller.md`](../../docs/guide/character-controller.md).

## `streaming/`

Asset registry, lazy GLB loader (cache + ref-count dispose), and placeholder
spawn helper. See [`docs/guide/asset-streaming.md`](../../docs/guide/asset-streaming.md).

## `save/`

Save-slot store over IndexedDB (autosave on pause, slot rotation). See
[`docs/guide/save-system.md`](../../docs/guide/save-system.md).
