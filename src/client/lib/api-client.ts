import type { z } from 'zod'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown }
}

export async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    signal,
    headers: { Accept: 'application/json' },
  })
  const body: unknown = await response.json().catch(() => undefined)

  if (!response.ok) {
    const error = (body as ErrorBody | undefined)?.error
    throw new ApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : 'http_error',
      typeof error?.message === 'string'
        ? error.message
        : `Request failed with status ${response.status}.`,
    )
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      'invalid_response',
      'The server sent an unexpected response.',
    )
  }
  return parsed.data
}
