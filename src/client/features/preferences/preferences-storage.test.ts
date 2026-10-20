import { afterEach, describe, expect, it, vi } from 'vitest'
import { PREFERENCES_STORAGE_KEY } from './preferences'
import {
  readStoredPreferences,
  writeStoredPreferences,
} from './preferences-storage'

const preferences = {
  sources: ['guardian' as const],
  categories: [],
  authors: [],
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('preferences storage', () => {
  it('reads and writes the versioned payload', () => {
    expect(writeStoredPreferences(preferences)).toBe(true)
    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY)!)).toEqual({
      schemaVersion: 1,
      preferences,
    })
    expect(readStoredPreferences()).toEqual({ preferences, readable: true })
  })

  it('survives localStorage itself being inaccessible', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    expect(readStoredPreferences()).toEqual({
      preferences: { sources: [], categories: [], authors: [] },
      readable: false,
    })
    expect(writeStoredPreferences(preferences)).toBe(false)
  })

  it('survives getItem and setItem throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('read failed')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota', 'QuotaExceededError')
    })
    expect(readStoredPreferences().readable).toBe(false)
    expect(writeStoredPreferences(preferences)).toBe(false)
  })
})
