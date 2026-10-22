# News Desk

A React + TypeScript news aggregator that merges articles from **The Guardian**, **The New York Times** and **NewsAPI** into one responsive reading interface.

**Live app: https://innoscripta-news-aggregator-chi.vercel.app** (Live mode with real provider data)

| Explore (Demo data)                                                                                                    | Preferences                                                                                                                          | My Feed (mobile)                                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| <img src="docs/screenshots/phase-3/desktop-explore.png" width="320" alt="Explore page with filters and article cards"> | <img src="docs/screenshots/phase-4/desktop-preferences.png" width="320" alt="Preferences form with sources, categories and authors"> | <img src="docs/screenshots/phase-4/mobile-myfeed.png" width="160" alt="My Feed on a phone"> |

Screenshots use the synthetic Demo data, which has no images; Live articles show provider images.

## Start here

A suggested path through the app, on the [Live app](https://innoscripta-news-aggregator-chi.vercel.app) or a [local run](#run-locally):

1. **Explore:** search for a keyword, then filter by source, category and date range (inclusive UTC days). Search applies after a short pause or immediately on Enter. Filters live in the URL, so reload, sharing and Back/Forward restore them.
2. **Load more:** scroll to the end of the results. The next batch follows the server's cursor, duplicates across providers are removed, and your reading position stays put. Notes explain partial failures, provider limits and the real end of results.
3. **Preferences:** select sources and categories, optionally add authors (typed as full names or picked from loaded articles), then **Save**. **Cancel** restores the saved preferences; **Reset** clears only the draft.
4. **My Feed:** shows articles matching the saved preferences: OR within a group, AND between groups, and an empty group means "any". With nothing saved, it asks you to choose preferences.
5. **Mobile:** below 1024px, **Filters** opens a sheet. Changes apply only on **Apply**; **Cancel** discards them.

## Run locally

### Requirements

- **Node.js 22** (`.nvmrc`). The production build, Docker image, CI and Vercel all use Node 22.
- **pnpm 10.33.0** (pinned in `package.json` → `packageManager`; install with `npm install --global pnpm@10.33.0`)
- **Docker** with Compose v2.24+ (only for the container)

### Without keys (Demo)

A fresh checkout has no `.env`, so it runs in **Demo** mode: deterministic, fictional articles with `example.com` links, no API keys, no outbound requests and a permanent **Demo data** badge.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5173. `pnpm dev` runs Vite and the Express API (port 8080, or `PORT` from the shell or `.env`) together, and Vite proxies `/api` to the API.

To run the production build:

```bash
pnpm build
pnpm start      # client and API on http://localhost:8080
```

### Docker

```bash
docker compose up --build
```

- **Demo:** without `.env`, serves the app and API on http://localhost:8080.
- **Live:** create `.env` as below and run the same command.
- **Port in use:** `HOST_PORT=8081 docker compose up --build`. Inside the container the API always listens on 8080, so `PORT` in `.env` does not apply.

The multi-stage Node 22 image installs production dependencies only, runs as the non-root `node` user and includes a health check.

### Live mode

Copy `.env.example` to `.env` and fill in:

```dotenv
NEWS_MODE=live
GUARDIAN_API_KEY=...   # https://open-platform.theguardian.com/access/
NYT_API_KEY=...        # https://developer.nytimes.com/
NEWSAPI_API_KEY=...    # https://newsapi.org/register
```

- **Required keys:** all three. Without them, `/api/feed` returns `503 configuration_error`, and the app says so instead of falling back to Demo data.
- **Where keys live:** only on the server. They never use a `VITE_` prefix and never reach the browser, and `.env` is git- and Docker-ignored.
- **Loading:** `pnpm dev`, `pnpm start` and Docker Compose load `.env` when present. Variables already exported in the shell take precedence.
- **Checking the setup:** `GET /api/health` shows the mode and which keys are configured, without revealing them.

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

The browser calls only the BFF (`GET /api/health`, `GET /api/feed`). The BFF queries the three providers in parallel with a 5-second timeout each, normalizes and validates the articles, caches successful pages for 5 minutes and returns per-provider statuses with an opaque cursor. On the client, TanStack Query handles requests and pagination, and React context holds the saved preferences. See [docs/architecture.md](docs/architecture.md) for details.

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
