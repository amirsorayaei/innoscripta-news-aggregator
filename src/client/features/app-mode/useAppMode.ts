import { useQuery } from '@tanstack/react-query'
import { healthResponseSchema } from '@shared/health'
import { getJson } from '@/lib/api-client'

export function useAppMode() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) =>
      getJson('/api/health', healthResponseSchema, signal),
  })
}
