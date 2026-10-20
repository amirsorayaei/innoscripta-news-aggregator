import type { ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { PreferencesProvider } from '@/features/preferences/PreferencesProvider'

interface AppProvidersProps {
  queryClient: QueryClient
  children: ReactNode
}

export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>{children}</PreferencesProvider>
    </QueryClientProvider>
  )
}
