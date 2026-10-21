import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

/**
 * Port the Vite dev proxy forwards `/api` to. It matches how `pnpm dev:server`
 * loads `--env-file-if-exists=.env`: an exported PORT wins over the file, and
 * 8080 is the default. Only PORT is read, so nothing else reaches Vite.
 */
export function devApiPort(
  env: NodeJS.ProcessEnv = process.env,
  envFile = '.env',
): string {
  if (env.PORT !== undefined) return env.PORT
  const fromFile = existsSync(envFile)
    ? parseEnv(readFileSync(envFile, 'utf8')).PORT
    : undefined
  return fromFile ?? '8080'
}
