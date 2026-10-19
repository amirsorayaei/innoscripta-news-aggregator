import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { feedRequests } from './feed'
import { installMatchMedia, setDesktop } from './media'
import { server } from './server'

installMatchMedia()
window.scrollBy = vi.fn()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  feedRequests.length = 0
  setDesktop(true)
  vi.mocked(window.scrollBy).mockClear()
})
afterAll(() => server.close())
