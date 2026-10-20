# Design

News Desk is a calm, light reading surface: warm off-white backgrounds, charcoal text and a restrained deep teal used for the active state and primary actions only. There is no dark mode.

## Tokens

Defined as shadcn semantic CSS variables in `src/client/index.css`:

| Token                                | Value (OKLCH)                      | Approx. hex           |
| ------------------------------------ | ---------------------------------- | --------------------- |
| `--background`                       | `0.985 0.006 85`                   | `#fcfaf6`             |
| `--card` / `--popover`               | `0.997 0.003 85`                   | `#fffefc`             |
| `--foreground`                       | `0.24 0.008 60`                    | `#221e1c`             |
| `--muted-foreground`                 | `0.5 0.012 60`                     | `#69625d`             |
| `--primary`                          | `0.45 0.08 195`                    | `#006363`             |
| `--accent` / `--accent-foreground`   | `0.94 0.025 195` / `0.36 0.07 195` | `#d9f1f0` / `#004848` |
| `--warning` / `--warning-foreground` | `0.95 0.05 85` / `0.42 0.09 60`    | `#feedc9` / `#703f0e` |
| `--destructive`                      | `0.52 0.19 27`                     | `#be2323`             |
| `--border` / `--input`               | `0.9 0.012 80`                     | `#e2ddd5`             |
| `--ring`                             | `0.55 0.09 195`                    | `#138282`             |

Typography uses Geist Sans, bundled locally through `@fontsource-variable/geist`. The base radius is 12px and spacing follows Tailwind's 4px scale.

### Measured contrast (WCAG 2.x)

| Pair                                        | Ratio         |
| ------------------------------------------- | ------------- |
| foreground on background                    | 15.8:1        |
| muted-foreground on background              | 5.8:1         |
| muted-foreground on muted / sidebar         | 5.3:1 / 5.4:1 |
| primary-foreground on primary               | 6.8:1         |
| primary-foreground on primary hover (`/90`) | 5.4:1         |
| accent-foreground on accent                 | 8.8:1         |
| warning-foreground on warning               | 7.5:1         |
| destructive on background                   | 5.8:1         |
| ring on background (non-text)               | 4.5:1         |

## Layout

- Routes: `/explore`, `/my-feed` and `/preferences`; `/` redirects to Explore.
- At 1024px and wider, a narrow sidebar holds the brand, navigation and mode badge.
- Below 1024px, navigation moves into a left Sheet opened from a sticky top bar. Explore's filter Sheet is separate. Both are modal, so the two never open together.
- Content is capped at 80rem with 16px gutters on small screens.
- Interactive targets are at least 44px on touch layouts (below 1024px), including chip removal, search clearing and author removal. Desktop uses compact 36px versions of a few secondary controls. A skip link, visible focus rings, and a reduced-motion rule that disables transitions and pulses are included.
- The primary button's hover state darkens only to 90% opacity, so its white text keeps AA contrast (shadcn's default 80% fell to 4.4:1).

## Explore

- **Order:** search first, then filters, then the applied-filter chips, then the feed. On desktop (1024px and up), filters sit in an inline card and apply as soon as they are valid. Below that, a **Filters** button with an applied-count badge opens a right-hand Sheet with Reset, Cancel and Apply.
- **Filter chips** are toggle buttons (`aria-pressed`) grouped in labelled fieldsets: Sources (The Guardian, The New York Times, NewsAPI) and the seven categories. Selected chips use the primary teal with a check icon. Dates are native date inputs with a UTC hint, and an invalid range shows a connected error (`aria-describedby`, `aria-invalid`).
- **Grid:** one column below 768px, two from 768px and three from 1280px. With the sidebar, the narrowest card is about 290px at 320px and 1280px wide, so no card is squeezed.
- **Cards:**
  - **Top:** a 16:9 image with reserved dimensions and lazy loading. A missing or broken image falls back to a quiet teal-tinted panel with a newspaper icon.
  - **Meta line:** the publisher, then "via …" when the provider differs or several providers returned the article, then a category pill. Publisher-based categories read "Sports · publisher" and explain themselves in a tooltip; unknown categories show no pill.
  - **Text:** the title (the only link; it opens a new tab and says so to screen readers), a 3-line summary, authors, and a relative time with the exact UTC time as a tooltip. Long text wraps with `overflow-wrap: anywhere` and is clamped.
- **States:**
  - **Loading:** a skeleton grid while loading or updating.
  - **Above the grid:** a "Showing N articles" status line with Refresh; a warning panel for unavailable sources; a muted "About these results" panel for provider notes.
  - **No results:** a dashed empty state with Clear filters.
  - **Below the grid:** a footer for Load more, sparse batches, pagination errors, a stream stopped by paused providers, or the end.
  - **Total failure:** a full-failure panel.

## Preferences and My Feed

- **Preferences:**
  - **Layout:** three cards (Sources, Categories, Authors) with fieldset legends and one-line explanations. Sources and categories reuse the Explore toggle chips at 44px.
  - **Authors:** selected names are teal-tinted pills that wrap instead of truncating, each with a 36px remove button labelled "Remove _name_". Below them are a labelled name field with an Add button, a connected error line, and suggestion buttons ("Add _name_") from loaded articles.
  - **Action bar:** sticky at the bottom with a status line (unsaved changes, saved, or not persisted) and Reset, Cancel and Save. Below `sm`, the status takes its own row so the three buttons stay together.
  - **Storage warning:** a warning panel appears when storage is unavailable.
- **My Feed:**
  - **No preferences:** a dashed setup card linking to Preferences.
  - **Otherwise:** a summary card of the saved groups (wrapping long names), an author-matching note when authors are set, and Edit preferences, followed by the shared article feed with personalized empty-state wording.

## References

These references guide hierarchy and density only. No layout or branding is copied.

- [shadcn/ui dashboard-01](https://ui.shadcn.com/blocks#dashboard-01): component language, tokens and navigation
- [daily.dev layouts](https://docs.daily.dev/layout/): hierarchy and the news card grid
- [Feedly views](https://docs.feedly.com/article/276-how-do-i-change-the-views-of-my-feeds-and-source): feed density and readability
- [Inoreader redesign](https://www.inoreader.com/blog/2024/10/the-new-inoreader-experience-is-here.html): separation of navigation and content
