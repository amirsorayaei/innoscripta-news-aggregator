import { createContext, useContext } from 'react'
import type { Preferences } from './preferences'

export interface SaveResult {
  preferences: Preferences
  persisted: boolean
}

export interface PreferencesState {
  /** Preferences My Feed uses; changed only by an explicit Save. */
  applied: Preferences
  /** Whether `applied` is stored on this device. */
  persisted: boolean
  save: (next: Preferences) => SaveResult
}

export const PreferencesContext = createContext<PreferencesState | null>(null)

export function usePreferences() {
  const state = useContext(PreferencesContext)
  if (!state)
    throw new Error('usePreferences must be used inside PreferencesProvider')
  return state
}
