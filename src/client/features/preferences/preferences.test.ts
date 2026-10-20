import { describe, expect, it } from 'vitest'
import {
  EMPTY_PREFERENCES,
  preferencesFromStorage,
  preferencesToFilters,
  preferencesToStorage,
  samePreferences,
} from './preferences'

const stored = (preferences: unknown, schemaVersion: unknown = 1) =>
  JSON.stringify({ schemaVersion, preferences })

describe('preferencesFromStorage', () => {
  it('restores and normalizes valid stored preferences', () => {
    expect(
      preferencesFromStorage(
        stored({
          sources: ['newsapi', 'guardian', 'guardian'],
          categories: ['sports', 'business'],
          authors: ['  Zoë   Ångström ', 'Doe, Jane', 'zoë ångström'],
        }),
      ),
    ).toEqual({
      sources: ['guardian', 'newsapi'],
      categories: ['business', 'sports'],
      authors: ['Doe, Jane', 'Zoë Ångström'],
    })
  })

  it.each([
    ['missing', null],
    ['malformed JSON', '{"schemaVersion":1,'],
    [
      'an unsupported version',
      stored({ sources: ['nyt'], categories: [], authors: [] }, 2),
    ],
    [
      'a missing version',
      JSON.stringify({
        preferences: { sources: ['nyt'], categories: [], authors: [] },
      }),
    ],
    [
      'an unknown source',
      stored({ sources: ['bbc'], categories: [], authors: [] }),
    ],
    [
      'an unknown category',
      stored({ sources: [], categories: ['politics'], authors: [] }),
    ],
    ['a wrong shape', stored({ sources: 'nyt', categories: [], authors: [] })],
    [
      'an over-long author',
      stored({ sources: [], categories: [], authors: ['a'.repeat(81)] }),
    ],
    [
      'too many authors',
      stored({
        sources: [],
        categories: [],
        authors: Array.from({ length: 21 }, (_, i) => `Author ${i}`),
      }),
    ],
  ])('falls back to empty preferences for %s', (_label, raw) => {
    expect(preferencesFromStorage(raw)).toEqual(EMPTY_PREFERENCES)
  })

  it('round-trips through storage', () => {
    const preferences = {
      sources: ['nyt' as const],
      categories: [],
      authors: ['Jane Doe'],
    }
    expect(preferencesFromStorage(preferencesToStorage(preferences))).toEqual(
      preferences,
    )
  })
})

describe('preferencesToFilters', () => {
  it('builds My Feed filters without a keyword or dates', () => {
    expect(
      preferencesToFilters({
        sources: ['nyt'],
        categories: ['health'],
        authors: ['Jane Doe'],
      }),
    ).toEqual({
      q: '',
      sources: ['nyt'],
      categories: ['health'],
      authors: ['Jane Doe'],
    })
  })
})

describe('samePreferences', () => {
  it('ignores order and spacing but treats a visible name change as a change', () => {
    expect(
      samePreferences(
        {
          sources: ['nyt', 'guardian'],
          categories: [],
          authors: ['Jane  Doe'],
        },
        { sources: ['guardian', 'nyt'], categories: [], authors: ['Jane Doe'] },
      ),
    ).toBe(true)
    expect(
      samePreferences(
        { ...EMPTY_PREFERENCES, authors: ['jane doe'] },
        { ...EMPTY_PREFERENCES, authors: ['Jane Doe'] },
      ),
    ).toBe(false)
    expect(
      samePreferences(EMPTY_PREFERENCES, {
        ...EMPTY_PREFERENCES,
        sources: ['nyt'],
      }),
    ).toBe(false)
  })
})
