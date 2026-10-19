import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'
import { navItems } from './nav-items'

interface MainNavProps {
  onNavigate?: () => void
}

export function MainNav({ onNavigate }: MainNavProps) {
  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  isActive &&
                    'bg-sidebar-accent text-sidebar-accent-foreground',
                )
              }
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
