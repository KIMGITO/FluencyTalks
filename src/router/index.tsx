import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';

import Landing from '@/pages/public/Landing';
import NotFound from '@/pages/public/NotFound';
import Privacy from '@/pages/public/Privacy';
import Terms from '@/pages/public/Terms';
import DeleteForm from '@/pages/public/DataDeletion';
import Blog from '@/pages/public/Blog';
import BlogPost from '@/pages/public/BlogPost';
import LanguagesIndex from '@/pages/public/LanguagesIndex';
import LanguagePage from '@/pages/public/LanguagePage';
import About from '@/pages/public/About';
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
import ContributePage from '@/pages/features/library/contribute/ContributePage';
import PostDetail from '@/pages/features/library/PostDetail';
import Notifications from '@/pages/app/Notifications';
import Partners from '@/pages/features/partners/Partners';
import BountyQueue from '@/pages/app/BountyQueue';
import PointsHistory from '@/pages/app/PointsHistory';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/privacy', element: <Privacy /> },
  { path: '/terms', element: <Terms /> },
  { path: '/data-deletion', element: <DeleteForm /> },
  { path: '/blog', element: <Blog /> },
  { path: '/blog/:slug', element: <BlogPost /> },
  { path: '/languages', element: <LanguagesIndex /> },
  { path: '/languages/:slug', element: <LanguagePage /> },
  { path: '/about', element: <About /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/onboarding', element: <Onboarding /> },
    ],
  },
  {
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
          { path: '/points-history', element: <PointsHistory /> },
          { path: '/library', element: <Library /> },
          { path: '/library/contribute', element: <ContributePage /> },
          { path: '/library/post/:id', element: <PostDetail /> },
          { path: '/notifications', element: <Notifications /> },
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
