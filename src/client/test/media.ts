import { DESKTOP_QUERY } from '@/hooks/use-media-query'

let desktop = true

/** jsdom has no matchMedia; tests choose the desktop or mobile layout. */
export function setDesktop(value: boolean) {
  desktop = value
}

export function installMatchMedia() {
  window.matchMedia = (query: string) =>
    ({
      matches: query === DESKTOP_QUERY ? desktop : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
