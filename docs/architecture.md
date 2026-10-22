# Architecture

The main design decisions, their trade-offs and the feed API contract. Setup, the review path and the code entry points are in the [README](../README.md).

## Overview

| Path                              | Responsibility                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| [`src/shared`](../src/shared)     | Zod contracts, types, categories, date and author helpers. No environment or React access. |
| [`src/server`](../src/server)     | Express BFF: config, provider adapters, Demo data, feed service, routes.                   |
| [`src/client`](../src/client)     | React app. It talks only to the BFF.                                                       |
| [`api/index.ts`](../api/index.ts) | Vercel function entry that exports the same Express app.                                   |

Data flow: URL or saved preferences → normalized filters → TanStack Query → `GET /api/feed` → provider adapters in parallel → shared response → client merge and sort → UI. Explore reads its filters from the URL; My Feed builds them from saved preferences.

## Decisions and trade-offs

### Provider adapters on the server

The browser never talks to a news provider. A small Express BFF owns the three API keys, calls the providers and returns one validated response shape.

- **Credentials:** keys are read from the server environment only, never use a `VITE_` prefix and never reach the client bundle. NewsAPI's key is sent in the `X-Api-Key` header rather than the URL. Upstream URLs, bodies and keys are never returned or logged; a failure is logged as `[feed] <provider> failed: <code>`.
- **One contract:** each provider implements [`ProviderAdapter`](../src/server/providers/types.ts), `fetchPage(filters, page, signal) → { articles, rawCount, hasMore, notes }`. Request building and response mapping are pure functions, so each mapping is unit-tested without a network. Demo data implements the same contract.
- **Trade-off:** an extra server hop and a serverless function to deploy, in exchange for private keys, one response shape and a single place for timeouts, caching and validation.

### Filter state: URL, query cache, preferences and drafts

Each kind of state has one owner:

- **Applied Explore filters** live in the URL ([`use-explore-filters.ts`](../src/client/features/explore/use-explore-filters.ts)). Parsing is lenient: each value is checked on its own, so one bad value never discards the rest. A non-canonical URL is replaced once with its canonical form, and applying filters pushes a history entry, so reload, sharing and Back/Forward restore results.
- **Remote data** lives in TanStack Query. The feed key is `['feed', mode, serialized normalized filters]`, so a filter change starts a new pagination stream instead of mixing cursors. Previous results are not shown as placeholders, so a slow response for old filters can only land in the old cache entry. Automatic retries and background refetches are off, so provider quotas stay predictable.
- **Saved preferences** live in [`PreferencesProvider`](../src/client/features/preferences/PreferencesProvider.tsx), above the router. They are read from `localStorage` once and written only on Save. The stored value is versioned and validated with the same `feedFiltersSchema` as API requests, so saved IDs, author names and limits always match what the API accepts. If storage is blocked or a write fails, preferences keep working for the session and the UI says so.
- **Drafts stay local:** the search box (applied after 400 ms or on Enter), the mobile filter sheet (applied on **Apply**) and the Preferences form (applied on **Save**) each edit a copy until it is committed.
- **Mode first:** the feed waits for `/api/health` and sends no request until the mode is known and Live is configured, rather than guessing.

Trade-offs: no cross-tab synchronization (another tab's changes apply after a reload), and leaving Preferences discards an unsaved draft without a prompt.

### Pagination, deduplication and reading position

- **Batches:** each request asks every active provider for at most one page of 10, so a batch has at most 30 candidates. There are no global totals or page numbers, because the providers don't share them.
- **Stateless cursors:** the response's `nextCursor` records each provider's progress (next page, exhausted, paused or skipped). The server keeps no session, so any instance can serve the next page.
- **Merging on the client:** [`mergeArticles`](../src/client/features/articles/merge-articles.ts) merges every loaded batch by article ID, a hash of the canonical URL computed on the server. The Guardian copy wins over NYT, and NYT over NewsAPI; missing fields are filled from other copies. The list is sorted newest first, which is a claim about the fetched articles only, not the providers' archives.
- **Reading position:** because later batches are re-sorted into the list, newer articles can be inserted above what the user is reading. [`ScrollAnchor`](../src/client/features/articles/ScrollAnchor.tsx) records the first visible article just before the merged list renders and scrolls by however far it moved. It does not restore after a Refresh or across filter changes.
- **Footer states:** more (a cursor exists), sparse (a cursor exists but the last batch added nothing), end, and stopped (providers paused). A failed page is not stored, so Load more retries the same cursor; a rejected cursor offers Refresh instead.

### Validation, partial failures, cancellation and caching

- **Validation at every boundary:** the shared filter schema validates the request, items from each provider are parsed one at a time so one malformed item cannot drop a page, and the browser validates the response schema before rendering.
- **Partial failures:** providers run in parallel and independently, each with a 5-second timeout combined with the request's abort signal. A failed provider is `paused` for the rest of that pagination stream and not retried until a fresh request, which favours quota safety over persistence. The response is `200` when at least one attempted provider succeeds and `503 all_providers_failed` only when all fail.
- **Cancellation:** the route aborts upstream work only if the client disconnects before the response finishes; a normal close after sending is not a cancellation. On Vercel this relies on `supportsCancellation` in [`vercel.json`](../vercel.json).
- **Caching:** [`PageCache`](../src/server/feed/page-cache.ts) keeps each provider's successful first page in memory for 5 minutes, up to 200 entries. The key is mode, provider and filters without authors, and holds no secrets. Later pages are always fetched fresh, so a later page cached from an older snapshot can never follow a newer first page and silently skip the articles published in between. Errors are not cached, and API responses are sent with `Cache-Control: no-store`.

### Demo and Live

- **Demo** (`NEWS_MODE=demo`, the default) uses in-memory adapters with the same contract, so the feed service, cursors, post-filters and statuses behave as in Live. The data is synthetic and deterministic: 35 articles per provider, five hours apart, counting back from `DEMO_NOW`, with some NewsAPI items duplicating Guardian URLs to exercise deduplication. Demo makes no outbound requests.
- **Live** needs all three keys. Without them there is no feed service, and `/api/feed` returns `503 configuration_error` instead of falling back to Demo data ([`from-config.ts`](../src/server/feed/from-config.ts)). `/api/health` reports the mode and which keys are configured, without revealing them.

## Feed API

`GET /api/feed` query parameters ([`feed-filters.ts`](../src/shared/feed-filters.ts)):

| Parameter    | Rules                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `q`          | Optional keyword. Whitespace is collapsed, max 100 characters.                                 |
| `from`, `to` | Optional real calendar days (`YYYY-MM-DD`), `from <= to`. UTC days, inclusive.                 |
| `source`     | Repeated: `guardian`, `nyt`, `newsapi`. Empty means all.                                       |
| `category`   | Repeated: `general`, `business`, `technology`, `science`, `health`, `sports`, `entertainment`. |
| `author`     | Repeated full names. Max 20, each at most 80 characters. Names may contain commas.             |
| `cursor`     | Opaque value from the previous response, sent with the same filters.                           |

Filters are normalized before use (duplicates removed, fixed ordering), so equal filters always serialize to the same query string.

Responses ([`feed.ts`](../src/shared/feed.ts)):

- **200:** `{ mode, articles, providerStatuses, nextCursor }` when at least one attempted provider succeeded, or when none needed a request.
- **400:** `invalid_request` with the offending `fields`, or `invalid_cursor`.
- **503:** `configuration_error` (Live without all three keys), or `all_providers_failed` with safe per-provider statuses.

`providerStatuses` has one entry per provider:

| State       | Meaning                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ok`        | Returned a page and has more.                                                                                                      |
| `exhausted` | No more pages. The `result_limit_reached` note marks a plan limit rather than the end of the archive.                              |
| `paused`    | Failed in this pagination stream, with a safe `error.code` such as `rate_limited` or `timeout`. Not retried until a fresh request. |
| `skipped`   | Not requested: `not_selected`, or `date_out_of_range` for the plan's search window.                                                |

`rawCount` counts upstream items before validation; `matchedCount` counts the articles included after validation and post-filters.

Each article has an `id` (hash of the canonical URL), `canonicalUrl`, `url`, `title`, optional `summary` and `imageUrl`, `publishedAt` (ISO UTC), `authors`, `providerId`, `publisherName`, an optional `category` and a `categoryBasis` (`article`, `publisher` or `unknown`). Items without a title, an HTTP(S) URL or a valid timestamp are dropped, HTML is converted to plain text and never rendered, and canonical URLs drop tracking parameters. The rules are in [`normalize.ts`](../src/server/providers/normalize.ts).

## Provider mappings

Categories are mapped per provider; the exact tables live in the adapters.

- **The Guardian** ([`guardian.ts`](../src/server/providers/guardian.ts), `guardianCategoryTags`): categories become keyword tags joined with OR. Guardian combines `section` and `tag` with AND, so tags are the only way to express "business OR health" in one request. Authors come from contributor tags, falling back to the byline.
- **The New York Times** ([`nyt.ts`](../src/server/providers/nyt.ts), `nytCategorySections`): categories become `fq=section.name:(…)`, which ORs the listed sections. Both the current and the older document shapes are accepted.
- **NewsAPI** ([`newsapi.ts`](../src/server/providers/newsapi.ts), `newsApiCategorySources`): `/v2/everything` has no category filter, so each category maps to a fixed set of 16 curated English publishers, sent as `sources`. Articles get their **publisher's** category (`categoryBasis: "publisher"`), and responses carry the `publisher_categories` note when a category filter is active. The Developer plan searches about 30 days back: older ranges are skipped or clamped with a note. BBC Sport articles come back as `bbc-news`, so when both BBC sources are requested the category is left unknown rather than guessed.

## Limitations

- **Source selection is provider-level:** Guardian, NYT or NewsAPI. The publishers behind NewsAPI cannot be selected individually.
- **NewsAPI categories describe the publisher**, not each article's topic.
- **Author filtering** is an exact match after Unicode normalization, lowercasing and whitespace collapse, applied to the pages providers return. It is not an archive-wide author search, so a batch can have no matches while more pages follow.
- **The cache is per instance:** on Vercel each function instance has its own short-lived cache, so it reduces repeated requests but is not a shared quota budget. Free plans are tight (NYT allows about 5 requests per minute; NewsAPI's Developer plan delays articles and is licensed for development and testing only), and there is no application-level rate limiting.
- **Live pagination can drift:** providers page by offset over live results. If articles are added, removed or reordered upstream between two requests, a later page can repeat articles (the client deduplicates them) or miss some. Fixing that would need snapshot or keyset pagination, which the providers don't offer.
- **Cursors are validated, not trusted:** a cursor carries a SHA-256 fingerprint of the mode and filters and is checked for size, version, page bounds (1–100) and agreement with the current filters, so a tampered cursor cannot re-enable an excluded provider. Cursors are unsigned, though, so they are not secret and not authorization.

## Verification

Verification evidence is recorded with dates in [implementation-status.md](implementation-status.md). It includes local real-key checks of all three providers on 2026-10-20, hosted Live checks on Vercel on 2026-10-20, and the post-merge production check on 2026-10-21. One NewsAPI result (mixed business + health) remains inconclusive and non-blocking. `pnpm smoke:live` is an optional manual check of the real APIs; it needs keys and is not part of CI.
