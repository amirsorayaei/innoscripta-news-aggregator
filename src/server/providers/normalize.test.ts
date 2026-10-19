import { describe, expect, it } from 'vitest'
import {
  canonicalizeUrl,
  htmlToText,
  parseByline,
  toArticle,
} from './normalize.js'

describe('canonicalizeUrl', () => {
  it('drops fragments and tracking parameters but keeps meaningful ones', () => {
    expect(
      canonicalizeUrl(
        'https://WWW.Example.COM/news/story/?id=7&utm_source=x&UTM_Medium=y&fbclid=1&gclid=2#comments',
      ),
    ).toBe('https://www.example.com/news/story/?id=7')
  })

  it('keeps the trailing slash and path case', () => {
    expect(canonicalizeUrl('https://example.com/A/b/')).toBe(
      'https://example.com/A/b/',
    )
    expect(canonicalizeUrl('https://example.com/A/b')).toBe(
      'https://example.com/A/b',
    )
  })

  it('rejects non-HTTP URLs', () => {
    expect(canonicalizeUrl('javascript:alert(1)')).toBeUndefined()
    expect(canonicalizeUrl('not a url')).toBeUndefined()
  })
})

describe('htmlToText', () => {
  it('strips markup and decodes entities', () => {
    expect(
      htmlToText(
        '<p>Rates <strong>rise</strong> &amp; markets&nbsp;react &#8211; again<script>x()</script></p>',
      ),
    ).toBe('Rates rise & markets react – again')
  })

  it('returns undefined for empty content', () => {
    expect(htmlToText('<p> </p>')).toBeUndefined()
    expect(htmlToText(null)).toBeUndefined()
  })
})

describe('parseByline', () => {
  it.each([
    ['By Jane Doe', ['Jane Doe']],
    ['By Jane Doe and John Smith', ['Jane Doe', 'John Smith']],
    ['Jane Doe, John Smith & Ana Lima', ['Jane Doe', 'John Smith', 'Ana Lima']],
    ['Doe, Jane', ['Doe, Jane']],
    ['Jane Doe; jane@example.com', ['Jane Doe']],
    ['https://example.com/staff/jane', []],
    ['  By   Zoë   Ångström ', ['Zoë Ångström']],
    ['Andrew Sanderson', ['Andrew Sanderson']],
    [null, []],
  ])('parses %j', (input, expected) => {
    expect(parseByline(input)).toEqual(expected)
  })
})

describe('toArticle', () => {
  const base = {
    url: 'https://example.com/a?utm_source=feed',
    title: 'A <em>title</em>',
    publishedAt: '2026-10-19T08:30:00+02:00',
    authors: [],
    providerId: 'guardian' as const,
    publisherName: 'The Guardian',
    categoryBasis: 'article' as const,
  }

  it('normalizes fields and derives the ID from the canonical URL', () => {
    const article = toArticle(base)!
    const sameStory = toArticle({ ...base, url: 'https://example.com/a#top' })!

    expect(article.title).toBe('A title')
    expect(article.publishedAt).toBe('2026-10-19T06:30:00.000Z')
    expect(article.canonicalUrl).toBe('https://example.com/a')
    expect(article.url).toBe('https://example.com/a?utm_source=feed')
    expect(article.categoryBasis).toBe('unknown')
    expect(sameStory.id).toBe(article.id)
  })

  it.each([
    { title: '' },
    { url: 'ftp://example.com/a' },
    { publishedAt: 'yesterday' },
  ])('drops articles with unusable %j', (override) => {
    expect(toArticle({ ...base, ...override })).toBeUndefined()
  })
})
