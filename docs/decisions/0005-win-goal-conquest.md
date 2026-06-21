# 0005 — Win goal: conquer the worlds + renewable caravan economy

- Status: Accepted (design); implementation tracked under FLO-450 children
- Date: 2026-06-21
- Deciders: Daedalus (CTO), per board feedback FLO-450

## Context

Player feedback (FLO-450): the game ends the moment you raid **3 caravans**
(`OBJECTIVE_CARAVAN_TARGET = 3`, `objectiveMachine.evaluateOutcome`). That is an
instant, shallow win that fires *before* the economy can be played:

- All three prosthetics cost **260 gold** total (hand 80 + leg 120 + eye 60).
- A caravan drops only **~19 gold expected** (loot table: 3 rolls, gold weight
  50/120, 5–25 per roll).
- Caravans **do not respawn** — once a zone's anchors are looted, the gold
  faucet is dry.

So a player literally cannot farm enough gold to try the prosthetics before the
run is declared won. "Victory" is also undefined as a long-term goal — the board
asked for a real far goal: *pass all the worlds, rob all the caravans.*

## Decision

Replace the flat 3-caravan win with a **data-driven world-conquest campaign** and
make the caravan economy **renewable**.

### 1. Win = conquer every available world

- A **world is conquered** when caravans raided in it reach that world's
  **quota**. Quotas: `forest 3`, `human-lands 5`, `empire 6`, `mountains 8`.
- **Victory = every world whose `status === 'available'` is conquered.** The win
  logic reads `ZONES` — it is *data-driven*, not a hardcoded count. Today that
  means conquering **forest + human-lands** (8 caravans) wins. When empire and
  mountains ship (flip to `available`), the goal auto-extends to all four with no
  win-logic change. This honours "pass all the worlds" while staying shippable
  now.
- Worlds unlock **sequentially**; locked worlds (empire, mountains) render on the
  world map as **"Coming soon"** and do not block the achievable victory.

### 2. Caravans respawn

- After a caravan is looted and defeated, its anchor **re-arms a fresh caravan
  after `CARAVAN_RESPAWN_MS` (60 s)**. The zone stays huntable → gold is
  renewable.
- Raids beyond a world's quota don't advance conquest but **still drop loot/gold**
  (pure farming). Respawn is anchor-capped — never more live caravans than the
  zone's original anchor count.

### 3. Economy retune

- Bump the gold entry so a haul isn't "скудно": **weight 60, min 10, max 40**
  (expected ≈ **35 gold/caravan**, up from ~19). Prosthetic prices stay (they are
  meaningful sinks).
- Result: conquering two worlds (~8 caravans ≈ 280 g) already affords all
  prosthetics mid-campaign, and respawn farming covers experimentation. A balance
  unit test pins this invariant: expected gold over the available-world quota ≥
  sum of prosthetic prices.

### State & save model

- Track caravans raided **per zone** (`Record<ZoneId, number>`); derive
  `conqueredZones` (count ≥ quota) and sequential `unlockedZones`.
- `objectiveMachine` takes per-zone progress + quotas; `evaluateOutcome` returns
  `won` when all available zones are conquered. Stays a pure, exhaustively-tested
  function.
- Save migration adds the per-zone map (default `{}`); old saves migrate without
  data loss (the legacy flat `caravansRaided` is informational only).

## Consequences

- **Boring/reversible:** all behaviour is constants + a pure decision function +
  a Redux slice. No new moving parts in the deployment story.
- **Schema:** the save format gains a per-zone map → a versioned migration, with
  fixture coverage (schema-is-forever lens).
- **Content roadmap (not in this change):** the full four-world far goal needs the
  empire & mountains **scenes** built. Those are follow-up content epics; when
  each lands and flips `available`, the win goal extends automatically.
- **Trust-the-boundary:** quotas/respawn validated once in the slice/scene edge,
  then trusted by the pure machine.

## Implementation (FLO-450 children)

- Core conquest win + state + save migration + objective HUD → Wayland.
- Caravan respawn → Aldric.
- Economy retune + balance test → Soren.
