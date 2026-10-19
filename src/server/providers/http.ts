import type { ProviderErrorCode } from '../../shared/feed.js'
import { ProviderError } from './types.js'

export interface UpstreamResponse {
  status: number
  body: unknown
}

/**
 * GET JSON from a provider. Network failures become safe ProviderErrors; abort
 * reasons are rethrown so callers can tell timeouts from client disconnects.
 * Callers must not log `url`, which can contain an API key.
 */
export async function getUpstreamJson(
  url: URL,
  signal: AbortSignal,
  headers: Record<string, string> = {},
): Promise<UpstreamResponse> {
  let response: Response
  try {
    response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json', ...headers },
    })
  } catch {
    if (signal.aborted) throw signal.reason
    throw new ProviderError('upstream_unavailable')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (signal.aborted) throw signal.reason
    body = undefined
  }
  return { status: response.status, body }
}

/** Safe error code for a non-2xx upstream status. */
export function errorCodeForStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'upstream_unavailable'
  return 'bad_request'
}
