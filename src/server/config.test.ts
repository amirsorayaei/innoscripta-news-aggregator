import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'

describe('loadConfig', () => {
  it('defaults to Demo mode on port 8080 without keys', () => {
    expect(loadConfig({})).toEqual({
      mode: 'demo',
      port: 8080,
      apiKeys: { guardian: undefined, nyt: undefined, newsapi: undefined },
    })
  })

  it('treats blank keys as missing', () => {
    const config = loadConfig({ NEWS_MODE: 'live', NYT_API_KEY: '   ' })
    expect(config.apiKeys.nyt).toBeUndefined()
  })

  it('rejects unknown modes without echoing environment values', () => {
    expect(() =>
      loadConfig({ NEWS_MODE: 'auto', GUARDIAN_API_KEY: 'secret-key' }),
    ).toThrowError(/^Invalid server environment: NEWS_MODE$/)
  })
})
