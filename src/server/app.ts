import path from 'node:path'
import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import type { ServerConfig } from './config.js'
import { createFeedHandler } from './feed/feed-route.js'
import type { FeedService } from './feed/feed-service.js'
import { createFeedServiceFromConfig } from './feed/from-config.js'
import { getHealth } from './health.js'

interface AppOptions {
  /** Built client directory; omitted when a CDN or Vite serves the client. */
  clientDir?: string
  /** Overrides the config-based feed service, e.g. with stub providers in tests. */
  feedService?: FeedService
}

const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: 'not_found', message: 'Unknown API route.' },
  })
}

const handleError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error)
  console.error(error instanceof Error ? error.message : error)
  res.status(500).json({
    error: { code: 'internal_error', message: 'Unexpected server error.' },
  })
}

export function createApp(config: ServerConfig, options: AppOptions = {}) {
  const app = express()
  app.disable('x-powered-by')

  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json(getHealth(config))
  })
  app.get(
    '/api/feed',
    createFeedHandler(
      options.feedService ?? createFeedServiceFromConfig(config),
    ),
  )
  app.use('/api', apiNotFound)

  if (options.clientDir) serveClient(app, options.clientDir)

  app.use(handleError)
  return app
}

function serveClient(app: ReturnType<typeof express>, clientDir: string) {
  const indexFile = path.join(clientDir, 'index.html')

  app.use(
    '/assets',
    express.static(path.join(clientDir, 'assets'), {
      immutable: true,
      maxAge: '1y',
    }),
  )
  app.use(express.static(clientDir, { index: false }))

  // SPA fallback for route-like paths only, so missing files still 404.
  app.get(/.*/, (req, res, next) => {
    if (path.extname(req.path)) return next()
    res.set('Cache-Control', 'no-cache').sendFile(indexFile)
  })
}
