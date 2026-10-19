import type { RequestHandler, Response } from 'express'
import {
  FEED_QUERY_KEYS,
  feedFiltersFromParams,
} from '../../shared/feed-filters.js'
import type { FeedErrorCode } from '../../shared/feed.js'
import { InvalidCursorError } from './cursor.js'
import type { FeedService } from './feed-service.js'

function sendError(
  res: Response,
  status: number,
  code: FeedErrorCode,
  message: string,
  fields?: string[],
) {
  res
    .status(status)
    .json({ error: { code, message, ...(fields && { fields }) } })
}

export function createFeedHandler(
  feed: FeedService | undefined,
): RequestHandler {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!feed) {
      return sendError(
        res,
        503,
        'configuration_error',
        'Live mode needs API keys for all three providers.',
      )
    }

    const params = new URL(req.originalUrl, 'http://localhost').searchParams
    const filters = feedFiltersFromParams(params)
    if (!filters.success) {
      const fields = [
        ...new Set(filters.error.issues.map((i) => String(i.path[0]))),
      ]
      return sendError(
        res,
        400,
        'invalid_request',
        'Some filters are invalid.',
        fields,
      )
    }

    // Abort upstream work only if the client disconnects before the response
    // is finished; a normal "close" after sending is not a cancellation.
    const controller = new AbortController()
    const onClose = () => {
      if (!res.writableFinished) controller.abort()
    }
    res.on('close', onClose)

    try {
      const cursor = params.get(FEED_QUERY_KEYS.cursor) || undefined
      const result = await feed.getFeed(filters.data, cursor, controller.signal)
      if (!controller.signal.aborted)
        res.status(result.status).json(result.body)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof InvalidCursorError) {
        return sendError(res, 400, 'invalid_cursor', error.message)
      }
      throw error
    } finally {
      res.off('close', onClose)
    }
  }
}
