# Implementation status

_Last updated: 2026-10-20 (Asia/Tehran)._

| Phase | Branch                     | Status                                                                                                            |
| ----- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1     | `chore/project-foundation` | Merged (PR #1, merge commit `94751f0`); production verified                                                       |
| 2     | `feat/news-providers`      | Merged (PR #2, merge commit `a78b110`); local and hosted Live verified, one non-blocking inconclusive observation |
| 3     | `feat/explore-feed`        | Merged (PR #4, merge commit `a43dee2`); hosted preflight passed                                                   |
| 4     | `feat/personalized-feed`   | Merged (PR #5, merge commit `aa0e164`); hosted Live verified                                                      |
| 5     | `chore/release-readiness`  | PR open, awaiting review; final merge and post-merge production check pending                                     |

## Requirements checklist

Evidence for each requirement of the case study, followed by the enhancements we agreed on top of it.

### Assignment requirements

| Requirement                                         | Evidence                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keyword search**                                  | Explore search box with a 400 ms debounce and Enter. Sent to every provider as `q`. Covered by `ExplorePage.test.tsx` and `e2e/explore.spec.ts`, and verified on production (`?q=climate`).                                              |
| **Filter by date**                                  | Inclusive UTC `from`/`to` with real-date validation, native provider date parameters and a server post-filter (`src/shared/dates.ts`, `feed-service.ts`). Verified on production (`from=2026-10-13`).                                    |
| **Filter by category**                              | Seven shared categories mapped per provider: Guardian tags, NYT sections, NewsAPI curated publishers. Covered by adapter tests and the real-key smoke run.                                                                               |
| **Filter by source**                                | Guardian, NYT and NewsAPI selectable in Explore and Preferences. Excluded providers are skipped server-side, and a cursor cannot re-enable them.                                                                                         |
| **Personalized feed: sources, categories, authors** | Preferences page with Save/Cancel/Reset, validated `localStorage` persistence and author selection. My Feed is built only from saved preferences. Verified on production (Save → My Feed → reload).                                      |
| **Mobile-responsive design**                        | Layouts checked at 320, 390, 768 and 1440px with no horizontal overflow; mobile navigation and filter Sheets; 44px touch targets on touch layouts.                                                                                       |
| **At least three data sources from the list**       | The Guardian, The New York Times and NewsAPI, each with a real adapter and verified with real keys locally and on production.                                                                                                            |
| **React.js with TypeScript**                        | React 19 with strict TypeScript across client, server and shared code.                                                                                                                                                                   |
| **Docker with documentation**                       | Multi-stage Node 22 image and `docker compose up --build` documented in the README. Verified from a clean checkout (see below) and in CI's Docker smoke job.                                                                             |
| **DRY, KISS, SOLID**                                | Shared Zod contracts and pure helpers; one small adapter contract per provider (`fetchPage`); dependency injection of adapters into the feed service; a reusable article feed shared by Explore and My Feed. See `docs/architecture.md`. |

### Agreed enhancements

These go beyond the PDF:

- Express BFF so provider keys stay server-side.
- Explicit Demo and Live modes, with no silent fallback between them.
- Cursor-based Load more with scroll preservation.
- Canonical-URL deduplication.
- Honest provider statuses and notes.
- Explicit Save/Cancel preferences with storage-failure handling.
- Unit, integration, E2E and axe tests.
- GitHub Actions gating the Vercel deploy.

Optional items left out on purpose: accounts, a database, cross-tab sync, dark mode and an internal article reader.

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
- Node 22 is not installed on the development machine. Node 22 is exercised through the clean-checkout container run (Phase 5), Docker, CI and Vercel.

## Phase 3: Explore feed

### Implemented

- **Reusable feed** (`features/articles`):
  - `useFeed` (infinite query keyed by mode and normalized filters, server cursors, guarded Load more, page-one Refresh);
  - `useFeedMode` (no requests before the mode is known; explicit health and configuration failures);
  - `mergeArticles` (canonical-ID dedupe, Guardian > NYT > NewsAPI, combined attribution, deterministic sort);
  - feed state and messages built from real provider states, notes and error codes;
  - a scroll anchor that uses the reading position at merge time;
  - cards, grid, skeletons, notices, footer and error panels.
- **Explore** (`features/explore`):
  - lenient URL sanitizing with one canonical form, and URL-backed filters with Back/Forward;
  - 400 ms debounced search with an immediate Enter;
  - desktop filters that apply when valid, and a mobile Sheet with draft, Apply, Cancel and Reset;
  - connected date errors, and applied-filter chips with Clear all.
- **API client:** `ApiError` now keeps the parsed error body, so the UI can show per-provider reasons for a 503.

### Verification (local, 2026-10-20)

- `pnpm format:check`, `lint`, `typecheck` and `build` pass.
- `pnpm test` passes 210 tests in 22 files. New coverage:
  - URL round-trip and sanitizing;
  - Back/Forward with control sync;
  - debounce, and Enter cancelling the pending commit;
  - stale slow responses;
  - desktop and mobile date validation without requests;
  - mobile Apply, Cancel, Reset and Escape;
  - merging, priority and attribution;
  - cursor progression with double-click protection;
  - a transient pagination error retrying the same cursor, and a rejected cursor (`invalid_cursor`) offering Refresh, which restarts without a cursor;
  - Refresh from page one;
  - sparse, paused, end, empty, full-failure, configuration and health states;
  - the scroll anchor with reordered results under a sticky header, scrolling while a page loads, and no restoration after Refresh or across streams.
- `pnpm test:e2e` (local Chrome, production Demo build): 36 passed, 6 skipped by design. Explore coverage:
  - search with reload and Back;
  - URL sanitizing;
  - desktop filters;
  - Load more keeping the reading position within 2px: on Demo data; with intercepted responses that insert newer articles above; and when the user scrolls about 1000px while the request is pending;
  - the mobile Sheet draft, nav exclusivity and focus return;
  - axe with results and with the Sheet open;
  - 320px overflow, including a 100-character applied search chip that stays removable. Overflow checks compare against the fixed 320px width, because mobile emulation widens `innerWidth` to fit oversized content.
- **Layouts:** 1 column at 320 and 390px, 2 columns at 768, 1024 and 1279px, and 3 at 1280 and 1440px. There is no horizontal overflow at any width.
- **Docker image (Demo):** health check `healthy`, feed and cursor follow-up, a 400 for an invalid date, and the Explore deep link were served.

### Review fixes (2026-10-20)

- **Long applied-filter chips** overflowed narrow screens. A 100-character query made the page about 840px wide at 320px. The chip list and items now have `min-w-0` and `max-w-full`, so labels truncate. The full text is in the accessible name and tooltip.
- **Stale scroll anchor:** the reading position was captured on the Load more click, so scrolling during the request was undone (about 1000px in the reproduction). It is now captured just before the merged list renders.
- **`invalid_cursor` recovery:** the footer offered Load more, which resent the rejected cursor. It now offers Refresh, while transient failures still retry the same cursor.

Each fix has a regression test that failed on review baseline `791538c` and passes now.

### Limitations

- Demo articles have no images, so Demo always shows the image fallback; Live articles use provider images.
- Explore ignores `author` URL parameters, because author filtering belongs to My Feed (phase 4).
- Relative times use the time the grid mounted and do not tick while the page stays open.

## Phase 4: Preferences and My Feed

### Hosted Phase 3 preflight (2026-10-20)

Production `dpl_2MRCs53MSgji1Pg7FJuMnxEHnEby` was deployed by the deploy job of main CI run 39338393168 from merge `a43dee2`, and every job passed. `/api/health` reports Live, ready and all providers configured. Explore showed the Live badge and 30 real articles (theguardian.com, nytimes.com, bbc.co.uk, fortune.com). Selecting The Guardian produced `?source=guardian` and 10 Guardian articles. The check used one health request and two feed requests.

### Implemented

- **Preferences:** applied preferences live in a provider shared by all routes. A validated, versioned `localStorage` payload is hydrated without rewriting, and every storage access is guarded. Persistence is reported honestly, and preferences keep working in memory after a write failure.
- **Preferences page:** sources, categories and authors in a local draft. Save, Cancel and Reset come with dirty, saved and not-persisted feedback in a sticky action bar.
- **Authors:** manual entry with connected duplicate, empty, over-long and limit errors; suggestions from cached pages of the current mode only; removable pills that wrap long names.
- **My Feed:** a setup state with no request when every group is empty, and otherwise the shared `ArticleFeed` with filters from the saved groups only. It also shows a summary of the saved groups, an author-matching note and personalized empty wording.
- **Shared:** `ToggleChip` now serves both Explore and Preferences, and `ArticleFeed` accepts empty-state wording.

### Verification (local, 2026-10-20)

- `pnpm format:check`, `lint`, `typecheck` and `build` pass.
- `pnpm test` passes 252 tests in 27 files. New coverage:
  - **Storage:** valid, malformed JSON, invalid fields, unsupported or missing versions, and limit violations; inaccessible `localStorage`, and throwing `getItem`/`setItem`.
  - **Drafts:** draft isolation across navigation; Save, Cancel, Reset-then-Cancel and Reset-then-Save.
  - **Persistence:** hydration without a write; write failure with in-memory continuity and honest messages, then a successful retry; read failure at start.
  - **Authors:** accents and commas kept; duplicate, empty, over-long and 20-limit errors connected to the field; mode-separated cache suggestions that update with the cache and fetch nothing; a saved author absent from suggestions staying selected.
  - **My Feed requests:** no request when empty; exact requests for source-only, category-only, author-only and combined preferences, with no Explore keyword or dates.
  - **My Feed streams:** a sparse author batch with no auto-fetch; changed preferences starting a new stream without stale results.
- `pnpm test:e2e` (local Chrome, production Demo build): 44 passed, 8 skipped by design. New:
  - Preferences → Save → My Feed (exact request) → reload;
  - Cancel and Reset;
  - keyboard author add and remove;
  - all categories plus an 80-character author at a fixed 320px on both pages;
  - axe on Preferences and My Feed;
  - no feed request before preferences exist.
- **Layouts:** no horizontal overflow on Preferences at 320, 390, 768 and 1440px, or on My Feed at 320, 390 and 1440px, each measured against the fixed viewport width.
- **Docker image (Demo):** health check `healthy`; feed and cursor follow-up; invalid date → 400; an author-filtered feed; `/preferences` and `/my-feed` deep links served.

### Limitations

- **Drafts:** an unsaved draft is discarded when leaving Preferences; there is no unsaved-changes prompt.
- **Suggestions:** they come only from articles loaded in the current session, so a full page reload clears them until articles load again. Typing a name always works.
- **Other tabs:** there is no cross-tab synchronization.

## Phase 5: release readiness

Production at the start of Phase 5 was `dpl_AxKnv11WpL7StLnvNRByXV1diehK` (`93jo1tjw0`). The deploy job of main CI run 39380103211 built it from the PR #5 merge `aa0e164`, and Quality, E2E, Docker smoke and Deploy all succeeded.

### Review and fixes

A scripted review of the production Demo build covered Explore, Preferences and My Feed at 320, 390, 768 and 1440px. It used long searches, titles, publisher and author names, and every category and source selected. Through intercepted responses it also covered loaded, missing and broken images; partial, full and pagination failures; sparse batches; both Sheets; storage failure; and empty preferences. It found:

- **Primary button hover failed AA contrast:** 4.39:1, because shadcn's `hover:bg-primary/80` lightened the teal. It is now `/90` (about 5.4:1). An E2E check runs axe while the pointer rests on Save; it failed before the fix and passes now.
- **Heading order:** the author-suggestions label was an `h3` with no `h2` above it (moderate). It is now a labelled paragraph.
- **Touch targets:** the search Clear button, applied-filter chips, Clear all and author Remove buttons were 36px on touch layouts. They are now 44px below 1024px, with a mobile E2E size check.
- **Clean-checkout tooling:** when pnpm keeps its store inside the project (bind mounts such as Docker), `pnpm format:check` failed on `.pnpm-store/`. That directory is now ignored by Prettier, ESLint, Git and the Docker context.

Everything else passed in every state: no overflow against the fixed width, and no serious or critical axe violations on all three pages and their interactive states. After the fixes, axe reports no violations of any impact on Explore, Preferences or My Feed. The keyboard pass also passed:

- The focus order runs skip link, brand, navigation, search, filters, dates, then results.
- Every stop shows a visible focus ring or border.
- Sheets trap focus and return it to their trigger.
- Reduced motion disables the transitions and the skeleton pulse.

### Automated verification

- `pnpm format:check`, `lint`, `typecheck` and `build` pass.
- `pnpm test` passes 252 tests in 27 files.
- `pnpm test:e2e` passes 50 tests, with 10 skipped by design (viewport-specific). New this phase: the image states, blocked storage with hover contrast, and the touch-target sizes.

### Clean-checkout verification (commit `0eda052`)

The branch was freshly cloned from GitHub into a temporary directory with no `node_modules`, `.env`, `.vercel` or `dist`, then run in a `node:22-bookworm` container (Node 22.23.3) with pnpm 10.33.0 installed explicitly.

- **Quality commands:** `pnpm install --frozen-lockfile`, `format:check`, `lint`, `typecheck`, `test` (252 passed) and `build` all exited 0.
- **`pnpm start` (keyless):** health returned `demo`/ready. `/`, `/explore`, `/my-feed` and `/preferences` returned 200. The feed returned 30 articles with a cursor, and page 2 another 30. An invalid date returned 400 and an unknown API route 404.
- **`pnpm dev` (keyless):** through the Vite proxy, health returned Demo, `/explore` served the app and the feed returned articles. Inside the container Vite answered on `[::1]:5173`, its default `localhost` binding.
- **E2E:** Playwright ran from a second fresh clone (host browser, local Chrome) against that Node 22 production server: 50 passed, 10 skipped.

### Docker verification (clean checkout)

`HOST_PORT=8096 docker compose -p newsdesk-verify up --build -d` used a separate project name and a free port, and left existing containers untouched.

- **Container:** health check `healthy`, user `node` (uid 1000), Node 22.23.3, `NEWS_MODE=demo`. `/app` contains only `dist`, `node_modules`, `package.json` and `pnpm-lock.yaml`.
- **Build context:** a synthetic `.env` and `.env.local` holding only a marker string were placed in the checkout. Neither file, nor the marker, reached the image.
- **Routes and API:** every page deep link returned 200. Combined feed page 1 and page 2 each returned 30 articles. An invalid date returned 400 `invalid_request` (`fields: ["from"]`), a bad cursor `invalid_cursor`, an unknown API route a JSON 404 and a missing file 404.
- **Cleanup:** the Compose project and its image were removed afterwards.

### Hosted Live verification

Production SHA `aa0e164`, deployment `dpl_AxKnv11WpL7StLnvNRByXV1diehK`. The fixes on this branch are not deployed yet.

- **Health:** Live, ready, all three providers configured. The sidebar shows the Live badge.
- **Explore** `?q=climate&from=2026-10-13`: 200, Live, 30 articles with Guardian, NYT and NewsAPI each `ok` (10/10). Hosts were theguardian.com, nytimes.com, bbc.co.uk, businessinsider.com, fortune.com and wired.com, with no Demo hosts.
- **Load more** (real cursor, 14.7 s after the first NYT request): 30 more articles, all providers `ok`, none repeated from page 1; the UI showed 60.
- **Preferences:** The Guardian + Technology, then Save ("Preferences saved."), then client-side navigation to My Feed, which requested exactly `?source=guardian&category=technology` with no inherited keyword or date. That returned 10 Guardian articles, with NYT and NewsAPI `skipped (not_selected)`. A reload restored the preferences from storage and repeated the same request.
- **Author suggestions:** the first count read 0 because it ran before the Preferences page had rendered. A repeat with a single Guardian-only request, waiting for the page, showed 12 suggestions from cached Live articles.
- **Request budget:** 6 feed requests in total, the last one for a screenshot that was not committed because it contains third-party news images. The category smoke suite was not re-run.

### Secrets and repository hygiene

- **Tracked and historical files:** `.env.example` is the only env-like file ever tracked, and its key values are empty. No PDF, `.vercel` or recovery files are tracked or in history.
- **Key values:** none of the three real key values appears in any commit, local `dist` output or the production client assets. There are no `api-key=` strings in the bundle and no `VITE_` variables.
- **CI artifacts:** none exist.
- **Personal material:** no personal paths, planning-folder references or employer file names in tracked files.

### Remaining limitations

- **NewsAPI:** the mixed business + health smoke result stays inconclusive and non-blocking. NewsAPI's free plan is licensed for development and testing.
- **Author suggestions** reflect only articles loaded in the current session.
- **Drafts:** leaving Preferences discards an unsaved draft without a prompt.
- **Pending:** the merge of this PR and the post-merge production check of the fixes above.
