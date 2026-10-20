import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { article, feedPage } from '@/test/articles'
import { feedHandler, feedRequests } from '@/test/feed'
import { seedPreferences, storedPreferences } from '@/test/preferences'
import { renderApp } from '@/test/render-app'
import { server } from '@/test/server'

const NOT_PERSISTED = 'Changes are not persisted on this device.'
const chip = (name: string) => screen.getByRole('button', { name })
const saveStatus = () => screen.getByRole('status')
const authorInput = () => screen.getByRole('textbox', { name: 'Author name' })

afterEach(() => vi.restoreAllMocks())

describe('Preferences drafts', () => {
  it('keeps edits in the draft until Save, even across navigation', async () => {
    const { router, user } = renderApp('/preferences')

    await user.click(chip('The Guardian'))
    expect(saveStatus()).toHaveTextContent('You have unsaved changes.')

    await act(() => router.navigate('/my-feed'))
    expect(await screen.findByText('Set up your feed')).toBeInTheDocument()
    expect(feedRequests).toHaveLength(0)

    await act(() => router.navigate('/preferences'))
    expect(chip('The Guardian')).toHaveAttribute('aria-pressed', 'false')
    expect(storedPreferences()).toBeNull()
  })

  it('applies and persists on Save', async () => {
    const { router, user } = renderApp('/preferences')

    await user.click(chip('The Guardian'))
    await user.click(chip('Health'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(saveStatus()).toHaveTextContent('Preferences saved.')
    expect(storedPreferences()).toEqual({
      schemaVersion: 1,
      preferences: {
        sources: ['guardian'],
        categories: ['health'],
        authors: [],
      },
    })

    await act(() => router.navigate('/my-feed'))
    await waitFor(() =>
      expect(feedRequests.map((url) => url.search)).toEqual([
        '?source=guardian&category=health',
      ]),
    )
  })

  it('Cancel restores the applied preferences; Reset only clears the draft', async () => {
    seedPreferences({ sources: ['nyt'] })
    const { router, user } = renderApp('/preferences')

    await user.click(chip('The Guardian'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(chip('The Guardian')).toHaveAttribute('aria-pressed', 'false')
    expect(chip('The New York Times')).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(chip('The New York Times')).toHaveAttribute('aria-pressed', 'false')
    expect(storedPreferences()?.preferences.sources).toEqual(['nyt'])
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(chip('The New York Times')).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(storedPreferences()?.preferences).toEqual({
      sources: [],
      categories: [],
      authors: [],
    })

    await act(() => router.navigate('/my-feed'))
    expect(await screen.findByText('Set up your feed')).toBeInTheDocument()
    expect(feedRequests).toHaveLength(0)
  })
})

describe('Preferences persistence', () => {
  it('restores saved preferences on start without rewriting storage', async () => {
    seedPreferences({ sources: ['nyt'], authors: ['Jane Doe'] })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    renderApp('/my-feed')

    await waitFor(() =>
      expect(feedRequests.map((url) => url.search)).toEqual([
        '?source=nyt&author=Jane+Doe',
      ]),
    )
    expect(setItem).not.toHaveBeenCalled()
  })

  it('keeps working in memory when saving fails, and says so', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Quota', 'QuotaExceededError')
      })
    const { router, user } = renderApp('/preferences')

    await user.click(chip('The Guardian'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveStatus()).toHaveTextContent(
      `Preferences applied to My Feed. ${NOT_PERSISTED}`,
    )
    expect(saveStatus()).not.toHaveTextContent('Preferences saved.')
    expect(
      screen.getAllByText(new RegExp(NOT_PERSISTED)).length,
    ).toBeGreaterThan(1)

    await act(() => router.navigate('/my-feed'))
    await waitFor(() =>
      expect(feedRequests.map((url) => url.search)).toEqual([
        '?source=guardian',
      ]),
    )

    await act(() => router.navigate('/preferences'))
    expect(chip('The Guardian')).toHaveAttribute('aria-pressed', 'true')
    await user.click(chip('Health'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(chip('Health')).toHaveAttribute('aria-pressed', 'false')
    expect(chip('The Guardian')).toHaveAttribute('aria-pressed', 'true')

    setItem.mockRestore()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveStatus()).toHaveTextContent('Preferences saved.')
    expect(
      screen.queryByText(new RegExp(NOT_PERSISTED)),
    ).not.toBeInTheDocument()
    expect(storedPreferences()?.preferences.sources).toEqual(['guardian'])
  })

  it('starts safely when storage cannot be read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderApp('/preferences')
    await screen.findAllByText('Demo data')

    expect(screen.getByText(new RegExp(NOT_PERSISTED))).toBeInTheDocument()
    expect(chip('The Guardian')).toHaveAttribute('aria-pressed', 'false')
  })

  it('ignores stored data from an unsupported version', async () => {
    localStorage.setItem(
      'news-desk.preferences',
      JSON.stringify({
        schemaVersion: 99,
        preferences: { sources: ['nyt'], categories: [], authors: [] },
      }),
    )
    renderApp('/preferences')
    await screen.findAllByText('Demo data')
    expect(chip('The New York Times')).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Preferences authors', () => {
  it('adds typed full names, preserving accents and commas', async () => {
    const { user } = renderApp('/preferences')

    await user.type(authorInput(), '  Zoë   Ångström {Enter}')
    await user.type(authorInput(), 'Doe, Jane')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const selected = screen.getByRole('list', { name: 'Selected authors' })
    expect(
      within(selected)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Zoë Ångström', 'Doe, Jane'])
    expect(saveStatus()).toHaveTextContent('You have unsaved changes.')
  })

  it('explains duplicate, empty and over-long names next to the field', async () => {
    seedPreferences({ authors: ['Jane Doe'] })
    const { user } = renderApp('/preferences')

    await user.type(authorInput(), 'jane   DOE{Enter}')
    const error = screen.getByText('Jane Doe is already selected.')
    expect(authorInput()).toHaveAttribute('aria-invalid', 'true')
    expect(authorInput().getAttribute('aria-describedby')).toContain(error.id)

    await user.clear(authorInput())
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Enter an author’s full name.')).toBeInTheDocument()

    await user.type(authorInput(), 'a'.repeat(81))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(
      screen.getByText('Author names can be at most 80 characters.'),
    ).toBeInTheDocument()
  })

  it('stops at the shared limit of 20 authors', async () => {
    seedPreferences({
      authors: Array.from({ length: 20 }, (_, i) => `Author ${i}`),
    })
    const { user } = renderApp('/preferences')

    await user.type(authorInput(), 'One More{Enter}')
    expect(
      screen.getByText('You can follow up to 20 authors.'),
    ).toBeInTheDocument()
    expect(screen.getByText('20 of 20 authors')).toBeInTheDocument()
  })

  it('suggests authors from cached articles of the current mode only, without fetching', async () => {
    server.use(
      feedHandler(() =>
        feedPage({
          articles: [
            article({ id: 'a', authors: ['Amelia Hart', 'Tomás Rivera'] }),
            article({ id: 'b', authors: ['amelia hart'] }),
          ],
        }),
      ),
    )
    seedPreferences({ authors: ['Zed Nobody'] })
    const { router, user, queryClient } = renderApp('/explore')
    await screen.findByText('Showing 2 articles')
    queryClient.setQueryData(['feed', 'live', 'q=x'], {
      pages: [
        feedPage({
          mode: 'live',
          articles: [article({ id: 'c', authors: ['Live Only'] })],
        }),
      ],
      pageParams: [undefined],
    })

    await act(() => router.navigate('/preferences'))
    expect(feedRequests).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Add Amelia Hart' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add Tomás Rivera' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add Live Only' }),
    ).not.toBeInTheDocument()
    // A saved author missing from the suggestions stays selected.
    expect(
      screen.getByRole('button', { name: 'Remove Zed Nobody' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Amelia Hart' }))
    expect(
      screen.getByRole('button', { name: 'Remove Amelia Hart' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add Amelia Hart' }),
    ).not.toBeInTheDocument()

    act(() => {
      queryClient.setQueryData(['feed', 'demo', 'category=science'], {
        pages: [
          feedPage({
            articles: [article({ id: 'd', authors: ['Grace Mensah'] })],
          }),
        ],
        pageParams: [undefined],
      })
    })
    expect(
      await screen.findByRole('button', { name: 'Add Grace Mensah' }),
    ).toBeInTheDocument()
  })

  it('allows typing names when nothing is cached', async () => {
    renderApp('/preferences')
    await screen.findAllByText('Demo data')
    expect(
      screen.getByText(/Suggestions appear after articles have loaded/),
    ).toBeInTheDocument()
    expect(authorInput()).toBeEnabled()
  })
})
