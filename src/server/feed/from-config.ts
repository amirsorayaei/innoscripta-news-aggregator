import type { ServerConfig } from '../config.js'
import { DEFAULT_DEMO_NOW } from '../demo/demo-articles.js'
import { createDemoAdapters } from '../demo/demo-adapter.js'
import { createGuardianAdapter } from '../providers/guardian.js'
import { createNewsApiAdapter } from '../providers/newsapi.js'
import { createNytAdapter } from '../providers/nyt.js'
import { createFeedService, type FeedService } from './feed-service.js'

/**
 * Demo uses in-memory adapters only. Live needs all three keys; without them
 * there is no service, and the route reports a configuration error instead of
 * falling back to Demo data.
 */
export function createFeedServiceFromConfig(
  config: ServerConfig,
): FeedService | undefined {
  if (config.mode === 'demo') {
    return createFeedService({
      mode: 'demo',
      adapters: createDemoAdapters(config.demoNow ?? DEFAULT_DEMO_NOW),
    })
  }

  const { guardian, nyt, newsapi } = config.apiKeys
  if (!guardian || !nyt || !newsapi) return undefined
  return createFeedService({
    mode: 'live',
    adapters: {
      guardian: createGuardianAdapter(guardian),
      nyt: createNytAdapter(nyt),
      newsapi: createNewsApiAdapter(newsapi),
    },
  })
}
