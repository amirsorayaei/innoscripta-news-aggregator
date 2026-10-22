# AI usage

AI assistance was used openly throughout this project, for planning, implementation, review and verification. This page records who did what and how AI output was checked.

## Roles

| Contributor             | Role                                                                                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Developer               | Created the repository and the initial Vite scaffold. Chose the tools and the final scope after discussing options with both AI assistants. Made the scope and trade-off decisions, supplied the provider API keys, and reviewed and merged the pull requests. |
| Claude Code (Anthropic) | Implemented most of the application code, the tests, the Docker, CI and deployment configuration, and the documentation. Ran verification, reproduced review findings and fixed them with regression tests.                                                    |
| OpenAI Codex            | Contributed to planning, reviewed the code separately from the implementation, reproduced bugs, and ran selected automated and real-provider checks.                                                                                                           |

Examples of developer decisions:

- a server-side BFF;
- explicit Demo and Live modes with no fallback;
- real Load more pagination;
- Save/Cancel preferences;
- keeping NewsAPI on the free plan with publisher-based categories;
- keeping Guardian categories as OR'd tags;
- leaving the mixed NewsAPI category result inconclusive rather than tuning it into a pass.

Real-provider checks used the developer's keys. Selected real-key diagnostics and the post-merge production check were AI-assisted rather than purely manual.

## Workflow

Implementation work and reviewed bug fixes followed this loop. Documentation-only edits did not need a reproduction or regression test.

1. **Implementation** on a feature branch, mostly by Claude Code, within a scope set by the developer.
2. **Separate review and reproduction**, mainly by Codex, looking for bugs and weak checks. A finding was reproduced before it was fixed.
3. **Fix with a regression test**, so the finding stays covered.
4. **CI:** quality checks, unit and integration tests, Playwright with axe, and a Docker smoke test.
5. **Developer review and merge** of one pull request per change.

Neither the AI reviews nor the developer's review guarantee correctness. Remaining limitations and inconclusive results are recorded rather than hidden.

## Review findings that led to fixes

Findings from Codex review, each fixed by Claude Code with a regression test:

- **Cursor eligibility** ([#2](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/2)): a tampered cursor could re-enable a provider that the source filter excluded. Such cursors are now rejected with `invalid_cursor` before any adapter runs ([`feed-service.test.ts`](../src/server/feed/feed-service.test.ts)). The same review also found:
  - the live smoke check passed pages with no usable articles ([`smoke-checks.test.ts`](../scripts/smoke-checks.test.ts));
  - a malformed optional NYT image URL dropped neighbouring articles ([`nyt.test.ts`](../src/server/providers/nyt.test.ts)).
- **Stale scroll anchor** ([#4](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/4)): Load more restored the reading position from the moment of the click, which undid scrolling during the request. The position is now taken just before the merged list renders ([`ScrollAnchor.test.tsx`](../src/client/features/articles/ScrollAnchor.test.tsx)). The same review also found:
  - a long search chip overflowed 320px screens;
  - a rejected cursor offered a retry instead of Refresh ([`ExplorePage.test.tsx`](../src/client/features/explore/ExplorePage.test.tsx)).
- **Image replacement** ([#9](https://github.com/amirsorayaei/innoscripta-news-aggregator/pull/9)): Codex's independent review of the finished project found that a card kept its placeholder after a merge supplied a different, valid image URL. The card now retries the new URL ([`ArticleImage.test.tsx`](../src/client/features/articles/ArticleImage.test.tsx)).

## Verification

What was verified, on which commit and when, is recorded in [implementation-status.md](implementation-status.md).
