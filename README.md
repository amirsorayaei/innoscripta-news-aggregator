# News Desk

A React + TypeScript news aggregator that combines articles from The Guardian, The New York Times and NewsAPI behind a small Express backend-for-frontend (BFF).

> **Status:** phase 2 of 5. The BFF serves a paginated feed from The Guardian, The New York Times and NewsAPI (`GET /api/feed`), with a deterministic Demo mode. The Explore UI, search and filter controls and the personalized feed arrive in later phases. See [docs/implementation-status.md](docs/implementation-status.md).

## Stack

- **Client:** React 19, TypeScript (strict), Vite, React Router, TanStack Query, Tailwind CSS, shadcn/ui (Radix) and Lucide
- **Server:** Express 5 BFF with Zod validation; provider API keys stay on the server
- **Tests:** Vitest, Testing Library, MSW, Supertest, Playwright and axe
- **Tooling:** pnpm, ESLint, Prettier, Husky and lint-staged

## Requirements

- Node.js 22 (see `.nvmrc`)
- pnpm 10.33.0 (pinned in `package.json` → `packageManager`)
- Docker with Compose v2.24+ (optional, for the container)

## Getting started

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts Vite on http://localhost:5173 and the Express API on port 8080. Vite proxies `/api` to the API.

## Demo and Live modes

The server reads `NEWS_MODE` at startup:

| Mode             | Behaviour                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `demo` (default) | Sample data only. No API keys and no outbound requests. A permanent badge shows Demo.             |
| `live`           | Real provider requests. `GUARDIAN_API_KEY`, `NYT_API_KEY` and `NEWSAPI_API_KEY` are all required. |

Copy `.env.example` to `.env` to configure Live mode. `pnpm dev`, `pnpm start` and `docker compose` load `.env` when it exists (Node's `--env-file-if-exists`), and variables already exported in the shell take precedence. Without `.env` the server starts in keyless Demo mode. Keys are read only by the server and never use the `VITE_` prefix, so they are not bundled into the client.

`GET /api/health` reports the mode and whether each provider key is configured, without revealing any key.

Demo articles are fictional and use `example.com` links. Their timestamps are five hours apart, counting back from `DEMO_NOW` (default `2026-10-19T09:00:00Z`), so the Demo feed covers roughly the week before that time. Live mode never substitutes Demo data when a provider fails.

## Feed API

`GET /api/feed` accepts `q`, `from`, `to` (`YYYY-MM-DD`, UTC days), repeated `source`, `category` and `author` parameters, and an opaque `cursor`. Each response contains up to one page of ten articles per active provider, per-provider statuses (`ok`, `exhausted`, `paused` or `skipped`) and a `nextCursor` for Load more. See [docs/architecture.md](docs/architecture.md) for the contract, pagination rules and provider mappings.

## Provider notes and limitations

- **NewsAPI** has no category filter on `/v2/everything`. Categories are matched through a curated list of publishers, so a NewsAPI article's category describes its publisher, not necessarily the article. The free Developer plan searches about one month back, and older ranges are skipped or clamped with a note. Its terms limit the free plan to development and testing.
- **The Guardian and NYT** filter categories natively, through keyword tags and sections respectively. Multi-word search semantics differ between providers.
- **Author filtering** applies to the pages fetched so far. It is not an exhaustive archive search.
- **Free-tier rate limits** apply: NYT allows about 5 requests per minute. The server caches successful pages for 5 minutes and pauses a provider after a 429 instead of retrying.

## Docker

```bash
docker compose up --build
```

The app is served on http://localhost:8080 in Demo mode, with no keys needed. For Live mode, create `.env` from `.env.example`, set `NEWS_MODE=live` and the three keys, then run the same command. If port 8080 is busy, use `HOST_PORT=8081 docker compose up --build`.

The multi-stage image builds the client and server with the pinned pnpm, then runs `node dist/server/index.js` as a non-root user with production dependencies only. Express serves the built client and the API from one port, and a Docker health check calls `/api/health`.

## Scripts

| Command                             | Purpose                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | Vite dev server and API in watch mode                                                                                                                                                                                                                                                        |
| `pnpm build`                        | Typecheck, then build the client and server into `dist/`                                                                                                                                                                                                                                     |
| `pnpm start`                        | Run the production server (client + API on `PORT`)                                                                                                                                                                                                                                           |
| `pnpm lint` / `pnpm typecheck`      | ESLint / TypeScript project references                                                                                                                                                                                                                                                       |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                                                                                                                                                                                                                     |
| `pnpm test`                         | Unit and integration tests (client and server projects)                                                                                                                                                                                                                                      |
| `pnpm test:e2e`                     | Playwright against the production Demo build                                                                                                                                                                                                                                                 |
| `pnpm smoke:live`                   | Manual Live check of all three providers (needs keys; not in CI). Each check passes, fails or is inconclusive; exit code 0 = all passed, 1 = any failed, 2 = some inconclusive. Up to 3 requests per provider; `--categories` adds 8 category checks each plus one NewsAPI catalogue request |

Playwright downloads its own Chromium (`pnpm exec playwright install chromium`). To use an installed Chrome instead, run `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e`.

## Project layout

```
api/            Vercel function entry that exports the shared Express app
e2e/            Playwright tests
src/client/     React app (routes, layout, features, shadcn/ui components)
src/server/     Express app, configuration and the Node entry point
src/shared/     Zod contracts and types shared by client and server
```

## Deployment

Production runs on Vercel: the client is served from the CDN, and `api/index.ts` runs the same Express app as a function. GitHub Actions is the only deployment path. Pull requests run quality checks, E2E tests and a Docker smoke test, and a push to `main` deploys with `vercel deploy --prebuilt --prod` only after all three pass. Vercel Git auto-deployments are disabled in `vercel.json`.

## Documentation

- [DESIGN.md](DESIGN.md): visual direction, tokens and references
- [docs/architecture.md](docs/architecture.md): contracts, pagination, caching and provider mappings
- [docs/implementation-status.md](docs/implementation-status.md): current phase and verification log
- [docs/ai-usage.md](docs/ai-usage.md): how AI assistance was used
