/**
 * Manual Live smoke test against the real provider APIs.
 *
 *   pnpm smoke:live                 # up to 3 requests per provider
 *   pnpm smoke:live --categories    # + 8 category checks each, + NewsAPI source catalogue
 *   pnpm smoke:live --provider=nyt  # limit to some providers
 *
 * Exit status: 0 all checks passed, 1 any check failed, 2 some inconclusive.
 * Reads keys from the environment or .env. Prints counts, verdicts and response
 * shapes only; never keys or request URLs. Not part of CI.
 */
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
import {
  evaluateSourceCatalogue,
  runProviderChecks,
  tally,
  type CheckOutcome,
  type PageLoader,
  type UpstreamLoad,
} from './smoke-checks.js'

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

const keys = loadConfig().apiKeys
const now = Date.now()
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))
const SYMBOLS = { pass: '✓', fail: '✗', inconclusive: '?' } as const

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

function loaderFor(id: ProviderId): PageLoader {
  const key = keys[id]!
  return async (filters, page) => {
    const signal = AbortSignal.timeout(10_000)
    if (id === 'guardian') {
      const res = await getUpstreamJson(
        buildGuardianUrl(filters, page, key),
        signal,
      )
      return { ...res, map: () => mapGuardianResponse(res.body, page) }
    }
    if (id === 'nyt') {
      const res = await getUpstreamJson(buildNytUrl(filters, page, key), signal)
      return { ...res, map: () => mapNytResponse(res.body, page) }
    }
    const { url, notes } = buildNewsApiRequest(filters, page, now)
    const res = await getUpstreamJson(url, signal, { 'X-Api-Key': key })
    return { ...res, map: () => mapNewsApiResponse(res.body, page, notes) }
  }
}

function describeError(id: ProviderId) {
  return ({ status, body }: UpstreamLoad) => {
    const upstreamCode =
      pick(body, 'code') ?? pick(body, 'fault', 'detail', 'errorcode')
    const message = pick(body, 'message')
    return (
      `HTTP ${status} → ${errorCodeForStatus(status)}` +
      (upstreamCode ? ` (upstream code: ${String(upstreamCode)})` : '') +
      (id === 'newsapi' && typeof message === 'string'
        ? `\n    ${redact(message)}`
        : '')
    )
  }
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

async function smokeProvider(id: ProviderId) {
  const load = loaderFor(id)
  let itemShape: string | undefined
  const outcomes = await runProviderChecks(
    async (filters, page) => {
      const result = await load(filters, page)
      const first = itemsOf(id, result.body)[0]
      if (!itemShape && result.status === 200 && first) {
        itemShape = JSON.stringify(shape(first))
      }
      return result
    },
    {
      categories: withCategories,
      now,
      pause: () => sleep(PACING_MS[id]),
      describeError: describeError(id),
    },
  )
  const header = `\n=== ${id} ===${itemShape ? `\n  item shape: ${itemShape}` : ''}`
  return { header, outcomes }
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
  return {
    header: '\n=== newsapi source catalogue ===',
    outcomes: [
      evaluateSourceCatalogue(res.status, catalogue, newsApiCategorySources),
    ],
  }
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

  const tasks: Promise<{ header: string; outcomes: CheckOutcome[] }>[] =
    providers.map(smokeProvider)
  if (withCategories && providers.includes('newsapi')) {
    tasks.push(checkNewsApiSources())
  }
  const results = await Promise.all(tasks)

  for (const { header, outcomes } of results) {
    console.log(header)
    for (const { name, verdict, detail } of outcomes) {
      console.log(`${SYMBOLS[verdict]} ${name}: ${detail}`)
    }
  }
  const summary = tally(results.flatMap((r) => r.outcomes))
  console.log(`\n${summary.message}`)
  process.exit(summary.exitCode)
}

void main()
