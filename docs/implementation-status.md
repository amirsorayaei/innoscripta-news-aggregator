# Implementation status

What is implemented, what was verified and what limitations remain. Each result below carries its own commit and date; the date this document was last edited is not a verification date.

## Requirement coverage

### Assignment requirements

| Requirement                                     | Implementation                                                                                                                                                                                                | Tests                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyword search                                  | [`SearchBar.tsx`](../src/client/features/explore/SearchBar.tsx), sent to every provider as `q`                                                                                                                | [`ExplorePage.test.tsx`](../src/client/features/explore/ExplorePage.test.tsx), [`e2e/explore.spec.ts`](../e2e/explore.spec.ts)                                                                                                                                                                                                   |
| Filter by date                                  | [`shared/dates.ts`](../src/shared/dates.ts), provider date parameters and a server post-filter in [`feed-service.ts`](../src/server/feed/feed-service.ts)                                                     | [`dates.test.ts`](../src/shared/dates.test.ts), [`feed-filters.test.ts`](../src/shared/feed-filters.test.ts), [`feed-service.test.ts`](../src/server/feed/feed-service.test.ts)                                                                                                                                                  |
| Filter by category                              | Per-provider mappings in [`src/server/providers`](../src/server/providers) ([how they differ](architecture.md#provider-mappings))                                                                             | [`guardian.test.ts`](../src/server/providers/guardian.test.ts), [`nyt.test.ts`](../src/server/providers/nyt.test.ts), [`newsapi.test.ts`](../src/server/providers/newsapi.test.ts)                                                                                                                                               |
| Filter by source                                | Source filter in Explore and Preferences; excluded providers are skipped in [`feed-service.ts`](../src/server/feed/feed-service.ts)                                                                           | [`feed-service.test.ts`](../src/server/feed/feed-service.test.ts), [`ExplorePage.test.tsx`](../src/client/features/explore/ExplorePage.test.tsx)                                                                                                                                                                                 |
| Personalized feed: sources, categories, authors | [`features/preferences`](../src/client/features/preferences) and [`MyFeedPage.tsx`](../src/client/features/my-feed/MyFeedPage.tsx)                                                                            | [`PreferencesPage.test.tsx`](../src/client/features/preferences/PreferencesPage.test.tsx), [`preferences-storage.test.ts`](../src/client/features/preferences/preferences-storage.test.ts), [`MyFeedPage.test.tsx`](../src/client/features/my-feed/MyFeedPage.test.tsx), [`e2e/preferences.spec.ts`](../e2e/preferences.spec.ts) |
| Mobile-responsive design                        | Responsive layouts, mobile navigation and the [filter sheet](../src/client/features/explore/MobileFilters.tsx); 44px touch targets below 1024px                                                               | Playwright `mobile` project (Pixel 7) in [`e2e/`](../e2e), including 320px overflow and touch-target checks                                                                                                                                                                                                                      |
| At least three listed data sources              | The Guardian, The New York Times and NewsAPI adapters in [`src/server/providers`](../src/server/providers)                                                                                                    | Adapter tests above, plus the dated real-provider checks below                                                                                                                                                                                                                                                                   |
| React.js with TypeScript                        | React 19 with strict TypeScript across client, server and shared code                                                                                                                                         | `pnpm typecheck` in CI                                                                                                                                                                                                                                                                                                           |
| Docker with documentation                       | [`Dockerfile`](../Dockerfile), [`docker-compose.yml`](../docker-compose.yml), [README: Docker](../README.md#docker)                                                                                           | CI Docker smoke job                                                                                                                                                                                                                                                                                                              |
| DRY, KISS, SOLID                                | Shared Zod contracts, one adapter contract per provider, adapters injected into the feed service, one feed component reused by Explore and My Feed ([architecture](architecture.md#decisions-and-trade-offs)) | n/a                                                                                                                                                                                                                                                                                                                              |

### Additional features

Not required by the assignment, added on top: an Express BFF that keeps keys server-side, explicit Demo and Live modes, cursor-based Load more with reading-position preservation, canonical-URL deduplication, per-provider statuses and notes, Save/Cancel preferences with storage-failure handling, axe accessibility checks, and a CI pipeline that gates the Vercel deploy. [architecture.md](architecture.md) explains each decision.

Left out on purpose: accounts, a database, cross-tab sync, dark mode and an in-app article reader.

## Verification evidence

### Recorded baseline: `main` at `8b2ef5a`

[CI run 39632489528](https://github.com/amirsorayaei/innoscripta-news-aggregator/actions/runs/39632489528) (2026-10-21, push of merge [#10](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/10), which also contains the image fix from [#9](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/9)). Every job succeeded:

- **Quality:** `format:check`, `lint`, `typecheck`, `test` (261 tests in 29 files) and `build`.
- **E2E (Demo build):** Playwright with axe against the production Demo build: 50 passed, 10 skipped by design (checks that apply only to the desktop or the mobile project).
- **Docker smoke:** builds and runs the image, then checks Demo health, a deep link, a JSON 404, the Demo feed with a cursor follow-up, and a 400 for an invalid date.
- **Deploy production:** ran only after the three jobs above, and aliased the build to https://innoscripta-news-aggregator-chi.vercel.app.

These checks use Demo data and make no provider requests. `8b2ef5a` is the last application change recorded here; later documentation-only commits are not covered by this run.

### Fixes after the release

- **Article images** ([#9](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/9)): an image that failed once now loads again when a merge supplies a different URL. Covered by [`ArticleImage.test.tsx`](../src/client/features/articles/ArticleImage.test.tsx).
- **PORT** ([#10](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/10)): the dev proxy follows `PORT` from `.env` like the server, and Compose pins the container port to 8080. Covered by [`dev-api-port.test.ts`](../scripts/dev-api-port.test.ts); the PR describes the reproduction and the fixture-based dev and Compose checks.

### Earlier dated checks

These were not repeated against the latest deployment.

- **Real providers, local (2026-10-20):** `pnpm smoke:live --categories` with free keys at `0b90380`. The Guardian and NYT passed every check, including pagination, keyword with dates and all seven categories. NewsAPI failed its catalogue check (two missing publishers), and its sports check was inconclusive because BBC Sport articles came back as `bbc-news`. After both were fixed in [#2](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/2), a NewsAPI-only rerun returned 11 passed and 1 inconclusive.
- **Hosted Live on Vercel:**
  - 2026-10-20, deployment from `a78b110` ([#3](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/3)): health reported Live with all providers configured; each provider alone, the combined page and a cursor follow-up returned real articles with no Demo fallback.
  - 2026-10-20, deployment from `aa0e164`: Explore with keyword and date, Load more, and Preferences → My Feed → reload.
  - 2026-10-21, post-merge check of `4aeff29` ([#7](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/7)): Live health and articles on Explore, primary-button hover contrast 5.54:1 with no axe violations, and 44px mobile touch targets.
- **Clean checkout and Docker (2026-10-20, `0eda052`, [#6](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/6)):** a fresh clone in a Node 22 container passed install, the quality commands, `pnpm start`, `pnpm dev` and E2E without keys. `docker compose up --build` from a clean checkout served the app and API, and a synthetic `.env` did not reach the image.
- **Secrets (2026-10-20, [#6](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/6)):** none of the three key values appeared in any commit, local build output or the production client assets, and `.env.example` was the only env-like file ever tracked.

**Inconclusive, non-blocking:** in the NewsAPI rerun, the mixed business + health check returned only business articles on its newest page, while the separate health check passed. This alone does not show a filtering bug, and the verdict stays inconclusive.

The full phase-by-phase log, with request counts and deployment IDs, is preserved in the [pre-cleanup version of this file](https://github.com/amirsorayaei/innoscripta-news-aggregator/blob/8b2ef5a50994d27a349dd2d633d22c14e1e22682/docs/implementation-status.md).

## Remaining limitations

- **Provider-level sources and publisher-based NewsAPI categories:** see [architecture: limitations](architecture.md#limitations).
- **Author filtering** matches within the pages providers return, not across their archives.
- **Free plans and caching:** NYT allows about 5 requests per minute, NewsAPI's Developer plan delays articles and is licensed for development and testing only, the cache is per instance, and there is no application-level rate limiting.
- **Preferences** stay in this browser only, with no cross-tab sync, and leaving Preferences discards an unsaved draft without a prompt.
- **Author suggestions** come only from articles already loaded in the current session.
- **Live checks are dated:** provider APIs and free-plan terms can change after the checks above.

The [README](../README.md#limitations) covers these from a user's point of view.
