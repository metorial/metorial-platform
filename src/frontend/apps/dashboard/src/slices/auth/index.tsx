import { createSlice } from '@metorial/microfrontend';
import { AuthLoginPage } from './pages/login';
import { AuthLogoutPage } from './pages/logout';
import { AuthSignupPage } from './pages/signup';

export let authSlice = createSlice([
  {
    path: '',
    children: [
      {
        path: 'login',
        element: <AuthLoginPage />
      },
      {
        path: 'signup',
        element: <AuthSignupPage />
      },
      {
        path: 'logout',
        element: <AuthLogoutPage />
      }
    ]
  }
]);
