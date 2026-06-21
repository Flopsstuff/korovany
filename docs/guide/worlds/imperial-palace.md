# The Imperial March

**Zone role:** Empire lands, the palace seat, the attack/defend map.

**Design promise:** A fortified palace plaza that reads differently depending on
who you are — the seat you are sworn to **hold** as a Palace Guard, or the crown
you have come to **raid** as an Elf or Villain. The third of the four canonical
zones (E8.1 / FLO-427).

> **Content binding.** This spec is the prose brief; the zone's landmark and
> encounter data lives in `src/game/world/zoneContent.ts` under the `empire` key
> (`getZoneContent('empire')`), and the scene is `src/scenes/empireScene.ts`. See
> [ADR-0004](../decisions/0004-world-spec-to-zone-binding.md).

## Lore

The Imperial March is the crown's parade ground and last wall — a pale-stone
plaza beneath the palace keep where the Emperor musters the Palace Guard, receives
tribute wagons from the Salt Road, and stages the columns that push into the
forest. To the Guard it is home and duty: the keep is the commander's seat, and
the standing order is simple — hold the line. To the Forest Elves it is the source
of every axe in Lysaen; to the Villain it is the throat of the Empire. Both come
to the same plaza for opposite reasons.

## Mood and visual language

- Pale crown stone, imperial gold banners, straight fortified lines — the
  opposite of the forest's organic clutter and the Salt Road's patched reuse.
- The **palace keep** dominates the skyline as the orientation landmark and the
  objective focus; the **crown gate** funnels the approach; the **banner pillar**
  marks the march.
- Guard props should look numbered, drilled, and intrusive — an occupying order,
  not a lived-in place.

## Player-facing flow

1. Spawn on the plaza approach with the keep ahead and the crown gate between.
2. Read your **standing order** from the HUD directive (defend vs raid — derived
   from your faction's stance toward the Empire, see below).
3. Engage the Palace-Guard patrols ringing the keep; a wall archer covers the
   approach from behind it.
4. Hit the tribute caravans on the outer roads to advance the raid/loot objective.
5. Press toward — or hold — the palace keep per your directive.

## Faction directive (attack / defend)

The same zone surfaces an asymmetric standing order, resolved from the player's
faction stance toward the Empire via `getZoneDirective(zoneId, playerFactionId)`
(`src/game/world/zoneDirectives.ts`, reusing the faction `resolveStance` matrix):

| Player faction | Stance vs Empire | Directive | Summary |
| -------------- | ---------------- | --------- | ------- |
| Palace Guard (`empire`) | allied | **defend** | Hold the palace and the crown roads (the E4.3 commander's seat). |
| Forest Elf (`forestElves`) | hostile | **raid** | Strike the crown's caravans and patrols. |
| Villain (`villain`) | hostile | **raid** | Lay siege to the Imperial palace. |
| Unaffiliated (`neutral`) | neutral | **patrol** | Keep the peace on the march. |

The directive is *flavour and direction only* — the win condition stays the
caravan-raid count (`gameSlice` / `objectiveMachine`). It exists so the zone is
never directionless and so the palace reads correctly for both attackers and
defenders.

## Landmark briefs

Greybox boxes today (swapped for streamed GLBs via each landmark's `assetKey` when
the palace assets land). Ids match `zoneContent.ts`.

| Id | Role |
| -- | ---- |
| `palace-keep` | Imperial palace keep — objective focus / commander seat (E4.3). |
| `crown-gate` | Crown gate — fortified palace approach / escalation point. |
| `guard-barracks` | Palace-guard barracks — patrol muster point. |
| `crown-banner` | Crown banner pillar — imperial march marker / silhouette. |

## Encounter hooks

The Palace-Guard patrols use the placeholder `soldier` archetype until the
dedicated palace-guard asset lands (pending; depends on Pygmalion). Ids match
`zoneContent.ts`.

| Id | Kind | Role |
| -- | ---- | ---- |
| `guard-1`..`guard-4` | soldier | Palace-Guard patrols ringing the keep. |
| `wall-archer-1` | archer | Wall archer covering the approach behind the keep. |
| `tribute-1`, `tribute-2` | caravan | Tribute wagons on the outer roads — raid/loot targets. |

## Asset needs

- **Palace-guard archetype/GLB** (pending, Pygmalion) — replaces the placeholder
  `soldier` mesh once available; no scene change needed (swap the archetype).
- **Palace structures** (keep, gate, barracks, banner) — replace the greybox
  landmarks via `assetKey` + the `zone.empire` streaming manifest
  (`src/game/streaming/zoneManifests.ts`, currently empty placements).
