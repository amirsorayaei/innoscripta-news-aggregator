# Working on News Aggregator

Instructions for future agent sessions, added after the case-study implementation. The development history and tool usage are recorded in [docs/ai-usage.md](docs/ai-usage.md).

## Start here

- [README.md](README.md): setup, commands and the code walkthrough.
- [docs/architecture.md](docs/architecture.md): boundaries, API contract and accepted trade-offs.
- [docs/design.md](docs/design.md): visual direction and responsive behaviour.

## Project boundaries

- Keep React UI in `src/client`, the Express BFF and provider adapters in `src/server`, and shared contracts in `src/shared`. `api/` exports the same server for Vercel.
- Prefer small components and functions with one responsibility. Reuse existing components, hooks and contracts; extract UI logic into a hook when it improves clarity. Apply DRY, KISS and SOLID without adding unnecessary layers.
- Preserve URL-owned Explore filters, explicit Save/Cancel preferences, cursor-based Load more and partial-provider failure handling.
- Keep Demo deterministic and keyless. Live must never silently fall back to Demo data. Preserve the documented provider category and pagination limitations.
- Keep comments brief and explain non-obvious decisions. Code, documentation and commit messages are in English.

## Toolchain and checks

Use Node 22 (`.nvmrc`) and pnpm 10.33.0 (`package.json`). Install with `pnpm install --frozen-lockfile`; use `pnpm dev` to run the app.

Available checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

- Reproduce a bug before fixing it and add a meaningful regression test. Where practical, show that it fails against the previous code and passes with the fix.
- Run checks appropriate to the change. For documentation-only changes, check formatting, links and factual claims; the normal PR workflow still runs CI.
- E2E runs against a production Demo build with Playwright and axe. `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e` can use an installed Chrome when bundled Chromium is unavailable.
- Do not claim browser behaviour from jsdom alone. Measure narrow-screen overflow against the configured viewport width; account for request cancellation when asserting network activity.

## Secrets and provider requests

- Keep API keys server-side, never under a `VITE_` variable. Never print, commit or copy `.env` contents or credentials into prompts, logs or documentation.
- Use Demo adapters or mocks for automated tests. `pnpm smoke:live` is a manual, quota-consuming check; run it only when live verification is explicitly in scope. Keep requests bounded and respect provider rate limits.

## Git and delivery

- Work on a feature branch, never commit directly to `main` or `master`. Keep commits incremental, with concise Conventional Commit subjects and a body only when needed.
- Never bypass hooks or use `--no-verify`. The pre-commit hook runs lint-staged: ESLint and Prettier for JS/TS, and Prettier for documentation and other configured files.
- Do not include `Co-Authored-By` trailers or AI mentions in commit messages. Disclose AI work in [docs/ai-usage.md](docs/ai-usage.md); do not add an AI footer to PR descriptions.
- Do not re-scaffold the checkout, discard unrelated changes, force-push or rewrite history.
- Open one PR per logical change, with the problem, resulting behaviour and actual validation. Stop for the maintainer's review and merge.
- Production deploys through the existing GitHub Actions workflow after a push to `main` passes Quality, E2E and Docker smoke. Do not deploy manually unless explicitly requested.
- Record only checks that actually ran, with the relevant commit and date. Keep known limitations and inconclusive results visible; distinguish historical evidence from a new verification.
