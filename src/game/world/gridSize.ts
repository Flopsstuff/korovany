/**
 * Playable square side length of a zone's ground plane, in world units. Extracted
 * into this Babylon-free module (FLO-445) so the pure map-prop builder can map the
 * 20×20 grid onto the world without importing the Babylon `worldBounds` renderer.
 *
 * The Phase-3 zones shipped a cramped 60×60 clearing; per board feedback
 * (FLO-357 → FLO-368) the world is scaled **10× per axis** (100× area) so it no
 * longer reads as a tiny empty box. `worldBounds.ts` re-exports this as its public
 * `WORLD_SIZE`, so existing importers are unchanged.
 */
export const WORLD_SIZE = 600
