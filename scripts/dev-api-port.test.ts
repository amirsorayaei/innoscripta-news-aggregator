import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { devApiPort } from './dev-api-port.js'

const dir = mkdtempSync(join(tmpdir(), 'dev-api-port-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

let files = 0
function envFile(contents: string | null): string {
  const path = join(dir, `.env.${files++}`)
  if (contents !== null) writeFileSync(path, contents)
  return path
}

/** The port the API server listens on when started like `pnpm dev:server`. */
function serverPort(file: string, exported?: string): string {
  const seen = execFileSync(
    process.execPath,
    [
      `--env-file-if-exists=${file}`,
      '-e',
      'process.stdout.write(process.env.PORT ?? "")',
    ],
    { env: exported === undefined ? {} : { PORT: exported } },
  ).toString()
  return seen || '8080'
}

describe('devApiPort', () => {
  it.each([
    ['no .env and no exported PORT', null, undefined, '8080'],
    ['PORT only in .env', 'NEWS_MODE=demo\nPORT=9091\n', undefined, '9091'],
    ['double-quoted PORT', 'PORT="9091"\n', undefined, '9091'],
    [
      'single-quoted PORT with a comment',
      "PORT='9091' # api\n",
      undefined,
      '9091',
    ],
    ['.env without PORT', 'NEWS_MODE=demo\n', undefined, '8080'],
    ['exported PORT over .env', 'PORT="9091"\n', '9092', '9092'],
    ['exported PORT without .env', null, '9092', '9092'],
  ])('agrees with the API server: %s', (_, contents, exported, expected) => {
    const file = envFile(contents)
    const env = exported === undefined ? {} : { PORT: exported }

    expect(devApiPort(env, file)).toBe(expected)
    expect(serverPort(file, exported)).toBe(expected)
  })
})
