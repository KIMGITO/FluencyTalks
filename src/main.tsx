import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { injectTokens } from '@/theme/inject';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { router } from '@/router';
import '@/styles/index.css';

injectTokens();
useThemeStore.getState().init();
useAuthStore.getState().init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>
);
