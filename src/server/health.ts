import type { HealthResponse } from '../shared/health.js'
import { providerIds } from '../shared/providers.js'
import type { ServerConfig } from './config.js'

export function getHealth({ mode, apiKeys }: ServerConfig): HealthResponse {
  const providers = providerIds.map((id) => ({
    id,
    configured: Boolean(apiKeys[id]),
  }))
  const ready =
    mode === 'demo' || providers.every((provider) => provider.configured)

  return { status: 'ok', mode, ready, providers }
}
