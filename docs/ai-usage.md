# AI usage

News Desk was built through a human-directed, agent-assisted engineering workflow: scoped phases, agent implementation, separate review, regression tests and CI-gated delivery. This page records the roles, tools and evidence behind that process.

## Roles

| Contributor             | Role                                                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Developer               | Created the repository and initial Vite scaffold. Set requirements, chose and approved the stack and scope after discussing options with the agents, made trade-off decisions, supplied credentials, directed each phase, and reviewed and merged PRs.                  |
| Claude Code (Anthropic) | Implemented the application code after the scaffold, tests, Docker, CI and deployment configuration, and most documentation. Ran checks, reproduced findings and fixed them with regression tests. Later used subagents to audit the client, server and delivery setup. |
| OpenAI Codex            | Contributed to planning, independently reviewed implementation changes, reproduced bugs, and ran selected automated and real-provider checks. Selected review and design guidance where useful, and prepared this workflow summary and the continuation instructions.   |

Examples of developer decisions:

- a server-side BFF;
- explicit Demo and Live modes with no fallback;
- real Load more pagination;
- Save/Cancel preferences;
- keeping NewsAPI on the free plan with publisher-based categories;
- keeping Guardian categories as OR'd tags;
- leaving the mixed NewsAPI category result inconclusive rather than tuning it into a pass.

Real-provider checks used the developer's keys. Selected real-key diagnostics and the post-merge production check were AI-assisted rather than purely manual.

## Tools and agent-assisted workflow

This account combines the two Claude Code session audits, Codex session records and the linked PRs. Tool and skill choices made by an agent are attributed to that agent; the developer set the scope and acceptance criteria.

### MCP and browser tools

| Tool                         | Used by                                         | Recorded use                                                                                                                |
| ---------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| GitHub MCP                   | Codex                                           | Read PR changes, check results and workflow logs for independent review.                                                    |
| Computer Use / browser tools | Codex; Claude Code's later browser-pane session | Browser inspection and UI interaction, including checking rendered documentation, screenshots and anchors on GitHub.        |
| Playwright / Chrome          | Claude Code and Codex                           | Browser reproductions and desktop/mobile E2E tests, including axe accessibility checks. Playwright was run through the CLI. |

The main Claude Code implementation session used built-in file and shell tools, Git/GitHub and Vercel CLIs, pnpm and Docker. It recorded no MCP calls or loaded skills; MCP-assisted browser inspection occurred in the later review and documentation session. Codex used MCP tools during its separate reviews.

### Skills and guidance

| Skill                    | Used by                                 | Scope of use                                                                                                                                 |
| ------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `impeccable`             | Codex                                   | Consulted for UX and visual-design planning.                                                                                                 |
| `shadcn`                 | Codex                                   | Consulted component and design-system guidance after the developer chose shadcn/ui. Claude Code installed components through the shadcn CLI. |
| `vercel-cli`             | Codex                                   | Consulted for deployment inspection and troubleshooting. Both agents also used the Vercel CLI.                                               |
| `caveman-review`         | Codex                                   | Applied review guidance to implementation changes and reported actionable findings.                                                          |
| `graphify`               | Codex                                   | Guide read; recorded as consultation only, with no generated graph artifact claimed.                                                         |
| `grilling` (`/grill-me`) | Claude Code, requested by the developer | Partially applied: an initial round of six decisions informed audit triage and scoped fixes.                                                 |
| `caveman`                | Claude Code                             | Session reply style.                                                                                                                         |

These are development aids, not application dependencies. Guide consultation does not mean that every step of a skill's workflow ran.

## Workflow

Implementation work and reviewed bug fixes followed this loop. Documentation-only edits did not need a reproduction or regression test.

1. **Developer direction:** requirements, architecture and scope decisions, followed by a plan and phased acceptance criteria.
2. **Agent implementation** on a feature branch, mainly by Claude Code, with incremental commits through the pre-commit hook.
3. **Separate review and reproduction**, mainly by Codex, looking for bugs and weak checks. A finding was reproduced before it was fixed.
4. **Fix with a regression test**, checking that the test fails on the previous code where practical.
5. **CI:** quality checks, unit and integration tests, Playwright with axe, and a Docker smoke test. A push to `main` deploys only after these pass.
6. **Developer review and merge** of the scoped PR before the next phase proceeds.

Neither the AI reviews nor the developer's review guarantee correctness. Remaining limitations and inconclusive results are recorded rather than hidden.

## Review findings that led to fixes

Concrete examples of the implementation/review/fix loop, with Codex review findings fixed by Claude Code:

- **Cursor eligibility** ([#2](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/2)): a tampered cursor could re-enable an excluded provider. The regression tests assert `invalid_cursor` before any adapter runs ([`feed-service.test.ts`](../src/server/feed/feed-service.test.ts)). The same review led to fixes for smoke-check false positives and malformed optional NYT image URLs.
- **Dates after Back/Forward** ([#13](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/13)): review of the initial fix found a stale date draft after Forward; a subsequent category click reapplied that wrong date. The new test fails on the previous implementation and verifies the restored field and the next filter request ([`ExplorePage.test.tsx`](../src/client/features/explore/ExplorePage.test.tsx), "shows the restored date after Back and Forward").
- **Focus after Load more** ([#15](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/15)): browser review found that completing the last page took focus back after the user had clicked away. Playwright tests now cover both retaining footer focus and respecting intentional blur on desktop and mobile ([`e2e/explore.spec.ts`](../e2e/explore.spec.ts), "final Load more" cases). The click-away test fails on the previous implementation.

Earlier examples include the reading-position fix in [#4](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/4) ([`ScrollAnchor.test.tsx`](../src/client/features/articles/ScrollAnchor.test.tsx)) and retrying a replacement image URL in [#9](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/9) ([`ArticleImage.test.tsx`](../src/client/features/articles/ArticleImage.test.tsx)).

## Rules and continuation

During development, the Git and safety rules came from the developer's global instructions and phase prompts. The repository's Husky/lint-staged hook and GitHub Actions enforced formatting and quality gates.

The project-level [CLAUDE.md](../CLAUDE.md) was added after implementation to make future agent sessions repeatable. It brings together the project boundaries, commands, secret-handling rules and maintainer-controlled PR workflow. It is a continuation guide, not a claim that this file existed throughout development.

## Verification

What was verified, on which commit and when, is recorded in [implementation-status.md](implementation-status.md).
