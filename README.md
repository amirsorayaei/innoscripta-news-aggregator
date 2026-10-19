# News Desk

A React + TypeScript news aggregator that combines articles from The Guardian, The New York Times and NewsAPI behind a small Express backend-for-frontend (BFF).

> **Status:** project foundation (phase 1 of 5). The application shell, routing, health API, Docker image, CI and Vercel wiring are in place. Provider integrations, search, filters and the personalized feed are not implemented yet. See [docs/implementation-status.md](docs/implementation-status.md).

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

Copy `.env.example` to `.env` to configure Live mode for Docker. Keys are read only by the server and never use the `VITE_` prefix, so they are not bundled into the client.

`GET /api/health` reports the mode and whether each provider key is configured, without revealing any key.

## Docker

```bash
docker compose up --build
```

The app is served on http://localhost:8080 in Demo mode, with no keys needed. For Live mode, create `.env` from `.env.example`, set `NEWS_MODE=live` and the three keys, then run the same command. If port 8080 is busy, use `HOST_PORT=8081 docker compose up --build`.

The multi-stage image builds the client and server with the pinned pnpm, then runs `node dist/server/index.js` as a non-root user with production dependencies only. Express serves the built client and the API from one port, and a Docker health check calls `/api/health`.

## Scripts

| Command                             | Purpose                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                          | Vite dev server and API in watch mode                    |
| `pnpm build`                        | Typecheck, then build the client and server into `dist/` |
| `pnpm start`                        | Run the production server (client + API on `PORT`)       |
| `pnpm lint` / `pnpm typecheck`      | ESLint / TypeScript project references                   |
| `pnpm format` / `pnpm format:check` | Prettier                                                 |
| `pnpm test`                         | Unit and integration tests (client and server projects)  |
| `pnpm test:e2e`                     | Playwright against the production Demo build             |

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
- [docs/implementation-status.md](docs/implementation-status.md): current phase and verification log
- [docs/ai-usage.md](docs/ai-usage.md): how AI assistance was used
