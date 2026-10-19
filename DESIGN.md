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

| Pair                                | Ratio         |
| ----------------------------------- | ------------- |
| foreground on background            | 15.8:1        |
| muted-foreground on background      | 5.8:1         |
| muted-foreground on muted / sidebar | 5.3:1 / 5.4:1 |
| primary-foreground on primary       | 6.8:1         |
| accent-foreground on accent         | 8.8:1         |
| warning-foreground on warning       | 7.5:1         |
| destructive on background           | 5.8:1         |
| ring on background (non-text)       | 4.5:1         |

## Layout

- Routes: `/explore`, `/my-feed` and `/preferences`; `/` redirects to Explore.
- At 1024px and wider, a narrow sidebar holds the brand, navigation and mode badge.
- Below 1024px, navigation moves into a left Sheet opened from a sticky top bar. The filter Sheet in a later phase is separate, and the two never open together.
- Content is capped at 80rem with 16px gutters on small screens.
- Interactive targets are at least 44px tall. A skip link, visible focus rings, and a reduced-motion rule that disables transitions are included.

## References

These references guide hierarchy and density only. No layout or branding is copied.

- [shadcn/ui dashboard-01](https://ui.shadcn.com/blocks#dashboard-01): component language, tokens and navigation
- [daily.dev layouts](https://docs.daily.dev/layout/): hierarchy and the news card grid
- [Feedly views](https://docs.feedly.com/article/276-how-do-i-change-the-views-of-my-feeds-and-source): feed density and readability
- [Inoreader redesign](https://www.inoreader.com/blog/2024/10/the-new-inoreader-experience-is-here.html): separation of navigation and content
