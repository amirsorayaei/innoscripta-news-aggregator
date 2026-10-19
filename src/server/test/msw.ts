import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * MSW server for provider HTTP tests. Unexpected external requests fail the
 * test; loopback requests (Supertest, local servers) pass through.
 */
export function useMswServer() {
  const server = setupServer()
  beforeAll(() =>
    server.listen({
      onUnhandledFrame({ frame, defaults }) {
        const data = frame.data as { request?: Request }
        const host = data.request ? new URL(data.request.url).hostname : ''
        if (!LOOPBACK.has(host)) defaults.error()
      },
    }),
  )
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
  return server
}
