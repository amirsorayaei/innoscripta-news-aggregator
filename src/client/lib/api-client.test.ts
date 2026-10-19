import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { server } from '@/test/server'
import { ApiError, getJson } from './api-client'

const schema = z.object({ value: z.number() })

describe('getJson', () => {
  it('returns schema-validated data', async () => {
    server.use(http.get('*/api/sample', () => HttpResponse.json({ value: 1 })))

    await expect(getJson('/api/sample', schema)).resolves.toEqual({ value: 1 })
  })

  it('maps API error bodies to ApiError', async () => {
    server.use(
      http.get('*/api/sample', () =>
        HttpResponse.json(
          { error: { code: 'not_found', message: 'Unknown API route.' } },
          { status: 404 },
        ),
      ),
    )

    await expect(getJson('/api/sample', schema)).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
      message: 'Unknown API route.',
    })
  })

  it('rejects responses that do not match the contract', async () => {
    server.use(
      http.get('*/api/sample', () => HttpResponse.json({ value: 'one' })),
    )

    const error = await getJson('/api/sample', schema).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'invalid_response' })
  })

  it('handles non-JSON error responses', async () => {
    server.use(
      http.get(
        '*/api/sample',
        () => new HttpResponse('Bad gateway', { status: 502 }),
      ),
    )

    await expect(getJson('/api/sample', schema)).rejects.toMatchObject({
      status: 502,
      code: 'http_error',
    })
  })
})
