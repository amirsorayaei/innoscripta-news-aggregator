import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { parsePreferences, type Preferences } from './preferences'
import { PreferencesContext } from './preferences-context'
import {
  readStoredPreferences,
  writeStoredPreferences,
} from './preferences-storage'

/**
 * Applied preferences shared by every route. Storage is read once on start
 * and written only by Save; a failed write keeps the preferences in memory.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => {
    const { preferences, readable } = readStoredPreferences()
    return { applied: preferences, persisted: readable }
  })

  const save = useCallback((next: Preferences) => {
    const preferences = parsePreferences(next)
    if (!preferences) throw new Error('Cannot save invalid preferences.')
    const persisted = writeStoredPreferences(preferences)
    setState({ applied: preferences, persisted })
    return { preferences, persisted }
  }, [])

  const value = useMemo(() => ({ ...state, save }), [state, save])
  return <PreferencesContext value={value}>{children}</PreferencesContext>
}
