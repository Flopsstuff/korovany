# Performance budget & profiling (E5.4)

> Phase 5, FLO-398. Keeps the game at **60fps on mid hardware**. The budget is
> defined as **data** (`src/game/perf/budget.ts`) so a profiler and unit tests can
> grade any frame without a GL context. Sits on top of the dense-forest work that
> exists to stay inside it: thin-instanced vegetation ([asset-streaming.md](asset-streaming.md))
> and impostor LOD ([asset-streaming.md](asset-streaming.md#tree-impostors-e51)).

## The budget

The single hard target is **60fps** — a **16.67ms** frame. Everything else is a
cheap proxy the profiler reads each frame.

| Metric           | Limit       | Why |
| ---------------- | ----------- | --- |
| `fps`            | ≥ **60**    | The actual target (floor, higher is better). |
| `frameMs`        | ≤ **16.67** | Mean frame time for 60fps. |
| `drawCalls`      | ≤ **300**   | Draw-call submission is the CPU bottleneck on the reference machine; thin-instancing keeps a dense forest well under this. |
| `activeIndices`  | ≤ **3,000,000** | ≈ 1M triangles rendered after culling + impostor LOD; bounds GPU vertex work. |

These are **budgets, not hard limits** — exceeding one is a signal to profile,
not a crash. The constants live in `PERF_BUDGET`; tune them against real captures.

### "Mid hardware"

The reference machine is a 2019-era integrated-GPU laptop (Intel Iris / entry
Apple-silicon class) running the game full-page in a browser tab. The numbers are
deliberately conservative: a frame that passes on the reference machine has
headroom on anything newer.

## API

```ts
import {
  PERF_BUDGET,
  evaluateFrameBudget,
  createFrameProfiler,
  createPerfHud,
} from '../game/perf'
```

- **`evaluateFrameBudget(metrics, budget?)`** — pure. Takes `{ fps, frameMs,
  drawCalls, activeIndices }`, returns a `BudgetReport` with per-metric
  `lines`, the failing `violations`, and a `withinBudget` boolean. fps is a
  floor; the rest are ceilings; a value *exactly* at the limit passes.
- **`createFrameProfiler(scene, opts?)`** — wraps a Babylon `Scene` with
  `SceneInstrumentation`, samples draw calls + frame time + active indices each
  frame, and grades a **rolling mean** (default window 60 frames ≈ 1s) so a
  single hitched frame doesn't flip the verdict. `opts.readMetrics` injects a
  metrics source — that seam is how the profiler is unit-tested under
  `NullEngine` (which renders nothing, so the real counters stay at 0).
- **`createPerfHud(parent?)`** — a dependency-free DOM overlay that renders a
  `BudgetReport`: one coloured row per metric (green within / red over) and a
  header that flips to **OVER BUDGET** when any line fails. Developer overlay,
  not the player-facing graphics-quality UI (that's E6.4).

## Profiling tool — `?dev=perf`

`src/scenes/perfBench.ts` (`?dev=perf`) plants a deliberately heavy **24×24
(576-tree)** thin-instanced forest, attaches a `FrameProfiler` + `PerfHud`, and
runs the live verdict in the corner. Fly with **WASD** + mouse (click to capture
the pointer) and watch the metrics against their ceilings.

Open it:

```
https://korovany.aimost.pl/?dev=perf   # or http://localhost:5173/?dev=perf
```

Every second it also logs the windowed report to the console and mirrors the
latest `{ metrics, report }` onto `window.__korovanyPerfBench` for smoke
harnesses.

## Tests

- `src/game/perf/budget.test.ts` — the pure evaluator: floor vs. ceiling
  semantics, exact-limit boundary, custom budgets, formatting.
- `src/game/perf/profiler.test.ts` — rolling-window mean, hitch smoothing,
  sample ageing, and the default instrumentation reader booting under
  `NullEngine` without throwing.
- `src/game/perf/perfHud.test.ts` — mount/update/dispose and the OK↔OVER header
  flip (jsdom).
- `src/scenes/perfBench.test.ts` — the bench plants the 576-tree forest, wires
  the profiler + HUD, samples a valid verdict, and tears the HUD out on dispose,
  all under `NullEngine` (no GL).
