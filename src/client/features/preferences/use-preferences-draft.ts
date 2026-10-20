import { useState } from 'react'
import {
  EMPTY_PREFERENCES,
  samePreferences,
  type Preferences,
} from './preferences'
import { usePreferences } from './preferences-context'

export type SaveFeedback = 'saved' | 'not-persisted' | null

/**
 * The editable copy of the applied preferences. Edits stay local until Save;
 * Cancel restores the applied preferences and Reset only empties the draft.
 */
export function usePreferencesDraft() {
  const { applied, persisted, save } = usePreferences()
  const [draft, setDraft] = useState(applied)
  const [feedback, setFeedback] = useState<SaveFeedback>(null)
  const dirty = !samePreferences(draft, applied)

  const update = (next: Preferences) => {
    setDraft(next)
    setFeedback(null)
  }

  return {
    draft,
    dirty,
    persisted,
    feedback,
    // Saving again is allowed after a failed write, so persistence can be retried.
    canSave: dirty || !persisted,
    update,
    reset: () => update(EMPTY_PREFERENCES),
    cancel: () => update(applied),
    submit: () => {
      const result = save(draft)
      setDraft(result.preferences)
      setFeedback(result.persisted ? 'saved' : 'not-persisted')
    },
  }
}
