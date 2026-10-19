import { categoryIds, type Category } from '../../shared/categories.js'
import type { Article } from '../../shared/feed.js'
import type { ProviderId } from '../../shared/providers.js'
import { parseByline, toArticle } from '../providers/normalize.js'
import { demoStories } from './demo-stories.js'

/** Default reference time for Demo timestamps; override with DEMO_NOW. */
export const DEFAULT_DEMO_NOW = Date.parse('2026-10-19T09:00:00.000Z')

const HOUR_MS = 60 * 60 * 1000
const STORIES_PER_PROVIDER = 35

const providerSetup: Record<
  ProviderId,
  { offset: number; minutes: number; authors: string[]; host: string }
> = {
  guardian: {
    offset: 0,
    minutes: 0,
    host: 'https://guardian.example.com',
    authors: ['Amelia Hart', 'Tomás Rivera', 'Priya Natarajan', 'Owen Blake'],
  },
  nyt: {
    offset: 5,
    minutes: 40,
    host: 'https://nyt.example.com',
    authors: [
      'Daniel Okafor',
      'Hannah Lindqvist',
      'Marcus Chen',
      'Sofia Russo',
    ],
  },
  newsapi: {
    offset: 11,
    minutes: 80,
    host: 'https://publisher.example.org',
    authors: ['Lena Ortiz', 'Sam Whitaker', 'Yuki Tanaka', 'Grace Mensah'],
  },
}

const demoPublishers: Record<Category, string> = {
  general: 'The Daily Ledger',
  business: 'Market Wire',
  technology: 'Circuit Weekly',
  science: 'Field Notes Science',
  health: 'Clinic Report',
  sports: 'Matchday Post',
  entertainment: 'Marquee Magazine',
}

/** Stories interleaved by category so every page mixes topics. */
const storyPool = categoryIds.flatMap((_, round) =>
  categoryIds.map((category) => ({
    category,
    story: demoStories[category][round]!,
  })),
)

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function byline(authors: string[], index: number) {
  const first = authors[index % authors.length]!
  const second = authors[(index + 1) % authors.length]!
  return index % 4 === 0 ? [first, second] : [first]
}

/**
 * Deterministic Demo articles: 35 per provider (four pages of ten), newest
 * first, five hours apart, counting back from `now`. A few NewsAPI items reuse
 * Guardian URLs with tracking parameters to exercise canonical-URL dedupe.
 */
export function buildDemoArticles(now: number): Record<ProviderId, Article[]> {
  const build = (providerId: ProviderId): Article[] => {
    const setup = providerSetup[providerId]
    return Array.from({ length: STORIES_PER_PROVIDER }, (_, index) => {
      const { category, story } =
        storyPool[(index + setup.offset) % storyPool.length]!
      const [title, summary] = story
      const publishedAt = now - index * 5 * HOUR_MS - setup.minutes * 60_000
      const day = new Date(publishedAt).toISOString().slice(0, 10)
      const authors = byline(setup.authors, index)
      const isDuplicate =
        providerId === 'newsapi' &&
        index % 9 === 0 &&
        index + setup.offset < STORIES_PER_PROVIDER

      const url = isDuplicate
        ? duplicateGuardianUrl(now, index, setup.offset)
        : `${setup.host}/${category}/${day.replaceAll('-', '/')}/${slugify(title)}`

      return toArticle({
        url,
        title,
        summary,
        publishedAt: new Date(publishedAt).toISOString(),
        authors:
          providerId === 'newsapi'
            ? parseByline(`By ${authors.join(' and ')}`)
            : authors,
        providerId,
        publisherName:
          providerId === 'newsapi'
            ? demoPublishers[category]
            : providerId === 'guardian'
              ? 'The Guardian'
              : 'The New York Times',
        category,
        categoryBasis: providerId === 'newsapi' ? 'publisher' : 'article',
      })!
    })
  }

  return {
    guardian: build('guardian'),
    nyt: build('nyt'),
    newsapi: build('newsapi'),
  }
}

/** URL of the Guardian Demo article with the same story, plus tracking params. */
function duplicateGuardianUrl(now: number, index: number, offset: number) {
  const guardianIndex = index + offset
  const { category, story } = storyPool[guardianIndex % storyPool.length]!
  const publishedAt = now - guardianIndex * 5 * HOUR_MS
  const day = new Date(publishedAt).toISOString().slice(0, 10)
  return `${providerSetup.guardian.host}/${category}/${day.replaceAll('-', '/')}/${slugify(story[0])}?utm_source=newsapi&utm_medium=feed`
}
