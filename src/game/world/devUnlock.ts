import { ZONE_ORDER } from './zones'
import type { ZoneId } from './types'

/** The subset of `import.meta.env` the dev-unlock gate reads. Narrowed so the
 *  resolver can be unit-tested with a plain object instead of the real Vite env. */
export interface DevUnlockEnv {
  readonly DEV?: boolean
  readonly VITE_DEV_UNLOCK_ZONES?: string
}

/** Runtime inputs for the prod opt-in gate (URL + localStorage). */
export interface ProdUnlockRuntime {
  readonly search?: string
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | null
}

/** Query param the board uses on the live site: `?unlockzones=1`. */
export const PROD_ZONE_UNLOCK_QUERY = 'unlockzones'

/** localStorage key persisted when the query param opts in (FLO-475). */
export const PROD_ZONE_UNLOCK_STORAGE_KEY = 'korovany-unlockzones'

function isTruthyOptIn(value: string | null | undefined): boolean {
  return value === '1' || value === 'true'
}

/**
 * Whether the dev-only "unlock every zone" override is active (FLO-469). When on,
 * the world map lets you fast-travel to any registered zone for inspection,
 * bypassing the ADR-0005 sequential conquest gate. Pure scene/zone-routing — it
 * does not touch save data or grant conquest credit.
 *
 * Resolution (first match wins):
 *  - `VITE_DEV_UNLOCK_ZONES=true`  → on  (works in any build, incl. a deployed preview)
 *  - `VITE_DEV_UNLOCK_ZONES=false` → off (lets a dev build exercise the real gate)
 *  - otherwise → on in dev builds (`import.meta.env.DEV`), off in prod builds.
 *
 * Prod builds (`DEV` false, flag unset) are unaffected: the conquest gate stands,
 * so shipped behaviour does not change. For a board-only prod opt-in see
 * {@link resolveProdZoneUnlockOptIn} / {@link isAllZonesTravelUnlocked}.
 */
export function isDevZoneUnlockEnabled(env: DevUnlockEnv = import.meta.env): boolean {
  if (env.VITE_DEV_UNLOCK_ZONES === 'true') return true
  if (env.VITE_DEV_UNLOCK_ZONES === 'false') return false
  return Boolean(env.DEV)
}

/**
 * Prod opt-in unlock (FLO-475): `?unlockzones=1` on korovany.aimost.pl (or a
 * persisted localStorage flag). Travel/routing only — no save or conquest side
 * effects. When the query param is present, the choice is persisted so reloads
 * keep working without the param.
 */
export function resolveProdZoneUnlockOptIn(
  runtime: ProdUnlockRuntime = {},
): boolean {
  const search =
    runtime.search ??
    (typeof window !== 'undefined' ? window.location.search : '')
  const storage =
    runtime.storage ??
    (typeof window !== 'undefined' ? window.localStorage : null)

  const queryVal = new URLSearchParams(search).get(PROD_ZONE_UNLOCK_QUERY)
  if (isTruthyOptIn(queryVal)) {
    try {
      storage?.setItem(PROD_ZONE_UNLOCK_STORAGE_KEY, '1')
    } catch {
      // private browsing / quota — honour the URL for this session only
    }
    return true
  }

  try {
    return isTruthyOptIn(storage?.getItem(PROD_ZONE_UNLOCK_STORAGE_KEY) ?? null)
  } catch {
    return false
  }
}

/** Whether fast-travel should treat every registered zone as unlocked. */
export function isAllZonesTravelUnlocked(
  env: DevUnlockEnv = import.meta.env,
  runtime?: ProdUnlockRuntime,
): boolean {
  return isDevZoneUnlockEnabled(env) || resolveProdZoneUnlockOptIn(runtime)
}

/** Every registered zone id — the "unlocked" set the App feeds the travel gate
 *  when {@link isAllZonesTravelUnlocked} is on. */
export function allZoneIds(): ZoneId[] {
  return [...ZONE_ORDER]
}
