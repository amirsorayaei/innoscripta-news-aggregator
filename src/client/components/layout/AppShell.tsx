import { Outlet } from 'react-router'
import { ModeBadge } from '@/features/app-mode/ModeBadge'
import { Brand } from './Brand'
import { MainNav } from './MainNav'
import { MobileNav } from './MobileNav'

export function AppShell() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-sidebar px-3 py-4 lg:flex">
        <div className="px-3">
          <Brand />
        </div>
        <MainNav />
        <ModeBadge className="mx-3 mt-auto self-start" />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur lg:hidden">
        <MobileNav />
        <Brand />
        <ModeBadge className="ml-auto mr-2" />
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8"
      >
        <Outlet />
      </main>
    </div>
  )
}
