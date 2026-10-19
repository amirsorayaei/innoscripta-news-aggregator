import { createHash } from 'node:crypto'
import { cleanAuthorName } from '../../shared/authors.js'
import type { Article } from '../../shared/feed.js'

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
])

/**
 * Canonical form used for IDs and deduplication: lowercase host, no fragment,
 * no known tracking parameters. Path, trailing slash and other query parameters
 * are kept because they can identify different articles.
 */
export function canonicalizeUrl(value: string): string | undefined {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined

  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key)) {
      url.searchParams.delete(key)
    }
  }
  return url.toString()
}

export function articleIdFor(canonicalUrl: string): string {
  return createHash('sha256')
    .update(canonicalUrl)
    .digest('base64url')
    .slice(0, 22)
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
}

/** Plain text from an upstream HTML fragment; markup is never rendered. */
export function htmlToText(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined
  const text = value
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? entity
      const point =
        code[1]?.toLowerCase() === 'x'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10)
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity
    })
    .replace(/\s+/g, ' ')
    .trim()
  return text || undefined
}

const LIST_SEPARATORS = /\s*(?:;|\||\n|&|\band\b)\s*/i
const NOT_A_NAME = /@|https?:\/\/|www\.|\.(?:com|org|net|co\.uk)\b/i

/**
 * Conservative byline parser for free-text author fields. Splits on clear list
 * separators; a comma splits only when every part looks like a full name, so
 * "Doe, Jane" stays one name. Emails and URLs are dropped.
 */
export function parseByline(value: string | null | undefined): string[] {
  if (!value) return []
  const text = cleanAuthorName(htmlToText(value) ?? '').replace(/^by\s+/i, '')

  const names = text
    .split(LIST_SEPARATORS)
    .flatMap(splitCommaList)
    .map((name) => cleanAuthorName(name.replace(/^by\s+/i, '')))
    .filter((name) => name.length > 1 && !NOT_A_NAME.test(name))

  return [...new Set(names)]
}

function splitCommaList(part: string): string[] {
  const pieces = part.split(',').map((piece) => piece.trim())
  const allFullNames = pieces.every((piece) => piece.split(/\s+/).length >= 2)
  return pieces.length > 1 && allFullNames ? pieces : [part]
}

export interface ArticleCandidate {
  url: string | null | undefined
  title: string | null | undefined
  publishedAt: string | null | undefined
  summary?: string | null
  imageUrl?: string | null
  authors: string[]
  providerId: Article['providerId']
  publisherName: string
  category?: Article['category']
  categoryBasis: Article['categoryBasis']
}

/** Builds a valid Article, or undefined when title, URL or timestamp is unusable. */
export function toArticle(candidate: ArticleCandidate): Article | undefined {
  const canonicalUrl = candidate.url
    ? canonicalizeUrl(candidate.url)
    : undefined
  const title = htmlToText(candidate.title)
  const timestamp = candidate.publishedAt
    ? Date.parse(candidate.publishedAt)
    : NaN
  if (!canonicalUrl || !title || !Number.isFinite(timestamp)) return undefined

  const imageUrl = candidate.imageUrl
    ? canonicalizeUrl(candidate.imageUrl)
    : undefined
  const summary = htmlToText(candidate.summary)

  return {
    id: articleIdFor(canonicalUrl),
    canonicalUrl,
    url: new URL(candidate.url!.trim()).toString(),
    title,
    ...(summary && summary !== title && { summary }),
    ...(imageUrl && { imageUrl }),
    publishedAt: new Date(timestamp).toISOString(),
    authors: candidate.authors,
    providerId: candidate.providerId,
    publisherName: candidate.publisherName,
    ...(candidate.category && { category: candidate.category }),
    categoryBasis: candidate.category ? candidate.categoryBasis : 'unknown',
  }
}
