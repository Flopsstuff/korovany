# Faction system

E4.1 adds the faction foundation: stable data, pure reputation helpers, a
friend/foe matrix, and a Redux slice that exposes player faction state. E4.2
builds on it with the New-Game **faction picker**, **asymmetric per-faction
objectives**, and **save persistence** of the chosen faction. Soldier AI,
caravan AI, and objective-driven behaviour still belong to later tickets — the
objective data here is declarative and not yet wired into the live sim.

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

The slice delegates bounds and map updates to the pure model. Reputation is not
yet part of the save schema; only the chosen player faction is persisted (see
**Save persistence** below).

## Playable factions & selection (E4.2)

Three of the four factions are player-selectable; `neutral` is the unaffiliated
default the player carries until (and unless) they choose. The selectable set,
in picker order, is `PLAYABLE_FACTION_IDS` = `[forestElves, empire, villain]`.

- `isFactionId(value)` / `isPlayableFactionId(value)` — type guards used by save
  migration to validate an untrusted faction id (an unknown id falls back to
  `neutral` rather than corrupting state).
- `PLAYABLE_FACTIONS` — a picker-ready list merging each faction's identity with
  its playbook (name, home, role, tagline, objectives).

The New-Game flow lives in `src/app/App.tsx`: **New Game** opens the
`FactionPicker` overlay (`src/components/FactionPicker.tsx`) instead of starting
immediately. The picker is a two-step select→confirm affordance with empty,
loading, and selected states. Choosing a faction and pressing **Begin**
dispatches `setPlayerFaction(id)` (alongside the player/health/inventory resets)
and then `startNewGame()`. Visual polish tracks Iris's wireframes; this is the
functional first pass.

## Asymmetric objectives (E4.2)

Each playable faction has a typed **playbook** in
`src/game/faction/objectives.ts` describing its asymmetric goals. The data is
declarative — it states intent (raid whom, defend where) and is consumed by
later tickets (commander/order system, AI targeting, quest tracking); it does
not drive behaviour yet. Objective `id`s are stable strings (quest tracking will
point at them) — treat them like faction ids and do not rename after shipping.

| Faction | Role | Objectives |
| --- | --- | --- |
| Forest Elves | Forest Elf | raid Empire, raid Villain, defend the Emerald Thicket |
| Empire | Palace Guard | obey the commander, defend the Imperial palace |
| Villain | Villain | command troops, attack the Imperial palace |

An objective carries a `kind` (`raid \| defend \| obey \| command \| attack`), a
player-facing `summary`, and an optional `targetFactionId` (raid/attack) or
`targetRegion` (defend).

## Save persistence (E4.2)

The chosen player faction is persisted in the save schema as `playerFactionId`
(save **v3**). On **Continue**, `setPlayerFaction(data.playerFactionId)` restores
it. Old saves remain loadable: a pre-v3 save has no faction and migrates forward
to `neutral`; an unrecognised persisted id is coerced to `neutral` too. See
[save-system.md](save-system.md) for the schema-version history.
