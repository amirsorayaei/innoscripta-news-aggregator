import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { demoHealth } from '@/test/handlers'
import { renderApp } from '@/test/render-app'
import { server } from '@/test/server'

describe('AppShell', () => {
  it('redirects the root path to Explore', async () => {
    const { router } = renderApp('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Explore' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/explore')
  })

  it('marks the current page in the main navigation', async () => {
    renderApp('/preferences')

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(
      within(nav).getByRole('link', { name: 'Preferences' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      within(nav).getByRole('link', { name: 'Explore' }),
    ).not.toHaveAttribute('aria-current')
  })

  it('navigates between pages from the main navigation', async () => {
    const { user } = renderApp('/explore')

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    await user.click(within(nav).getByRole('link', { name: 'My Feed' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'My Feed' }),
    ).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', async () => {
    renderApp('/does-not-exist')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Explore' })).toHaveAttribute(
      'href',
      '/explore',
    )
  })

  it('labels Demo mode from the health endpoint', async () => {
    renderApp('/explore')

    expect((await screen.findAllByText('Demo data')).length).toBeGreaterThan(0)
  })

  it('warns when Live mode is missing provider keys', async () => {
    server.use(
      http.get('*/api/health', () =>
        HttpResponse.json({ ...demoHealth, mode: 'live', ready: false }),
      ),
    )
    renderApp('/explore')

    expect(
      (await screen.findAllByText('Live · keys missing')).length,
    ).toBeGreaterThan(0)
  })

  it('reports an unreachable server instead of guessing the mode', async () => {
    server.use(
      http.get('*/api/health', () =>
        HttpResponse.json(
          { error: { code: 'internal_error', message: 'Boom' } },
          { status: 500 },
        ),
      ),
    )
    renderApp('/explore')

    expect(
      (await screen.findAllByText('Server unreachable')).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText('Demo data')).not.toBeInTheDocument()
  })
})
