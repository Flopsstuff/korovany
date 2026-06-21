# World specs

These are early map and lore specs for future Korovany levels. They are not
implementation tickets yet; each spec gives level designers and engineers a
shared target for terrain, landmarks, faction pressure, traversal, encounters,
and asset needs.

> **Where zone content lives in code.** These specs are *content briefs* (prose).
> Their landmark and encounter data binds to the game through the typed content
> layer `src/game/world/zoneContent.ts` (`getZoneContent(zoneId)`), keyed by the
> four-zone `ZoneId` registry. Landmark/encounter data lives in that file; lore
> and design prose stay here. Scenes read landmarks and encounter-spawn anchors
> from `zoneContent` rather than hardcoding them. See
> [ADR-0004](../decisions/0004-world-spec-to-zone-binding.md).

## Shared assumptions

- The world remains browser-only and serverless; every map must be streamable
  from static assets and resumable from IndexedDB saves.
- Each map should work as a self-contained zone first, then connect into the
  broader world map and caravan routes later.
- The Phase-1 forest remains the vertical-slice baseline for controller feel,
  combat spacing, and asset streaming.
- Low-poly silhouettes should be readable at distance. Important navigation
  landmarks need distinct shapes, not only different colors.
- **World size & bounds.** Each zone's playable ground is `WORLD_SIZE` units per
  axis (`src/scenes/worldBounds.ts`, currently 600 — 10× the original 60×60
  clearing, board feedback FLO-357/FLO-368) and is enclosed by a perimeter
  bounding box of four walls. The character controller has no horizontal
  collision, so `createWorldBounds(...).clamp(position)` pins the player inside
  the walls each frame; new zones should size their ground from `WORLD_SIZE` and
  reuse this helper rather than re-hardcoding extents.

## Detailed world files

Each world now has a separate spec with deeper lore, encounter flow,
implementation notes, and a 20-by-20 text map:

- [The Salt Road of Velya](./worlds/velya-salt-road.md) — human lands, trade
  corridor, and first caravan-robbery map.
- [The Emerald Thicket of Lysaen](./worlds/lysaen-emerald-thicket.md) — Forest
  Elf homeland, dense woodland, stealth, and LOD proving ground.
- [The Imperial March](./worlds/imperial-palace.md) — Empire lands, the palace
  seat, and the asymmetric attack/defend map (E8.1).
- [Black Crown Pass](./worlds/black-crown-pass.md) — mountain lands, villain
  fortress approach, and vertical combat map.

## 1. The Salt Road of Velya

**Role:** Human lands, trade corridor, first caravan-robbery map.

**Lore:** Velya was once a neutral market road maintained by three towns, each
paying for its own mile markers, wells, and shrine stones. The Empire now taxes
the eastern toll gate, forest scouts raid from the black pines, and mountain
bandits sell "protection" from a ruined watchtower. Everyone calls the road
neutral, but every banner along it has been replaced twice.

**Playable fantasy:** The player sees the signature Korovany loop immediately:
caravans move goods through a readable open route, factions threaten them from
different angles, and the player decides whether to guard, ambush, loot, or flee.

**Layout:**

- Long S-shaped road from southwest farms to northeast toll gate.
- Dry riverbed crossing at the middle, wide enough for melee fights around
  wagons.
- Three dense landmark clusters: burned coaching inn, roadside shrine, ruined
  tower.
- Low rolling terrain with sparse fences and hedges so the player can leave the
  road without losing sight of it.
- Two hidden forest approaches and one rocky overlook for ambush setups.

**Landmarks:**

| Landmark | Purpose |
| -------- | ------- |
| Burned coaching inn | Safe-looking spawn and tutorial space; later becomes a shop/quest hub. |
| Saint Miro's shrine | Save/checkpoint fiction and a visible midpoint marker. |
| Broken toll gate | Empire control point with guards, ledger crates, and raised road barriers. |
| Old watchtower | High silhouette visible from most of the road; bandit or villain scout perch. |

**Encounter hooks:**

- A two-wagon caravan with one lead guard and one rear guard patrols the road.
- Forest elves may create a treefall blockade near the dry riverbed.
- Empire guards inspect cargo at the toll gate and can become hostile if the
  player has stolen goods.
- Villain scouts watch from the tower and retreat into the mountains if wounded.

**Asset needs:**

- Wagon, cargo crates, road posts, low fences, toll gate, shrine stones, burned
  inn shell, watchtower, farm field props.

**Implementation notes:**

- Good first target for the caravan system because the road spline is simple and
  visible.
- Keep initial terrain mostly flat; complexity should come from route choices,
  cover, and faction placement.
- Streaming cells can be road segments: farms, riverbed, toll gate, tower.
- Full spec: [The Salt Road of Velya](./worlds/velya-salt-road.md).

## 2. The Emerald Thicket of Lysaen

**Role:** Forest Elf homeland, dense woodland, stealth and LOD proving ground.

**Lore:** Lysaen is not one forest but several old woods grown together after the
elves dammed a marsh and taught the roots to drink in circles. Outsiders get
lost because trails bend back toward warning charms. Elves read the canopy like
a map: fresh cuts mean Empire axes, low smoke means a hidden camp, and a silent
crow means the villain's hunters are close.

**Playable fantasy:** The forest should feel alive and defensive. The player is
small inside a crowded world of trunks, bridges, huts, fog pockets, and sudden
clearings where melee combat can break out at close range.

**Layout:**

- Central village ring built around a giant stump and three elevated wooden huts.
- Four radial trail loops: hunter trail, marsh trail, shrine trail, and border
  trail.
- Thick tree fields between trails, using impostors at distance and 3D trunks
  close up.
- Shallow marsh pools that slow movement but create escape routes around enemy
  patrols.
- Border clearing at the eastern edge where Empire soldiers cut trees for a
  forward camp.

**Landmarks:**

| Landmark | Purpose |
| -------- | ------- |
| Giant stump hall | Main village landmark and future faction hub. |
| Rope bridge pair | Vertical navigation test and strong silhouette through trees. |
| Moonwell shrine | Healing/prosthetic-fiction anchor and quiet visual contrast. |
| Axecut clearing | Enemy intrusion point; makes the forest conflict readable. |

**Encounter hooks:**

- Elf scouts patrol trails and ignore the player if faction reputation is high.
- Empire woodcutters spawn near felled trees and call a soldier if attacked.
- A wounded courier asks the player to carry a warning charm across the marsh.
- Night variant: villain hunters use lanterns, giving the player moving light
  targets in dense fog.

**Asset needs:**

- Dense tree set with impostor textures, mossy trunks, wooden huts, rope bridges,
  marsh reeds, warning charms, stump hall, felled logs, axe racks.

**Implementation notes:**

- This is the natural Phase-5 LOD map. Build it only after the streaming budget
  can handle impostor-to-3D promotion with hysteresis.
- Trail loops should be authored as navigation splines so NPCs can patrol without
  expensive full-forest pathfinding.
- The village ring needs stable spawn points and clear camera lanes for the
  third-person controller.
- Full spec: [The Emerald Thicket of Lysaen](./worlds/lysaen-emerald-thicket.md).

## 3. Black Crown Pass

**Role:** Mountain lands, villain fortress approach, vertical combat map.

**Lore:** Black Crown Pass is named for the old fort whose broken towers look
like teeth against the snow. The villain did not build it; they found it already
empty, with wells that still echoed and doors barred from the outside. Now the
fort is a muster point for raiders, a prison for captured caravaners, and a place
where mountain folk pretend not to hear marching after dusk.

**Playable fantasy:** The pass should feel dangerous before combat starts:
narrow ledges, wind-scoured bridges, blind corners, and the fort always visible
above the player. It is the map for assaulting or defending a stronghold.

**Layout:**

- Lower switchback road with broken carts and avalanche debris.
- Mid-pass goat trail that lets agile players flank patrols.
- Stone bridge choke point over a ravine.
- Outer fort yard with barricades, cages, and a cracked cistern.
- Inner keep entrance reserved for later dungeon/interior expansion.

**Landmarks:**

| Landmark | Purpose |
| -------- | ------- |
| Hanging bridge | Traversal risk and visual test for fall boundaries. |
| Avalanche scar | Natural arena with boulders for cover. |
| Prison cages | Rescue objective anchor and moral pressure after caravan raids. |
| Broken crown tower | Main silhouette; visible from every major approach. |

**Encounter hooks:**

- Villain patrols walk the switchback in pairs, with one archer-like lookout
  placeholder positioned above the road.
- A caravan survivor can be freed from cages, creating a future escort route
  back down the pass.
- Empire scouts may attack the fort simultaneously, turning the yard into a
  three-faction fight.
- If the player belongs to the villain faction, the same geometry becomes a
  defense map against attackers.

**Asset needs:**

- Mountain rocks, snow patches, broken carts, rope bridge, stone bridge, fort
  walls, cages, barricades, signal fire, cracked cistern, tower ruins.

**Implementation notes:**

- Start with simple walkable ramps and collision boxes before adding cliffs.
- Camera collision is the main risk: narrow paths need extra testing with the
  third-person boom.
- Keep fall damage out of the first implementation unless the health model has a
  dedicated rule for it; use invisible blocker rails where needed.
- Full spec: [Black Crown Pass](./worlds/black-crown-pass.md).

## Cross-map continuity

| Continuity thread | Velya | Lysaen | Black Crown Pass |
| ----------------- | ----- | ------ | ---------------- |
| Caravans | Main route and robbery loop | Rare supply pack trains on border trail | Captured wagons and prisoner aftermath |
| Empire | Toll gate tax force | Axecut logging camp | Scout assault on villain fort |
| Forest Elves | Ambush from pines | Homeland and faction hub | Possible rescue allies |
| Villain | Tower scouts | Night hunters | Fortress and command base |
| Economy | Trade hub and stolen goods | Herbal healing and charms | Prisoner rescue rewards, contraband |

## Future task candidates

- Convert the Salt Road layout into data-driven road, landmark, and caravan
  spawn definitions.
- Prototype Lysaen tree impostors and promotion distances under a browser memory
  budget.
- Build a Black Crown Pass collision greybox focused on camera behavior around
  ledges and bridges.
