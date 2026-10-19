const ITEM_SELECTOR = '[data-article-id]'

export interface ReadingAnchor {
  id: string
  top: number
}

const articleElements = () =>
  document.querySelectorAll<HTMLElement>(ITEM_SELECTOR)

/** Bottom edge of the visible sticky header, which covers the top of the viewport. */
function stickyHeaderBottom() {
  const header = document.querySelector('[data-sticky-header]')
  return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
}

/** The first article not hidden under the sticky header, and its viewport offset. */
export function findReadingAnchor(): ReadingAnchor | null {
  const visibleTop = stickyHeaderBottom()
  for (const element of articleElements()) {
    const rect = element.getBoundingClientRect()
    if (rect.bottom > visibleTop) {
      return { id: element.dataset.articleId!, top: rect.top }
    }
  }
  return null
}

/** Scrolls so the anchored article is back at its recorded offset. */
export function restoreReadingAnchor(anchor: ReadingAnchor) {
  const element = [...articleElements()].find(
    (item) => item.dataset.articleId === anchor.id,
  )
  if (!element) return
  const moved = element.getBoundingClientRect().top - anchor.top
  if (Math.abs(moved) >= 1) window.scrollBy({ top: moved, behavior: 'instant' })
}
