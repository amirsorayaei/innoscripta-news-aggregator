import { Navigate, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { ExplorePage } from '@/features/explore/ExplorePage'
import { MyFeedPage } from '@/features/my-feed/MyFeedPage'
import { PreferencesPage } from '@/features/preferences/PreferencesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/explore" replace /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'my-feed', element: <MyFeedPage /> },
      { path: 'preferences', element: <PreferencesPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
