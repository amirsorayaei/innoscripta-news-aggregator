import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { loadConfig } from './config.js'

describe('GET /api/health', () => {
  it('reports Demo mode as ready without provider keys', async () => {
    const response = await request(createApp(loadConfig({}))).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body).toEqual({
      status: 'ok',
      mode: 'demo',
      ready: true,
      providers: [
        { id: 'guardian', configured: false },
        { id: 'nyt', configured: false },
        { id: 'newsapi', configured: false },
      ],
    })
  })

  it('reports incomplete Live configuration without exposing keys', async () => {
    const config = loadConfig({
      NEWS_MODE: 'live',
      GUARDIAN_API_KEY: 'guardian-secret',
      NYT_API_KEY: 'nyt-secret',
    })
    const response = await request(createApp(config)).get('/api/health')

    expect(response.body).toMatchObject({ mode: 'live', ready: false })
    expect(response.body.providers).toContainEqual({
      id: 'newsapi',
      configured: false,
    })
    expect(response.text).not.toMatch(/secret/)
  })
})

describe('unknown API routes', () => {
  it('return JSON 404 instead of the client app', async () => {
    const response = await request(createApp(loadConfig({}))).get(
      '/api/unknown',
    )

    expect(response.status).toBe(404)
    expect(response.type).toBe('application/json')
    expect(response.body.error.code).toBe('not_found')
  })
})

describe('client build serving', () => {
  const clientDir = mkdtempSync(path.join(tmpdir(), 'news-aggregator-client-'))
  mkdirSync(path.join(clientDir, 'assets'))
  writeFileSync(path.join(clientDir, 'index.html'), '<div id="root"></div>')
  writeFileSync(path.join(clientDir, 'assets', 'app.js'), 'console.log(1)')
  const app = createApp(loadConfig({}), { clientDir })

  afterAll(() => rmSync(clientDir, { recursive: true, force: true }))

  it('serves index.html for client-side deep links', async () => {
    const response = await request(app).get('/preferences')

    expect(response.status).toBe(200)
    expect(response.text).toContain('id="root"')
  })

  it('serves hashed assets with long-lived caching', async () => {
    const response = await request(app).get('/assets/app.js')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toContain('immutable')
  })

  it('returns 404 for missing files instead of the app shell', async () => {
    expect((await request(app).get('/assets/missing.js')).status).toBe(404)
    expect((await request(app).get('/missing.png')).status).toBe(404)
  })

  it('keeps unknown API routes as JSON 404', async () => {
    const response = await request(app).get('/api/missing')

    expect(response.status).toBe(404)
    expect(response.type).toBe('application/json')
  })
})
