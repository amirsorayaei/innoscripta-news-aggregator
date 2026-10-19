# Implementation status

_Last updated: 2026-10-20 (Asia/Tehran)._

| Phase | Branch                     | Status                                                                                                            |
| ----- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1     | `chore/project-foundation` | Merged (PR #1, merge commit `94751f0`); production verified                                                       |
| 2     | `feat/news-providers`      | Merged (PR #2, merge commit `a78b110`); local and hosted Live verified, one non-blocking inconclusive observation |
| 3     | `feat/explore-feed`        | Not started                                                                                                       |
| 4     | `feat/personalized-feed`   | Not started                                                                                                       |
| 5     | `chore/release-readiness`  | Not started                                                                                                       |

## Phase 1 (merged)

Tooling, strict TypeScript, shadcn shell, health API, tests, Docker, CI and Vercel wiring. After the merge, Quality, E2E, Docker smoke and the production deploy all succeeded. Production `/api/health` reports Demo mode, deep links work and unknown API routes return a JSON 404. The deploy token issue was resolved with a team-scoped `VERCEL_TOKEN`.

## Phase 2: implemented

- **Configuration:**
  - `pnpm dev`, `pnpm start` and `pnpm smoke:live` load an optional `.env` through Node's `--env-file-if-exists`, and exported variables take precedence.
  - Docker Compose keeps using `env_file`, and Vercel uses platform env vars.
  - `DEMO_NOW` sets the Demo reference time.
- **Shared contracts:** filters with repeated-key query (de)serialization, real calendar dates, UTC day bounds and normalization. Also articles, provider states and error and note codes, and feed success and error responses.
- **Adapters:**
  - Guardian: categories as OR'd keyword tags.
  - NYT: `section.name` filter; accepts both current and legacy document shapes.
  - NewsAPI: curated publisher categories, key sent in a header, plan date window, result-limit handling.
- **Feed service:** parallel providers, 5-second timeouts, disconnect-only cancellation, author and UTC post-filters, versioned fingerprinted cursors, and a bounded 5-minute cache of up to 200 pages that never caches errors. Partial success returns 200; total failure and incomplete Live configuration return 503.
- **Demo:** 35 synthetic articles per provider, all categories, multi-author bylines, canonical duplicates, no network access.
- **Tooling:** `pnpm smoke:live`, a bounded manual Live check with pass, fail and inconclusive verdicts. By default it makes up to 3 requests per provider (page 1, page 2 when page 1 reports more, and keyword with dates). `--categories` adds 8 checks per provider: seven single categories and a mixed business + health check. With `--categories`, NewsAPI also gets one source-catalogue request, for at most 34 requests in total. The Docker smoke in CI and the E2E suite now request the Demo feed.

### Review fixes (2026-10-20)

- **Smoke false positives:** a 200 page with only unusable articles now fails. Pagination must actually advance; a full repeat of page 1 or an empty page 2 fails, while partial overlap is allowed. Empty or unmapped category results are inconclusive, and a mixed business + health check was added. The exit status reflects the verdicts. The check rules live in `scripts/smoke-checks.ts` and are covered by synthetic-response tests.
- **Cursor eligibility:** a cursor that activates a provider excluded by the source filter or availability rules is rejected with 400 `invalid_cursor` before any adapter is called.
- **NYT images:** a malformed optional image URL, such as `http://[`, is treated as no image. The article and its neighbours are kept, for both the object and the legacy array `multimedia` shapes.

## Phase 2: automated verification (local, 2026-10-20)

- `pnpm format:check`, `lint`, `typecheck` and `build` pass.
- `pnpm test` passes 158 tests in 15 files. Coverage includes filter and date validation, normalization, all three request builders and mappers, auth, rate-limit and invalid-response handling, partial and total failure, timeout, client-disconnect cancellation, cache and secret redaction, Demo determinism and pagination, and incomplete Live config.
- `pnpm test:e2e` (local Chrome): 20 passed, 2 skipped by design.
- Docker image (Demo): health, deep links, API 404, Demo feed, cursor follow-up, a 400 for an invalid date and a 400 `invalid_cursor` for a tampered cursor all pass.

## Phase 2: real-provider verification

### Local Live: full run (commit `0b90380`, free keys, Node 24.14.0)

`pnpm smoke:live --categories` made 34 requests: 31 passed, 1 failed, 2 inconclusive (exit 1). Two extra targeted NewsAPI diagnostics were run (36 requests in total).

- **The Guardian (11/11 passed):**
  - Pages 1 and 2 each had 10 raw and 10 valid articles, and pagination advanced. Keyword with dates and all seven categories passed.
  - Mixed business + health passed, with 3 health, 3 business and 4 other articles.
  - The general check used the union of its tags and does not isolate each tag. An article's primary section can map to a different category than the tag used to find it.
- **NYT (11/11 passed):**
  - Pagination advanced, keyword with dates passed, and each category mapped 10/10.
  - Mixed business + health returned 8 business and 2 health.
  - `section.name` works, and responses use `multimedia.default` and `byline.original`.
- **NewsAPI (9 passed, 1 failed, 2 inconclusive):**
  - **Failed:** the catalogue check, because `reuters` and `entertainment-weekly` were absent.
  - **Inconclusive:** sports was labelled general. A targeted `sources=bbc-sport` request returned 10 articles, all with `source.id: "bbc-news"`.
  - **Inconclusive:** mixed business + health returned 10 business articles, while the separate health check returned 10 health articles.
  - **Date clamp:** a targeted old start date (`2026-01-01`) was clamped to `2026-09-19`, and the API returned HTTP 200 with 10 articles. That covers this key on that date only.

### Local Live: NewsAPI fixes and targeted rerun (2026-10-20)

- **Fixes:** removed `reuters` and `entertainment-weekly`, leaving 16 curated sources. Added request-context category resolution with an explicit `bbc-sport` → `bbc-news` alias. BBC articles are sports for a sports-only request, general for a general-only request, and unlabelled when both BBC sources were requested.
- **Rerun:** `pnpm smoke:live --provider=newsapi --categories` made 12 requests and returned **11 passed, 0 failed, 1 inconclusive** (exit 2).
  - Pagination advanced: pages 1 and 2 each had 10 raw and 10 valid articles.
  - The keyword with dates check passed.
  - Every curated source was present in the catalogue.
  - All seven categories mapped 10/10, including **sports 10/10**.
- **Documented, non-blocking inconclusive observation:** mixed business + health. The newest page held 10 business articles and no health. The separate health check passed, so this alone does not show an OR-filtering bug. The smoke verdict stays inconclusive; there are no quotas, reordering or extra pages to force a result.
- **Observations:**
  - The unfiltered pages had 4/10 and 8/10 unlabelled articles. This fits the deliberate rule that leaves BBC articles unlabelled when both BBC sources are requested, but it was not attributed per article.
  - Publisher categories are not article topics. The general sample was a football story from BBC News, and the science sample was a travel story from National Geographic.
  - Guardian and NYT were not re-run. Their results above are from the full run.

### Hosted (Vercel): verified 2026-10-20

**Passed.** Production https://innoscripta-news-aggregator-chi.vercel.app serves deployment `dpl_AF3VPxHwqcg7JfkNzjzRc2KABwzf` (`3li8ymukr`). The deploy job of main CI run 39332635015 built it from the Phase 2 merge `a78b1100a401e3abd785bc1cff38138fea789fe9`. Quality, E2E, Docker smoke and Deploy production all succeeded.

- **Configuration:** `NEWS_MODE`, `GUARDIAN_API_KEY`, `NYT_API_KEY` and `NEWSAPI_API_KEY` are scoped to Production on project `innoscripta-news-aggregator`. Only names and scopes were inspected. An earlier check showed the keys stored as "Non-sensitive"; marking them Sensitive is recommended.
- **Health:** `/api/health` returns 200 with `mode: "live"`, `ready: true` and all three providers `configured: true`. No values are exposed.
- **One provider per request** (`source=guardian`, `source=nyt`, `source=newsapi`): each returned 200, `mode: "live"`, the selected provider `ok` with 10 raw and 10 matched articles, and the other two `skipped` (`not_selected`). Articles came from real hosts: theguardian.com, nytimes.com, and bbc.co.uk, bloomberg.com, fortune.com, buzzfeed.com, techcrunch.com and ign.com for NewsAPI.
- **Combined page 1** (no filters): 200 with 30 articles, 10 per provider. All three providers were `ok` with 10 raw and 10 matched. Articles were newest first, and a cursor was returned.
- **Cursor follow-up:** 200 with 30 new articles, 10 per provider, all `ok`. None repeated from page 1, and a new cursor was returned.
- **No Demo fallback:** every response reported `mode: "live"`, and no article used a Demo `example.*` host.
- **Request budget:** 6 feed requests, with 3 NYT requests spaced at least 13 seconds apart. The category suite was not re-run.

Limitations observed: NewsAPI's newest article was about 24 hours older than Guardian's and NYT's, consistent with the free plan's delay. Hosted responses rely on per-instance caching, and free-tier quotas still apply.

## Blockers and notes

- NewsAPI mixed business + health stays an inconclusive smoke verdict. It is documented and non-blocking (see above).
- NewsAPI Developer terms allow development and testing only. A successful hosted request does not change that.
- The Playwright CDN is unreachable from the development machine, so local E2E uses the installed Chrome. CI uses Playwright's Chromium.
- Node 22 is not installed locally, so Node 22 is exercised through Docker, CI and Vercel.

## Next (phase 3, after approval)

Explore page: article cards, search and filters with URL state, desktop and mobile filter UI, real Load more with scroll preservation, and request and empty-state UX.
