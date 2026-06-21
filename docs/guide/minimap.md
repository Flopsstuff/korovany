# Minimap HUD (radar)

The minimap is a small top-down **radar** pinned to the bottom-centre of the HUD
during live play. It answers two questions at a glance: *where am I* and *where
are the caravans I'm meant to raid* — plus *where is the danger*.

It is part of the **Карта минитюра** feature (FLO-446) and ships as a clean,
legible default; visual styling may be refined in a follow-up.

## What it shows

| Marker | Colour | Meaning |
| --- | --- | --- |
| Square frame | white (faint) | The 600×600 world play area (`WORLD_SIZE`, `src/scenes/worldBounds.ts`). |
| Dot + line | cyan | The player. The line is the facing indicator (capsule `rotationY`). |
| Dots | gold | Living **caravans** — the raid objective (цель). |
| Dots | red | Living **soldiers + archers** — threats. |
| Label | — | `Caravans <raided>/<target>` objective counter (from Redux `game` slice). |

Dead enemies and raided caravans drop off the radar, so the gold dots are always
the *remaining* objectives.

## Where the positions come from

Player and enemy world positions live **only in the Babylon scene**, never in
Redux — streaming them through React/Redux every frame would blow the 60 fps
re-render budget (see [performance-budget.md](./performance-budget.md)). Instead:

1. The active zone scene (`forestScene.ts`, `humanLandsScene.ts`) builds a
   `MinimapSnapshot` from the fixed-step loop, **throttled to ~10 Hz** (not every
   frame), and fires it through the `onMinimapTick` zone-scene option. The player
   pose is read via the existing `readPlayerTransform()` bridge; caravans and
   threats are read from the scene's live enemy arrays.
2. `GameCanvas` stashes the latest snapshot on the render-free bridge in
   `src/game/minimap/` (`publishMinimapSnapshot`) — **no Redux dispatch, no React
   `setState`**. It clears the snapshot on scene teardown.
3. The `<Minimap>` component owns its own `<canvas>` and a `requestAnimationFrame`
   loop that reads the latest snapshot (`readMinimapSnapshot`) and paints it
   imperatively. World coordinates `[-300, +300]` map to canvas pixels via the
   pure, unit-tested `worldToMinimap()` (world +X → right, +Z → up).

The canvas is `pointer-events: none`, so it never intercepts clicks meant for the
world, and it renders nothing outside the `playing` phase (hidden in the menu and
while paused).

## Files

- `src/game/minimap/index.ts` — snapshot types, the `worldToMinimap` projection,
  and the publish/read bridge.
- `src/app/Minimap.tsx` — the canvas component + draw loop.
- `src/scenes/zoneScenes.ts` / `forestScene.ts` / `humanLandsScene.ts` /
  `mountainsScene.ts` — the throttled `onMinimapTick` emitter.
- `src/scenes/GameCanvas.tsx` — wires the callback to the bridge.
- `src/styles/global.css` — `.hud-minimap*` styles.
