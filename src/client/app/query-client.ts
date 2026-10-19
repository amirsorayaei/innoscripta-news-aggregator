import { QueryClient } from '@tanstack/react-query'

// Retries and background refetches are manual so provider quotas stay predictable.
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      },
    },
  })
}
