# game/

Engine-agnostic game logic — systems, entities, rules. No React imports here so
logic stays testable. Babylon is used only in `streaming/` for GLB load glue.

## `loop/`

Fixed-timestep simulation loop (`FixedStepLoop`) decoupled from render FPS, plus
a tiny system-registration API (`SystemScheduler`, `System`). See
[`docs/guide/game-loop.md`](../../docs/guide/game-loop.md).

## `streaming/`

Asset registry, lazy GLB loader (cache + ref-count dispose), and placeholder
spawn helper. See [`docs/guide/asset-streaming.md`](../../docs/guide/asset-streaming.md).
