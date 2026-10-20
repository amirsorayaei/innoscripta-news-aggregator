import {
  PREFERENCES_STORAGE_KEY,
  preferencesFromStorage,
  preferencesToStorage,
  type Preferences,
} from './preferences'

// Accessing `localStorage` itself can throw (privacy settings, sandboxed frames),
// not only getItem/setItem, so every step is guarded.

export function readStoredPreferences(): {
  preferences: Preferences
  readable: boolean
} {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
    return { preferences: preferencesFromStorage(raw), readable: true }
  } catch {
    return { preferences: preferencesFromStorage(null), readable: false }
  }
}

/** True only when the write succeeded. */
export function writeStoredPreferences(preferences: Preferences): boolean {
  try {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      preferencesToStorage(preferences),
    )
    return true
  } catch {
    return false
  }
}
