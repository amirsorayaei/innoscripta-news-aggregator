import { http, HttpResponse } from 'msw/http'
import type { HealthResponse } from '@shared/health'
import { defaultFeed } from './feed'

export const demoHealth: HealthResponse = {
  status: 'ok',
  mode: 'demo',
  ready: true,
  providers: [
    { id: 'guardian', configured: false },
    { id: 'nyt', configured: false },
    { id: 'newsapi', configured: false },
  ],
}

export const handlers = [
  http.get('*/api/health', () => HttpResponse.json(demoHealth)),
  defaultFeed,
]
