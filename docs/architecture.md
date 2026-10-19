# Architecture

One package with three source roots:

| Path         | Responsibility                                                                             |
| ------------ | ------------------------------------------------------------------------------------------ |
| `src/shared` | Zod contracts, types, categories, date and author helpers. No environment or React access. |
| `src/server` | Express BFF: config, provider adapters, Demo data, feed service, routes.                   |
| `src/client` | React app. It talks only to the BFF.                                                       |
| `api/`       | Vercel function entry that exports the same Express app.                                   |

Data flow: URL or saved preferences → normalized filters → TanStack Query → `GET /api/feed` → three adapters in parallel → shared response → client merge and sort → UI. Explore (phase 3) reads filters from the URL; My Feed (phase 4) will read them from saved preferences.

## Client feed

`src/client/features/articles` holds the reusable feed, and `src/client/features/explore` holds Explore's URL and filter behaviour.

- **Mode first:** `useFeedMode` waits for `/api/health`. If health fails, or Live mode is not ready, it shows an explicit panel and sends no feed request; it never guesses a mode.
- **Query:** `useFeed(filters, mode)` wraps `useInfiniteQuery`. The key is `['feed', mode, serialized normalized filters]`, the page parameter is the server's opaque cursor, and the query's `AbortSignal` is passed to `fetch`. The global defaults apply: 5-minute stale time, no automatic retries, and no refetching on focus, mount or reconnect.
- **Filter changes:** a new key means a new pagination stream with its own cursors. Previous results are never shown as placeholders, so a slow response for old filters can only land in the old cache entry.
- **Load more:** `fetchNextPage({ cancelRefetch: false })`, ignored while a page is loading. A failed page is not stored, and the loaded cards stay. A transient failure (network, 5xx, all providers failing) offers Load more again with the **same cursor**. A rejected cursor (400 `invalid_cursor`) cannot be retried, so the footer offers **Refresh** instead. The cards remain until the user chooses it.
- **Refresh and retry:** `resetQueries` on the exact key, so only page one is fetched again rather than the whole old page chain.
- **Merging** (`mergeArticles`): batches are merged by article ID, which is the server's hash of the canonical URL, so there are no client URL rules. The Guardian, then NYT, then NewsAPI copy wins. Missing summary, image, authors or category are filled from other copies, and a category keeps its basis. `providers` lists every provider that returned the article. Sorting is `publishedAt` descending, then ID. Every fetched article is shown; nothing is hidden to fake a global order.
- **Feed state** (`summarizeFeed`): statuses and paused providers come from the latest batch, and notes from every batch. The footer then shows one of four states:
  - **more:** a cursor exists;
  - **sparse:** a cursor exists but the last batch added no articles;
  - **end:** no cursor and no paused provider;
  - **stopped:** no cursor, with providers paused.

  The count is the number of unique articles shown.

- **Scroll anchor:** `ScrollAnchor` wraps the grid and is armed while a next page loads. When the merged list arrives, `getSnapshotBeforeUpdate` reads the first article below the sticky mobile header and its viewport offset, using the layout the user sees at that moment, so scrolling during the request is respected. After the commit, it scrolls by however far that article moved. It never restores after a Refresh or across filter streams. Native `overflow-anchor` is disabled on the grid so the two mechanisms don't stack.
- **Explore URL** (`exploreFiltersFromParams`): each value is checked on its own.
  - Dropped values: unknown sources and categories, impossible dates, and both dates of a reversed range. Authors and unknown parameters are ignored (Explore has no author filter).
  - Kept or adjusted: the keyword is truncated to 100 characters, and the remaining values are kept.
  - Canonical form: non-canonical URLs are replaced once with the canonical form, and applying filters pushes a history entry, so reload, sharing and Back/Forward restore the same filters.
- **Search:** typing commits after 400 ms; Enter commits immediately and cancels the pending commit. A keyword applied elsewhere (Back, a removed chip) replaces the draft.
- **Filters:**
  - **Desktop:** filters apply when valid; an invalid date range shows an error and sends nothing.
  - **Mobile:** the Sheet edits a copy of the applied filters. Apply commits it, while Cancel, Escape or dismissal discard it, and Reset clears only the copy.

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
- **Cursor:** base64url JSON `{ v: 1, f, p }`. `f` is a SHA-256 fingerprint of the mode plus the normalized filters. `p` holds each provider's progress: `next` with a page, `exhausted`, `paused` with a code, or `skipped` with a note. Cursors are validated for length, version, allowed providers, page bounds (1–100) and filter match. Each provider's progress must also agree with the current filters: a provider that the source filter or availability rules exclude must stay `skipped` with the same note, and an eligible provider cannot be marked `skipped`. Otherwise the request is rejected with 400 `invalid_cursor` before any adapter runs. Cursors are not secret and not authorization; they stay stateless, with no signature or session.
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
- **Categories:** `/v2/everything` has no category filter. Each category maps to a fixed set of English publishers (16 IDs, under the 20-source limit, all present in the live English catalogue on 2026-10-20), and the union is sent as `sources`. With no category, the whole curated set is used, and `q` is omitted when there is no keyword.
- **Category meaning:** articles are labelled by their **publisher's** category (`categoryBasis: "publisher"`), and responses note `publisher_categories` when a category filter is active. This is not a statement about each article's topic. Unknown publishers get no category.
- **Search window:** the Developer plan searches articles up to one month old ([pricing](https://newsapi.org/pricing)). A range that ends before that window is `skipped` (`date_out_of_range`). An older start date is moved forward with the note `date_range_clamped`.
- **Result limit:** the `maximumResultsReached` error ends paging as `exhausted` with `result_limit_reached`. The adapter does not assume a fixed limit.
- **Removed articles:** `[Removed]` placeholders are dropped.
- **Publisher aliases:** categories are resolved against the sources actually requested. A live check on 2026-10-20 showed that `sources=bbc-sport` returns articles with `source.id: "bbc-news"`, so `bbc-sport` is listed as an alias of `bbc-news`.
  - A sports-only request labels BBC articles as sports.
  - A general-only request labels them general.
  - When both BBC sources are requested (no category filter, or general + sports), the publisher category is ambiguous, so those articles get no category (`categoryBasis: "unknown"`) rather than a guess.

| Category      | Sources                              |
| ------------- | ------------------------------------ |
| general       | bbc-news, associated-press           |
| business      | bloomberg, business-insider, fortune |
| technology    | techcrunch, the-verge, wired         |
| science       | new-scientist, national-geographic   |
| health        | medical-news-today                   |
| sports        | espn, bbc-sport, talksport           |
| entertainment | ign, buzzfeed                        |

### Verification status

Local Live verification with free keys on 2026-10-20 (`pnpm smoke:live --categories`):

- **The Guardian:** every check passed, including pagination, keyword with dates, all seven tag-based categories and mixed business + health, where both categories appeared. The general check used the union of its tags, so it does not prove each general tag on its own. A tag-filtered article's primary section can map to a different category.
- **NYT:** every check passed. `section.name` filtering works, each category page mapped 10/10 to its category, and mixed business + health returned both. Responses use the current shape (`multimedia.default`, `byline.original`).
- **NewsAPI:**
  - **Catalogue:** `reuters` and `entertainment-weekly` were missing from the English catalogue and were removed.
  - **Sports:** sports results came back as `bbc-news`, which led to the alias handling above.
  - **Rerun:** after both fixes, the NewsAPI-only rerun passed every check except mixed business + health. Its newest page held only business articles while the separate health check passed, so the verdict stays inconclusive. This is a documented, non-blocking observation (see `docs/implementation-status.md`).

Hosted (Vercel) Live behaviour has not been verified.

`pnpm smoke:live` makes up to 3 requests per provider: page 1, page 2 when page 1 reports more, and keyword with dates. `--categories` adds 8 checks per provider, seven single categories plus mixed business + health. With `--categories`, NewsAPI also gets one source-catalogue request, for at most 34 requests in total. It gives each check a verdict:

- **Fail:** an HTTP error or invalid structure; a non-empty page with no usable articles; an empty unfiltered page 1; or page 2 that is empty, unusable or repeats every page 1 article although page 1 reported more. Partial overlap is allowed for offset drift.
- **Inconclusive:** empty keyword or category results, or category results that don't map back to the requested categories. Neither certifies a mapping.
- **Pass:** a category check passes only when every requested category appears among the results.

Results are recorded in `docs/implementation-status.md`.

## Demo mode

`NEWS_MODE=demo`, the default, uses in-memory adapters with the same contract, so the feed service, cursors, post-filters and statuses behave exactly as in Live. The data is synthetic:

- 35 articles per provider (four pages), covering all seven categories.
- Several multi-author bylines.
- NewsAPI items that reuse Guardian URLs with `utm_*` parameters, which resolve to the same article ID.
- Timestamps five hours apart, counting back from `DEMO_NOW` (default `2026-10-19T09:00:00Z`), so data never shifts between requests.

Demo makes no outbound requests. Live never falls back to Demo data.
