# Faction system

E4.1 adds the faction foundation only: stable data, pure reputation helpers, a
friend/foe matrix, and a Redux slice that exposes player faction state. Nothing
is wired into live scenes, soldier AI, caravan AI, targeting, or save migration
yet; those integrations belong to later tickets.

## Stable ids

Faction ids are schema-facing strings. Do not rename them after they ship:

| Key | Id | Role |
| --- | --- | --- |
| `Neutral` | `neutral` | Human lands, unaffiliated locals, and ordinary caravans |
| `Empire` | `empire` | Empire / Palace Guard forces |
| `ForestElves` | `forestElves` | Elven wardens and forest defenders |
| `Villain` | `villain` | Hostile dark-aligned forces |

Definitions live in `src/game/faction/` as `FACTIONS`, `FACTION_IDS`, and
`FACTION_ID_LIST`. Display names, descriptions, and home-region text can change;
ids should not.

## Stance matrix

`resolveStance(a, b)` returns one of `hostile | neutral | allied` from the
static relationship matrix. The matrix is deliberately symmetric and
deterministic:

| A / B | Neutral | Empire | Forest Elves | Villain |
| --- | --- | --- | --- | --- |
| Neutral | allied | neutral | neutral | hostile |
| Empire | neutral | allied | hostile | hostile |
| Forest Elves | neutral | hostile | allied | hostile |
| Villain | hostile | hostile | hostile | allied |

Use this for faction-to-faction defaults. Do not infer player-specific stance
from this matrix until the AI integration tickets define that rule.

## Reputation

Player reputation is a serialisable `FactionId -> number` map. Values are
clamped to `-100..100`; non-finite values normalise to `0`; fractional inputs
are truncated. Defaults are neutral with the settled factions and hostile with
the villain faction:

```ts
{
  neutral: 0,
  empire: 0,
  forestElves: 0,
  villain: -75,
}
```

Use `setReputation` and `adjustReputation` from `src/game/faction/` for pure
updates. They return fresh maps and never mutate the input.

## Store bridge

`src/store/factionSlice.ts` keeps the current player faction and reputation map
in Redux:

- `setPlayerFaction(id)`
- `setFactionReputation({ factionId, value })`
- `adjustFactionReputation({ factionId, amount })`
- `resetFaction()`
- `restoreFaction(state)`
- selectors for current faction id, current faction definition, a single
  reputation value, and the full reputation map

The slice delegates bounds and map updates to the pure model. It is intentionally
not part of the save schema in E4.1.
