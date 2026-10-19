import { http, HttpResponse } from 'msw/http'
import type { FeedResponse } from '@shared/feed'
import { article, feedPage } from './articles'

/** Every /api/feed request URL, in order. Reset after each test. */
export const feedRequests: URL[] = []

type Responder = (
  url: URL,
) => FeedResponse | Response | Promise<FeedResponse | Response>

export const feedHandler = (respond: Responder) =>
  http.get('*/api/feed', async ({ request }) => {
    const url = new URL(request.url)
    feedRequests.push(url)
    const result = await respond(url)
    return result instanceof Response ? result : HttpResponse.json(result)
  })

/** Pages addressed by opaque cursors `page-2`, `page-3`, …; page one has no cursor. */
export function pagedFeed(pages: FeedResponse[]): Responder {
  return (url) => {
    const cursor = url.searchParams.get('cursor')
    const index = cursor ? Number(cursor.replace('page-', '')) - 1 : 0
    const page = pages[index]
    if (!page)
      return HttpResponse.json(
        { error: { code: 'invalid_cursor', message: 'x' } },
        { status: 400 },
      )
    return {
      ...page,
      nextCursor: index + 1 < pages.length ? `page-${index + 2}` : null,
    }
  }
}

/** Ten articles for one batch, newest first within the batch. */
export function batch(prefix: string, hour: number, count = 10) {
  return Array.from({ length: count }, (_, i) =>
    article({
      id: `${prefix}-${i}`,
      title: `${prefix} story ${i}`,
      publishedAt: new Date(Date.UTC(2026, 9, 19, hour, 59 - i)).toISOString(),
    }),
  )
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export const defaultFeed = feedHandler(() =>
  feedPage({
    articles: [
      article({ id: 'a', title: 'First story' }),
      article({
        id: 'b',
        title: 'Second story',
        providerId: 'nyt',
        publisherName: 'The New York Times',
      }),
    ],
  }),
)
