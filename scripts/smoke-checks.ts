/**
 * Check sequencing and verdicts for `pnpm smoke:live`, kept free of network
 * and credentials so the rules can be tested with synthetic responses.
 */
import { categoryIds, type Category } from '../src/shared/categories.js'
import { toUtcDate } from '../src/shared/dates.js'
import {
  feedFiltersSchema,
  type FeedFilters,
} from '../src/shared/feed-filters.js'
import { errorCodeForStatus } from '../src/server/providers/http.js'
import type { ProviderPage } from '../src/server/providers/types.js'

export type Verdict = 'pass' | 'fail' | 'inconclusive'

export interface CheckOutcome {
  name: string
  verdict: Verdict
  detail: string
}

export interface UpstreamLoad {
  status: number
  body: unknown
  /** Maps a 200 body; throws a ProviderError for an invalid structure. */
  map: () => ProviderPage
}

export type PageLoader = (
  filters: FeedFilters,
  page: number,
) => Promise<UpstreamLoad>

export interface RunOptions {
  categories: boolean
  now: number
  /** Called between requests to respect provider rate limits. */
  pause: () => Promise<void>
  /** Safe description of a non-200 response. */
  describeError?: (load: UpstreamLoad) => string
}

/** Categories requested together to confirm OR (not AND) behaviour. */
export const MIXED_CATEGORIES: Category[] = ['business', 'health']

const filtersOf = (input: object) => feedFiltersSchema.parse(input)

const outcome = (name: string, verdict: Verdict, detail: string) => ({
  name,
  verdict,
  detail,
})

export function summarizePage(page: ProviderPage) {
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
    withAuthors: page.articles.filter((a) => a.authors.length).length,
    withImage: page.articles.filter((a) => a.imageUrl).length,
    categories,
    newest: page.articles[0]?.publishedAt,
    sampleTitle: page.articles[0]?.title.slice(0, 70),
  }
}

const withSummary = (page: ProviderPage, reason?: string) =>
  `${reason ? `${reason} ` : ''}${JSON.stringify(summarizePage(page))}`

/** A non-empty upstream page must yield at least one usable article. */
function unusable(name: string, page: ProviderPage) {
  return page.rawCount > 0 && page.articles.length === 0
    ? outcome(
        name,
        'fail',
        withSummary(page, `${page.rawCount} upstream item(s) but none usable.`),
      )
    : undefined
}

export function evaluateResults(
  name: string,
  page: ProviderPage,
  whenEmpty: Verdict,
): CheckOutcome {
  return (
    unusable(name, page) ??
    (page.rawCount === 0
      ? outcome(name, whenEmpty, withSummary(page, 'No results.'))
      : outcome(name, 'pass', withSummary(page)))
  )
}

export function evaluatePagination(
  first: ProviderPage,
  second: ProviderPage,
): CheckOutcome {
  const name = 'page 2'
  const broken = unusable(name, second)
  if (broken) return broken
  if (second.rawCount === 0) {
    return outcome(
      name,
      'fail',
      withSummary(second, 'Page 1 reported more results but page 2 was empty.'),
    )
  }

  const firstIds = new Set(first.articles.map((a) => a.id))
  const repeated = second.articles.filter((a) => firstIds.has(a.id)).length
  if (repeated === second.articles.length) {
    return outcome(
      name,
      'fail',
      withSummary(second, 'Page 2 repeated every article from page 1.'),
    )
  }
  // Some overlap is expected when new articles shift offset-based pages.
  const drift = repeated ? `${repeated} article(s) overlapped page 1.` : ''
  return outcome(name, 'pass', withSummary(second, drift))
}

/**
 * Passes only when every requested category appears among the results, so an
 * empty or unmapped page never certifies a mapping.
 */
export function evaluateCategories(
  name: string,
  page: ProviderPage,
  wanted: Category[],
): CheckOutcome {
  const broken = unusable(name, page)
  if (broken) return broken
  if (page.rawCount === 0) {
    return outcome(
      name,
      'inconclusive',
      withSummary(page, 'No results, so the mapping is not confirmed.'),
    )
  }

  const present = wanted.filter((c) =>
    page.articles.some((a) => a.category === c),
  )
  const matched = page.articles.filter(
    (a) => a.category && wanted.includes(a.category),
  ).length
  const ratio = `${matched}/${page.articles.length} labelled ${wanted.join('+')}.`

  if (present.length === wanted.length) {
    return outcome(name, 'pass', withSummary(page, ratio))
  }
  const missing = wanted.filter((c) => !present.includes(c)).join(', ')
  return outcome(
    name,
    'inconclusive',
    withSummary(page, `${ratio} Not seen: ${missing}.`),
  )
}

/** Runs the bounded check sequence for one provider. */
export async function runProviderChecks(
  load: PageLoader,
  options: RunOptions,
): Promise<CheckOutcome[]> {
  const outcomes: CheckOutcome[] = []
  let requests = 0

  async function fetchPage(name: string, filters: FeedFilters, page: number) {
    if (requests++ > 0) await options.pause()
    try {
      const result = await load(filters, page)
      if (result.status === 200) return result.map()
      const detail =
        options.describeError?.(result) ??
        `HTTP ${result.status} → ${errorCodeForStatus(result.status)}`
      outcomes.push(outcome(name, 'fail', detail))
    } catch (error) {
      const { code, note } = error as { code?: string; note?: string }
      outcomes.push(
        outcome(name, 'fail', code ?? note ?? (error as Error).name),
      )
    }
    return undefined
  }

  const first = await fetchPage('page 1', filtersOf({}), 1)
  const firstOutcome = first && evaluateResults('page 1', first, 'fail')
  if (firstOutcome) outcomes.push(firstOutcome)

  if (firstOutcome?.verdict !== 'pass' || !first) {
    outcomes.push(
      outcome('page 2', 'inconclusive', 'Not run: page 1 did not pass.'),
    )
  } else if (!first.hasMore) {
    outcomes.push(
      outcome(
        'page 2',
        'inconclusive',
        'Page 1 reported no further pages, so pagination was not exercised.',
      ),
    )
  } else {
    const second = await fetchPage('page 2', filtersOf({}), 2)
    if (second) outcomes.push(evaluatePagination(first, second))
  }

  const keywordName = 'keyword "climate" + last 3 days'
  const keyword = await fetchPage(
    keywordName,
    filtersOf({
      q: 'climate',
      from: toUtcDate(options.now - 3 * 86_400_000),
      to: toUtcDate(options.now),
    }),
    1,
  )
  if (keyword) {
    outcomes.push(evaluateResults(keywordName, keyword, 'inconclusive'))
  }

  if (options.categories) {
    for (const wanted of [...categoryIds.map((c) => [c]), MIXED_CATEGORIES]) {
      const name = `category ${wanted.join(' + ')}`
      const page = await fetchPage(name, filtersOf({ categories: wanted }), 1)
      if (page) outcomes.push(evaluateCategories(name, page, wanted))
    }
  }
  return outcomes
}

/** Checks that each curated NewsAPI source exists in the source catalogue. */
export function evaluateSourceCatalogue(
  status: number,
  catalogue: Map<string, string>,
  curated: Record<Category, string[]>,
): CheckOutcome {
  const name = 'curated sources'
  if (status !== 200) {
    return outcome(
      name,
      'fail',
      `HTTP ${status} → ${errorCodeForStatus(status)}`,
    )
  }
  const lines = Object.entries(curated).map(
    ([category, ids]) =>
      `${category}: ${ids
        .map((id) =>
          catalogue.has(id) ? `${id} (${catalogue.get(id)})` : `${id} MISSING`,
        )
        .join(', ')}`,
  )
  const missing = Object.values(curated)
    .flat()
    .filter((id) => !catalogue.has(id))
  return outcome(
    name,
    missing.length ? 'fail' : 'pass',
    `\n    ${lines.join('\n    ')}`,
  )
}

export function tally(outcomes: CheckOutcome[]) {
  const count = (verdict: Verdict) =>
    outcomes.filter((o) => o.verdict === verdict).length
  const passed = count('pass')
  const failed = count('fail')
  const inconclusive = count('inconclusive')
  const exitCode = failed ? 1 : inconclusive ? 2 : 0
  const message =
    exitCode === 0
      ? `All ${passed} checks passed.`
      : `${failed} failed, ${inconclusive} inconclusive, ${passed} passed.`
  return { passed, failed, inconclusive, exitCode, message }
}
