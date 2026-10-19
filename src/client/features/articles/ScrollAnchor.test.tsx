import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScrollAnchor } from './ScrollAnchor'

let scrolled = 0
let headerBottom = 0

beforeEach(() => {
  // Simulated layout: rows are 100px tall, stacked in DOM order.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.hasAttribute('data-sticky-header')) {
        return { top: 0, bottom: headerBottom } as DOMRect
      }
      const index = [...(this.parentElement?.children ?? [])].indexOf(this)
      const top = index * 100 - scrolled
      return { top, bottom: top + 100 } as DOMRect
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  scrolled = 0
  headerBottom = 0
  document.body.innerHTML = ''
})

interface FeedProps {
  ids: string[]
  loading: boolean
  stream?: string
}

function Feed({ ids, loading, stream = 'stream-a' }: FeedProps) {
  return (
    <ScrollAnchor items={ids} armed={loading} stream={stream}>
      <ul>
        {ids.map((id) => (
          <li key={id} data-article-id={id} />
        ))}
      </ul>
    </ScrollAnchor>
  )
}

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

describe('ScrollAnchor', () => {
  it('keeps the article being read in place when newer articles are merged above it', () => {
    scrolled = 150 // "b" is first visible, 50px above the viewport top
    const { rerender } = render(<Feed ids={ids} loading={false} />)
    rerender(<Feed ids={ids} loading />)

    rerender(<Feed ids={['x', 'a', 'y', ...ids.slice(1)]} loading={false} />)

    expect(window.scrollBy).toHaveBeenCalledWith({
      top: 200,
      behavior: 'instant',
    })
  })

  it('uses the position at merge time, not when loading started', () => {
    scrolled = 150
    const { rerender } = render(<Feed ids={ids} loading={false} />)
    rerender(<Feed ids={ids} loading />)

    scrolled = 450 // the user scrolls while the page loads: "e" is now first visible
    rerender(<Feed ids={['x', ...ids]} loading={false} />)

    expect(window.scrollBy).toHaveBeenCalledTimes(1)
    expect(window.scrollBy).toHaveBeenCalledWith({
      top: 100,
      behavior: 'instant',
    })
  })

  it('ignores articles hidden under the sticky header', () => {
    headerBottom = 56
    scrolled = 160 // "b" ends 40px from the top, under the 56px header
    const header = document.createElement('header')
    header.setAttribute('data-sticky-header', '')
    document.body.append(header)
    const { rerender } = render(<Feed ids={ids} loading />)

    rerender(<Feed ids={['a', 'b', 'x', ...ids.slice(2)]} loading={false} />)

    expect(window.scrollBy).toHaveBeenCalledWith({
      top: 100,
      behavior: 'instant',
    })
  })

  it('does not restore after a refresh or a different filter stream', () => {
    scrolled = 150
    const { rerender } = render(<Feed ids={ids} loading={false} />)
    rerender(<Feed ids={['x', ...ids]} loading={false} />) // refresh: not loading more

    rerender(<Feed ids={ids} loading />)
    rerender(<Feed ids={['y', ...ids]} loading={false} stream="stream-b" />)

    expect(window.scrollBy).not.toHaveBeenCalled()
  })

  it('does not scroll when the article being read has not moved', () => {
    const { rerender } = render(<Feed ids={['a', 'b']} loading />)
    rerender(<Feed ids={['a', 'b', 'c']} loading={false} />)
    expect(window.scrollBy).not.toHaveBeenCalled()
  })
})
