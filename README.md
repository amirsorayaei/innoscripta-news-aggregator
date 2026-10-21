# News Desk

A React + TypeScript news aggregator that combines articles from **The Guardian**, **The New York Times** and **NewsAPI** in one clean, responsive reading interface.

**Live app:** https://innoscripta-news-aggregator-chi.vercel.app

| Explore (Demo data)                                                                                                    | Preferences                                                                                                                          | My Feed (mobile)                                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| <img src="docs/screenshots/phase-3/desktop-explore.png" width="320" alt="Explore page with filters and article cards"> | <img src="docs/screenshots/phase-4/desktop-preferences.png" width="320" alt="Preferences form with sources, categories and authors"> | <img src="docs/screenshots/phase-4/mobile-myfeed.png" width="160" alt="My Feed on a phone"> |

Screenshots use the synthetic Demo data, which has no images; Live articles show provider images.

## Features

- **Explore:** keyword search, plus filters for source, category and an inclusive date range (UTC days).
  - Search applies after a short pause, or immediately on Enter.
  - Filters live in the URL, so reload, sharing and Back/Forward restore them.
  - On phones, filters open in a sheet that applies changes only on **Apply**.
- **Preferences:** choose sources, categories and authors.
  - Authors can be typed as full names or picked from articles already loaded.
  - Edits stay in a draft until **Save**. **Cancel** restores the saved preferences, and **Reset** only clears the draft.
- **My Feed:** articles matching the saved preferences, with OR within a group, AND between groups, and an empty group meaning "any". With nothing saved, it asks you to choose preferences instead of loading a generic feed.
- **One merged feed:** articles from all providers are deduplicated by canonical URL and sorted newest first.
  - **Load more** follows the server's cursor and keeps your reading position.
  - Partial failures, sparse batches, provider limits and the real end of results are each explained.
- **Responsive and accessible:** layouts from 320px to wide desktop; keyboard support, visible focus, labelled controls, connected error messages and status announcements.
- **Demo and Live modes:** a keyless Demo mode with deterministic sample data, and a Live mode that calls the real APIs from the server only.

## Requirements

- **Node.js 22** (`.nvmrc`). The production build, Docker image, CI and Vercel all use Node 22.
- **pnpm 10.33.0** (pinned in `package.json` → `packageManager`; install with `npm install --global pnpm@10.33.0`)
- **Docker** with Compose v2.24+ (only for the container)

## Quick start (keyless Demo)

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5173. `pnpm dev` runs Vite and the Express API (port 8080, or `PORT` from the shell or `.env`) together, and Vite proxies `/api` to the API. Without a `.env` file the app runs in **Demo** mode:

- fictional articles with `example.com` links;
- no API keys and no outbound requests;
- a permanent **Demo data** badge.

To run the production build:

```bash
pnpm build
pnpm start      # client and API on http://localhost:8080
```

## Live mode

Copy `.env.example` to `.env` and fill in:

```dotenv
NEWS_MODE=live
GUARDIAN_API_KEY=...   # https://open-platform.theguardian.com/access/
NYT_API_KEY=...        # https://developer.nytimes.com/
NEWSAPI_API_KEY=...    # https://newsapi.org/register
```

- **Required keys:** all three. Without them, `/api/feed` returns `503 configuration_error`, and the app says so instead of showing Demo data.
- **Where keys live:** only on the server. They never use a `VITE_` prefix and never reach the browser, and `.env` is git- and Docker-ignored.
- **Loading:** `pnpm dev`, `pnpm start` and Docker Compose load `.env` when present. Variables already exported in the shell take precedence.
- **Checking the setup:** `GET /api/health` shows the mode and which keys are configured, without revealing them.

## Docker

```bash
docker compose up --build
```

- **Demo:** serves the app and API on http://localhost:8080, keyless.
- **Live:** create `.env` as above and run the same command.
- **Port in use:** `HOST_PORT=8081 docker compose up --build`. Inside the container the API always listens on 8080, so `PORT` in `.env` does not apply.

The multi-stage Node 22 image builds with the pinned pnpm, installs production dependencies only, runs as the non-root `node` user and includes a health check.

## Tests and quality

| Command                                    | What it runs                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `pnpm format:check` · `lint` · `typecheck` | Prettier, ESLint, TypeScript                                                |
| `pnpm test`                                | Vitest unit and integration tests (Testing Library, MSW, Supertest)         |
| `pnpm test:e2e`                            | Playwright with axe against the production Demo build, desktop and mobile   |
| `pnpm smoke:live`                          | Optional manual check of the real APIs. It needs keys and is not part of CI |

Playwright uses its own Chromium (`pnpm exec playwright install chromium`). To use an installed Chrome instead, run `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e`.

GitHub Actions runs the quality checks, E2E and a Docker smoke test on every pull request. A push to `main` deploys to Vercel only after all three pass.

## Architecture

A single package with three source roots:

```
src/client/   React app: features/articles (reusable feed), explore, preferences, my-feed
src/server/   Express BFF: config, provider adapters, Demo data, feed service, routes
src/shared/   Zod contracts and pure helpers used by both sides
api/          Vercel function entry exporting the same Express app
```

- **Request flow:** the browser calls only the BFF (`GET /api/health`, `GET /api/feed`). The BFF calls the three providers in parallel, each with a 5-second timeout and cancellation. It normalizes and validates every article, caches successful pages for 5 minutes, and returns per-provider statuses with an opaque cursor.
- **Client:** TanStack Query handles requests and pagination; React context holds the saved preferences.
- **More detail:** [docs/architecture.md](docs/architecture.md).

## Limitations

- **Free plans:** NYT allows about 5 requests per minute. NewsAPI's Developer plan searches about one month back, delays articles, and is licensed for development and testing only. A rate-limited provider is paused with a message rather than retried.
- **NewsAPI categories:** `/v2/everything` has no category filter, so categories come from 16 curated publishers and describe the **publisher**, not each article. BBC Sport articles come back as `bbc-news`, so a BBC article gets a category only when the request makes it unambiguous.
- **Author filtering:** matches full names, ignoring case and spacing, within the pages the providers return. It is not an archive-wide author search, so a batch can have no matches while more follow.
- **Saved preferences:** stored only in this browser's `localStorage` (`news-desk.preferences`). There are no accounts and no cross-tab sync. If storage is blocked, they work for the session and the app says _"Changes are not persisted on this device."_
- **Provider behaviour differs:** multi-word search and section and tag coverage vary by provider.

## Documentation

- [docs/implementation-status.md](docs/implementation-status.md): requirements checklist and verification log
- [docs/architecture.md](docs/architecture.md): API contract, pagination, caching and provider mappings
- [DESIGN.md](DESIGN.md): visual direction, tokens, layout and references
- [docs/ai-usage.md](docs/ai-usage.md): how AI assistance was used and what the developer decided
