/**
 * Manual Live smoke test against the real provider APIs.
 *
 *   pnpm smoke:live                 # 3 requests per provider
 *   pnpm smoke:live --categories    # + 7 category checks each, + NewsAPI source catalogue
 *   pnpm smoke:live --provider=nyt  # limit to some providers
 *
 * Reads keys from the environment or .env. Prints counts, states and response
 * shapes only; never keys or request URLs. Not part of CI.
 */
import { categoryIds } from '../src/shared/categories.js'
import { toUtcDate } from '../src/shared/dates.js'
import {
  feedFiltersSchema,
  type FeedFilters,
} from '../src/shared/feed-filters.js'
import { providerIdSchema, type ProviderId } from '../src/shared/providers.js'
import { loadConfig } from '../src/server/config.js'
import {
  buildGuardianUrl,
  mapGuardianResponse,
} from '../src/server/providers/guardian.js'
import {
  errorCodeForStatus,
  getUpstreamJson,
} from '../src/server/providers/http.js'
import {
  buildNewsApiRequest,
  mapNewsApiResponse,
  newsApiCategorySources,
} from '../src/server/providers/newsapi.js'
import { buildNytUrl, mapNytResponse } from '../src/server/providers/nyt.js'
import type { ProviderPage } from '../src/server/providers/types.js'

const args = process.argv.slice(2)
const withCategories = args.includes('--categories')
const providerArg = args.find((a) => a.startsWith('--provider='))?.split('=')[1]
const providers = providerArg
  ? providerArg.split(',').map((id) => providerIdSchema.parse(id))
  : providerIdSchema.options

// Spacing between requests to stay under each provider's free rate limit.
const PACING_MS: Record<ProviderId, number> = {
  guardian: 1100,
  nyt: 12_500,
  newsapi: 1100,
}

const config = loadConfig()
const keys = config.apiKeys
const now = Date.now()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface Check {
  name: string
  filters: FeedFilters
  page: number
}

function checksFor(): Check[] {
  const f = (input: object) => feedFiltersSchema.parse(input)
  const recent = { from: toUtcDate(now - 3 * 86_400_000), to: toUtcDate(now) }
  const checks: Check[] = [
    { name: 'page 1', filters: f({}), page: 1 },
    { name: 'page 2', filters: f({}), page: 2 },
    {
      name: 'keyword "climate" + last 3 days',
      filters: f({ q: 'climate', ...recent }),
      page: 1,
    },
  ]
  if (withCategories) {
    for (const category of categoryIds) {
      checks.push({
        name: `category ${category}`,
        filters: f({ categories: [category] }),
        page: 1,
      })
    }
  }
  return checks
}

/** Key structure of a value without its contents, to compare schemas. */
function shape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.length ? [shape(value[0], depth)] : []
  if (value && typeof value === 'object') {
    if (depth >= 2) return '{…}'
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, shape(v, depth + 1)]),
    )
  }
  return value === null ? 'null' : typeof value
}

/** Reads a nested property from untyped JSON. */
function pick(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>(
    (current, key) =>
      current && typeof current === 'object'
        ? (current as Record<string, unknown>)[key]
        : undefined,
    value,
  )
}

function redact(text: string) {
  return Object.values(keys).reduce<string>(
    (out, key) => (key ? out.replaceAll(key, '***') : out),
    text,
  )
}

async function request(id: ProviderId, check: Check) {
  const signal = AbortSignal.timeout(10_000)
  const key = keys[id]!
  if (id === 'guardian') {
    const res = await getUpstreamJson(
      buildGuardianUrl(check.filters, check.page, key),
      signal,
    )
    return { ...res, map: () => mapGuardianResponse(res.body, check.page) }
  }
  if (id === 'nyt') {
    const res = await getUpstreamJson(
      buildNytUrl(check.filters, check.page, key),
      signal,
    )
    return { ...res, map: () => mapNytResponse(res.body, check.page) }
  }
  const { url, notes } = buildNewsApiRequest(check.filters, check.page, now)
  const res = await getUpstreamJson(url, signal, { 'X-Api-Key': key })
  return { ...res, map: () => mapNewsApiResponse(res.body, check.page, notes) }
}

function itemsOf(id: ProviderId, body: unknown): unknown[] {
  const items =
    id === 'guardian'
      ? pick(body, 'response', 'results')
      : id === 'nyt'
        ? pick(body, 'response', 'docs')
        : pick(body, 'articles')
  return Array.isArray(items) ? items : []
}

function summarize(page: ProviderPage) {
  const count = (pred: (a: ProviderPage['articles'][number]) => boolean) =>
    page.articles.filter(pred).length
  const categories: Record<string, number> = {}
  for (const a of page.articles) {
    const key = a.category ?? 'none'
    categories[key] = (categories[key] ?? 0) + 1
  }
  return {
    raw: page.rawCount,
    valid: page.articles.length,
    hasMore: page.hasMore,
    notes: page.notes,
    withAuthors: count((a) => a.authors.length > 0),
    withImage: count((a) => Boolean(a.imageUrl)),
    categories,
    newest: page.articles[0]?.publishedAt,
    sampleTitle: page.articles[0]?.title.slice(0, 70),
    sampleAuthors: page.articles.find((a) => a.authors.length)?.authors,
  }
}

async function smokeProvider(id: ProviderId) {
  const lines: string[] = [`\n=== ${id} ===`]
  let failures = 0
  let shownShape = false

  for (const [index, check] of checksFor().entries()) {
    if (index > 0) await sleep(PACING_MS[id])
    try {
      const res = await request(id, check)
      if (res.status !== 200) {
        failures++
        const upstreamCode =
          pick(res.body, 'code') ??
          pick(res.body, 'fault', 'detail', 'errorcode')
        const message = pick(res.body, 'message')
        lines.push(
          `✗ ${check.name}: HTTP ${res.status} → ${errorCodeForStatus(res.status)}` +
            (upstreamCode ? ` (upstream code: ${String(upstreamCode)})` : '') +
            (id === 'newsapi' && typeof message === 'string'
              ? `\n    ${redact(message)}`
              : ''),
        )
        continue
      }
      if (!shownShape) {
        lines.push(
          `  item shape: ${JSON.stringify(shape(itemsOf(id, res.body)[0]))}`,
        )
        shownShape = true
      }
      lines.push(`✓ ${check.name}: ${JSON.stringify(summarize(res.map()))}`)
    } catch (error) {
      failures++
      const res = error as { code?: string; note?: string }
      lines.push(
        `✗ ${check.name}: ${res.code ?? res.note ?? (error as Error).name}`,
      )
    }
  }
  return { lines, failures }
}

async function checkNewsApiSources() {
  const url = new URL('https://newsapi.org/v2/top-headlines/sources')
  url.searchParams.set('language', 'en')
  const res = await getUpstreamJson(url, AbortSignal.timeout(10_000), {
    'X-Api-Key': keys.newsapi!,
  })
  const sources = pick(res.body, 'sources')
  const catalogue = new Map(
    (Array.isArray(sources) ? sources : []).map((s: unknown) => [
      String(pick(s, 'id')),
      String(pick(s, 'category')),
    ]),
  )
  const lines = ['\n=== newsapi curated sources ===']
  for (const [category, ids] of Object.entries(newsApiCategorySources)) {
    const status = ids.map((sourceId) =>
      catalogue.has(sourceId)
        ? `${sourceId} (${catalogue.get(sourceId)})`
        : `${sourceId} MISSING`,
    )
    lines.push(`  ${category}: ${status.join(', ')}`)
  }
  const missing = Object.values(newsApiCategorySources)
    .flat()
    .filter((s) => !catalogue.has(s))
  return { lines, failures: res.status === 200 ? missing.length : 1 }
}

async function main() {
  const missing = providers.filter((id) => !keys[id])
  console.log(
    `Live smoke: ${providers.join(', ')}${withCategories ? ' (with categories)' : ''}`,
  )
  if (missing.length) {
    console.error(
      `Missing API keys for: ${missing.join(', ')}. Set them in .env.`,
    )
    process.exit(1)
  }

  const tasks: Promise<{ lines: string[]; failures: number }>[] =
    providers.map(smokeProvider)
  if (withCategories && providers.includes('newsapi'))
    tasks.push(checkNewsApiSources())
  const results = await Promise.all(tasks)

  for (const { lines } of results) console.log(lines.join('\n'))
  const failures = results.reduce((sum, r) => sum + r.failures, 0)
  console.log(
    `\n${failures ? `${failures} check(s) failed` : 'All checks passed'}.`,
  )
  process.exit(failures ? 1 : 0)
}

void main()
