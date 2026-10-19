import { Component, type ReactNode } from 'react'
import {
  findReadingAnchor,
  restoreReadingAnchor,
  type ReadingAnchor,
} from './reading-anchor'

interface ScrollAnchorProps {
  /** A new value whenever the rendered list changes. */
  items: unknown
  /** True while a next page loads; the update that merges it keeps the reading position. */
  armed: boolean
  /** Pagination stream identity, so restoration never crosses filter streams. */
  stream: string
  children: ReactNode
}

/**
 * Keeps the article being read in place when a loaded page is merged and the
 * grid reorders. getSnapshotBeforeUpdate (class-only) reads the layout just
 * before React applies the new list, so scrolling during the request counts.
 */
export class ScrollAnchor extends Component<ScrollAnchorProps> {
  getSnapshotBeforeUpdate(prev: ScrollAnchorProps): ReadingAnchor | null {
    const merging =
      prev.armed &&
      prev.items !== this.props.items &&
      prev.stream === this.props.stream
    return merging ? findReadingAnchor() : null
  }

  componentDidUpdate(
    _prev: ScrollAnchorProps,
    _state: unknown,
    anchor: ReadingAnchor | null,
  ) {
    if (anchor) restoreReadingAnchor(anchor)
  }

  render() {
    return this.props.children
  }
}
