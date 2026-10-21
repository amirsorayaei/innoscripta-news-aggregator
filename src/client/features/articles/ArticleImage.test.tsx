import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArticleImage } from './ArticleImage'

describe('ArticleImage', () => {
  it('shows the placeholder after an image fails to load', () => {
    const { container } = render(
      <ArticleImage src="https://img.test/broken.jpg" />,
    )
    fireEvent.error(container.querySelector('img')!)

    expect(container.querySelector('img')).toBeNull()
  })

  it('loads a new src after an earlier one failed', () => {
    // Merging can swap in a better image for the same article on Load more.
    const { container, rerender } = render(
      <ArticleImage src="https://img.test/broken.jpg" />,
    )
    fireEvent.error(container.querySelector('img')!)

    rerender(<ArticleImage src="https://img.test/valid.jpg" />)

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://img.test/valid.jpg',
    )
  })
})
