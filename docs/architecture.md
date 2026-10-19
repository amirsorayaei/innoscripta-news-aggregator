# Architecture

One package with three source roots:

| Path         | Responsibility                                                                             |
| ------------ | ------------------------------------------------------------------------------------------ |
| `src/shared` | Zod contracts, types, categories, date and author helpers. No environment or React access. |
| `src/server` | Express BFF: config, provider adapters, Demo data, feed service, routes.                   |
| `src/client` | React app. It talks only to the BFF.                                                       |
| `api/`       | Vercel function entry that exports the same Express app.                                   |

Data flow: URL or saved preferences → normalized filters → TanStack Query → `GET /api/feed` → three adapters in parallel → shared response → client merge and sort → UI. The client side of this flow arrives in phases 3 and 4.

## Feed API

`GET /api/feed` query parameters:

| Parameter    | Rules                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `q`          | Optional keyword. Whitespace is collapsed, max 100 characters.                                 |
| `from`, `to` | Optional real calendar days (`YYYY-MM-DD`), `from <= to`. UTC days, inclusive.                 |
| `source`     | Repeated: `guardian`, `nyt`, `newsapi`. Empty means all.                                       |
| `category`   | Repeated: `general`, `business`, `technology`, `science`, `health`, `sports`, `entertainment`. |
| `author`     | Repeated full names. Max 20, each at most 80 characters. Names may contain commas.             |
| `cursor`     | Opaque value from the previous response, sent with the same filters.                           |

Lists use repeated keys. Filters are normalized before use: duplicates are removed, sources and categories follow a fixed order, and authors are sorted by their comparison key. `feedFiltersToParams` therefore produces one stable serialization for equal filters.

Responses:

- **200**: `{ mode, articles, providerStatuses, nextCursor }` when at least one attempted provider succeeded, or when none needed a request.
- **400**: `invalid_request` with the offending `fields`, or `invalid_cursor`.
- **503**: `configuration_error` (Live without all three keys), or `all_providers_failed` with safe per-provider statuses.

`providerStatuses` has one entry per provider:

| State       | Meaning                                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ok`        | Returned a page and has more.                                                                                                                                                                             |
| `exhausted` | No more pages. The `result_limit_reached` note marks a plan limit rather than the end of the archive.                                                                                                     |
| `paused`    | Failed in this pagination stream. `error.code` is one of `unauthorized`, `rate_limited`, `timeout`, `upstream_unavailable`, `invalid_response` or `bad_request`. It is not retried until a fresh request. |
| `skipped`   | Not requested: `not_selected`, or `date_out_of_range` for the plan's search window.                                                                                                                       |

`rawCount` counts upstream items before validation. `matchedCount` counts the articles included after validation and the post-filters. There is no global total and no page numbers.

### Article

`id` (hash of the canonical URL), `canonicalUrl`, `url`, `title`, `summary?`, `imageUrl?`, `publishedAt` (ISO UTC), `authors[]`, `providerId`, `publisherName`, `category?` and `categoryBasis` (`article`, `publisher` or `unknown`).

Normalization rules:

- **Dropped items:** anything without a title, an HTTP(S) URL or a valid timestamp.
- **HTML:** converted to plain text and never rendered.
- **Canonical URL:** lowercase host, no fragment, and no `utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `mc_cid` or `mc_eid`. Path, trailing slash and other query parameters are kept.
- **Bylines:** parsed conservatively. `By` is removed, and the parser splits on `and`, `&`, `;`, `|` and newlines. A comma splits only when every part has at least two words, so "Doe, Jane" stays one name. Emails and URLs are dropped.
- **Author matching:** exact after NFKC, lowercase and whitespace collapse. Accents are kept and there is no fuzzy matching.

## Pagination and request handling

- Each batch requests at most one page of 10 from each active provider, so there are at most 30 candidates.
- **Cursor:** base64url JSON `{ v: 1, f, p }`. `f` is a SHA-256 fingerprint of the mode plus the normalized filters. `p` holds each provider's progress: `next` with a page, `exhausted`, `paused` with a code, or `skipped` with a note. Cursors are validated for length, version, allowed providers, page bounds (1–100) and filter match. They are not secret and not authorization.
- **Ordering:** articles in a response are sorted by `publishedAt` desc, then `id`. Only fetched articles are claimed to be newest-first, not the providers' whole archives.
- **Post-filters:** UTC day bounds and author matching apply to every provider's page after fetching. Author results are therefore "matches within the fetched pages", not a full archive search.
- **Isolation:** providers run in parallel and independently. Each gets a 5-second timeout combined with the request's abort signal.
- **Cancellation:** the handler aborts upstream work only when the response closes before it finishes (`res.writableFinished`). A normal close after sending is not treated as a disconnect. Vercel cancellation is enabled with `supportsCancellation` in `vercel.json`.
- **Cache:** an in-memory page cache holds successful provider pages only, for 5 minutes, up to 200 entries, evicting the oldest first. The key is mode, provider, filters without authors, and page; it never contains secrets. Errors are not cached. On Vercel the cache is per instance and temporary.
- **Logging:** logs contain only `[feed] <provider> failed: <code>`. URLs, keys and upstream bodies are never logged or returned.

## Providers

The adapter contract is `fetchPage(filters, page, signal) → { articles, rawCount, hasMore, notes }`, with pages starting at 1. Each adapter keeps its request builder and response mapper as pure, exported functions.

### The Guardian (Content API `/search`)

- **Parameters:** `q`, `from-date` and `to-date`, `order-by=newest`, `page`, `page-size=10`, `show-fields=trailText,thumbnail,byline` and `show-tags=contributor,keyword`.
- **Category filter:** keyword tags joined with `|` (OR). Guardian combines `section` and `tag` with AND, so tags are the only filter that can express "business OR health" in one request. Health uses `society/health`, not the whole `society` section.
- **Article category:** a `society/health` tag maps to health. Otherwise the section maps through a fixed table, for example `film` → entertainment. Unmapped sections get no category.
- **Authors:** contributor tags, falling back to the parsed byline.
- **Paging:** `hasMore` is `currentPage < pages`.

| Category      | Tags                                      |
| ------------- | ----------------------------------------- |
| general       | `world/world`, `uk/uk`, `us-news/us-news` |
| business      | `business/business`                       |
| technology    | `technology/technology`                   |
| science       | `science/science`                         |
| health        | `society/health`                          |
| sports        | `sport/sport`                             |
| entertainment | `culture/culture`                         |

### The New York Times (Article Search v2)

- **Parameters:** `q`, `begin_date` and `end_date` (`YYYYMMDD`), `sort=newest`, and a zero-based `page` (internal page minus 1).
- **Category filter:** `fq=section.name:("A" "B")`, which ORs the listed sections.
- **Paging:** `hasMore` uses `meta.offset + docs.length < meta.hits`, capped at page 100.
- **Mapping:** both the current document shape (`multimedia.default.url`, `byline.original`) and the older one (multimedia array with relative URLs, `byline.person`) are accepted. Structured `person` names come before the parsed byline.

| Category      | Sections     |
| ------------- | ------------ |
| general       | World, U.S.  |
| business      | Business     |
| technology    | Technology   |
| science       | Science      |
| health        | Health, Well |
| sports        | Sports       |
| entertainment | Arts, Movies |

### NewsAPI (`/v2/everything`)

- **Request:** the key goes in the `X-Api-Key` header, never the URL. Other parameters are `language=en`, `sortBy=publishedAt`, `pageSize=10` and `page`.
- **Categories:** `/v2/everything` has no category filter. Each category maps to a fixed set of English publishers (18 IDs, under the 20-source limit), and the union is sent as `sources`. With no category, the whole curated set is used, and `q` is omitted when there is no keyword.
- **Category meaning:** articles are labelled by their **publisher's** category (`categoryBasis: "publisher"`), and responses note `publisher_categories` when a category filter is active. This is not a statement about each article's topic. Unknown publishers get no category.
- **Search window:** the Developer plan searches articles up to one month old ([pricing](https://newsapi.org/pricing)). A range that ends before that window is `skipped` (`date_out_of_range`). An older start date is moved forward with the note `date_range_clamped`.
- **Result limit:** the `maximumResultsReached` error ends paging as `exhausted` with `result_limit_reached`. The adapter does not assume a fixed limit.
- **Removed articles:** `[Removed]` placeholders are dropped.

| Category      | Sources                              |
| ------------- | ------------------------------------ |
| general       | bbc-news, associated-press, reuters  |
| business      | bloomberg, business-insider, fortune |
| technology    | techcrunch, the-verge, wired         |
| science       | new-scientist, national-geographic   |
| health        | medical-news-today                   |
| sports        | espn, bbc-sport, talksport           |
| entertainment | entertainment-weekly, ign, buzzfeed  |

### Verification status

The mappings above follow provider documentation and tested fixtures, but still need confirmation against real keys (`pnpm smoke:live --categories`). Pending checks:

- Guardian tag coverage, especially `culture/culture`, `uk/uk` and `society/health`.
- The NYT `section.name` filter field and current document shape.
- Whether the NewsAPI curated sources exist and still publish.

Results are recorded in `docs/implementation-status.md`.

## Demo mode

`NEWS_MODE=demo`, the default, uses in-memory adapters with the same contract, so the feed service, cursors, post-filters and statuses behave exactly as in Live. The data is synthetic:

- 35 articles per provider (four pages), covering all seven categories.
- Several multi-author bylines.
- NewsAPI items that reuse Guardian URLs with `utm_*` parameters, which resolve to the same article ID.
- Timestamps five hours apart, counting back from `DEMO_NOW` (default `2026-10-19T09:00:00Z`), so data never shifts between requests.

Demo makes no outbound requests. Live never falls back to Demo data.
