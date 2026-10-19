import { z } from 'zod'
import { providerIdSchema } from './providers.js'

export const newsModeSchema = z.enum(['demo', 'live'])
export type NewsMode = z.infer<typeof newsModeSchema>

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  mode: newsModeSchema,
  // Demo is always ready; Live is ready only when every provider key is set.
  ready: z.boolean(),
  providers: z.array(
    z.object({ id: providerIdSchema, configured: z.boolean() }),
  ),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>
