import { z } from 'zod'
import type { Category } from '../../shared/categories.js'
import type { FeedFilters } from '../../shared/feed-filters.js'
import { errorCodeForStatus, getUpstreamJson } from './http.js'
import { parseByline, toArticle } from './normalize.js'
import {
  MAX_PAGE,
  PAGE_SIZE,
  ProviderError,
  parseItems,
  type ProviderAdapter,
  type ProviderPage,
} from './types.js'

const ENDPOINT = 'https://api.nytimes.com/svc/search/v2/articlesearch.json'
const IMAGE_BASE = 'https://static01.nyt.com/'

export const nytCategorySections: Record<Category, string[]> = {
  general: ['World', 'U.S.'],
  business: ['Business'],
  technology: ['Technology'],
  science: ['Science'],
  health: ['Health', 'Well'],
  sports: ['Sports'],
  entertainment: ['Arts', 'Movies'],
}

const sectionCategories = new Map<string, Category>(
  Object.entries(nytCategorySections).flatMap(([category, sections]) =>
    sections.map((section) => [section, category as Category] as const),
  ),
)

const responseSchema = z.object({
  response: z.object({
    docs: z.array(z.unknown()),
    meta: z
      .object({ hits: z.number().int(), offset: z.number().int() })
      .optional(),
  }),
})

const imageSchema = z.object({ url: z.string() })

const docSchema = z.object({
  web_url: z.string(),
  headline: z.object({ main: z.string() }),
  pub_date: z.string(),
  abstract: z.string().nullish(),
  snippet: z.string().nullish(),
  section_name: z.string().nullish(),
  byline: z
    .object({
      original: z.string().nullish(),
      person: z
        .array(
          z.object({
            firstname: z.string().nullish(),
            middlename: z.string().nullish(),
            lastname: z.string().nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
  // Current responses use an object; older ones used an array of renditions.
  multimedia: z
    .union([
      z.object({ default: imageSchema.nullish() }),
      z.array(imageSchema.extend({ subtype: z.string().nullish() })),
    ])
    .nullish(),
})
type NytDoc = z.infer<typeof docSchema>

export function buildNytUrl(
  filters: FeedFilters,
  page: number,
  apiKey: string,
): URL {
  const url = new URL(ENDPOINT)
  const params = url.searchParams
  if (filters.q) params.set('q', filters.q)
  if (filters.from) params.set('begin_date', filters.from.replaceAll('-', ''))
  if (filters.to) params.set('end_date', filters.to.replaceAll('-', ''))
  if (filters.categories.length) {
    const sections = filters.categories
      .flatMap((category) => nytCategorySections[category])
      .map((section) => `"${section}"`)
    params.set('fq', `section.name:(${sections.join(' ')})`)
  }
  params.set('sort', 'newest')
  // Article Search pages are zero-based.
  params.set('page', String(page - 1))
  params.set('api-key', apiKey)
  return url
}

function imageFor(multimedia: NytDoc['multimedia']) {
  const image = Array.isArray(multimedia)
    ? (multimedia.find((m) => m.subtype === 'xlarge') ?? multimedia[0])
    : multimedia?.default
  if (!image?.url) return undefined
  return new URL(image.url, IMAGE_BASE).toString()
}

function authorsFor(byline: NytDoc['byline']) {
  const people = (byline?.person ?? [])
    .map((p) =>
      [p.firstname, p.middlename, p.lastname].filter(Boolean).join(' '),
    )
    .filter(Boolean)
  return people.length ? people : parseByline(byline?.original)
}

function mapDoc(item: unknown) {
  const parsed = docSchema.safeParse(item)
  if (!parsed.success) return undefined
  const doc = parsed.data
  return toArticle({
    url: doc.web_url,
    title: doc.headline.main,
    publishedAt: doc.pub_date,
    summary: doc.abstract || doc.snippet,
    imageUrl: imageFor(doc.multimedia),
    authors: authorsFor(doc.byline),
    providerId: 'nyt',
    publisherName: 'The New York Times',
    category: doc.section_name
      ? sectionCategories.get(doc.section_name)
      : undefined,
    categoryBasis: 'article',
  })
}

export function mapNytResponse(body: unknown, page: number): ProviderPage {
  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) throw new ProviderError('invalid_response')
  const { docs, meta } = parsed.data.response

  const moreUpstream = meta
    ? meta.offset + docs.length < meta.hits
    : docs.length === PAGE_SIZE
  return {
    articles: parseItems(docs, mapDoc),
    rawCount: docs.length,
    hasMore: moreUpstream && page < MAX_PAGE,
    notes: [],
  }
}

export function createNytAdapter(apiKey: string): ProviderAdapter {
  return {
    id: 'nyt',
    maxPage: MAX_PAGE,
    async fetchPage(filters, page, signal) {
      const url = buildNytUrl(filters, page, apiKey)
      const { status, body } = await getUpstreamJson(url, signal)
      if (status !== 200) throw new ProviderError(errorCodeForStatus(status))
      return mapNytResponse(body, page)
    },
  }
}
