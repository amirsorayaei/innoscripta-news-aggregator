# Implementation status

_Last updated: 2026-10-20 (Asia/Tehran)._

| Phase | Branch                     | Status                                                                                                                |
| ----- | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1     | `chore/project-foundation` | Merged (PR #1, merge commit `94751f0`); production verified                                                           |
| 2     | `feat/news-providers`      | [Draft PR #2](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/2); real-provider verification pending |
| 3     | `feat/explore-feed`        | Not started                                                                                                           |
| 4     | `feat/personalized-feed`   | Not started                                                                                                           |
| 5     | `chore/release-readiness`  | Not started                                                                                                           |

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
- **Tooling:** `pnpm smoke:live`, a bounded manual Live check. The Docker smoke in CI and the E2E suite now request the Demo feed.

## Phase 2: automated verification (local, 2026-10-20)

- `pnpm format:check`, `lint`, `typecheck` and `build` pass.
- `pnpm test` passes 131 tests in 14 files. Coverage includes filter and date validation, normalization, all three request builders and mappers, auth, rate-limit and invalid-response handling, partial and total failure, timeout, client-disconnect cancellation, cache and secret redaction, Demo determinism and pagination, and incomplete Live config.
- `pnpm test:e2e` (local Chrome): 20 passed, 2 skipped by design.
- Docker image (Demo): health, deep links, API 404, Demo feed, cursor follow-up and a 400 for an invalid date all pass.

## Phase 2: real-provider verification

- **Local:** pending. No provider keys were available in the local `.env`. A harness check with deliberately invalid keys reached all three APIs from the development machine (Guardian 401, NYT 401 `oauth.v2.InvalidApiKey`, NewsAPI 401 `apiKeyInvalid`), and each was mapped to `unauthorized`. One earlier NYT request returned an HTML 403 from Google's front end, but it did not reproduce.
- **Hosted (Vercel):** pending. This needs the merged code and, for Live checks, provider keys in Vercel. Production stays in Demo mode, and no Vercel environment variables were changed.

To complete it, add the three free keys to `.env` and run `pnpm smoke:live --categories`. This makes at most 10 requests per provider plus one NewsAPI source-catalogue request.

## Blockers and notes

- Free provider keys are needed to verify the live schemas, mappings and pagination. The Guardian's public `test` key no longer works (HTTP 401).
- NewsAPI Developer terms allow development and testing only. A successful hosted request does not change that.
- The Playwright CDN is unreachable from the development machine, so local E2E uses the installed Chrome. CI uses Playwright's Chromium.
- Node 22 is not installed locally, so Node 22 is exercised through Docker, CI and Vercel.

## Next (phase 3, after approval)

Explore page: article cards, search and filters with URL state, desktop and mobile filter UI, real Load more with scroll preservation, and request and empty-state UX.
