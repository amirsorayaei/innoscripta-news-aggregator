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
- **Developer review findings, fixed by the agent with regression tests:**
  - A long applied-search chip overflowed 320px screens.
  - Load more restored a stale, click-time scroll position.
  - `invalid_cursor` offered a retry of the rejected cursor.

  While reproducing the first finding, the agent found that its earlier 320px checks compared `scrollWidth` with `innerWidth`, which mobile emulation widens. The checks now compare against the fixed 320px width.

## Phase 4: Preferences and My Feed

- **Developer:** defined the scope and acceptance criteria (explicit Save/Cancel/Reset, validated versioned storage, honest persistence feedback, cache-only author suggestions and no generic request for empty preferences), and reviews and merges the PR.
- **Claude Code (agent):**
  - ran the bounded hosted Phase 3 preflight;
  - implemented the preferences provider, storage, draft form, author picker and My Feed;
  - wrote the unit, integration and Playwright tests;
  - reviewed layouts through screenshots at several widths;
  - updated the docs.
- **Corrections found during verification:**
  - A test expected case-only author differences to count as unchanged. The implementation compares display forms, so the test was corrected.
  - Synchronous tests that ended before `/api/health` settled produced MSW abort noise; they now wait for the mode badge.
  - On small screens Save wrapped onto its own line, so the action buttons are now grouped.

## Phase 5: release readiness

- **Developer:** defined the release checks: requirements audit, design and accessibility review, clean checkout, Docker, bounded hosted Live checks, secrets hygiene and final docs. The developer reviews and merges the final PR.
- **Claude Code (agent):**
  - ran the scripted UI and accessibility review, the clean-checkout and Docker verification, the bounded hosted checks and the secrets scan;
  - fixed the confirmed issues: hover contrast, heading order, touch targets and the in-project pnpm store breaking `format:check`;
  - rewrote the README and recorded the evidence in `docs/implementation-status.md`;
  - after the merge, ran the post-merge production check and recorded it in a follow-up docs PR.
- **Agent corrections:**
  - A hosted check first reported zero author suggestions because it counted before the page rendered; a careful repeat showed 12.
  - A Live screenshot was captured, then deliberately not committed, because it contained third-party news images.
