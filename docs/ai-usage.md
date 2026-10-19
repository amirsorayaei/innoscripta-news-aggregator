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
