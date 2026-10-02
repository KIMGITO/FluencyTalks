import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { ProtectedRoute } from './ProtectedRoute'; import { AdminRoute } from './AdminRoute';
import Landing from '@/pages/public/Landing'; import NotFound from '@/pages/public/NotFound';
import Login from '@/pages/auth/Login'; import Signup from '@/pages/auth/Signup';
import ForgotPassword from '@/pages/auth/ForgotPassword'; import ResetPassword from '@/pages/auth/ResetPassword';
import Onboarding from '@/pages/app/Onboarding'; import Home from '@/pages/app/Home'; import Discover from '@/pages/app/Discover';
import Messages from '@/pages/app/Messages'; import Profile from '@/pages/app/Profile'; import UserProfile from '@/pages/app/UserProfile';
import EditProfile from '@/pages/app/EditProfile'; import Settings from '@/pages/app/Settings'; import Phrasebook from '@/pages/app/Phrasebook';
import FollowList from '@/pages/app/FollowList'; import Admin from '@/pages/app/Admin';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { element: <ProtectedRoute />, children: [
    { path: '/onboarding', element: <Onboarding /> },
    { element: <AppShell />, children: [
      { path: '/home', element: <Home /> }, { path: '/discover', element: <Discover /> },
      { path: '/messages', element: <Messages /> }, { path: '/messages/:id', element: <Messages /> },
      { path: '/profile', element: <Profile /> }, { path: '/profile/edit', element: <EditProfile /> },
      { path: '/u/:username', element: <UserProfile /> },
      { path: '/u/:username/followers', element: <FollowList kind="followers" /> }, { path: '/u/:username/following', element: <FollowList kind="following" /> }, { path: '/settings', element: <Settings /> }, { path: '/phrasebook', element: <Phrasebook /> },
      { element: <AdminRoute />, children: [{ path: '/admin', element: <Admin /> }] },
    ] },
  ] },
  { path: '*', element: <NotFound /> },
]);
