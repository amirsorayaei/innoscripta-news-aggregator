# AI usage

AI assistance was used openly throughout this project. This log records what it did and which decisions stayed with the developer. It is updated per phase.

## Planning

- The developer compared implementation plans drafted with two AI assistants (OpenAI Codex and Anthropic Claude), then chose the final architecture, scope, tooling, design direction and workflow. Examples include the BFF approach, explicit Demo/Live modes, real Load more pagination, Save/Cancel preferences, pnpm, and one PR per phase with personal review and merge.

## Phase 1: project foundation

- **Developer:** created the GitHub repository and the Vite scaffold, chose pnpm and TypeScript 6.0.3, installed the formatting and hook tooling, and reviews and merges the PR.
- **Claude Code (agent):** completed the tooling configuration, moved the code into `src/client`, `src/server` and `src/shared`, and wrote the app shell, health API, tests, Dockerfile, CI workflow, Vercel configuration and these documents. It ran the checks reported in the PR.
- **Corrections found during verification:**
  - MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`, which typecheck caught.
  - Missing static assets returned 500, which a smoke test caught.
  - Invalid configuration crashed with a stack trace and now exits with a clear message.
  - Vercel's type pass needed an `api/tsconfig.json`.

## Phase 2: news providers

- **Developer:** approved the phase scope. Chose to keep NewsAPI on the free key with curated publisher categories and explicit `categoryBasis`. Supplies and keeps the provider keys, and reviews and merges the PR.
- **Claude Code (agent):** implemented the shared contracts, adapters, feed service, Demo data, tests and the smoke command. Checked the provider documentation it could reach (NewsAPI's docs page). The Guardian and NYT doc sites could not be fetched from the agent's tools, so those adapters accept both known NYT response shapes, and the mappings were treated as unverified until the real-key run recorded below.
- **Deviation proposed by the agent and documented:** Guardian categories use OR'd keyword tags instead of sections, because the API ANDs `section` with `tag`, which would make "health OR business" impossible in one request.
- **Corrections found during verification:**
  - MSW 3 also intercepts Supertest's loopback requests, so the test helper now lets loopback traffic through.
  - Zod skips object refinements when field errors exist, which changed one test expectation.
  - A Docker smoke query returned exactly one page, so the CI check now uses a query with more than one page.
- **Developer review findings, fixed by the agent with regression tests:**
  - The smoke script reported success for a 200 page with no usable articles.
  - A tampered cursor could re-enable a provider that the source filter excluded.
  - A malformed optional NYT image URL threw and dropped neighbouring articles.
- **Developer decision:** keep Guardian OR'd tag filtering, with the tag mappings and mixed-category behaviour still to be verified with real keys.
- **Live verification:** the developer ran the full real-key smoke and two targeted NewsAPI diagnostics. From that evidence, the agent removed the two catalogue-missing NewsAPI sources and added request-context handling for the BBC Sport alias, leaving ambiguous BBC results unlabelled. It then re-ran only the NewsAPI smoke: 11 passed and 1 inconclusive. The inconclusive mixed-category result was kept as is, not tuned into a pass.

## Phase 3: Explore feed

- **Developer:** defined the phase scope and acceptance criteria (URL state, debounce, mobile draft Sheet, merge priority, cursor pagination, scroll anchoring and UX states), and reviews and merges the PR.
- **Claude Code (agent):** implemented the reusable article feed and the Explore page, wrote the unit, integration and Playwright tests, reviewed the UI through screenshots at several widths, and updated the docs. Corrections found during verification:
  - The React hooks lint rule flagged a ref read during render (replaced with state) and a test helper that reassigned an outer variable.
  - An import cycle in the new MSW test helpers was removed.
  - The scroll anchor stopped relying on `CSS.escape`, which jsdom lacks.
