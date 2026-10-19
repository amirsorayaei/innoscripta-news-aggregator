import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const clientDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../client',
)
const hasClientBuild = existsSync(path.join(clientDir, 'index.html'))

const app = createApp(config, {
  clientDir: hasClientBuild ? clientDir : undefined,
})

const server = app.listen(config.port, () => {
  console.log(
    `News Desk server listening on port ${config.port} (${config.mode} mode${hasClientBuild ? ', serving client build' : ', API only'})`,
  )
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)))
}
