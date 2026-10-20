import {
  PREFERENCES_STORAGE_KEY,
  preferencesToStorage,
  type Preferences,
} from '@/features/preferences/preferences'

/** Stores preferences as a previous session would have. */
export function seedPreferences(preferences: Partial<Preferences>) {
  localStorage.setItem(
    PREFERENCES_STORAGE_KEY,
    preferencesToStorage({
      sources: [],
      categories: [],
      authors: [],
      ...preferences,
    }),
  )
}

export function storedPreferences() {
  const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY)
  return raw
    ? (JSON.parse(raw) as { schemaVersion: number; preferences: Preferences })
    : null
}
