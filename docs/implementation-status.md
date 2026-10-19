# Implementation status

_Last updated: 2026-10-19 (Asia/Tehran)._

| Phase | Branch                     | Status                         |
| ----- | -------------------------- | ------------------------------ |
| 1     | `chore/project-foundation` | PR open, awaiting review/merge |
| 2     | `feat/news-providers`      | Not started                    |
| 3     | `feat/explore-feed`        | Not started                    |
| 4     | `feat/personalized-feed`   | Not started                    |
| 5     | `chore/release-readiness`  | Not started                    |

## Phase 1: completed

- Prettier, ESLint with `eslint-config-prettier`, Husky pre-commit running lint-staged, and the `format`/`format:check` scripts. The hook ran on every commit in this branch.
- pnpm 10.33.0 pinned via `packageManager`, and Node 22 via `.nvmrc` and `engines`.
- Strict TypeScript project references for client, server (NodeNext) and tooling.
- `src/client`, `src/server` and `src/shared` layout. Shared Zod health contract.
- Tailwind v4 and shadcn/ui (Radix, nova preset) with the News Desk light theme.
- App shell with Explore, My Feed, Preferences and Not found routes. Desktop sidebar and mobile Sheet navigation, a skip link, and a mode badge driven by `/api/health`.
- Express app: `/api/health`, JSON 404 for unknown API routes, and production static serving with SPA fallback for extension-less paths.
- Vitest projects (client/jsdom and server/node), Testing Library, MSW and Supertest.
- Playwright desktop (1440px) and mobile (Pixel 7) projects against the production Demo build, with axe checks.
- Multi-stage Docker image (Node 22 Alpine, pinned pnpm, non-root user, health check) and Compose.
- GitHub Actions: quality → E2E and Docker smoke → production deploy (main only, prebuilt).
- Vercel project `innoscripta-news-aggregator` linked, with Git auto-deploy disabled and cancellation enabled for the API function.

## Phase 1: validation results

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed locally on Node 24.14.0.
- `pnpm test`: 4 files, 21 tests passed.
- `pnpm test:e2e` (local, `PLAYWRIGHT_CHANNEL=chrome`): 18 passed, 2 skipped by design (mobile-only checks on desktop).
- Docker: the image builds and runs Node 22.23.3 as user `node`, and the health check reports `healthy`. Health, deep links and the API 404 were checked. Live env with one key reports `ready: false`, and an invalid `NEWS_MODE` exits with a clear message.
- Vercel (CLI prebuilt deployment): health returns 200 JSON with `no-store`, unknown API routes return a JSON 404, deep links serve the SPA, missing files return 404, and the function runs on `nodejs22.x`.

## Blockers and notes

- `VERCEL_TOKEN` repository secret is required for the deploy job. `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are set.
- The Playwright browser CDN is not reachable from the developer's location, so local E2E uses the installed Chrome. CI uses Playwright's Chromium.
- Node 22 is not installed locally, so Node 22 was verified through Docker and is enforced in CI and on Vercel.
- The verification deployment was created with the CLI from this branch and was labelled Production by Vercel. Later production deployments go through the main-branch workflow only.

## Next (phase 2, after approval)

Shared feed contracts, Guardian/NYT/NewsAPI adapters, Demo fixtures, the feed service with cursors, cache, timeouts and cancellation, and live smoke tooling.
