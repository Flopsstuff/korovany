# Dev tools

Developer-only conveniences that are gated out of production builds. They exist
to help inspect and debug the game; none of them change shipped behaviour.

## Unlock all zones (FLO-469, FLO-475)

By default the world map gates fast-travel behind sequential conquest: a world
opens only once the previous one is conquered (ADR 0005, see
[World map & zones](./world-map)). To **inspect every map** without playing
through the campaign, an override marks all registered zones
(`forest`, `human-lands`, `empire`, `mountains`) as unlocked, so each is
selectable and travelable from the world-map overlay (press **M** in play).

It is **travel/routing only** — it does not grant conquest credit, write to the
save, or alter any other progression. Regular players on the live site see the
normal conquest gate unless they explicitly opt in (see below).

### Dev / preview builds (FLO-469)

The gate is resolved by `isDevZoneUnlockEnabled()` in
[`src/game/world/devUnlock.ts`](../../src/game/world/devUnlock.ts), read once at
startup in `App` via `isAllZonesTravelUnlocked()`. Resolution (first match wins):

| Condition                         | Unlock all zones? |
| --------------------------------- | ----------------- |
| `VITE_DEV_UNLOCK_ZONES=true`      | **on** — even in a built/preview bundle |
| `VITE_DEV_UNLOCK_ZONES=false`     | **off** — even in a dev build (exercise the real gate) |
| flag unset, `npm run dev`         | **on** (dev build default) |
| flag unset, prod build            | **off** (unless prod opt-in below) |

So the common dev cases need no setup:

- **Local inspection:** `npm run dev` → open the app, press **M**, travel anywhere.
- **Test the real conquest gate in dev:** `VITE_DEV_UNLOCK_ZONES=false npm run dev`.
- **Deployed preview the board can poke:** build with
  `VITE_DEV_UNLOCK_ZONES=true npm run build` (do **not** set this on the
  production deploy).

> ⚠️ Do not set `VITE_DEV_UNLOCK_ZONES=true` for the production Cloudflare Pages
> build — that would ship the override and let **every** player skip progression.
> Use the prod opt-in below instead.

### Prod opt-in for the board (FLO-475)

On the **live** site (`korovany.aimost.pl`), the board can unlock every zone
without changing the deploy or affecting other players:

1. Open `https://korovany.aimost.pl/?unlockzones=1` (once).
2. The choice is persisted to `localStorage` (`korovany-unlockzones`), so later
   visits work without the query param.
3. Press **M** in play and fast-travel anywhere.

To turn it off again, clear site data / remove the `korovany-unlockzones` key
from localStorage in devtools.

This path is resolved by `resolveProdZoneUnlockOptIn()` and combined with the
dev gate in `isAllZonesTravelUnlocked()`. It is still travel/routing only — no
conquest credit and no save writes.

> ⚠️ Opening all zones to **everyone** without a per-browser opt-in is a
> one-line deploy flip (`VITE_DEV_UNLOCK_ZONES=true` on the prod build). That
> is intentionally **not** the default; use `?unlockzones=1` unless the board
> explicitly wants global unlock.

### Scene caveat

Every zone has its own scene (`createZoneScene` in
[`src/scenes/zoneScenes.ts`](../../src/scenes/zoneScenes.ts)): `forest`,
`human-lands`, `empire` (palace) and `mountains` (Black Crown Pass). Travelling
with the override mounts each zone's real scene — there is no forest fallback for
the unlocked maps.
