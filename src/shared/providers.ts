import { z } from 'zod'

export const providerIds = ['guardian', 'nyt', 'newsapi'] as const
export const providerIdSchema = z.enum(providerIds)
export type ProviderId = z.infer<typeof providerIdSchema>

export const providerNames: Record<ProviderId, string> = {
  guardian: 'The Guardian',
  nyt: 'The New York Times',
  newsapi: 'NewsAPI',
}
