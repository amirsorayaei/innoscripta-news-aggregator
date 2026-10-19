import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScrollAnchor } from './use-scroll-anchor'

let scrolled = 0
let headerBottom = 0

/** Simulated layout: rows are 100px tall, stacked in DOM order. */
function mockLayout() {
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
}

function List({ ids }: { ids: string[] }) {
  const capture = useScrollAnchor(ids)
  return (
    <>
      <button onClick={capture}>Load more</button>
      <ul>
        {ids.map((id) => (
          <li key={id} data-article-id={id} />
        ))}
      </ul>
    </>
  )
}

const capture = () => fireEvent.click(screen.getByRole('button'))

afterEach(() => {
  vi.restoreAllMocks()
  scrolled = 0
  headerBottom = 0
  document.body.innerHTML = ''
})

describe('useScrollAnchor', () => {
  it('keeps the first visible article in place when newer articles are merged above it', () => {
    mockLayout()
    scrolled = 150
    const { rerender } = render(<List ids={['a', 'b', 'c']} />)

    capture() // "b" is first visible, 50px above the viewport top
    rerender(<List ids={['x', 'a', 'y', 'b', 'c']} />)

    expect(window.scrollBy).toHaveBeenCalledWith({
      top: 200,
      behavior: 'instant',
    })
  })

  it('ignores articles hidden under the sticky header', () => {
    mockLayout()
    headerBottom = 56
    scrolled = 160 // "b" ends 40px from the top, under the 56px header
    const header = document.createElement('header')
    header.setAttribute('data-sticky-header', '')
    document.body.append(header)
    const { rerender } = render(<List ids={['a', 'b', 'c']} />)

    capture() // "c" is the first article below the header
    rerender(<List ids={['a', 'b', 'x', 'c']} />)

    expect(window.scrollBy).toHaveBeenCalledWith({
      top: 100,
      behavior: 'instant',
    })
  })

  it('does not scroll when the anchor stays put', () => {
    mockLayout()
    const { rerender } = render(<List ids={['a', 'b']} />)
    capture()
    rerender(<List ids={['a', 'b', 'c']} />)
    expect(window.scrollBy).not.toHaveBeenCalled()
  })
})
