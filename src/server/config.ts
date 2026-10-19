import { z } from 'zod'
import { newsModeSchema, type NewsMode } from '../shared/health.js'
import type { ProviderId } from '../shared/providers.js'

const optionalKey = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional()

const envSchema = z.object({
  NEWS_MODE: newsModeSchema.default('demo'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  GUARDIAN_API_KEY: optionalKey,
  NYT_API_KEY: optionalKey,
  NEWSAPI_API_KEY: optionalKey,
})

export interface ServerConfig {
  mode: NewsMode
  port: number
  apiKeys: Record<ProviderId, string | undefined>
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.'))
    throw new Error(`Invalid server environment: ${fields.join(', ')}`)
  }

  const { NEWS_MODE, PORT, GUARDIAN_API_KEY, NYT_API_KEY, NEWSAPI_API_KEY } =
    parsed.data
  return {
    mode: NEWS_MODE,
    port: PORT,
    apiKeys: {
      guardian: GUARDIAN_API_KEY,
      nyt: NYT_API_KEY,
      newsapi: NEWSAPI_API_KEY,
    },
  }
}
