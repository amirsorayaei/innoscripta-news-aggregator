import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'

/** MSW server for provider HTTP tests; unexpected requests fail the test. */
export function useMswServer() {
  const server = setupServer()
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
  return server
}
