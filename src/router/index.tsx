import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';

import Landing from '@/pages/public/Landing';
import NotFound from '@/pages/public/NotFound';
import Privacy from '@/pages/public/Privacy';
import Terms from '@/pages/public/Terms';
import DeleteForm from '@/pages/public/DataDeletion';
import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import Onboarding from '@/pages/app/Onboarding';
import Home from '@/pages/app/Home';
import Search from '@/pages/app/Search';
import Messages from '@/pages/app/Messages';
import Profile from '@/pages/app/Profile';
import UserProfile from '@/pages/app/UserProfile';
import EditProfile from '@/pages/app/EditProfile';
import Settings from '@/pages/app/Settings';
import Learning from '@/pages/app/Learning';
import Admin from '@/pages/app/Admin';
import Library from '@/pages/features/library/Library';
import Partners from '@/pages/features/partners/Partners';
import BountyQueue from '@/pages/app/BountyQueue';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/privacy', element: <Privacy /> },
  { path: '/terms', element: <Terms /> },
  { path: '/data-deletion', element: <DeleteForm /> },
  {
    // Protected but shell-free — onboarding has its own full-screen layout
    element: <ProtectedRoute />,
    children: [
      { path: '/onboarding', element: <Onboarding /> },
    ],
  },
  {
    // Protected pages that need the full app shell (TopBar + Sidebar + BottomNav)
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/home', element: <Home /> },
          { path: '/search', element: <Search /> },
          { path: '/discover', element: <Navigate to='/search' replace /> },
          { path: '/messages', element: <Messages /> },
          { path: '/messages/:id', element: <Messages /> },
          { path: '/profile', element: <Profile /> },
          { path: '/profile/edit', element: <EditProfile /> },
          { path: '/u/:username', element: <UserProfile /> },
          { path: '/settings', element: <Settings /> },
          { path: '/learning', element: <Learning /> },
          { path: '/phrasebook', element: <Navigate to='/learning' replace /> },
          { path: '/bounty-queue', element: <BountyQueue /> },
          { path: '/library', element: <Library /> },
          { path: '/partners', element: <Partners /> },
          {
            element: <AdminRoute />,
            children: [
              { path: '/admin', element: <Admin /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
