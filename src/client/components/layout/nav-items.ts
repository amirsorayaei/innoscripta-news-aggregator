import {
  Compass,
  Newspaper,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/my-feed', label: 'My Feed', icon: Newspaper },
  { to: '/preferences', label: 'Preferences', icon: SlidersHorizontal },
]
