import { describe, expect, it } from 'vitest'
import { article, feedPage } from '@/test/articles'
import { authorEntryError, collectAuthors } from './authors'

describe('collectAuthors', () => {
  it('deduplicates by normalized name and keeps accents and commas', () => {
    const feed = {
      pages: [
        feedPage({
          articles: [
            article({ id: 'a', authors: ['Zoë Ångström', 'Doe, Jane'] }),
            article({ id: 'b', authors: ['zoë  ångström'] }),
          ],
        }),
      ],
      pageParams: [undefined],
    }
    expect(collectAuthors([feed, undefined])).toEqual([
      { name: 'Zoë Ångström', count: 2 },
      { name: 'Doe, Jane', count: 1 },
    ])
  })
})

describe('authorEntryError', () => {
  it('accepts a new full name', () => {
    expect(authorEntryError('  Zoë   Ångström ', ['Jane Doe'])).toBeUndefined()
  })

  it.each([
    ['   ', [], 'Enter an author’s full name.'],
    ['a'.repeat(81), [], 'Author names can be at most 80 characters.'],
    ['jane  DOE', ['Jane Doe'], 'Jane Doe is already selected.'],
    [
      'New Name',
      Array.from({ length: 20 }, (_, i) => `Author ${i}`),
      'You can follow up to 20 authors.',
    ],
  ])('rejects %j', (input, selected, message) => {
    expect(authorEntryError(input, selected)).toBe(message)
  })
})
