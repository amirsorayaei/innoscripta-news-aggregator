import { useCallback, useLayoutEffect, useRef } from 'react'

const ITEM_SELECTOR = '[data-article-id]'

/** Bottom edge of the visible sticky header, which covers the top of the viewport. */
function stickyHeaderBottom() {
  const header = document.querySelector('[data-sticky-header]')
  return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
}

/**
 * Keeps the first visible article in place when new results are merged in and
 * the grid reorders. `capture` records it before fetching; after the next
 * render with changed `items`, the window scrolls by however far it moved.
 */
export function useScrollAnchor(items: unknown) {
  const anchor = useRef<{ id: string; top: number } | null>(null)

  const capture = useCallback(() => {
    const visibleTop = stickyHeaderBottom()
    for (const element of document.querySelectorAll<HTMLElement>(
      ITEM_SELECTOR,
    )) {
      const rect = element.getBoundingClientRect()
      if (rect.bottom > visibleTop) {
        anchor.current = { id: element.dataset.articleId!, top: rect.top }
        return
      }
    }
    anchor.current = null
  }, [])

  useLayoutEffect(() => {
    const saved = anchor.current
    anchor.current = null
    if (!saved) return
    const element = [
      ...document.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
    ].find((item) => item.dataset.articleId === saved.id)
    if (!element) return
    const moved = element.getBoundingClientRect().top - saved.top
    if (Math.abs(moved) >= 1)
      window.scrollBy({ top: moved, behavior: 'instant' })
  }, [items])

  return capture
}
