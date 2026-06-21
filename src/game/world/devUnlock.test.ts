import { describe, expect, it, vi } from 'vitest'
import { ZONE_ORDER } from './zones'
import {
  PROD_ZONE_UNLOCK_STORAGE_KEY,
  allZoneIds,
  isAllZonesTravelUnlocked,
  isDevZoneUnlockEnabled,
  resolveProdZoneUnlockOptIn,
} from './devUnlock'

describe('isDevZoneUnlockEnabled (FLO-469 dev zone unlock)', () => {
  it('is off in a prod build with the flag unset (shipped behaviour unchanged)', () => {
    expect(isDevZoneUnlockEnabled({ DEV: false })).toBe(false)
  })

  it('is on in a dev build by default', () => {
    expect(isDevZoneUnlockEnabled({ DEV: true })).toBe(true)
  })

  it('honours an explicit opt-in even in a prod build (deployed preview)', () => {
    expect(isDevZoneUnlockEnabled({ DEV: false, VITE_DEV_UNLOCK_ZONES: 'true' })).toBe(true)
  })

  it('honours an explicit opt-out even in a dev build (exercise the real gate)', () => {
    expect(isDevZoneUnlockEnabled({ DEV: true, VITE_DEV_UNLOCK_ZONES: 'false' })).toBe(false)
  })

  it('ignores values other than the exact "true"/"false" strings', () => {
    // Only the canonical strings flip the explicit branches; anything else falls
    // through to the DEV default.
    expect(isDevZoneUnlockEnabled({ DEV: true, VITE_DEV_UNLOCK_ZONES: '1' })).toBe(true)
    expect(isDevZoneUnlockEnabled({ DEV: false, VITE_DEV_UNLOCK_ZONES: 'yes' })).toBe(false)
  })
})

describe('resolveProdZoneUnlockOptIn (FLO-475 prod opt-in)', () => {
  it('is off without query param or persisted flag', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    expect(resolveProdZoneUnlockOptIn({ search: '', storage })).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('enables and persists when ?unlockzones=1 is present', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    expect(resolveProdZoneUnlockOptIn({ search: '?unlockzones=1', storage })).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(PROD_ZONE_UNLOCK_STORAGE_KEY, '1')
  })

  it('accepts unlockzones=true and persists', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    expect(resolveProdZoneUnlockOptIn({ search: '?unlockzones=true', storage })).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(PROD_ZONE_UNLOCK_STORAGE_KEY, '1')
  })

  it('reads a persisted localStorage flag on later visits', () => {
    const storage = { getItem: vi.fn(() => '1'), setItem: vi.fn() }
    expect(resolveProdZoneUnlockOptIn({ search: '', storage })).toBe(true)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('ignores non-canonical query values', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    expect(resolveProdZoneUnlockOptIn({ search: '?unlockzones=yes', storage })).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})

describe('isAllZonesTravelUnlocked', () => {
  it('is off in prod when neither dev nor prod opt-in is active', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    expect(
      isAllZonesTravelUnlocked({ DEV: false }, { search: '', storage }),
    ).toBe(false)
  })

  it('is on in prod when the board opts in via URL', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    expect(
      isAllZonesTravelUnlocked({ DEV: false }, { search: '?unlockzones=1', storage }),
    ).toBe(true)
  })

  it('still honours the dev build default', () => {
    expect(isAllZonesTravelUnlocked({ DEV: true }, { search: '', storage: null })).toBe(true)
  })
})

describe('allZoneIds', () => {
  it('returns every registered zone in display order', () => {
    expect(allZoneIds()).toEqual([...ZONE_ORDER])
  })

  it('returns a fresh array (mutating it does not corrupt ZONE_ORDER)', () => {
    const ids = allZoneIds()
    ids.push('atlantis' as never)
    expect(allZoneIds()).toEqual([...ZONE_ORDER])
  })
})
