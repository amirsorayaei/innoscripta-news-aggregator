import { useAppMode } from '@/features/app-mode/useAppMode'

/**
 * Feed requests wait until the server's mode is known. A health failure or an
 * unconfigured Live server is reported, never replaced with a guessed mode.
 */
export function useFeedMode() {
  const { data, isPending, isError, refetch } = useAppMode()
  if (isPending) return { state: 'loading' } as const
  if (isError) return { state: 'error', retry: () => void refetch() } as const
  if (!data.ready) return { state: 'unconfigured' } as const
  return { state: 'ready', mode: data.mode } as const
}
